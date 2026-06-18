import { useState, useRef, useCallback } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Voice states
// ─────────────────────────────────────────────────────────────────────────────
export const VOICE_STATE = {
  IDLE: "IDLE",
  RECORDING: "RECORDING",
  PROCESSING: "PROCESSING", // uploading + waiting for transcript
  ERROR: "ERROR",
}

// ─────────────────────────────────────────────────────────────────────────────
// Preferred MIME types — ordered by quality/compatibility
// Falls back gracefully if a format isn't supported
// ─────────────────────────────────────────────────────────────────────────────
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
// Usage:
//   const { voiceState, voiceError, toggleRecording } = useVoiceRecorder({
//     onTranscript: (text) => setInputValue(text),
//     apiUrl: "/api/voice/transcribe",   // optional, defaults below
//   })
// ─────────────────────────────────────────────────────────────────────────────
const useVoiceRecorder = ({
  onTranscript,
  onError,
  apiUrl = "/api/voice/transcribe",
  recordDuration = null,
}) => {
  const [voiceState, setVoiceState] = useState(VOICE_STATE.IDLE)
  const [voiceError, setVoiceError] = useState("")

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timeoutRef = useRef(null)

  // ── Clear any existing timer ──────────────────────────────────────────────
  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // ── Cleanup: stop stream tracks ────────────────────────────────────────
  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // ── Send audio blob to backend ──────────────────────────────────────────
  const sendToBackend = useCallback(
    async (blob) => {
      setVoiceState(VOICE_STATE.PROCESSING)

      try {
        const mimeType = blob.type || "audio/webm"
        const extension = mimeType.includes("ogg")
          ? "ogg"
          : mimeType.includes("mp4")
          ? "mp4"
          : "webm"

        const formData = new FormData()
        formData.append("audio", blob, `recording.${extension}`)

        console.log(
          `[VOICE] Sending ${(blob.size / 1024).toFixed(1)}KB ${mimeType} to ${apiUrl}`
        )

        const response = await fetch(apiUrl, {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`)
        }

        const result = await response.json()
        console.log("[VOICE] Backend response:", result)

        // Expected shape: { success: true, data: { text: "Ravi Kumar" } }
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
    },
    [apiUrl, onTranscript, onError]
  )

  // ── Start recording ─────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setVoiceError("")

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
    } catch (err) {
      console.error("[VOICE] Mic access error:", err)
      const msg =
        err.name === "NotAllowedError"
          ? "Microphone permission denied."
          : err.name === "NotFoundError"
          ? "No microphone found on this device."
          : "Could not access microphone."
      setVoiceState(VOICE_STATE.ERROR)
      setVoiceError(msg)
      return
    }

    const mimeType = getSupportedMimeType()
    console.log("[VOICE] Using MIME type:", mimeType || "(browser default)")

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    recorder.onstop = () => {
      releaseStream()
      const blob = new Blob(chunksRef.current, {
        type: mimeType || "audio/webm",
      })
      console.log(`[VOICE] Recording stopped. Blob size: ${blob.size} bytes`)

      if (blob.size < 1000) {
        // Too small — probably empty / mic issue
        setVoiceState(VOICE_STATE.ERROR)
        setVoiceError("Recording was too short. Please try again.")
        return
      }

      sendToBackend(blob)
    }

    recorder.onerror = (e) => {
      console.error("[VOICE] MediaRecorder error:", e)
      releaseStream()
      setVoiceState(VOICE_STATE.ERROR)
      setVoiceError("Recording failed. Please try again.")
    }

    mediaRecorderRef.current = recorder
    recorder.start(100) // collect chunks every 100ms
    setVoiceState(VOICE_STATE.RECORDING)
    console.log("[VOICE] Recording started")

    if (recordDuration) {
      timeoutRef.current = setTimeout(() => {
        stopRecording()
      }, recordDuration)
    }
  }, [releaseStream, sendToBackend, recordDuration])

  // ── Stop recording ──────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    clearTimer()
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== "inactive") {
      recorder.stop() // triggers onstop → sendToBackend
      console.log("[VOICE] Stopping recorder...")
    }
    mediaRecorderRef.current = null
  }, [clearTimer])

  // ── Toggle (the single button tap handler) ──────────────────────────────
  const toggleRecording = useCallback(() => {
    if (voiceState === VOICE_STATE.RECORDING) {
      stopRecording()
    } else if (voiceState === VOICE_STATE.IDLE || voiceState === VOICE_STATE.ERROR) {
      startRecording()
    }
    // PROCESSING → do nothing (button is disabled)
  }, [voiceState, startRecording, stopRecording])

  // ── Force stop (cleanup on unmount or keyboard open) ───────────────────
  const forceStop = useCallback(() => {
    stopRecording()
    releaseStream()
    setVoiceState(VOICE_STATE.IDLE)
  }, [stopRecording, releaseStream])

  return {
    voiceState,
    voiceError,
    toggleRecording,
    forceStop,
  }
}

export default useVoiceRecorder