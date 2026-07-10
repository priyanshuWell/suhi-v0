import { motion } from "framer-motion"
import React, { useState, useEffect } from "react"
import bg from "../assets/background.png"
import video1 from "../assets/avatar.mp4"
import startFrame from "../assets/start_frame.svg"
import { useNavigate } from "react-router"
import { Setting } from "./Setting"
import { useTranslation } from "react-i18next"
import StartButton from "./ui/BlueGradientButton"
import { getAudioForCurrentLanguage } from "../utils/audioUtils"
import CalibrationModal from "./bia/CalibrationModal"

/* ── Inline keyframes for the calibration warning overlay ── */
const CAL_WARN_STYLES = `
  @keyframes calWarnPulse {
    0%, 100% { box-shadow: 0 0 30px rgba(255,120,0,0.3), 0 0 60px rgba(255,80,0,0.15); }
    50%       { box-shadow: 0 0 60px rgba(255,120,0,0.7), 0 0 100px rgba(255,80,0,0.35); }
  }
  @keyframes calWarnIcon {
    0%, 100% { transform: scale(1); }
    50%       { transform: scale(1.12); }
  }
  @keyframes calWarnFadeIn {
    from { opacity: 0; transform: translate(-50%, -44%); }
    to   { opacity: 1; transform: translate(-50%, -50%); }
  }
  @keyframes calDotBlink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
`

export const StartScreen = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isActive, setIsActive] = useState(false)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const audioRef = React.useRef(null)

  // ── Calibration state ────────────────────────────────────────────────────
  const [calStatus, setCalStatus] = useState(null)        // null = loading, object = loaded
  const [showCalModal, setShowCalModal] = useState(false)

  useEffect(() => {
    window.api?.getCalibrationStatus?.().then((cal) => {
      console.log('[StartScreen] Calibration status:', cal)
      setCalStatus(cal)
    }).catch((err) => {
      console.warn('[StartScreen] Could not fetch calibration status:', err)
      // On fetch error, don't block the user
      setCalStatus({ isCalibrated: true })
    })
  }, [])

  const handleCalDone = (cal) => {
    setCalStatus(cal)
    setShowCalModal(false)
  }

  useEffect(() => {
    try { playAudio() } catch (e) { console.log(e) }
  }, [])

  const playAudio = async () => {
    const audioPath = await getAudioForCurrentLanguage("welcome_screen")
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

  const handleStartClick = () => {
    if (!isCalibrated) return
    stopAudio()
    navigate("/capture")
  }

  // calStatus === null means still loading — treat as calibrated to avoid flash-of-block
  const isCalibrated = calStatus === null || calStatus?.isCalibrated === true
  const isLoaded = calStatus !== null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, ease: "easeOut" }}
      className="fixed inset-0 w-screen h-screen overflow-hidden bg-black"
    >
      <style>{CAL_WARN_STYLES}</style>

      {/* Audio */}
      <audio
        ref={audioRef}
        onEnded={() => setIsAudioPlaying(false)}
        onPlay={() => setIsAudioPlaying(true)}
        autoPlay
      >
        Your browser does not support the audio element.
      </audio>

      {/* Top-right: sound + language + calibrate icon buttons */}
      <div className="absolute top-0 right-0 z-[51] p-4">
        <Setting
          setIsActive={setIsActive}
          isActive={isActive}
          onCalibrate={() => setShowCalModal(true)}
          isCalibrated={isCalibrated}
        />
      </div>

      {/* Background */}
      <div
        className="absolute inset-0 bg-center bg-cover z-0"
        style={{ backgroundImage: `url(${bg})` }}
      />

      {/* Main content */}
      <div className="relative z-50 w-full h-full flex flex-col items-center justify-between py-12 mt-[3rem]">
        <div className="h-0" />

        {/* Center: Video + Frame */}
        <div className="relative flex items-center justify-center w-full flex-1">
          <img
            src={startFrame}
            alt="frame"
            className="landscape:hidden absolute w-[clamp(600px,75vw,1073px)] h-auto pointer-events-none z-20"
          />
          <video
            src={video1}
            autoPlay muted loop playsInline
            className="relative z-10 w-[clamp(400px,70vw,800px)] h-auto max-h-[63vh] object-contain will-change-transform"
          />
        </div>

        {/* Bottom: Start button — hidden while not calibrated */}
        {isCalibrated && (
          <div className="flex flex-col items-center gap-[clamp(1rem,2vh,2rem)] z-20 px-4 w-full pb-[clamp(6rem,3vh,15rem)]">
            <StartButton
              width="w-[clamp(27rem,40vw,31.25rem)]"
              height="h-[clamp(7rem,8vh,6.25rem)]"
              onClick={handleStartClick}
            >
              {t("common.start")}
            </StartButton>
            <div className="w-[clamp(16rem,40vw,31.25rem)] h-[clamp(4rem,8vh,6.25rem)]" />
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          CALIBRATION REQUIRED — Full-screen blocking overlay
          Rendered when calibration data is loaded and not calibrated
         ══════════════════════════════════════════════════════════════ */}
      {isLoaded && !isCalibrated && (
        <>
          {/* Blur + dim backdrop — above all content, below modal */}
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              background: 'rgba(0,0,0,0.72)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          />

          {/* Centered warning card */}
          <div
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 61,
              width: 'min(600px, 88vw)',
              background: 'linear-gradient(145deg, rgba(12,18,32,0.98), rgba(20,10,5,0.98))',
              border: '1.5px solid rgba(255,120,0,0.35)',
              borderRadius: '32px',
              padding: '48px 40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              animation: 'calWarnFadeIn 0.45s cubic-bezier(0.16,1,0.3,1) forwards, calWarnPulse 2.5s ease-in-out 0.45s infinite',
              fontFamily: "'Anta', sans-serif",
            }}
          >
            {/* Animated scale icon */}
            <div style={{ fontSize: '72px', lineHeight: 1, animation: 'calWarnIcon 2s ease-in-out infinite' }}>
              ⚖️
            </div>

            {/* Blinking status badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: '#ff7020',
                animation: 'calDotBlink 1.2s ease-in-out infinite',
                display: 'inline-block',
              }} />
              <span style={{ color: '#ff9050', fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                Action Required
              </span>
            </div>

            <h2 style={{
              color: 'white',
              fontSize: 'clamp(22px, 4vw, 32px)',
              margin: 0, textAlign: 'center', lineHeight: 1.3, fontWeight: 700,
            }}>
              Scale Not Calibrated
            </h2>

            <p style={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: 'clamp(14px, 2vw, 17px)',
              margin: 0, textAlign: 'center', lineHeight: 1.7,
              fontFamily: 'sans-serif', maxWidth: '420px',
            }}>
              The weighing scale must be calibrated before screenings can begin.
              Weight measurements will be inaccurate without calibration.
            </p>

            {/* Divider */}
            <div style={{ width: '100%', height: '1px', background: 'rgba(255,120,0,0.2)', margin: '4px 0' }} />

            {/* CTA button */}
            <button
              onClick={() => setShowCalModal(true)}
              style={{
                width: '100%', height: '64px', borderRadius: '20px',
                background: 'linear-gradient(135deg, #ff6010, #ff3a00)',
                border: '1.5px solid rgba(255,160,80,0.5)',
                boxShadow: '0 0 30px rgba(255,80,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
                color: 'white', fontSize: 'clamp(16px, 2.5vw, 22px)',
                cursor: 'pointer', letterSpacing: '0.04em',
                fontFamily: "'Anta', sans-serif",
                transition: 'transform 0.15s',
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              ⚖️ &nbsp; Calibrate Scale Now
            </button>

            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', margin: 0, fontFamily: 'sans-serif' }}>
              You will not be able to start screenings until this is complete.
            </p>
          </div>
        </>
      )}

      {/* Calibration Modal — z-index above the blocking overlay */}
      {showCalModal && (
        <CalibrationModal
          onClose={() => setShowCalModal(false)}
          onDone={handleCalDone}
        />
      )}
    </motion.div>
  )
}
