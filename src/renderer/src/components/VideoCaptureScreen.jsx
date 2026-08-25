import { useEffect, useState, useRef } from "react"
import video2 from "../assets/avatar2.mp4"
import { useNavigate } from "react-router"
import { realtimeCapture } from "../utils/api"
import { measureWeightAndHeight } from "../utils/measurementUtils"
import { storeFptMeasurements } from "../utils/measurementRedux"
import { useDispatch } from "react-redux"
import { setUser, setLoginScreening, setCandidates } from "../features/common/commonSlice"
import { getKioskId, trackStage } from "../utils/config"
import { useKioskAudio } from "../hooks/useKioskAudio"
import { useTranslation } from "react-i18next"
import NoActivityFrame from "./ui/NoActivityFrame"

// ─────────────────────────────────────────────────────────────────────────────
// DEV FLAGS — flip these to test without hardware or real API
// ─────────────────────────────────────────────────────────────────────────────
const USE_DUMMY_FPT = false
const USE_DUMMY_MEASUREMENTS = false

// Face-recognition scenario to simulate (USE_DUMMY_FPT = true)
// Options: "NO_FACE" | "LOW_CONFIDENCE" | "AVERAGE_SINGLE" | "HIGH_MULTIPLE" | "VERY_HIGH_SINGLE"
const DUMMY_FPT_SCENARIO = "NO_FACE"

// Measurement scenario to simulate (USE_DUMMY_MEASUREMENTS = true)
// Only matters when DUMMY_FPT_SCENARIO = "NO_FACE"
// Options: "WEIGHT_AND_SHORT" | "WEIGHT_AND_TALL" | "WEIGHT_NO_HEIGHT" | "NOTHING" || "NO_WEIGHT"
const DUMMY_MEASUREMENT_SCENARIO = "WEIGHT_NO_HEIGHT"
// ─────────────────────────────────────────────────────────────────────────────
// Dummy FPT responses — real API shape: everything under .data
// ─────────────────────────────────────────────────────────────────────────────
const DUMMY_FPT_RESPONSES = {
  MULTIPLE_FACES: {
    success: false,
    data: null,
    error: {
      code: "MULTIPLE_FACES_DETECTED",
      message:
        "Multiple faces detected in 91 frame(s). Only one person should be in front of the camera."
    },
    screening: null
  },
  NO_FACE: {
    success: true,
    message: "No face detected",
    data: {
      face_detected: false,
      confidence_band: null,
      matched_student: null,
      candidates: [],
      score: null,
      multiple_matches: false
    }
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
      multiple_matches: false
    }
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
        school: "DPS Noida"
      },
      suhi_id: "SUHI_TEST01",
      class_section: "8-A",
      candidates: [],
      screening: {
        session_id: "dummy-session-avg-001",
        is_resumed: false,
        resume_count: 0,
        next_stage: { stage_key: "bia", display_name: "BIA", stage_order: 1 },
        completed_stages: ["login"]
      }
    }
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
        class_section: "8-A",
        school: "DPS Noida",
        suhi_id: "SUHI_TEST02"
      },
      suhi_id: "SUHI_TEST02",
      class_section: "8-A",
      candidates: [
        {
          user_id: "uuid-1",
          name: "Ravi Kumar",
          score: 0.74,
          class_section: "8-A",
          school: "DPS Noida",
          suhi_id: "SUHI_TEST02",
          photo_url: ""
        },
        {
          user_id: "uuid-2",
          name: "Ravi Kumar",
          score: 0.71,
          class_section: "7-B",
          school: "DPS Noida",
          suhi_id: "SUHI_TEST03",
          photo_url: ""
        }
      ],
      screening: {
        session_id: "dummy-session-high-001",
        is_resumed: false,
        resume_count: 0,
        next_stage: { stage_key: "bia", display_name: "BIA", stage_order: 1 },
        completed_stages: ["login"]
      }
    }
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
        school: "DPS Noida"
      },
      suhi_id: "SUHI_TEST03",
      class_section: "9-C",
      candidates: [],
      screening: {
        session_id: "dummy-session-vh-001",
        is_resumed: false,
        resume_count: 0,
        next_stage: { stage_key: "bia", display_name: "BIA", stage_order: 1 },
        completed_stages: ["login"]
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dummy measurement scenarios — simulates hardware output
// weight: kg (null = not standing on scale)
// height: cm (null = not detected by sensor)
// ─────────────────────────────────────────────────────────────────────────────
const DUMMY_MEASUREMENTS = {
  WEIGHT_AND_SHORT: { weight: 25, height: 110, errors: {} },
  WEIGHT_AND_TALL: { weight: 55, height: 155, errors: {} },
  WEIGHT_NO_HEIGHT: { weight: 55, height: null, errors: { height: "Height sensor timeout" } },
  NO_WEIGHT: { weight: null, height: 155, errors: { weight: "No weight" } },
  NOTHING: { weight: null, height: null, errors: { weight: "No weight", height: "No height" } }
}

const HIGH_CONFIDENCE_BANDS = ["AVERAGE", "HIGH", "VERY_HIGH"]

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

    return await measureWeightAndHeight(ports, MEASUREMENT_TIMEOUT)
  } catch (err) {
    console.error("Measurement error:", err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Error config for each face-not-detected measurement case
// ─────────────────────────────────────────────────────────────────────────────
const getFaceNotDetectedError = (measurements, t) => {
  const hasWeight = !!measurements?.weight
  const hasHeight = !!measurements?.height
  const heightVal = measurements?.height ?? 0

  if (hasWeight && hasHeight && heightVal <= 120) {
    return {
      key: "not_eligible",
      redirectTo: "/login-suhi",
      redirectLabel: t("errors.redirect_login_label"),
      autoRedirectDelay: 5000,
      attempts: [
        {
          title: t("errors.face_not_detected_short"),
          description: t("errors.face_not_detected_short_desc"),
          audio: "let_try_suhi_id",
          showButton: true
        }
      ]
    }
  }

  if (hasWeight && hasHeight && heightVal >= 120) {
    return {
      key: "align_face",
      redirectTo: "/login-suhi",
      redirectLabel: t("errors.redirect_login_label"),
      autoRedirectDelay: 5000,
      attempts: [
        {
          title: t("errors.face_not_detected_camera"),
          description: t("errors.face_not_detected_camera_desc"),
          audio: "cannot_scan_the_face_please_align",
          showButton: false
        },
        {
          title: t("errors.face_not_detected_camera"),
          description: t("errors.face_not_detected_camera_desc"),
          audio: "cannot_scan_the_face_please_align",
          showButton: false
        },
        {
          title: t("errors.last_retry_title"),
          description: t("errors.suhi_coordinator_contact"),
          audio: "contact_your_kiosk_coordinator",// options
          showButton: true
        }
      ]
    }
  }

  if (hasWeight && !hasHeight) {
    return {
      key: "stand_properly",
      redirectTo: "/welcome",
      redirectLabel: t("errors.redirect_home_label"),
      // autoRedirectDelay: 5000,
      attempts: [
        {
          title: t("errors.face_height_not_detected"),
          description: t("errors.face_height_not_detected_desc"),
          audio: "fight_aligned_on_the_kisok",
          showButton: false
        },
        {
          title: t("errors.face_height_not_detected"),
          description: t("errors.face_height_not_detected_desc"),
          audio: "fight_aligned_on_the_kisok",
          showButton: false
        },
        {
          title: t("errors.last_retry_title"),
          description: t("errors.suhi_coordinator_contact"),
          audio: "contact_your_kiosk_coordinator",// options
          showButton: true
        }
      ]
    }
  }

  if (!hasWeight && hasHeight) {
    return {
      key: "no_weight_has_height",
      redirectTo: "/welcome",
      redirectLabel: t("errors.redirect_home_label"),
      autoRedirectDelay: 5000,
      attempts: [
        {
          title: t("errors.face_weight_not_detected"),
          description: t("errors.face_weight_not_detected_desc"),
          audio: "fight_aligned_on_the_kisok",
          showButton: false
        },
        {
          title: t("errors.face_weight_not_detected"),
          description: t("errors.face_weight_not_detected_desc"),
          audio: "fight_aligned_on_the_kisok",
          showButton: false
        },
        {
          title: t("errors.last_retry_title"),
          description: t("errors.suhi_coordinator_contact"),
          audio: "contact_your_kiosk_coordinator",
          showButton: true
        }
      ]
    }
  }

  return {
    key: "not_on_kiosk",
    redirectTo: "/welcome",
    redirectLabel: t("errors.redirect_home_label"),
    autoRedirectDelay: 5000,
    attempts: [
      {
        title: t("errors.face_all_not_detected"),
        description: t("errors.face_all_not_detected_desc"),
        audio: "stand_on_kiosk",
        showButton: true
      }
    ]
  }
}

const VideoCaptureScreen = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { play: playKioskAudio, stop: stopKioskAudio } = useKioskAudio()

  const [, setStatus] = useState("Initializing...")
  const [noActivityState, setNoActivityState] = useState(null)
  const [shouldRetry, setShouldRetry] = useState(false)

  const attemptCountRef = useRef(0)
  const measurementPromiseRef = useRef(null)
  const trackingDoneRef = useRef(false)

  // Tracks the promise for whatever audio clip is currently/was most
  // recently in flight, so anything that navigates can wait for it.
  const pendingAudioRef = useRef(Promise.resolve({ completed: true }))
  const AUDIO_SAFETY_CAP_MS = 8000
  const waitForPendingAudio = () =>
    Promise.race([pendingAudioRef.current, new Promise((r) => setTimeout(r, AUDIO_SAFETY_CAP_MS))])

  const STAGES = { FACE_SCAN: "FACE_SCAN" }
  const STATUS_KEYS = { SUCCESS: "SUCCESS", ERROR: "ERROR" }

  const handleFptDecision = async (fptResponse, measurements) => {
    const errorCode =
      fptResponse?.error?.code ||
      (typeof fptResponse?.error === "string" ? fptResponse.error : null) ||
      fptResponse?.code

    const showAttemptError = (errorConfig) => {
      const totalAttempts = errorConfig.attempts.length
      const attemptIndex = Math.min(attemptCountRef.current, totalAttempts - 1)
      const step = errorConfig.attempts[attemptIndex]
      const isFinalAttempt = attemptIndex >= totalAttempts - 1

      // Single call: interrupts instruction audio (or previous error clip)
      // and starts the new one, or just silences everything if step has no clip.
      pendingAudioRef.current = playKioskAudio(step.audio ? `errors/${step.audio}` : null)

      if (!isFinalAttempt) {
        attemptCountRef.current += 1
        setNoActivityState({
          title: step.title,
          description: step.description,
          redirectTo: errorConfig.redirectTo,
          redirectLabel: step.redirectLabel ?? t("errors.retrying"),
          autoRedirectDelay: step.autoRedirectDelay ?? errorConfig.autoRedirectDelay,
          isRetry: true,
          showRetry: false,
          showButton: step.showButton ?? false,
          showDescription: true,
          onAutoRetry: async () => {
            await waitForPendingAudio() // wait for error audio to finish before retrying
            measurementPromiseRef.current = null
            trackingDoneRef.current = false
            setNoActivityState(null)
            setShouldRetry((prev) => !prev)
          }
        })
      } else {
        setNoActivityState({
          title: step.title,
          description: step.description,
          redirectTo: errorConfig.redirectTo,
          redirectLabel: step.redirectLabel ?? errorConfig.redirectLabel,
          autoRedirectDelay: step.autoRedirectDelay ?? errorConfig.autoRedirectDelay,
          isRetry: false,
          showRetry: false,
          showButton: step.showButton ?? true,
          showDescription: true
        })
      }
      return true
    }

    if (errorCode === "MULTIPLE_FACES_DETECTED") {
      return showAttemptError({
        key: "multiple_faces_detected",
        redirectTo: "/login-suhi",
        redirectLabel: t("errors.redirect_login_label"),
        attempts: [
          {
            title: t("errors.multiple_faces_detected"),
            description: t("errors.multiple_faces_detected_desc"),
            audio: "multiple_faces_detected",
            showButton: false
          },
          {
            title: t("errors.multiple_faces_detected"),
            description: t("errors.multiple_faces_detected_desc"),
            audio: "multiple_faces_detected",
            showButton: true
          }
        ]
      })
    }

    const data = fptResponse?.data ?? {}
    const { face_detected, confidence_band, matched_student, candidates, screening } = data
    const multiple_matches = false

    if (!face_detected) {
      const errorConfig = getFaceNotDetectedError(measurements, t)
      trackStage(
        STAGES.FACE_SCAN,
        STATUS_KEYS.ERROR,
        {
          weight_kg: measurements?.weight,
          height_cm: measurements?.height
        },
        "Face not detected"
      )
      return showAttemptError(errorConfig)
    }

    if (confidence_band === "LOW" || !matched_student) {
      trackStage(
        STAGES.FACE_SCAN,
        STATUS_KEYS.ERROR,
        {
          weight_kg: measurements?.weight,
          height_cm: measurements?.height
        },
        `Low confidence or no match: ${confidence_band}`
      )

      // Wait for the error clip before leaving the screen
      await playKioskAudio("errors/face_not_detected")
      navigate("/login-suhi")
      return true
    }

    if (HIGH_CONFIDENCE_BANDS.includes(confidence_band) && !multiple_matches) {
      dispatch(setUser({ success: true, data: { ...matched_student, buffer_id: data.buffer_id } }))
      dispatch(setLoginScreening(screening))
      trackStage(
        STAGES.FACE_SCAN,
        STATUS_KEYS.SUCCESS,
        {
          weight_kg: measurements?.weight,
          height_cm: measurements?.height
        },
        null,
        null,
        matched_student?.user_id
      )
      stopKioskAudio() // cut instruction audio cleanly, no lingering clip on next screen
      navigate("/verified")
      return true
    }

    if (HIGH_CONFIDENCE_BANDS.includes(confidence_band) && multiple_matches) {
      dispatch(setCandidates(candidates ?? []))
      dispatch(setUser({ success: true, data: { ...matched_student, buffer_id: data.buffer_id } }))
      dispatch(setLoginScreening(screening))
      trackStage(
        STAGES.FACE_SCAN,
        STATUS_KEYS.SUCCESS,
        {
          weight_kg: measurements?.weight,
          height_cm: measurements?.height
        },
        null,
        null,
        null
      )
      stopKioskAudio()
      navigate("/identify-student")
      return true
    }

    return false
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        setStatus("Preparing...")

        // Fire-and-forget: instruction audio plays via single-channel hook.
        // If a decision occurs, it will interrupt this seamlessly.
        pendingAudioRef.current = playKioskAudio("instructions/camera_scan")

        measurementPromiseRef.current = getMeasurements()
        setStatus("Processing scan and measurements...")

        let fptResponse, measurements
        if (USE_DUMMY_FPT) {
          fptResponse = DUMMY_FPT_RESPONSES[DUMMY_FPT_SCENARIO]
          measurements = await measurementPromiseRef.current
        } else {
          ;[fptResponse, measurements] = await Promise.all([
            realtimeCapture(getKioskId()),
            measurementPromiseRef.current
          ])
        }

        if (cancelled) return

        if (measurements && !trackingDoneRef.current) {
          trackingDoneRef.current = true
          if (measurements.weight || measurements.height) {
            storeFptMeasurements(dispatch, measurements.weight, measurements.height)
          }
        }

        const handled = await handleFptDecision(fptResponse, measurements)
        if (!handled) {
          navigate("/login-suhi")
        }
      } catch (error) {
        console.error("[VIDEO CAPTURE] Error:", error)
        setStatus(`Error: ${error.message}`)
        stopKioskAudio()
      }
    }

    run()
    return () => {
      cancelled = true
      stopKioskAudio()
    }
  }, [navigate, shouldRetry])

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
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

      {noActivityState && (
        <NoActivityFrame
          variant="no-user"
          title={noActivityState.title}
          description={noActivityState.description}
          showDescription={noActivityState.showDescription ?? true}
          redirectLabel={noActivityState.redirectLabel}
          showButton={noActivityState.showButton}
          autoRedirectDelay={noActivityState.autoRedirectDelay}
          showRetry={noActivityState.showRetry}
          onRetry={noActivityState.onRetry}
          onRedirect={async () => {
            if (noActivityState.isRetry && noActivityState.onAutoRetry) {
              noActivityState.onAutoRetry()
            } else {
              await waitForPendingAudio()
              setNoActivityState(null)
              navigate(noActivityState.redirectTo)
            }
          }}
        />
      )}
    </div>
  )
}

export default VideoCaptureScreen
