import React, { useEffect, useRef, useState } from "react"

/**
 * FullscreenError
 *
 * Used for face-not-detected cases where we need a prominent,
 * full-screen blocker instead of the small ErrorAlert overlay.
 *
 * Props:
 *   title            {string}   - Main error heading
 *   description      {string}   - Body text explaining what to do
 *   redirectTo       {string}   - Route to navigate to after countdown (handled by parent)
 *   redirectLabel    {string}   - Human-readable label shown in countdown ("Going to home")
 *   autoRedirectDelay{number}   - ms before auto-redirect fires (default 5000)
 *   showRetry        {boolean}  - Whether to show a "Try again" button
 *   onRetry          {function} - Called when retry button is tapped
 *   onRedirect       {function} - Called when countdown reaches 0 (parent navigates)
 */
const FullscreenError = ({
    title,
    description,
    redirectLabel = "Going to home",
    autoRedirectDelay = 5000,
    showRetry = false,
    onRetry,
    onRedirect,
}) => {
    const totalSeconds = Math.round(autoRedirectDelay / 1000)
    const [secondsLeft, setSecondsLeft] = useState(totalSeconds)
    const intervalRef = useRef(null)
    const redirectFiredRef = useRef(false)

    useEffect(() => {
        // Countdown tick
        intervalRef.current = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current)
                    if (!redirectFiredRef.current) {
                        redirectFiredRef.current = true
                        onRedirect?.()
                    }
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(intervalRef.current)
    }, [onRedirect])

    const handleRetry = () => {
        clearInterval(intervalRef.current)
        onRetry?.()
    }

    // Progress: 1 → 0 over the countdown
    const progress = secondsLeft / totalSeconds

    return (
        <div
            className="
        fixed inset-0 z-50
        flex flex-col items-center justify-center
        bg-black/85
        backdrop-blur-sm
        px-8
      "
        >
            {/* Icon */}
            <div className="mb-8">
                <svg
                    viewBox="0 0 80 80"
                    className="w-20 h-20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* Circular progress ring */}
                    <circle cx="40" cy="40" r="36" stroke="#ffffff18" strokeWidth="4" />
                    <circle
                        cx="40"
                        cy="40"
                        r="36"
                        stroke="#ef4444"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 36}`}
                        strokeDashoffset={`${2 * Math.PI * 36 * (1 - progress)}`}
                        transform="rotate(-90 40 40)"
                        style={{ transition: "stroke-dashoffset 1s linear" }}
                    />
                    {/* Warning icon center */}
                    <path
                        d="M40 26v16M40 50v2"
                        stroke="#ef4444"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                    />
                </svg>
            </div>

            {/* Title */}
            <h1
                className="
          text-white text-4xl font-semibold
          text-center leading-tight
          mb-4
          max-w-xl
        "
            >
                {title}
            </h1>

            {/* Description */}
            <p
                className="
          text-white/70 text-xl
          text-center leading-relaxed
          max-w-lg
          mb-12
        "
            >
                {description}
            </p>

            {/* Retry button — only shown when re-attempt is available */}
            {showRetry && onRetry && (
                <button
                    onClick={handleRetry}
                    className="
            mb-8
            px-10 py-4
            rounded-2xl
            bg-white text-black
            text-xl font-semibold
            active:scale-95
            transition-transform
          "
                >
                    Try again
                </button>
            )}

            {/* Countdown label */}
            <div className="flex items-center gap-3 text-white/50 text-base">
                <span className="tabular-nums text-white/80 text-lg font-medium">
                    {secondsLeft}s
                </span>
                <span>—</span>
                <span>{redirectLabel}</span>
            </div>
        </div>
    )
}

export default FullscreenError