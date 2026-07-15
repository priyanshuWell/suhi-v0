import { useRef, useEffect, useState, useCallback } from "react";
import { PanoViewer } from "@egjs/react-view360";
import Image from "../../assets/voice/nature_360.png";
import voiceComplete from "../../assets/voice/voiceComplete.png";
import textbgframe from "../../assets/textbgframe.svg";
import BlueGradientButton from "../ui/BlueGradientButton";
import icon360 from "../../assets/voice/360_icon.png"
import fingerIcon from "../../assets/voice/finger_icon.svg"
import { useNavigate } from "react-router";
import { Loader } from "lucide-react";
import { useTranslation } from "react-i18next";

const BAR_WIDTH = 12.1111;
const BAR_RADIUS = 6.05556;
const BARS_PER_SIDE = 9;
const TOTAL_BARS = BARS_PER_SIDE * 2;
const barXPositions = [0, 30.2773, 60.5547, 90.832, 121.109, 151.391, 181.668, 211.945, 242.223];
const barScales = [0.3, 0.9, 0.25, 1.1, 0.6, 0.4, 0.7, 0.25, 0.9];

export default function View360Viewer({
    src = Image,
    width = "100%",
    height = "100vh",
    autoRotate = false,
    showHUD = false,
    timerSeconds = 30,
    onTimerEnd,
    onFirstInteract,
    voiceBars: voiceBarsProp,
    isComplete,
    onNext,
    onStart,       // ← called when user clicks the Start button (triggers recording)
    loading        // ← called when user clicks "Next" in the modal
}) {
    const viewerRef = useRef(null);
    const rafRef = useRef(null);
    const wrapperRef = useRef(null);
    const { t } = useTranslation();
    const [showCTA, setShowCTA] = useState(true);
    // Use prop-driven bars (real mic data) – fall back to flat when no data.
    // Parent supplies 9 bars; mirror them so both sides react to the mic.
    const halfBars = voiceBarsProp ?? Array(BARS_PER_SIDE).fill(0);
    const voiceBars = [
        ...halfBars,                       // left side  (indices 0-8)
        ...[...halfBars].reverse(),        // right side (indices 9-17, mirrored)
    ];
    const [isReady, setIsReady] = useState(false);
    const [isError, setIsError] = useState(false);
    const [hud, setHud] = useState({ yaw: 0, pitch: 0, fov: 75 });
    const [secondsLeft, setSecondsLeft] = useState(timerSeconds);
    const [hasInteracted, setHasInteracted] = useState(false);
    const timerFiredRef = useRef(false);
    const interactFiredRef = useRef(false);
    const timerIntervalRef = useRef(null);
    const navigate = useNavigate();

    // ── Reset on src / duration change ───────────────────────────────────
    useEffect(() => {
        setSecondsLeft(timerSeconds);
        setHasInteracted(false);
        timerFiredRef.current = false;
        interactFiredRef.current = false;
        clearInterval(timerIntervalRef.current);
    }, [timerSeconds, src]);

    // ── Countdown (starts after first interaction) ────────────────────────
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

    // ── No internal wave animation — bars are driven entirely by the
    //    voiceBars prop (real microphone analyser data from VoiceAnalysis).
    //    When the user is not speaking / not recording, the prop will be
    //    Array(TOTAL_BARS).fill(0) so bars stay flat.

    // ── First-interaction detection ───────────────────────────────────────
    const handleInteract = useCallback(() => {
        if (interactFiredRef.current) return;
        interactFiredRef.current = true;
        setHasInteracted(true);
        onFirstInteract?.();
    }, [onFirstInteract]);

    useEffect(() => {
        const el = wrapperRef.current;
        if (!el || !isReady || showCTA) return;
        el.addEventListener("pointerdown", handleInteract, { capture: true, once: true });
        el.addEventListener("touchstart", handleInteract, { capture: true, once: true, passive: true });
        return () => {
            el.removeEventListener("pointerdown", handleInteract, { capture: true });
            el.removeEventListener("touchstart", handleInteract, { capture: true });
        };
    }, [isReady, showCTA, handleInteract]);

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
        viewerRef.current?.lookAt({ yaw: 0, pitch: 0, fov: 75 }, 1000);
    }, []);

    // ── Timer arc math ────────────────────────────────────────────────────
    const RING_CX = 201.533;
    const RING_CY = 161.266;
    const RING_R = 133;
    const CIRCUMFERENCE = 2 * Math.PI * RING_R;
    const progress = hasInteracted ? secondsLeft / timerSeconds : 1;
    const dashOffset = CIRCUMFERENCE * (1 - progress);

    const minutes = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const mmss = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    const isLow = hasInteracted && progress <= 0.2;
    const timerColor = "#03275A";

    const renderBars = (globalOffset) =>
        barXPositions.map((x, localIdx) => {
            const globalIdx = globalOffset + localIdx;
            const intensity = voiceBars[globalIdx] ?? 0;
            const scale = barScales[localIdx];
            const barH = 8 + 110 * scale * intensity;
            const barY = 30 - barH / 2;
            return (
                <rect
                    key={localIdx}
                    x={x} y={barY}
                    width={BAR_WIDTH} height={barH}
                    rx={BAR_RADIUS / 2}
                    fill="#fcf9f9"
                    style={{ transition: "height 0.05s linear, y 0.05s linear" }}
                />
            );
        });

    const barSvgProps = {
        width: "260", height: "60",
        viewBox: "0 0 255 60",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        preserveAspectRatio: "xMidYMid meet",
        style: { display: "block", pointerEvents: "none" },
    };

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
            {/* ── PanoViewer ───────────────────────────────────────────── */}
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

            {/* ── Loading overlay ─────────────────────────────────────── */}
            {!isReady && !isError && (
                <div style={styles.overlay}>
                    <div style={styles.spinner} />
                    <p style={{ margin: "12px 0 0", fontSize: "13px", color: "#aaa" }}>
                        {t("voice.loading_panorama")}
                    </p>
                </div>
            )}

            {/* ── Voice Complete modal ─────────────────────────────────── */}
            {/*   Shown when timer ends. User must click Next to proceed.  */}
            {isComplete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div
                        className="relative w-screen"
                        style={{
                            filter: "drop-shadow(0px 0px 40px rgba(139, 195, 229, 0.4))",
                        }}
                    >
                        {/* Background frame */}
                        <img
                            src={textbgframe}
                            alt=""
                            className="w-full h-full block"
                            draggable={false}
                        />

                        {/* Content */}
                        <div
                            className="absolute flex flex-col items-center justify-center"
                            style={{
                                top: "14%",
                                bottom: "20%",
                                left: "14%",
                                right: "14%",
                            }}
                        >
                            {/* Optional image */}
                            {/* <img
                                src={voiceComplete}
                                alt="voice-complete"
                                className="w-[220px] mb-8"
                            /> */}

                            {/* Title */}
                            <h2 className="text-[#8BC3E5] text-[42px] font-anta text-center mb-4">
                                {t("voice.status.task_completed")}
                            </h2>

                            {/* Subtitle */}
                            <p className="text-white text-[28px] font-anta text-center mb-12">
                                {t("voice.status.saved")}
                            </p>

                            {/* Next button */}
                            <BlueGradientButton
                                onClick={!loading ? onNext : undefined}
                                style={{
                                    opacity: loading ? 0.6 : 1,
                                    pointerEvents: loading ? "none" : "auto",
                                    cursor: loading ? "not-allowed" : "pointer",
                                }}
                            >
                                {loading ? (
                                    <Loader className="w-6 h-6 animate-spin" />
                                ) : (
                                    t("common.next")
                                )}
                            </BlueGradientButton>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Error overlay ────────────────────────────────────────── */}
            {isError && (
                <div style={styles.overlay}>
                    <span style={{ fontSize: "32px" }}>⚠️</span>
                    <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#f88" }}>
                        {t("voice.failed_load_pano")}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#666" }}>
                        {t("voice.check_image_path")}
                    </p>
                </div>
            )}
            {/* ── Intro CTA overlay ────────────────────────────────────── */}
            {isReady && showCTA && (
                <div
                    className="absolute inset-0 z-40 flex items-center justify-center"
                    style={{
                        background: "rgba(0,0,0,0.20)",
                        backdropFilter: "blur(6px)",
                    }}
                >
                    <div
                        className="flex flex-col items-center gap-10 px-10 py-12 rounded-3xl max-w-lg text-center"
                        style={{
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(154,217,255,0.3)",
                            boxShadow: "0 0 60px rgba(154,217,255,0.12)",
                        }}
                    >
                        <img
                            src={icon360}
                            alt="360-icon"
                            className="w-24 h-24"
                        />
                        <p
                            className="text-white text-2xl font-semibold leading-relaxed"
                            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}
                        >
                            {t("voice.cta_intro")}
                        </p>
                        <BlueGradientButton
                            onClick={() => {
                                setShowCTA(false);
                                onStart?.();                     // start recording
                                // Also kick off the timer right away
                                if (!interactFiredRef.current) {
                                    interactFiredRef.current = true; // prevent double-fire on drag
                                    setHasInteracted(true);
                                    // NOTE: onFirstInteract NOT called here to avoid a second
                                    // startRecording() call; recording already started via onStart
                                }
                            }}
                            className="px-4 py-2  text-white font-bold text-xl tracking-widest "
                        // style={{
                        //     background: "linear-gradient(135deg, #1a7fd4 0%, #0d4fa8 100%)",
                        //     boxShadow: "0 0 40px rgba(26,127,212,0.55), 0 4px 20px rgba(0,0,0,0.4)",
                        //     border: "1px solid rgba(154,217,255,0.4)",
                        //     letterSpacing: "0.2em",
                        // }}
                        >
                            {t("voice.cta_start")}
                        </BlueGradientButton>
                    </div>
                </div>
            )}
            {/* ── Drag-to-start nudge ──────────────────────────────────── */}
            {isReady && !hasInteracted && (
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 inline-flex flex-col items-center gap-20"
                >
                    <img
                        src={icon360}
                        alt="360-icon"
                        className="w-[100px] h-[100px]"
                    />

                    <p className="text-2xl bg-black/50 rounded-4xl text-white font-medium whitespace-nowrap flex  items-center py-3 px-10">
                        <img
                            src={fingerIcon}
                            alt="finger-icon"
                            className="w-10 h-10 ml-2"
                        />
                        <span>
                            {t("voice.tap_to_rotate")}
                        </span>
                    </p>
                </div>


            )
            }

            {/* ── Drag-to-start nudge ──────────────────────────────────── */}
            {isReady && !showCTA && !hasInteracted && (
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 inline-flex flex-col items-center gap-20"
                >
                    <img
                        src={icon360}
                        alt="360-icon"
                        className="w-[100px] h-[100px]"
                    />

                    <p className="text-2xl bg-black/50 rounded-4xl text-white font-medium whitespace-nowrap flex  items-center py-3 px-10">
                        <img
                            src={fingerIcon}
                            alt="finger-icon"
                            className="w-10 h-10 ml-2"
                        />
                        <span>
                            {t("voice.tap_to_rotate")}
                        </span>
                    </p>
                </div>
            )}

            {/* ── HUD ─────────────────────────────────────────────────── */}
            {
                showHUD && isReady && (
                    <div style={styles.hud}>
                        <HudItem label="YAW" value={`${hud.yaw}°`} />
                        <div style={styles.hudDivider} />
                        <HudItem label="PITCH" value={`${hud.pitch}°`} />
                        <div style={styles.hudDivider} />
                        <HudItem label="FOV" value={`${hud.fov}°`} />
                    </div>
                )
            }

            {/* ── Reset button ─────────────────────────────────────────── */}
            {
                isReady && (
                    <button onClick={handleReset} style={styles.resetBtn}
                        title="Reset view" aria-label="Reset camera to default view">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                        </svg>
                    </button>
                )
            }

            {/* ── Bottom HUD: [left bars] [timer] [right bars] ────────── */}
            <div style={styles.bottomHud}>
                <div style={styles.voiceBarWrapper}>
                    <svg {...barSvgProps}>{renderBars(0)}</svg>
                </div>

                <div style={styles.timerWrapper}>
                    <svg
                        width="250" height="250"
                        viewBox="0 0 404 404"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ pointerEvents: "none", touchAction: "none", userSelect: "none", display: "block" }}
                        aria-label={`Timer: ${mmss}`}
                    >
                        <g filter="url(#filter0_dii)">
                            <circle cx={RING_CX} cy={RING_CY} r="121" fill="url(#pill_grad)" />
                        </g>
                        <circle cx={RING_CX} cy={RING_CY} r={RING_R}
                            stroke="rgba(255,255,255,0.12)" strokeWidth="6" fill="none" />
                        <circle
                            cx={RING_CX} cy={RING_CY} r={RING_R}
                            stroke={timerColor}
                            strokeWidth="20" fill="none" strokeLinecap="round"
                            strokeDasharray={CIRCUMFERENCE}
                            strokeDashoffset={dashOffset}
                            transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
                            style={{ transition: hasInteracted ? "stroke-dashoffset 0.9s linear, stroke 0.5s ease" : "none" }}
                        />
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

                <div style={styles.voiceBarWrapper}>
                    <svg {...barSvgProps}>{renderBars(BARS_PER_SIDE)}</svg>
                </div>
            </div>
        </div >
    );
}

function HudItem({ label, value }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
            <span style={{ fontSize: "9px", color: "#777", letterSpacing: "0.08em" }}>{label}</span>
            <span style={{ fontSize: "13px", color: "#fff", fontFamily: "monospace" }}>{value}</span>
        </div>
    );
}

const styles = {
    overlay: {
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
        pointerEvents: "none", zIndex: 10,
    },
    spinner: {
        width: "36px", height: "36px",
        border: "3px solid rgba(255,255,255,0.15)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "spin360 0.8s linear infinite",
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
    bottomHud: {
        position: "absolute",
        bottom: "24px", left: "50%",
        transform: "translateX(-50%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: "24px",
        zIndex: 22,
        touchAction: "none",
    },
    timerWrapper: {
        pointerEvents: "none", touchAction: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
    },
    voiceBarWrapper: {
        pointerEvents: "none", touchAction: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
    },
};

if (typeof document !== "undefined" && !document.getElementById("v360-kf")) {
    const s = document.createElement("style");
    s.id = "v360-kf";
    s.textContent = `
        @keyframes spin360    { to { transform: rotate(360deg); } }
        @keyframes nudgePulse {
            0%,100% { opacity:0.75; transform: translate(-50%,-50%) scale(1);    }
            50%     { opacity:1;    transform: translate(-50%,-50%) scale(1.03); }
        }
    `;
    document.head.appendChild(s);
}