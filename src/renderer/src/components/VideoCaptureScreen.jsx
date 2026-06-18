import React, { useEffect, useState } from "react"
import video2 from "../assets/avatar2.mp4"
import { useNavigate } from "react-router"
import { realtimeCapture, sendVideoToBackend } from "../utils/api"
import { measureWeightAndHeight } from "../utils/measurementUtils"
import { storeFptMeasurements } from "../utils/measurementRedux"
import { useDispatch } from "react-redux"
import { setUser, setScreening, setCandidates } from "../features/common/commonSlice"
import { trackStage } from "../utils/config"
import FullscreenError from "./FullScreenError"
import { getAudioForCurrentLanguage } from "../utils/audioUtils"
import { useTranslation } from "react-i18next"

// ─────────────────────────────────────────────────────────────────────────────
// DEV FLAGS — flip these to test without hardware or real API
// ─────────────────────────────────────────────────────────────────────────────
const USE_DUMMY_FPT = true
const USE_DUMMY_MEASUREMENTS = true

// Face-recognition scenario to simulate (USE_DUMMY_FPT = true)
// Options: "NO_FACE" | "LOW_CONFIDENCE" | "AVERAGE_SINGLE" | "HIGH_MULTIPLE" | "VERY_HIGH_SINGLE"
const DUMMY_FPT_SCENARIO = "HIGH_MULTIPLE"

// Measurement scenario to simulate (USE_DUMMY_MEASUREMENTS = true)
// Only matters when DUMMY_FPT_SCENARIO = "NO_FACE"
// Options: "WEIGHT_AND_SHORT" | "WEIGHT_AND_TALL" | "WEIGHT_NO_HEIGHT" | "NOTHING"
const DUMMY_MEASUREMENT_SCENARIO = "WEIGHT_AND_TALL"

// ─────────────────────────────────────────────────────────────────────────────
// Dummy FPT responses — real API shape: everything under .data
// ─────────────────────────────────────────────────────────────────────────────
const DUMMY_FPT_RESPONSES = {
  NO_FACE: {
    success: true,
    message: "No face detected",
    data: {
      face_detected: false,
      confidence_band: null,
      matched_student: null,
      candidates: [],
      score: null,
      multiple_matches: false,
    },
  },
  LOW_CONFIDENCE: {
    success: true,
    message: "Low confidence",
    data: {
      face_detected: true,
      confidence_band: "LOW",
      matched_student: null,
      candidates: [],
      score: 0.28,
      multiple_matches: false,
    },
  },
  AVERAGE_SINGLE: {
    success: true,
    message: "Student recognized",
    data: {
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
        suhi_id: "SUHI_TEST01",
        class_section: "8-A",
      },
      candidates: [],
      screening: null,
    },
  },
  HIGH_MULTIPLE: {
    success: true,
    message: "Student recognized",
    data: {
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
        suhi_id: "SUHI_TEST02",
        class_section: "8-A",
      },
      candidates: [
        { user_id: "uuid-1", name: "Ravi Kumar", score: 0.74, grade: "8A", school: "DPS Noida" },
        { user_id: "uuid-2", name: "Ravi Kumar", score: 0.71, grade: "7B", school: "DPS Noida" },
      ],
      screening: null,
    },
  },
  VERY_HIGH_SINGLE: {
    success: true,
    message: "Student recognized",
    data: {
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
        suhi_id: "SUHI_TEST03",
        class_section: "9-C",
      },
      candidates: [],
      screening: null,
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Dummy measurement scenarios — simulates hardware output
// weight: kg (null = not standing on scale)
// height: cm (null = not detected by sensor)
// ─────────────────────────────────────────────────────────────────────────────
const DUMMY_MEASUREMENTS = {
  // Case 1: weight & height <= 120 → "not eligible" → SUHI ID after 5s
  WEIGHT_AND_SHORT: { weight: 25, height: 110, errors: {} },

  // Case 2: weight & height >= 120 → "clean camera" → re-attempt x2 → SUHI ID
  WEIGHT_AND_TALL: { weight: 55, height: 155, errors: {} },

  // Case 3: weight & !height → "stand properly" → re-attempt x2 → home
  WEIGHT_NO_HEIGHT: { weight: 55, height: null, errors: { height: "Height sensor timeout" } },

  // Case 4: !weight & !height → "step onto kiosk" → home after 5s
  NOTHING: { weight: null, height: null, errors: { weight: "No weight", height: "No height" } },
}

// ─────────────────────────────────────────────────────────────────────────────
// Error config for each face-not-detected measurement case
// ─────────────────────────────────────────────────────────────────────────────

const getMeasurements = async () => {
  const MEASUREMENT_TIMEOUT = 8000

  if (USE_DUMMY_MEASUREMENTS) {
    return DUMMY_MEASUREMENTS[DUMMY_MEASUREMENT_SCENARIO]
  }

  try {
    const ports = await window.api?.getPorts?.()

    if (!ports || ports.length < 1) {
      return null
    }

    return await measureWeightAndHeight(
      ports,
      MEASUREMENT_TIMEOUT
    )
  } catch (err) {
    console.error("Measurement error:", err)
    return null
  }
}
const getFaceNotDetectedError = (measurements) => {
  const hasWeight = !!measurements?.weight
  const hasHeight = !!measurements?.height
  const heightVal = measurements?.height ?? 0

  // weight & height present but height <= 120 → child / not eligible
  if (hasWeight && hasHeight && heightVal <= 120) {
    return {
      key: "not_eligible",
      title: "Not eligible for kiosk",
      description: "You are not eligible for the kiosk. Please try with your SUHI ID.",
      redirectTo: "/login-suhi",
      redirectLabel: "Going to SUHI ID login",
      autoRedirectDelay: 5000,
      maxAttempts: 1,
    }
  }

  // weight & height present, height >= 120 → face alignment issue
  if (hasWeight && hasHeight && heightVal >= 120) {
    return {
      key: "align_face",
      title: "Align your face",
      description: "Make sure the camera is clean and align your face properly.",
      redirectTo: "/login-suhi",
      redirectLabel: "Going to SUHI ID login",
      autoRedirectDelay: 5000,
      maxAttempts: 3,
    }
  }

  // weight detected but no height → not standing straight / facing camera
  if (hasWeight && !hasHeight) {
    return {
      key: "stand_properly",
      title: "Stand properly",
      description: "Make sure you are standing properly and facing the camera.",
      redirectTo: "/welcome",
      redirectLabel: "Going to home",
      autoRedirectDelay: 5000,
      maxAttempts: 3,
    }
  }

  // nothing detected → not on kiosk at all
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

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const VideoCaptureScreen = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const [status, setStatus] = useState("Initializing...")
  const [isVerify, setIsVerify] = useState(false)
  const [fullscreenError, setFullscreenError] = useState(null)
  const [shouldRetry, setShouldRetry] = useState(false)

  const attemptCountRef = React.useRef(0)
  const audioRef = React.useRef(null)
  const measurementStartedRef = React.useRef(false)
  const measurementPromiseRef = React.useRef(null)
  const trackingDoneRef = React.useRef(false)

  const [isAudioPlaying, setIsAudioPlaying] = useState(false)

  const STAGES = { FACE_SCAN: "FACE_SCAN" }
  const STATUS_KEYS = { SUCCESS: "SUCCESS", ERROR: "ERROR" }

  // ─── Decision tree ───────────────────────────────────────────────────────
  const handleFptDecision = (fptResponse, measurements) => {
    // Real API wraps everything in .data — extract it
    const data = fptResponse?.data ?? {}
    const {
      face_detected,
      confidence_band,
      matched_student,
      multiple_matches,
      candidates,
      screening,
    } = data

    // ── Branch A: Face NOT detected ────────────────────────────────────────
    if (!face_detected) {
      const errorConfig = getFaceNotDetectedError(measurements)
      const hasRetries = errorConfig.maxAttempts > 1
      const retriesLeft = attemptCountRef.current < errorConfig.maxAttempts - 1
      console.log("Face not detected")
      trackStage(STAGES.FACE_SCAN, STATUS_KEYS.ERROR, {
        weight_kg: measurements?.weight,
        height_cm: measurements?.height,
      }, "Face not detected")

      if (hasRetries && retriesLeft) {
        attemptCountRef.current += 1

        setFullscreenError({
          ...errorConfig,
          showRetry: true,
          showDescription: false,
          onRetry: () => {
            measurementStartedRef.current = false
            measurementPromiseRef.current = null
            trackingDoneRef.current = false

            setFullscreenError(null)
            setShouldRetry((prev) => !prev)
          },
        })

        return true
      } else {
        // Out of retries or single-attempt case — show full description now
        setFullscreenError({ ...errorConfig, showRetry: false, showDescription: true })
      }

      return true
    }

    // ── Branch B: LOW confidence or no matched student ─────────────────────
    if (confidence_band === "LOW" || !matched_student) {
      trackStage(STAGES.FACE_SCAN, STATUS_KEYS.ERROR, {
        weight_kg: measurements?.weight,
        height_cm: measurements?.height,
      }, `Low confidence or no match: ${confidence_band}`)
      navigate("/login-suhi")
      return true
    }

    // ── Branch C: Good confidence, single match ────────────────────────────
    if (HIGH_CONFIDENCE_BANDS.includes(confidence_band) && !multiple_matches) {
      dispatch(setUser({ success: true, data: matched_student }))
      dispatch(setScreening(screening ?? null))

      trackStage(STAGES.FACE_SCAN, STATUS_KEYS.SUCCESS, {
        weight_kg: measurements?.weight,
        height_cm: measurements?.height,
      }, null, null, matched_student?.user_id)

      setIsVerify(true)
      navigate("/verified")
      return true
    }

    // ── Branch D: Good confidence, multiple matches ────────────────────────
    if (HIGH_CONFIDENCE_BANDS.includes(confidence_band) && multiple_matches) {
      dispatch(setCandidates(candidates ?? []))
      // Also store the top matched_student and screening for later
      dispatch(setUser({ success: true, data: matched_student }))
      dispatch(setScreening(screening ?? null))

      trackStage(STAGES.FACE_SCAN, STATUS_KEYS.SUCCESS, {
        weight_kg: measurements?.weight,
        height_cm: measurements?.height,
      }, null, null, null)

      navigate("/identify-student")
      return true
    }

    return false // unhandled — caller will fallback
  }

  // ─── Main effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      try {
        setStatus("Preparing...")
        await playAudio()
        await new Promise((r) => setTimeout(r, 1000))

        //const MEASUREMENT_TIMEOUT = 5000

        // Start measurements in background (non-blocking)
        measurementPromiseRef.current = getMeasurements()

        setStatus("Processing scan and measurements...")

        let fptResponse
        let measurements

        if (USE_DUMMY_FPT) {
          console.log(`[VIDEO CAPTURE] FPT scenario: ${DUMMY_FPT_SCENARIO}`)
          fptResponse = DUMMY_FPT_RESPONSES[DUMMY_FPT_SCENARIO]
          measurements = await measurementPromiseRef.current
        } else {
          [fptResponse, measurements] = await Promise.all([
            realtimeCapture(),
            measurementPromiseRef.current,
          ])
        }

        console.log("[VIDEO CAPTURE] fptResponse:", fptResponse)
        console.log("[VIDEO CAPTURE] measurements:", measurements)

        // Store measurements
        if (measurements && !trackingDoneRef.current) {
          trackingDoneRef.current = true
          if (measurements.weight || measurements.height) {
            storeFptMeasurements(dispatch, measurements.weight, measurements.height)
          }
        }

        const handled = handleFptDecision(fptResponse, measurements)
        if (!handled) {
          console.warn("[VIDEO CAPTURE] Unhandled fptResponse, falling back to login-suhi")
          navigate("/login-suhi")
        }

        stopAudio()
      } catch (error) {
        console.error("[VIDEO CAPTURE] Error:", error)
        setStatus(`Error: ${error.message}`)
        stopAudio()
      }
    }

    run()
  }, [navigate, shouldRetry])

  // ─── Audio ───────────────────────────────────────────────────────────────
  const playAudio = async () => {
    const audioPath = await getAudioForCurrentLanguage("camera_scan")
    if (audioPath && audioRef.current) {
      audioRef.current.src = audioPath
      setIsAudioPlaying(true)
      audioRef.current.play().catch(() => setIsAudioPlaying(false))
    }
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsAudioPlaying(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      <audio ref={audioRef} onEnded={() => setIsAudioPlaying(false)} onPlay={() => setIsAudioPlaying(true)}>
        Your browser does not support the audio element.
      </audio>

      {/* Avatar video */}
      <div className="border-0 rounded-2xl absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <video
          src={video2}
          autoPlay muted loop playsInline
          className="rounded-2xl w-full h-full object-contain max-w-[97vw] max-h-[97vh] will-change-transform"
        />
      </div>

      {/* Fullscreen error — face not detected cases */}
      {fullscreenError && (
        <FullscreenError
          title={fullscreenError.title}
          description={fullscreenError.description}
          showDescription={fullscreenError.showDescription ?? true}
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