import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import suhiBgAudio from '../assets/audio/suhi_background.wav'

const EXCLUDED_ROUTES = ['/voice']

const EXCLUDED_EXACT_ROUTES = ['/']

function isMuted(pathname) {
  if (EXCLUDED_EXACT_ROUTES.includes(pathname)) return true
  return EXCLUDED_ROUTES.some((route) => pathname.startsWith(route))
}

// Singleton audio instance — created once for the app lifetime so it survives
// route changes without losing its play state or getting garbage collected.
let _bgAudio = null
function getBgAudio() {
  if (!_bgAudio) {
    _bgAudio = new Audio(suhiBgAudio)
    _bgAudio.loop = true
    _bgAudio.volume = 0.05
  }
  return _bgAudio
}

export function useBackgroundAudio() {
  const location = useLocation()
  const audioRef = useRef(getBgAudio())

  useEffect(() => {
    const audio = audioRef.current

    if (isMuted(location.pathname)) {
      audio.pause()
      return
    }

    // Small delay lets the browser settle after a route transition (especially
    // after game/voice routes that may have suspended the AudioContext).
    const tryPlay = () => {
      const promise = audio.play()
      if (promise !== undefined) {
        promise.catch((err) => {
          console.warn('[BackgroundAudio] Autoplay prevented:', err.message)
        })
      }
    }

    if (audio.paused) {
      // Give the browser one tick to finish any ongoing navigation teardown
      const timer = setTimeout(tryPlay, 100)
      return () => clearTimeout(timer)
    }
  }, [location.pathname])
}
