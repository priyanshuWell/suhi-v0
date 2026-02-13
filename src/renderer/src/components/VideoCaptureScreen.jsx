import React, { useEffect, useState } from "react";
import video2 from "../assets/avatar2.mp4";
import { useNavigate } from "react-router";
import { recordFromOpenCameras } from "../utils/recordSession";
import { getVideoDuration, getKioskId } from "../utils/config";
import { runFPT, sendVideoToBackend } from "../utils/api";
import { measureWeightAndHeight } from "../utils/measurementUtils";
import { storeFptMeasurements } from "../utils/measurementRedux";
import { useDispatch } from "react-redux";
import { setUser } from "../features/common/commonSlice";
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

  const MAX_ATTEMPTS = 2;
  const instructionAudio = "/src/assets/audio/camera_scan.mp3";

  // Store measurements taken during recording
  const measurementsRef = React.useRef(null);

  useEffect(() => {
    const run = async () => {
      try {
        setStatus("Preparing...");
        playAudio();
        await new Promise((r) => setTimeout(r, 1000));

        const videoDuration = getVideoDuration();
        const kioskId = getKioskId();

        setStatus(`Recording for ${videoDuration / 1000} seconds...`);

        // Start measurements in parallel with video recording
        const measurementPromise = (async () => {
          try {
            console.log('[VIDEO CAPTURE] Starting measurements during recording...');
            const ports = await window.api?.getPorts?.();

            if (!ports || ports.length < 1) {
              console.warn('[VIDEO CAPTURE] No ports available for measurements');
              return null;
            }

            const measurements = await measureWeightAndHeight(ports[0]?.path);
            console.log('[VIDEO CAPTURE] Measurements completed:', measurements);
            return measurements;
          } catch (error) {
            console.error('[VIDEO CAPTURE] Measurement error during recording:', error);
            return null;
          }
        })();

        // Record video
        const recordings = await recordFromOpenCameras(videoDuration);

        // Wait for measurements to complete (if still running)
        const measurements = await measurementPromise;
        measurementsRef.current = measurements;
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
        dispatch(setUser(fptResponse));
        setStatus("Verification successful!");
        setIsVerify(true);
        stopAudio();

        // Store measurements that were taken during recording
        if (measurementsRef.current) {
          console.log('[VIDEO CAPTURE] Storing measurements from recording:', measurementsRef.current);
          storeFptMeasurements(
            dispatch,
            measurementsRef.current.weight,
            measurementsRef.current.height
          );
          setStatus("Measurements saved!");
        } else {
          console.warn('[VIDEO CAPTURE] No measurements available from recording');
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