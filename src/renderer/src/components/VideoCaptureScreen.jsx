import React, { useEffect, useState } from "react";
import video2 from "../assets/avatar2.mp4";
import { data, useNavigate } from "react-router";
import { recordFromOpenCameras } from "../utils/recordSession";
import { getVideoDuration, getKioskId, getSessionId } from "../utils/config";
import { realtimeCapture, runFPT, sendVideoToBackend } from "../utils/api";
import { measureWeightAndHeight } from "../utils/measurementUtils";
import { storeFptMeasurements } from "../utils/measurementRedux";
import { useDispatch, useSelector } from "react-redux";
import { setUser } from "../features/common/commonSlice";
import { BIAMeasurementStage } from "../utils/api";
import { trackStage } from "../utils/config";
import ErrorAlert from "./ErrorAlert";
const USE_DUMMY_FPT = false;
const VideoCaptureScreen = () => {
  const navigate = useNavigate();
  const [isVerify, setIsVerify] = useState(false);
  const [phase, setPhase] = useState('');
  const [status, setStatus] = useState('Initializing...');
  const [showError, setShowError] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const attemptCountRef = React.useRef(0);
  const [shouldRetry, setShouldRetry] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const dispatch = useDispatch();
  const audioRef = React.useRef(null);
  const measurementStartedRef = React.useRef(false);
  const measurementPromiseRef = React.useRef(null);
  const trackingDoneRef = React.useRef(false);
  const hasStartedRef = React.useRef(false);
  const STAGES = {
    FACE_SCAN: "FACE_SCAN",
  };

  const STATUS = {
    SUCCESS: "SUCCESS",
    ERROR: "ERROR",
  };

  const dummyFptSuccessResponse = {
    success: true,
    student_status: "REGISTERED",
    buffer_id: getSessionId(),
    user_id: "1e375fdb-6cab-40fa-bc72-83ac9db84cf6",
    name: "Priyanshu",
  };
  const MAX_ATTEMPTS = 2;
  const instructionAudio = "/src/assets/audio/camera_scan.mp3";

  useEffect(() => {
    //   if (hasStartedRef.current) return;
    // hasStartedRef.current = true;
    const run = async () => {
      try {
        setStatus("Preparing...");
        playAudio();
        await new Promise((r) => setTimeout(r, 1000));

        const videoDuration = getVideoDuration();
        const kioskId = getKioskId();
        const sessionId = getSessionId();

        setStatus(`Recording for ${videoDuration / 1000} seconds...`);

        // Start measurements in background (non-blocking)
        // Use 20-second timeout to prevent infinite waiting if user not on sensors
        const MEASUREMENT_TIMEOUT = 6000; // 0 seconds

        if (!measurementStartedRef.current) {
          measurementStartedRef.current = true;

          measurementPromiseRef.current = (async () => {
            try {
              const ports = await window.api?.getPorts?.();
              if (!ports || ports.length < 1) return null;

              return await measureWeightAndHeight(ports, MEASUREMENT_TIMEOUT);
            } catch (err) {
              console.error("Measurement error:", err);
              return null;
            }
          })();
        }

        // Record video
        // const recordings = await recordFromOpenCameras(videoDuration);
        // console.log("recordings", recordings);

        // if (!recordings || recordings.length === 0) {
        //   throw new Error("No recordings captured");
        // }

        // setStatus("Uploading video...");

        // const videoToSend =
        //   recordings.find((r) => r.role === "CENTER") || recordings[0];

        // console.log(`Sending ${videoToSend.role} video to backend...`);

        // const storeResponse = await sendVideoToBackend(videoToSend);
        // console.log("Store response:", storeResponse);

        // const shmPath = storeResponse?.data?.shm_path;

        // if (!storeResponse?.success || !shmPath) {
        //   throw new Error("Failed to store video or shm_path not received");
        // }

        setStatus("Processing face verification...");

        console.log("Running realtime capture + face verification");

        let fptResponse;

        if (USE_DUMMY_FPT) {
          console.log("Using dummy FPT response...");
          fptResponse = dummyFptSuccessResponse;
        } else {
          fptResponse = await realtimeCapture();
        }
        console.log("FPT response:", fptResponse);
        // dispatch(setUser(fptResponse));

        // Check for API-level failure or face not recognized
        const isFailed = !fptResponse.success || fptResponse.student_status !== 'REGISTERED';

        // Check if user is not registered - redirect directly to login
        if (fptResponse.success && fptResponse.student_status === 'NOT_REGISTERED') {
          setShowError(true);
          setPhase("ERROR");
          setStatus("User not registered. Redirecting to login...");
          throw new Error("User not registered");
        }

        if (isFailed) {
          attemptCountRef.current += 1;
          setAttemptCount(attemptCountRef.current);
          setShowError(true);
          setPhase("ERROR");
          if (attemptCountRef.current < MAX_ATTEMPTS) {
            setStatus("Face not recognized. Retrying...");
          } else {
            setStatus("Face not recognized. Maximum attempts reached.");
          }
          throw new Error(fptResponse.error || "Face not recognized");
        }

        // Success case - Face recognition successful 
        dispatch(setUser(fptResponse));
        setStatus("Verification successful!");
        setIsVerify(true);
        stopAudio();

        // Wait for measurements to complete in background (non-blocking for FPT)
        // This happens after FPT succeeds, so measurements don't block the flow
        if (measurementPromiseRef.current) {
          measurementPromiseRef.current.then((measurements) => {
            if (measurements && !trackingDoneRef.current) {
              trackingDoneRef.current = true;
              console.log('[VIDEO CAPTURE] Storing measurements:', measurements);

              // Store measurements even if some failed
              if (measurements.weight || measurements.height) {
                storeFptMeasurements(
                  dispatch,
                  measurements.weight,
                  measurements.height
                );
                console.log('[VIDEO CAPTURE] Measurements saved!');

                // Track to backend
                trackStage(STAGES.FACE_SCAN, STATUS.SUCCESS, {
                  weight_kg: measurements.weight,
                  height_cm: measurements.height
                }, null, fptResponse?.buffer_id, fptResponse?.user_id);
              }

              // Log any errors
              if (measurements.errors && Object.keys(measurements.errors).length > 0) {
                let errorMessage = "";

                const hasWeightError = !!measurements.errors.weight;
                const hasHeightError = !!measurements.errors.height;

                if (hasWeightError && hasHeightError) {
                  errorMessage = "Failed to get weight and height measurement";
                } else if (hasWeightError) {
                  errorMessage = "Failed to get weight measurement";
                } else if (hasHeightError) {
                  errorMessage = "Failed to get height measurement";
                } else {
                  errorMessage = "User is not standing on the platform";
                }

                console.warn('[VIDEO CAPTURE] Measurement error:', errorMessage);

                // Send SINGLE STRING to backend
                trackStage(
                  STAGES.FACE_SCAN,
                  STATUS.ERROR,
                  {},
                  errorMessage,
                  fptResponse?.buffer_id,
                  fptResponse?.user_id
                );
              }

            }
          }).catch((error) => {
            console.error('[VIDEO CAPTURE] Error storing measurements:', error);
          });
        }

        await new Promise((r) => setTimeout(r, 500));
        navigate("/verified");

      } catch (error) {
        console.error("Error in video capture flow:", error);
        setPhase("ERROR");

        // Only set status if it's not already set
        if (!status.includes("Face not recognized")) {
          setStatus(`Error: ${error.message}`);
          setShowError(true);
        }
        stopAudio();
      }
    };

    run();
  }, [navigate, shouldRetry]);

  const handleErrorClose = () => {
    setShowError(false);
  };

  const handleRetry = () => {
    setShowError(false);
    // Redirect to login if user is not registered or max attempts reached
    if (status.includes("not registered") || attemptCountRef.current >= MAX_ATTEMPTS) {
      navigate("/login-suhi");
    } else {
      // Retry in-place by toggling shouldRetry
      setShouldRetry((prev) => !prev);
    }
  }; const playAudio = () => {
    if (audioRef.current) {
      setIsAudioPlaying(true);
      audioRef.current.play().catch((err) => {
        console.log("Audio playback failed:", err);
      });
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAudioPlaying(false);
    }
  };

  const handleAudioEnd = () => {
    setIsAudioPlaying(false);
  };

  return (
    <div
      className="
        fixed inset-0
        w-screen h-screen
        overflow-hidden
        bg-black
      "
    >
      {/* Audio Element */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnd}
        onPlay={() => setIsAudioPlaying(true)}
      >
        <source src={instructionAudio} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
      {/* Avatar Video */}
      <div
        className="
          border-0
          rounded-2xl
          absolute inset-0
          flex items-center justify-center
          z-10
          pointer-events-none
        "
      >
        <video
          src={video2}
          autoPlay
          // muted
          loop
          playsInline
          className="
            rounded-2xl
            w-full h-full
            object-contain
            max-w-[97vw]
            max-h-[97vh]
            will-change-transform
          "
        />
      </div>

      {/* Status Indicator
      {!showError && (
        <div className="absolute bottom-10 left-0 right-0 flex justify-center z-20">
          <div className="bg-black bg-opacity-75 px-6 py-3 rounded-lg">
            <p className={`text-lg font-medium ${
              phase === "ERROR" ? "text-red-500" :
              isVerify ? "text-green-500" : "text-white"
            }`}>
              {status}
            </p>
          </div>
        </div>
      )} */}

      {/* Error Alert Component */}
      <ErrorAlert
        title={
          status.includes("not registered")
            ? "face Not Registered"
            : "Face Not Recognized"
        }
        description={
          status.includes("not registered")
            ? "User is not registered in the system.\nRedirecting to manual login..."
            : attemptCount < MAX_ATTEMPTS
              ? `No face detected OR Multiple faces detected.\nRetrying......`
              : "Maximum attempts reached\nReturning to login screen..."
        }
        visible={showError}
        onClose={handleErrorClose}
        onRetry={handleRetry}
        autoRetryDelay={status.includes("not registered") ? 3000 : (attemptCount < MAX_ATTEMPTS ? 4000 : 3000)}
      />
    </div>
  );
};

export default VideoCaptureScreen;