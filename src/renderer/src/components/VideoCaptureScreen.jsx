import React, { useEffect, useState } from "react";
import video2 from "../assets/avatar2.mp4";
import { useNavigate } from "react-router";
import { recordFromOpenCameras } from "../utils/recordSession";
import { getVideoDuration, getKioskId, getSessionId } from "../utils/config";
import { runFPT, sendVideoToBackend } from "../utils/api";
import { measureWeightAndHeight } from "../utils/measurementUtils";
import { storeFptMeasurements } from "../utils/measurementRedux";
import { useDispatch, useSelector } from "react-redux";
import { setUser } from "../features/common/commonSlice";
import { BIAMeasurementStage } from "../utils/api";
import { trackStage } from "../utils/config";
import ErrorAlert from "./ErrorAlert";

const VideoCaptureScreen = () => {
  const navigate = useNavigate();
  const [isVerify, setIsVerify] = useState(false);
  const [phase, setPhase] = useState('');
  const [status, setStatus] = useState('Initializing...');
  const [showError, setShowError] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [shouldRetry, setShouldRetry] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const dispatch = useDispatch();
  const audioRef = React.useRef(null);
  const measurementStartedRef = React.useRef(false);
 let measurementPromise = null;  const storeUser = useSelector((state) => state.common.user);

  const STAGES = {
    FPT_HEIGHT: "FPT_HEIGHT",
    FPT_WEIGHT: "FPT_WEIGHT",
  };

  const STATUS = {
    SUCCESS: "SUCCESS",
    ERROR: "ERROR",
  };


  const MAX_ATTEMPTS = 2;
  const instructionAudio = "/src/assets/audio/camera_scan.mp3";

  useEffect(() => {
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

          measurementPromise = (async () => {
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
        const recordings = await recordFromOpenCameras(videoDuration);
        console.log("recordings", recordings);

        if (!recordings || recordings.length === 0) {
          throw new Error("No recordings captured");
        }

        setStatus("Uploading video...");

        const videoToSend =
          recordings.find((r) => r.role === "CENTER") || recordings[0];

        console.log(`Sending ${videoToSend.role} video to backend...`);

        const storeResponse = await sendVideoToBackend(videoToSend);
        console.log("Store response:", storeResponse);

        const shmPath = storeResponse?.data?.shm_path;

        if (!storeResponse?.success || !shmPath) {
          throw new Error("Failed to store video or shm_path not received");
        }

        setStatus("Processing face verification...");

        console.log("Running FPT with shm_path:", shmPath);
        const fptResponse = await runFPT(shmPath, kioskId);
        console.log("FPT response:", fptResponse);

        // Check if user is not registered - redirect directly to login
        if (fptResponse?.data?.student_status === 'NOT_REGISTERED') {
          setShowError(true);
          setPhase("ERROR");
          setStatus("User not registered. Redirecting to login...");
          throw new Error("User not registered");
        }

        // Check for specific error codes (502, 503, or general failure)
        const errorStatus = fptResponse?.status || fptResponse?.statusCode;
        const isFaceNotRecognized =
          errorStatus === 502 ||
          errorStatus === 503 ||
          !fptResponse.success;

        if (isFaceNotRecognized) {
          // Increment attempt count
          const newAttemptCount = attemptCount + 1;
          setAttemptCount(newAttemptCount);

          // Show error alert
          setShowError(true);
          setPhase("ERROR");

          // If we haven't exceeded max attempts, prepare for retry
          if (newAttemptCount < MAX_ATTEMPTS) {
            setStatus("Face not recognized. Retrying...");
          } else {
            setStatus("Face not recognized. Redirecting...");
          }

          throw new Error("Face not recognized");
        }

        // Success case - Face recognition successful
        dispatch(setUser({
          ...fptResponse,
          kioskId,
          sessionId,
        }));
        setStatus("Verification successful!");
        setIsVerify(true);
        stopAudio();

        // Wait for measurements to complete in background (non-blocking for FPT)
        // This happens after FPT succeeds, so measurements don't block the flow
        measurementPromise.then((measurements) => {
          if (measurements) {
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
              if (measurements.weight) {
                trackStage(STAGES.FPT_WEIGHT, STATUS.SUCCESS, { weight_kg: measurements.weight }, null, fptResponse?.data?.buffer_id, fptResponse?.data?.user_id);
              }
              if (measurements.height) {
                trackStage(STAGES.FPT_HEIGHT, STATUS.SUCCESS, { height_cm: measurements.height }, null, fptResponse?.data?.buffer_id, fptResponse?.data?.user_id);
              }
            }

            // Log any errors
            if (measurements.errors && Object.keys(measurements.errors).length > 0) {
              console.warn('[VIDEO CAPTURE] Measurement errors:', measurements.errors);
              if (measurements.errors.weight) {
                trackStage(STAGES.FPT_WEIGHT, STATUS.ERROR, {}, measurements.errors.weight, fptResponse?.data?.buffer_id, fptResponse?.data?.user_id);
              }
              if (measurements.errors.height) {
                trackStage(STAGES.FPT_HEIGHT, STATUS.ERROR, {}, measurements.errors.height, fptResponse?.data?.buffer_id, fptResponse?.data?.user_id);
              }
            }
          } else {
            console.warn('[VIDEO CAPTURE] No measurements available');
          }
        }).catch((error) => {
          console.error('[VIDEO CAPTURE] Error storing measurements:', error);
        });

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
    // Check if error is user not registered, redirect to login instead
    if (status.includes("not registered")) {
      navigate("/login-suhi");
    } else {
      // Navigate to FaceCapture screen for the second attempt
      navigate("/facecapture");
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
              : "Maximum attempts reached\nReturning to welcome screen..."
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