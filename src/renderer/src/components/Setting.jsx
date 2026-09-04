import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import settingbg from '../assets/setting-bg.svg'
import soundIcon from '../assets/sound-btn.png'
import langIcon from '../assets/language-btn.png'
import calibrateIcon from '../assets/calibrate-btn.png'



const GlowSlider = ({ min = 0, max = 100, value, onChange }) => {
  const trackRef = useRef(null)
  const isDragging = useRef(false)
  const [trackWidth, setTrackWidth] = useState(380)

  const percent = ((value - min) / (max - min)) * 100

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const observer = new ResizeObserver(([entry]) => {
      setTrackWidth(entry.contentRect.width)
    })
    observer.observe(track)
    return () => observer.disconnect()
  }, [])

  const updateValue = useCallback(
    (clientX) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
      const newValue = Math.round(min + (x / rect.width) * (max - min))
      onChange?.(newValue)
    },
    [min, max, onChange]
  )

  // Global pointer/touch move & up — needed for dragging outside the element
  useEffect(() => {
    const handleMove = (e) => {
      if (!isDragging.current) return
      // PointerEvent has clientX directly; TouchEvent needs touches[0]
      const clientX = e.clientX ?? e.touches?.[0]?.clientX
      if (clientX != null) updateValue(clientX)
      e.preventDefault?.() // prevent scroll while dragging
    }
    const handleUp = () => { isDragging.current = false }

    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleUp)

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleUp)
    }
  }, [updateValue])

  const handlePointerDown = (e) => {
    e.preventDefault()
    isDragging.current = true
    // setPointerCapture keeps the pointer locked to this element even if
    // the finger moves outside — critical for fast swipes on touch screens
    e.currentTarget.setPointerCapture(e.pointerId)
    // clientX works for both mouse and touch pointer events
    updateValue(e.clientX)
  }

  // Derived layout values
  const GRABBER = 40   // px — large finger-friendly knob
  const fillWidth = (percent / 100) * trackWidth
  const grabberLeft = Math.max(0, Math.min(fillWidth - GRABBER / 2, trackWidth - GRABBER))

  return (
    <div
      ref={trackRef}
      className="relative cursor-pointer select-none w-full"
      style={{
        height: '48px',           // taller hit-area for fingers
        touchAction: 'none',      // prevent browser scroll hijack
        WebkitUserSelect: 'none',
        filter: 'drop-shadow(0px 7px 36px rgba(154, 217, 255, 0.5))',
      }}
      onPointerDown={handlePointerDown}
    >
      {/* Base track — vertically centred */}
      <div className="absolute left-0 right-0 rounded-[24px] bg-[#01060a]"
        style={{ top: '50%', transform: 'translateY(-50%)', height: '20px' }} />

      {/* Fill */}
      <div className="absolute left-0 right-0 rounded-[24px] overflow-hidden"
        style={{ top: '50%', transform: 'translateY(-50%)', height: '20px' }}>
        <div
          className="h-full rounded-[34px]"
          style={{ width: `${fillWidth}px`, backgroundColor: '#9ad9ff' }}
        />
      </div>

      {/* Grabber — large circle for easy touch */}
      <div
        className="absolute rounded-full pointer-events-none z-10"
        style={{
          width: `${GRABBER}px`,
          height: `${GRABBER}px`,
          top: '50%',
          transform: 'translateY(-50%)',
          left: `${grabberLeft}px`,
          background: 'radial-gradient(circle at 40% 35%, #b0e8ff 0%, #000 40%, #0a4060 100%)',
          boxShadow: '0 0 10px rgba(154,217,255,0.8), 0 2px 6px rgba(0,0,0,0.5)',
        }}
      />
    </div>
  )
}

export default GlowSlider
export const Setting = ({ setIsActive, isActive, onCalibrate, isCalibrated }) => {
  const { i18n } = useTranslation()
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language || 'en')
  const [isSoundActive, setIsSoundActive] = useState(false)
  const [volume, setVolume] = useState(50)

  useEffect(() => {
    setSelectedLanguage(i18n.language || 'en')
  }, [i18n.language])

  useEffect(() => {
    const fetchVolume = async () => {
      try {
        const result = await window.api.getVolume()
        if (result.success) setVolume(result.volume)
      } catch (error) {
        console.error('Error fetching volume:', error)
      }
    }
    fetchVolume()
  }, [])

  const handleLanguageChange = (lang) => setSelectedLanguage(lang)

  const handleVolumeChange = async (newVolume) => {
    setVolume(newVolume)
    try {
      await window.api.setVolume(newVolume)
    } catch (error) {
      console.error('Error setting volume:', error)
    }
  }

  const handleApply = () => {
    i18n.changeLanguage(selectedLanguage)
    setIsActive(false)
  }

  const handleReset = () => setSelectedLanguage('en')

  return (
    <>
      <div className="flex gap-2">
        <button className="max-w-full" onClick={() => setIsSoundActive(!isSoundActive)}>
          <img src={soundIcon} alt="sound-btn" className="w-30" />
        </button>
        <button className="max-w-full" onClick={() => setIsActive(!isActive)}>
          <img src={langIcon} alt="lang-btn" className="w-30" />
        </button>
        {/* Calibration button — same style as sound & language */}
        {onCalibrate && (
          <button className="max-w-full relative" onClick={onCalibrate}>
            <img src={calibrateIcon} alt="calibrate-btn" className="w-30" />
            {/* Orange dot indicator when scale is not calibrated */}
            {!isCalibrated && (
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#ff8c00',
                  border: '2px solid rgba(0,0,0,0.6)',
                  boxShadow: '0 0 6px rgba(255,140,0,0.8)',
                }}
              />
            )}
          </button>
        )}
      </div>

      {/* Language Overlay */}
      {isActive && (
        <div className="fixed inset-0 z-[100] bg-black/50" onClick={() => setIsActive(false)}>
          <div className="absolute right-[1vh] top-[6vh] landscape:top-[7vh]" onClick={(e) => e.stopPropagation()}>
            <img src={settingbg} alt="setting-bg" className="w-230" />
            <h3 className="text-4xl font-bold text-white absolute landscape:left-[8vw] landscape:top-[7vh] top-[5vh] left-[11vw]">
              Language
            </h3>
            <div className="absolute top-[10vh] left-[11vw] landscape:top-[16vh] landscape:left-[7vw] grid grid-cols-3 gap-4">
              <label className="flex items-center text-white text-2xl cursor-pointer">
                <input type="radio" name="language" value="en" checked={selectedLanguage === 'en'} onChange={(e) => handleLanguageChange(e.target.value)} className="mr-3 w-5 h-5 accent-blue-500" />
                English
              </label>
              <label className="flex items-center text-white text-2xl cursor-pointer">
                <input type="radio" name="language" value="hi" checked={selectedLanguage === 'hi'} onChange={(e) => handleLanguageChange(e.target.value)} className="mr-3 w-5 h-5 accent-blue-500" />
                Hindi
              </label>
              <label className="flex items-center text-white text-2xl cursor-pointer">
                <input type="radio" name="language" value="gu" checked={selectedLanguage === 'gu'} onChange={(e) => handleLanguageChange(e.target.value)} className="mr-3 w-5 h-5 accent-blue-500" />
                Gujarati
              </label>
              <label className="flex items-center text-white text-2xl cursor-pointer">
                <input type="radio" name="language" value="mr" checked={selectedLanguage === 'mr'} onChange={(e) => handleLanguageChange(e.target.value)} className="mr-3 w-5 h-5 accent-blue-500" />
                Marathi
              </label>
              <label className="flex items-center text-white text-2xl cursor-pointer">
                <input type="radio" name="language" value="bn" checked={selectedLanguage === 'bn'} onChange={(e) => handleLanguageChange(e.target.value)} className="mr-3 w-5 h-5 accent-blue-500" />
                Bengali
              </label>
              <label className="flex items-center text-white text-2xl cursor-pointer">
                <input type="radio" name="language" value="ar" checked={selectedLanguage === 'ar'} onChange={(e) => handleLanguageChange(e.target.value)} className="mr-3 w-5 h-5 accent-blue-500" />
                Arabic
              </label>
            </div>
            <div className="absolute top-[16vh] left-[11vw] landscape:left-[7vw] landscape:top-[28vh] max-w-full">
              <div className="w-full flex gap-x-10">
                <button onClick={handleReset} className="w-[clamp(16rem,30vw,31.25rem)] h-[clamp(4rem,8vh,6.25rem)] flex items-center justify-center text-center rounded-[30px] border-2 border-white/30 bg-white/5 backdrop-blur-sm shadow-[0px_5px_40px_0px_rgba(154,217,255,0.3)] text-white text-[clamp(1.25rem,3vw,3rem)] tracking-wide active:scale-[0.98] transition-all duration-300 ease-in-out hover:bg-white/10 hover:border-white/50">Reset</button>
                <button onClick={handleApply} className="w-[clamp(16rem,30vw,31.25rem)] h-[clamp(4rem,8vh,6.25rem)] flex items-center justify-center text-center rounded-[30px] border-2 border-white/50 bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)] shadow-[0px_0px_30px_rgba(0,179,255,0.5),inset_0px_0px_20px_rgba(255,255,255,0.3)] text-white text-[clamp(1.5rem,3vw,3rem)] tracking-wide active:scale-[0.98] transition-all duration-300 ease-in-out hover:border-white">Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sound Overlay — just the slider bar */}
      {isSoundActive && (
        <GlowSlider min={0} max={100} value={volume} onChange={handleVolumeChange} />
      )}
    </>
  )
}