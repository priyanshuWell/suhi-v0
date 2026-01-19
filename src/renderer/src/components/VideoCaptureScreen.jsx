// import React, { useEffect, useState } from "react";
// import bg from "../assets/background.png";
// import video2 from "../assets/avatar2.mp4";
// import { useNavigate } from "react-router";
// import { recordFromOpenCameras } from "../utils/recordSession";
// // import { sendVideoToBackend, runFPT } from "../utils/api";
// import { getVideoDuration, getKioskId } from "../utils/config";
// import { runFPT, sendVideoToBackend } from "../utils/api";
// import { useDispatch } from "react-redux";
// import { setUser } from "../features/common/commonSlice";

// const VideoCaptureScreen = () => {
//   const navigate = useNavigate();
//   const [isVerify, setIsVerify] = useState(false);
//   const [phase, setPhase] = useState('');
//   const [status, setStatus] = useState('Initializing...');
//   const dispatch=useDispatch();


// useEffect(() => {
//   const run = async () => {
//     try {
//       setStatus("Preparing...");
//       await new Promise((r) => setTimeout(r, 1000));

//       const videoDuration = getVideoDuration();
//       const kioskId = getKioskId();

//       setStatus(`Recording for ${videoDuration / 1000} seconds...`);

//       const recordings = await recordFromOpenCameras(videoDuration);
//       console.log("recordings", recordings);

//       if (!recordings || recordings.length === 0) {
//         throw new Error("No recordings captured");
//       }

//       setStatus("Uploading video...");

//       const videoToSend =
//         recordings.find((r) => r.role === "CENTER") || recordings[0];

//       console.log(`Sending ${videoToSend.role} video to backend...`);

//       const storeResponse = await sendVideoToBackend(videoToSend);
//       console.log("Store response:", storeResponse);

//       const shmPath = storeResponse?.data?.shm_path;

//       if (!storeResponse?.success || !shmPath) {
//         throw new Error("Failed to store video or shm_path not received");
//       }

//       setStatus("Processing face verification...");

//       console.log("Running FPT with shm_path:", shmPath);
//       const fptResponse = await runFPT(shmPath, kioskId);
//       console.log("FPT response:", fptResponse);
//        dispatch(setUser(fptResponse));

//       if (fptResponse.success) {
//         setStatus("Verification successful!");
//         setIsVerify(true);
//         await new Promise((r) => setTimeout(r, 1000));
//         navigate("/verified");
//       } else {
//         throw new Error(fptResponse.error || "FPT verification failed");
//       }
//     } catch (error) {
//       console.error("Error in video capture flow:", error);
//       setPhase("ERROR");
//       setStatus(`Error: ${error.message}`);
//     }
//   };

//   run();
// }, [navigate]);



//   return (
//     <div
//       className="
//         fixed inset-0
//         w-screen h-screen
//         overflow-hidden
//         bg-black
//       "
//     >
//       {/* Avatar Video */}
//       <div
//         className="
//           border-0
//           rounded-2xl
//           absolute inset-0
//           flex items-center justify-center
//           z-10
//           pointer-events-none
//         "
//       >
//         <video
//           src={video2}
//           autoPlay
//           loop
//           playsInline
//           className="
//             rounded-2xl
//             w-full h-full
//             object-contain
//             max-w-[97vw]
//             max-h-[97vh]
//             will-change-transform
//           "
//         />
//       </div>
      
//       {/* Status Indicator */}
//       <div className="absolute bottom-10 left-0 right-0 flex justify-center z-20">
//         <div className="bg-black bg-opacity-75 px-6 py-3 rounded-lg">
//           <p className={`text-lg font-medium ${
//             phase === "ERROR" ? "text-red-500" : 
//             isVerify ? "text-green-500" : "text-white"
//           }`}>
//             {status}
//           </p>
//         </div>
//       </div>

//       {/* Error Overlay */}
//       {phase === "ERROR" && (
//         <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-30">
//           <div className="bg-red-900 bg-opacity-50 p-8 rounded-lg max-w-md">
//             <p className="text-red-200 text-xl text-center mb-4">
//               Verification Error
//             </p>
//             <p className="text-red-100 text-center">
//               {status}
//             </p>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default VideoCaptureScreen;



































import React, { useEffect, useState } from "react";
import bg from "../assets/background.png";
import video2 from "../assets/avatar2.mp4";
import { useNavigate } from "react-router";
import { recordFromOpenCameras } from "../utils/recordSession";
import { getVideoDuration, getKioskId } from "../utils/config";
import { runFPT, sendVideoToBackend } from "../utils/api";
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
  useEffect(() => {
    const run = async () => {
      try {
        setStatus("Preparing...");
        playAudio();
      await new Promise((r) => setTimeout(r, 1000));

        const videoDuration = getVideoDuration();
        const kioskId = getKioskId();

        setStatus(`Recording for ${videoDuration / 1000} seconds...`);

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
//         const fptResponse = await
// (shmPath, kioskId);
        console.log("FPT response:", fptResponse);

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

        // Success case
        dispatch(setUser(fptResponse));
        setStatus("Verification successful!");
        setIsVerify(true);
        stopAudio();
        await new Promise((r) => setTimeout(r, 1000));
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
    if (attemptCount < MAX_ATTEMPTS) {
      // Retry the verification
      setPhase('');
      setStatus('Retrying...');
      setShouldRetry(!shouldRetry); // Toggle to trigger useEffect
    } else {
      // Redirect to welcome page after final attempt
      setTimeout(() => {
        navigate("/welcome");
      }, 1000);
    }
  };  const playAudio = () => {
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
        title="Face Not Recognized"
        description={
          attemptCount < MAX_ATTEMPTS
            ?

            `No face detected OR Multiple faces detected.\nRetrying......`
            : "Maximum attempts reached\nReturning to welcome screen..."
        }
        visible={showError}
        onClose={handleErrorClose}
        onRetry={handleRetry}
        autoRetryDelay={attemptCount < MAX_ATTEMPTS ? 4000 : 3000}
      />
    </div>
  );
};

export default VideoCaptureScreen;