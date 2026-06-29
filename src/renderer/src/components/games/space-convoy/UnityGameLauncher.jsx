import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSelector } from 'react-redux'
import { getNextRoute } from '../../../utils/stageRouter'

/**
 * UnityGameLauncher
 *
 * Tells the Electron main process to launch the Unity Divided_Attention
 * binary as a child process. While the game is running this component shows
 * a minimal "Game is running…" overlay so the Electron window stays alive
 * in the background.  When the Unity process exits (or the user presses ESC)
 * the component navigates to /space-convoy-complete.
 */
export default function UnityGameLauncher() {
  const navigate = useNavigate()
  const screening = useSelector((s) => s.common.screening) // x for stageRouter
  const [status, setStatus] = useState('launching') // 'launching' | 'running' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let isMounted = true

    const launch = async () => {
      try {
        const result = await window.api.launchUnityGame()
        if (!isMounted) return

        if (result?.success) {
          setStatus('running')
        } else {
          setStatus('error')
          setErrorMsg(result?.error || 'Failed to launch game')
        }
      } catch (err) {
        if (!isMounted) return
        setStatus('error')
        setErrorMsg(err?.message || 'Unknown error')
      }
    }

    launch()

    // Listen for the Unity process exit event pushed from main
    const cleanup = window.api.onUnityGameExit?.((exitCode) => {
      if (!isMounted) return
      console.log('[UnityGameLauncher] Unity exited with code:', exitCode)
      navigate(getNextRoute(screening?.nextStage, '/space-convoy-complete')) // ✅ stageRouter
    })

    // ESC key — bail out manually
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        window.api.stopUnityGame?.()
        navigate(getNextRoute(screening?.nextStage, '/space-convoy-complete')) // ✅ stageRouter
      }
    }
    window.addEventListener('keydown', handleKey)

    return () => {
      isMounted = false
      window.removeEventListener('keydown', handleKey)
      cleanup?.()
      // Kill the process if the component unmounts before the game exits
      window.api.stopUnityGame?.()
    }
  }, [navigate])

  /* ── UI ────────────────────────────────────────────────────────────── */
  return (
    <div style={overlay}>
      {status === 'launching' && (
        <div style={card}>
          <Spinner />
          <p style={label}>Launching Divided Attention Game…</p>
          <p style={hint}>Press ESC at any time to return</p>
        </div>
      )}

      {status === 'running' && (
        <div style={card}>
          <div style={dot} />
          <p style={label}>Game is running</p>
          <p style={hint}>Press ESC to stop and return</p>
        </div>
      )}

      {status === 'error' && (
        <div style={{ ...card, borderColor: '#ff4d4f' }}>
          <p style={{ ...label, color: '#ff4d4f' }}>⚠ Could not launch game</p>
          <p style={{ ...hint, maxWidth: 320 }}>{errorMsg}</p>
          <button
            style={btn}
            onClick={() => navigate(getNextRoute(screening?.nextStage, '/space-convoy-complete'))} // ✅ stageRouter
          >
            Continue
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Inline styles ──────────────────────────────────────────────────── */
const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'radial-gradient(ellipse at center, #0d1b2a 0%, #050a0f 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
}

const card = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 16,
  padding: '40px 56px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 20,
  backdropFilter: 'blur(12px)',
}

const label = {
  margin: 0,
  color: '#e8f4fd',
  fontSize: 20,
  fontWeight: 600,
  fontFamily: 'Inter, system-ui, sans-serif',
  letterSpacing: 0.3,
}

const hint = {
  margin: 0,
  color: 'rgba(255,255,255,0.45)',
  fontSize: 13,
  fontFamily: 'Inter, system-ui, sans-serif',
}

const dot = {
  width: 14,
  height: 14,
  borderRadius: '50%',
  background: '#52c41a',
  boxShadow: '0 0 12px #52c41a',
  animation: 'pulse 1.4s ease-in-out infinite',
}

const btn = {
  marginTop: 8,
  padding: '10px 28px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: '#e8f4fd',
  fontSize: 14,
  fontFamily: 'Inter, system-ui, sans-serif',
  cursor: 'pointer',
}

/* Spinner as a tiny inline SVG-less component */
function Spinner() {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        border: '3px solid rgba(255,255,255,0.1)',
        borderTop: '3px solid #40a9ff',
        borderRadius: '50%',
        animation: 'spin 0.9s linear infinite',
      }}
    />
  )
}