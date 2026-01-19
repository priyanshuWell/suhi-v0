import { motion } from 'framer-motion'
import React, { useState, useEffect } from 'react'
import bg from '../assets/background.png'
import video1 from '../assets/avatar.mp4'
import startFrame from '../assets/start_frame.svg'
import { useNavigate } from 'react-router'
import { openCamerasInBackground } from '../utils/cameraSession'
import { Setting } from './Setting'
import { useTranslation } from 'react-i18next'
const Flag = true;
export const StartScreen = () => {
  const { t } = useTranslation()
  const [isCameraReady, setIsCameraReady] = React.useState(false)
  const [error, setError] = useState(false)
  const navigate = useNavigate()
  const [isActive, setIsActive] = useState(false);
  useEffect(() => {
    const openCameras = async () => {
      return await openCamerasInBackground()
    }
    try {
      openCameras()
      setIsCameraReady(true)
    } catch (error) {
      console.log(error)
    }
  }, [])
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
      <div className={`absolute top-0 right-0 z-40 p-4`}>
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
            pb-[clamp(1rem,3vh,3rem)]
          "
        >
          <button
            onClick={() => navigate(`${Flag ? '/capture' : '/verified'}`)}
            // onClick={() => navigate(skipBIA ? '/voice' : '/verified')}
            className="
              w-[clamp(16rem,40vw,31.25rem)]
              h-[clamp(4rem,8vh,6.25rem)]
              flex items-center justify-center
              text-center
              rounded-[30px]
              border-2 border-white/50
              bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)]
              shadow-[0px_0px_30px_rgba(0,179,255,0.5),inset_0px_0px_20px_rgba(255,255,255,0.3)]
              text-white
              text-[clamp(1.5rem,3vw,3rem)]
              tracking-wide
              active:scale-[0.98]
              transition-all duration-300 ease-in-out
              hover:border-white
            "
          >
            {t('common.start')}
          </button>

          <button
            className="
              w-[clamp(16rem,40vw,31.25rem)]
              h-[clamp(4rem,8vh,6.25rem)]
              flex items-center justify-center
              text-center
              rounded-[30px]
              border-2 border-white/30
              bg-white/5
              backdrop-blur-sm
              shadow-[0px_5px_40px_0px_rgba(154,217,255,0.3)]
              text-white
              text-[clamp(1.25rem,2.5vw,2.5rem)]
              tracking-wide
              active:scale-[0.98]
              transition-all duration-300 ease-in-out
              hover:bg-white/10
              hover:border-white/50
            "
          >
            {t('common.new_user')}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
