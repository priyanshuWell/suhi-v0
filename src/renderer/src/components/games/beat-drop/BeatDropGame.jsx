import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { useSelector } from "react-redux"
import { AnimatePresence } from "framer-motion"
import BeatDropStage from "./BeatDropStage"
import IntroScreen from "./IntroScreen"
import FollowTheBeatPopup from "./FollowTheBeatPopup"
import SpeedIncreasePopup from "./SpeedIncreasePopup"
import TwoNotesTogetherPopup from "./TwoNotesTogetherPopup"
import AvoidNotesPopup from "./AvoidNotesPopup"
import PlayArea from "./PlayArea"
import ResultsScreen from "./ResultsScreen"
import {
    AVOID_POPUP_AT_MS,
    CHORD_POPUP_AT_MS,
    DEVICE_LATENCY_MS,
    POPUP_AUTO_CLOSE_MS,
    SESSION_DURATION_MS,
    SPEED_POPUP_AT_MS
} from "./sessionChart"
import {
    completeBeatDropSession,
    resultsFromComplete,
    startBeatDropSession,
    toRawEvents
} from "./beatDropApi"
import { getKioskId } from "../../../utils/config"
import { getNextRoute } from "../../../utils/stageRouter"
import backingTrack from "../../../assets/beat-drop/audio/beatdrop_backing_44k1_16bit.wav"
import { useNavigate } from "react-router"

const SCREENS = {
    INTRO: "intro",
    PLAY: "play",
    RESULTS: "results"
}

const APP_VERSION = "1.0.3"

/**
 * Beat Drop — chart session + music + backend start/complete.
 *
 * Instruction popups (pause clock + music; auto-close 5s):
 *   A Follow the Beat     → at play start
 *   B Notes Speed Increase → before Block B
 *   C Two Notes Together  → before Block C
 *   D Avoid These Notes   → before Block D
 *   E (none)
 */
export default function BeatDropGame() {
    const navigate = useNavigate()
    const storeUser = useSelector((s) => s.common.user)
    const storeScreening = useSelector((s) => s.common.screening)

    const [screen, setScreen] = useState(SCREENS.INTRO)
    const [showFollow, setShowFollow] = useState(false)
    const [showSpeed, setShowSpeed] = useState(false)
    const [showChord, setShowChord] = useState(false)
    const [showAvoid, setShowAvoid] = useState(false)
    const [pulseCards, setPulseCards] = useState(0)
    const [secondsLeft, setSecondsLeft] = useState(SESSION_DURATION_MS / 1000)
    const [score, setScore] = useState(0)
    const [coins, setCoins] = useState(500)
    const [streak, setStreak] = useState(0)
    const [completing, setCompleting] = useState(false)
    const navigate = useNavigate()
    const [results, setResults] = useState(null)
    const audioRef = useRef(null)
    const engineRef = useRef(null)
    const sessionIdRef = useRef(null)
    const nextRouteRef = useRef(null)
    const endedRef = useRef(false)
    const speedShownRef = useRef(false)
    const chordShownRef = useRef(false)
    const avoidShownRef = useRef(false)
    const popupTimerRef = useRef(0)

    const popupOpen = showFollow || showSpeed || showChord || showAvoid
    const onPlayScreen = screen === SCREENS.PLAY
    const playing = onPlayScreen && !popupOpen
    const paused = popupOpen

    useEffect(() => {
        const audio = new Audio(backingTrack)
        audio.loop = true
        audio.volume = 0.55
        audioRef.current = audio
        return () => {
            audio.pause()
            audioRef.current = null
        }
    }, [])

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return undefined
        if (playing) {
            audio.play().catch(() => {})
        } else {
            audio.pause()
        }
        return undefined
    }, [playing])

    const clearPopupTimer = () => {
        if (popupTimerRef.current) {
            window.clearTimeout(popupTimerRef.current)
            popupTimerRef.current = 0
        }
    }

    const dismissFollow = useCallback(() => {
        clearPopupTimer()
        setShowFollow(false)
    }, [])

    const dismissSpeed = useCallback(() => {
        clearPopupTimer()
        setShowSpeed(false)
    }, [])

    const dismissChord = useCallback(() => {
        clearPopupTimer()
        setShowChord(false)
    }, [])

    const dismissAvoid = useCallback(() => {
        clearPopupTimer()
        setShowAvoid(false)
    }, [])

    // Auto-close whichever popup is open after 5s
    useEffect(() => {
        if (!popupOpen) {
            clearPopupTimer()
            return undefined
        }
        clearPopupTimer()
        popupTimerRef.current = window.setTimeout(() => {
            if (showFollow) setShowFollow(false)
            if (showSpeed) setShowSpeed(false)
            if (showChord) setShowChord(false)
            if (showAvoid) setShowAvoid(false)
            popupTimerRef.current = 0
        }, POPUP_AUTO_CLOSE_MS)
        return () => clearPopupTimer()
    }, [popupOpen, showFollow, showSpeed, showChord, showAvoid])

    const handleStart = async () => {
        endedRef.current = false
        speedShownRef.current = false
        chordShownRef.current = false
        avoidShownRef.current = false
        sessionIdRef.current = null
        nextRouteRef.current = null
        setShowFollow(false)
        setShowSpeed(false)
        setShowChord(false)
        setShowAvoid(false)
        setCompleting(false)
        setSecondsLeft(SESSION_DURATION_MS / 1000)
        setScore(0)
        setStreak(0)
        setCoins(500)
        if (audioRef.current) audioRef.current.currentTime = 0

        const userId = storeUser?.data?.user_id
        const screeningSessionId =
            storeScreening?.sessionId ?? storeScreening?.session_id ?? null
        const kioskId = getKioskId()

        try {
            const data = await startBeatDropSession({
                userId,
                screeningSessionId,
                kioskId,
                deviceLatencyMs: DEVICE_LATENCY_MS,
                clientAppVersion: APP_VERSION
            })
            sessionIdRef.current =
                data?.session_id ?? data?.game_session_id ?? data?.id ?? null
            console.info("[BeatDrop] session started:", sessionIdRef.current, {
                screeningSessionId,
                data
            })
        } catch (e) {
            console.warn("[BeatDrop] /session/start failed — continuing offline:", e.message)
        }

        // Level A intro — pause play until dismissed
        setShowFollow(true)
        setScreen(SCREENS.PLAY)
    }

    const handleHowToPlay = () => setPulseCards((n) => n + 1)
    const handleScore = useCallback((s) => setScore(s), [])

    const handleSpeedPopup = useCallback(() => {
        if (speedShownRef.current) return
        speedShownRef.current = true
        setShowSpeed(true)
    }, [])

    const handleChordPopup = useCallback(() => {
        if (chordShownRef.current) return
        chordShownRef.current = true
        setShowChord(true)
    }, [])

    const handleAvoidPopup = useCallback(() => {
        if (avoidShownRef.current) return
        avoidShownRef.current = true
        setShowAvoid(true)
    }, [])

    const handleSessionEnd = useCallback(async (log, stats) => {
        if (endedRef.current) return
        endedRef.current = true
        clearPopupTimer()
        setShowFollow(false)
        setShowSpeed(false)
        setShowChord(false)
        setShowAvoid(false)
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
        }

        const local = {
            score: stats.score,
            streak: stats.streak,
            coins: 300 + Math.min(500, Math.floor(stats.score / 40))
        }
        setScore(local.score)
        setStreak(local.streak)
        setCoins(local.coins)

        const rawEvents = toRawEvents(log)
        if (typeof window !== "undefined") {
            window.__beatDropLastLog = log
            window.__beatDropRawEvents = rawEvents
            console.info("[BeatDrop] session log rows:", log.length)
        }

        const sessionId = sessionIdRef.current
        if (sessionId) {
            setCompleting(true)
            try {
                const data = await completeBeatDropSession({
                    sessionId,
                    rawEvents,
                    score: local.score,
                    longestStreak: local.streak
                })
                console.info("[BeatDrop] session complete:", data)
                const next = resultsFromComplete(data, local)
                setResults(data)
                setScore(next.score)
                setCoins(next.coins)
                setStreak(next.streak)

                const nextStage = data?.next_stage ?? data?.screening?.next_stage ?? null
                if (nextStage) {
                    nextRouteRef.current = getNextRoute(nextStage, "/bia/result")
                }

                if (typeof window !== "undefined") {
                    window.__beatDropComplete = data
                }
            } catch (e) {
                console.warn(
                    "[BeatDrop] /session/complete failed — using local stats:",
                    e.message
                )
            } finally {
                setCompleting(false)
            }
        } else {
            console.warn("[BeatDrop] no session_id — skipping /session/complete")
        }

        setScreen(SCREENS.RESULTS)
    }, [])

    const handleNext = useCallback(() => {
        clearPopupTimer()
        setScreen(SCREENS.INTRO)
        setShowAvoid(false)
        setShowSpeed(false)
        const nextStage = results?.next_stage
        // const nextStage = "/bia/result"
        const route = getNextRoute(nextStage, "/bia/result")
        navigate(route)
    }, [navigate, storeScreening?.nextStage])

    useEffect(() => {
        if (!onPlayScreen) return undefined
        const id = window.setInterval(() => {
            const eng = engineRef.current
            if (!eng) return
            const snap = eng.getSnapshot()
            setSecondsLeft(snap.secondsLeft)
            setScore(snap.score)
            if (snap.done && !endedRef.current) {
                handleSessionEnd(eng.getLog(), {
                    score: eng.getScore(),
                    streak: eng.getBestStreak()
                })
            }
        }, 200)
        return () => window.clearInterval(id)
    }, [onPlayScreen, handleSessionEnd])

    return (
        <BeatDropStage>
            {screen === SCREENS.INTRO && (
                <IntroScreen
                    onStart={handleStart}
                    highlightCards={handleHowToPlay}
                    pulseKey={pulseCards}
                />
            )}

            {onPlayScreen && (
                <PlayArea
                    active
                    paused={paused}
                    secondsLeft={secondsLeft}
                    score={score}
                    onScore={handleScore}
                    onSessionEnd={handleSessionEnd}
                    onSpeedPopup={handleSpeedPopup}
                    onChordPopup={handleChordPopup}
                    onAvoidPopup={handleAvoidPopup}
                    speedAtMs={SPEED_POPUP_AT_MS}
                    chordAtMs={CHORD_POPUP_AT_MS}
                    avoidAtMs={AVOID_POPUP_AT_MS}
                    engineRef={engineRef}
                />
            )}

            {screen === SCREENS.RESULTS && (
                <ResultsScreen
                    score={score}
                    coins={coins}
                    streak={streak || 10}
                    onNext={handleNext}
                />
            )}

            <AnimatePresence>
                {showFollow && (
                    <FollowTheBeatPopup key="follow" onGotIt={dismissFollow} />
                )}
                {showSpeed && <SpeedIncreasePopup key="speed" onGotIt={dismissSpeed} />}
                {showChord && (
                    <TwoNotesTogetherPopup key="chord" onGotIt={dismissChord} />
                )}
                {showAvoid && <AvoidNotesPopup key="avoid" onGotIt={dismissAvoid} />}
            </AnimatePresence>

            {completing && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(0,0,0,0.35)",
                        zIndex: 40,
                        pointerEvents: "none"
                    }}
                />
            )}
        </BeatDropStage>
    )
}
