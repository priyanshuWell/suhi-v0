import React, { useEffect, useRef, useState } from "react";
import frameBg from "../../assets/no_activity_frame.png";

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
    onButtonClick,
    onRedirect,
    onTimeout,
    showRetry = false,
    onRetry,
    retryLabel = "Retry",
}) {
    // ── prop aliasing — supports both the original prop names and the
    // FullscreenError-style names so callers don't need to change both ──
    const resolvedSubtitleRaw = description ?? subtitle;
    const resolvedButtonLabel = redirectLabel ?? buttonText;
    const resolvedRedirectSecs =
        autoRedirectDelay != null ? autoRedirectDelay / 1000 : redirectSecs ?? 5;
    const resolvedOnRedirect = onRedirect ?? onButtonClick;

    // ── defaults per variant ─────────────────────────────────────────
    const defaults = {
        "no-user": {
            title: "No user detected",
            subtitle: "Make sure user is standing on the kiosk and facing the camera",
            buttonLabel: "Redirecting to home",
        },
        "are-you-there": {
            title: "No activity detected",
            subtitle: "Are you there?",
        },
        "continue-screening": {
            title: "No activity detected",
            subtitle: "Redirecting to homepage in 5 seconds...",
            buttonText: "Continue Screening",
        },
    };

    const t = title ?? defaults[variant]?.title;
    const s = resolvedSubtitleRaw ?? defaults[variant]?.subtitle;
    const label = resolvedButtonLabel ?? defaults[variant]?.buttonLabel ?? defaults[variant]?.buttonText;

    // ── countdown state (variant: "are-you-there") ────────────────────
    const [remaining, setRemaining] = useState(timeoutSecs);
    const intervalRef = useRef(null);
    const firedRef = useRef(false);

    const fireTimeout = () => {
        if (firedRef.current) return;
        firedRef.current = true;
        clearInterval(intervalRef.current);
        onTimeout?.();
    };

    useEffect(() => {
        if (variant !== "are-you-there") return;
        firedRef.current = false;
        setRemaining(timeoutSecs);
        intervalRef.current = setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current);
                    setTimeout(fireTimeout, 0);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(intervalRef.current);
    }, [variant, timeoutSecs]);

    // ── auto-redirect timer for "no-user" / "continue-screening" ──────
    // Skipped entirely in retry mode (showRetry=true) — that mode waits
    // for a manual click, it never auto-fires.
    const redirectTimerRef = useRef(null);
    const redirectCountIntervalRef = useRef(null);
    const redirectFiredRef = useRef(false);
    const [filling, setFilling] = useState(false);
    const [redirectRemaining, setRedirectRemaining] = useState(resolvedRedirectSecs);

    const fireRedirect = () => {
        if (redirectFiredRef.current) return;
        redirectFiredRef.current = true;
        clearTimeout(redirectTimerRef.current);
        clearInterval(redirectCountIntervalRef.current);
        resolvedOnRedirect?.();
    };

    useEffect(() => {
        if (variant !== "no-user" && variant !== "continue-screening") return;
        if (showRetry) return; // retry mode: no auto-timer

        redirectFiredRef.current = false;
        setFilling(false);
        setRedirectRemaining(resolvedRedirectSecs);

        // Tick down each second; fire redirect the instant the counter hits 0 —
        // avoids any drift between the display and a separate setTimeout.
        redirectCountIntervalRef.current = setInterval(() => {
            setRedirectRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(redirectCountIntervalRef.current);
                    setTimeout(fireRedirect, 0); // same pattern as are-you-there variant
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // One-frame delay so CSS fill transition animates from 0 → 1
        const raf = requestAnimationFrame(() => setFilling(true));

        return () => {
            cancelAnimationFrame(raf);
            clearInterval(redirectCountIntervalRef.current);
        };
    }, [variant, resolvedRedirectSecs, showRetry]);

    // Manual click on the redirect button fires immediately too.
    const handleManualClick = () => {
        fireRedirect();
    };

    // ── countdown ring math (are-you-there) ────────────────────────────
    const RADIUS = 28;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
    const progress = remaining / timeoutSecs;
    const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

    const textGold = "text-[#E5B96C]";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="relative w-full ">
                {/* PNG background frame */}
                <img
                    src={frameBg}
                    alt=""
                    className="w-full h-auto block"
                    draggable={false}
                />

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
                        {variant === "no-user" && showButton && (
                            showRetry ? (
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
                                            "0 0 21.462px 0 #FFF inset, 0 -71.895px 95.861px 0 rgba(255, 255, 255, 0.24) inset, 0 23.965px 35.77px -47.93px rgba(255, 255, 255, 0.24) inset",
                                    }}
                                >
                                    {retryLabel}
                                </button>
                            ) : (
                                // ── Redirect mode: fill animates + auto-fires ──
                                <div
                                    onClick={handleManualClick}
                                    className="
                    relative overflow-hidden rounded-lg
                    w-[34rem]
                    h-20
                    cursor-pointer select-none
                  "
                                    style={{
                                        borderRadius: "10px",
                                        border: "2.996px solid #FFF",
                                        background: "radial-gradient(43.11% 181.04% at 50% 50%, #002EB9 0%, #0097D6 100%)",
                                        boxShadow: "0 0 21.462px 0 #FFF inset, 0 -71.895px 95.861px 0 rgba(255, 255, 255, 0.24) inset, 0 23.965px 35.77px -47.93px rgba(255, 255, 255, 0.24) inset",
                                    }}
                                >
                                    {/* Fill layer — slides the whole button from empty to full color
                                        over resolvedRedirectSecs, driven by the real `filling` state
                                        above, so it always matches when the auto-redirect actually fires. */}
                                    <div
                                        className="absolute inset-0 rounded-lg bg-white/25 origin-left pointer-events-none"
                                        style={{
                                            borderRadius: "10px",
                                            transform: filling ? "scaleX(1)" : "scaleX(0)",
                                            transition: filling
                                                ? `transform ${resolvedRedirectSecs}s linear`
                                                : "none",
                                        }}
                                    />

                                    {/* Label with live inline countdown */}
                                    <div className="absolute inset-0 flex items-center justify-center px-4">
                                        <span className="text-white text-[20px] font-medium tracking-wide relative z-10 text-center">
                                            {label} in{" "}
                                            <span style={{ fontWeight: 700, color: "#fff" }}>
                                                {redirectRemaining}
                                            </span>{" "}
                                            sec...
                                        </span>
                                    </div>
                                </div>
                            )
                        )}

                        {/* ═══ VARIANT 2: Countdown Ring ═══ */}
                        {variant === "are-you-there" && (
                            <div className="relative flex items-center justify-center w-[88px] h-[88px]">
                                <svg width="88" height="88" className="absolute">
                                    <circle
                                        cx="44"
                                        cy="44"
                                        r={RADIUS}
                                        fill="none"
                                        stroke="rgba(255,255,255,0.12)"
                                        strokeWidth="7"
                                    />
                                    <circle
                                        cx="44"
                                        cy="44"
                                        r={RADIUS}
                                        fill="none"
                                        stroke="#4AA8D8"
                                        strokeWidth="7"
                                        strokeLinecap="round"
                                        strokeDasharray={CIRCUMFERENCE}
                                        strokeDashoffset={strokeDashoffset}
                                        transform="rotate(-90 44 44)"
                                        style={{ transition: "stroke-dashoffset 0.9s linear" }}
                                    />
                                </svg>
                                <span className="absolute text-[#1a4a6e] text-[26px] font-bold font-anta">
                                    {remaining}
                                </span>
                            </div>
                        )}

                        {/* ═══ VARIANT 3: Continue Screening ═══ */}
                        {variant === "continue-screening" && (
                            <button
                                onClick={handleManualClick}
                                className="
                  px-12 py-3.5 rounded-[14px]
                  text-white text-[17px] font-medium tracking-wide
                  active:scale-[0.98] transition-all duration-200
                "
                                style={{
                                    background: "#1a1a1a",
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    boxShadow:
                                        "0 0 24px rgba(100,180,220,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
                                }}
                            >
                                {label}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}