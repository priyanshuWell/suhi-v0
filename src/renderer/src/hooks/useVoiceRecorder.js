import { useState, useRef, useCallback } from "react"

export const VOICE_STATE = {
  IDLE: "IDLE",
  RECORDING: "RECORDING",  // counting down 5s
  PROCESSING: "PROCESSING", // uploading + waiting for transcript
  ERROR: "ERROR",
}

const RECORD_DURATION_MS = 5000

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
]

const getSupportedMimeType = () =>
  PREFERRED_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || ""

// ─────────────────────────────────────────────────────────────────────────────
// useVoiceRecorder
//
// Fixed 5-second recording. User taps mic → countdown → auto-stop → transcribe.
// No manual stop. If already recording and tapped again, ignored (button disabled).
//
// Returns:
//   voiceState      — IDLE | RECORDING | PROCESSING | ERROR
//   voiceError      — string error message
//   secondsLeft     — countdown (5 → 0) while RECORDING, null otherwise
//   startRecording  — call on mic tap
//   forceStop       — cleanup on unmount / keyboard open
// ─────────────────────────────────────────────────────────────────────────────
const useVoiceRecorder = ({
  onTranscript,
  onError,
  apiUrl = "/api/voice/transcribe",
}) => {
  const [voiceState, setVoiceState] = useState(VOICE_STATE.IDLE)
  const [voiceError, setVoiceError] = useState("")
  const [secondsLeft, setSecondsLeft] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const countdownRef = useRef(null)  // setInterval for countdown
  const autoStopRef = useRef(null)   // setTimeout for auto-stop

  // ── Release mic stream ──────────────────────────────────────────────────
  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // ── Clear timers ────────────────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
  }, [])

  // ── Send blob to backend ────────────────────────────────────────────────
  const sendToBackend = useCallback(async (blob) => {
    setVoiceState(VOICE_STATE.PROCESSING)
    setSecondsLeft(null)

    try {
      const mimeType = blob.type || "audio/webm"
      const extension = mimeType.includes("ogg") ? "ogg"
        : mimeType.includes("mp4") ? "mp4"
        : "webm"

      const formData = new FormData()
      formData.append("audio", blob, `recording.${extension}`)

      console.log(`[VOICE] Sending ${(blob.size / 1024).toFixed(1)}KB to ${apiUrl}`)

      const response = await fetch(apiUrl, { method: "POST", body: formData })

      if (!response.ok) throw new Error(`Server returned ${response.status}`)

      const result = await response.json()
      console.log("[VOICE] Response:", result)

      if (!result.success || !result.data?.text?.trim()) {
        throw new Error("No transcript returned from server")
      }

      onTranscript?.(result.data.text.trim())
      setVoiceState(VOICE_STATE.IDLE)
      setVoiceError("")
    } catch (err) {
      console.error("[VOICE] Transcription error:", err)
      const msg = err.message || "Transcription failed. Please try again."
      setVoiceState(VOICE_STATE.ERROR)
      setVoiceError(msg)
      onError?.(msg)
    }
  }, [apiUrl, onTranscript, onError])

  // ── Start fixed-duration recording ──────────────────────────────────────
  const startRecording = useCallback(async () => {
    // Already running — ignore tap
    if (
      voiceState === VOICE_STATE.RECORDING ||
      voiceState === VOICE_STATE.PROCESSING
    ) return

    setVoiceError("")

    // Request mic
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
    } catch (err) {
      console.error("[VOICE] Mic error:", err)
      const msg =
        err.name === "NotAllowedError" ? "Microphone permission denied." :
        err.name === "NotFoundError"   ? "No microphone found on this device." :
                                         "Could not access microphone."
      setVoiceState(VOICE_STATE.ERROR)
      setVoiceError(msg)
      return
    }

    const mimeType = getSupportedMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      releaseStream()
      clearTimers()

      const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" })
      console.log(`[VOICE] Blob: ${blob.size} bytes`)

      if (blob.size < 1000) {
        setVoiceState(VOICE_STATE.ERROR)
        setVoiceError("Recording was too short. Please try again.")
        setSecondsLeft(null)
        return
      }

      sendToBackend(blob)
    }

    recorder.onerror = () => {
      releaseStream()
      clearTimers()
      setVoiceState(VOICE_STATE.ERROR)
      setVoiceError("Recording failed. Please try again.")
      setSecondsLeft(null)
    }

    mediaRecorderRef.current = recorder
    recorder.start(100)

    // ── Start countdown ───────────────────────────────────────────────────
    const totalSecs = RECORD_DURATION_MS / 1000
    setSecondsLeft(totalSecs)
    setVoiceState(VOICE_STATE.RECORDING)
    console.log(`[VOICE] Recording started — ${totalSecs}s fixed duration`)

    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current)
          countdownRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // ── Auto-stop after fixed duration ────────────────────────────────────
    autoStopRef.current = setTimeout(() => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        console.log("[VOICE] Auto-stopping after 5s")
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current = null
      }
    }, RECORD_DURATION_MS)
  }, [voiceState, releaseStream, clearTimers, sendToBackend])

  // ── Force cleanup (unmount / keyboard open) ─────────────────────────────
  const forceStop = useCallback(() => {
    clearTimers()
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      // Override onstop so it doesn't sendToBackend on forced cleanup
      mediaRecorderRef.current.onstop = () => {}
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    releaseStream()
    setVoiceState(VOICE_STATE.IDLE)
    setSecondsLeft(null)
  }, [clearTimers, releaseStream])

  return {
    voiceState,
    voiceError,
    secondsLeft,
    startRecording,
    forceStop,
  }
}

export default useVoiceRecorder