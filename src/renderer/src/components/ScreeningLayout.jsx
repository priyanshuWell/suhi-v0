import { Outlet, useLocation } from 'react-router'
import ProgressStage from './ProgessStage'


/**
 * Maps route prefixes → progress bar step (1–5).
 * Ordered longest-first so more specific paths win (e.g. /bia/result before /bia).
 */
const ROUTE_TO_STEP = [
  // Step 1 — Face Scan
  { prefix: '/', step: 1 },             // root (FaceCapture)
  { prefix: '/welcome', step: 1 },
  { prefix: '/capture', step: 1 },
  { prefix: '/login-suhi', step: 1 },
  { prefix: '/login-dob', step: 1 },
  { prefix: '/login-father', step: 1 },
  { prefix: '/facecapture', step: 1 },
  { prefix: '/faceCapture', step: 1 },
  { prefix: '/confirmation', step: 1 },
  { prefix: '/fingerprint', step: 1 },

  // Step 2 — Body Scan
  { prefix: '/bia/result', step: 2 },   // more specific first
  { prefix: '/bia', step: 2 },

  // Step 3 — Voice Scan (voice is outside layout but listed for completeness)
  { prefix: '/voice', step: 3 },

  // Step 4 — Cog. Games
  { prefix: '/screen1', step: 4 },
  { prefix: '/colorblindness/quiz', step: 4 },   // more specific first
  { prefix: '/colorblindness', step: 4 },
  { prefix: '/space-convoy-main', step: 4 },
  { prefix: '/divide-attention', step: 4 },
  { prefix: '/space-convoy-complete', step: 4 },

  // Step 5 — Vision Test
  { prefix: '/verified', step: 5 },
]

// No excluded routes — all children of ScreeningLayout get the bar.
// Voice is outside the layout route entirely.

function getStep(pathname) {
  // Sort by prefix length descending so the most specific match wins
  const sorted = [...ROUTE_TO_STEP].sort((a, b) => b.prefix.length - a.prefix.length)

  for (const { prefix, step } of sorted) {
    if (pathname === prefix || pathname.startsWith(prefix + '/') || pathname.startsWith(prefix)) {
      return step
    }
  }
  return null
}

export default function ScreeningLayout() {
  const { pathname } = useLocation()

  const currentStep = getStep(pathname)

  return (
    <>
      {currentStep !== null && <ProgressStage current={currentStep} />}
      <Outlet />
    </>
  )
}