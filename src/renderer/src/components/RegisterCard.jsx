import React, { useEffect, useState } from "react"
import lightbg from "../assets/lightbg.png"
import lightblub from "../assets/lightblub.png"
import projector from "../assets/projector.png"
import frame1 from "../assets/verfied-frame.svg"
import profilepic from "../assets/profile-pic.png"
import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { useDispatch, useSelector } from "react-redux"
import { setUser } from "../features/common/commonSlice"
import { getAudioForCurrentLanguage } from "../utils/audioUtils"
import { getNextRoute, resolvePostStageRoute } from "../utils/stageRouter"
import KeyboardContainer from "./ui/KeyboardContainer"

const buildProfileImage = (imagePath) => {
    if (!imagePath) return profilepic

    if (imagePath.includes(".user_images")) {
        const parts = imagePath.split("/")
        const userId = parts[parts.length - 2]

        return `http://127.0.0.1:5174/user_images/${userId}/latest.jpg`
    }

    if (imagePath.includes(".images")) {
        const folderName = imagePath.substring(imagePath.lastIndexOf("/") + 1)

        return `http://127.0.0.1:5174/images/${folderName}/original.jpg`
    }

    return profilepic
}
export default function RegisterCard() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { t } = useTranslation()

    const user = useSelector((state) => state.common.user)
    const screening = useSelector((state) => state.common.screening)
    const candidates = useSelector((state) => state.common.candidates) || []

    const nextStage = screening?.nextStage || null
    const pendingStages = screening?.pendingStages || []
    const isPendingTransition = screening?.isPendingTransition || false
    console.log("screening:", screening, "nextStage:", nextStage, "isPendingTransition:", isPendingTransition)

    // Check if multi-face / multiple matches detected
    const isMultifaceDetected = Boolean(
        user?.data?.multiface_detected ||
        user?.data?.multiple_matches ||
        user?.multiface_detected ||
        user?.multiple_matches ||
        (candidates && candidates.length > 1)
    )

    const [isConfirmed, setIsConfirmed] = useState(!isMultifaceDetected)
    const [verificationStep, setVerificationStep] = useState("NAME") // "NAME" | "SUHI_ID"
    const [nameInput, setNameInput] = useState("")
    const [suhiIdInput, setSuhiIdInput] = useState("")
    const [duplicateCandidates, setDuplicateCandidates] = useState([])
    const [error, setError] = useState("")
    const [keyboardVisible, setKeyboardVisible] = useState(false)

    // API may return either `photo_url` (face-scan flow) or `image_path` (SUHI-ID flow)
    const imagePath = user?.data?.photo_url || user?.data?.image_path || ""

    // safer extraction
    const folderName = imagePath.substring(imagePath.lastIndexOf("/") + 1)

    console.log("imagePath:", imagePath)
    console.log("folderName:", folderName)

    const [isAudioPlaying, setIsAudioPlaying] = useState(false)
    const audioRef = React.useRef(null)

    const profileImageSrc = buildProfileImage(imagePath)

    console.log("profileImageSrc:", profileImageSrc)
    useEffect(() => {
        // Play audio only when user identity is confirmed
        if (isConfirmed) {
            playAudio()
        }
    }, [isConfirmed])

    const playAudio = async () => {
        const audioPath = await getAudioForCurrentLanguage("confirm_user")
        if (audioPath && audioRef.current) {
            audioRef.current.src = audioPath
            setIsAudioPlaying(true)
            audioRef.current.play().catch((err) => {
                console.log("Audio playback failed:", err)
                setIsAudioPlaying(false)
            })
        } else if (!audioPath) {
            console.log("No audio for confirm_user in current language")
        }
    }
    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
            setIsAudioPlaying(false)
        }
    }

    const handleAudioEnd = () => {
        setIsAudioPlaying(false)
    }

    console.log("users", user, screening, nextStage)

    const studentName = user?.data?.name || user?.data?.student_name || "Student"
    const studentAge = user?.data?.age || "15"
    const studentClass = user?.data?.class_section || user?.class_section || "II-A"

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
        setIsConfirmed(true)
    }

    const handleNameSubmit = () => {
        const query = nameInput.trim()
        if (!query) {
            setError("Please enter your full name")
            return
        }

        const normalizedQuery = query.toLowerCase()

        // 1. Exact match on name or student_name
        let matches = candidates.filter((c) => {
            const cName = (c.name || c.student_name || "").trim().toLowerCase()
            return cName === normalizedQuery
        })

        // 2. If no exact match, fallback to partial/contains match
        if (matches.length === 0) {
            matches = candidates.filter((c) => {
                const cName = (c.name || c.student_name || "").trim().toLowerCase()
                return cName.includes(normalizedQuery) || normalizedQuery.includes(cName)
            })
        }

        if (matches.length === 1) {
            // Exactly 1 match found! Confirm student
            confirmStudent(matches[0])
        } else if (matches.length > 1) {
            // Multiple candidates share the same name!
            // Ask for SUHI ID to disambiguate
            setDuplicateCandidates(matches)
            setVerificationStep("SUHI_ID")
            setKeyboardVisible(false)
            setError("")
        } else {
            // If candidates array is empty, check against single student in store
            const currentStoreName = (user?.data?.name || user?.data?.student_name || "").trim().toLowerCase()
            if (currentStoreName && (currentStoreName === normalizedQuery || currentStoreName.includes(normalizedQuery))) {
                confirmStudent(user.data)
                return
            }
            setError("No matching profile found. Please check spelling or try again.")
        }
    }

    const handleSuhiIdSubmit = () => {
        const query = suhiIdInput.trim()
        if (!query) {
            setError("Please enter your SUHI ID")
            return
        }

        const normalizedId = query.toLowerCase()
        const pool = duplicateCandidates.length > 0 ? duplicateCandidates : candidates

        const matched = pool.find((c) => {
            const cId = (c.suhi_id || "").trim().toLowerCase()
            return cId === normalizedId
        })

        if (matched) {
            confirmStudent(matched)
        } else {
            setError("SUHI ID not found among matched profiles. Please check and try again.")
        }
    }

    // Physical keyboard listener for name & SUHI ID entry
    useEffect(() => {
        if (isConfirmed) return

        const handleKeyDown = (e) => {
            if (e.ctrlKey || e.altKey || e.metaKey) return

            if (e.key === "Backspace") {
                setError("")
                if (verificationStep === "NAME") {
                    setNameInput((prev) => prev.slice(0, -1))
                } else {
                    setSuhiIdInput((prev) => prev.slice(0, -1))
                }
            } else if (e.key === "Enter") {
                if (verificationStep === "NAME") {
                    handleNameSubmit()
                } else {
                    handleSuhiIdSubmit()
                }
            } else if (e.key.length === 1) {
                setError("")
                if (verificationStep === "NAME") {
                    setNameInput((prev) => prev + e.key)
                } else {
                    setSuhiIdInput((prev) => prev + e.key)
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [isConfirmed, verificationStep, nameInput, suhiIdInput, duplicateCandidates, candidates])

    const handleLetsGo = () => {
        stopAudio()
        if (isPendingTransition || (nextStage === null && pendingStages.length === 0)) {
            console.log("[RegisterCard] screening complete — navigating to result page")
            navigate("/bia/result")
            return
        }
        const nextRoute = getNextRoute(nextStage, "/bia/leg50")
        console.log("[RegisterCard] navigating to next stage:", nextRoute)
        navigate(nextRoute)
    }

    const handleNotYou = () => {
        stopAudio()
        navigate("/login-suhi")
    }

    return (
        <div className="w-screen h-screen bg-black flex items-center justify-center">
            <audio ref={audioRef} onEnded={handleAudioEnd} onPlay={() => setIsAudioPlaying(true)} />

            {/* Outer card — sized to match the frame SVG exactly */}
            <div className="relative w-[1000px] h-[1500px]">
                {/* ── Layer 0: background texture ── */}
                <div
                    className="absolute inset-0 bg-cover bg-center rounded-[40px]"
                    style={{ backgroundImage: `url(${lightbg})` }}
                />

                {/* ── Layer 1: SVG frame fills the card exactly ── */}
                <img
                    src={frame1}
                    alt="frame"
                    className="absolute inset-0 z-0 pointer-events-none"
                />

                {/* ── Layer 2: Content ── */}
                {!isConfirmed ? (
                    /* ── MULTI-FACE IDENTITY VERIFICATION STEP ── */
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-10 px-16 bg-black/20 font-anta">
                        {/* Badge / Heading */}
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="px-6 py-2 rounded-full border border-[#0097D6]/60 bg-[#0048C1]/20 text-[#cff1ff] text-[26px] tracking-wider uppercase">
                                {verificationStep === "NAME" ? "Identity Verification" : "Disambiguation Required"}
                            </div>
                            <h1 className="text-[54px] text-center leading-tight tracking-[-1px] text-[rgba(255,255,255,0.95)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
                                {verificationStep === "NAME"
                                    ? "Enter Your Full Name"
                                    : "Enter Your SUHI ID"}
                            </h1>
                            <p className="text-[30px] text-center leading-snug text-white/75 max-w-[760px]">
                                {verificationStep === "NAME"
                                    ? "Multiple profiles detected. Please enter your full name to verify."
                                    : `Multiple students found with the name "${nameInput}". Please enter your SUHI ID.`}
                            </p>
                        </div>

                        {/* Interactive Input Container */}
                        <div className="w-[740px] bg-[#030604]/85 border-2 border-[#006893] rounded-[36px] p-8 flex flex-col items-center gap-6 shadow-[0_0_40px_rgba(0,104,147,0.35)]">
                            {/* Step indicators */}
                            <div className="flex items-center gap-3">
                                <div className={`h-2 rounded-full transition-all duration-300 ${verificationStep === "NAME" ? "bg-[#0097D6] w-12" : "bg-[#0097D6] w-8"}`} />
                                <div className={`h-2 rounded-full transition-all duration-300 ${verificationStep === "SUHI_ID" ? "bg-[#0097D6] w-12" : "bg-white/20 w-8"}`} />
                            </div>

                            {/* Clickable Display Input */}
                            <div
                                onClick={() => setKeyboardVisible(true)}
                                className="w-full min-h-[90px] px-8 py-4 rounded-[22px] bg-white/5 border-2 border-[#0097D6]/50 hover:border-[#0097D6] flex items-center justify-between cursor-pointer transition-colors"
                            >
                                <span className="text-[40px] text-white tracking-wide overflow-hidden text-ellipsis whitespace-nowrap">
                                    {(verificationStep === "NAME" ? nameInput : suhiIdInput) || (
                                        <span className="text-white/30 text-[32px]">
                                            {verificationStep === "NAME"
                                                ? "Tap here or type full name..."
                                                : "e.g. SUHI_210S0A..."}
                                        </span>
                                    )}
                                </span>
                                <span className="text-[22px] text-[#0097D6] bg-[#002EB9]/30 px-4 py-1.5 rounded-lg border border-[#0097D6]/40 whitespace-nowrap">
                                    ⌨ Keyboard
                                </span>
                            </div>

                            {/* Error Alert */}
                            {error && (
                                <div className="text-[#ff6b6b] text-[24px] text-center px-5 py-2.5 bg-red-950/50 border border-red-700/60 rounded-xl animate-pulse">
                                    {error}
                                </div>
                            )}

                            {/* Duplicate count hint */}
                            {verificationStep === "SUHI_ID" && duplicateCandidates.length > 0 && (
                                <div className="text-white/50 text-[24px]">
                                    {duplicateCandidates.length} students found with this name
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col items-center gap-6 mt-4">
                            <button
                                onClick={verificationStep === "NAME" ? handleNameSubmit : handleSuhiIdSubmit}
                                className="
                                    relative w-[480px] h-[96px]
                                    flex items-center justify-center
                                    rounded-[28px] border-[3px] border-white
                                    text-white text-[44px] tracking-[-0.6px]
                                    active:scale-[0.98] transition-transform duration-200
                                    overflow-hidden
                                "
                            >
                                <span
                                    className="absolute inset-0 rounded-[inherit]"
                                    style={{
                                        background:
                                            "radial-gradient(ellipse at 50% 50%, #002EB9 0%, #0048C1 25%, #0062C8 50%, #0097D6 100%)"
                                    }}
                                />
                                <span
                                    className="absolute inset-0 rounded-[inherit]"
                                    style={{
                                        boxShadow:
                                            "inset 0 0 21px white, inset 0 -72px 96px rgba(255,255,255,0.24), inset 0 24px 36px -48px rgba(255,255,255,0.24)"
                                    }}
                                />
                                <span className="relative">
                                    {verificationStep === "NAME" ? "Next" : "Confirm"}
                                </span>
                            </button>

                            {/* Navigation links */}
                            <div className="flex items-center gap-8">
                                {verificationStep === "SUHI_ID" && (
                                    <button
                                        onClick={() => {
                                            setVerificationStep("NAME")
                                            setError("")
                                        }}
                                        className="text-white/80 text-[32px] underline underline-offset-4 hover:text-white"
                                    >
                                        ← Back to Name
                                    </button>
                                )}

                                <button
                                    onClick={handleNotYou}
                                    className="text-white/80 text-[32px] underline underline-offset-4 hover:text-white"
                                >
                                    {t("common.not_me")}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── VERIFIED USER CONFIRMATION CARD ── */
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-12 px-16 bg-black/20 ">
                        {/* Greeting */}
                        <div className="text-center flex flex-col gap-3">
                            <h1 className="text-[62px] leading-tight tracking-[-1.5px] text-[rgba(255,255,255,0.87)] font-anta">
                                {t("common.hi")}, {studentName}
                            </h1>
                            <p className="text-[40px] leading-[1.3] tracking-[-0.25px] text-[rgba(255,255,255,0.87)] font-anta">
                                {t("profile.welcome_suhi")}
                                <br />
                                {t("profile.let_start_your_journey")}
                            </p>
                        </div>

                        {/* Profile photo — double-bordered sci-fi frame */}
                        <div className="bg-[#030604] border border-[#606060] rounded-[48px] p-3">
                            <div className="border border-[#006893] rounded-[40px] p-3">
                                <div className="w-[330px] h-[440px] rounded-[28px] overflow-hidden">
                                    <img
                                        src={profileImageSrc}
                                        onError={(e) => {
                                            e.currentTarget.src = profilepic
                                        }}
                                        alt="profile"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Class & Id */}
                        <div
                            className="flex flex-col items-center gap-4 text-[35px]"
                            style={{ fontFamily: "'Anta', sans-serif" }}
                        >
                            {studentAge && (
                                <div className="flex items-baseline gap-3">
                                    <span className="text-[#cff1ff]">{t("profile.age")}-</span>
                                    <span className="text-white drop-shadow-[0_4px_4px_black]">
                                        {studentAge}
                                    </span>
                                </div>
                            )}
                            {studentClass && (
                                <div className="flex items-baseline gap-3">
                                    <span className="text-[#cff1ff]">{t("profile.class")}-</span>
                                    <span className="text-white drop-shadow-[0_4px_4px_black]">
                                        {studentClass}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Let's Go button */}
                        <button
                            onClick={handleLetsGo}
                            className="
                relative w-[480px] h-[100px]
                flex items-center justify-center
                rounded-[28px] border-[3px] border-white
                text-white text-[48px] tracking-[-0.6px]
                active:scale-[0.98] transition-transform duration-200
                overflow-hidden
              "
                            style={{ fontFamily: "'Anta', sans-serif" }}
                        >
                            <span
                                className="absolute inset-0 rounded-[inherit]"
                                style={{
                                    background:
                                        "radial-gradient(ellipse at 50% 50%, #002EB9 0%, #0048C1 25%, #0062C8 50%, #0097D6 100%)"
                                }}
                            />
                            <span
                                className="absolute inset-0 rounded-[inherit]"
                                style={{
                                    boxShadow:
                                        "inset 0 0 21px white, inset 0 -72px 96px rgba(255,255,255,0.24), inset 0 24px 36px -48px rgba(255,255,255,0.24)"
                                }}
                            />
                            <span className="relative">{t("common.let_go")}</span>
                        </button>

                        {/* Not you? */}
                        <button
                            onClick={handleNotYou}
                            className="text-white text-[40px] underline pt-28 underline-offset-4 active:opacity-70 transition-opacity"
                            style={{ fontFamily: "'Anta', sans-serif" }}
                        >
                            {t("common.not_me")}
                        </button>
                    </div>
                )}
            </div>

            {/* Virtual on-screen touch keyboard */}
            {keyboardVisible && !isConfirmed && (
                <KeyboardContainer
                    onKeyPress={(k) => {
                        setError("")
                        if (verificationStep === "NAME") {
                            setNameInput((v) => v + k)
                        } else {
                            setSuhiIdInput((v) => v + k)
                        }
                    }}
                    onBackspace={() => {
                        setError("")
                        if (verificationStep === "NAME") {
                            setNameInput((v) => v.slice(0, -1))
                        } else {
                            setSuhiIdInput((v) => v.slice(0, -1))
                        }
                    }}
                    onSubmit={() => {
                        setKeyboardVisible(false)
                        if (verificationStep === "NAME") {
                            handleNameSubmit()
                        } else {
                            handleSuhiIdSubmit()
                        }
                    }}
                    onClose={() => setKeyboardVisible(false)}
                />
            )}

            {/* Projector decoration — outside the card */}
            <div className="absolute bottom-[3rem] w-[770px] left-[33rem] -translate-x-1/2">
                <img
                    src={projector}
                    alt="projector"
                    className="drop-shadow-[0_0_40px_rgba(0,200,255,0.8)]"
                />
            </div>
        </div>
    )
}

// {
//   "success": true,
//   "data": {
//     "buffer_id": "60f3ed9e-2c21-43d1-8363-9a08d9186baa",
//     "status": "COMPLETED",
//     "student_status": "REGISTERED",
//     "user_id": "a158d845-5c4e-42f1-bff5-1c6e66fa2746",
//     "face_id": "f2107488-5f4a-4095-a5f5-d2a7a4bcbb15",
//     "student_name": "Ayaan Bajaj",
//     "gender": "FEMALE",
//     "age": 7,
//     "video_path": null,
//     "image_path": "/var/lib/suhi/.images/a158d845-5c4e-42f1-bff5-1c6e66fa2746_20260512_052503_aabbcc44",
//     "frames_processed": 1,
//     "elapsed_seconds": 1.434
//   },
//   "error": null,
//    "suhi_id":null,
//    "class_section":"II-A"
//   "screening": {
//     "session_id": "4928fe65-3973-4738-8820-8d2e19e2837f",
//     "is_resumed": true,
//     "resume_count": 1,
//     "next_stage": {
//       "stage_key": "bia",
//       "display_name": "BIA",
//       "stage_order": 2
//     },
//     "completed_stages": [
//       "login"
//     ]
//   }
// }
