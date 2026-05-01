import React, { useEffect, useState } from "react"
import video2 from "../assets/avatar2.mp4"
import { data, useNavigate } from "react-router"
import { recordFromOpenCameras } from "../utils/recordSession"
import { getVideoDuration, getKioskId, getSessionId } from "../utils/config"
import { realtimeCapture, runFPT, sendVideoToBackend } from "../utils/api"
import { measureWeightAndHeight } from "../utils/measurementUtils"
import { storeFptMeasurements } from "../utils/measurementRedux"
import { useDispatch, useSelector } from "react-redux"
import { setUser } from "../features/common/commonSlice"
import { BIAMeasurementStage } from "../utils/api"
import { trackStage } from "../utils/config"
import ErrorAlert from "./ErrorAlert"
import { getAudioForCurrentLanguage } from "../utils/audioUtils"
const USE_DUMMY_FPT = false
const VideoCaptureScreen = () => {
  const navigate = useNavigate()
  const [isVerify, setIsVerify] = useState(false)
  const [phase, setPhase] = useState("")
  const [status, setStatus] = useState("Initializing...")
  const [showError, setShowError] = useState(false)
  const [attemptCount, setAttemptCount] = useState(0)
  const attemptCountRef = React.useRef(0)
  const [shouldRetry, setShouldRetry] = useState(false)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const dispatch = useDispatch()
  const audioRef = React.useRef(null)
  const measurementStartedRef = React.useRef(false)
  const measurementPromiseRef = React.useRef(null)
  const trackingDoneRef = React.useRef(false)
  const hasStartedRef = React.useRef(false)
  const STAGES = {
    FACE_SCAN: "FACE_SCAN"
  }

  const STATUS = {
    SUCCESS: "SUCCESS",
    ERROR: "ERROR"
  }

  const dummyFptSuccessResponse = {
    success: true,
    student_status: "REGISTERED",
    buffer_id: "dummy_buffer_id_123",
    user_id: "e6688f32-f9de-48fb-bfc9-e8815109d518",
    name: "Priyanshu"
  }
  const MAX_ATTEMPTS = 2

  useEffect(() => {
    //   if (hasStartedRef.current) return;
    // hasStartedRef.current = true;
    const run = async () => {
      try {
        setStatus("Preparing...")
        await playAudio()
        await new Promise((r) => setTimeout(r, 1000))

        const videoDuration = getVideoDuration()
        const kioskId = getKioskId()
        const sessionId = getSessionId()

        setStatus(`Recording for ${videoDuration / 1000} seconds...`)

        // Start measurements in background (non-blocking)
        // Use 20-second timeout to prevent infinite waiting if user not on sensors
        const MEASUREMENT_TIMEOUT = 8000 // 0 seconds

        if (!measurementStartedRef.current) {
          measurementStartedRef.current = true

          measurementPromiseRef.current = (async () => {
            try {
              const ports = await window.api?.getPorts?.()
              if (!ports || ports.length < 1) return null

              return await measureWeightAndHeight(ports, MEASUREMENT_TIMEOUT)
            } catch (err) {
              console.error("Measurement error:", err)
              return null
            }
          })()
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

        setStatus("Processing scan and measurements...")

        console.log("Running realtime capture + measurements in parallel")

        let fptResponse
        let measurements

        if (USE_DUMMY_FPT) {
          console.log("Using dummy FPT response...")
          fptResponse = dummyFptSuccessResponse
          // Still wait for measurements if they're running
          measurements = await measurementPromiseRef.current
        } else {
          // Await both face capture and weight/height measurements in parallel
          ;[fptResponse, measurements] = await Promise.all([
            realtimeCapture(),
            measurementPromiseRef.current
          ])
        }

        console.log("FPT response:", fptResponse)
        console.log("Measurement results:", measurements)

        // -- Handle Measurements First (so they are available for tracking/display) --
        if (measurements && !trackingDoneRef.current) {
          trackingDoneRef.current = true
          console.log("[VIDEO CAPTURE] Storing measurements:", measurements)

          // Store measurements even if some failed
          if (measurements.weight || measurements.height) {
            storeFptMeasurements(dispatch, measurements.weight, measurements.height)
            console.log("[VIDEO CAPTURE] Measurements saved!")
          }

          // Handle measurement errors for tracking
          if (measurements.errors && Object.keys(measurements.errors).length > 0) {
            let errorMessage = ""
            const hasWeightError = !!measurements.errors.weight
            const hasHeightError = !!measurements.errors.height

            if (hasWeightError && hasHeightError) {
              errorMessage = "Failed to get weight and height measurement"
            } else if (hasWeightError) {
              errorMessage = "Failed to get weight measurement"
            } else if (hasHeightError) {
              errorMessage = "Failed to get height measurement"
            } else {
              errorMessage = "User is not standing on the platform"
            }
            console.warn("[VIDEO CAPTURE] Measurement warning:", errorMessage)

            // Note: We'll track the error stage ONLY if FPT also fails or after we know FPT status
          }
        }

        // -- Handle Face Recognition Result --
        const isFailed = !fptResponse.success || fptResponse.data?.student_status !== "REGISTERED"

        // Check if user is not registered - redirect directly to login
        if (fptResponse.success && fptResponse.data?.student_status === "NOT_REGISTERED") {
          setShowError(true)
          setPhase("ERROR")
          setStatus("User not registered. Redirecting to login...")
          throw new Error("User not registered")
        }

        if (isFailed) {
          attemptCountRef.current += 1
          setAttemptCount(attemptCountRef.current)
          setShowError(true)
          setPhase("ERROR")
          if (attemptCountRef.current < MAX_ATTEMPTS) {
            setStatus("Face not recognized. Retrying...")
          } else {
            setStatus("Face not recognized. Maximum attempts reached.")
          }

          // Track failure with measurements if available
          trackStage(
            STAGES.FACE_SCAN,
            STATUS.ERROR,
            {
              weight_kg: measurements?.weight,
              height_cm: measurements?.height
            },
            fptResponse.error || "Face not recognized",
            fptResponse?.data?.buffer_id,
            fptResponse?.data?.user_id
          )

          throw new Error(fptResponse.error || "Face not recognized")
        }

        // Success case - Face recognition successful
        dispatch(setUser(fptResponse))
        setStatus("Verification successful!")
        setIsVerify(true)
        stopAudio()

        // Track success to backend
        trackStage(
          STAGES.FACE_SCAN,
          STATUS.SUCCESS,
          {
            weight_kg: measurements?.weight,
            height_cm: measurements?.height
          },
          null,
          fptResponse?.data?.buffer_id,
          fptResponse?.data?.user_id
        )

        await new Promise((r) => setTimeout(r, 500))
        navigate("/verified")
      } catch (error) {
        console.error("Error in video capture flow:", error)
        setPhase("ERROR")

        // Only set status if it's not already set
        if (!status.includes("Face not recognized")) {
          setStatus(`Error: ${error.message}`)
          setShowError(true)
        }
        stopAudio()
      }
    }

    run()
  }, [navigate, shouldRetry])

  const handleErrorClose = () => {
    setShowError(false)
  }

  const handleRetry = () => {
    setShowError(false)
    // Redirect to login if user is not registered or max attempts reached
    if (status.includes("not registered") || attemptCountRef.current >= MAX_ATTEMPTS) {
      navigate("/login-suhi")
    } else {
      // Retry in-place by toggling shouldRetry
      setShouldRetry((prev) => !prev)
    }
  }
  const playAudio = async () => {
    const audioPath = await getAudioForCurrentLanguage("camera_scan")
    if (audioPath && audioRef.current) {
      audioRef.current.src = audioPath
      setIsAudioPlaying(true)
      audioRef.current.play().catch((err) => {
        console.log("Audio playback failed:", err)
        setIsAudioPlaying(false)
      })
      return true
    } else if (!audioPath) {
      console.log("No audio for camera_scan in current language")
      return false
    }
    return false
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsAudioPlaying(false)
    }
  }

  const handleAudioEnd = () => {
    setIsAudioPlaying(false)
  }

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
      <audio ref={audioRef} onEnded={handleAudioEnd} onPlay={() => setIsAudioPlaying(true)}>
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
      <div
        className="
        // w-full h-full
    absolute 
    flex flex-col items-center
    z-20
    bg-black/10
    pointer-events-none

  "
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 357 357"
          className="w-[18%] max-w-[300px] opacity-65"
        >
          <path
            d="M82.3233 342.979C82.3233 346.618 83.7687 350.107 86.3415 352.68C88.9142 355.253 92.4036 356.698 96.0421 356.698H260.667C264.306 356.698 267.795 355.253 270.368 352.68C272.94 350.107 274.386 346.618 274.386 342.979C274.386 339.341 272.94 335.852 270.368 333.279C267.795 330.706 264.306 329.261 260.667 329.261H96.0421C92.4036 329.261 88.9142 330.706 86.3415 333.279C83.7687 335.852 82.3233 339.341 82.3233 342.979ZM355.652 183.602C354.614 186.109 352.857 188.252 350.601 189.76C348.345 191.268 345.693 192.073 342.98 192.073H274.386V233.229C274.386 236.868 272.94 240.357 270.368 242.93C267.795 245.503 264.306 246.948 260.667 246.948H96.0421C92.4036 246.948 88.9142 245.503 86.3415 242.93C83.7687 240.357 82.3233 236.868 82.3233 233.229V192.073H13.7296C11.0147 192.075 8.3602 191.272 6.10217 189.765C3.84415 188.257 2.08412 186.114 1.04489 183.606C0.0056589 181.098 -0.266036 178.338 0.264199 175.675C0.794435 173.013 2.10276 170.567 4.02354 168.648L168.649 4.02347C169.923 2.74796 171.436 1.73605 173.101 1.04568C174.767 0.355286 176.552 -3.05176e-05 178.355 -3.05176e-05C180.157 -3.05176e-05 181.943 0.355286 183.608 1.04568C185.273 1.73605 186.786 2.74796 188.061 4.02347L352.686 168.648C354.604 170.568 355.909 173.013 356.437 175.675C356.965 178.337 356.692 181.095 355.652 183.602ZM96.0421 274.386H260.667C264.306 274.386 267.795 275.831 270.368 278.404C272.94 280.977 274.386 284.466 274.386 288.104C274.386 291.743 272.94 295.232 270.368 297.805C267.795 300.378 264.306 301.823 260.667 301.823H96.0421C92.4036 301.823 88.9142 300.378 86.3415 297.805C83.7687 295.232 82.3233 291.743 82.3233 288.104C82.3233 284.466 83.7687 280.977 86.3415 278.404C88.9142 275.831 92.4036 274.386 96.0421 274.386Z"
            fill="white"
          />
        </svg>
        <h1 className="text-white text-2xl mt-3 font-semibold opacity-75">
          Look at the top Camera
        </h1>
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
        title={status.includes("not registered") ? "face Not Registered" : "Face Not Recognized"}
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
        autoRetryDelay={
          status.includes("not registered") ? 3000 : attemptCount < MAX_ATTEMPTS ? 4000 : 3000
        }
      />
    </div>
  )
}

export default VideoCaptureScreen
