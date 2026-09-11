import { Outlet, useLocation } from "react-router"
import { motion, AnimatePresence } from "framer-motion"
import ProgressStage from "./ProgessStage"
import { ProgressStageProvider, useProgressStageVisibility } from "./ProgressStageContext"
import StageClearCelebration from "./ui/StageClearCelebration"

/**
 * Inner shell — reads visibility from context so game screens can hide
 * the progress bar during gameplay while keeping it visible on all other
 * screening routes (default: show = true).
 */
function ScreeningLayoutInner() {
    const { show } = useProgressStageVisibility()
    const location = useLocation()

    return (
        <>
            {show && <ProgressStage />}
            <Outlet />
        </>
    )
}

/**
 * Wraps all screening routes with the top progress bar.
 * ProgressStage now reads completedStages + screeningOrder from Redux directly,
 * so no route-to-step mapping is needed here anymore.
 */
export default function ScreeningLayout() {
    return (
        <ProgressStageProvider>
            <ScreeningLayoutInner />
        </ProgressStageProvider>
    )
}
