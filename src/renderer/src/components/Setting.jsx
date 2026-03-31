import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import settingbg from '../assets/setting-bg.svg'
import soundIcon from '../assets/sound-btn.png'
import langIcon from '../assets/language-btn.png'

/* ── GlowSlider — Figma node 8662:1453 ── */
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

  const handlePointerDown = (e) => {
    isDragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    updateValue(e.clientX)
  }

  const handlePointerMove = (e) => {
    if (!isDragging.current) return
    updateValue(e.clientX)
  }

  const handlePointerUp = () => {
    isDragging.current = false
  }

  const fillWidth = Math.max((percent / 100) * trackWidth, 20)
  const grabberLeft = Math.max(5, Math.min(fillWidth - 20, trackWidth - 30))

  return (
    <div
      ref={trackRef}
      className="relative cursor-pointer touch-none select-none w-full"
      style={{
        height: '30px',
        filter: 'drop-shadow(0px 7px 36px rgba(154, 217, 255, 0.5))',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Base track */}
      <div className="absolute inset-0 rounded-[24px] bg-[#01060a]" />

      {/* Value fill */}
      <div className="absolute inset-0 rounded-[24px] overflow-hidden">
        <div
          className="h-full rounded-[34px] transition-[width] duration-75 ease-out"
          style={{
            width: `${fillWidth}px`,
            backgroundColor: '#9ad9ff',
          }}
        />
      </div>

      {/* Grabber */}
      <div
        className="absolute top-[5px] w-[20px] h-[20px] rounded-full pointer-events-none z-10 transition-[left] duration-75 ease-out bg-[#010508]"
        style={{ left: `${grabberLeft}px` }}
      />
    </div>
  )
}

export const Setting = ({ setIsActive, isActive }) => {
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
      </div>

      {/* Language Overlay */}
      {isActive && (
        <div className="fixed inset-0 z-[100] bg-black/50" onClick={() => setIsActive(false)}>
          <div className="absolute right-[1vh] top-[6vh] landscape:top-[7vh]" onClick={(e) => e.stopPropagation()}>
            <img src={settingbg} alt="setting-bg" className="w-230" />
            <h3 className="text-4xl font-bold text-white absolute landscape:left-[8vw] landscape:top-[7vh] top-[5vh] left-[11vw]">
              Language
            </h3>
            <div className="absolute top-[10vh] left-[11vw] landscape:top-[18vh] landscape:left-[7vw] flex items-center gap-4">
              <label className="flex items-center text-white text-3xl cursor-pointer">
                <input type="radio" name="language" value="en" checked={selectedLanguage === 'en'} onChange={(e) => handleLanguageChange(e.target.value)} className="mr-4 w-5 h-5 accent-blue-500" />
                English
              </label>
              <label className="flex items-center text-white text-3xl cursor-pointer">
                <input type="radio" name="language" value="hi" checked={selectedLanguage === 'hi'} onChange={(e) => handleLanguageChange(e.target.value)} className="mr-4 w-5 h-5 accent-blue-500" />
                Hindi
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