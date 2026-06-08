import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import suhiBgAudio from '../assets/audio/suhi_background.wav'


const EXCLUDED_ROUTES = [
  '/voice',
  '/divide-attention',
  '/space-convoy-main',
]


const EXCLUDED_EXACT_ROUTES = ['/']

function isMuted(pathname) {
  if (EXCLUDED_EXACT_ROUTES.includes(pathname)) return true
  return EXCLUDED_ROUTES.some((route) => pathname.startsWith(route))
}

export function useBackgroundAudio() {
  const location = useLocation()
  const audioRef = useRef(null)
  useEffect(() => {
    const audio = new Audio(suhiBgAudio)
    audio.loop = true
    audio.volume = 0.05
    audioRef.current = audio

    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isMuted(location.pathname)) {
      audio.pause()
    } else {
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[BackgroundAudio] Autoplay prevented:', err.message)
        })
      }
    }
  }, [location.pathname])
}
