import { Outlet, useLocation } from 'react-router'
import ProgressStage from './ProgessStage'


/**
 * Maps route prefixes → progress bar step (1–5).
 * Ordered longest-first so more specific paths win (e.g. /bia/result before /bia).
 */
const ROUTE_TO_STEP = [
  // Step 1 — Face Scan
  { prefix: '/verified', step: 1 },
  { prefix: '/bia', step: 2 },
  { prefix: '/voice', step: 3 },
  { prefix: '/space-convoy-complete', step: 4 },
  { prefix: '/colorblindness/quiz', step: 5 },
  { prefix: '/colorblindness', step: 5 },
  { prefix: '/space-convoy-main', step: 4 },
  { prefix: '/divide-attention', step: 4 }
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