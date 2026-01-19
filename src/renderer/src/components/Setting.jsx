import React, { useState } from 'react'
import settingbg from '../assets/setting-bg.svg'
import soundIcon from '../assets/sound-btn.png'
import langIcon from '../assets/language-btn.png'

export const Setting = ({setIsActive,isActive}) => {
  const [selectedLanguage, setSelectedLanguage] = useState('english')

  return (
    <div
      className={`
        w-screen h-screen
        overflow-hidden
        ${isActive ? "bg-black/50" : ''}
      `}
    >
      {/* sound and language btn */}
      <div className="absolute right-[1vh] top-[2vh] landscape:top-[1vh] landscape:right-[3vw] flex gap-2">
        <button className="max-w-full">
          <img src={soundIcon} alt="sound-btn" className="w-30" />
        </button>
        <button className='"max-w-full"'>
          <img onClick={()=>setIsActive(!isActive)} src={langIcon} alt="sound-btn" className="w-30" />
        </button>
      </div>

      {/* popup component */}
      {isActive && <div className="setting absolute right-[1vh] top-[6vh] landscape:top-[7vh] ">
        <img src={settingbg} alt="setting-bg" className="w-230" />
        <h3 className="text-4xl font-bold text-white absolute landscape:left-[8vw] landscape:top-[7vh] top-[5vh] left-[11vw]">
          Language
        </h3>

        {/* Radio Options */}
        <div className="absolute top-[10vh] left-[11vw]  landscape:top-[18vh] landscape:left-[7vw] flex items-center gap-4">
          <label className="flex items-center text-white text-3xl cursor-pointer">
            <input
              type="radio"
              name="language"
              value="english"
              checked={selectedLanguage === 'english'}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="mr-4 w-5 h-5 accent-blue-500"
            />
            English
          </label>

          <label className="flex items-center text-white text-3xl cursor-pointer">
            <input
              type="radio"
              name="language"
              value="hindi"
              checked={selectedLanguage === 'hindi'}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="mr-4 w-5 h-5 accent-blue-500"
            />
            Hindi
          </label>
        </div>

        <div className="absolute top-[16vh] left-[11vw] landscape:left-[7vw] landscape:top-[28vh] max-w-full">
          {/* Buttons */}
          <div className="w-full  flex gap-x-10">
            <button
              className="
w-40 h-14 xl:w-80 xl:h-25
flex items-center justify-center
text-center
rounded-[25px]
 border-white
 
[border-image-source:radial-gradient(50%_50%_at_50%_50%,#ffffff_0%,rgba(255,255,255,0)_100%)]
[border-image-slice:1]
shadow-[0px_5px_40px_0px_#9AD9FF]

text-white text-xl xl:text-4xl  
active:scale-[0.98]
tracking-wider
transition-transform duration-300 ease-in-out
              "
            >
              Reset
            </button>

            <button
              className="
w-40 h-14 xl:w-80 xl:h-25
                rounded-[25px]
                text-3xl font-medium
                text-white
                tracking-wider
                bg-linear-to-b from-cyan-400 to-cyan-600
                shadow-[0_0_25px_rgba(14,165,233,0.8)]
                hover:scale-[1.02]
                active:scale-95
                transition
              "
            >
              Apply
            </button>
          </div>
        </div>
      </div>}
    </div>
  )
}