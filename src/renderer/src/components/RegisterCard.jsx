import React, { useEffect, useState } from "react"
import lightbg from "../assets/lightbg.png"
import lightblub from "../assets/lightblub.png"
import projector from "../assets/projector.png"
import frame1 from "../assets/verfied-frame.svg"
import profilepic from "../assets/profile-pic.png"
import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { useSelector } from "react-redux"
import { getAudioForCurrentLanguage } from "../utils/audioUtils"
import { getNextRoute } from "../utils/stageRouter"
import { IMAGE_SERVER_URL } from "../utils/config"


const buildProfileImage = (imagePath) => {
  if (!imagePath) return profilepic

  if (imagePath.includes(".user_images")) {
    const parts = imagePath.split("/")
    const userId = parts[parts.length - 2]

    return `${IMAGE_SERVER_URL}/user_images/${userId}/latest.jpg`  //  from config
  }

  if (imagePath.includes(".images")) {
    const folderName =
      imagePath.substring(
        imagePath.lastIndexOf("/") + 1
      )

    return `${IMAGE_SERVER_URL}/images/${folderName}/original.jpg`  //  from config
  }

  return profilepic
}
export default function RegisterCard() {
  const user = useSelector((state) => state.common.user)
  const screening = useSelector((state) => state.common.screening)

  const imagePath = user?.data?.image_path || ""

  // safer extraction
  const folderName = imagePath.substring(imagePath.lastIndexOf("/") + 1)

  console.log("imagePath:", imagePath)
  console.log("folderName:", folderName)

  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const audioRef = React.useRef(null)

  const profileImageSrc = buildProfileImage(user?.data?.image_path)

  console.log("profileImageSrc:", profileImageSrc)
  useEffect(() => {
    // Play audio when component mounts
    playAudio();
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

  console.log("users", user)
  const navigate = useNavigate()
  const { t } = useTranslation()



  const studentName = user?.data?.student_name || "Student" || user?.data?.name
  const studentAge = user?.data?.age || "15"
  const studentClass = user?.class_section || "II-A"
  // console.log("gender", user?.data?.gender, user?.data?.gender.toLowerCase())
  const handleLetsGo = () => {
    stopAudio()
    // Use the next_stage from the backend (stored in Redux during login)
    const nextRoute = getNextRoute(screening?.nextStage, '/bia/leg50')
    console.log('[RegisterCard] navigating to next stage:', nextRoute)
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
          className="absolute inset-0    z-0 pointer-events-none "
        />

        {/* ── Layer 2: All content — centered inside the frame ── */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-12 px-16 bg-black/20 ">

          {/* Greeting */}
          <div className="text-center flex flex-col gap-3">
            <h1
              className="text-[62px] leading-tight tracking-[-1.5px] text-[rgba(255,255,255,0.87)] font-anta"
            >
              {t("common.hi")}  ,{studentName}
            </h1>
            <p
              className="text-[40px] leading-[1.3] tracking-[-0.25px] text-[rgba(255,255,255,0.87)] font-anta"
            >
              {t("profile.welcome_suhi")}<br />{t("profile.let_start_your_journey")}
            </p>
          </div>

          {/* Profile photo — double-bordered sci-fi frame */}
          <div className="bg-[#030604] border border-[#606060] rounded-[48px] p-3">
            <div className="border border-[#006893] rounded-[40px] p-3">
              <div className="w-[330px] h-[440px] rounded-[28px] overflow-hidden">
                <img
                  src={profileImageSrc}
                  onError={(e) => { e.currentTarget.src = profilepic }}
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
                <span className="text-white drop-shadow-[0_4px_4px_black]">{studentAge}</span>
              </div>
            )}
            {studentClass && (
              <div className="flex items-baseline gap-3">
                <span className="text-[#cff1ff]">{t("profile.class")}-</span>
                <span className="text-white drop-shadow-[0_4px_4px_black]">{studentClass}</span>
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
                  "radial-gradient(ellipse at 50% 50%, #002EB9 0%, #0048C1 25%, #0062C8 50%, #0097D6 100%)",
              }}
            />
            <span
              className="absolute inset-0 rounded-[inherit]"
              style={{
                boxShadow:
                  "inset 0 0 21px white, inset 0 -72px 96px rgba(255,255,255,0.24), inset 0 24px 36px -48px rgba(255,255,255,0.24)",
              }}
            />
            <span className="relative">{t("common.let_go")}</span>
          </button>

          {/* Not you? — no margin, gap handles spacing */}
          <button
            onClick={handleNotYou}
            className="text-white text-[40px] underline pt-28 underline-offset-4  active:opacity-70 transition-opacity"
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