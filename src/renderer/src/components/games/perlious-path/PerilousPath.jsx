import { useCallback, useState } from "react"
import PerilousPathGame from "./PerilousPathGame"
import PerilousPathIntro from "./PerilousPathIntro"
import PerilousScoreBoard from "./PerilousScoreBoard"
import background from "../../../assets/perilous_path/Play area.png"
import { stageStyle } from "./theme"
import { perilousPathApi, generateUuid } from "./perilouspathapi"

const SCREENS = {
    INTRO: "intro",
    GAME: "game",
    SCOREBOARD: "scoreboard",
    ERROR: "error",
}

/**
 * PerilousPath
 *
 * Owns the whole run: prefetches nothing, calls POST /next-grid once per
 * level (demo + 5 scored levels), lets PerilousPathGame play exactly one
 * trial and submit it, then loops back for the next board — until
 * /next-grid returns 409, at which point it calls POST /game/complete and
 * shows the final scoreboard.
 *
 * Props:
 *  - userId: pass a real signed-in user id if you have one. If omitted, a
 *    random UUID is generated once and reused for the whole run — fine for
 *    local/dummy testing, but almost certainly needs to come from real
 *    auth/session context in production.
 *  - sessionId: real internal.user_screenings session id, if this run is
 *    tied to a broader screening flow. Leave null for a standalone run.
 *  - kioskId: optional, for analytics.
 *  - dummyFlag: defaults to perilousPathApi.DUMMY_FLAG (true). Set to
 *    false to hit the real backend instead of the local simulator.
 */
export default function PerilousPath({
    userId,
    sessionId = null,
    kioskId = null,
    dummyFlag = perilousPathApi.DUMMY_FLAG,
    introProps = {},
    gameProps = {},
    scoreboardProps = {},
    onGameStart,
    onGameFinish,
    onRestart,
}) {
    const [resolvedUserId] = useState(() => userId || generateUuid())
    const [screen, setScreen] = useState(SCREENS.INTRO)
    const [gameSessionId, setGameSessionId] = useState(null)
    const [levelData, setLevelData] = useState(null)
    const [finalResult, setFinalResult] = useState(null)
    const [errorInfo, setErrorInfo] = useState(null)

    const finalizeGame = useCallback(
        async (sessionIdOverride) => {
            const targetSessionId = sessionIdOverride ?? gameSessionId
            try {
                const response = await perilousPathApi.gameComplete({
                    game_session_id: targetSessionId,
                    dummyFlag,
                })
                setFinalResult(response)
                setScreen(SCREENS.SCOREBOARD)
                onGameFinish?.(response)
            } catch (err) {
                setErrorInfo({
                    message: err.message || "Couldn't finalize your results.",
                    onRetry: () => finalizeGame(targetSessionId),
                })
                setScreen(SCREENS.ERROR)
            }
        },
        [gameSessionId, dummyFlag, onGameFinish]
    )

    const loadNextLevel = useCallback(async () => {
        setLevelData(null)

        try {
            const response = await perilousPathApi.nextGrid({
                user_id: resolvedUserId,
                session_id: sessionId,
                kiosk_id: kioskId,
                dummyFlag,
            })

            setGameSessionId(response.game_session_id)
            setLevelData(response)
            setScreen(SCREENS.GAME)
        } catch (err) {
            if (err.status === 409) {
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
    }, [
        resolvedUserId,
        sessionId,
        kioskId,
        dummyFlag,
        finalizeGame,
        gameSessionId,
    ])

    const handleStart = () => {
        onGameStart?.()
        setScreen(SCREENS.GAME)
        loadNextLevel()
    }

    const handleLevelFinish = useCallback(
        async (trialResult) => {
            try {
                // Let the consumer know the trial finished.
                // Don't let a consumer callback prevent the game
                // from loading the next level.
                try {
                    await gameProps.onFinish?.(trialResult)
                } catch (err) {
                    console.error("gameProps.onFinish failed:", err)
                }

                await loadNextLevel()
            } catch (err) {
                console.error("Failed to load next level:", err)
            }
        },
        [gameProps, loadNextLevel]
    )

    const handleRestart = () => {
        setGameSessionId(null)
        setLevelData(null)
        setFinalResult(null)
        setErrorInfo(null)
        setScreen(SCREENS.INTRO)
        onRestart?.()
    }

    let content
    if (screen === SCREENS.GAME) {
        content = levelData ? (
          <PerilousPathGame
              key={levelData.trial_id}
              {...gameProps}
              level={levelData}
              dummyFlag={dummyFlag}
              onFinish={handleLevelFinish}
          />
        ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white">
                <p className="animate-pulse font-anton text-lg">Loading next challenge…</p>
            </div>
        )
    } else if (screen === SCREENS.SCOREBOARD) {
        content = <PerilousScoreBoard {...scoreboardProps} result={finalResult} onNext={handleRestart} />
    } else if (screen === SCREENS.ERROR) {
        content = (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center text-white">
                <p className="font-anton text-lg">{errorInfo?.message}</p>
                <button
                    type="button"
                    className="rounded-full bg-cyan-500 px-6 py-2 font-anton text-sm text-black"
                    onClick={errorInfo?.onRetry}
                >
                    Retry
                </button>
            </div>
        )
    } else {
        content = <PerilousPathIntro {...introProps} onStart={handleStart} />
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
                {content}
            </div>
        </div>
    )
}
