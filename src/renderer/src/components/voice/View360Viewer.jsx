import { useRef, useEffect, useState, useCallback } from "react";
import { PanoViewer } from "@egjs/react-view360";
import Image from "../../assets/voice/nature_360.png";

/**
 * View360Viewer
 *
 * Props
 * ─────
 * src             – panorama image URL
 * width           – CSS width  (default "100%")
 * height          – CSS height (default "100vh")
 * autoRotate      – slowly rotate the camera (default false)
 * showHUD         – show yaw/pitch/fov readout (default false)
 * timerSeconds    – total countdown duration in seconds (default 30)
 * onTimerEnd      – called once when the countdown reaches zero
 * onFirstInteract – called once on the user's first drag/touch
 */
export default function View360Viewer({
    src = Image,
    width = "100%",
    height = "100vh",
    autoRotate = false,
    showHUD = false,
    timerSeconds = 30,
    onTimerEnd,
    onFirstInteract,
}) {
    const viewerRef = useRef(null);
    const rafRef = useRef(null);
    const wrapperRef = useRef(null);

    const [isReady, setIsReady] = useState(false);
    const [isError, setIsError] = useState(false);
    const [hud, setHud] = useState({ yaw: 0, pitch: 0, fov: 75 });
    const [secondsLeft, setSecondsLeft] = useState(timerSeconds);
    const [hasInteracted, setHasInteracted] = useState(false);

    const timerFiredRef = useRef(false);
    const interactFiredRef = useRef(false);
    const timerIntervalRef = useRef(null);

    // ── Reset everything when image/duration changes ─────────────────────
    useEffect(() => {
        setSecondsLeft(timerSeconds);
        setHasInteracted(false);
        timerFiredRef.current = false;
        interactFiredRef.current = false;
        clearInterval(timerIntervalRef.current);
    }, [timerSeconds, src]);

    // ── Countdown — only runs after first interaction ─────────────────────
    useEffect(() => {
        if (!isReady || !hasInteracted) return;

        clearInterval(timerIntervalRef.current);

        timerIntervalRef.current = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerIntervalRef.current);
                    if (!timerFiredRef.current) {
                        timerFiredRef.current = true;
                        onTimerEnd?.();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerIntervalRef.current);
    }, [isReady, hasInteracted, onTimerEnd]);

    // ── Detect first interaction via capture-phase pointer events ─────────
    // PanoViewer swallows events in bubble phase; capture fires before it.
    const handleInteract = useCallback(() => {
        if (interactFiredRef.current) return;
        interactFiredRef.current = true;
        setHasInteracted(true);
        onFirstInteract?.();
    }, [onFirstInteract]);

    useEffect(() => {
        const el = wrapperRef.current;
        if (!el || !isReady) return;

        el.addEventListener("pointerdown", handleInteract, { capture: true, once: true });
        el.addEventListener("touchstart", handleInteract, { capture: true, once: true, passive: true });

        return () => {
            el.removeEventListener("pointerdown", handleInteract, { capture: true });
            el.removeEventListener("touchstart", handleInteract, { capture: true });
        };
    }, [isReady, handleInteract]);

    // ── Viewport resize ───────────────────────────────────────────────────
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        viewer.updateViewportDimensions();
        const onResize = () => viewer.updateViewportDimensions();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // ── Auto-rotate ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!autoRotate || !isReady) return;
        const spin = () => {
            const viewer = viewerRef.current;
            if (viewer) viewer.lookAt({ yaw: viewer.getYaw() + 0.08 }, 0);
            rafRef.current = requestAnimationFrame(spin);
        };
        rafRef.current = requestAnimationFrame(spin);
        return () => cancelAnimationFrame(rafRef.current);
    }, [autoRotate, isReady]);

    // ── HUD polling ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!showHUD || !isReady) return;
        const id = setInterval(() => {
            const viewer = viewerRef.current;
            if (viewer) setHud({
                yaw: Math.round(viewer.getYaw()),
                pitch: Math.round(viewer.getPitch()),
                fov: Math.round(viewer.getFov()),
            });
        }, 120);
        return () => clearInterval(id);
    }, [showHUD, isReady]);

    const handleReset = useCallback(() => {
        viewerRef.current?.lookAt({ yaw: 0, pitch: 0, fov: 75 }, 600);
    }, []);

    // ── Timer arc math ────────────────────────────────────────────────────
    const RING_CX = 201.533;
    const RING_CY = 161.266;
    const RING_R = 133;
    const CIRCUMFERENCE = 2 * Math.PI * RING_R;

    // Ring stays full until user first interacts
    const progress = hasInteracted ? secondsLeft / timerSeconds : 1;
    const dashOffset = CIRCUMFERENCE * (1 - progress);

    const minutes = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const mmss = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    const isLow = hasInteracted && progress <= 0.2;

    const timerColor =
        !hasInteracted ? "rgba(154,217,255,0.45)" :
            progress > 0.5 ? "#4DFFB4" :
                progress > 0.2 ? "#FFD84D" :
                    "#FF6B6B";

    return (
        <div
            ref={wrapperRef}
            style={{
                position: "relative",
                width, height,
                maxWidth: "100%",
                margin: "0 auto",
                background: "#111",
                overflow: "hidden",
            }}
        >
            {/* ── PanoViewer ─────────────────────────────────────────────── */}
            <PanoViewer
                ref={viewerRef}
                image={src}
                yaw={0} pitch={0} fov={100}
                gyroMode="yawPitch"
                useZoom={true}
                onReady={() => setIsReady(true)}
                onError={() => setIsError(true)}
                style={{ width: "100%", height: "100%" }}
            />

            {/* ── Loading overlay ─────────────────────────────────────────── */}
            {!isReady && !isError && (
                <div style={styles.overlay}>
                    <div style={styles.spinner} />
                    <p style={{ margin: "12px 0 0", fontSize: "13px", color: "#aaa" }}>
                        Loading panorama…
                    </p>
                </div>
            )}

            {/* ── Error overlay ───────────────────────────────────────────── */}
            {isError && (
                <div style={styles.overlay}>
                    <span style={{ fontSize: "32px" }}>⚠️</span>
                    <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#f88" }}>
                        Failed to load panorama image.
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#666" }}>
                        Check the image path or URL.
                    </p>
                </div>
            )}

            {/* ── "Drag to start" nudge — only before first interaction ───── */}
            {isReady && !hasInteracted && (
                <div style={styles.nudge}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="rgba(154,217,255,0.9)" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
                    </svg>
                    <span>Drag to explore &amp; start recording</span>
                </div>
            )}

            {/* ── REC indicator (top-left) — appears after first drag ─────── */}
            {isReady && hasInteracted && (
                <div style={styles.recIndicator}>
                    <span style={styles.recDot} />
                    REC
                </div>
            )}

            {/* ── HUD (bottom-left) ───────────────────────────────────────── */}
            {showHUD && isReady && (
                <div style={styles.hud}>
                    <HudItem label="YAW" value={`${hud.yaw}°`} />
                    <div style={styles.hudDivider} />
                    <HudItem label="PITCH" value={`${hud.pitch}°`} />
                    <div style={styles.hudDivider} />
                    <HudItem label="FOV" value={`${hud.fov}°`} />
                </div>
            )}

            {/* ── Reset button (top-right) ────────────────────────────────── */}
            {isReady && (
                <button onClick={handleReset} style={styles.resetBtn}
                    title="Reset view" aria-label="Reset camera to default view">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                    </svg>
                </button>
            )}

            {/* ── Timer SVG — bottom-center, fully non-interactive ────────── */}
            <div style={styles.timerWrapper}>
                <svg
                    width="250" height="250"
                    viewBox="0 0 404 404"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ pointerEvents: "none", touchAction: "none", userSelect: "none", display: "block" }}
                    aria-label={`Timer: ${mmss}`}
                >
                    {/* Pill with drop/inner shadows */}
                    <g filter="url(#filter0_dii)">
                        <circle cx={RING_CX} cy={RING_CY} r="121" fill="url(#pill_grad)" />
                    </g>

                    {/* Ring track */}
                    <circle cx={RING_CX} cy={RING_CY} r={RING_R}
                        stroke="rgba(255,255,255,0.12)" strokeWidth="6" fill="none" />

                    {/* Ring progress arc */}
                    <circle
                        cx={RING_CX} cy={RING_CY} r={RING_R}
                        stroke={timerColor}
                        strokeWidth="6"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={dashOffset}
                        transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
                        style={{
                            transition: hasInteracted
                                ? "stroke-dashoffset 0.9s linear, stroke 0.5s ease"
                                : "none",
                            filter: `drop-shadow(0 0 ${isLow ? 10 : 5}px ${timerColor})`,
                        }}
                    />

                    {/* MM:SS */}
                    <text
                        x={RING_CX} y={RING_CY + 8}
                        textAnchor="middle" dominantBaseline="middle"
                        fill={isLow ? "#FF6B6B" : "#03275A"}
                        fontFamily="'Exo 2', 'SF Mono', monospace"
                        fontWeight="700" fontSize="40" letterSpacing="2"
                        style={{ transition: "fill 0.5s ease" }}
                    >
                        {mmss}
                    </text>

                    {/* Sub-label */}
                    <text
                        x={RING_CX} y={RING_CY + 52}
                        textAnchor="middle"
                        fill={
                            !hasInteracted ? "rgba(154,217,255,0.5)" :
                                isLow ? "#FF6B6B" :
                                    "rgba(3,39,90,0.45)"
                        }
                        fontFamily="'Exo 2', sans-serif"
                        fontSize="12" letterSpacing="3"
                    >
                        {!hasInteracted ? "WAITING" : isLow ? "FINISHING SOON" : "RECORDING"}
                    </text>

                    <defs>
                        <filter id="filter0_dii" x="-0.0001297" y="-0.00104141"
                            width="403.067" height="403.067"
                            filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                            <feFlood floodOpacity="0" result="BackgroundImageFix" />
                            <feColorMatrix in="SourceAlpha" type="matrix"
                                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                            <feOffset dy="40.2667" />
                            <feGaussianBlur stdDeviation="40.2667" />
                            <feColorMatrix type="matrix" values="0 0 0 0 0.2 0 0 0 0 0.2 0 0 0 0 0.2 0 0 0 0.1665 0" />
                            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
                            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
                            <feColorMatrix in="SourceAlpha" type="matrix"
                                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                            <feOffset dy="10.6483" />
                            <feGaussianBlur stdDeviation="5.32415" />
                            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
                            <feBlend mode="normal" in2="shape" result="effect2_innerShadow" />
                            <feColorMatrix in="SourceAlpha" type="matrix"
                                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                            <feOffset dy="-10.6483" />
                            <feGaussianBlur stdDeviation="5.32415" />
                            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                            <feColorMatrix type="matrix"
                                values="0 0 0 0 0.8525 0 0 0 0 0.8525 0 0 0 0 0.8525 0 0 0 1 0" />
                            <feBlend mode="normal" in2="effect2_innerShadow" result="effect3_innerShadow" />
                        </filter>
                        <linearGradient id="pill_grad"
                            x1="201.533" y1="40.2656" x2="201.533" y2="282.266"
                            gradientUnits="userSpaceOnUse">
                            <stop stopColor="#E1E1E1" />
                            <stop offset="1" stopColor="white" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
        </div>
    );
}

/* ── HUD item ────────────────────────────────────────────────────────────── */
function HudItem({ label, value }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
            <span style={{ fontSize: "9px", color: "#777", letterSpacing: "0.08em" }}>{label}</span>
            <span style={{ fontSize: "13px", color: "#fff", fontFamily: "monospace" }}>{value}</span>
        </div>
    );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const styles = {
    overlay: {
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
        pointerEvents: "none", zIndex: 10,
    },
    spinner: {
        width: "11px", height: "11px",
        border: "3px solid rgba(255,255,255,0.15)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "spin360 0.8s linear infinite",
    },
    nudge: {
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex", alignItems: "center", gap: "10px",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)",
        color: "rgba(154,217,255,0.9)",
        fontSize: "14px",
        fontFamily: "'Exo 2', sans-serif",
        letterSpacing: "0.15em",
        padding: "12px 24px",
        borderRadius: "40px",
        border: "1px solid rgba(154,217,255,0.25)",
        pointerEvents: "none",
        zIndex: 15,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        animation: "nudgePulse 2.2s ease-in-out infinite",
    },
    recIndicator: {
        position: "absolute", top: "16px", left: "16px",
        display: "flex", alignItems: "center", gap: "8px",
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
        color: "#FF6B6B",
        fontSize: "12px",
        fontFamily: "'Exo 2', monospace",
        fontWeight: "700",
        letterSpacing: "0.2em",
        padding: "6px 14px", borderRadius: "6px",
        border: "1px solid rgba(255,107,107,0.3)",
        pointerEvents: "none", zIndex: 5,
    },
    recDot: {
        display: "inline-block",
        width: "8px", height: "8px",
        borderRadius: "50%",
        background: "#FF6B6B",
        boxShadow: "0 0 6px #FF6B6B",
        animation: "recBlink 1s ease-in-out infinite",
    },
    hud: {
        position: "absolute", bottom: "16px", left: "16px",
        display: "flex", alignItems: "center", gap: "12px",
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
        padding: "6px 14px", borderRadius: "8px",
        pointerEvents: "none", zIndex: 5,
    },
    hudDivider: { width: "1px", height: "24px", background: "rgba(255,255,255,0.15)" },
    resetBtn: {
        position: "absolute", top: "16px", right: "16px",
        width: "38px", height: "38px", borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.2)",
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)",
        color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", zIndex: 5,
    },
    timerWrapper: {
        position: "absolute",
        bottom: "24px", left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        pointerEvents: "none", touchAction: "none",
    },
};

/* ── Global keyframes ────────────────────────────────────────────────────── */
if (typeof document !== "undefined" && !document.getElementById("v360-kf")) {
    const s = document.createElement("style");
    s.id = "v360-kf";
    s.textContent = `
    @keyframes spin360 { to { transform: rotate(360deg); } }
    @keyframes recBlink { 0%,100% { opacity:1; } 50% { opacity:0.15; } }
    @keyframes nudgePulse {
      0%,100% { opacity:0.75; transform: translate(-50%,-50%) scale(1);    }
      50%     { opacity:1;    transform: translate(-50%,-50%) scale(1.03); }
    }
  `;
    document.head.appendChild(s);
}