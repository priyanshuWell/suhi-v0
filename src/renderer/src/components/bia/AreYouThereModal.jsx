import React, { useEffect, useRef, useState } from "react";
import textbgframe from "../../assets/textbgframe.svg";

/**
 * Reusable "Are you there?" modal with a visible countdown.
 * - onNo fires for both explicit "No" tap AND natural timer expiry.
 * - Fully self-contained — no global state, no side effects.
 *
 * @param {number}   timeoutSecs  Duration for the countdown (default 10)
 * @param {Function} onYes        Called when user taps "Yes"
 * @param {Function} onNo         Called when user taps "No" OR timer reaches 0
 */
export default function AreYouThereModal({ timeoutSecs = 10, onYes, onNo, playAudio }) {
    const [remaining, setRemaining] = useState(timeoutSecs);
    const intervalRef = useRef(null);
    const firedRef = useRef(false); // prevent double-fire
    const [isAudioPlaying, setIsAudioPlaying] = useState(true);

    const fireNo = () => {
        if (firedRef.current || isAudioPlaying) return;
        firedRef.current = true;
        clearInterval(intervalRef.current);
        onNo?.();
    };

    const fireYes = () => {
        if (firedRef.current || isAudioPlaying) return;
        firedRef.current = true;
        clearInterval(intervalRef.current);
        onYes?.();
    };

    useEffect(() => {
        // Play the "are you still there?" audio on mount
        playAudio?.('errors/are_you_still_there')?.then?.(() => {
            setIsAudioPlaying(false);
        });

        intervalRef.current = setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current);
                    // defer so state settles before callback
                    setTimeout(fireNo, 0);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(intervalRef.current);
    }, []);

    // Stroke-dasharray progress ring
    const RADIUS = 28;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
    const progress = remaining / timeoutSecs;
    const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div
                className="relative w-screen"
                style={{ filter: "drop-shadow(0px 0px 40px rgba(139, 195, 229, 0.4))" }}
            >
                <img src={textbgframe} alt="" className="w-full h-full block" draggable={false} />

                <div
                    className="absolute flex flex-col items-center justify-center gap-8"
                    style={{ top: "14%", bottom: "20%", left: "14%", right: "14%" }}
                >
                    {/* Title */}
                    <h2 className="text-[#8BC3E5] text-[40px] font-anta text-center m-0">
                        Are you there?
                    </h2>

                    {/* Countdown ring */}
                    <div className="relative flex items-center justify-center">
                        <svg width="80" height="80">
                            {/* Track */}
                            <circle
                                cx="40" cy="40" r={RADIUS}
                                fill="none"
                                stroke="rgba(255,255,255,0.15)"
                                strokeWidth="6"
                            />
                            {/* Progress */}
                            <circle
                                cx="40" cy="40" r={RADIUS}
                                fill="none"
                                stroke="#8BC3E5"
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={CIRCUMFERENCE}
                                strokeDashoffset={strokeDashoffset}
                                transform="rotate(-90 40 40)"
                                style={{ transition: "stroke-dashoffset 0.9s linear" }}
                            />
                        </svg>
                        <span className="absolute text-white text-2xl font-anta">{remaining}</span>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-10">
                        <button
                            onClick={fireYes}
                            disabled={isAudioPlaying}
                            className={`
                w-[200px] h-[80px]
                rounded-[30px]
                border-2 border-white/50
                bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)]
                shadow-[0px_0px_30px_rgba(0,179,255,0.5),inset_0px_0px_20px_rgba(255,255,255,0.3)]
                text-white text-2xl font-anta
                hover:border-white
                active:scale-[0.98]
                transition-all duration-200
                ${isAudioPlaying ? 'opacity-50 cursor-not-allowed' : ''}
              `}
                        >
                            Yes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}