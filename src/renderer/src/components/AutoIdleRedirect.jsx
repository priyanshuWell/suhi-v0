import React, { useState, useCallback } from 'react'
import { useIdleTimer } from 'react-idle-timer'
import { useNavigate, useLocation } from 'react-router'
import { useDispatch } from 'react-redux'
import { resetCommonState } from '../features/common/commonSlice'
import AreYouThereModal from './ui/AreYouThereModal'
import NoActivityFrame from './ui/NoActivityFrame'

/**
 * AutoIdleRedirect
 *
 * Watches for user inactivity across the whole app. If the user is idle
 * for `timeoutMs`, they get a "prompt" window of `promptBeforeMs` where
 * a confirmation modal shows up. If they don't respond, Redux state is
 * reset and they're redirected to `redirectTo`.
 *
 * Disabled entirely on the home/redirect route itself, so it doesn't
 * try to redirect you away from the page you already got redirected to.
 */

// Explicit event list — this is the fix for touchscreens/tablets that
// only emit Pointer Events (pointerdown/pointermove) instead of, or in
// addition to, legacy touch events (touchstart/touchmove). Without this,
// the library's defaults miss those devices entirely and touching the
// screen never resets the idle timer.
const ACTIVITY_EVENTS = [
    'mousemove',
    'mousedown',
    'keydown',
    'wheel',
    'DOMMouseScroll',
    'mousewheel',
    'touchstart',
    'touchmove',
    'pointerdown',
    'pointermove',
    'MSPointerDown',
    'MSPointerMove',
    'visibilitychange'
]

const AutoIdleRedirect = ({
    timeoutMs = 120000,
    promptBeforeMs = 10000,
    redirectTo = '/welcome'
}) => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const location = useLocation()
    const [isPrompted, setIsPrompted] = useState(false)

    // Disable on home/splash routes — no point idling-out a page you'd
    // just get redirected back to anyway.
    const isHomeRoute = location.pathname === '/' || location.pathname === redirectTo

    const handlePrompt = useCallback(() => {
        if (!isHomeRoute) {
            setIsPrompted(true)
        }
    }, [isHomeRoute])

    const handleIdle = useCallback(() => {
        setIsPrompted(false)
        if (!isHomeRoute) {
            console.log(
                `[AutoIdleRedirect] Idle timeout reached. Resetting Redux state & redirecting to ${redirectTo}...`
            )
            dispatch(resetCommonState())
            navigate(redirectTo)
        }
    }, [isHomeRoute, dispatch, navigate, redirectTo])

    const handleActive = useCallback(() => {
        setIsPrompted(false)
    }, [])

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
        disabled: isHomeRoute,
        crossTab: true // keeps idle state in sync across multiple tabs of the same app
    })

    const handleYes = () => {
        activate()
        setIsPrompted(false)
    }

    const handleNo = () => {
        reset()
        setIsPrompted(false)
        if (!isHomeRoute) {
            dispatch(resetCommonState())
            navigate(redirectTo)
        }
    }

    if (isPrompted && !isHomeRoute) {
        return (
            <NoActivityFrame
                variant="are-you-there"
                timeoutSecs={Math.ceil(promptBeforeMs / 1000)}
                onButtonClick={handleYes}
                onTimeout={handleNo}
            />
        )
    }

    return null
}

export default AutoIdleRedirect