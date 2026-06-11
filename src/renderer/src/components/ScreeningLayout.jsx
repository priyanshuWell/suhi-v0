import { Outlet, useLocation } from 'react-router'
import { useSelector } from 'react-redux'
import ProgressStage from './ProgessStage'


/**
 * Fallback: Maps route prefixes → progress bar step (1–5).
 * Used only when Redux screening state is not yet available.
 * Ordered longest-first so more specific paths win.
 */
const ROUTE_TO_STEP = [
  // Step 1 — Login / Face Scan
  { prefix: '/verified', step: 1 },
  // Step 2 — Body Scan (BIA)
  { prefix: '/bia', step: 2 },
  // Step 3 — Cognitive Game
  { prefix: '/space-convoy-complete', step: 3 },
  { prefix: '/space-convoy-main', step: 3 },
  { prefix: '/divide-attention', step: 3 },
  // Step 4 — Vision
  { prefix: '/colorblindness/quiz', step: 4 },
  { prefix: '/colorblindness', step: 4 },
  // Step 5 — Voice
  { prefix: '/voice', step: 5 },
]

/**
 * Maps backend stage_key → progress bar step number.
 * Matches the static steps array in ProgressStage.
 */
const STAGE_KEY_TO_STEP = {
  login: 1,
  bia: 2,
  divide_attention: 3,
  color_blindness: 4,
  voice_analysis: 5,
  result: 6,
}

function getStepFromRoute(pathname) {
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
  const screening = useSelector((state) => state.common.screening)

  // Primary: use stage_order from backend's next_stage (most accurate)
  // next_stage describes where the user is GOING — so we show that step as active.
  const stepFromRedux = screening?.nextStage
    ? STAGE_KEY_TO_STEP[screening.nextStage.stage_key] ?? null
    : null

  // Fallback to route-based detection when Redux isn't populated yet
  const currentStep = stepFromRedux ?? getStepFromRoute(pathname)

  return (
    <>
      {currentStep !== null && <ProgressStage current={currentStep} />}
      <Outlet />
    </>
  )
}