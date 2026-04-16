import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router";
import stimulus_1 from "../../../assets/games/stimulus_1.svg";
import stimulus_glow_1 from "../../../assets/games/stimulus_glow_1.svg";
import stimulus_correct_1 from "../../../assets/games/stimulus_correct_1.svg";
import stimulus_error_1 from "../../../assets/games/stimulus_error_1.svg";
import textFrameSvg from "../../../assets/textFrame.svg";
import divideAttentionBg from "../../../assets/games/divideAttentionbg.png";
import { StepTextPanel } from "./StepTextPanel";
import {
    DivideAttentionTrialStart,
    DivideAttentionTrialComplete,
    DivideAttentionResponseBatch,
} from "../../../utils/api"; // adjust path as needed

/*
 * ─── DEMO CONFIGURATION ───
 * A guided walkthrough with 2 targets, 4 total particles.
 * Steps:
 *   1. SHOW_TARGETS   — "Watch the highlighted asteroids." (targets glow + ripple)
 *   2. ALL_SAME       — "All asteroids now look the same." (distractors fade in, all uniform)
 *   3. MOVING         — "Track them as they move." (movement starts)
 *   4. STOPPED        — "Tap the asteroids you were tracking." (freeze, user taps)
 *   5. RESULT         — Show correct/error feedback
 *   6. DONE           — "Great! Let's start." → navigate to game
 */

// ─── Canvas / Arena ───
const CW = 1014;
const CH = 1802;
const PAD = 60;

// Square arena centered in the canvas (below the text panel)
const PANEL_TOP = 100;

const PANEL_H = 260 // ~253px at frameW=934
const ARENA_TOP = PANEL_TOP + PANEL_H + 80;
const ARENA_SIZE = Math.min(CW - PAD * 2, CH - ARENA_TOP - PAD - 100);
const ARENA_LEFT = (CW - ARENA_SIZE) / 2;
const ARENA = {
    l: ARENA_LEFT,
    t: ARENA_TOP,
    r: ARENA_LEFT + ARENA_SIZE,
    b: ARENA_TOP + ARENA_SIZE,
};

// Demo params
const DEMO_PARTICLES = 6;
const DEMO_TARGETS = 2;
const DEMO_RADIUS = 50;
const DEMO_VEL_MIN = 1;
const DEMO_VEL_MAX = 1.5;

// Timing
const STEP_SHOW_TARGETS_MS = 3000;
const STEP_ALL_SAME_MS = 2000;
const STEP_MOVING_MS = 4000;
const STEP_FREEZE_MS = 15000; // generous for demo
const STEP_RESULT_MS = 2000;
const REVEAL_MS = 800;

// Ripple config (same as game)
const RIPPLE_COUNT = 3;
const RIPPLE_CYCLE_MS = 2000;
const RIPPLE_MAX_EXPAND = 1.8;
const RIPPLE_COLOR = "rgba(255, 255, 255,";

// Scale factors
const GLOW_SCALE = 394 / 194;
const CORRECT_SCALE = 374 / 194;
const ERROR_SCALE = 294 / 194;

// Steps
const STEP = {
    LOADING: "LOADING",
    SHOW_TARGETS: "SHOW_TARGETS",
    ALL_SAME: "ALL_SAME",
    MOVING: "MOVING",
    STOPPED: "STOPPED",
    RESULT: "RESULT",
    DONE: "DONE",
};

const STEP_MESSAGES = {
    [STEP.SHOW_TARGETS]: "Watch the highlighted\nasteroids.",
    [STEP.ALL_SAME]: "All asteroids now look\nthe same.",
    [STEP.MOVING]: "Follow them as they move.",
    [STEP.STOPPED]: "Now tap on the ones that you were tracking",
    [STEP.RESULT]: "Great Job. Lets Try one more time", // dynamic
    [STEP.DONE]: "Great! Let's start\nthe game.",
};

// ─── Utilities ───
const rnd = (a, b) => Math.random() * (b - a) + a;
const d2d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

async function loadImage(src) {
    return new Promise((ok, no) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => ok(i);
        i.onerror = no;
        i.src = src;
    });
}

async function loadSvg(path) {
    try {
        const r = await fetch(path);
        const t = await r.text();
        return await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(t));
    } catch { return null; }
}

async function loadPng(path) {
    try {
        const r = await fetch(path);
        const b = await r.blob();
        return await loadImage(URL.createObjectURL(b));
    } catch { return null; }
}

// ─── Spawn ───
function spawnDemo() {
    const ps = [];
    const gap = DEMO_RADIUS * 2 + 20;

    for (let i = 0; i < DEMO_PARTICLES; i++) {
        const isTgt = i < DEMO_TARGETS;
        let x, y, ok, n = 0;
        do {
            x = rnd(ARENA.l + DEMO_RADIUS + 10, ARENA.r - DEMO_RADIUS - 10);
            y = rnd(ARENA.t + DEMO_RADIUS + 10, ARENA.b - DEMO_RADIUS - 10);
            ok = ps.every((p) => d2d({ x, y }, p) >= gap);
            n++;
        } while (!ok && n < 800);

        const angle = rnd(0, Math.PI * 2);
        const speed = rnd(DEMO_VEL_MIN, DEMO_VEL_MAX);

        ps.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: DEMO_RADIUS,
            isTarget: isTgt,
            selected: false,
            hovered: false,
            opacity: isTgt ? 1 : 0,
            rippleOffset: Math.random() * RIPPLE_CYCLE_MS,
        });
    }

    // Shuffle
    for (let i = ps.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ps[i], ps[j]] = [ps[j], ps[i]];
    }
    return ps;
}

// ─── Physics (bounded to ARENA) ───
function physics(ps, dt, moving) {
    const step = dt / 16.667;
    if (moving) {
        for (const p of ps) {
            p.x += p.vx * step;
            p.y += p.vy * step;
        }
    }

    for (const p of ps) {
        if (p.x - p.radius < ARENA.l) { p.x = ARENA.l + p.radius; p.vx = Math.abs(p.vx); }
        if (p.x + p.radius > ARENA.r) { p.x = ARENA.r - p.radius; p.vx = -Math.abs(p.vx); }
        if (p.y - p.radius < ARENA.t) { p.y = ARENA.t + p.radius; p.vy = Math.abs(p.vy); }
        if (p.y + p.radius > ARENA.b) { p.y = ARENA.b - p.radius; p.vy = -Math.abs(p.vy); }
    }

    for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
            const a = ps[i], b = ps[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.hypot(dx, dy);
            const minD = a.radius + b.radius;
            if (d < minD && d > 0.001) {
                const nx = dx / d, ny = dy / d;
                const ov = (minD - d) * 0.5;
                a.x -= nx * ov; a.y -= ny * ov;
                b.x += nx * ov; b.y += ny * ov;
                if (moving) {
                    const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
                    const dot = dvx * nx + dvy * ny;
                    if (dot > 0) {
                        a.vx -= dot * nx; a.vy -= dot * ny;
                        b.vx += dot * nx; b.vy += dot * ny;
                    }
                }
            }
        }
    }
}

// ─── Draw helpers ───
function drawParticleImg(ctx, img, p, scale = 1) {
    const sz = p.radius * 2 * scale;
    const offset = p.radius * (scale - 1);
    ctx.drawImage(img, p.x - p.radius - offset, p.y - p.radius - offset, sz, sz);
}

function drawWaterRipple(ctx, p, time) {
    const baseRadius = p.radius + 4;

    for (let i = 0; i < RIPPLE_COUNT; i++) {
        const phaseOffset = (i / RIPPLE_COUNT) * RIPPLE_CYCLE_MS;
        const t = ((time + p.rippleOffset + phaseOffset) % RIPPLE_CYCLE_MS) / RIPPLE_CYCLE_MS;
        const ringRadius = baseRadius + (baseRadius * (RIPPLE_MAX_EXPAND - 1)) * t;
        const fadeIn = Math.min(1, t / 0.15);
        const fadeOut = Math.max(0, 1 - (t - 0.15) / 0.85);
        const alpha = fadeIn * fadeOut * 0.55;
        if (alpha <= 0.01) continue;
        const lineWidth = Math.max(0.8, 2.5 * (1 - t));

        ctx.beginPath();
        ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = RIPPLE_COLOR + alpha.toFixed(3) + ")";
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }

    const glowAlpha = 0.15 + 0.1 * Math.sin(time * 0.004 + p.rippleOffset);
    const gradient = ctx.createRadialGradient(p.x, p.y, p.radius * 0.5, p.x, p.y, p.radius + 10);
    gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
    gradient.addColorStop(0.6, `rgba(255, 255, 255, ${glowAlpha.toFixed(3)})`);
    gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 10, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
}

// ─── Draw text inside the frame panel ───
function drawTextPanel(ctx, frameImg, text, time) {
    if (!text) return;

    // Draw the sci-fi frame SVG
    const frameW = CW - 80;
    const frameH = PANEL_H;
    const frameX = (CW - frameW) / 2;
    const frameY = PANEL_TOP;

    if (frameImg) {
        ctx.drawImage(frameImg, frameX, frameY, frameW, frameH);
    }

    // Draw text centered inside the frame
    const lines = text.split("\n");
    const lineHeight = 52;
    const textX = CW / 2;
    const textStartY = frameY + frameH / 2 - ((lines.length - 1) * lineHeight) / 2;

    ctx.save();
    ctx.font = "bold 42px 'Courier New', Courier, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Text glow
    ctx.shadowColor = "rgba(154, 217, 255, 0.6)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#E8C547"; // golden yellow like in the screenshot

    lines.forEach((line, i) => {
        ctx.fillText(line, textX, textStartY + i * lineHeight);
    });

    ctx.restore();
}

// ════════════════════════════════════════════
//  DEMO COMPONENT
// ════════════════════════════════════════════
export default function SpaceConveyDemo({ sessionId, onComplete }) {
    const [displayStep, setDisplayStep] = useState(STEP.LOADING);
    const [displayMsg, setDisplayMsg] = useState("");
    const cvRef = useRef(null);
    const assets = useRef({
        stim: null, glow: null, correct: null, error: null,
        frame: null, bg: null, loaded: false,
    });
    const G = useRef({
        step: STEP.LOADING,
        ps: [],
        elapsed: 0,
        revealProgress: 0,
        allGuessed: false,
        globalTime: 0,
        resultHandled: false,
        practiceRound: 1,
        freezeStartTime: 0,   // performance.now() when STOPPED begins
        trialStarted: false,  // guard: only call TrialStart once per round entry
    });
    // API state per practice round
    const apiRef = useRef({
        trialId: null,
        trialNumber: 0,       // increments: 1 for first practice, 2 for second
        pendingResponses: [], // taps collected during STOPPED
    });
    const rafRef = useRef(null);
    const prevTime = useRef(0);

    // ─── Load assets ───
    useEffect(() => {
        (async () => {
            const stim = await loadSvg(stimulus_1);
            const glow = await loadSvg(stimulus_glow_1);
            const correct = await loadSvg(stimulus_correct_1);
            const error = await loadSvg(stimulus_error_1);
            const frame = await loadSvg(textFrameSvg);
            const bg = await loadPng(divideAttentionBg);

            assets.current = { stim, glow, correct, error, frame, bg, loaded: true };

            // Start demo
            const g = G.current;
            g.ps = spawnDemo();
            g.step = STEP.SHOW_TARGETS;
            g.elapsed = 0;
            setDisplayMsg(STEP_MESSAGES[STEP.SHOW_TARGETS]);
            setDisplayStep(STEP.SHOW_TARGETS);
        })();
    }, []);

    // ─── Trial API helpers ───
    const startPracticeTrial = useCallback(async () => {
        const api = apiRef.current;
        api.trialNumber += 1;
        api.trialId = null;
        api.pendingResponses = [];

        if (!sessionId) return;
        const result = await DivideAttentionTrialStart({
            session_id: sessionId,
            trial_number: api.trialNumber,
            trial_type: "practice",
            num_targets: DEMO_TARGETS,
            num_distractors: DEMO_PARTICLES - DEMO_TARGETS,
            total_objects: DEMO_PARTICLES,
            tracking_duration_ms: STEP_FREEZE_MS,
        });
        if (result.success) {
            api.trialId = result.data.trial_id ?? result.data.id ?? null;
            console.log("[Demo] Trial started:", api.trialId, "| trial_number:", api.trialNumber);
        } else {
            console.warn("[Demo] Trial start failed, continuing offline");
        }
    }, [sessionId]);

    const finishPracticeTrial = useCallback(async (ps) => {
        const api = apiRef.current;
        if (!sessionId || !api.trialId) return;

        // Build responses — only tapped particles (correct_hit / false_alarm)
        const freezeDurationMs = STEP_FREEZE_MS;
        const speedThresholdMs = freezeDurationMs * 0.5;
        const responses = [];

        ps.forEach((p, idx) => {
            if (!p.selected) return;
            if (p.isTarget) {
                const hasSpeedBonus = p.responseTimeMs != null && p.responseTimeMs < speedThresholdMs;
                responses.push({
                    object_index: idx,
                    object_type: "target",
                    response_time_ms: p.responseTimeMs ?? 0,
                    tap_x: p.tapX ?? 0,
                    tap_y: p.tapY ?? 0,
                    response_type: "correct_hit",
                    is_correct: true,
                    points_awarded: 10 + (hasSpeedBonus ? 3 : 0),
                    speed_bonus: hasSpeedBonus,
                });
            } else {
                responses.push({
                    object_index: idx,
                    object_type: "distractor",
                    response_time_ms: p.responseTimeMs ?? 0,
                    tap_x: p.tapX ?? 0,
                    tap_y: p.tapY ?? 0,
                    response_type: "false_alarm",
                    is_correct: false,
                    points_awarded: -5,
                    speed_bonus: false,
                });
            }
        });

        if (responses.length > 0) {
            const batchResult = await DivideAttentionResponseBatch({
                trial_id: api.trialId,
                responses,
            });
            if (!batchResult.success) console.warn("[Demo] Response batch failed");
        }

        const completeResult = await DivideAttentionTrialComplete(api.trialId);
        if (!completeResult.success) console.warn("[Demo] Trial complete failed");
        else console.log("[Demo] Trial complete:", api.trialId);
    }, [sessionId]);

    // ─── Game loop ───
    useEffect(() => {
        const loop = (t) => {
            const dt = prevTime.current ? Math.min(t - prevTime.current, 50) : 16.667;
            prevTime.current = t;
            const g = G.current;
            g.globalTime = t;

            if (g.step !== STEP.LOADING && g.step !== STEP.DONE) {
                g.elapsed += dt;

                switch (g.step) {
                    case STEP.SHOW_TARGETS:
                        physics(g.ps, dt, false);
                        if (g.elapsed >= STEP_SHOW_TARGETS_MS) {
                            g.step = STEP.ALL_SAME;
                            g.elapsed = 0;
                            setDisplayStep(STEP.ALL_SAME);
                            setDisplayMsg(STEP_MESSAGES[STEP.ALL_SAME]);
                        }
                        break;

                    case STEP.ALL_SAME:
                        // Fade in distractors
                        g.revealProgress = Math.min(1, g.elapsed / REVEAL_MS);
                        g.ps.forEach((p) => {
                            if (!p.isTarget) p.opacity = g.revealProgress;
                        });
                        physics(g.ps, dt, false);
                        if (g.elapsed >= STEP_ALL_SAME_MS) {
                            g.ps.forEach((p) => { p.opacity = 1; });
                            g.step = STEP.MOVING;
                            g.elapsed = 0;
                            setDisplayMsg(STEP_MESSAGES[STEP.MOVING]);
                        }
                        break;

                    case STEP.MOVING:
                        // All move
                        physics(g.ps, dt, true);
                        if (g.elapsed >= STEP_MOVING_MS) {
                            g.ps.forEach((p) => { p.vx = 0; p.vy = 0; });
                            g.step = STEP.STOPPED;
                            g.elapsed = 0;
                            g.freezeStartTime = performance.now();
                            g.trialStarted = false; // reset guard for this round
                            setDisplayMsg(STEP_MESSAGES[STEP.STOPPED]);
                        }
                        break;

                    case STEP.STOPPED:
                        // Call TrialStart exactly once when we enter STOPPED
                        if (!g.trialStarted) {
                            console.log("Trial started");
                            g.trialStarted = true;
                            startPracticeTrial();
                        }
                        // Wait for user taps
                        physics(g.ps, dt, false);
                        if (g.elapsed >= STEP_FREEZE_MS || g.allGuessed) {
                            g.step = STEP.RESULT;
                            g.elapsed = 0;
                            // Send batch + complete for this practice trial
                            finishPracticeTrial(g.ps);
                        }
                        break;

                    case STEP.RESULT:
                        if (g.elapsed >= STEP_RESULT_MS && !g.resultHandled) {
                            g.resultHandled = true;
                            const correctCount = g.ps.filter((p) => p.isTarget && p.selected).length;
                            const wrongCount = g.ps.filter((p) => !p.isTarget && p.selected).length;
                            const isPerfect = correctCount === DEMO_TARGETS && wrongCount === 0;

                            if (isPerfect) {
                                if (g.practiceRound >= 2) {
                                    g.step = STEP.DONE;
                                    setDisplayMsg(STEP_MESSAGES[STEP.DONE]);
                                    setDisplayStep(STEP.DONE);
                                    setTimeout(() => onComplete?.(), 1500);
                                } else {
                                    g.practiceRound += 1;

                                    setDisplayMsg("Great Job. Lets Try one more time");

                                    setTimeout(() => {
                                        g.ps = spawnDemo();
                                        g.allGuessed = false;
                                        g.revealProgress = 0;
                                        g.resultHandled = false;
                                        g.trialStarted = false;
                                        g.step = STEP.SHOW_TARGETS;
                                        g.elapsed = 0;
                                    }, 2000);
                                }
                            } else {
                                setDisplayMsg("Make sure you keep the track of the right asteroids. Let's try again.");
                                // brief pause so user sees the message, then reset
                                setTimeout(() => {
                                    g.ps = spawnDemo();
                                    g.allGuessed = false;
                                    g.revealProgress = 0;
                                    g.resultHandled = false;
                                    g.trialStarted = false;
                                    g.step = STEP.SHOW_TARGETS;
                                    g.elapsed = 0;
                                    setDisplayStep(STEP.SHOW_TARGETS);
                                    setDisplayMsg(STEP_MESSAGES[STEP.SHOW_TARGETS]);
                                }, 2000);
                            }
                        }
                        break;
                }
            }

            draw(t);
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [onComplete]);

    // ─── Render ───
    const draw = useCallback((time) => {
        const cv = cvRef.current;
        if (!cv) return;
        const ctx = cv.getContext("2d");
        const g = G.current;
        const a = assets.current;

        ctx.clearRect(0, 0, CW, CH);

        // Background
        if (a.bg) {
            ctx.drawImage(a.bg, 0, 0, CW, CH);
        } else {
            const gr = ctx.createLinearGradient(0, 0, 0, CH);
            gr.addColorStop(0, "#0b1a2e"); gr.addColorStop(1, "#080e18");
            ctx.fillStyle = gr; ctx.fillRect(0, 0, CW, CH);
        }

        if (g.step === STEP.LOADING) {
            if (a.bg) {
                ctx.drawImage(a.bg, 0, 0, CW, CH);
            } else {
                const gr = ctx.createLinearGradient(0, 0, 0, CH);
                gr.addColorStop(0, "#0b1a2e");
                gr.addColorStop(1, "#080e18");
                ctx.fillStyle = gr;
                ctx.fillRect(0, 0, CW, CH);
            }
            return;
        };

        // ─── Text panel ───
        const msg = STEP_MESSAGES[g.step] || "";
        let displayMsg = msg;
        if (g.step === STEP.RESULT) {
            const correct = g.ps.filter((p) => p.isTarget && p.selected).length;
            const wrong = g.ps.filter((p) => !p.isTarget && p.selected).length;
            if (correct === DEMO_TARGETS && wrong === 0) {
                displayMsg = "Well done!\nYou got them all.";
            } else {
                displayMsg = "Not quite!\nTrying again...";
            }
        }
        // drawTextPanel(ctx, a.frame, displayMsg, time);

        // ─── Particles ───
        g.ps.forEach((p) => {
            if (g.step === STEP.SHOW_TARGETS && !p.isTarget) return;
            if (p.opacity <= 0) return;

            ctx.save();
            ctx.globalAlpha = p.opacity;

            // Water ripple for SHOW_TARGETS and STOPPED hover
            const showRipple =
                (g.step === STEP.SHOW_TARGETS && p.isTarget) ||
                (g.step === STEP.STOPPED && p.hovered && !p.selected);

            if (showRipple) {
                drawWaterRipple(ctx, p, time || 0);
            }

            // Image selection
            if (p.selected && (g.step === STEP.STOPPED || g.step === STEP.RESULT || g.step === STEP.DONE)) {
                if (p.isTarget) {
                    const img = a.correct || a.stim;
                    if (img && img === a.correct) {
                        drawParticleImg(ctx, img, p, CORRECT_SCALE);
                    } else if (img) {
                        drawParticleImg(ctx, img, p);
                    }
                } else {
                    const img = a.error || a.stim;
                    if (img && img === a.error) {
                        drawParticleImg(ctx, img, p, ERROR_SCALE);
                    } else if (img) {
                        drawParticleImg(ctx, img, p);
                    }
                }
            } else if (g.step === STEP.SHOW_TARGETS && p.isTarget) {
                const img = a.glow || a.stim;
                if (img && img === a.glow) {
                    drawParticleImg(ctx, img, p, GLOW_SCALE);
                } else if (img) {
                    drawParticleImg(ctx, img, p);
                }
            } else if (g.step === STEP.STOPPED && p.hovered && !p.selected) {
                const img = a.glow || a.stim;
                if (img && img === a.glow) {
                    drawParticleImg(ctx, img, p, GLOW_SCALE);
                } else if (img) {
                    drawParticleImg(ctx, img, p);
                }
            } else {
                const img = a.stim;
                if (img) {
                    drawParticleImg(ctx, img, p);
                } else {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius - 1, 0, Math.PI * 2);
                    ctx.fillStyle = "#3DB39E";
                    ctx.fill();
                }
            }

            ctx.restore();
        });
    }, []);

    // ─── Input ───
    const toCanvasXY = useCallback((clientX, clientY) => {
        const rect = cvRef.current.getBoundingClientRect();
        return {
            x: (clientX - rect.left) * (CW / rect.width),
            y: (clientY - rect.top) * (CH / rect.height),
        };
    }, []);

    const handleTap = useCallback((cx, cy) => {
        const g = G.current;
        if (g.step !== STEP.STOPPED || g.allGuessed) return;
        const { x, y } = toCanvasXY(cx, cy);

        const responseTimeMs = Math.round(performance.now() - g.freezeStartTime);

        for (let i = g.ps.length - 1; i >= 0; i--) {
            const p = g.ps[i];
            if (!p.selected && d2d({ x, y }, p) <= p.radius + 8) {
                p.selected = true;
                p.tapX = Math.round(x);
                p.tapY = Math.round(y);
                p.responseTimeMs = responseTimeMs;
                const selCount = g.ps.filter((pp) => pp.selected).length;
                if (selCount >= DEMO_TARGETS) g.allGuessed = true;
                break;
            }
        }
    }, [toCanvasXY]);

    const handleMove = useCallback((cx, cy) => {
        const g = G.current;
        if (g.step !== STEP.STOPPED) return;
        const { x, y } = toCanvasXY(cx, cy);
        g.ps.forEach((p) => { p.hovered = d2d({ x, y }, p) <= p.radius + 8; });
    }, [toCanvasXY]);

    // ─── JSX ───
    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#000",
                overflow: "hidden",
                position: "relative",
            }}
        >
            <canvas
                ref={cvRef}
                width={CW}
                height={CH}
                style={{
                    display: "block",
                    touchAction: "none",
                    maxWidth: "100vw",
                    maxHeight: "100vh",
                    width: "auto",
                    height: "100vh",
                    objectFit: "contain",
                }}
                onClick={(e) => handleTap(e.clientX, e.clientY)}
                onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
                onTouchStart={(e) => {
                    e.preventDefault();
                    const t = e.touches[0];
                    handleTap(t.clientX, t.clientY);
                }}
            />

            {/* ─── SVG Frame + Text overlay ─── */}
            <StepTextPanel msg={displayMsg} />
        </div>
    );
}