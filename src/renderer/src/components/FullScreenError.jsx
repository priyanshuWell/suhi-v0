import React, { useEffect, useRef, useState } from "react"

/**
 * FullscreenError
 *
 * Behaviour:
 *  - showRetry = true  → show "Try again" button (no auto-redirect countdown running)
 *                        + a separate "Going to X in 5s" Netflix-fill button that
 *                        auto-redirects if the user ignores the retry button
 *  - showRetry = false → last attempt or no-retry case:
 *                        show error prominently + Netflix-fill button auto-redirects
 *
 * The Netflix-fill button always counts down. On showRetry screens the user can
 * tap "Try again" to cancel the countdown and retry instead.
 *
 * Props:
 *   title              {string}    Main error heading
 *   description        {string}    Body copy — shown on LAST attempt only
 *   showDescription    {boolean}   Parent controls whether description is visible
 *   redirectLabel      {string}    Label inside Netflix button e.g. "Going to home"
 *   autoRedirectDelay  {number}    ms for the fill animation + auto-redirect (default 5000)
 *   showRetry          {boolean}   Show the "Try again" button
 *   onRetry            {function}  Called when retry is tapped (cancels redirect)
 *   onRedirect         {function}  Called when fill completes (parent navigates)
 */
const FullscreenError = ({
    title,
    description,
    showDescription = false,
    redirectLabel = "Going to home",
    autoRedirectDelay = 5000,
    showRetry = false,
    onRetry,
    onRedirect,
}) => {
    const [filling, setFilling] = useState(false)
    const [redirectCancelled, setRedirectCancelled] = useState(false)
    const redirectFiredRef = useRef(false)
    const timeoutRef = useRef(null)

    // Start fill animation shortly after mount so CSS transition picks it up
    useEffect(() => {
        const startDelay = setTimeout(() => setFilling(true), 80)
        return () => clearTimeout(startDelay)
    }, [])

    // Fire redirect when fill completes
    useEffect(() => {
        if (redirectCancelled) return

        timeoutRef.current = setTimeout(() => {
            if (!redirectFiredRef.current && !redirectCancelled) {
                redirectFiredRef.current = true
                onRedirect?.()
            }
        }, autoRedirectDelay + 80) // slight offset to match CSS transition end

        return () => clearTimeout(timeoutRef.current)
    }, [autoRedirectDelay, onRedirect, redirectCancelled])

    const handleRetry = () => {
        // Cancel the pending redirect
        clearTimeout(timeoutRef.current)
        setRedirectCancelled(true)
        setFilling(false)
        onRetry?.()
    }

    const fillDurationSec = autoRedirectDelay / 1000

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md px-8">

            {/* Warning icon */}
            <div className="mb-8">
                <svg viewBox="0 0 72 72" className="w-16 h-16" fill="none">
                    <circle cx="36" cy="36" r="34" stroke="#ef444440" strokeWidth="2" />
                    <path
                        d="M36 20v20M36 46v3"
                        stroke="#ef4444"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                    />
                    <circle cx="36" cy="36" r="34" stroke="#ef4444" strokeWidth="2" strokeDasharray="6 4" />
                </svg>
            </div>

            {/* Title — always visible */}
            <h1 className="text-white text-4xl font-semibold text-center leading-tight mb-4 max-w-xl">
                {title}
            </h1>

            {/* Description — only on last attempt */}
            {showDescription && description && (
                <p className="text-white/65 text-xl text-center leading-relaxed max-w-lg mb-10 animate-fadeIn">
                    {description}
                </p>
            )}

            {/* Spacer when no description */}
            {!showDescription && <div className="mb-10" />}

            {/* Try again button — only when retries remain */}
            {showRetry && onRetry && (
                <button
                    onClick={handleRetry}
                    className="
            mb-6 px-12 py-4 rounded-2xl
            border-2 border-white/80
            text-white text-xl font-semibold
            active:scale-95 transition-transform duration-150
            hover:bg-white/10
          "
                >
                    Try again
                </button>
            )}

            {/* Netflix-style fill button */}
            <div
                className="
          relative overflow-hidden
          rounded-2xl
          w-[clamp(16rem,36vw,26rem)]
          h-14
          mt-2
          cursor-default
          select-none
        "
            >
                {/* Track (dark background) */}
                <div className="absolute inset-0 bg-white/10 rounded-2xl" />

                {/* Fill layer */}
                <div
                    className="absolute inset-0 rounded-2xl bg-white/25 origin-left"
                    style={{
                        transform: filling ? "scaleX(1)" : "scaleX(0)",
                        transition: filling
                            ? `transform ${fillDurationSec}s linear`
                            : "none",
                    }}
                />

                {/* Label */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 px-4">
                    <span className="text-white/80 text-base font-medium tracking-wide truncate">
                        {redirectLabel}
                    </span>
                    {/* Animated dots */}
                    <span className="flex gap-[3px] items-center mt-0.5">
                        {[0, 1, 2].map((i) => (
                            <span
                                key={i}
                                className="w-1 h-1 rounded-full bg-white/60"
                                style={{
                                    animation: "dotBounce 1.2s infinite",
                                    animationDelay: `${i * 0.2}s`,
                                }}
                            />
                        ))}
                    </span>
                </div>
            </div>

            <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-3px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease forwards;
        }
      `}</style>
        </div>
    )
}

export default FullscreenError