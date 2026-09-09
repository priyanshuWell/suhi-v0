import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { useSelector } from "react-redux"
import { AnimatePresence } from "framer-motion"
import BeatDropStage from "./BeatDropStage"
import IntroScreen from "./IntroScreen"
import AvoidNotesPopup from "./AvoidNotesPopup"
import SpeedIncreasePopup from "./SpeedIncreasePopup"
import PlayArea from "./PlayArea"
import ResultsScreen from "./ResultsScreen"
import { getNextRoute } from "../../../utils/stageRouter"
import { useSetProgressStage } from "../../ProgressStageContext"

const SCREENS = {
    INTRO: "intro",
    PLAY: "play",
    RESULTS: "results"
}

const DEMO_DURATION_SEC = 45
const SPEED_POPUP_AT_SEC = 22

/**
 * Beat Drop — UI shell + screen flow.
 * Game logic will replace demo timer / notes later.
 *
 * Flow:
 *   Intro → Start Game (instant) → Avoid Notes popup
 *        → Got it → Play Area
 *        → (demo) Speed Increase popup mid-run
 *        → timer ends → Results → Next → /bia/result
 */
export default function BeatDropGame() {
    const navigate = useNavigate()
    const screening = useSelector((state) => state.common.screening)
    const setProgressStage = useSetProgressStage()
    const [screen, setScreen] = useState(SCREENS.INTRO)
    const [showAvoid, setShowAvoid] = useState(false)
    const [showSpeed, setShowSpeed] = useState(false)
    const [speedSeen, setSpeedSeen] = useState(false)
    const [pulseCards, setPulseCards] = useState(0)
    const [secondsLeft, setSecondsLeft] = useState(DEMO_DURATION_SEC)
    const [score, setScore] = useState(0)
    const [speedMul, setSpeedMul] = useState(1)
    const [streak] = useState(10)

    // Show progress bar only on the intro screen
    useEffect(() => {
        setProgressStage(screen === SCREENS.INTRO)
    }, [screen, setProgressStage])

    const playing = screen === SCREENS.PLAY && !showAvoid && !showSpeed

    const handleStart = () => {
        // Instant navigate to Avoid popup (animation-duration: 0ms)
        setShowAvoid(true)
        setScreen(SCREENS.PLAY)
        setSecondsLeft(DEMO_DURATION_SEC)
        setScore(0)
        setSpeedMul(1)
        setSpeedSeen(false)
        setShowSpeed(false)
    }

    const handleAvoidGotIt = () => {
        // Navigate to None — dismiss modal, stay on play
        setShowAvoid(false)
    }

    const handleSpeedGotIt = () => {
        setShowSpeed(false)
        setSpeedMul(1.55)
    }

    const handleHowToPlay = () => {
        setPulseCards((n) => n + 1)
    }

    const handleKeyPress = useCallback((lane) => {
        // UI-only feedback score bump until logic doc arrives
        setScore((s) => s + 120 + lane * 10)
    }, [])

    const handleNext = () => {
        const nextStage = screening?.nextStage
        const route = getNextRoute(nextStage, "/bia/result")
        navigate(route)
    }

    // Demo countdown while playing
    useEffect(() => {
        if (!playing) return undefined
        const id = window.setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    window.clearInterval(id)
                    setScreen(SCREENS.RESULTS)
                    return 0
                }
                const next = prev - 1
                if (!speedSeen && next === SPEED_POPUP_AT_SEC) {
                    setShowSpeed(true)
                    setSpeedSeen(true)
                }
                return next
            })
        }, 1000)
        return () => window.clearInterval(id)
    }, [playing, speedSeen])

    return (
        <BeatDropStage>
            {screen === SCREENS.INTRO && (
                <IntroScreen
                    onStart={handleStart}
                    highlightCards={handleHowToPlay}
                    pulseKey={pulseCards}
                />
            )}

            {(screen === SCREENS.PLAY || showAvoid) && screen !== SCREENS.RESULTS && (
                <PlayArea
                    active={playing}
                    secondsLeft={secondsLeft}
                    score={score}
                    speedMul={speedMul}
                    onKeyPress={handleKeyPress}
                />
            )}

            {screen === SCREENS.RESULTS && (
                <ResultsScreen
                    score={score}
                    coins={500}
                    streak={streak}
                    onNext={handleNext}
                />
            )}

            <AnimatePresence>
                {showAvoid && <AvoidNotesPopup key="avoid" onGotIt={handleAvoidGotIt} />}
                {showSpeed && <SpeedIncreasePopup key="speed" onGotIt={handleSpeedGotIt} />}
            </AnimatePresence>
        </BeatDropStage>
    )
}
