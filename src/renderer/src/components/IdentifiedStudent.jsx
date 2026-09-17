import React, { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router"
import { useDispatch, useSelector } from "react-redux"
import { setUser } from "../features/common/commonSlice"
import LoginComponent from "./ui/LoginComponent"
import BlueGradientButton from "./ui/BlueGradientButton"
import KeyboardContainer from "./ui/KeyboardContainer"
import ErrorAlert from "./ErrorAlert"
import { useTranslation } from "react-i18next"
import { useKioskAudio } from "../hooks/useKioskAudio"

const MAX_RETRIES = 2

const IdentifyStudent = () => {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { t } = useTranslation()
    const { play: playAudio } = useKioskAudio()

    const candidates = useSelector((state) => state.common.candidates) || []
    const user = useSelector((state) => state.common.user)

    const [step, setStep] = useState("NAME") // "NAME" | "SUHI_ID"
    const [nameInput, setNameInput] = useState("")
    const [suhiIdInput, setSuhiIdInput] = useState("")
    const [duplicateCandidates, setDuplicateCandidates] = useState([])
    const [keyboardVisible, setKeyboardVisible] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [showErrorAlert, setShowErrorAlert] = useState(false)

    const retryRef = useRef(0)
    const errorAlertTimerRef = useRef(null)

    // Guard: if neither candidates nor user exist, return to welcome
    useEffect(() => {
        if ((!candidates || candidates.length === 0) && !user?.data) {
            navigate("/welcome")
        }
    }, [candidates, user, navigate])

    // Auto-dismiss ErrorAlert
    useEffect(() => {
        if (!showErrorAlert) return
        clearTimeout(errorAlertTimerRef.current)
        errorAlertTimerRef.current = setTimeout(() => {
            setShowErrorAlert(false)
        }, 4000)
        return () => clearTimeout(errorAlertTimerRef.current)
    }, [showErrorAlert])

    const currentValue = step === "NAME" ? nameInput : suhiIdInput
    const isButtonDisabled = !currentValue.trim() || loading

    const confirmStudent = (studentData) => {
        dispatch(
            setUser({
                ...user,
                success: true,
                data: {
                    ...user?.data,
                    ...studentData,
                    buffer_id: user?.data?.buffer_id,
                    multiface_detected: false,
                    multiple_matches: false
                }
            })
        )
        setError("")
        setKeyboardVisible(false)
        retryRef.current = 0
        navigate("/verified")
    }

    const handleNameSubmit = () => {
        const query = nameInput.trim()
        if (!query) {
            setError(t("identifyStudent.enter_name", "Please enter your full name"))
            return
        }

        setLoading(true)
        setError("")

        const normalizedQuery = query.toLowerCase()

        // 1. Exact match on name or student_name
        let matches = candidates.filter((c) => {
            const cName = (c.name || c.student_name || "").trim().toLowerCase()
            return cName === normalizedQuery
        })

        // 2. Fallback to partial / contains match
        if (matches.length === 0) {
            matches = candidates.filter((c) => {
                const cName = (c.name || c.student_name || "").trim().toLowerCase()
                return cName.includes(normalizedQuery) || normalizedQuery.includes(cName)
            })
        }

        if (matches.length === 1) {
            // Unique match found
            confirmStudent(matches[0])
            setLoading(false)
            return
        }

        if (matches.length > 1) {
            // Multiple students share this name -> disambiguate with SUHI ID
            setDuplicateCandidates(matches)
            setStep("SUHI_ID")
            setSuhiIdInput("")
            setKeyboardVisible(false)
            setError("")
            setLoading(false)
            return
        }

        // 3. If candidates array had no match, check single student in store
        const currentStoreName = (user?.data?.name || user?.data?.student_name || "").trim().toLowerCase()
        if (
            currentStoreName &&
            (currentStoreName === normalizedQuery || currentStoreName.includes(normalizedQuery))
        ) {
            confirmStudent(user.data)
            setLoading(false)
            return
        }

        // No match found
        handleFailure("No matching profile found. Please check spelling or try again.")
        setLoading(false)
    }

    const handleSuhiIdSubmit = () => {
        const query = suhiIdInput.trim()
        if (!query) {
            setError(t("identifyStudent.enter_suhi_id", "Please enter your SUHI Id"))
            return
        }

        setLoading(true)
        setError("")

        const normalizedId = query.toLowerCase()
        const pool = duplicateCandidates.length > 0 ? duplicateCandidates : candidates

        const matched = pool.find((c) => {
            const cId = (c.suhi_id || "").trim().toLowerCase()
            return cId === normalizedId
        })

        if (matched) {
            confirmStudent(matched)
            setLoading(false)
            return
        }

        // No match found for this SUHI ID
        handleFailure(t("loginSuhi.student_not_found", "SUHI Id not found among matched profiles. Please try again."))
        setLoading(false)
    }

    const handleFailure = (msg) => {
        const attempt = retryRef.current + 1
        if (attempt < MAX_RETRIES) {
            retryRef.current = attempt
            playAudio("errors/invalid_suhi_id_coordinate")
            setError(msg)
            setShowErrorAlert(true)
        } else {
            retryRef.current = 0
            playAudio("errors/let_try_suhi_id")
            setError(msg)
            setTimeout(() => {
                navigate("/login-suhi")
            }, 1500)
        }
    }

    const handleNext = () => {
        if (isButtonDisabled) return
        if (step === "NAME") {
            handleNameSubmit()
        } else {
            handleSuhiIdSubmit()
        }
    }

    const handleBack = () => {
        if (step === "SUHI_ID") {
            setStep("NAME")
            setSuhiIdInput("")
            setError("")
            return
        }
        navigate("/welcome")
    }

    // Physical keyboard listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey || e.altKey || e.metaKey) return

            if (e.key === "Backspace") {
                setError("")
                if (step === "NAME") {
                    setNameInput((v) => v.slice(0, -1))
                } else {
                    setSuhiIdInput((v) => v.slice(0, -1))
                }
            } else if (e.key === "Enter") {
                handleNext()
            } else if (e.key.length === 1) {
                setError("")
                if (step === "NAME") {
                    setNameInput((v) => v + e.key)
                } else {
                    setSuhiIdInput((v) => v + e.key)
                }
                setKeyboardVisible(false)
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [step, nameInput, suhiIdInput, loading, candidates, duplicateCandidates])

    return (
        <>
            {/* Top Title */}
            <div className="fixed top-1/16 left-1/2 -translate-x-1/2 z-30 w-[650px]">
                <p className="text-5xl text-center font-light leading-snug text-white">
                    {step === "NAME"
                        ? t("identifyStudent.title_name", "Log in using your Full Name")
                        : t("identifyStudent.title_id", "Log in using your SUHI Id")}
                </p>
                {/* Step indicator dots */}
                <div className="flex justify-center gap-2 mt-4">
                    <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                            step === "NAME" ? "w-8 bg-white" : "w-4 bg-white/60"
                        }`}
                    />
                    <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                            step === "SUHI_ID" ? "w-8 bg-white" : "w-4 bg-white/20"
                        }`}
                    />
                </div>
            </div>

            <LoginComponent onBack={handleBack} />

            {/* Form */}
            <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px]">
                <div className="w-full flex flex-col gap-10 cursor-pointer">
                    <div className="suhi-id">
                        <div className="leading-[28px] relative text-white text-xl tracking-wide">
                            {step === "NAME"
                                ? t("identifyStudent.name_label", "Full Name")
                                : t("loginSuhi.id_label", "SUHI Id")}{" "}
                            <span className="text-[#ff0000cc] font-['Noto_Sans'] absolute">*</span>
                        </div>
                        <div className="relative min-h-[50px] text-3xl flex items-center">
                            <input
                                type="text"
                                value={step === "NAME" ? nameInput : suhiIdInput}
                                autoCapitalize={step === "NAME" ? "words" : "characters"}
                                readOnly
                                placeholder={
                                    step === "NAME"
                                        ? t("identifyStudent.name_placeholder", "Enter your full name")
                                        : "e.g. SUHI_210S0A..."
                                }
                                className="w-full bg-transparent border-none outline-none text-white caret-transparent placeholder:text-white/25 placeholder:text-2xl"
                                onFocus={() => {
                                    setKeyboardVisible(true)
                                    setError("")
                                }}
                                onClick={() => {
                                    setKeyboardVisible(true)
                                    setError("")
                                }}
                            />
                        </div>
                        <div className="border-t-2 border-white w-full mt-2" />

                        {/* Error message */}
                        {error && (
                            <p className="text-red-400 text-sm mt-3 text-center animate-pulse">
                                {error}
                            </p>
                        )}

                        {/* Disambiguation hint */}
                        {step === "SUHI_ID" && duplicateCandidates.length > 0 && !error && (
                            <p className="text-white/60 text-sm mt-3 text-center">
                                {t(
                                    "identifyStudent.multiple_found",
                                    `${duplicateCandidates.length} students found with this name. Please enter your SUHI Id.`
                                )}
                            </p>
                        )}

                        {/* Navigation / Fallback Links */}
                        <div className="mt-4 text-center">
                            {step === "SUHI_ID" ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep("NAME")
                                        setError("")
                                        setSuhiIdInput("")
                                    }}
                                    className="text-white/60 text-sm underline hover:text-white transition-colors"
                                >
                                    {t("identifyStudent.back_to_name", "← Back to Name")}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => navigate("/login-suhi")}
                                    className="text-white/60 text-sm underline hover:text-white transition-colors"
                                >
                                    {t("identifyStudent.use_suhi_id", "Log in using SUHI Id instead")}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Next / Confirm Button */}
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
                            {t("loginSuhi.verifying", "Verifying...")}
                        </span>
                    ) : step === "NAME" ? (
                        t("common.next", "Next")
                    ) : (
                        t("common.confirm", "Confirm")
                    )}
                </BlueGradientButton>
            </div>

            {/* Virtual Keyboard */}
            {keyboardVisible && (
                <KeyboardContainer
                    onKeyPress={(k) => {
                        setError("")
                        if (step === "NAME") {
                            setNameInput((v) => v + k)
                        } else {
                            setSuhiIdInput((v) => v + k)
                        }
                    }}
                    onBackspace={() => {
                        setError("")
                        if (step === "NAME") {
                            setNameInput((v) => v.slice(0, -1))
                        } else {
                            setSuhiIdInput((v) => v.slice(0, -1))
                        }
                    }}
                    onSubmit={() => {
                        setKeyboardVisible(false)
                        handleNext()
                    }}
                    onClose={() => setKeyboardVisible(false)}
                />
            )}

            {/* Error Alert */}
            <ErrorAlert
                visible={showErrorAlert}
                title={t("loginSuhi.login_failed", "Verification Failed")}
                description={error}
                onRetry={() => {
                    setShowErrorAlert(false)
                }}
                onClose={() => {
                    setShowErrorAlert(false)
                    retryRef.current = 0
                }}
            />
        </>
    )
}

export default IdentifyStudent
