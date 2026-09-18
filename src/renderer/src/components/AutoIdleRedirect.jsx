import React, { useState, useCallback } from "react"
import { useIdleTimer } from "react-idle-timer"
import { useNavigate, useLocation } from "react-router"
import { useDispatch } from "react-redux"
import { resetCommonState } from "../features/common/commonSlice"
import NoActivityFrame from "./ui/NoActivityFrame"
import { useKioskAudio, ERROR_AUDIO } from "../constants/audio"
import { useTranslation } from "react-i18next"
import { releaseAllResources } from "../utils/cleanup"


const ACTIVITY_EVENTS = [
    "mousemove",
    "mousedown",
    "keydown",
    "wheel",
    "DOMMouseScroll",
    "mousewheel",
    "touchstart",
    "touchmove",
    "pointerdown",
    "pointermove",
    "MSPointerDown",
    "MSPointerMove",
    "visibilitychange"
]

const AutoIdleRedirect = ({
    timeoutMs = 120000,
    promptBeforeMs = 5000,
    redirectTo = "/welcome",
    // How long the "continue-screening" stage counts down before it gives
    // up and redirects, and how long before the "Continue Screening"
    // button appears. These now drive BOTH the actual redirect timing and
    // the text NoActivityFrame displays, so the two can never drift apart
    // the way the old hardcoded "...5 seconds..." copy could.
    continueScreeningMs = 10000,
    continueButtonDelayMs = 5000
}) => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const location = useLocation()
    const { play: playErrorAudio, stop: stopErrorAudio } = useKioskAudio()
    // stage: null | 'are-you-there' | 'continue-screening'
    const [stage, setStage] = useState(null)
    const { t } = useTranslation()

    // Disable on home/splash routes — no point idling-out a page you'd
    // just get redirected back to anyway.
    // Keep the list tight: only the routes the user would be sent back to.
    const isIdleExempt = location.pathname === "/" || location.pathname === redirectTo

    const handlePrompt = useCallback(() => {
        if (!isIdleExempt) {
            setStage("are-you-there")
            playErrorAudio(ERROR_AUDIO.ARE_YOU_STILL_THERE)
        }
    }, [isIdleExempt, playErrorAudio])

    const handleIdle = useCallback(() => {
        // When the idle timer fully expires, escalate from stage 1 → stage 2.
        // The actual redirect is fired by the continue-screening stage timeout.
        if (!isIdleExempt) {
            console.log(
                "[AutoIdleRedirect] Idle timeout reached — moving to continue-screening stage."
            )
            setStage("continue-screening")
            playErrorAudio(ERROR_AUDIO.UNABLE_TO_DETECT_ANY_ACTIVITY)
        }
    }, [isIdleExempt, playErrorAudio])

    const handleActive = useCallback(() => {
        // If in 'are-you-there' stage, user activity means they are still present
        if (stage === "are-you-there") {
            stopErrorAudio() // stop any playing error audio when user resumes
            setStage(null)
        }
    }, [stage, stopErrorAudio])

    // Fired when the "continue-screening" countdown ends with no response.
    const handleFinalTimeout = useCallback(() => {
        // Guard: if the route somehow became exempt (e.g. user manually navigated
        // to /welcome) before the countdown fired, skip the redirect.
        if (isIdleExempt) {
            console.log("[AutoIdleRedirect] Final timeout suppressed — route is idle-exempt.")
            setStage(null)
            return
        }
        console.log(
            `[AutoIdleRedirect] Final timeout — cleaning up resources & redirecting to ${redirectTo}...`
        )
        stopErrorAudio() // stop any audio playing before navigating
        releaseAllResources() // release camera streams + port connections
        setStage(null)
        dispatch(resetCommonState())
        navigate(redirectTo)
    }, [dispatch, navigate, redirectTo, isIdleExempt, stopErrorAudio])

    // Uncomment while debugging to confirm which events are actually
    // being detected on your device:
    // const handleAction = (event) => console.log('[AutoIdleRedirect] action:', event?.type)

    const { activate, reset } = useIdleTimer({
        timeout: timeoutMs,
        promptBeforeIdle: promptBeforeMs,
        onPrompt: handlePrompt,
        onIdle: handleIdle,
        onActive: handleActive,
        // onAction: handleAction,
        events: ACTIVITY_EVENTS,
        debounce: 500,
        disabled: isIdleExempt,
        crossTab: true // keeps idle state in sync across multiple tabs of the same app
    })

    const handleYes = () => {
        activate()
        setStage(null)
    }

    return (
        <>
            {stage === "are-you-there" && !isIdleExempt && (
                <NoActivityFrame
                    variant="are-you-there"
                    timeoutSecs={Math.ceil(promptBeforeMs / 1000)}
                    onButtonClick={handleYes}
                    onTimeout={() => {
                        setStage("continue-screening")
                        playErrorAudio(ERROR_AUDIO.UNABLE_TO_DETECT_ANY_ACTIVITY)
                    }}
                />
            )}
            {stage === "continue-screening" && !isIdleExempt && (
                <NoActivityFrame
                    variant="continue-screening"
                    continueScreeningSecs={Math.ceil(continueScreeningMs / 1000)}
                    continueButtonDelaySecs={Math.ceil(continueButtonDelayMs / 1000)}
                    onTimeout={handleFinalTimeout}
                    onRedirect={handleFinalTimeout}
                    onButtonClick={handleYes}
                />
            )}
        </>
    )
}

export default AutoIdleRedirect
