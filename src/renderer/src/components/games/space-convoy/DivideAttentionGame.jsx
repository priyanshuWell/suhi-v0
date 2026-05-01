import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import stimulus_1 from "../../../assets/games/stimulus_1.svg";
import stimulus_2 from "../../../assets/games/stimulus_2.svg";
import stimulus_3 from "../../../assets/games/stimulus_3.svg";
import distractor_1 from "../../../assets/games/distractor_1.svg";
import distractor_2 from "../../../assets/games/distractor_2.svg";
import stimulus_correct_1 from "../../../assets/games/stimulus_correct_1.svg";
import stimulus_correct_2 from "../../../assets/games/stimulus_correct_2.svg";
import stimulus_correct_3 from "../../../assets/games/stimulus_correct_3.svg";
import stimulus_glow_1 from "../../../assets/games/stimulus_glow_1.svg";
import stimulus_glow_2 from "../../../assets/games/stimulus_glow_2.svg";
import stimulus_glow_3 from "../../../assets/games/stimulus_glow_3.svg";
import stimulus_error_1 from "../../../assets/games/stimulus_error_1.svg";
import stimulus_error_2 from "../../../assets/games/stimulus_error_2.svg";
import stimulus_error_3 from "../../../assets/games/stimulus_error_3.svg";
import divideAttentionBg from "../../../assets/games/divideAttentionbg.png";
import { ROUNDS } from "./rounds";
import {
    DivideAttentionTrialStart,
    DivideAttentionTrialComplete,
    DivideAttentionResponseBatch,
    DivideAttentionSessionComplete,
} from "../../../utils/api";

const SCORE = {
    CORRECT_HIT: 10,
    FALSE_ALARM: -5,
    SPEED_BONUS: 3,
};

const ROUNDS_ARR = Object.values(ROUNDS);
const NUM_ROUNDS = ROUNDS_ARR.length;

const PHASE = {
    PREPARE: "PREPARE",
    REVEAL: "REVEAL",
    START: "START",
    FREEZE: "FREEZE",
    OVER: "OVER",
};
const SESS = { IDLE: "IDLE", PLAYING: "PLAYING", ENDED: "ENDED" };

const CW = 1014;
const CH = 1802;
const PAD = 24;
const ARENA = { l: PAD, t: PAD, r: CW - PAD, b: CH - PAD };
const REVEAL_MS = 1000;
const OVER_MS = 1800;

const STIM_PATHS = [stimulus_1, stimulus_2, stimulus_3];
const DIST_PATHS = [distractor_1, distractor_2];

const GLOW_SCALE = [394 / 194, 394 / 194, 394 / 194];
const CORRECT_SCALE = [374 / 194, 294 / 194, 294 / 194];
const ERROR_SCALE = [294 / 194, 294 / 194, 294 / 194];
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
        return await loadImage(
            "data:image/svg+xml;charset=utf-8," + encodeURIComponent(t)
        );
    } catch {
        return null;
    }
}

async function loadPng(path) {
    try {
        const r = await fetch(path);
        const b = await r.blob();
        return await loadImage(URL.createObjectURL(b));
    } catch {
        return null;
    }
}

function spawn(cfg) {
    const ps = [];
    const gap = cfg.radius * 2 + 12;
    const roundStimIdx = Math.floor(Math.random() * 3);

    for (let i = 0; i < cfg.particles; i++) {
        const isTgt = i < cfg.targets;
        let x, y, ok, n = 0;
        do {
            x = rnd(ARENA.l + cfg.radius + 4, ARENA.r - cfg.radius - 4);
            y = rnd(ARENA.t + cfg.radius + 4, ARENA.b - cfg.radius - 4);
            ok = ps.every((p) => d2d({ x, y }, p) >= gap);
            n++;
        } while (!ok && n < 800);

        const angle = rnd(0, Math.PI * 2);
        const speed = rnd(cfg.velocity.min, cfg.velocity.max);

        ps.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: cfg.radius,
            isTarget: isTgt,
            selected: false,
            hovered: false,
            opacity: isTgt ? 1 : 0,
            stimIdx: roundStimIdx,
            distIdx: Math.floor(Math.random() * 2),
            // Scoring fields (set on tap)
            tapX: null,
            tapY: null,
            responseTimeMs: null,
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
                    } dt
                }
            }
        }
    }
}

// ─── Draw helper ───
function drawParticleImg(ctx, img, p, scale = 1) {
    const sz = p.radius * 2 * scale;
    const offset = p.radius * (scale - 1);
    ctx.drawImage(img, p.x - p.radius - offset, p.y - p.radius - offset, sz, sz);
}


function buildResponses(ps, freezeDurationMs) {
    const speedThresholdMs = freezeDurationMs * 0.5;
    let roundScore = 0;
    const responses = [];

    ps.forEach((p, idx) => {
        if (!p.selected) return; // backend calculates miss & correct_rejection itself

        if (p.isTarget) {
            // Correct Hit
            const hasSpeedBonus = p.responseTimeMs !== null && p.responseTimeMs < speedThresholdMs;
            const points = SCORE.CORRECT_HIT + (hasSpeedBonus ? SCORE.SPEED_BONUS : 0);
            roundScore += points;
            responses.push({
                object_index: idx,
                object_type: "target",
                response_time_ms: p.responseTimeMs ?? 0,
                tap_x: p.tapX ?? 0,
                tap_y: p.tapY ?? 0,
                response_type: "correct_hit",
                is_correct: true,
                points_awarded: points,
                speed_bonus: hasSpeedBonus,
            });
        } else {
            // False Alarm
            roundScore += SCORE.FALSE_ALARM;
            responses.push({
                object_index: idx,
                object_type: "distractor",
                response_time_ms: p.responseTimeMs ?? 0,
                tap_x: p.tapX ?? 0,
                tap_y: p.tapY ?? 0,
                response_type: "false_alarm",
                is_correct: false,
                points_awarded: SCORE.FALSE_ALARM,
                speed_bonus: false,
            });
        }
    });

    return { responses, roundScore };
}

export default function SpaceConvoy() {
    const navigate = useNavigate();
    const location = useLocation();
    // sessionId was created in SpaceConvoyMain when user clicked "Start Demo"
    const sessionId = location.state?.sessionId ?? null;

    const cvRef = useRef(null);
    const assets = useRef({
        stim: [], glow: [], correct: [], error: [], distImgs: [],
        bg: null, loaded: false,
    });

    // ─── API state ───
    const apiState = useRef({
        trialId: null,
        trialNumber: 0,
        totalScore: 0,
    });

    const G = useRef({
        sess: SESS.IDLE,
        ph: PHASE.PREPARE,
        ri: 0,
        ps: [],
        phaseElapsed: 0,
        freezeRemaining: 0,
        freezeStartTime: 0,
        revealProgress: 0,
        allGuessed: false,
        failState: "none",
        results: [],
        highestRound: 0,
        totalCorrect: 0,
        totalWrong: 0,
        totalAttempts: 0,
        globalTime: 0,
    }); dt
    const rafRef = useRef(null);
    const prevTime = useRef(0);

    // ─── Load assets ───
    useEffect(() => {
        (async () => {
            const stim = await Promise.all(STIM_PATHS.map(loadSvg));
            const glow = await Promise.all(
                [stimulus_glow_1, stimulus_glow_2, stimulus_glow_3].map(loadSvg)
            );
            const correct = await Promise.all(
                [stimulus_correct_1, stimulus_correct_2, stimulus_correct_3].map(loadSvg)
            );
            const error = await Promise.all(
                [stimulus_error_1, stimulus_error_2, stimulus_error_3].map(loadSvg)
            );
            const distImgs = (await Promise.all(DIST_PATHS.map(loadSvg))).filter(Boolean);
            const bg = await loadPng(divideAttentionBg);

            assets.current = { stim, glow, correct, error, distImgs, bg, loaded: true };
            startSession();
        })();
    }, []);

    const startSession = useCallback(() => {
        const g = G.current;
        const api = apiState.current;

        Object.assign(g, {
            sess: SESS.PLAYING, ri: 0, results: [],
            failState: "none", highestRound: 0,
            totalCorrect: 0, totalWrong: 0, totalAttempts: 0,
        });

        api.trialNumber = 0;
        api.totalScore = 0;

        console.log("[DivideAttention] Main game starting | sessionId:", sessionId);
        initRound(0);
    }, [sessionId]);

    const initRound = useCallback(async (idx) => {
        const g = G.current;
        const api = apiState.current;
        const cfg = ROUNDS_ARR[idx];

        Object.assign(g, {
            ri: idx, ph: PHASE.PREPARE, phaseElapsed: 0, freezeRemaining: 0,
            freezeStartTime: 0, revealProgress: 0, allGuessed: false, ps: spawn(cfg),
        });

        api.trialNumber += 1;

        console.log(
            `[DivideAttention] Round ${idx + 1}: ${cfg.name} | ${cfg.targets}t / ${cfg.particles}p | r:${cfg.radius} | failState:${g.failState}`
        );

        if (sessionId) {
            const trialResult = await DivideAttentionTrialStart({
                session_id: sessionId,
                trial_number: api.trialNumber,
                trial_type: "main",
                num_targets: cfg.targets,
                num_distractors: cfg.particles - cfg.targets,
                total_objects: cfg.particles,
                tracking_duration_ms: cfg.time.freeze,
            });

            if (trialResult.success) {
                api.trialId = trialResult.data.trial_id ?? trialResult.data.id ?? null;
                console.log("[DivideAttention] Trial started:", api.data.trial_id);
            } else {
                console.warn("[DivideAttention] Trial start failed, continuing offline");
                api.trialId = null;
            }
        }
    }, [sessionId]);

    // ─── Evaluate round: score, send batch, complete trial ───
    const evaluateRound = useCallback(async () => {
        const g = G.current;
        const api = apiState.current;
        const cfg = ROUNDS_ARR[g.ri];

        let ok = 0, bad = 0, miss = 0;
        g.ps.forEach((p) => {
            if (p.isTarget && p.selected) ok++;
            else if (!p.isTarget && p.selected) bad++;
            else if (p.isTarget && !p.selected) miss++;
        });

        const passed = bad === 0 && miss === 0;

        // ─── Build scored responses ───
        const { responses, roundScore } = buildResponses(g.ps, cfg.time.freeze);
        api.totalScore += roundScore;

        const result = {
            round: g.ri + 1, name: cfg.name, targets: cfg.targets,
            particles: cfg.particles, correct: ok, wrong: bad, missed: miss, passed,
            score: roundScore,
        };
        g.results.push(result);
        g.totalCorrect += ok;
        g.totalWrong += bad;
        g.totalAttempts++;
        if (g.ri + 1 > g.highestRound) g.highestRound = g.ri + 1;
        g.ph = PHASE.OVER;
        g.phaseElapsed = 0;

        console.log(`[DivideAttention] Round ${g.ri + 1} result:`, result);
        console.log(`[DivideAttention] Round score: ${roundScore} | Total: ${api.totalScore}`);

        // ─── Send responses to backend ───
        if (api.trialId) {
            const batchResult = await DivideAttentionResponseBatch({
                trial_id: api.trialId,
                responses,
            });
            if (!batchResult.success) {
                console.warn("[DivideAttention] Response batch failed");
            }

            const completeResult = await DivideAttentionTrialComplete(api.trialId);
            if (!completeResult.success) {
                console.warn("[DivideAttention] Trial complete failed");
            }
        }

        setTimeout(() => {
            if (g.sess !== SESS.PLAYING) return;

            if (passed) {
                if (g.failState === "goback") {
                    g.failState = "final";
                    if (g.ri + 1 < NUM_ROUNDS) {
                        initRound(g.ri + 1);
                    } else {
                        endSession();
                    }
                } else {
                    g.failState = "none";
                    if (g.ri + 1 < NUM_ROUNDS) {
                        initRound(g.ri + 1);
                    } else {
                        endSession();
                    }
                }
            } else {
                switch (g.failState) {
                    case "none":
                        console.log("[DivideAttention] 1st fail → retry same round");
                        g.failState = "retry";
                        initRound(g.ri);
                        break;

                    case "retry":
                        console.log("[DivideAttention] 2nd fail → go to previous round");
                        if (g.ri > 0) {
                            g.failState = "goback";
                            initRound(g.ri - 1);
                        } else {
                            console.log("[DivideAttention] Can't go back from round 1 → abort");
                            endSession();
                        }
                        break;

                    case "goback":
                        console.log("[DivideAttention] Failed previous round → abort");
                        endSession();
                        break;

                    case "final":
                        console.log("[DivideAttention] Final attempt failed → abort");
                        endSession();
                        break;

                    default:
                        endSession();
                        break;
                }
            }
        }, OVER_MS);
    }, []);

    // ─── End session ───
    const endSession = useCallback(async () => {
        const g = G.current;
        const api = apiState.current;
        g.sess = SESS.ENDED;

        console.log("[DivideAttention] Session complete:", {
            highestRound: g.highestRound,
            totalCorrect: g.totalCorrect,
            totalWrong: g.totalWrong,
            totalAttempts: g.totalAttempts,
            totalScore: api.totalScore,
            rounds: g.results,
        });

        if (sessionId) {
            const result = await DivideAttentionSessionComplete(sessionId);
            if (!result.success) {
                console.warn("[DivideAttention] Session complete API failed");
            }
        }

        setTimeout(() => {
            navigate('/space-convoy-complete')
        }, 500);
    }, [navigate]);

    // ─── Game loop ───
    useEffect(() => {
        const loop = (t) => {
            const dt = prevTime.current ? Math.min(t - prevTime.current, 50) : 16.667;
            prevTime.current = t;
            const g = G.current;
            if (!assets.current.loaded) {
                rafRef.current = requestAnimationFrame(loop);
                return;
            }
            g.globalTime = t;

            if (g.sess === SESS.PLAYING) {
                const cfg = ROUNDS_ARR[g.ri];
                switch (g.ph) {
                    case PHASE.PREPARE:
                        g.phaseElapsed += dt;
                        physics(g.ps, dt, false);
                        if (g.phaseElapsed >= cfg.time.preparation) {
                            g.ph = PHASE.REVEAL;
                            g.phaseElapsed = 0;
                        }
                        break;
                    case PHASE.REVEAL:
                        g.phaseElapsed += dt;
                        g.revealProgress = Math.min(1, g.phaseElapsed / REVEAL_MS);
                        g.ps.forEach((p) => { if (!p.isTarget) p.opacity = g.revealProgress; });
                        physics(g.ps, dt, true);
                        if (g.phaseElapsed >= REVEAL_MS) {
                            g.ph = PHASE.START;
                            g.phaseElapsed = 0;
                            g.ps.forEach((p) => { p.opacity = 1; });
                        }
                        break;
                    case PHASE.START:
                        g.phaseElapsed += dt;
                        physics(g.ps, dt, true);
                        if (g.phaseElapsed >= cfg.time.game) {
                            g.ph = PHASE.FREEZE;
                            g.phaseElapsed = 0;
                            g.freezeRemaining = cfg.time.freeze;
                            g.freezeStartTime = performance.now(); // ← record freeze start
                            g.ps.forEach((p) => { p.vx = 0; p.vy = 0; });
                        }
                        break;
                    case PHASE.FREEZE:
                        g.freezeRemaining -= dt;
                        physics(g.ps, dt, false);
                        if (g.freezeRemaining <= 0 || g.allGuessed) evaluateRound();
                        break;
                    case PHASE.OVER:
                        break;
                }
            }

            draw();
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [evaluateRound]);

    // ─── Render ───
    const draw = useCallback(() => {
        const cv = cvRef.current;
        if (!cv) return;
        if (!assets.current.loaded) return;
        const ctx = cv.getContext("2d");

        const g = G.current;
        const a = assets.current;

        ctx.clearRect(0, 0, CW, CH);

        if (a.bg) {
            ctx.drawImage(a.bg, 0, 0, CW, CH);
        } else {
            const gr = ctx.createLinearGradient(0, 0, 0, CH);
            gr.addColorStop(0, "#0b1a2e");
            gr.addColorStop(1, "#080e18");
            ctx.fillStyle = gr;
            ctx.fillRect(0, 0, CW, CH);
        }

        const { stim, glow, correct, error, distImgs } = a;

        g.ps.forEach((p) => {
            if (g.ph === PHASE.PREPARE && !p.isTarget) return;
            if (p.opacity <= 0) return;

            ctx.save();
            ctx.globalAlpha = p.opacity;

            const si = p.stimIdx;

            if (p.selected && (g.ph === PHASE.FREEZE || g.ph === PHASE.OVER)) {
                if (p.isTarget) {
                    const img = correct[si] || stim[si];
                    if (img && img === correct[si]) {
                        drawParticleImg(ctx, img, p, CORRECT_SCALE[si]);
                    } else if (img) {
                        drawParticleImg(ctx, img, p);
                    }
                } else {
                    const img = error[si] || stim[si];
                    if (img && img === error[si]) {
                        drawParticleImg(ctx, img, p, ERROR_SCALE[si]);
                    } else if (img) {
                        drawParticleImg(ctx, img, p);
                    }
                }
            } else if (g.ph === PHASE.PREPARE && p.isTarget) {
                const img = glow[si] || stim[si];
                if (img && img === glow[si]) {
                    drawParticleImg(ctx, img, p, GLOW_SCALE[si]);
                } else if (img) {
                    drawParticleImg(ctx, img, p);
                }
            } else if (g.ph === PHASE.FREEZE && p.hovered && !p.selected) {
                const img = glow[si] || stim[si];
                if (img && img === glow[si]) {
                    drawParticleImg(ctx, img, p, GLOW_SCALE[si]);
                } else if (img) {
                    drawParticleImg(ctx, img, p);
                }
            } else {
                const img = stim[si];
                if (img) {
                    drawParticleImg(ctx, img, p);
                } else {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius - 1, 0, Math.PI * 2);
                    ctx.fillStyle = p.isTarget ? "#3DB39E" : "#F4B459";
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
        const api = apiState.current;
        if (g.ph !== PHASE.FREEZE || g.allGuessed) return;
        const { x, y } = toCanvasXY(cx, cy);
        const cfg = ROUNDS_ARR[g.ri];

        // response_time_ms = time elapsed since FREEZE began
        const responseTimeMs = performance.now() - g.freezeStartTime;

        for (let i = g.ps.length - 1; i >= 0; i--) {
            const p = g.ps[i];
            if (!p.selected && d2d({ x, y }, p) <= p.radius + 8) {
                p.selected = true;
                p.tapX = Math.round(x);
                p.tapY = Math.round(y);
                p.responseTimeMs = Math.round(responseTimeMs);

                console.log(
                    `[DivideAttention] Tap ${i}: ${p.isTarget ? "TARGET ✓" : "DISTRACTOR ✗"} | ${p.responseTimeMs}ms`
                );

                if (g.ps.filter((pp) => pp.selected).length >= cfg.targets) {
                    g.allGuessed = true;
                }
                break;
            }
        }
    }, [toCanvasXY]);

    const handleMove = useCallback((cx, cy) => {
        const g = G.current;
        if (g.ph !== PHASE.FREEZE) return;
        const { x, y } = toCanvasXY(cx, cy);
        g.ps.forEach((p) => { p.hovered = d2d({ x, y }, p) <= p.radius + 8; });
    }, [toCanvasXY]);

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
        </div>
    );
}