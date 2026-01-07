import React, { useState, useEffect } from 'react'
import bg from '../assets/background.png'
import video1 from '../assets/avatar.mp4'
import { useNavigate } from 'react-router'
import { openCamerasInBackground } from '../utils/cameraSession'
import Frame from './Frame'
import { Setting } from './Setting'
import { useTranslation } from 'react-i18next'
const Flag = false
export const StartScreen = () => {
  const { t } = useTranslation()
  const [isCameraReady, setIsCameraReady] = React.useState(false)
  const [error, setError] = useState(false)
  const navigate = useNavigate()
  const [isActive,setIsActive] = useState(false);
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
    <div
      className="
        fixed inset-0
        w-screen h-screen
        overflow-hidden
        bg-black
      "
    >
       <div className="absolute top-0 right-0 z-50 p-4">
  <Setting setIsActive={setIsActive} isActive={isActive}/>
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

      {/* Video */}
      <div
        className="
          absolute inset-0
          flex items-center justify-center
          z-10
          pointer-events-none
        "
      >
        <video
          src={video1}
          autoPlay
          muted
          loop
          playsInline
          className="
          mb-44
            w-full h-full
            object-contain
            max-w-[80vw]
            max-h-[70vh]
            will-change-transform
          "
        />
        <Frame frame={`w-[62%] `} />
      </div>

      {/* Start Button */}
      <div
        className="
          absolute landscape:bottom-[1vh] portrait:bottom-[4vh]
          left-1/2 -translate-x-1/2
          z-20
        
        "
      >
        <button
          onClick={() => navigate(`${Flag ? '/capture' : '/verified'}`)}
          style={{
            borderImageSource:
              'radial-gradient(50% 50% at 50% 50%, #FFFFFF 0%, rgba(255,255,255,0) 100%)',
            borderImageSlice: 1
          }}
          className="
w-40 h-14
xl:w-125 xl:h-25
flex items-center justify-center
text-center
rounded-[30px]
 border-white
[border-image-source:radial-gradient(50%_50%_at_50%_50%,#ffffff_0%,rgba(255,255,255,0)_100%)]
[border-image-slice:1]
bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)]
shadow-[inset_0px_33.5px_50px_-67px_rgba(255,255,255,0.24),inset_0px_-100.5px_134px_0px_rgba(255,255,255,0.24),inset_0px_0px_30px_0px_#ffffff]
text-white text-xl xl:text-5xl  tracking-wide
active:scale-[0.98]

transition-transform duration-300 ease-in-out

  "
        >
          {t('common.start')}
        </button>

        <div
          className="
            mt-8
            text-center
            text-[1rem]
            xl:text-2xl
            text-[#E6E6E6]
          "
        >
          <button
            className="
          
w-40 h-14
xl:w-125 xl:h-25
flex items-center justify-center
text-center
rounded-[30px]
 border-white
 
[border-image-source:radial-gradient(50%_50%_at_50%_50%,#ffffff_0%,rgba(255,255,255,0)_100%)]
[border-image-slice:1]
shadow-[0px_5px_40px_0px_#9AD9FF]

text-white text-xl xl:text-4xl  tracking-wide
active:scale-[0.98]

transition-transform duration-300 ease-in-out
          "
          >
           {t('common.new_user')}
          </button>
        </div>
      </div>
    
    </div>
  )
}
