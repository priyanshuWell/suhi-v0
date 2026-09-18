import React, { useEffect, useState } from "react"
import lightbg from "../assets/lightbg.png"
import projector from "../assets/projector.png"
import frame1 from "../assets/verfied-frame.svg"
import profilepic from "../assets/profile-pic.png"
import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { useSelector } from "react-redux"
import { getAudioForCurrentLanguage } from "../constants/audio"
import { getNextRoute } from "../utils/stageRouter"

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
    const navigate = useNavigate()
    const { t } = useTranslation()

    const user = useSelector((state) => state.common.user)
    const screening = useSelector((state) => state.common.screening)
    const candidates = useSelector((state) => state.common.candidates) || []

    const nextStage = screening?.nextStage || null
    const pendingStages = screening?.pendingStages || []
    const isPendingTransition = screening?.isPendingTransition || false

    // API may return either `photo_url` (face-scan flow) or `image_path` (SUHI-ID flow)
    const imagePath = user?.data?.photo_url || user?.data?.image_path || ""

    const [isAudioPlaying, setIsAudioPlaying] = useState(false)
    const audioRef = React.useRef(null)

    const profileImageSrc = buildProfileImage(imagePath)

    useEffect(() => {
        playAudio()
    }, [])

    const playAudio = async () => {
        const audioPath = await getAudioForCurrentLanguage("confirm_user")
        if (audioPath && audioRef.current) {
            audioRef.current.src = audioPath
            setIsAudioPlaying(true)
            audioRef.current.play().catch((err) => {
                console.log("Audio playback failed:", err)
                setIsAudioPlaying(false)
            })
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

    const studentName = user?.data?.name || user?.data?.student_name || "Student"
    const studentAge = user?.data?.age || "15"
    const studentClass = user?.data?.class_section || user?.class_section || "II-A"

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

                {/* ── Layer 2: All content — centered inside the frame ── */}
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-12 px-16 bg-black/20">
                    {/* Greeting */}
                    <div className="text-center flex flex-col gap-3 mt-12">
                        <h1 className="text-[62px] leading-tight tracking-[-1.5px] text-[rgba(255,255,255,0.87)] font-anta">
                            {t("common.hi")}, {studentName}
                        </h1>
                        <p className="text-[35px] leading-[1.3] tracking-[-0.25px] text-[rgba(255,255,255,0.87)] font-anta">
                            {t("profile.welcome_suhi")}
                            <br />
                            <span className="text-[30px]"> {t("profile.let_start_your_journey")}</span>
                        </p>
                        <p className="text-[20px] w-3/4 leading-relaxed tracking-normal text-white/70 font-anta max-w-[750px] mx-auto mt-1">
                            {t(
                                "profile.wellness_agreement",
                                "By tapping Start, you agree to today's wellness check. You can stop anytime by stepping away"
                            )}
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
            </div>

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
