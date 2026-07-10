import { motion } from "framer-motion"
import React, { useState, useEffect } from "react"
import bg from "../assets/background.png"
import video1 from "../assets/avatar.mp4"
import startFrame from "../assets/start_frame.svg"
import { useNavigate } from "react-router"
import { openCamerasInBackground } from "../utils/cameraSession"
import { Setting } from "./Setting"
import { useTranslation } from "react-i18next"
import StartButton from "./ui/BlueGradientButton"
import { getAudioForCurrentLanguage } from "../utils/audioUtils"
import CalibrationModal from "./bia/CalibrationModal"

const Flag = true
export const StartScreen = () => {
  const { t } = useTranslation()
  const [error, setError] = useState(false)
  const navigate = useNavigate()
  const [isActive, setIsActive] = useState(false)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const audioRef = React.useRef(null)

  // ── Calibration state ────────────────────────────────────────────────────
  const [calStatus, setCalStatus] = useState(null)        // null | calibration object
  const [showCalModal, setShowCalModal] = useState(false) // toggle CalibrationModal

  useEffect(() => {
    // Fetch calibration status from main process
    window.api?.getCalibrationStatus?.().then((cal) => {
      console.log('[StartScreen] Calibration status:', cal)
      setCalStatus(cal)
    }).catch((err) => {
      console.warn('[StartScreen] Could not fetch calibration status:', err)
    })
  }, [])

  const handleCalDone = (cal) => {
    setCalStatus(cal)
    setShowCalModal(false)
  }

  useEffect(() => {
    try {
      playAudio()
    } catch (error) {
      console.log(error)
    }
  }, [])

  const playAudio = async () => {
    const audioPath = await getAudioForCurrentLanguage("welcome_screen")
    console.log("audiopath", audioPath)
    if (audioPath && audioRef.current) {
      audioRef.current.src = audioPath
      setIsAudioPlaying(true)
      audioRef.current.play().catch((err) => {
        console.log("Audio playback failed:", err)
        setIsAudioPlaying(false)
      })
    } else if (!audioPath) {
      console.log("No audio for welcome_screen in current language")
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

  const handleStartClick = () => {
    stopAudio()
    navigate("/capture")
  }

  const isCalibrated = calStatus?.isCalibrated === true

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, ease: "easeOut" }}
      className="
        fixed inset-0
        w-screen h-screen
        overflow-hidden
        bg-black
      "
    >
      {/* Audio Element */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnd}
        onPlay={() => setIsAudioPlaying(true)}
        autoPlay
      >
        Your browser does not support the audio element.
      </audio>

      {/* ── Top-right controls: Settings + Calibration button ── */}
      <div className={`absolute top-0 right-0 z-[51] p-4 flex flex-col items-end gap-3`}>
        <Setting setIsActive={setIsActive} isActive={isActive} />
        {/* Calibration button — always visible */}
        <button
          id="calibrate-scale-btn"
          onClick={() => setShowCalModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 18px', borderRadius: '20px',
            background: isCalibrated
              ? 'rgba(0,201,122,0.12)'
              : 'rgba(255,140,0,0.15)',
            border: `1.5px solid ${isCalibrated ? 'rgba(0,201,122,0.4)' : 'rgba(255,140,0,0.5)'}`,
            color: isCalibrated ? '#00c97a' : '#ffb040',
            fontSize: '14px', fontFamily: "'Anta', sans-serif",
            cursor: 'pointer', transition: 'all 0.25s',
            boxShadow: isCalibrated
              ? '0 0 12px rgba(0,201,122,0.2)'
              : '0 0 16px rgba(255,140,0,0.25)',
            whiteSpace: 'nowrap',
          }}
        >
          {isCalibrated ? '✓ Scale Calibrated' : '⚠ Calibrate Scale'}
        </button>
      </div>

      {/* ── NOT CALIBRATED banner ── */}
      {calStatus !== null && !isCalibrated && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
            background: 'linear-gradient(90deg, rgba(255,100,0,0.85), rgba(255,60,0,0.7))',
            borderBottom: '1px solid rgba(255,140,0,0.4)',
            padding: '10px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            backdropFilter: 'blur(4px)',
            animation: 'none',
          }}
        >
          <span style={{ color: 'white', fontSize: '15px', fontFamily: "'Anta', sans-serif" }}>
            ⚠️ &nbsp; Scale is <strong>not calibrated</strong> — weight readings will be inaccurate until calibration is completed.
          </span>
          <button
            onClick={() => setShowCalModal(true)}
            style={{
              padding: '8px 20px', borderRadius: '16px',
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.4)',
              color: 'white', fontSize: '14px', cursor: 'pointer',
              fontFamily: "'Anta', sans-serif", whiteSpace: 'nowrap', marginLeft: '16px',
              transition: 'all 0.2s',
            }}
          >
            Calibrate Now
          </button>
        </div>
      )}

      {/* Background */}
      <div
        className="
          absolute inset-0
          bg-center bg-cover
          z-0
        "
        style={{ backgroundImage: `url(${bg})` }}
      />

      {/* Main Content Area */}
      <div className="relative z-50 w-full h-full flex flex-col items-center justify-between py-12 mt-[3rem]">
        {/* Placeholder or Header Space if needed */}
        <div className="h-0" />

        {/* Center: Video with Frame */}
        <div
          className="
            relative
            flex items-center justify-center
            w-full flex-1
          "
        >
          {/* Frame SVG */}
          <img
            src={startFrame}
            alt="frame"
            className="
            landscape:hidden
              absolute
              w-[clamp(600px,75vw,1073px)]
              h-auto
              pointer-events-none
              z-20
            "
          />

          {/* Video */}
          <video
            src={video1}
            autoPlay
            muted
            loop
            playsInline
            className="
              relative z-10
              w-[clamp(400px,70vw,800px)]
              h-auto
              max-h-[63vh]
              object-contain
              will-change-transform
            "
          />
        </div>

        {/* Bottom: Buttons */}
        <div
          className="
            flex flex-col items-center
            gap-[clamp(1rem,2vh,2rem)]
            z-20
            px-4
            w-full
            pb-[clamp(6rem,3vh,15rem)]
          "
        >
          <StartButton className="" width='w-[clamp(27rem,40vw,31.25rem)]' height='h-[clamp(7rem,8vh,6.25rem)]' onClick={handleStartClick}>{t("common.start")}</StartButton>

          <div
            className="
              w-[clamp(16rem,40vw,31.25rem)]
              h-[clamp(4rem,8vh,6.25rem)]
            "
          />
        </div>
      </div>

      {/* ── Calibration Modal ── */}
      {showCalModal && (
        <CalibrationModal
          onClose={() => setShowCalModal(false)}
          onDone={handleCalDone}
        />
      )}
    </motion.div>
  )
}
