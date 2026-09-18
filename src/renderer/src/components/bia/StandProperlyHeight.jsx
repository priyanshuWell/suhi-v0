import React, { useEffect, useRef } from "react"
import bg1 from "../../assets/lightbg.png"

/**
 * StandProperlyHeight
 *
 * A fullscreen video-instruction overlay, shown when height measurement fails.
 * Modelled after BIAComponent.
 *
 * Props
 * ─────
 *  video        – { male: <videoSrc>, female: <videoSrc> }
 *  male         – (optional) direct male video src (convenience alias)
 *  female       – (optional) direct female video src (convenience alias)
 *  title        – primary heading text
 *  description  – sub-heading text (alias: subtitle)
 *  subtitle     – alias for description
 *  gender       – "male" | "female" string  OR  a user object with
 *                 user?.data?.gender (same shape used in BIAComponent)
 *  countdown    – optional number (seconds remaining); displayed as a
 *                 live countdown badge so the user knows how long to hold
 */
const StandProperlyHeight = ({
    video,
    male,
    female,
    title,
    description,
    subtitle,
    gender,
    countdown
}) => {
    const videoRef = useRef(null)

    /* ── Resolve gender string from either a string or a user object ── */
    const genderStr =
        typeof gender === "string"
            ? gender
            : gender?.data?.gender ?? gender?.gender ?? "male"

    const resolvedGender = genderStr?.toLowerCase() === "female" ? "female" : "male"

    /* ── Resolve gender-specific video src ── */
    const videoSrc =
        video?.[resolvedGender] ??
        (resolvedGender === "female" ? female : male) ??
        null

    /* ── Resolve description text (supports both prop names) ── */
    const descText = description ?? subtitle ?? null

    /* ── Re-play whenever the video source changes ── */
    useEffect(() => {
        const vid = videoRef.current
        if (!vid) return
        vid.load()
        vid.play().catch((err) => console.warn("[StandProperlyHeight] Video play failed:", err))
    }, [videoSrc])

    return (
        <div className="fixed inset-0 w-screen h-screen overflow-hidden" style={{ zIndex: 50 }}>
            {/* Background */}
            <div
                className="absolute inset-0 bg-center bg-cover z-0"
                style={{ backgroundImage: `url(${bg1})` }}
            />

            {/* Dark translucent overlay so the modal reads clearly */}
            <div
                className="absolute inset-0 z-10"
                style={{ background: "rgba(0,0,0,0.45)" }}
            />

            {/* Title + Description */}
            <div className="absolute landscape:top-15 landscape:left-[20%] portrait:top-30 portrait:left-[20%] z-20 w-[60%] pt-6">
                <div className="relative flex flex-col items-center">
                    {title && (
                        <p className="text-white text-center portrait:text-[44px] tracking-wider">
                            {title}
                        </p>
                    )}
                    {descText && (
                        <p className="mt-6 text-[#8BC3E5] font-medium tracking-tight landscape:text-4xl portrait:text-[38px] text-center">
                            {descText}
                        </p>
                    )}
                </div>
            </div>

            {/* Video */}
            {videoSrc && (
                <div className="absolute z-20 inset-0 flex justify-center items-end mb-40 xl:items-center xl:justify-center pointer-events-none mt-[26rem]">
                    <div
                        style={{
                            position: "relative",
                            width: "65%",
                            display: "flex",
                            justifyContent: "center"
                        }}
                    >
                        <video
                            ref={videoRef}
                            key={videoSrc}
                            src={videoSrc}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="rounded-4xl object-cover w-full"
                        />
                    </div>
                </div>
            )}

            {/* Countdown badge — shown when countdown prop is provided */}
            {countdown != null && (
                <div
                    className="absolute z-30"
                    style={{
                        bottom: "60px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "rgba(0,0,0,0.55)",
                        border: "2px solid rgba(139,195,229,0.7)",
                        borderRadius: "50px",
                        padding: "10px 36px",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        boxShadow: "0 2px 22px 0 rgba(139,195,229,0.35)"
                    }}
                >
                    {/* Pulsing dot */}
                    <span
                        style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: "#8BC3E5",
                            display: "inline-block",
                            animation: "standHeightPulse 1s ease-in-out infinite"
                        }}
                    />
                    <span
                        style={{
                            color: "#8BC3E5",
                            fontSize: "22px",
                            fontFamily: "'Anta', sans-serif",
                            letterSpacing: "0.04em",
                            fontVariantNumeric: "tabular-nums"
                        }}
                    >
                        {countdown}s
                    </span>

                    <style>{`
                        @keyframes standHeightPulse {
                            0%, 100% { opacity: 1; transform: scale(1); }
                            50%       { opacity: 0.4; transform: scale(1.4); }
                        }
                        @keyframes standHeightFadeIn {
                            from { opacity: 0; transform: translateY(16px); }
                            to   { opacity: 1; transform: translateY(0); }
                        }
                    `}</style>
                </div>
            )}
        </div>
    )
}

export default StandProperlyHeight
