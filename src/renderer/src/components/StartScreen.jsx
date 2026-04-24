import { motion } from 'framer-motion'
import React, { useState, useEffect } from 'react'
import bg from '../assets/background.png'
import video1 from '../assets/avatar.mp4'
import startFrame from '../assets/start_frame.svg'
import { useNavigate } from 'react-router'
import { openCamerasInBackground } from '../utils/cameraSession'
import { Setting } from './Setting'
import { useTranslation } from 'react-i18next'
import StartButton from './ui/BlueGradientButton'
import welcomeScreenAudio from '../assets/audio/welcome_screen.mp3'

const Flag = true;
export const StartScreen = () => {
  const { t } = useTranslation()
  // const [isCameraReady, setIsCameraReady] = React.useState(false)
  const [error, setError] = useState(false)
  const navigate = useNavigate()
  const [isActive, setIsActive] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = React.useRef(null);
  const instructionAudio = welcomeScreenAudio;
  useEffect(() => {
    // const openCameras = async () => {
    //   return await openCamerasInBackground()
    // }
    try {
      // openCameras()
      // setIsCameraReady(true)
      playAudio()
    } catch (error) {
      console.log(error)
    }
  }, [])
  const playAudio = () => {
    if (audioRef.current) {
      setIsAudioPlaying(true);
      audioRef.current.play().catch((err) => {
        console.log("Audio playback failed:", err);
      });
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAudioPlaying(false);
    }
  };

  const handleAudioEnd = () => {
    setIsAudioPlaying(false);
  };

  const handleStartClick = () => {
    stopAudio();
    navigate("/capture");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, ease: 'easeOut' }}
      className="
        fixed inset-0
        w-screen h-screen
        overflow-hidden
        bg-black
      "
    >
      {/* Audio Element - plays kajal_neural_bmi.mp3 on load */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnd}
        onPlay={() => setIsAudioPlaying(true)}
        autoPlay
      >
        <source src={instructionAudio} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
      <div className={`absolute top-0 right-0 z-[51] p-4`}>
        <Setting setIsActive={setIsActive} isActive={isActive} />
      </div>
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

          {/* Video - positioned to align within frame */}
          <video
            src={video1}
            autoPlay
            //muted
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
          <StartButton onClick={handleStartClick}>
            {t('common.start')}
          </StartButton>

          <div
            className="
              w-[clamp(16rem,40vw,31.25rem)]
              h-[clamp(4rem,8vh,6.25rem)]
            "
          />
        </div>
      </div>
    </motion.div>
  )
}
