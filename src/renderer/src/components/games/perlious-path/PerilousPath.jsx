import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { AnimatePresence, motion } from "framer-motion"
import PerilousPathGame from "./PerilousPathGame"
import PerilousPathIntro from "./PerilousPathIntro"
import PerilousScoreBoard from "./PerilousScoreBoard"
import background from "../../../assets/perilous_path/Play area.png"
import { stageStyle } from "./theme"
import { perilousPathApi, DUMMY_FLAG } from "./perilouspathapi"
import { useDispatch, useSelector } from "react-redux"
import { setScreening } from "../../../features/common/commonSlice"
import { getNextRoute } from "../../../utils/stageRouter"
import { getKioskId } from "../../../utils/config"

const SCREENS = {
    INTRO: "intro",
    GAME: "game",
    SCOREBOARD: "scoreboard",
    ERROR: "error",
}

const dummyFlag = DUMMY_FLAG

/**
 * PerilousPath
 *
 * Self-contained orchestrator — reads user + session from Redux (same
 * pattern as SpaceConvoyMain). No external prop callbacks needed.
 *
 * API loop (demo + levels 1–5):
 *   1. POST /next-grid           → board for this level
 *   2. render PerilousPathGame   → collect taps
 *   3a. POST /trial/complete     → player reached the goal
 *   3b. POST /trial/timeout      → response window ran out
 *   4. repeat from 1 (next-grid advances automatically)
 *      loop ends when /next-grid returns 409
 *
 * After all 5 scored levels resolve:
 *   5. POST /game/complete       → final 5 construct scores → SCOREBOARD
 *
 * Timer: a single wall-clock elapsed timer starts when the player taps
 * "Start" and keeps running across all level transitions. It is passed
 * down to PerilousPathGame so the Time badge always shows total game time,
 * not a per-level / per-phase countdown.
 */
export default function PerilousPath() {
    const dispatch = useDispatch()
    const storeUser = useSelector((state) => state.common.user)
    const screeningState = useSelector((state) => state.common.screening)
    const navigate = useNavigate()

    const [screen, setScreen] = useState(SCREENS.INTRO)
    const [gameSessionId, setGameSessionId] = useState(null)
    const [levelData, setLevelData] = useState(null)
    const [finalResult, setFinalResult] = useState(null)
    const [errorInfo, setErrorInfo] = useState(null)

    // ── Total elapsed game timer ─────────────────────────────────────────
    // Ticks up from 0 once the player taps Start; persists across all level
    // transitions. Passed to PerilousPathGame so the Time badge shows total
    // game time rather than a per-phase countdown.
    const [totalElapsed, setTotalElapsed] = useState(0)
    const gameStartTimeRef = useRef(null)
    const timerIntervalRef = useRef(null)

    const startTimer = useCallback(() => {
        gameStartTimeRef.current = Date.now()
        timerIntervalRef.current = setInterval(() => {
            setTotalElapsed(Math.floor((Date.now() - gameStartTimeRef.current) / 1000))
        }, 1000)
    }, [])

    const stopTimer = useCallback(() => {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
    }, [])

    // Clean up the interval if the component unmounts mid-game
    useEffect(() => {
        return () => {
            clearInterval(timerIntervalRef.current)
        }
    }, [])

    // ── Game finalization ────────────────────────────────────────────────
    const finalizeGame = useCallback(
        async (sessionIdOverride) => {
            const targetSessionId = sessionIdOverride ?? gameSessionId
            stopTimer()
            try {
                const response = await perilousPathApi.gameComplete({
                    game_session_id: targetSessionId,
                    dummyFlag,
                })
                if (response?.screening) {
                    dispatch(setScreening(response.screening))
                }
                setFinalResult(response)
                setScreen(SCREENS.SCOREBOARD)
            } catch (err) {
                setErrorInfo({
                    message: err.message || "Couldn't finalize your results.",
                    onRetry: () => finalizeGame(targetSessionId),
                })
                setScreen(SCREENS.ERROR)
            }
        },
        [gameSessionId, stopTimer, dispatch]
    )

    // Navigate to the next screening stage — called when player taps "Next"
    // on the scoreboard. Reads next_stage from game/complete API response
    // (fallback to Redux if missing).
    const handleNavigateNext = useCallback(() => {
        const nextStage = finalResult?.screening?.next_stage ?? screeningState?.nextStage
        const route = getNextRoute(nextStage, "/bia/result")
        navigate(route)
    }, [finalResult, screeningState?.nextStage, navigate])

    // ── Level loading ────────────────────────────────────────────────────
    const loadNextLevel = useCallback(async () => {
        setLevelData(null)

        try {
            const response = await perilousPathApi.nextGrid({
                user_id: storeUser?.data?.user_id,
                session_id: screeningState?.sessionId,
                kiosk_id: getKioskId(),
                dummyFlag,
            })

            setGameSessionId(response.game_session_id)
            setLevelData(response)
            setScreen(SCREENS.GAME)
        } catch (err) {
            if (err.status === 409) {
                // All levels done — finalize and show scoreboard
                await finalizeGame(gameSessionId)
                return
            }

            const message =
                err.status === 503
                    ? "Perilous Path isn't ready yet. Please try again shortly."
                    : err.message || "Something went wrong loading the next level."

            setErrorInfo({
                message,
                onRetry: loadNextLevel,
            })
            setScreen(SCREENS.ERROR)
        }
    }, [storeUser, screeningState, finalizeGame, gameSessionId])

    // ── Handlers ─────────────────────────────────────────────────────────
    const handleStart = useCallback(() => {
        startTimer()
        loadNextLevel()
    }, [startTimer, loadNextLevel])

    const handleLevelFinish = useCallback(async () => {
        try {
            await loadNextLevel()
        } catch (err) {
            console.error("Failed to load next level:", err)
        }
    }, [loadNextLevel])

    const handleRestart = useCallback(() => {
        stopTimer()
        setTotalElapsed(0)
        setGameSessionId(null)
        setLevelData(null)
        setFinalResult(null)
        setErrorInfo(null)
        setScreen(SCREENS.INTRO)
    }, [stopTimer])

    // ── Render ────────────────────────────────────────────────────────────
    let content
    if (screen === SCREENS.GAME) {
        content = levelData ? (
            <PerilousPathGame
                key={levelData.trial_id}
                level={levelData}
                dummyFlag={dummyFlag}
                onFinish={handleLevelFinish}
                totalElapsedSeconds={totalElapsed}
            />
        ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white">
                <p className="animate-pulse font-anton text-[3.2cqw]">Loading next challenge…</p>
            </div>
        )
    } else if (screen === SCREENS.SCOREBOARD) {
        content = <PerilousScoreBoard result={finalResult} onNext={handleNavigateNext} />
    } else if (screen === SCREENS.ERROR) {
        content = (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2cqw] px-[4cqw] text-center text-white">
                <p className="font-anton text-[3.2cqw]">{errorInfo?.message}</p>
                <button
                    type="button"
                    className="rounded-full bg-cyan-500 px-[4cqw] py-[1.5cqw] font-anton text-[2.6cqw] text-black"
                    onClick={errorInfo?.onRetry}
                >
                    Retry
                </button>
            </div>
        )
    } else {
        content = <PerilousPathIntro onStart={handleStart} />
    }

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black font-anton">
            <div className="relative overflow-hidden" style={stageStyle}>
                <img
                    src={background}
                    alt="perilous-background"
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                />
                <AnimatePresence mode="wait">
                    <motion.div
                        key={screen}
                        className="absolute inset-0"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.02 }}
                        transition={{ duration: 0.28, ease: "easeOut" }}
                    >
                        {content}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}
