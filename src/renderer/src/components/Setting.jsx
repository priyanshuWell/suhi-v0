import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import settingbg from '../assets/setting-bg.svg'
import soundIcon from '../assets/sound-btn.png'
import langIcon from '../assets/language-btn.png'

export const Setting = ({ setIsActive, isActive }) => {
  const { i18n } = useTranslation()
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language || 'en')

  // Sync selectedLanguage with current i18n language
  useEffect(() => {
    setSelectedLanguage(i18n.language || 'en')
  }, [i18n.language])

  const handleLanguageChange = (lang) => {
    setSelectedLanguage(lang)
  }

  const handleApply = () => {
    // Change the language
    i18n.changeLanguage(selectedLanguage)
    // Close the settings modal
    setIsActive(false)
  }

  const handleReset = () => {
    // Reset to current language (cancel any unsaved changes)
    setSelectedLanguage('en')
  }

  return (
    <>
      {/* Always-visible buttons */}
      <div className="flex gap-2">
        <button className="max-w-full">
          <img src={soundIcon} alt="sound-btn" className="w-30" />
        </button>
        <button className="max-w-full">
          <img onClick={() => setIsActive(!isActive)} src={langIcon} alt="sound-btn" className="w-30" />
        </button>
      </div>

      {/* Overlay - only when active */}
      {isActive && (
        <div className="fixed inset-0 z-[100] bg-black/50" onClick={() => setIsActive(false)}>
          {/* popup component */}
          <div className="absolute right-[1vh] top-[6vh] landscape:top-[7vh]" onClick={(e) => e.stopPropagation()}>
            <img src={settingbg} alt="setting-bg" className="w-230" />
            <h3 className="text-4xl font-bold text-white absolute landscape:left-[8vw] landscape:top-[7vh] top-[5vh] left-[11vw]">
              Language
            </h3>

            {/* Radio Options */}
            <div className="absolute top-[10vh] left-[11vw] landscape:top-[18vh] landscape:left-[7vw] flex items-center gap-4">
              <label className="flex items-center text-white text-3xl cursor-pointer">
                <input
                  type="radio"
                  name="language"
                  value="en"
                  checked={selectedLanguage === 'en'}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="mr-4 w-5 h-5 accent-blue-500"
                />
                English
              </label>

              <label className="flex items-center text-white text-3xl cursor-pointer">
                <input
                  type="radio"
                  name="language"
                  value="hi"
                  checked={selectedLanguage === 'hi'}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="mr-4 w-5 h-5 accent-blue-500"
                />
                Hindi
              </label>
            </div>

            <div className="absolute top-[16vh] left-[11vw] landscape:left-[7vw] landscape:top-[28vh] max-w-full">
              <div className="w-full flex gap-x-10">
                <button
                  onClick={handleReset}
                  className="
                  w-[clamp(16rem,30vw,31.25rem)]
                  h-[clamp(4rem,8vh,6.25rem)]
                  flex items-center justify-center
                  text-center
                  rounded-[30px]
                  border-2 border-white/30
                  bg-white/5
                  backdrop-blur-sm
                  shadow-[0px_5px_40px_0px_rgba(154,217,255,0.3)]
                  text-white
                  text-[clamp(1.25rem,3vw,3rem)]
                  tracking-wide
                  active:scale-[0.98]
                  transition-all duration-300 ease-in-out
                  hover:bg-white/10
                  hover:border-white/50
                "
                >
                  Reset
                </button>
                <button
                  onClick={handleApply}
                  className="
                  w-[clamp(16rem,30vw,31.25rem)]
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
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}