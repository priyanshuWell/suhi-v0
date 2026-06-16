import React, { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router"
import { useDispatch, useSelector } from "react-redux"
import { setUser, setScreening } from "../features/common/commonSlice"
import LoginComponent from "./ui/LoginComponent"
import BlueGradientButton from "./ui/BlueGradientButton"
import KeyboardContainer from "./ui/KeyboardContainer"
import FullscreenError from "./FullScreenError"
import { useTranslation } from "react-i18next"

// ---------------------------------------------------------------------------
// Steps: name → grade → section
// Each step filters the candidates array down further.
// ---------------------------------------------------------------------------
const STEPS = ["name", "grade", "section"]

const STEP_CONFIG = {
    name: {
        label: "What is your name?",
        placeholder: "Enter your name",
        // Filter: case-insensitive partial match on candidate.name
        filter: (candidates, value) =>
            candidates.filter((c) =>
                c.name.toLowerCase().includes(value.trim().toLowerCase())
            ),
    },
    grade: {
        label: "What is your grade?",
        placeholder: "e.g. 8A",
        // Filter: exact match (case-insensitive) on candidate.grade
        filter: (candidates, value) =>
            candidates.filter((c) =>
                c.grade.toLowerCase() === value.trim().toLowerCase()
            ),
    },
    section: {
        label: "What is your section?",
        placeholder: "e.g. A",
        // Filter: last char of grade equals section (grade = "8A" → section = "A")
        filter: (candidates, value) =>
            candidates.filter((c) =>
                c.grade.slice(-1).toLowerCase() === value.trim().toLowerCase()
            ),
    },
}

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

    // Guard: if no candidates in store, something went wrong — go back
    useEffect(() => {
        if (!candidates || candidates.length === 0) {
            console.warn("[IDENTIFY] No candidates in store, redirecting to welcome")
            navigate("/welcome")
        }
    }, [])

    // ---------------------------------------------------------------------------
    // Handle Next button — filter candidates with current step's value
    // ---------------------------------------------------------------------------
    const handleNext = () => {
        if (!inputValue.trim()) return

        setLoading(true)
        setError("")

        const matches = config.filter(filteredCandidates, inputValue)

        if (matches.length === 0) {
            // No match — track retry or show final error
            retryRef.current += 1

            if (retryRef.current < MAX_RETRIES) {
                setError("No match found. Please check and try again.")
                setLoading(false)
                return
            }

            // Max retries hit — show fullscreen error → redirect to home
            setNoMatchError(true)
            setLoading(false)
            return
        }

        if (matches.length === 1 || stepIndex === STEPS.length - 1) {
            // Single match found, or we've exhausted all steps — confirm the top match
            const confirmed = matches[0]
            dispatch(setUser({ success: true, data: confirmed }))
            dispatch(setScreening(null))
            navigate("/verified")
            return
        }

        // Still multiple matches — move to next step with narrowed list
        setFilteredCandidates(matches)
        setInputValue("")
        setError("")
        retryRef.current = 0
        setStepIndex((prev) => prev + 1)
        setLoading(false)
    }

    const isButtonDisabled = !inputValue.trim() || loading

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    return (
        <>
            {/* Background via existing LoginComponent */}
            <LoginComponent />

            {/* Step label */}
            <div className="fixed top-1/16 left-1/2 -translate-x-1/2 z-30 w-[600px]">
                <p className="text-5xl text-center font-light leading-snug text-white">
                    {config.label}
                </p>
                {/* Step indicator */}
                <div className="flex justify-center gap-2 mt-4">
                    {STEPS.map((s, i) => (
                        <div
                            key={s}
                            className={`h-1.5 rounded-full transition-all ${i === stepIndex
                                ? "w-8 bg-white"
                                : i < stepIndex
                                    ? "w-4 bg-white/60"
                                    : "w-4 bg-white/20"
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Input field */}
            <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px]">
                <div className="w-full flex flex-col gap-10 cursor-pointer">
                    <div>
                        <div className="leading-[28px] relative text-white text-xl tracking-wide">
                            {config.label}{" "}
                            <span className="text-[#ff0000cc] font-['Noto_Sans'] absolute">*</span>
                        </div>
                        <div className="relative min-h-[50px] text-3xl flex items-center">
                            <input
                                type="text"
                                value={inputValue}
                                readOnly
                                className="w-full bg-transparent border-none outline-none text-white caret-transparent"
                                onFocus={() => {
                                    setKeyboardVisible(true)
                                    setError("")
                                }}
                            />
                        </div>
                        <div className="border-t-2 border-white w-full mt-2" />

                        {/* Inline error */}
                        {error && (
                            <p className="text-red-400 text-sm mt-3 text-center animate-pulse">
                                {error}
                            </p>
                        )}

                        {/* Candidates count hint */}
                        {filteredCandidates.length > 1 && !error && (
                            <p className="text-white/40 text-sm mt-3 text-center">
                                {filteredCandidates.length} possible matches
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Next button */}
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

            {/* Fullscreen error — no match after max retries */}
            {noMatchError && (
                <FullscreenError
                    title="Student not found"
                    description="We couldn't find a match. Please try logging in with your SUHI ID."
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