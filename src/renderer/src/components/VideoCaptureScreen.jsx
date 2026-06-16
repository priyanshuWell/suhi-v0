import React, { useEffect, useState } from "react"
import video2 from "../assets/avatar2.mp4"
import { useNavigate } from "react-router"
import { recordFromOpenCameras } from "../utils/recordSession"
import { getVideoDuration, getKioskId, getSessionId } from "../utils/config"
import { realtimeCapture, runFPT, sendVideoToBackend } from "../utils/api"
import { measureWeightAndHeight } from "../utils/measurementUtils"
import { storeFptMeasurements } from "../utils/measurementRedux"
import { useDispatch, useSelector } from "react-redux"
import { setUser, setScreening, setCandidates } from "../features/common/commonSlice"
import { BIAMeasurementStage } from "../utils/api"
import { trackStage } from "../utils/config"
import FullscreenError from "./FullScreenError"
import { getAudioForCurrentLanguage } from "../utils/audioUtils"
import { useTranslation } from "react-i18next"

const USE_DUMMY_FPT = true

// ---------------------------------------------------------------------------
// Dummy response bank — swap USE_DUMMY_FPT + DUMMY_SCENARIO to test each path
// ---------------------------------------------------------------------------
const DUMMY_SCENARIO = "LOW_CONFIDENCE" // change this to test different paths

const DUMMY_RESPONSES = {
  NO_FACE: {
    face_detected: false,
    confidence_band: null,
    matched_student: null,
    candidates: [],
    score: null,
    multiple_matches: false,
  },
  LOW_CONFIDENCE: {
    face_detected: true,
    confidence_band: "LOW",
    matched_student: null,
    candidates: [],
    score: 0.28,
    multiple_matches: false,
  },
  AVERAGE_SINGLE: {
    face_detected: true,
    confidence_band: "AVERAGE",
    score: 0.61,
    multiple_matches: false,
    matched_student: {
      user_id: "uuid-single",
      name: "Ravi Kumar",
      photo_url: "",
      grade: "8A",
      school: "DPS Noida",
    },
    candidates: [],
  },
  HIGH_MULTIPLE: {
    face_detected: true,
    confidence_band: "HIGH",
    score: 0.74,
    multiple_matches: true,
    matched_student: {
      user_id: "uuid-1",
      name: "Ravi Kumar",
      photo_url: "",
      grade: "8A",
      school: "DPS Noida",
    },
    candidates: [
      { user_id: "uuid-1", name: "Ravi Kumar", score: 0.74, grade: "8A", school: "DPS Noida" },
      { user_id: "uuid-2", name: "Rahul Kumar", score: 0.71, grade: "8B", school: "DPS Noida" },
    ],
  },
  VERY_HIGH_SINGLE: {
    face_detected: true,
    confidence_band: "VERY_HIGH",
    score: 0.91,
    multiple_matches: false,
    matched_student: {
      user_id: "uuid-vh",
      name: "Priya Sharma",
      photo_url: "",
      grade: "9C",
      school: "DPS Noida",
    },
    candidates: [],
  },
}

// ---------------------------------------------------------------------------
// Face-not-detected error config
// Re-attempt logic: cases with maxAttempts > 1 retry in-place before redirect
// ---------------------------------------------------------------------------
const getFaceNotDetectedError = (measurements) => {
  // const hasWeight = !!measurements?.weight
  // const hasHeight = !!measurements?.height
  // const heightVal = measurements?.height ?? 0

  const hasWeight = !!measurements?.weight
  const hasHeight = !!measurements?.height
  const heightVal = measurements?.height ?? 0

  if (hasWeight && hasHeight && heightVal <= 120) {
    return {
      key: "not_eligible",
      title: "Not eligible for kiosk",
      description: "You are not eligible for the kiosk. Please try with your SUHI ID.",
      redirectTo: "/login-suhi",
      redirectLabel: "Going to SUHI ID login",
      autoRedirectDelay: 5000,
      maxAttempts: 1, // no retry — straight redirect
    }
  }

  if (hasWeight && hasHeight && heightVal >= 120) {
    return {
      key: "align_face",
      title: "Camera issue",
      description: "Make sure the camera is clean and align your face properly.",
      redirectTo: "/login-suhi",
      redirectLabel: "Going to SUHI ID login",
      autoRedirectDelay: 5000,
      maxAttempts: 2, // retry up to 2x before redirect
    }
  }

  if (hasWeight && !hasHeight) {
    return {
      key: "stand_properly",
      title: "Stand properly",
      description: "Make sure you are standing properly and facing the camera.",
      redirectTo: "/welcome",
      redirectLabel: "Going to home",
      autoRedirectDelay: 5000,
      maxAttempts: 2,
    }
  }

  // !weight && !height (or any other unmeasured case)
  return {
    key: "not_on_kiosk",
    title: "Step onto the kiosk",
    description: "Make sure you are standing on the kiosk and facing the camera.",
    redirectTo: "/welcome",
    redirectLabel: "Going to home",
    autoRedirectDelay: 5000,
    maxAttempts: 1,
  }
}

const HIGH_CONFIDENCE_BANDS = ["AVERAGE", "HIGH", "VERY_HIGH"]

const VideoCaptureScreen = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [phase, setPhase] = useState("")
  const [isVerify, setIsVerify] = useState(false)
  const [status, setStatus] = useState("Initializing...")

  // Fullscreen error state
  const [fullscreenError, setFullscreenError] = useState(null) // null | error config object
  const [attemptCount, setAttemptCount] = useState(0)
  const attemptCountRef = React.useRef(0)
  const [shouldRetry, setShouldRetry] = useState(false)

  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const dispatch = useDispatch()
  const audioRef = React.useRef(null)
  const measurementStartedRef = React.useRef(false)
  const measurementPromiseRef = React.useRef(null)
  const trackingDoneRef = React.useRef(false)

  const STAGES = { FACE_SCAN: "FACE_SCAN" }
  const STATUS = { SUCCESS: "SUCCESS", ERROR: "ERROR" }

  // ---------------------------------------------------------------------------
  // Decision tree — called after fptResponse + measurements are both available
  // Returns true if we navigated away (caller should stop), false to continue
  // ---------------------------------------------------------------------------
  const handleFptDecision = (fptResponse, measurements) => {
    const { face_detected, confidence_band, matched_student, multiple_matches, candidates } =
      fptResponse

    // ── Branch A: Face NOT detected ──────────────────────────────────────────
    if (!face_detected) {
      const errorConfig = getFaceNotDetectedError(measurements)

      if (errorConfig.maxAttempts > 1 && attemptCountRef.current < errorConfig.maxAttempts - 1) {
        // Still have retries left — show error, increment count, re-run on dismiss
        attemptCountRef.current += 1
        setAttemptCount(attemptCountRef.current)
        setFullscreenError({
          ...errorConfig,
          // Override: on retry, close error and re-run instead of redirecting
          onRetry: () => {
            setFullscreenError(null)
            setShouldRetry((prev) => !prev)
          },
          showRetry: true,
        })
      } else {
        // No retries left (or single-attempt case) — show error with auto-redirect
        setFullscreenError({
          ...errorConfig,
          showRetry: false,
        })
      }

      trackStage(STAGES.FACE_SCAN, STATUS.ERROR, {
        weight_kg: measurements?.weight,
        height_cm: measurements?.height,
      }, "Face not detected")

      return true // handled
    }

    // ── Branch B: Face detected — LOW confidence or no match ────────────────
    if (!face_detected === false && (confidence_band === "LOW" || !matched_student)) {
      setStatus("Redirecting to SUHI ID login...")
      trackStage(STAGES.FACE_SCAN, STATUS.ERROR, {
        weight_kg: measurements?.weight,
        height_cm: measurements?.height,
      }, `Low confidence or no match: ${confidence_band}`)
      navigate("/login-suhi")
      return true
    }

    // ── Branch C: High confidence — single match ─────────────────────────────
    if (HIGH_CONFIDENCE_BANDS.includes(confidence_band) && !multiple_matches) {
      dispatch(setUser({ success: true, data: matched_student }))
      dispatch(setScreening(null))

      trackStage(STAGES.FACE_SCAN, STATUS.SUCCESS, {
        weight_kg: measurements?.weight,
        height_cm: measurements?.height,
      }, null, null, matched_student?.user_id)

      setIsVerify(true)
      setStatus("Verification successful!")
      navigate("/verified")
      return true
    }

    // ── Branch D: High confidence — multiple matches ─────────────────────────
    if (HIGH_CONFIDENCE_BANDS.includes(confidence_band) && multiple_matches) {
      dispatch(setCandidates(candidates))

      trackStage(STAGES.FACE_SCAN, STATUS.SUCCESS, {
        weight_kg: measurements?.weight,
        height_cm: measurements?.height,
      }, null, null, null)

      setStatus("Multiple matches found. Identifying...")
      navigate("/identify-student")
      return true
    }

    // Fallback — shouldn't reach here with well-formed responses
    return false
  }

  // ---------------------------------------------------------------------------
  // Main run effect
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const run = async () => {
      try {
        setStatus("Preparing...")
        await playAudio()
        await new Promise((r) => setTimeout(r, 1000))

        const videoDuration = getVideoDuration()
        const MEASUREMENT_TIMEOUT = 8000

        // Start measurements in background (non-blocking)
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

        setStatus("Processing scan and measurements...")

        let fptResponse
        let measurements

        if (USE_DUMMY_FPT) {
          console.log(`[VIDEO CAPTURE] Using dummy scenario: ${DUMMY_SCENARIO}`)
          fptResponse = DUMMY_RESPONSES[DUMMY_SCENARIO]
          measurements = await measurementPromiseRef.current
        } else {
          ;[fptResponse, measurements] = await Promise.all([
            realtimeCapture(),
            measurementPromiseRef.current,
          ])
        }

        console.log("[VIDEO CAPTURE] fptResponse:", fptResponse)
        console.log("[VIDEO CAPTURE] measurements:", measurements)

        // Store measurements if available
        if (measurements && !trackingDoneRef.current) {
          trackingDoneRef.current = true
          if (measurements.weight || measurements.height) {
            storeFptMeasurements(dispatch, measurements.weight, measurements.height)
          }
        }

        // ── Run the decision tree ────────────────────────────────────────────
        const handled = handleFptDecision(fptResponse, measurements)
        if (!handled) {
          // Unexpected response shape — fall back to login
          console.warn("[VIDEO CAPTURE] Unhandled fptResponse shape:", fptResponse)
          navigate("/login-suhi")
        }

        stopAudio()
      } catch (error) {
        console.error("[VIDEO CAPTURE] Error in run():", error)
        setPhase("ERROR")
        setStatus(`Error: ${error.message}`)
        stopAudio()
      }
    }

    run()
  }, [navigate, shouldRetry])

  // ---------------------------------------------------------------------------
  // Audio helpers
  // ---------------------------------------------------------------------------
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

  const handleAudioEnd = () => setIsAudioPlaying(false)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      {/* Audio */}
      <audio ref={audioRef} onEnded={handleAudioEnd} onPlay={() => setIsAudioPlaying(true)}>
        Your browser does not support the audio element.
      </audio>

      {/* Avatar video */}
      <div className="border-0 rounded-2xl absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <video
          src={video2}
          autoPlay
          muted
          loop
          playsInline
          className="rounded-2xl w-full h-full object-contain max-w-[97vw] max-h-[97vh] will-change-transform"
        />
      </div>

      {/* Fullscreen error overlay — face not detected cases */}
      {fullscreenError && (
        <FullscreenError
          title={fullscreenError.title}
          description={fullscreenError.description}
          redirectTo={fullscreenError.redirectTo}
          redirectLabel={fullscreenError.redirectLabel}
          autoRedirectDelay={fullscreenError.autoRedirectDelay}
          showRetry={fullscreenError.showRetry}
          onRetry={fullscreenError.onRetry}
          onRedirect={() => {
            setFullscreenError(null)
            navigate(fullscreenError.redirectTo)
          }}
        />
      )}
    </div>
  )
}

export default VideoCaptureScreen