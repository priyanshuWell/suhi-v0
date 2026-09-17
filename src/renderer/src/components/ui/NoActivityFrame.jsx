import React, { useEffect, useRef, useState } from "react"
import frameBg from "../../assets/no_activity_frame.png"

/**
 * NoActivityFrame
 *
 * Single overlay component for all "kiosk needs attention" states:
 *   - auto-redirect countdown (was the old "no-user" variant)
 *   - retry flow (previously handled by the separate FullscreenError component)
 *   - are-you-there ring countdown
 *
 * FullscreenError has been folded into this component so there's one
 * overlay to maintain. Any screen that rendered <FullscreenError ... />
 * can render <NoActivityFrame variant="no-user" ... /> instead — the
 * prop names below map directly onto FullscreenError's old prop names
 * (title, description, showDescription, redirectLabel, autoRedirectDelay,
 * showRetry, onRetry) plus onRedirect as the equivalent of its old
 * onRedirect callback.
 *
 * ── Redirect mode (default, showRetry=false) ─────────────────────────
 * Shows title + description (if showDescription), then a full-color
 * fill button that counts down from `autoRedirectDelay` (ms) — or the
 * lower-level `redirectSecs` (seconds) — and fires `onRedirect` (or
 * `onButtonClick`) automatically when it reaches 0. Clicking the button
 * fires it immediately too.
 *
 * ── Retry mode (showRetry=true) ───────────────────────────────────────
 * Shows title + description (if showDescription), then a manual "Retry"
 * button. No auto-timer runs in this mode — it waits for the user (or
 * caller) to act, same as FullscreenError's retry state did.
 *
 * ── Are-you-there ring (variant="are-you-there") ───────────────────────
 * Matches the Figma dial exactly: a light grey bezelled disc with a
 * rotating blue dot marker that sweeps a full turn as `timeoutSecs`
 * counts down, and the remaining seconds shown in dark navy in the
 * center. This replaces the old hand-drawn SVG stroke-dashoffset ring.
 *
 * @param {string}   variant            "no-user" | "are-you-there" | "continue-screening"
 * @param {string}   title
 * @param {string}   subtitle           Alias: description
 * @param {string}   description        Preferred name going forward — same as subtitle
 * @param {boolean}  showDescription    Show/hide the description paragraph (default true)
 * @param {string}   buttonText         Alias: redirectLabel
 * @param {string}   redirectLabel      Preferred name — short label shown before the countdown
 * @param {number}   redirectSecs       Seconds for the redirect countdown (default 5)
 * @param {number}   autoRedirectDelay  Milliseconds — alias for redirectSecs (autoRedirectDelay / 1000)
 * @param {number}   timeoutSecs        Countdown duration for "are-you-there" (default 10)
 * @param {Function} onButtonClick      Alias: onRedirect — fires on countdown end or manual click
 * @param {Function} onRedirect         Preferred name — same as onButtonClick
 * @param {Function} onTimeout          Fires when "are-you-there" countdown reaches 0
 * @param {boolean}  showRetry          Switch to retry mode (default false)
 * @param {Function} onRetry            Fires when the Retry button is clicked
 * @param {string}   retryLabel         Retry button label (default "Retry")
 */
export default function NoActivityFrame({
    variant = "no-user",
    title,
    subtitle,
    description,
    showDescription = true,
    buttonText,
    redirectLabel,
    showButton = true,
    redirectSecs,
    autoRedirectDelay,
    timeoutSecs = 10,
    continueScreeningSecs = 10, // total countdown for continue-screening stage
    continueButtonDelaySecs = 5, // seconds before the button appears
    onButtonClick,
    onRedirect,
    onTimeout,
    showRetry = false,
    onRetry,
    retryLabel = "Retry"
}) {
    // ── prop aliasing — supports both the original prop names and the
    // FullscreenError-style names so callers don't need to change both ──
    const resolvedSubtitleRaw = description ?? subtitle
    const resolvedButtonLabel = redirectLabel ?? buttonText
    const resolvedRedirectSecs =
        autoRedirectDelay != null ? autoRedirectDelay / 1000 : (redirectSecs ?? 5)
    const resolvedOnRedirect = onRedirect ?? onButtonClick

    // ── defaults per variant ─────────────────────────────────────────
    const defaults = {
        "no-user": {
            title: "No user detected",
            subtitle: "Make sure user is standing on the kiosk and facing the camera",
            buttonLabel: "Redirecting to home"
        },
        "are-you-there": {
            title: "No activity detected",
            subtitle: "Are you there?"
        },
        "continue-screening": {
            title: "No activity detected",
            // No hardcoded subtitle here on purpose — the live "We are
            // redirecting you in {csRemaining} sec" text in the footer
            // below already shows the real countdown driven by
            // `continueScreeningSecs`. A static string here ("...5
            // seconds...") would silently disagree with it the moment
            // `continueScreeningSecs` is anything other than 5.
            buttonText: "Continue Screening"
        }
    }

    const t = title ?? defaults[variant]?.title
    const s = resolvedSubtitleRaw ?? defaults[variant]?.subtitle
    const label =
        resolvedButtonLabel ?? defaults[variant]?.buttonLabel ?? defaults[variant]?.buttonText

    // ── countdown state (variant: "are-you-there") ────────────────────
    const [remaining, setRemaining] = useState(timeoutSecs)
    const intervalRef = useRef(null)
    const firedRef = useRef(false)

    const fireTimeout = () => {
        if (firedRef.current) return
        firedRef.current = true
        clearInterval(intervalRef.current)
        onTimeout?.()
    }

    useEffect(() => {
        if (variant !== "are-you-there") return
        firedRef.current = false
        setRemaining(timeoutSecs)
        intervalRef.current = setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current)
                    setTimeout(fireTimeout, 0)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(intervalRef.current)
    }, [variant, timeoutSecs])

    // ── auto-redirect timer for "no-user" / "continue-screening" ──────
    // Skipped entirely in retry mode (showRetry=true) — that mode waits
    // for a manual click, it never auto-fires.
    const redirectTimerRef = useRef(null)
    const redirectCountIntervalRef = useRef(null)
    const redirectFiredRef = useRef(false)
    const [filling, setFilling] = useState(false)
    const [redirectRemaining, setRedirectRemaining] = useState(resolvedRedirectSecs)

    const fireRedirect = () => {
        if (redirectFiredRef.current) return
        redirectFiredRef.current = true
        clearTimeout(redirectTimerRef.current)
        clearInterval(redirectCountIntervalRef.current)
        resolvedOnRedirect?.()
    }

    useEffect(() => {
        if (variant !== "no-user" && variant !== "continue-screening") return
        if (showRetry) return // retry mode: no auto-timer

        redirectFiredRef.current = false
        setFilling(false)
        setRedirectRemaining(resolvedRedirectSecs)

        // Tick down each second; fire redirect the instant the counter hits 0 —
        // avoids any drift between the display and a separate setTimeout.
        redirectCountIntervalRef.current = setInterval(() => {
            setRedirectRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(redirectCountIntervalRef.current)
                    setTimeout(fireRedirect, 0) // same pattern as are-you-there variant
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        // One-frame delay so CSS fill transition animates from 0 → 1
        const raf = requestAnimationFrame(() => setFilling(true))

        return () => {
            cancelAnimationFrame(raf)
            clearInterval(redirectCountIntervalRef.current)
        }
    }, [variant, resolvedRedirectSecs, showRetry])

    // ── continue-screening: own countdown + delayed button reveal ─────
    const csTimerRef = useRef(null)
    const csFiredRef = useRef(false)
    const [csRemaining, setCsRemaining] = useState(continueScreeningSecs)
    const [csButtonVisible, setCsButtonVisible] = useState(false)
    // Drives the gradient button's sliding fill (same mechanism as the
    // no-user redirect button below), timed to continueScreeningSecs.
    const [csFilling, setCsFilling] = useState(false)

    const fireCsTimeout = () => {
        if (csFiredRef.current) return
        csFiredRef.current = true
        clearInterval(csTimerRef.current)
        onTimeout?.()
    }

    useEffect(() => {
        if (variant !== "continue-screening") return
        csFiredRef.current = false
        setCsRemaining(continueScreeningSecs)
        setCsButtonVisible(false)
        setCsFilling(false)

        // Show the button after `continueButtonDelaySecs` seconds
        const buttonRevealTimeout = setTimeout(() => {
            setCsButtonVisible(true)
        }, continueButtonDelaySecs * 1000)

        // Tick down the full countdown
        csTimerRef.current = setInterval(() => {
            setCsRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(csTimerRef.current)
                    setTimeout(fireCsTimeout, 0)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        // One-frame delay so the CSS fill transition animates from 0 → 1,
        // same trick used by the no-user redirect button.
        const raf = requestAnimationFrame(() => setCsFilling(true))

        return () => {
            clearTimeout(buttonRevealTimeout)
            clearInterval(csTimerRef.current)
            cancelAnimationFrame(raf)
        }
    }, [variant, continueScreeningSecs, continueButtonDelaySecs])

    // "Continue Screening" button — dismisses the overlay and resets idle.
    const handleContinueClick = () => {
        if (csFiredRef.current) return
        csFiredRef.current = true
        clearInterval(csTimerRef.current)
        // Treat as manual "still here" — delegate back to parent via onButtonClick
        onButtonClick?.()
    }

    // Manual click on the no-user redirect button fires immediately.
    const handleManualClick = () => {
        fireRedirect()
    }

    // ── are-you-there dial: smooth continuous progress ───────────────
    // `remaining` only ticks once a second (it drives the displayed number
    // and the onTimeout logic), so animating the ring off of it makes the
    // fill jump once per second instead of flowing. This tracks elapsed
    // wall-clock time via requestAnimationFrame and produces a 0→1 value
    // that updates every frame, so the ring fills smoothly regardless of
    // how often `remaining` itself updates.
    const [dialProgress, setDialProgress] = useState(0)
    const dialStartRef = useRef(null)
    const dialRafRef = useRef(null)

    useEffect(() => {
        if (variant !== "are-you-there") return

        dialStartRef.current = performance.now()
        setDialProgress(0)

        const tick = (now) => {
            const elapsed = (now - dialStartRef.current) / 1000
            const progress = Math.min(1, elapsed / timeoutSecs)
            setDialProgress(progress)
            if (progress < 1) {
                dialRafRef.current = requestAnimationFrame(tick)
            }
        }
        dialRafRef.current = requestAnimationFrame(tick)

        return () => cancelAnimationFrame(dialRafRef.current)
    }, [variant, timeoutSecs])

    const dotAngle = dialProgress * 360

    const textGold = "text-[#E5B96C]"

    // ── shared action button ──────────────────────────────────────────
    // The same dark "Continue Screening"-style button is now used in two
    // places: the continue-screening stage (delayed reveal) and below the
    // are-you-there dial (always visible). Both call back through
    // `onButtonClick`, same as before — clicking either one means "the
    // user is here," which is what actually resets the idle timer /
    // cancels the pending redirect in the parent.
    const actionButtonLabel =
        resolvedButtonLabel ?? defaults[variant]?.buttonText ?? "Continue Screening"

    const renderActionButton = (onClick, visible = true) => (
        <button
            onClick={onClick}
            className="
                px-16 py-5 rounded-[16px]
                text-white text-[20px] font-medium tracking-wide
                active:scale-[0.98] transition-all duration-300
            "
            style={{
                background: "#1a1a1a",
                border: "1px solid rgba(255,255,255,0.15)",
                boxShadow:
                    "0 0 24px rgba(100,180,220,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(8px)",
                pointerEvents: visible ? "auto" : "none",
                transition: "opacity 0.4s ease, transform 0.4s ease"
            }}
        >
            {actionButtonLabel}
        </button>
    )

    // ── shared gradient "sliding fill" redirect button ──────────────────
    // Same button used by the no-user variant, generalized so
    // continue-screening can show its own redirect countdown ("Redirecting
    // in {csRemaining} secs...") with the identical gradient + fill
    // animation, instead of duplicating the markup.
    const renderGradientButton = ({ label, remaining, totalSecs, filling, onClick }) => (
        <div
            onClick={onClick}
            className="
                relative overflow-hidden rounded-lg
                w-[36rem]
                h-24
                cursor-pointer select-none
            "
            style={{
                borderRadius: "10px",
                border: "2.996px solid #FFF",
                background:
                    "radial-gradient(43.11% 181.04% at 50% 50%, #002EB9 0%, #0097D6 100%)",
                boxShadow:
                    "0 0 21.462px 0 #FFF inset, 0 -71.895px 95.861px 0 rgba(255, 255, 255, 0.24) inset, 0 23.965px 35.77px -47.93px rgba(255, 255, 255, 0.24) inset"
            }}
        >
            {/* Fill layer — slides the whole button from empty to full color
                over totalSecs, driven by `filling`, so it always matches
                when the redirect actually fires. */}
            <div
                className="absolute inset-0 rounded-lg bg-white/25 origin-left pointer-events-none"
                style={{
                    borderRadius: "10px",
                    transform: filling ? "scaleX(1)" : "scaleX(0)",
                    transition: filling ? `transform ${totalSecs}s linear` : "none"
                }}
            />

            {/* Label with live inline countdown */}
            <div className="absolute inset-0 flex items-center justify-center px-4">
                <span className="text-white text-[22px] font-medium tracking-wide relative z-10 text-center">
                    {label} in{" "}
                    <span style={{ fontWeight: 700, color: "#fff" }}>{remaining}</span> secs...
                </span>
            </div>
        </div>
    )

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="relative w-full ">
                {/* PNG background frame */}
                <img src={frameBg} alt="" className="w-full h-auto block" draggable={false} />

                {/* Content overlay */}
                <div className="absolute inset-[14px] flex flex-col items-center justify-center gap-5 px-8">
                    {/* Title with warning icon */}
                    <h2
                        className={`flex items-center gap-3 ${textGold} text-[28px] font-semibold tracking-wide text-center`}
                    >
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border-[2.5px] border-[#E5B96C] text-[16px] leading-none">
                            !
                        </span>
                        {t}
                    </h2>

                    {/* Description — hidden entirely when showDescription=false,
                        e.g. FullscreenError's retry state ("keep it minimal, retries left") */}
                    {showDescription && s && (
                        <p
                            className={`${textGold} text-[24px] text-center max-w-[420px] leading-relaxed opacity-90`}
                        >
                            {s}
                        </p>
                    )}

                    {/* Variant-specific footer */}
                    <div className="mt-1">
                        {/* ═══ VARIANT 1: Full-Color Sliding Fill Redirect Button, or Retry Button ═══ */}
                        {variant === "no-user" &&
                            showButton &&
                            (showRetry ? (
                                // ── Retry mode: manual button, no auto-timer ──
                                <button
                                    onClick={onRetry}
                                    className="
                    relative rounded-lg
                    w-[clamp(16rem,36vw,26rem)] h-14
                    text-white text-[17px] font-medium tracking-wide
                    active:scale-[0.98] transition-transform duration-150
                  "
                                    style={{
                                        borderRadius: "10px",
                                        border: "2.996px solid #FFF",
                                        background:
                                            "radial-gradient(43.11% 181.04% at 50% 50%, rgba(0, 46, 185, 0.50) 0%, rgba(0, 151, 214, 0.50) 100%)",
                                        boxShadow:
                                            "0 0 21.462px 0 #FFF inset, 0 -71.895px 95.861px 0 rgba(255, 255, 255, 0.24) inset, 0 23.965px 35.77px -47.93px rgba(255, 255, 255, 0.24) inset"
                                    }}
                                >
                                    {retryLabel}
                                </button>
                            ) : (
                                // ── Redirect mode: fill animates + auto-fires ──
                                renderGradientButton({
                                    label,
                                    remaining: redirectRemaining,
                                    totalSecs: resolvedRedirectSecs,
                                    filling,
                                    onClick: handleManualClick
                                })
                            ))}

                        {/* ═══ VARIANT 2: Countdown Dial (matches Figma "are-you-there" node) ═══
                            Note: Figma's dial + dot are exported raster/vector assets that this
                            environment couldn't fetch (figma.com isn't on the network allowlist
                            for this container), so the disc, bezel and dot below are recreated
                            with CSS gradients/shadows to match the screenshot rather than the
                            original asset bytes. Swap in the real exported PNG/SVG if you have
                            it locally for pixel-perfect fidelity. */}
                        {variant === "are-you-there" && (
                            <div
                                className="relative flex items-center justify-center  ml-24"
                                style={{ width: 150, height: 150 }}
                            >
                                {/* Track + fill ring — an SVG stroke instead of a CSS
                                    conic-gradient. Browsers can't smoothly transition a
                                    conic-gradient's angle (it just snaps), which is why the
                                    fill used to jump once a second; stroke-dashoffset is a
                                    plain number that updates every animation frame via
                                    `dialProgress`, so the fill flows continuously. */}
                                <svg
                                    className="absolute inset-0"
                                    width={150}
                                    height={150}
                                    viewBox="0 0 200 200"
                                    style={{ transform: "rotate(-90deg)" }}
                                >
                                    <circle
                                        cx={100}
                                        cy={100}
                                        r={93}
                                        fill="none"
                                        stroke="#d7dbe0"
                                        strokeWidth={14}
                                    />
                                    <circle
                                        cx={100}
                                        cy={100}
                                        r={93}
                                        fill="none"
                                        stroke="#2FA6E0"
                                        strokeWidth={14}
                                        strokeLinecap="round"
                                        strokeDasharray={2 * Math.PI * 93}
                                        strokeDashoffset={2 * Math.PI * 93 * (1 - dialProgress)}
                                        style={{ filter: "drop-shadow(0 0 4px rgba(47,166,224,0.6))" }}
                                    />
                                </svg>

                                {/* Dial face — sits inside the ring, same bezel look as before */}
                                <div
                                    className="absolute rounded-full"
                                    style={{
                                        inset: 14,
                                        background:
                                            "radial-gradient(circle at 35% 30%, #f6f7f8 0%, #dde0e4 55%, #c6cad0 100%)",
                                        boxShadow:
                                            "inset 0 4px 10px rgba(255,255,255,0.9), inset 0 -8px 16px rgba(0,0,0,0.18), 0 4px 14px rgba(0,0,0,0.3)"
                                    }}
                                />

                                {/* Rotating blue dot marker — leading edge of the fill ring,
                                    sweeps one full turn over timeoutSecs */}
                                <div
                                    className="absolute inset-0"
                                    style={{
                                        transform: `rotate(${dotAngle}deg)`
                                    }}
                                >
                                    <span
                                        className="absolute rounded-full"
                                        style={{
                                            top: -1,
                                            left: "50%",
                                            width: 16,
                                            height: 16,
                                            marginLeft: -8,
                                            background: "#2FA6E0",
                                            boxShadow: "0 0 8px rgba(47,166,224,0.85)"
                                        }}
                                    />
                                </div>

                                {/* Remaining seconds, centered */}
                                <span
                                    className="relative font-anta"
                                    style={{ color: "#03275a", fontSize: 46, fontWeight: 400 }}
                                >
                                    {remaining}
                                </span>
                            </div>
                        )}

                        {/* Button below the are-you-there dial — same button used by
                            continue-screening, always visible (no reveal delay), wired
                            straight to onButtonClick so clicking it counts as "the user
                            is here" and cancels the pending escalation to
                            continue-screening, exactly like the auto-timeout NOT firing. */}
                        {variant === "are-you-there" && (
                            <div className="flex flex-col items-center mt-6">
                                {renderActionButton(() => onButtonClick?.())}
                            </div>
                        )}

                        {/* ═══ VARIANT 3: Continue Screening ═══ */}
                        {variant === "continue-screening" && (
                            <div className="flex flex-col items-center gap-6">
                                {/* Gradient redirect button — same sliding-fill button used
                                    by the no-user variant, showing the live redirect
                                    countdown instead of a plain text line. */}
                                {renderGradientButton({
                                    label: "Redirecting",
                                    remaining: csRemaining,
                                    totalSecs: continueScreeningSecs,
                                    filling: csFilling,
                                    onClick: handleContinueClick
                                })}

                                {/* Button appears after continueButtonDelaySecs, centered */}
                                <div className="flex justify-center w-full">
                                    {renderActionButton(handleContinueClick, csButtonVisible)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}