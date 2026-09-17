import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { useDispatch, useSelector } from "react-redux"
import { setUser } from "../features/common/commonSlice"
import LoginComponent from "./ui/LoginComponent"
import BlueGradientButton from "./ui/BlueGradientButton"
import KeyboardContainer from "./ui/KeyboardContainer"
import { useTranslation } from "react-i18next"
import { useKioskAudio } from "../hooks/useKioskAudio"

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

    // Guard: if neither candidates nor user exist, return to welcome
    useEffect(() => {
        if ((!candidates || candidates.length === 0) && !user?.data) {
            navigate("/welcome")
        }
    }, [candidates, user, navigate])

    const currentValue = step === "NAME" ? nameInput : suhiIdInput
    const isButtonDisabled = !currentValue.trim() || loading

    // Merge matched_student (user.data) and candidates array to form complete searchable candidate list
    const getAllCandidates = () => {
        const list = [...candidates]
        if (user?.data) {
            const exists = list.some(
                (c) =>
                    (c.user_id && c.user_id === user.data.user_id) ||
                    (c.suhi_id && c.suhi_id === user.data.suhi_id)
            )
            if (!exists && (user.data.student_name || user.data.name || user.data.suhi_id)) {
                list.unshift(user.data)
            }
        }
        return list
    }

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
        const allCandidates = getAllCandidates()

        // 1. Exact match on student_name or name
        let matches = allCandidates.filter((c) => {
            const cName = (c.student_name || c.name || "").trim().toLowerCase()
            return cName === normalizedQuery
        })

        // 2. Fallback to partial / contains match
        if (matches.length === 0) {
            matches = allCandidates.filter((c) => {
                const cName = (c.student_name || c.name || "").trim().toLowerCase()
                return cName && (cName.includes(normalizedQuery) || normalizedQuery.includes(cName))
            })
        }

        if (matches.length === 1) {
            // Exactly 1 match found in matched student or candidate array!
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

        // Not present in candidate array or matched student -> check for SUHI ID
        setDuplicateCandidates([])
        setStep("SUHI_ID")
        setSuhiIdInput("")
        setKeyboardVisible(false)
        setError("")
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
        const pool = duplicateCandidates.length > 0 ? duplicateCandidates : getAllCandidates()

        const matched = pool.find((c) => {
            const cId = (c.suhi_id || "").trim().toLowerCase()
            return cId === normalizedId
        })

        if (matched) {
            // Found in matched student or candidate array!
            confirmStudent(matched)
            setLoading(false)
            return
        }

        // Still not present in matched student or candidate array -> redirect to welcome page
        playAudio("errors/let_try_suhi_id")
        setError(
            t(
                "identifyStudent.student_not_found_redirect",
                "Profile not found in detected faces. Redirecting to start..."
            )
        )
        setTimeout(() => {
            navigate("/welcome")
        }, 1500)
        setLoading(false)
    }

    const handleNext = () => {
        if (isButtonDisabled) return
        if (step === "NAME") {
            handleNameSubmit()
        } else {
            handleSuhiIdSubmit()
        }
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

            <LoginComponent />

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

                        {/* Step 2 Hints */}
                        {step === "SUHI_ID" && !error && (
                            <p className="text-white/60 text-sm mt-3 text-center">
                                {duplicateCandidates.length > 0
                                    ? t(
                                          "identifyStudent.multiple_found",
                                          `${duplicateCandidates.length} students found with this name. Please enter your SUHI Id.`
                                      )
                                    : t(
                                          "identifyStudent.not_found_hint",
                                          "Name not found in detected students. Please enter your SUHI Id."
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
                                    onClick={() => {
                                        setStep("SUHI_ID")
                                        setError("")
                                        setDuplicateCandidates([])
                                    }}
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
        </>
    )
}

export default IdentifyStudent
