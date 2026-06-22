import { Outlet, useLocation } from 'react-router'
import ProgressStage from './ProgessStage'

const ROUTE_TO_STEP = [
  { prefix: '/verified', step: 1 },
  { prefix: '/bia', step: 2 },
  { prefix: '/space-convoy-complete', step: 3 },
  { prefix: '/space-convoy-main', step: 3 },
  { prefix: '/divide-attention', step: 3 },
  { prefix: '/voice', step: 4 },
  { prefix: '/colorblindness', step: 5 },
  { prefix: '/colorblindness/quiz', step: 5 },


]

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

  // Step is always derived from the current route
  const currentStep = getStepFromRoute(pathname)

  return (
    <>
      {currentStep !== null && <ProgressStage current={currentStep} />}
      <Outlet />
    </>
  )
}