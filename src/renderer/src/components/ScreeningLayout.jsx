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
            <StageClearCelebration />
            <AnimatePresence mode="wait">
                <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, scale: 0.985, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.015, y: -8 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="w-full h-full min-h-screen"
                >
                    <Outlet />
                </motion.div>
            </AnimatePresence>
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
