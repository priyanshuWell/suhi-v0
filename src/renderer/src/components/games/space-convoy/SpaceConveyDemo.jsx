import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import gameBgMusic from "../../../assets/audio/space_convoy/game_background.wav";
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
} from "../../../utils/api";



// ─── Canvas / Arena ───
const CW = 1014;
const CH = 1802;
const PAD = 60;

const PANEL_TOP = 100;
const PANEL_H = 260;
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
const STEP_FREEZE_MS = 15000;
const STEP_RESULT_MS = 2000;
const REVEAL_MS = 800;

// Submit button — same dimensions/position as SpaceConvoy
const SUBMIT_BTN = { w: 420, h: 100, r: 20, bottomPad: 60 };

// Ripple config
const RIPPLE_COUNT = 3;
const RIPPLE_CYCLE_MS = 2000;
const RIPPLE_MAX_EXPAND = 1.8;
const RIPPLE_COLOR = "rgba(255, 255, 255,";

// Scale factors
const GLOW_SCALE = 394 / 194;
const CORRECT_SCALE = 374 / 194;
const ERROR_SCALE = 294 / 194;

// Tier colour — teal (matches SpaceConvoy tier 1)
const TIER_PRIMARY = "#3DB39E";

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

const STEP_I18N_KEYS = {
    [STEP.SHOW_TARGETS]: "spaceConvoy.watch_highlighted",
    [STEP.ALL_SAME]: "spaceConvoy.all_look_same",
    [STEP.MOVING]: "spaceConvoy.follow_them",
    [STEP.STOPPED]: "spaceConvoy.tap_tracked",
    [STEP.RESULT]: "spaceConvoy.great_job_retry",
    [STEP.DONE]: "spaceConvoy.great_job_start",
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

    for (let i = ps.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ps[i], ps[j]] = [ps[j], ps[i]];
    }
    return ps;
}

// ─── Physics ───
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

// ─── Submit Button (drawn on canvas during STOPPED) ───────────────────────────
// Mirrors SpaceConvoy's drawSubmitButton exactly.
// Shows "Submit" with a pulsing border. Hint text if nothing selected yet.

function drawSubmitButton(ctx, ps, globalTime) {
    const bw = SUBMIT_BTN.w, bh = SUBMIT_BTN.h, br = SUBMIT_BTN.r;
    const bx = (CW - bw) / 2;
    const by = CH - SUBMIT_BTN.bottomPad - bh;

    ctx.save();

    // Background
    ctx.fillStyle = "rgba(4,9,26,0.88)";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, br);
    ctx.fill();

    // Pulsing border
    const pulse = 0.55 + 0.45 * Math.sin(globalTime * 0.004);
    ctx.strokeStyle = TIER_PRIMARY + Math.round(pulse * 200).toString(16).padStart(2, "0");
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, br);
    ctx.stroke();

    // Label
    const anySelected = ps.some(p => p.selected);
    ctx.font = `bold 44px 'Arial Black', Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = anySelected ? "#ffffff" : "rgba(255,255,255,0.35)";
    ctx.fillText("Submit", CW / 2, by + bh * 0.62);

    // Hint
    if (!anySelected) {
        ctx.font = "400 26px Arial, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillText("Tap the targets first", CW / 2, by + bh * 0.85);
    }

    ctx.restore();
}

// ─── Hit test: is a tap on the submit button? ────────────────────────────────
function isSubmitTap(x, y) {
    const bw = SUBMIT_BTN.w, bh = SUBMIT_BTN.h;
    const bx = (CW - bw) / 2;
    const by = CH - SUBMIT_BTN.bottomPad - bh;
    return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
}

// ════════════════════════════════════════════
//  DEMO COMPONENT
// ════════════════════════════════════════════
export default function SpaceConveyDemo({ activeSessionId, onComplete, handleMoveToComplete }) {
    const { t } = useTranslation();
    const sessionIdRef = useRef(activeSessionId);
    sessionIdRef.current = activeSessionId;
    const [displayStep, setDisplayStep] = useState(STEP.LOADING);
    const [displayMsg, setDisplayMsg] = useState("");
    const navigate = useNavigate();
    const userId = useSelector((state) => state.auth?.user?.id ?? null);
    const cvRef = useRef(null);
    const assets = useRef({
        stim: null, glow: null, correct: null, error: null,
        frame: null, bg: null, loaded: false,
    });
    console.log("active", activeSessionId)
    const G = useRef({
        step: STEP.LOADING,
        ps: [],
        elapsed: 0,
        revealProgress: 0,
        allGuessed: false,
        globalTime: 0,
        resultHandled: false,
        practiceRound: 1,   // 1 = trial 1, 2 = trial 2
        failCount: 0,       // resets per trial
        trial1Passed: false, // true once trial 1 is passed correctly
        freezeStartTime: 0,
        trialStarted: false,
        submitted: false,
    });

    const apiRef = useRef({
        trialId: null,
        trialNumber: 0,
        pendingResponses: [],

    });
    const rafRef = useRef(null);
    const prevTime = useRef(0);
    const bgAudioRef = useRef(null);  // dedicated looping background music element

    // ─── Load assets ───
    useEffect(() => {
        // Set up looping background music
        const audio = new Audio(gameBgMusic);
        audio.loop = true;
        audio.volume = 0.15;
        bgAudioRef.current = audio;

        (async () => {
            const stim = await loadSvg(stimulus_1);
            const glow = await loadSvg(stimulus_glow_1);
            const correct = await loadSvg(stimulus_correct_1);
            const error = await loadSvg(stimulus_error_1);
            const frame = await loadSvg(textFrameSvg);
            const bg = await loadPng(divideAttentionBg);

            assets.current = { stim, glow, correct, error, frame, bg, loaded: true };

            const g = G.current;
            g.ps = spawnDemo();
            g.step = STEP.SHOW_TARGETS;
            g.elapsed = 0;
            setDisplayMsg(t(STEP_I18N_KEYS[STEP.SHOW_TARGETS]));
            setDisplayStep(STEP.SHOW_TARGETS);

            // Start music (may require user gesture in browser; works immediately in Electron)
            audio.play().catch(() => {
                // Autoplay blocked — will start on first tap instead
                G.current._bgPending = true;
            });
        })();

        return () => {
            audio.pause();
            audio.src = "";
        };
    }, []);

    // ─── Trial API helpers ───
    const startPracticeTrial = useCallback(async () => {
        const api = apiRef.current;
        api.trialNumber += 1;
        api.trialId = null;
        api.pendingResponses = [];

        // Read from ref so we always get the latest session_id,
        // even if the prop arrived after this callback was first created.
        const sid = sessionIdRef.current;
        if (!sid) {
            console.warn("[Demo] Trial start skipped — session_id not yet available");
            return;
        }

        const result = await DivideAttentionTrialStart({
            session_id: sid,
            trial_number: api.trialNumber,
            num_targets: DEMO_TARGETS,
            num_distractors: DEMO_PARTICLES - DEMO_TARGETS,
            total_objects: DEMO_PARTICLES,
            trial_type: "practice",
        });
        if (result.success) {
            api.trialId = result.data?.trial_id;
            console.log("[Demo] Trial started:", api.trialId, "| trial_number:", api.trialNumber);
        } else {
            console.warn("[Demo] Trial start failed, continuing offline");
        }
    }, []); // sessionIdRef is a ref — no dep needed, always reads latest value

    // CHANGE: finishPracticeTrial now accepts submitTimeMs for tracking_duration_ms.
    // Removed points_awarded and speed_bonus from response objects.
    // TrialComplete now receives summary stats body.
    const finishPracticeTrial = useCallback(async (ps, submitTimeMs) => {
        const api = apiRef.current;
        const sid = sessionIdRef.current; // always read the latest session_id from ref
        if (!sid || !api.trialId) return;

        const freezeDurationMs = submitTimeMs;   // freeze start → submit tap
        const speedThresholdMs = freezeDurationMs * 0.5;
        const responses = [];
        let hits = 0, misses = 0, falseAlarms = 0, correctRejections = 0;

        ps.forEach((p, idx) => {
            if (p.selected) {
                if (p.isTarget) {
                    // Correct Hit
                    hits++;
                    responses.push({
                        object_index: idx,
                        object_type: "target",
                        response_time_ms: p.responseTimeMs ?? 0,
                        tap_x: p.tapX ?? 0,
                        tap_y: p.tapY ?? 0,
                        response_type: "correct_hit",
                        is_correct: true,
                        // points_awarded and speed_bonus removed — not in new API spec
                    });
                } else {
                    // False Alarm
                    falseAlarms++;
                    responses.push({
                        object_index: idx,
                        object_type: "distractor",
                        response_time_ms: p.responseTimeMs ?? 0,
                        tap_x: p.tapX ?? 0,
                        tap_y: p.tapY ?? 0,
                        response_type: "false_alarm",
                        is_correct: false,
                    });
                }
            } else {
                if (p.isTarget) {
                    // Miss — target not tapped
                    misses++;
                    responses.push({
                        object_index: idx,
                        object_type: "target",
                        response_time_ms: null,
                        tap_x: null,
                        tap_y: null,
                        response_type: "miss",
                        is_correct: false,
                    });
                } else {
                    // Correct Rejection — distractor not tapped
                    correctRejections++;
                    responses.push({
                        object_index: idx,
                        object_type: "distractor",
                        response_time_ms: null,
                        tap_x: null,
                        tap_y: null,
                        response_type: "correct_rejection",
                        is_correct: true,
                    });
                }
            }
        });

        if (responses.length > 0) {
            const batchResult = await DivideAttentionResponseBatch({
                trial_id: api.trialId,
                responses,
            });
            if (!batchResult.success) console.warn("[Demo] Response batch failed");
        }

        // CHANGE: TrialComplete now sends summary stats as body
        const completeResult = await DivideAttentionTrialComplete(api.trialId, {
            tracking_duration_ms: Math.round(freezeDurationMs),
            hits,
            misses,
            false_alarms: falseAlarms,
            correct_rejections: correctRejections,
        });
        if (!completeResult.success) console.warn("[Demo] Trial complete failed");
        else console.log("[Demo] Trial complete:", api.trialId);
        // NOTE: DivideAttentionSessionComplete is intentionally NOT called here.
        // It is only called in handleSubmit after the final (Trial 2) submission.
    }, [activeSessionId]);

    // ─── Submit handler ───────────────────────────────────────────────────────
    // Option B: need correct on BOTH trials to proceed to main game.
    //
    // Trial 1 correct → advance to Trial 2
    // Trial 1 fail    → retry Trial 1 (failCount tracks retries, max 3 → main game anyway)
    // Trial 2 correct → go to main game
    // Trial 2 fail    → retry Trial 2 (failCount tracks retries, max 3 → main game anyway)
    //
    // "Correct" = at least 1 correct target hit (correctHits >= 1)
    const handleSubmit = useCallback(async () => {
        const g = G.current;
        if (g.step !== STEP.STOPPED || g.submitted) return;
        g.submitted = true;

        const submitTimeMs = performance.now() - g.freezeStartTime;

        const correctHits = g.ps.filter(p => p.isTarget && p.selected).length;
        const passed = correctHits >= 1;

        if (g.practiceRound === 1) {
            // Fire-and-forget for Trial 1 — session NOT completed yet
            finishPracticeTrial(g.ps, submitTimeMs);

            if (passed) {
                // Trial 1 passed → show success message, then start Trial 2
                g.trial1Passed = true;
                g.failCount = 0;
                setDisplayMsg(t("spaceConvoy.great_job_retry"));
                setDisplayStep(STEP.RESULT);
                g.step = STEP.RESULT;
                g.elapsed = 0;
                g.resultHandled = false;
            } else {
                // Trial 1 failed → retry
                g.step = STEP.RESULT;
                g.elapsed = 0;
                g.resultHandled = false;
            }
        } else {
            // Trial 2 — AWAIT trial finish before completing the session
            // so the backend's float aggregation sees fully committed trial data.
            await finishPracticeTrial(g.ps, submitTimeMs);

            // const sid = sessionIdRef.current;
            // const r = await DivideAttentionSessionComplete(sid);
            // if (!r.success) console.warn("[Demo] Session complete failed");
            // else console.log("[Demo] Practice session complete:", sid);
            // await finishPracticeTrial(g.ps, submitTimeMs);
            if (passed) {
                // Both trials passed → go to main game
                g.step = STEP.DONE;
                setDisplayMsg(t(STEP_I18N_KEYS[STEP.DONE]));
                setDisplayStep(STEP.DONE);
                // Stop background music when demo completes
                if (bgAudioRef.current) { bgAudioRef.current.pause(); bgAudioRef.current.currentTime = 0; }
                setTimeout(() => onComplete?.(), 1500);
            } else {
                // Trial 2 failed → retry Trial 2
                g.step = STEP.RESULT;
                g.elapsed = 0;
                g.resultHandled = false;
            }
        }
    }, [finishPracticeTrial, onComplete]); // sessionIdRef is a ref — no dep needed

    // ─── Game loop ───
    useEffect(() => {
        const loop = (time) => {
            const dt = prevTime.current ? Math.min(time - prevTime.current, 50) : 16.667;
            prevTime.current = time;
            const g = G.current;
            g.globalTime = time;

            if (g.step !== STEP.LOADING && g.step !== STEP.DONE) {
                g.elapsed += dt;

                switch (g.step) {
                    case STEP.SHOW_TARGETS:
                        physics(g.ps, dt, false);
                        if (g.elapsed >= STEP_SHOW_TARGETS_MS) {
                            g.step = STEP.ALL_SAME;
                            g.elapsed = 0;
                            setDisplayStep(STEP.ALL_SAME);
                            setDisplayMsg(t(STEP_I18N_KEYS[STEP.ALL_SAME]));
                        }
                        break;

                    case STEP.ALL_SAME:
                        g.revealProgress = Math.min(1, g.elapsed / REVEAL_MS);
                        g.ps.forEach((p) => {
                            if (!p.isTarget) p.opacity = g.revealProgress;
                        });
                        physics(g.ps, dt, false);
                        if (g.elapsed >= STEP_ALL_SAME_MS) {
                            g.ps.forEach((p) => { p.opacity = 1; });
                            g.step = STEP.MOVING;
                            g.elapsed = 0;
                            setDisplayMsg(t(STEP_I18N_KEYS[STEP.MOVING]));
                        }
                        break;

                    case STEP.MOVING:
                        physics(g.ps, dt, true);
                        if (g.elapsed >= STEP_MOVING_MS) {
                            g.ps.forEach((p) => { p.vx = 0; p.vy = 0; });
                            g.step = STEP.STOPPED;
                            g.elapsed = 0;
                            g.freezeStartTime = performance.now();
                            g.submitted = false;    // reset submit guard for new round
                            g.trialStarted = false;
                            setDisplayMsg(t(STEP_I18N_KEYS[STEP.STOPPED]));
                        }
                        break;

                    case STEP.STOPPED:
                        // Call TrialStart exactly once when entering STOPPED
                        if (!g.trialStarted) {
                            g.trialStarted = true;
                            startPracticeTrial();
                        }
                        physics(g.ps, dt, false);
                        // Auto-advance removed — user must tap Submit now.
                        // STEP_FREEZE_MS timeout still acts as a safety fallback.
                        if (g.elapsed >= STEP_FREEZE_MS && !g.submitted) {
                            handleSubmit();
                        }
                        break;

                    case STEP.RESULT:
                        if (g.elapsed >= STEP_RESULT_MS && !g.resultHandled) {
                            g.resultHandled = true;

                            if (g.trial1Passed && g.practiceRound === 1) {
                                // Trial 1 just passed — advance to Trial 2
                                g.practiceRound = 2;
                                setTimeout(() => {
                                    g.ps = spawnDemo();
                                    g.allGuessed = false;
                                    g.revealProgress = 0;
                                    g.resultHandled = false;
                                    g.trialStarted = false;
                                    g.submitted = false;
                                    g.step = STEP.SHOW_TARGETS;
                                    g.elapsed = 0;
                                    setDisplayStep(STEP.SHOW_TARGETS);
                                    setDisplayMsg(t(STEP_I18N_KEYS[STEP.SHOW_TARGETS]));
                                }, 2000);
                            } else {
                                // Trial 1 or Trial 2 failed — retry or give up
                                g.failCount += 1;
                                if (g.failCount >= 3) {
                                    // Max retries on this trial — move on anyway
                                    if (bgAudioRef.current) { bgAudioRef.current.pause(); bgAudioRef.current.currentTime = 0; }
                                    setTimeout(() => onComplete?.(), 2000);
                                } else {
                                    const trialNum = g.practiceRound === 1 ? "first" : "second";
                                    setDisplayMsg(`Keep track of the ${trialNum} set. Let's try again.`);
                                    setTimeout(() => {
                                        g.ps = spawnDemo();
                                        g.allGuessed = false;
                                        g.revealProgress = 0;
                                        g.resultHandled = false;
                                        g.trialStarted = false;
                                        g.submitted = false;
                                        g.step = STEP.SHOW_TARGETS;
                                        g.elapsed = 0;
                                        setDisplayStep(STEP.SHOW_TARGETS);
                                        setDisplayMsg(t(STEP_I18N_KEYS[STEP.SHOW_TARGETS]));
                                    }, 2000);
                                }
                            }
                        }
                        break;
                }
            }

            draw(time);
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [onComplete, handleSubmit, startPracticeTrial]); // include startPracticeTrial so the loop always calls the latest version

    // ─── Draw ───
    const draw = useCallback((time) => {
        const cv = cvRef.current;
        if (!cv) return;
        const ctx = cv.getContext("2d");
        const g = G.current;
        const a = assets.current;

        ctx.clearRect(0, 0, CW, CH);

        if (a.bg) {
            ctx.drawImage(a.bg, 0, 0, CW, CH);
        } else {
            const gr = ctx.createLinearGradient(0, 0, 0, CH);
            gr.addColorStop(0, "#0b1a2e"); gr.addColorStop(1, "#080e18");
            ctx.fillStyle = gr; ctx.fillRect(0, 0, CW, CH);
        }

        if (g.step === STEP.LOADING) return;

        // ─── Particles ───
        g.ps.forEach((p) => {
            if (g.step === STEP.SHOW_TARGETS && !p.isTarget) return;
            if (p.opacity <= 0) return;

            ctx.save();
            ctx.globalAlpha = p.opacity;

            const showRipple =
                (g.step === STEP.SHOW_TARGETS && p.isTarget) ||
                (g.step === STEP.STOPPED && p.hovered && !p.selected);

            if (showRipple) drawWaterRipple(ctx, p, time || 0);

            if (p.selected && (g.step === STEP.STOPPED || g.step === STEP.RESULT || g.step === STEP.DONE)) {
                if (p.isTarget) {
                    const img = a.correct || a.stim;
                    drawParticleImg(ctx, img, p, img === a.correct ? CORRECT_SCALE : 1);
                } else {
                    const img = a.error || a.stim;
                    drawParticleImg(ctx, img, p, img === a.error ? ERROR_SCALE : 1);
                }
            } else if (g.step === STEP.SHOW_TARGETS && p.isTarget) {
                const img = a.glow || a.stim;
                drawParticleImg(ctx, img, p, img === a.glow ? GLOW_SCALE : 1);
            } else if (g.step === STEP.STOPPED && p.hovered && !p.selected) {
                const img = a.glow || a.stim;
                drawParticleImg(ctx, img, p, img === a.glow ? GLOW_SCALE : 1);
            } else {
                const img = a.stim;
                if (img) {
                    drawParticleImg(ctx, img, p);
                } else {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius - 1, 0, Math.PI * 2);
                    ctx.fillStyle = TIER_PRIMARY;
                    ctx.fill();
                }
            }

            ctx.restore();
        });

        // ─── Submit button — only during STOPPED and not yet submitted ───
        if (g.step === STEP.STOPPED && !g.submitted) {
            drawSubmitButton(ctx, g.ps, g.globalTime);
        }
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
        // Resume background music on first tap (handles autoplay policy)
        if (g._bgPending && bgAudioRef.current) {
            bgAudioRef.current.play().catch(() => { });
            g._bgPending = false;
        }
        if (g.step !== STEP.STOPPED || g.submitted) return;
        const { x, y } = toCanvasXY(cx, cy);

        // Check submit button first
        if (isSubmitTap(x, y)) {
            handleSubmit();
            return;
        }

        // Particle tap
        const responseTimeMs = Math.round(performance.now() - g.freezeStartTime);

        for (let i = g.ps.length - 1; i >= 0; i--) {
            const p = g.ps[i];
            if (!p.selected && d2d({ x, y }, p) <= p.radius + 8) {
                p.selected = true;
                p.tapX = Math.round(x);
                p.tapY = Math.round(y);
                p.responseTimeMs = responseTimeMs;
                // NOTE: allGuessed no longer auto-submits — user must tap Submit
                const selCount = g.ps.filter((pp) => pp.selected).length;
                if (selCount >= DEMO_TARGETS) g.allGuessed = true;
                break;
            }
        }
    }, [toCanvasXY, handleSubmit]);

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