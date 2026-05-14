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

  const profileImageSrc =
    folderName && folderName.length > 0
      ? `http://127.0.0.1:5174/images/${folderName}/original.jpg`
      : profilepic

  console.log("profileImageSrc:", profileImageSrc)
  useEffect(() => {
    // Play audio when component mounts
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
  const handleYesClick = () => {
    stopAudio()
    
    // Map backend stage keys to frontend routes
    const stageRouteMap = {
      login: '/verified',
      bia: '/bia/:screenType',
      voice_analysis: '/voice',
      color_blindness: '/colorblindness',
      divide_attention: '/space-convoy-main',
       result: '/bia/result',
    }

    if (screening?.isResumed && screening?.nextStage) {
      const nextRoute = stageRouteMap[screening.nextStage.stage_key];
      console.log("Resuming screening, next stage:", screening.nextStage.stage_key, "navigating to:", nextRoute)
     navigate(nextRoute || "/bia/wh")
    } else {
    navigate("/bia/wh")
    }
  }

  const handleNoClick = () => {
    stopAudio()
    navigate("/")
  }

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center">
      <audio ref={audioRef} onEnded={handleAudioEnd} onPlay={() => setIsAudioPlaying(true)}>
        Your browser does not support the audio element.
      </audio>
      {/* Card Wrapper */}
      <div
        className="relative w-[900px] h-[1400px] bg-cover bg-center"
        style={{ backgroundImage: `url(${lightbg})` }}
      >
        <div
          className="
          absolute top-[60px]
          left-1/2 -translate-x-1/2
          z-20
        "
        >
          <img src={frame1} alt="dmt background" className="w-[850px] max-w-none h-auto" />
        </div>

        <div
          className="flex flex-col items-center gap-10 absolute top-[140px]
          left-1/2 -translate-x-1/2
          z-30 "
        >
          {/* profile pic */}

          {/* <div className="max-w-full h-auto">
            <img
              src={profilepic}
              alt=" profile pic"
              className="w-full portrait:max-w-105 landscape:max-w-60 h-auto"
            />
          </div> */}

          <img
            src={profileImageSrc}
            onError={(e) => {
              e.currentTarget.src = profilepic
            }}
            alt="profile pic"
            className="w-full portrait:max-w-96 h-auto object-cover rounded-3xl"
          />

          {/* text */}

          <div className="info max-w-full mt-8">
            <p className="text-[28px] flex flex-col items-center text-center tracking-wider gap-y-3 text-white text-nowrap">
              <span>
                {t("profile.name")} - {user?.data?.student_name}{" "}
              </span>
              {user?.data?.class && <span> {t("profile.class")}- 8th A</span>}
              {user?.data?.age && (
                <span>
                  {t("profile.age")} -{" "}
                  {user?.data?.student_name.includes("Mukul") ? 26 : user?.data?.age} years
                </span>
              )}
              {user?.data?.contact_number && <span>{t("profile.number")} - 0987654321</span>}
            </p>
          </div>

          <div className="buttons mt-5">
            <button
              onClick={handleYesClick}
              style={{
                borderImageSource:
                  "radial-gradient(50% 50% at 50% 50%, #FFFFFF 0%, rgba(255,255,255,0) 100%)",
                borderImageSlice: 1
              }}
              className="
w-[320px] h-[100px]
flex items-center justify-center
text-center
rounded-[25px]
 border-white
[border-image-source:radial-gradient(50%_50%_at_50%_50%,#ffffff_0%,rgba(255,255,255,0)_100%)]
[border-image-slice:1]
bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)]
shadow-[inset_0px_33.5px_50px_-67px_rgba(255,255,255,0.24),inset_0px_-100.5px_134px_0px_rgba(255,255,255,0.24),inset_0px_0px_30px_0px_#ffffff]
text-white text-3xl tracking-wide
active:scale-[0.98]
transition-transform duration-300 ease-in-out

  "
            >
              {t("common.yes_me")}
            </button>

            <button
              onClick={handleNoClick}
              className="
          
w-[320px] h-[100px]
mt-8
flex items-center justify-center
text-center
rounded-[30px]
 border-white
 
[border-image-source:radial-gradient(50%_50%_at_50%_50%,#ffffff_0%,rgba(255,255,255,0)_100%)]
[border-image-slice:1]
shadow-[0px_5px_40px_0px_#9AD9FF]

text-white text-3xl tracking-wide
active:scale-[0.98]

transition-transform duration-300 ease-in-out
          "
            >
              {t("common.not_me")}
            </button>
          </div>
        </div>
      </div>
      <div className="absolute bottom-[9rem] w-[770px] left-[30rem]  -translate-x-1/2">
        <img
          src={projector}
          alt="projector"
          className=" drop-shadow-[0_0_40px_rgba(0,200,255,0.8)]"
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
