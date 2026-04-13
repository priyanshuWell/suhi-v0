import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
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

// ─── Round config ───
const ROUNDS_ARR = Object.values(ROUNDS);
const NUM_ROUNDS = ROUNDS_ARR.length;

// ─── Phases ───
const PHASE = {
    PREPARE: "PREPARE",
    REVEAL: "REVEAL",
    START: "START",
    FREEZE: "FREEZE",
    OVER: "OVER",
};
const SESS = { IDLE: "IDLE", PLAYING: "PLAYING", ENDED: "ENDED" };

// ─── Canvas / Arena ───
const CW = 1014;
const CH = 1802;
const PAD = 24;
const ARENA = { l: PAD, t: PAD, r: CW - PAD, b: CH - PAD };
const REVEAL_MS = 1000;
const OVER_MS = 1800;

// ─── Asset arrays ───
const STIM_PATHS = [stimulus_1, stimulus_2, stimulus_3];
const DIST_PATHS = [distractor_1, distractor_2];

/*
 * Scale factors for glow/correct/error SVGs.
 * These SVGs wrap the 194px stimulus inside a larger canvas with glow/shadow.
 * To keep the inner stimulus the SAME size as the normal one, we draw them
 * at (radius * 2 * scaleFactor) and offset by -(radius * (scaleFactor - 1)).
 *
 * SVG dimensions → scale = svgWidth / 194 (the inner stimulus size)
 *
 * glow_1: 394×394, viewBox "100 100 194 194" → scale ≈ 394/194 ≈ 2.03
 * glow_2: 394×394 → same
 * glow_3: 394×394 → same
 * correct_1: 374×374 → 374/194 ≈ 1.93
 * correct_2: 289×294 → ~294/194 ≈ 1.52 (use max dim)
 * correct_3: 294×294 → 294/194 ≈ 1.52
 * error_1: 294×294 → 294/194 ≈ 1.52
 * error_2: 294×289 → 294/194 ≈ 1.52
 * error_3: 294×294 → 294/194 ≈ 1.52
 */
const GLOW_SCALE = [394 / 194, 394 / 194, 394 / 194];
const CORRECT_SCALE = [374 / 194, 294 / 194, 294 / 194];
const ERROR_SCALE = [294 / 194, 294 / 194, 294 / 194];

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

// ─── Spawn particles ───
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
        });
    }

    // Fisher-Yates shuffle
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

// ─── Draw helper: draw image centered on particle, with optional scale ───
function drawParticleImg(ctx, img, p, scale = 1) {
    const sz = p.radius * 2 * scale;
    const offset = p.radius * (scale - 1);
    ctx.drawImage(img, p.x - p.radius - offset, p.y - p.radius - offset, sz, sz);
}

// ════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════
export default function DivideAttentionGame() {
    const navigate = useNavigate();
    const cvRef = useRef(null);
    const assets = useRef({
        stim: [], glow: [], correct: [], error: [], distImgs: [],
        bg: null, loaded: false,
    });
    const G = useRef({
        sess: SESS.IDLE, ph: PHASE.PREPARE, ri: 0, ps: [],
        phaseElapsed: 0, freezeRemaining: 0, revealProgress: 0,
        consecutiveWrong: 0, lastChance: false, allGuessed: false,
        results: [], highestRound: 0, totalCorrect: 0, totalWrong: 0, totalAttempts: 0,
        globalTime: 0,
    });
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

    // ─── Session ───
    const startSession = useCallback(() => {
        const g = G.current;
        Object.assign(g, {
            sess: SESS.PLAYING, ri: 0, results: [], consecutiveWrong: 0,
            lastChance: false, highestRound: 0, totalCorrect: 0, totalWrong: 0, totalAttempts: 0,
        });
        initRound(0);
    }, []);

    const initRound = useCallback((idx) => {
        const g = G.current;
        const cfg = ROUNDS_ARR[idx];
        Object.assign(g, {
            ri: idx, ph: PHASE.PREPARE, phaseElapsed: 0, freezeRemaining: 0,
            revealProgress: 0, allGuessed: false, ps: spawn(cfg),
        });
        console.log(`[DivideAttention] Round ${idx + 1}: ${cfg.name} | ${cfg.targets}t / ${cfg.particles}p | r:${cfg.radius}`);
    }, []);

    const evaluateRound = useCallback(() => {
        const g = G.current;
        const cfg = ROUNDS_ARR[g.ri];
        let ok = 0, bad = 0, miss = 0;
        g.ps.forEach((p) => {
            if (p.isTarget && p.selected) ok++;
            else if (!p.isTarget && p.selected) bad++;
            else if (p.isTarget && !p.selected) miss++;
        });
        const passed = bad === 0 && miss === 0;
        const result = { round: g.ri + 1, name: cfg.name, targets: cfg.targets, particles: cfg.particles, correct: ok, wrong: bad, missed: miss, passed };
        g.results.push(result);
        g.totalCorrect += ok; g.totalWrong += bad; g.totalAttempts++;
        if (g.ri + 1 > g.highestRound) g.highestRound = g.ri + 1;
        g.ph = PHASE.OVER; g.phaseElapsed = 0;
        console.log(`[DivideAttention] Round ${g.ri + 1} result:`, result);

        setTimeout(() => {
            if (g.sess !== SESS.PLAYING) return;
            if (passed) {
                g.consecutiveWrong = 0; g.lastChance = false;
                if (g.ri + 1 < NUM_ROUNDS) initRound(g.ri + 1);
                else endSession();
            } else {
                g.consecutiveWrong++;
                if (g.consecutiveWrong >= 2) endSession();
                else { g.lastChance = true; initRound(Math.max(0, g.ri - 1)); }
            }
        }, OVER_MS);
    }, []);

    const endSession = useCallback(() => {
        const g = G.current;
        g.sess = SESS.ENDED;
        console.log("[DivideAttention] Session complete:", {
            highestRound: g.highestRound, totalCorrect: g.totalCorrect,
            totalWrong: g.totalWrong, totalAttempts: g.totalAttempts, rounds: g.results,
        });
        setTimeout(() => { navigate("/"); }, 500);
    }, [navigate]);

    // ─── Game loop ───
    useEffect(() => {
        const loop = (t) => {
            const dt = prevTime.current ? Math.min(t - prevTime.current, 50) : 16.667;
            prevTime.current = t;
            const g = G.current; g.globalTime = t;

            if (g.sess === SESS.PLAYING) {
                const cfg = ROUNDS_ARR[g.ri];
                switch (g.ph) {
                    case PHASE.PREPARE:
                        g.phaseElapsed += dt;
                        physics(g.ps, dt, false);
                        if (g.phaseElapsed >= cfg.time.preparation) { g.ph = PHASE.REVEAL; g.phaseElapsed = 0; }
                        break;
                    case PHASE.REVEAL:
                        g.phaseElapsed += dt;
                        g.revealProgress = Math.min(1, g.phaseElapsed / REVEAL_MS);
                        g.ps.forEach((p) => { if (!p.isTarget) p.opacity = g.revealProgress; });
                        physics(g.ps, dt, true);
                        if (g.phaseElapsed >= REVEAL_MS) { g.ph = PHASE.START; g.phaseElapsed = 0; g.ps.forEach((p) => { p.opacity = 1; }); }
                        break;
                    case PHASE.START:
                        g.phaseElapsed += dt;
                        physics(g.ps, dt, true);
                        if (g.phaseElapsed >= cfg.time.game) {
                            g.ph = PHASE.FREEZE; g.phaseElapsed = 0; g.freezeRemaining = cfg.time.freeze;
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

            draw(t);
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [evaluateRound]);

    // ─── Render ───
    const draw = useCallback(() => {
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

        const { stim, glow, correct, error, distImgs } = a;

        g.ps.forEach((p) => {
            if (g.ph === PHASE.PREPARE && !p.isTarget) return;
            if (p.opacity <= 0) return;

            ctx.save();
            ctx.globalAlpha = p.opacity;

            const si = p.stimIdx;

            // ─── IMAGE SELECTION + DRAW ───
            // Priority: selected > hover > phase default
            // Glow/correct/error SVGs are drawn SCALED UP so inner stimulus matches normal size

            if (p.selected && (g.ph === PHASE.FREEZE || g.ph === PHASE.OVER)) {
                // SELECTED → correct or error SVG (scaled up)
                if (p.isTarget) {
                    const img = correct[si] || stim[si];
                    if (img === correct[si] && correct[si]) {
                        drawParticleImg(ctx, img, p, CORRECT_SCALE[si]);
                    } else if (img) {
                        drawParticleImg(ctx, img, p);
                    }
                } else {
                    const img = error[si] || stim[si];
                    if (img === error[si] && error[si]) {
                        drawParticleImg(ctx, img, p, ERROR_SCALE[si]);
                    } else if (img) {
                        drawParticleImg(ctx, img, p);
                    }
                }
            } else if (g.ph === PHASE.OVER && !p.isTarget && g.ri >= 3) {
                // OVER, unselected distractor in round 4+ → reveal distractor image
                const img = distImgs.length > 0 ? distImgs[p.distIdx % distImgs.length] : stim[si];
                if (img) drawParticleImg(ctx, img, p);
            } else if (g.ph === PHASE.PREPARE && p.isTarget) {
                // PREPARE → glow SVG (scaled up)
                const img = glow[si] || stim[si];
                if (img === glow[si] && glow[si]) {
                    drawParticleImg(ctx, img, p, GLOW_SCALE[si]);
                } else if (img) {
                    drawParticleImg(ctx, img, p);
                }
            } else if (g.ph === PHASE.FREEZE && p.hovered && !p.selected) {
                // FREEZE hover → glow SVG (scaled up)
                const img = glow[si] || stim[si];
                if (img === glow[si] && glow[si]) {
                    drawParticleImg(ctx, img, p, GLOW_SCALE[si]);
                } else if (img) {
                    drawParticleImg(ctx, img, p);
                }
            } else {
                // Default → normal stimulus
                const img = stim[si];
                if (img) {
                    drawParticleImg(ctx, img, p);
                } else {
                    // Fallback circle
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
        if (g.ph !== PHASE.FREEZE || g.allGuessed) return;
        const { x, y } = toCanvasXY(cx, cy);
        const cfg = ROUNDS_ARR[g.ri];
        for (let i = g.ps.length - 1; i >= 0; i--) {
            const p = g.ps[i];
            if (!p.selected && d2d({ x, y }, p) <= p.radius + 8) {
                p.selected = true;
                console.log(`[DivideAttention] Tap ${i}: ${p.isTarget ? "TARGET ✓" : "DISTRACTOR ✗"}`);
                if (g.ps.filter((pp) => pp.selected).length >= cfg.targets) g.allGuessed = true;
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

    // ─── JSX ───
    return (
        <div style={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000", overflow: "hidden" }}>
            <div style={{ position: "relative", width: CW, height: CH, maxWidth: "100vw", maxHeight: "100vh", flexShrink: 0 }}>
                <canvas
                    ref={cvRef} width={CW} height={CH}
                    style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
                    onClick={(e) => handleTap(e.clientX, e.clientY)}
                    onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
                    onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; handleTap(t.clientX, t.clientY); }}
                />
            </div>
        </div>
    );
}