import React, { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router"
import { useDispatch, useSelector } from "react-redux"
import { setUser } from "../features/common/commonSlice"
import LoginComponent from "./ui/LoginComponent"
import BlueGradientButton from "./ui/BlueGradientButton"
import KeyboardContainer from "./ui/KeyboardContainer"
import NoActivityFrame from "./ui/NoActivityFrame"
import useVoiceRecorder, { VOICE_STATE } from "../hooks/useVoiceRecorder"
import { useTranslation } from "react-i18next"
import { useKioskAudio } from "../hooks/useKioskAudio"

const STEPS = ["suhi_id"]
const RECORD_DURATION_S = 5

const STEP_CONFIG = {
    suhi_id: {
        label: "Enter your SUHI Id",
        hint: "e.g. SUHI_210S0A642",
        filter: (candidates, value) =>
            candidates.filter((c) => c.suhi_id?.trim().toLowerCase() === value.trim().toLowerCase())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MicButton — shows SVG countdown ring while recording, fully disabled during
//             PROCESSING so user can't tap again mid-transcribe
// ─────────────────────────────────────────────────────────────────────────────
const RING_R = 24 // radius of countdown ring
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R

const MicButton = ({ voiceState, secondsLeft, onClick, disabled }) => {
    const isRecording = voiceState === VOICE_STATE.RECORDING
    const isProcessing = voiceState === VOICE_STATE.PROCESSING
    const isError = voiceState === VOICE_STATE.ERROR
    const isDisabled = disabled || isRecording || isProcessing

    // Progress: 1 (full) → 0 (empty) as secondsLeft goes 5 → 0
    const progress = isRecording && secondsLeft != null ? secondsLeft / RECORD_DURATION_S : 1

    const strokeOffset = RING_CIRCUMFERENCE * (1 - progress)

    return (
        <button
            onClick={onClick}
            disabled={isDisabled}
            aria-label="Start voice input"
            className={`
        relative flex-shrink-0 flex items-center justify-center
        w-14 h-14 rounded-full
        border-2 transition-all duration-300
        ${
            isRecording
                ? "border-red-500/40 bg-red-500/10"
                : isError
                  ? "border-yellow-400 bg-yellow-500/10"
                  : isDisabled
                    ? "border-white/20 bg-white/5"
                    : "border-white/30 bg-white/10 hover:border-white/60 hover:bg-white/15 active:scale-95 cursor-pointer"
        }
      `}
        >
            {/* SVG countdown ring — only visible while recording */}
            {isRecording && (
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
                    {/* Track */}
                    <circle
                        cx="28"
                        cy="28"
                        r={RING_R}
                        stroke="rgba(239,68,68,0.2)"
                        strokeWidth="3"
                        fill="none"
                    />
                    {/* Progress arc */}
                    <circle
                        cx="28"
                        cy="28"
                        r={RING_R}
                        stroke="#ef4444"
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={RING_CIRCUMFERENCE}
                        strokeDashoffset={strokeOffset}
                        style={{ transition: "stroke-dashoffset 1s linear" }}
                    />
                </svg>
            )}

            {/* Icon */}
            {isProcessing ? (
                /* Spinner */
                <svg className="animate-spin w-5 h-5 text-white/50" viewBox="0 0 24 24" fill="none">
                    <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                        opacity="0.2"
                    />
                    <path
                        d="M12 2a10 10 0 019.8 8"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                </svg>
            ) : isRecording ? (
                /* Countdown number */
                <span className="text-white text-lg font-semibold tabular-nums leading-none">
                    {secondsLeft ?? RECORD_DURATION_S}
                </span>
            ) : (
                /* Mic icon */
                <svg
                    viewBox="0 0 24 24"
                    className={`w-6 h-6 transition-colors ${isError ? "text-white" : "text-white/80"}`}
                    fill="currentColor"
                >
                    <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 15.93A8.001 8.001 0 0 1 4 11H2a10 10 0 0 0 9 9.95V23h2v-2.05A10 10 0 0 0 22 11h-2a8.001 8.001 0 0 1-7 5.93z" />
                </svg>
            )}
        </button>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// VoiceStatusLabel
// ─────────────────────────────────────────────────────────────────────────────
const VoiceStatusLabel = ({ voiceState, voiceError, secondsLeft }) => {
    const map = {
        [VOICE_STATE.RECORDING]: {
            text: `Recording… ${secondsLeft ?? RECORD_DURATION_S}s`,
            color: "text-red-400"
        },
        [VOICE_STATE.PROCESSING]: { text: "Transcribing…", color: "text-white/50" },
        [VOICE_STATE.ERROR]: {
            text: voiceError || "Couldn't process audio. Try again.",
            color: "text-yellow-400"
        }
    }

    const cfg = map[voiceState]
    if (!cfg) return null

    return <p className={`text-sm mt-2 text-center ${cfg.color}`}>{cfg.text}</p>
}

// ─────────────────────────────────────────────────────────────────────────────
// IdentifyStudent
// ─────────────────────────────────────────────────────────────────────────────
const IdentifyStudent = () => {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { t } = useTranslation()
    const { play: playAudio } = useKioskAudio()

    const candidates = useSelector((state) => state.common.candidates)
    const user = useSelector((state) => state.common.user)

    const [stepIndex, setStepIndex] = useState(0)
    const [inputValue, setInputValue] = useState("")
    const [keyboardVisible, setKeyboardVisible] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [filteredCandidates, setFilteredCandidates] = useState(candidates)
    const [noMatchError, setNoMatchError] = useState(false)

    const retryRef = useRef(0)
    const MAX_RETRIES = 2

    const currentStep = STEPS[stepIndex]
    const config = STEP_CONFIG[currentStep]

    const { voiceState, voiceError, secondsLeft, startRecording, forceStop } = useVoiceRecorder({
        apiUrl: "/api/voice/transcribe",
        onTranscript: (text) => {
            console.log("[IDENTIFY] Transcript:", text)
            setInputValue(text)
            setError("")
        },
        onError: (msg) => console.warn("[IDENTIFY] Voice error:", msg)
    })

    // Guard: no candidates
    useEffect(() => {
        if (!candidates || candidates.length === 0) {
            navigate("/welcome")
        }
    }, [])

    // Cleanup on unmount
    useEffect(() => () => forceStop(), [])

    // Keyboard open → stop recording
    useEffect(() => {
        if (keyboardVisible) forceStop()
    }, [keyboardVisible])

    // Step change → reset
    useEffect(() => {
        setInputValue("")
        setError("")
        forceStop()
    }, [stepIndex])

    // ── Step navigation ─────────────────────────────────────────────────────
    const handleNext = () => {
        if (!inputValue.trim()) return

        forceStop()
        setLoading(true)
        setError("")

        const matches = config.filter(filteredCandidates, inputValue)

        if (matches.length === 0) {
            retryRef.current += 1
            if (retryRef.current < MAX_RETRIES) {
                // Play "invalid SUHI Id" audio feedback
                playAudio("errors/invalid_suhi_id_coordinate")
                setError("No match found. Please check and try again.")
                setLoading(false)
                return
            }
            // Max retries reached — play redirect audio then show fullscreen error
            playAudio("errors/let_try_suhi_id")
            setNoMatchError(true)
            setLoading(false)
            return
        }
        console.log("matches", matches, filteredCandidates, candidates)
        if (matches.length === 1 || stepIndex === STEPS.length - 1) {
            const matched = matches[0]
            dispatch(
                setUser({ success: true, data: { ...matched, buffer_id: user?.data?.buffer_id } })
            )
            // screening is already set from the face-scan step; don't overwrite it
            navigate("/verified")
            return
        }

        setFilteredCandidates(matches)
        retryRef.current = 0
        setStepIndex((prev) => prev + 1)
        setLoading(false)
    }

    const isRecordingOrProcessing =
        voiceState === VOICE_STATE.RECORDING || voiceState === VOICE_STATE.PROCESSING

    const isButtonDisabled = !inputValue.trim() || loading || isRecordingOrProcessing

    return (
        <>
            <LoginComponent />

            {/* Title + step dots */}
            <div className="fixed top-1/16 left-1/2 -translate-x-1/2 z-30 w-[600px]">
                <p className="text-5xl text-center font-light leading-snug text-white">
                    {config.label}
                </p>
                <div className="flex justify-center gap-2 mt-4">
                    {STEPS.map((s, i) => (
                        <div
                            key={s}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                i === stepIndex
                                    ? "w-8 bg-white"
                                    : i < stepIndex
                                      ? "w-4 bg-white/60"
                                      : "w-4 bg-white/20"
                            }`}
                        />
                    ))}
                </div>
            </div>

            {/* Input + mic */}
            <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px]">
                <div className="w-full flex flex-col gap-10">
                    <div>
                        <div className="leading-[28px] relative text-white text-xl tracking-wide mb-1">
                            {config.label}{" "}
                            <span className="text-[#ff0000cc] font-['Noto_Sans'] absolute">*</span>
                        </div>

                        <div className="relative min-h-[50px] text-3xl flex items-center gap-3">
                            <input
                                type="text"
                                value={inputValue}
                                readOnly
                                placeholder={voiceState === VOICE_STATE.IDLE ? config.hint : ""}
                                className="
                  flex-1 bg-transparent border-none outline-none
                  text-white caret-transparent
                  placeholder:text-white/25 placeholder:text-xl
                "
                                onFocus={() => {
                                    setKeyboardVisible(true)
                                    setError("")
                                }}
                            />
                            {/* 
                            <MicButton
                                voiceState={voiceState}
                                secondsLeft={secondsLeft}
                                onClick={startRecording}
                                disabled={keyboardVisible}
                            /> */}
                        </div>

                        <div className="border-t-2 border-white w-full mt-2" />

                        {/* Status: voice > error > candidates hint */}
                        {voiceState !== VOICE_STATE.IDLE ? (
                            <VoiceStatusLabel
                                voiceState={voiceState}
                                voiceError={voiceError}
                                secondsLeft={secondsLeft}
                            />
                        ) : error ? (
                            <p className="text-red-400 text-sm mt-2 text-center animate-pulse">
                                {error}
                            </p>
                        ) : filteredCandidates.length > 1 ? (
                            <p className="text-white/40 text-sm mt-2 text-center">
                                {filteredCandidates.length} possible matches
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Next / Confirm */}
            <div className="fixed top-[62%] left-1/2 -translate-x-1/2 -translate-y-1/2">
                <BlueGradientButton
                    disabled={isButtonDisabled}
                    width={"w-[clamp(16rem,32vw,31.25rem)]"}
                    onClick={handleNext}
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-3">
                            <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="white"
                                    strokeWidth="3"
                                    opacity="0.3"
                                />
                                <path
                                    d="M12 2a10 10 0 019.8 8"
                                    stroke="white"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                />
                            </svg>
                            Checking...
                        </span>
                    ) : voiceState === VOICE_STATE.PROCESSING ? (
                        "Transcribing..."
                    ) : stepIndex < STEPS.length - 1 ? (
                        "Next"
                    ) : (
                        "Confirm"
                    )}
                </BlueGradientButton>
            </div>

            {/* Keyboard */}
            {keyboardVisible && (
                <KeyboardContainer
                    onKeyPress={(k) => {
                        setInputValue((v) => v + k)
                        setError("")
                    }}
                    onBackspace={() => {
                        setInputValue((v) => v.slice(0, -1))
                        setError("")
                    }}
                    onSubmit={() => {
                        setKeyboardVisible(false)
                        handleNext()
                    }}
                    onClose={() => setKeyboardVisible(false)}
                />
            )}

            {/* Fullscreen error */}
            {noMatchError && (
                <NoActivityFrame
                    variant="error"
                    title="Let's try another way"
                    description="Please log in using your SuHi ID."
                    showDescription={true}
                    redirectLabel="Going to SUHI Id login"
                    autoRedirectDelay={5000}
                    showRetry={false}
                    onRedirect={() => {
                        setNoMatchError(false)
                        navigate("/login-suhi")
                    }}
                />
            )}
        </>
    )
}

export default IdentifyStudent
