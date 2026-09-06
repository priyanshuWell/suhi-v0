import { Outlet, useLocation } from "react-router"
import ProgressStage from "./ProgessStage"

/**
 * Maps route prefixes → progress bar step (1–5).
 * Ordered longest-first so more specific paths win.
 */
const ROUTE_TO_STEP = [
    // Step 1 — Login / Face Scan
    { prefix: "/verified", step: 1 },
    // Step 2 — Body Scan (BIA)
    { prefix: "/bia", step: 2 },
    // Step 3 — Cognitive Game
    { prefix: "/space-convoy-complete", step: 3 },
    { prefix: "/space-convoy-main", step: 3 },
    { prefix: "/divide-attention", step: 3 },
    // Step 4 — Vision
    { prefix: "/colorblindness/quiz", step: 5 },
    { prefix: "/colorblindness", step: 5 },
    // Step 5 — Voice
    { prefix: "/voice", step: 4 }
]

function getStepFromRoute(pathname) {
    const sorted = [...ROUTE_TO_STEP].sort((a, b) => b.prefix.length - a.prefix.length)
    for (const { prefix, step } of sorted) {
        if (
            pathname === prefix ||
            pathname.startsWith(prefix + "/") ||
            pathname.startsWith(prefix)
        ) {
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
