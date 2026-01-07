import React from 'react'
import lightbg from '../assets/lightbg.png'
import lightblub from '../assets/lightblub.png'
import frame1 from '../assets/verfied-frame.svg'
import profilepic from '../assets/profile-pic.png'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

export default function RegisterCard() {
  const navigate = useNavigate()
  const {t}= useTranslation()
  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center">
      {/* Card Wrapper */}
      <div
        className="relative portrait:w-[80%] portrait:h-[80%] bg-cover bg-center"
        style={{ backgroundImage: `url(${lightbg})` }}
      >
        <div
          className="
          absolute landscape:bottom-[-20vh] landscape:translate-y-1/4 portrait:top-[4vh]
          left-1/2 -translate-x-1/2
          z-20
        "
        >
          <img
            src={frame1}
            alt="dmt background"
            className="xl:w-[850px]  landscape:w-[650px]  max-w-none h-auto"
          />
        </div>

        <div
          className="flex flex-col items-center gap-10  absolute landscape:bottom-[-28vh] portrait:top-[10vh]
          left-1/2 -translate-x-1/2
          z-30 "
        >
          {/* profile pic */}

          <div className="max-w-full h-auto">
            <img
              src={profilepic}
              alt=" profile pic"
              className="w-full portrait:max-w-105 landscape:max-w-60 h-auto"
            />
          </div>

          {/* text */}

          <div className="info max-w-full mt-8">
            <p className="portrait:text-3xl flex flex-col items-center landscape:text-xl text-center tracking-wider gap-y-3 text-white text-nowrap">
              <span>{t('profile.name')} - Bhanu Pratap singh</span>
              <span> {t('profile.class')}- 8th A</span>
              <span>{t('profile.age')} - 13 years</span>
              <span>{t('profile.number')} - 0987654321</span>
            </p>
          </div>

          <div className="buttons portrait:mt-5">
            <button
            onClick={()=>navigate('/bia/wh')}
              style={{
                borderImageSource:
                  'radial-gradient(50% 50% at 50% 50%, #FFFFFF 0%, rgba(255,255,255,0) 100%)',
                borderImageSlice: 1
              }}
              className="
w-40 h-14
xl:w-80 xl:h-25
flex items-center justify-center
text-center
rounded-[25px]
 border-white
[border-image-source:radial-gradient(50%_50%_at_50%_50%,#ffffff_0%,rgba(255,255,255,0)_100%)]
[border-image-slice:1]
bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)]
shadow-[inset_0px_33.5px_50px_-67px_rgba(255,255,255,0.24),inset_0px_-100.5px_134px_0px_rgba(255,255,255,0.24),inset_0px_0px_30px_0px_#ffffff]
text-white text-xl xl:text-3xl la  tracking-wide
active:scale-[0.98]
transition-transform duration-300 ease-in-out

  "
            >
              {t('common.yes_me')}
            </button>

            <button
              className="
          
w-40 h-14
xl:w-80 xl:h-25
mt-8
flex items-center justify-center
text-center
rounded-[30px]
 border-white
 
[border-image-source:radial-gradient(50%_50%_at_50%_50%,#ffffff_0%,rgba(255,255,255,0)_100%)]
[border-image-slice:1]
shadow-[0px_5px_40px_0px_#9AD9FF]

text-white text-xl xl:text-3xl  tracking-wide
active:scale-[0.98]

transition-transform duration-300 ease-in-out
          "
            >
              {t('common.not_me')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
