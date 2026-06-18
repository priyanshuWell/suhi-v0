import React, { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router"
import { useDispatch, useSelector } from "react-redux"
import { setUser, setScreening } from "../features/common/commonSlice"
import LoginComponent from "./ui/LoginComponent"
import BlueGradientButton from "./ui/BlueGradientButton"
import KeyboardContainer from "./ui/KeyboardContainer"
import FullscreenError from "./FullScreenError"
import useVoiceRecorder, { VOICE_STATE } from "../hooks/useVoiceRecorder"
import { useTranslation } from "react-i18next"

// ─────────────────────────────────────────────────────────────────────────────
// Steps config
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = ["name", "grade", "section"]

const STEP_CONFIG = {
    name: {
        label: "What is your name?",
        hint: "Speak or type your full name",
        filter: (candidates, value) =>
            candidates.filter((c) =>
                c.name.toLowerCase().includes(value.trim().toLowerCase())
            ),
    },
    grade: {
        label: "What is your grade?",
        hint: "e.g. 8A, 10D",
        filter: (candidates, value) =>
            candidates.filter((c) =>
                c.grade.toLowerCase() === value.trim().toLowerCase()
            ),
    },
    section: {
        label: "What is your section?",
        hint: "e.g. A, B, C",
        filter: (candidates, value) =>
            candidates.filter((c) =>
                c.grade.slice(-1).toLowerCase() === value.trim().toLowerCase()
            ),
    },
}

// ─────────────────────────────────────────────────────────────────────────────
// MicButton
// ─────────────────────────────────────────────────────────────────────────────
const MicButton = ({ voiceState, onClick, disabled }) => {
    const isRecording = voiceState === VOICE_STATE.RECORDING
    const isProcessing = voiceState === VOICE_STATE.PROCESSING
    const isError = voiceState === VOICE_STATE.ERROR

    return (
        <button
            onClick={onClick}
            disabled={disabled || isProcessing}
            aria-label={isRecording ? "Stop recording" : "Start voice input"}
            className={`
        relative flex-shrink-0 flex items-center justify-center
        w-14 h-14 rounded-full
        border-2 transition-all duration-300
        active:scale-95
        ${isRecording
                    ? "border-red-400 bg-red-500/20"
                    : isError
                        ? "border-yellow-400 bg-yellow-500/10"
                        : "border-white/30 bg-white/10 hover:border-white/60 hover:bg-white/15"
                }
        ${disabled || isProcessing ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
      `}
        >
            {/* Pulse rings when recording */}
            {isRecording && (
                <>
                    <span className="absolute inset-0 rounded-full border-2 border-red-400/50 animate-ping" />
                    <span
                        className="absolute inset-[-8px] rounded-full border border-red-400/20 animate-ping"
                        style={{ animationDelay: "0.25s" }}
                    />
                </>
            )}

            {/* Icon */}
            {isProcessing ? (
                <svg className="animate-spin w-5 h-5 text-white/60" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M12 2a10 10 0 019.8 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
            ) : isRecording ? (
                /* Stop square */
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-400" fill="currentColor">
                    <rect x="5" y="5" width="14" height="14" rx="2" />
                </svg>
            ) : (
                /* Mic */
                <svg viewBox="0 0 24 24" className={`w-6 h-6 transition-colors ${isError ? "text-yellow-400" : "text-white/80"
                    }`} fill="currentColor">
                    <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 15.93A8.001 8.001 0 0 1 4 11H2a10 10 0 0 0 9 9.95V23h2v-2.05A10 10 0 0 0 22 11h-2a8.001 8.001 0 0 1-7 5.93z" />
                </svg>
            )}
        </button>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// VoiceStatusLabel — sits below the input underline
// ─────────────────────────────────────────────────────────────────────────────
const VoiceStatusLabel = ({ voiceState, errorMsg }) => {
    const map = {
        [VOICE_STATE.RECORDING]: { text: "Recording… tap mic to stop", color: "text-red-400" },
        [VOICE_STATE.PROCESSING]: { text: "Transcribing…", color: "text-white/50" },
        [VOICE_STATE.ERROR]: {
            text: errorMsg || "Couldn't process audio. Please try again.",
            color: "text-yellow-400",
        },
    }

    const config = map[voiceState]
    if (!config) return null

    return (
        <p className={`text-sm mt-2 text-center ${config.color}`}>
            {config.text}
        </p>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// IdentifyStudent
// ─────────────────────────────────────────────────────────────────────────────
const IdentifyStudent = () => {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { t } = useTranslation()

    const candidates = useSelector((state) => state.common.candidates)

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

    // ── Voice recorder hook ─────────────────────────────────────────────────
    const { voiceState, voiceError, toggleRecording, forceStop } = useVoiceRecorder({
        apiUrl: "/api/voice/transcribe",
        recordDuration: 5000,
        onTranscript: (text) => {
            console.log("[IDENTIFY] Transcript received:", text)
            setInputValue(text)
            setError("")
        },
        onError: (msg) => {
            console.warn("[IDENTIFY] Voice error:", msg)
        },
    })

    // Guard: no candidates → back to welcome
    useEffect(() => {
        if (!candidates || candidates.length === 0) {
            console.warn("[IDENTIFY] No candidates in store, redirecting to welcome")
            navigate("/welcome")
        }
    }, [])

    // Cleanup on unmount
    useEffect(() => () => forceStop(), [])

    // Stop recording when keyboard opens
    useEffect(() => {
        if (
            keyboardVisible &&
            (voiceState === VOICE_STATE.RECORDING || voiceState === VOICE_STATE.PROCESSING)
        ) {
            forceStop()
        }
    }, [keyboardVisible])

    // Reset input + voice when step changes
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
                setError("No match found. Please check and try again.")
                setLoading(false)
                return
            }
            setNoMatchError(true)
            setLoading(false)
            return
        }

        if (matches.length === 1 || stepIndex === STEPS.length - 1) {
            const confirmed = matches[0]
            dispatch(setUser({ success: true, data: confirmed }))
            dispatch(setScreening(null))
            navigate("/verified")
            return
        }

        // More steps needed — narrow and advance
        setFilteredCandidates(matches)
        retryRef.current = 0
        setStepIndex((prev) => prev + 1)
        setLoading(false)
    }

    const isButtonDisabled =
        !inputValue.trim() ||
        loading ||
        voiceState === VOICE_STATE.RECORDING ||
        voiceState === VOICE_STATE.PROCESSING

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <>
            <LoginComponent />

            {/* Title + step indicator */}
            <div className="fixed top-1/16 left-1/2 -translate-x-1/2 z-30 w-[600px]">
                <p className="text-5xl text-center font-light leading-snug text-white">
                    {config.label}
                </p>
                <div className="flex justify-center gap-2 mt-4">
                    {STEPS.map((s, i) => (
                        <div
                            key={s}
                            className={`h-1.5 rounded-full transition-all duration-300 ${i === stepIndex
                                ? "w-8 bg-white"
                                : i < stepIndex
                                    ? "w-4 bg-white/60"
                                    : "w-4 bg-white/20"
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Input row */}
            <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px]">
                <div className="w-full flex flex-col gap-10">
                    <div>
                        {/* Field label */}
                        <div className="leading-[28px] relative text-white text-xl tracking-wide mb-1">
                            {config.label}{" "}
                            <span className="text-[#ff0000cc] font-['Noto_Sans'] absolute">*</span>
                        </div>

                        {/* Input + mic side by side */}
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
                            <MicButton
                                voiceState={voiceState}
                                onClick={toggleRecording}
                                disabled={keyboardVisible}
                            />
                        </div>

                        {/* Underline */}
                        <div className="border-t-2 border-white w-full mt-2" />

                        {/* Status area — one message at a time, priority: voice > error > hint */}
                        {voiceState !== VOICE_STATE.IDLE ? (
                            <VoiceStatusLabel voiceState={voiceState} errorMsg={voiceError} />
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

            {/* Next / Confirm button — disabled while recording or processing */}
            <div className="fixed top-[62%] left-1/2 -translate-x-1/2 -translate-y-1/2">
                <BlueGradientButton
                    disabled={isButtonDisabled}
                    width={"w-[clamp(16rem,32vw,31.25rem)]"}
                    onClick={handleNext}
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-3">
                            <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" opacity="0.3" />
                                <path d="M12 2a10 10 0 019.8 8" stroke="white" strokeWidth="3" strokeLinecap="round" />
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

            {/* On-screen keyboard */}
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

            {/* Fullscreen error — no match after max retries */}
            {noMatchError && (
                <FullscreenError
                    title="Student not found"
                    description="We couldn't find a match. Please try logging in with your SUHI ID."
                    showDescription={true}
                    redirectLabel="Going to home"
                    autoRedirectDelay={5000}
                    showRetry={false}
                    onRedirect={() => {
                        setNoMatchError(false)
                        navigate("/welcome")
                    }}
                />
            )}
        </>
    )
}

export default IdentifyStudent