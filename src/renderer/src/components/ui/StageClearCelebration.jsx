import { useEffect, useRef, useState } from "react"
import { useSelector } from "react-redux"
import { motion, AnimatePresence } from "framer-motion"
import { Award, Sparkles, ChevronRight, Zap } from "lucide-react"

// Map stage keys to gamer-friendly mission titles
const STAGE_LABELS = {
    login: "Face Biometrics Scan",
    bia: "Full Body Composition Scan",
    height_weight: "BMI & Physical Dimension Scan",
    smoothie_slash: "Mind Reaction Challenge",
    perilous_path: "Spatial Cognition Trial",
    voice_analysis: "Vocal Biometrics Analysis",
    color_blindness: "Color Spectrum Vision Test",
    visual_acuity: "Visual Acuity Precision Test",
    beat_drop: "Rhythm & Coordination Arena",
    result: "Comprehensive Health Dossier"
}

export default function StageClearCelebration() {
    const screening = useSelector((state) => state.common.screening)
    const completedStages = screening?.completedStages || []
    const [celebrationData, setCelebrationData] = useState(null)
    const prevCompletedRef = useRef(completedStages)
    const timerRef = useRef(null)

    useEffect(() => {
        const prev = prevCompletedRef.current
        // Only trigger if a NEW stage was added (length increased)
        if (completedStages.length > prev.length && prev.length > 0) {
            // Find newly added stage(s)
            const newlyCompleted = completedStages.filter((k) => !prev.includes(k))
            const lastStageKey = newlyCompleted[newlyCompleted.length - 1]
            const stageTitle = STAGE_LABELS[lastStageKey] || "Stage"

            setCelebrationData({
                key: lastStageKey,
                title: stageTitle,
                stageNumber: completedStages.length
            })

            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => {
                setCelebrationData(null)
            }, 2200)
        }
        prevCompletedRef.current = completedStages

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [completedStages])

    const handleDismiss = () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        setCelebrationData(null)
    }

    return (
        <AnimatePresence>
            {celebrationData && (
                <motion.div
                    key="stage-clear-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    onClick={handleDismiss}
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-md cursor-pointer select-none"
                >
                    {/* Radial background burst */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                        <motion.div
                            initial={{ scale: 0.4, opacity: 0 }}
                            animate={{ scale: [0.6, 1.4, 1.2], opacity: [0, 0.8, 0.4] }}
                            transition={{ duration: 1.8, ease: "easeOut" }}
                            className="w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(0,179,255,0.45)_0%,rgba(0,63,253,0.15)_50%,transparent_70%)] blur-3xl"
                        />
                    </div>

                    {/* Celebration Card */}
                    <motion.div
                        initial={{ scale: 0.7, y: 30, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.85, y: -20, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 380, damping: 22 }}
                        className="relative max-w-[620px] w-[90%] mx-auto p-8 rounded-3xl border-2 border-cyan-400/60 bg-gradient-to-b from-[#0e1e38]/95 via-[#081224]/95 to-[#040813]/95 shadow-[0_0_60px_rgba(0,179,255,0.6),inset_0_0_30px_rgba(0,179,255,0.2)] text-center flex flex-col items-center gap-4 overflow-hidden"
                    >
                        {/* High-tech corner accents */}
                        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-300" />
                        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-300" />
                        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-300" />
                        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-300" />

                        {/* Top Icon with pulsing ring */}
                        <div className="relative">
                            <motion.div
                                animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                                className="absolute -inset-3 rounded-full bg-cyan-400/20 blur-md"
                            />
                            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center border-2 border-cyan-200 shadow-[0_0_25px_rgba(0,210,255,0.8)]">
                                <Award className="w-10 h-10 text-white" />
                            </div>
                        </div>

                        {/* Banner Tag */}
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="flex items-center gap-2 px-4 py-1 rounded-full bg-cyan-400/15 border border-cyan-400/40 text-cyan-300 text-sm font-anta tracking-widest uppercase"
                        >
                            <Sparkles className="w-4 h-4 text-cyan-300" />
                            STAGE {celebrationData.stageNumber} CLEARED!
                            <Sparkles className="w-4 h-4 text-cyan-300" />
                        </motion.div>

                        {/* Main Title */}
                        <motion.h2
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2, type: "spring" }}
                            className="text-3xl sm:text-4xl font-anta text-white font-bold tracking-wide drop-shadow-[0_0_20px_rgba(154,217,255,0.8)]"
                        >
                            {celebrationData.title}
                        </motion.h2>

                        {/* Subtitle / Next Mission prompt */}
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="text-cyan-200/80 font-anta text-base flex items-center gap-2"
                        >
                            <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
                            Next Challenge Unlocked! Advancing...
                        </motion.p>

                        {/* Progress Bar / Countdown indicator */}
                        <div className="w-full h-1.5 rounded-full bg-cyan-950/80 mt-2 overflow-hidden border border-cyan-500/30">
                            <motion.div
                                initial={{ width: "0%" }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 2.1, ease: "linear" }}
                                className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-white shadow-[0_0_12px_#00b3ff]"
                            />
                        </div>

                        {/* Tap hint */}
                        <span className="text-xs font-anta text-cyan-300/60 mt-1 flex items-center gap-1">
                            Tap to continue <ChevronRight className="w-3 h-3" />
                        </span>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
