import React, { useEffect, useRef, useState } from "react"

/**
 * ErrorAlert
 *
 * Displays a full-screen error banner. Lifecycle is entirely controlled by the
 * parent via the `visible` prop — this component does NOT self-dismiss.
 *
 * When `visible` flips true  → slide in
 * When `visible` flips false → play 800ms slide-out animation, then hide
 *
 * Why no internal timer? The parent (`showError` in BIACalcuate.jsx) already
 * awaits Promise.all([sleep(duration), audioPromise]) before setting
 * errorState=null, so the banner stays up for whichever is longer — the
 * minimum display time OR the audio clip. Having a 3 s internal timer here
 * caused the banner to vanish (and call onClose) while audio was still playing.
 */
export default function ErrorAlert({ title, description, visible, onClose, onRetry }) {
    // true  = banner is mounted and visible in the DOM
    // false = hidden (either never shown, or exit animation finished)
    const [isMounted, setIsMounted] = useState(false)
    const [isExiting, setIsExiting] = useState(false)
    const exitTimerRef = useRef(null)

    useEffect(() => {
        if (visible) {
            // Cancel any in-flight exit animation and show immediately
            clearTimeout(exitTimerRef.current)
            setIsExiting(false)
            setIsMounted(true)
        } else {
            if (!isMounted) return // nothing to animate out

            // Start slide-out, then unmount after animation completes
            setIsExiting(true)
            exitTimerRef.current = setTimeout(() => {
                setIsExiting(false)
                setIsMounted(false)
            }, 800) // matches the CSS transition duration
        }

        return () => clearTimeout(exitTimerRef.current)
    }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

    if (!isMounted) return null

    return (
        <div
            className={`
        fixed inset-0 z-50 flex items-center justify-center 
        transition-opacity duration-300
        ${isExiting ? "opacity-0" : "bg-black/60"}
      `}
        >
            {/* SVG WRAPPER */}
            <div
                className={`
          relative
          w-[90%]
          max-w-[1427px]
          aspect-[1427/246]
          transition-all duration-800 ease-in-out
          ${isExiting ? "translate-y-[150vh] opacity-0" : "translate-y-0 opacity-100"}
        `}
            >
                <svg
                    width="1427"
                    className="w-full"
                    height="246"
                    viewBox="0 0 1427 246"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        opacity="0.3"
                        d="M1341.71 142.879L1383.08 65.8482L465.244 65.227L435.691 25.4689L124.959 24.8477L36.2988 188.85L62.4749 220.532L1191.41 221.774L1341.71 142.879Z"
                        fill="#FFC568"
                    />
                    <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M1196.49 242.894H1194.8L32.0863 242.273L0 202.515V201.273L107.236 3.72461H459.342L488.051 43.4827L1424.47 44.1039L1364.52 154.681L1196.49 242.894ZM36.3082 236.061L1193.95 237.303L1358.61 150.954L1412.65 49.6949L483.829 49.0736L455.121 9.31555H113.147L8.44379 201.894L36.3082 236.061Z"
                        fill="#FFC568"
                    />
                    <path
                        d="M600.354 0L624.84 32.3035H657.771L633.284 0H600.354ZM541.247 0L565.734 32.3035H598.665L573.333 0H541.247ZM482.141 0L507.472 32.3035H539.558L515.071 0H482.141ZM778.517 0L803.005 32.3035H835.935L811.448 0H778.517ZM659.46 0L684.792 32.3035H717.722L692.391 0H659.46ZM718.567 0L743.898 32.3035H776.829L751.497 0H718.567ZM896.731 0.621258L921.218 32.3035H954.148L929.662 0.621258H896.731ZM955.837 0.621258L980.324 32.3035L1013.25 32.9248L988.768 0.621258H955.837ZM836.78 0.621258L862.111 32.3035H894.198L869.71 0.621258H836.78ZM1014.94 0.621258L1039.43 32.9248H1072.36L1047.87 0.621258H1014.94ZM1133.16 0.621258L1157.64 32.9248H1190.57L1166.09 0.621258H1133.16ZM1073.21 0.621258L1098.54 32.9248H1131.47L1106.14 0.621258H1073.21ZM1310.48 0.621258L1335.81 32.9248H1367.89L1343.41 0.621258H1310.48ZM1251.37 0.621258L1275.86 32.9248H1308.79L1284.3 0.621258H1251.37ZM1191.42 0.621258L1216.75 32.9248H1248.84L1224.35 0.621258H1191.42ZM1369.58 1.24252L1394.07 32.9248H1427L1402.51 1.24252H1369.58Z"
                        fill="#FFC568"
                    />
                    <path
                        d="M1354.38 181.393L1318.91 245.999H1231.1L1354.38 181.393Z"
                        fill="#FFC568"
                    />
                </svg>

                {/* === TEXT OVERLAY === */}
                <div
                    className="
            absolute inset-0
            flex flex-col
            items-center justify-center
            text-center
            px-16
          "
                >
                    <h2 className="flex mt-4 text-4xl font-semibold text-[#FFC568] whitespace-pre-line">
                        {title}
                    </h2>
                    {description && (
                        <p className="mt-2 text-lg text-[#FFC568]/80 whitespace-pre-line">
                            {description}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
