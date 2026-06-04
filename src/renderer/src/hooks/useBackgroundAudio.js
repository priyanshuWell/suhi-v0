import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import suhiBgAudio from '../assets/audio/suhi_background.wav'

/**
 * Routes where the background music should be SILENT.
 * Uses startsWith so sub-routes are also caught.
 */
const EXCLUDED_ROUTES = [
  '/voice',          // Voice analysis pages
  '/divide-attention',
  '/space-convoy-main',
  '/space-convoy-complete', // Game completion screen
  '/capture'
]

/**
 * Exact routes that should also be silent.
 * "/" is SpaceConvoyMain (game lobby/intro).
 */
const EXCLUDED_EXACT_ROUTES = ['/']

function isMuted(pathname) {
  if (EXCLUDED_EXACT_ROUTES.includes(pathname)) return true
  return EXCLUDED_ROUTES.some((route) => pathname.startsWith(route))
}

/**
 * useBackgroundAudio
 *
 * Plays suhi_background.wav in a continuous loop across all app routes
 * except for the voice analysis and game sections.
 *
 * Must be used inside a component that is a descendant of <BrowserRouter>.
 */
export function useBackgroundAudio() {
  const location = useLocation()
  const audioRef = useRef(null)

  // Create audio element once on mount
  useEffect(() => {
    const audio = new Audio(suhiBgAudio)
    audio.loop = true
    audio.volume = 0.35
    audioRef.current = audio

    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  // React to route changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isMuted(location.pathname)) {
      // Fade out and pause
      audio.pause()
    } else {
      // Attempt autoplay; browsers may require user interaction first
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Autoplay was prevented – audio will start on next user interaction
          console.warn('[BackgroundAudio] Autoplay prevented:', err.message)
        })
      }
    }
  }, [location.pathname])
}
