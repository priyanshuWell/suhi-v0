import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";

// ── Stimulus sets (3 sets, one per stimulus image)
import stimulus_1 from "../../../assets/games/stimulus_1.svg";
import stimulus_2 from "../../../assets/games/stimulus_2.svg";
import stimulus_3 from "../../../assets/games/stimulus_3.svg";

// ── Distractor sets (2 distractors)
import distractor_1 from "../../../assets/games/distractor_1.svg";
import distractor_2 from "../../../assets/games/distractor_2.svg";

// ── Feedback variants per stimulus
import stimulus_correct_1 from "../../../assets/games/stimulus_correct_1.svg";
import stimulus_correct_2 from "../../../assets/games/stimulus_correct_2.svg";
import stimulus_correct_3 from "../../../assets/games/stimulus_correct_3.svg";
import stimulus_glow_1    from "../../../assets/games/stimulus_glow_1.svg";
import stimulus_glow_2    from "../../../assets/games/stimulus_glow_2.svg";
import stimulus_glow_3    from "../../../assets/games/stimulus_glow_3.svg";
import stimulus_error_1   from "../../../assets/games/stimulus_error_1.svg";
import stimulus_error_2   from "../../../assets/games/stimulus_error_2.svg";
import stimulus_error_3   from "../../../assets/games/stimulus_error_3.svg";

import { ROUNDS } from "./rounds";
import {
    DivideAttentionTrialStart,
    DivideAttentionTrialComplete,
    DivideAttentionResponseBatch,
    DivideAttentionSessionComplete,
} from "../../../utils/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCORE = { CORRECT_HIT: 10, FALSE_ALARM: -5, SPEED_BONUS: 3 };
const ROUNDS_ARR = Object.values(ROUNDS);
const NUM_ROUNDS = ROUNDS_ARR.length;

const PHASE = { PREPARE: "PREPARE", REVEAL: "REVEAL", START: "START", FREEZE: "FREEZE", OVER: "OVER" };
const SESS  = { IDLE: "IDLE", PLAYING: "PLAYING", ENDED: "ENDED" };

const CW = 1014;
const CH = 1802;
const PAD = 24;

// HUD height reserved at top — particles spawn below this
const HUD_H = 110;
const ARENA = { l: PAD, t: HUD_H + PAD, r: CW - PAD, b: CH - PAD };

const REVEAL_MS = 1000;
const OVER_MS   = 1800;

// ── Stimulus index is now LOCKED to difficultyTier (1-based) so visual theme
//    changes as the player progresses.  Tier 1 → idx 0, tier 2 → idx 1, tier 3+ → idx 2.
const tierToStimIdx = (tier) => Math.min(tier - 1, 2);

const STIM_PATHS = [stimulus_1, stimulus_2, stimulus_3];
const DIST_PATHS = [distractor_1, distractor_2];

const GLOW_SCALE    = [394 / 194, 394 / 194, 394 / 194];
const CORRECT_SCALE = [374 / 194, 294 / 194, 294 / 194];
const ERROR_SCALE   = [294 / 194, 294 / 194, 294 / 194];

// Per-tier accent colours used in HUD + transition effects
const TIER_COLOURS = [
    { primary: "#3DB39E", glow: "rgba(61,179,158,0.55)",  name: "Teal"    },
    { primary: "#7B6EF6", glow: "rgba(123,110,246,0.55)", name: "Violet"  },
    { primary: "#F6A23E", glow: "rgba(246,162,62,0.55)",  name: "Amber"   },
    { primary: "#E05C8A", glow: "rgba(224,92,138,0.55)",  name: "Crimson" },
];
const tierColour = (tier) => TIER_COLOURS[Math.min(tier - 1, TIER_COLOURS.length - 1)];

const rnd        = (a, b) => Math.random() * (b - a) + a;
const d2d        = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp      = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeInOut  = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutExp = (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

// ─── Max possible score for a round (all targets hit, all with speed bonus) ──
function maxRoundScore(cfg) {
    return cfg.targets * (SCORE.CORRECT_HIT + SCORE.SPEED_BONUS);
}

// ─── Procedural Background ────────────────────────────────────────────────────

function buildBackground() {
    const oc  = new OffscreenCanvas(CW, CH);
    const ctx = oc.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, CW * 0.3, CH);
    bg.addColorStop(0,    "#04091a");
    bg.addColorStop(0.4,  "#060c1e");
    bg.addColorStop(0.75, "#080d1b");
    bg.addColorStop(1,    "#030609");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CW, CH);

    const nebulas = [
        { x: CW * 0.18, y: CH * 0.12, rx: 420, ry: 260, rot: -0.3, h: 220, s: 70, a: 0.10 },
        { x: CW * 0.82, y: CH * 0.28, rx: 360, ry: 220, rot:  0.2, h: 200, s: 65, a: 0.08 },
        { x: CW * 0.35, y: CH * 0.55, rx: 480, ry: 290, rot:  0.5, h: 195, s: 60, a: 0.07 },
        { x: CW * 0.72, y: CH * 0.70, rx: 320, ry: 200, rot: -0.4, h: 215, s: 72, a: 0.09 },
        { x: CW * 0.15, y: CH * 0.86, rx: 280, ry: 170, rot:  0.1, h: 180, s: 55, a: 0.06 },
        { x: CW * 0.60, y: CH * 0.42, rx: 240, ry: 150, rot: -0.6, h: 230, s: 80, a: 0.07 },
    ];
    for (const n of nebulas) {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0,   `hsla(${n.h},${n.s}%,35%,${n.a})`);
        g.addColorStop(0.5, `hsla(${n.h},${n.s}%,25%,${n.a * 0.5})`);
        g.addColorStop(1,   "transparent");
        ctx.save();
        ctx.translate(n.x, n.y); ctx.rotate(n.rot); ctx.scale(n.rx, n.ry);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    let seed = 0xdeadbeef;
    const lcg = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
    for (let i = 0; i < 560; i++) {
        const x = lcg() * CW, y = lcg() * CH;
        const size = lcg() < 0.85 ? lcg() * 1.3 + 0.3 : lcg() * 2.4 + 1.4;
        const temp = lcg();
        const hue = temp < 0.6 ? 210 + temp * 30 : 35 + temp * 25;
        const sat = temp < 0.6 ? 38 : 18;
        const lit = 82 + lcg() * 18, alp = 0.38 + lcg() * 0.62;
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},${sat}%,${lit}%,${alp})`; ctx.fill();
        if (size > 2.4) {
            const fa = alp * 0.28, len = size * 3.2;
            ctx.strokeStyle = `hsla(${hue},${sat}%,96%,${fa})`; ctx.lineWidth = 0.55;
            ctx.beginPath(); ctx.moveTo(x - len, y); ctx.lineTo(x + len, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, y - len); ctx.lineTo(x, y + len); ctx.stroke();
        }
    }

    const vig = ctx.createRadialGradient(CW / 2, CH / 2, CH * 0.28, CW / 2, CH / 2, CH * 0.88);
    vig.addColorStop(0, "transparent"); vig.addColorStop(1, "rgba(0,0,0,0.58)");
    ctx.fillStyle = vig; ctx.fillRect(0, 0, CW, CH);

    return oc;
}

// ─── Asset Loading ────────────────────────────────────────────────────────────

async function loadImage(src) {
    return new Promise((ok, no) => {
        const i = new Image(); i.crossOrigin = "anonymous";
        i.onload = () => ok(i); i.onerror = no; i.src = src;
    });
}
async function loadSvg(path) {
    try { const r = await fetch(path); const t = await r.text(); return await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(t)); }
    catch { return null; }
}

// ─── Spawn ────────────────────────────────────────────────────────────────────

function spawn(cfg) {
    const ps  = [];
    const gap = cfg.radius * 2 + 12;
    // stimIdx is now FIXED by difficultyTier — not random
    const si  = tierToStimIdx(cfg.difficultyTier ?? 1);

    for (let i = 0; i < cfg.particles; i++) {
        const isTgt = i < cfg.targets;
        let x, y, ok, n = 0;
        do {
            x = rnd(ARENA.l + cfg.radius + 4, ARENA.r - cfg.radius - 4);
            y = rnd(ARENA.t + cfg.radius + 4, ARENA.b - cfg.radius - 4);
            ok = ps.every((p) => d2d({ x, y }, p) >= gap);
        } while (!ok && ++n < 800);

        const angle = rnd(0, Math.PI * 2);
        const speed = rnd(cfg.velocity.min, cfg.velocity.max);
        ps.push({
            x, y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            baseVx: Math.cos(angle) * speed, baseVy: Math.sin(angle) * speed,
            radius: cfg.radius,
            isTarget: isTgt, selected: false, hovered: false,
            opacity: isTgt ? 1 : 0,
            stimIdx: si,
            distIdx: Math.floor(Math.random() * 2),
            tapX: null, tapY: null, responseTimeMs: null,
            pulsePhase: rnd(0, Math.PI * 2),
            hitAnim: 0, hitAnimStart: null,
            trail: [],
        });
    }
    for (let i = ps.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ps[i], ps[j]] = [ps[j], ps[i]]; }
    return ps;
}

// ─── Physics ──────────────────────────────────────────────────────────────────

function physics(ps, dt, moving) {
    const step = dt / 16.667;
    if (moving) {
        for (const p of ps) {
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > 7) p.trail.shift();
            p.x += p.vx * step; p.y += p.vy * step;
        }
    }
    for (const p of ps) {
        if (p.x - p.radius < ARENA.l) { p.x = ARENA.l + p.radius; p.vx =  Math.abs(p.vx); p.baseVx =  Math.abs(p.baseVx); }
        if (p.x + p.radius > ARENA.r) { p.x = ARENA.r - p.radius; p.vx = -Math.abs(p.vx); p.baseVx = -Math.abs(p.baseVx); }
        if (p.y - p.radius < ARENA.t) { p.y = ARENA.t + p.radius; p.vy =  Math.abs(p.vy); p.baseVy =  Math.abs(p.baseVy); }
        if (p.y + p.radius > ARENA.b) { p.y = ARENA.b - p.radius; p.vy = -Math.abs(p.vy); p.baseVy = -Math.abs(p.baseVy); }
    }
    for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
            const a = ps[i], b = ps[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.hypot(dx, dy), minD = a.radius + b.radius;
            if (d < minD && d > 0.001) {
                const nx = dx / d, ny = dy / d, ov = (minD - d) * 0.5;
                a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
                if (moving) {
                    const dvx = a.vx - b.vx, dvy = a.vy - b.vy, dot = dvx * nx + dvy * ny;
                    if (dot > 0) {
                        a.vx -= dot * nx; a.vy -= dot * ny; b.vx += dot * nx; b.vy += dot * ny;
                        a.baseVx = a.vx; a.baseVy = a.vy; b.baseVx = b.vx; b.baseVy = b.vy;
                    }
                }
            }
        }
    }
}

function applyVelocityRamp(ps, progress) {
    const scale = easeInOut(progress);
    for (const p of ps) { p.vx = p.baseVx * scale; p.vy = p.baseVy * scale; }
}

// ─── Draw Helpers ─────────────────────────────────────────────────────────────

function drawParticleImg(ctx, img, p, scale = 1) {
    const sz = p.radius * 2 * scale, off = p.radius * (scale - 1);
    ctx.drawImage(img, p.x - p.radius - off, p.y - p.radius - off, sz, sz);
}

function drawTrail(ctx, p, tintColor) {
    if (p.trail.length < 2) return;
    for (let i = 1; i < p.trail.length; i++) {
        const t = i / p.trail.length;
        const a = p.trail[i - 1], b = p.trail[i];
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = tintColor
            ? tintColor.replace(")", `,${t * 0.22})`)
            : (p.isTarget ? `rgba(61,179,158,${t * 0.24})` : `rgba(180,160,255,${t * 0.15})`);
        ctx.lineWidth = p.radius * 0.24 * t; ctx.lineCap = "round"; ctx.stroke();
    }
}

function drawCountdownRing(ctx, p, remainingMs, fullMs) {
    const progress = Math.max(0, remainingMs / fullMs);
    const r = p.radius + 11, startA = -Math.PI / 2, endA = startA + Math.PI * 2 * progress;
    const hue = Math.round(progress * 120);
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.09)"; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, r, startA, endA);
    ctx.strokeStyle = `hsla(${hue},85%,62%,0.88)`; ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.stroke();
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
// Drawn every frame at the very top of the canvas (y 0 → HUD_H).
// Shows: round progress dots | live score / max score | tier label

function drawHUD(ctx, g, api, cfg) {
    const W = CW, H = HUD_H;
    const tc = tierColour(cfg.difficultyTier ?? 1);

    // Background panel — dark translucent bar
    ctx.save();
    ctx.fillStyle = "rgba(4,9,26,0.82)";
    ctx.fillRect(0, 0, W, H);

    // Bottom border glow line in tier colour
    ctx.strokeStyle = tc.glow;
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.stroke();

    // ── Round progress dots ────────────────────────────────────────────────
    const dotR   = 10;
    const dotGap = 14;
    const totalW = NUM_ROUNDS * (dotR * 2) + (NUM_ROUNDS - 1) * dotGap;
    const startX = (W - totalW) / 2;
    const dotY   = 28;

    for (let i = 0; i < NUM_ROUNDS; i++) {
        const cx = startX + i * (dotR * 2 + dotGap) + dotR;
        const isCurrent = i === g.ri;
        const isDone    = i < g.ri;

        ctx.beginPath(); ctx.arc(cx, dotY, dotR, 0, Math.PI * 2);
        if (isDone) {
            ctx.fillStyle = tc.primary; ctx.fill();
        } else if (isCurrent) {
            ctx.fillStyle = tc.primary; ctx.fill();
            // outer pulse ring
            const pulse = 1 + 0.35 * Math.sin(g.globalTime * 0.004);
            ctx.beginPath(); ctx.arc(cx, dotY, dotR * pulse + 4, 0, Math.PI * 2);
            ctx.strokeStyle = tc.glow; ctx.lineWidth = 2; ctx.stroke();
        } else {
            ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1.5; ctx.stroke();
        }

        // tick mark inside completed dots
        if (isDone) {
            ctx.strokeStyle = "#04091a"; ctx.lineWidth = 2; ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(cx - 5, dotY); ctx.lineTo(cx - 1, dotY + 4); ctx.lineTo(cx + 5, dotY - 4);
            ctx.stroke();
        }
    }

    // Connector line behind dots
    ctx.save();
    const lineY = dotY;
    ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(startX, lineY); ctx.lineTo(startX + totalW, lineY); ctx.stroke();
    ctx.restore();

    // ── Score display ──────────────────────────────────────────────────────
    const totalScore = api.totalScore;
    const maxPossible = ROUNDS_ARR.slice(0, g.ri + 1).reduce((s, r) => s + maxRoundScore(r), 0);

    // Left: "SCORE"
    ctx.font = "500 24px 'Arial', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.40)";
    ctx.textAlign = "left";
    ctx.fillText("SCORE", 36, 80);

    // Score number — big
    ctx.font = `bold 44px 'Arial Black', Arial, sans-serif`;
    ctx.fillStyle = tc.primary;
    ctx.textAlign = "left";
    ctx.fillText(totalScore, 36, 100);

    // Right: "/ max"
    const maxLabel = `/ ${maxPossible}`;
    ctx.font = "500 26px Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.textAlign = "left";
    const scoreWidth = ctx.measureText(String(totalScore)).width + 10;
    // recompute with bold font width
    ctx.font = `bold 44px 'Arial Black', Arial, sans-serif`;
    const sw = ctx.measureText(String(totalScore)).width;
    ctx.font = "500 26px Arial, sans-serif";
    ctx.fillText(maxLabel, 36 + sw + 6, 100);

    // Right side: tier label + round label
    ctx.textAlign = "right";
    ctx.font = "bold 28px Arial, sans-serif";
    ctx.fillStyle = tc.primary;
    ctx.fillText(`Round ${g.ri + 1}`, W - 36, 75);

    ctx.font = "500 22px Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText(cfg.name || "", W - 36, 100);

    ctx.restore();
}

// ─── Transition Effects ───────────────────────────────────────────────────────
// Both effects run during OVER phase (duration ≈ OVER_MS).
// They are driven by trans.t (0→1 over OVER_MS ms).
//
// REWIND (fail) — horizontal glitch strips sweep right→left in red
// FORWARD (pass) — radial tunnel zoom + star streaks in tier colour

function initTransitionRewind(trans) {
    // Pre-generate randomised strip data once
    trans.type     = "rewind";
    trans.t        = 0;
    trans.duration = OVER_MS;
    trans.strips   = Array.from({ length: 28 }, (_, i) => ({
        y:      (CH / 28) * i,
        h:      CH / 28 + 1,
        offset: rnd(20, 120) * (Math.random() < 0.5 ? 1 : -1),
        delay:  Math.random() * 0.3,
        speed:  rnd(0.6, 1.4),
    }));
    // Star-streak lines for rewind (backward)
    trans.streaks  = Array.from({ length: 40 }, () => ({
        x:    rnd(0, CW), y: rnd(0, CH),
        len:  rnd(60, 220), delay: Math.random() * 0.4,
    }));
}

function initTransitionForward(trans, tier) {
    trans.type     = "forward";
    trans.t        = 0;
    trans.duration = OVER_MS;
    trans.tier     = tier;
    // Star streaks radiating from centre
    trans.streaks  = Array.from({ length: 55 }, () => {
        const angle = rnd(0, Math.PI * 2);
        return {
            angle,
            startR: rnd(40, 160),
            len:    rnd(80, 340),
            delay:  Math.random() * 0.35,
            width:  rnd(0.8, 2.5),
        };
    });
}

function drawTransition(ctx, trans, bgCanvas) {
    if (!trans || trans.t <= 0) return;
    const t = clamp(trans.t, 0, 1);

    if (trans.type === "rewind") {
        // Flash overlay
        const flashAlpha = t < 0.15 ? (t / 0.15) * 0.45 : t > 0.7 ? ((1 - t) / 0.3) * 0.20 : 0.20;
        ctx.save();
        ctx.fillStyle = `rgba(220,30,30,${flashAlpha})`;
        ctx.fillRect(0, 0, CW, CH);

        // Horizontal glitch strips — copy from bg and offset
        if (bgCanvas) {
            for (const s of trans.strips) {
                const localT = clamp((t - s.delay) / (1 - s.delay), 0, 1) * s.speed;
                if (localT <= 0) continue;
                const offset = -s.offset * easeInOut(localT); // slide left
                ctx.save();
                ctx.globalAlpha = 0.55 * (1 - localT * 0.6);
                ctx.drawImage(bgCanvas, 0, s.y, CW, s.h, offset, s.y, CW, s.h);
                ctx.restore();
            }
        }

        // Backward streak lines (white/red, going left)
        for (const s of trans.streaks) {
            const lt = clamp((t - s.delay) * 2.2, 0, 1);
            if (lt <= 0) continue;
            const x = s.x - lt * s.len * 2.5;
            ctx.save();
            ctx.globalAlpha = (1 - lt) * 0.6;
            ctx.strokeStyle = lt < 0.5 ? "#ffffff" : "#ff6060";
            ctx.lineWidth   = rnd(0.5, 2);
            ctx.beginPath(); ctx.moveTo(x + s.len, s.y); ctx.lineTo(x, s.y); ctx.stroke();
            ctx.restore();
        }

        // "REWINDING" label
        const labelAlpha = t < 0.2 ? t / 0.2 : t > 0.75 ? (1 - t) / 0.25 : 1;
        ctx.save();
        ctx.globalAlpha = labelAlpha;
        ctx.font        = `bold 64px 'Arial Black', Arial, sans-serif`;
        ctx.textAlign   = "center";
        ctx.fillStyle   = "rgba(0,0,0,0.5)";
        ctx.fillText("←", CW / 2 + 3, CH / 2 + 3);
        ctx.fillStyle = "#ff6060";
        ctx.fillText("←", CW / 2, CH / 2);
        ctx.restore();

        ctx.restore();
    }

    if (trans.type === "forward") {
        const tc = tierColour(trans.tier ?? 1);
        const cx = CW / 2, cy = CH / 2;

        // Radial zoom tunnel — expanding ring blasts
        ctx.save();
        for (let ring = 0; ring < 5; ring++) {
            const rt = clamp(t * 1.6 - ring * 0.12, 0, 1);
            if (rt <= 0) continue;
            const r = rt * CH * 0.85;
            const alpha = (1 - rt) * 0.28;
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = tc.primary + Math.round(alpha * 255).toString(16).padStart(2, "0");
            ctx.lineWidth   = (1 - rt) * 18;
            ctx.stroke();
        }
        ctx.restore();

        // Forward star streaks (radiate outward from centre)
        for (const s of trans.streaks) {
            const lt = clamp((t - s.delay) * 1.8, 0, 1);
            if (lt <= 0) continue;
            const ease  = easeOutExp(lt);
            const sx    = cx + Math.cos(s.angle) * (s.startR + ease * s.len * 0.2);
            const ex    = cx + Math.cos(s.angle) * (s.startR + ease * s.len);
            const sy    = cy + Math.sin(s.angle) * (s.startR + ease * s.len * 0.2);
            const ey    = cy + Math.sin(s.angle) * (s.startR + ease * s.len);
            ctx.save();
            ctx.globalAlpha = (1 - lt) * 0.75;
            ctx.strokeStyle = lt < 0.4 ? "#ffffff" : tc.primary;
            ctx.lineWidth   = s.width;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.restore();
        }

        // Flash
        const flashAlpha = t < 0.12 ? (t / 0.12) * 0.55 : t > 0.55 ? ((1 - t) / 0.45) * 0.18 : 0.18;
        ctx.save();
        ctx.fillStyle = tc.primary + Math.round(flashAlpha * 255).toString(16).padStart(2, "0");
        ctx.fillRect(0, 0, CW, CH);
        ctx.restore();

        // "ADVANCING" label
        const labelAlpha = t < 0.18 ? t / 0.18 : t > 0.72 ? (1 - t) / 0.28 : 1;
        ctx.save();
        ctx.globalAlpha = labelAlpha;
        ctx.font        = `bold 64px 'Arial Black', Arial, sans-serif`;
        ctx.textAlign   = "center";
        ctx.fillStyle   = "rgba(0,0,0,0.5)";
        ctx.fillText("→", CW / 2 + 3, CH / 2 + 3);
        ctx.fillStyle   = tc.primary;
        ctx.fillText("→", CW / 2, CH / 2);
        ctx.restore();
    }
}

// ─── Bursts ───────────────────────────────────────────────────────────────────

function spawnBurst(pool, x, y, isCorrect, tierPrimary) {
    const count  = isCorrect ? 16 : 9;
    const colors = isCorrect
        ? [tierPrimary, "#ffffff", tierPrimary + "aa", "#aaffee"]
        : ["#FF5252", "#FF8A80", "#ffcc00", "#ff6e6e"];
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + rnd(-0.25, 0.25);
        const speed = rnd(isCorrect ? 5 : 2.5, isCorrect ? 11 : 6);
        pool.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.0, decay: rnd(0.025, 0.06), radius: rnd(3, isCorrect ? 7 : 5), color: colors[Math.floor(Math.random() * colors.length)] });
    }
    pool.push({ ring: true, x, y, r: 0, maxR: isCorrect ? 90 : 60, life: 1, decay: 0.055, color: isCorrect ? tierPrimary : "#FF5252" });
}

function updateAndDrawBursts(ctx, pool, dt) {
    const step = dt / 16.667;
    for (let i = pool.length - 1; i >= 0; i--) {
        const b = pool[i];
        b.life -= b.decay * step;
        if (b.life <= 0) { pool.splice(i, 1); continue; }
        if (b.ring) {
            b.r += (b.maxR - b.r) * 0.18 * step;
            ctx.save(); ctx.globalAlpha = b.life * 0.72;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.strokeStyle = b.color; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore(); continue;
        }
        b.x += b.vx * step; b.y += b.vy * step; b.vy += 0.22 * step;
        ctx.save(); ctx.globalAlpha = b.life;
        ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * b.life, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
}

// ─── Score Popups ─────────────────────────────────────────────────────────────

function spawnPopup(pool, x, y, points, tierPrimary) {
    pool.push({ x, y, label: points > 0 ? `+${points}` : `${points}`, color: points > 0 ? (tierPrimary || "#7FFFD4") : "#FF5252", life: 1.0, vy: -2.5 });
}

function updateAndDrawPopups(ctx, pool, dt) {
    const step = dt / 16.667;
    ctx.textAlign = "center";
    for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i];
        p.life -= 0.020 * step;
        if (p.life <= 0) { pool.splice(i, 1); continue; }
        p.y += p.vy * step;
        ctx.save(); ctx.globalAlpha = easeOutExp(p.life);
        ctx.font = `bold 52px 'Arial Black', Arial, sans-serif`;
        ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillText(p.label, p.x + 2.5, p.y + 2.5);
        ctx.fillStyle = p.color;             ctx.fillText(p.label, p.x, p.y);
        ctx.restore();
    }
}

// ─── Screenshake ──────────────────────────────────────────────────────────────

function tickShake(shake, dt) {
    if (shake.remaining <= 0) return;
    shake.remaining = Math.max(0, shake.remaining - dt / 16.667);
    const t = shake.remaining / shake.total;
    shake.x = (Math.random() * 2 - 1) * shake.intensity * t;
    shake.y = (Math.random() * 2 - 1) * shake.intensity * t;
}

// ─── Count-in overlay ─────────────────────────────────────────────────────────

function drawCountIn(ctx, ci, tier) {
    if (!ci.active) return;
    const t     = Math.min(1, ci.elapsed / ci.duration);
    const alpha = t < 0.15 ? t / 0.15 : t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
    const scale = 0.62 + 0.48 * easeInOut(Math.min(1, t * 2.4));
    const label = `Round ${ci.roundIdx + 1}`;
    const tc    = tierColour(tier ?? 1);

    ctx.save();
    ctx.translate(CW / 2, CH / 2);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    const fSize = 100;
    ctx.font = `900 ${fSize}px 'Arial Black', Arial, sans-serif`;
    ctx.textAlign = "center";
    const tw = ctx.measureText(label).width, ph = fSize * 1.38, pw = tw + 76;

    ctx.fillStyle = "rgba(4,9,26,0.90)";
    ctx.beginPath(); ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 24); ctx.fill();
    ctx.strokeStyle = tc.glow.replace("0.55", "0.7");
    ctx.lineWidth   = 2.5; ctx.stroke();

    ctx.fillStyle = "#e8fff8";
    ctx.fillText(label, 0, fSize * 0.37);
    ctx.restore();
}

// ─── Build Responses ──────────────────────────────────────────────────────────

function buildResponses(ps, freezeDurationMs) {
    const speedThresholdMs = freezeDurationMs * 0.5;
    let roundScore = 0;
    const responses = [];
    ps.forEach((p, idx) => {
        if (!p.selected) return;
        if (p.isTarget) {
            const hasSpeedBonus = p.responseTimeMs !== null && p.responseTimeMs < speedThresholdMs;
            const points = SCORE.CORRECT_HIT + (hasSpeedBonus ? SCORE.SPEED_BONUS : 0);
            roundScore += points;
            responses.push({ object_index: idx, object_type: "target", response_time_ms: p.responseTimeMs ?? 0, tap_x: p.tapX ?? 0, tap_y: p.tapY ?? 0, response_type: "correct_hit", is_correct: true, points_awarded: points, speed_bonus: hasSpeedBonus });
        } else {
            roundScore += SCORE.FALSE_ALARM;
            responses.push({ object_index: idx, object_type: "distractor", response_time_ms: p.responseTimeMs ?? 0, tap_x: p.tapX ?? 0, tap_y: p.tapY ?? 0, response_type: "false_alarm", is_correct: false, points_awarded: SCORE.FALSE_ALARM, speed_bonus: false });
        }
    });
    return { responses, roundScore };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SpaceConvoy() {
    const navigate  = useNavigate();
    const location  = useLocation();
    const sessionId = location.state?.sessionId ?? null;

    const cvRef  = useRef(null);
    const bgRef  = useRef(null);
    const assets = useRef({ stim: [], glow: [], correct: [], error: [], distImgs: [], loaded: false });
    const apiState = useRef({ trialId: null, trialNumber: 0, totalScore: 0 });

    const juice = useRef({
        bursts: [], popups: [],
        shake:  { x: 0, y: 0, remaining: 0, total: 0, intensity: 0 },
        countIn:    { active: false, elapsed: 0, duration: 900, roundIdx: 0 },
        transition: null,   // { type, t, duration, ...effect data }
    });

    const G = useRef({
        sess: SESS.IDLE, ph: PHASE.PREPARE, ri: 0, ps: [],
        phaseElapsed: 0, freezeRemaining: 0, freezeStartTime: 0,
        revealProgress: 0, allGuessed: false, failState: "none",
        results: [], highestRound: 0, totalCorrect: 0, totalWrong: 0, totalAttempts: 0,
        globalTime: 0,
    });

    const rafRef   = useRef(null);
    const prevTime = useRef(0);

    // Build procedural background once
    useEffect(() => { bgRef.current = buildBackground(); }, []);

    // Load assets then start
    useEffect(() => {
        (async () => {
            const stim     = await Promise.all(STIM_PATHS.map(loadSvg));
            const glow     = await Promise.all([stimulus_glow_1, stimulus_glow_2, stimulus_glow_3].map(loadSvg));
            const correct  = await Promise.all([stimulus_correct_1, stimulus_correct_2, stimulus_correct_3].map(loadSvg));
            const error    = await Promise.all([stimulus_error_1, stimulus_error_2, stimulus_error_3].map(loadSvg));
            const distImgs = (await Promise.all(DIST_PATHS.map(loadSvg))).filter(Boolean);
            assets.current = { stim, glow, correct, error, distImgs, loaded: true };
            startSession();
        })();
    }, []);

    const startSession = useCallback(() => {
        const g = G.current, api = apiState.current;
        Object.assign(g, { sess: SESS.PLAYING, ri: 0, results: [], failState: "none", highestRound: 0, totalCorrect: 0, totalWrong: 0, totalAttempts: 0 });
        api.trialNumber = 0; api.totalScore = 0;
        initRound(0);
    }, []);

    const initRound = useCallback(async (idx) => {
        const g = G.current, api = apiState.current, cfg = ROUNDS_ARR[idx];
        Object.assign(g, { ri: idx, ph: PHASE.PREPARE, phaseElapsed: 0, freezeRemaining: 0, freezeStartTime: 0, revealProgress: 0, allGuessed: false, ps: spawn(cfg) });
        juice.current.countIn = { active: true, elapsed: 0, duration: 900, roundIdx: idx };
        api.trialNumber += 1;
        if (sessionId) {
            const res = await DivideAttentionTrialStart({ session_id: sessionId, trial_number: api.trialNumber, trial_type: "main", num_targets: cfg.targets, num_distractors: cfg.particles - cfg.targets, total_objects: cfg.particles, tracking_duration_ms: cfg.time.freeze });
            api.trialId = res.success ? (res.data?.trial_id ?? res.data?.id ?? null) : null;
        }
    }, [sessionId]);

    const evaluateRound = useCallback(async () => {
        const g = G.current, api = apiState.current, cfg = ROUNDS_ARR[g.ri];
        let ok = 0, bad = 0, miss = 0;
        g.ps.forEach((p) => { if (p.isTarget && p.selected) ok++; else if (!p.isTarget && p.selected) bad++; else if (p.isTarget && !p.selected) miss++; });
        const passed = bad === 0 && miss === 0;
        const { responses, roundScore } = buildResponses(g.ps, cfg.time.freeze);
        api.totalScore += roundScore;
        g.results.push({ round: g.ri + 1, name: cfg.name, targets: cfg.targets, particles: cfg.particles, correct: ok, wrong: bad, missed: miss, passed, score: roundScore });
        g.totalCorrect += ok; g.totalWrong += bad; g.totalAttempts++;
        if (g.ri + 1 > g.highestRound) g.highestRound = g.ri + 1;
        g.ph = PHASE.OVER; g.phaseElapsed = 0;

        // ── Fire transition effect ────────────────────────────────────────────
        if (passed) {
            initTransitionForward(juice.current.transition = {}, cfg.difficultyTier ?? 1);
        } else {
            initTransitionRewind(juice.current.transition = {});
        }

        if (api.trialId) {
            await DivideAttentionResponseBatch({ trial_id: api.trialId, responses });
            await DivideAttentionTrialComplete(api.trialId);
        }

        setTimeout(() => {
            if (g.sess !== SESS.PLAYING) return;
            juice.current.transition = null;

            if (passed) {
                g.failState = g.failState === "goback" ? "final" : "none";
                g.ri + 1 < NUM_ROUNDS ? initRound(g.ri + 1) : endSession();
            } else {
                switch (g.failState) {
                    case "none":  g.failState = "retry";  initRound(g.ri); break;
                    case "retry": g.ri > 0 ? (g.failState = "goback", initRound(g.ri - 1)) : endSession(); break;
                    default:      endSession(); break;
                }
            }
        }, OVER_MS);
    }, []);

    const endSession = useCallback(async () => {
        G.current.sess = SESS.ENDED;
        if (sessionId) await DivideAttentionSessionComplete(sessionId);
        setTimeout(() => navigate("/space-convoy-complete"), 500);
    }, [navigate]);

    // ─── Game Loop ────────────────────────────────────────────────────────────
    useEffect(() => {
        const loop = (t) => {
            const dt = prevTime.current ? Math.min(t - prevTime.current, 50) : 16.667;
            prevTime.current = t;
            const g = G.current, jc = juice.current;
            if (!assets.current.loaded) { rafRef.current = requestAnimationFrame(loop); return; }
            g.globalTime = t;

            tickShake(jc.shake, dt);

            if (jc.countIn.active) {
                jc.countIn.elapsed += dt;
                if (jc.countIn.elapsed >= jc.countIn.duration) jc.countIn.active = false;
            }

            // Advance transition t
            if (jc.transition) {
                jc.transition.t = Math.min(1, jc.transition.t + dt / jc.transition.duration);
            }

            if (g.sess === SESS.PLAYING) {
                const cfg = ROUNDS_ARR[g.ri];
                switch (g.ph) {
                    case PHASE.PREPARE:
                        g.phaseElapsed += dt; physics(g.ps, dt, false);
                        if (g.phaseElapsed >= cfg.time.preparation) { g.ph = PHASE.REVEAL; g.phaseElapsed = 0; }
                        break;
                    case PHASE.REVEAL:
                        g.phaseElapsed += dt;
                        g.revealProgress = Math.min(1, g.phaseElapsed / REVEAL_MS);
                        g.ps.forEach((p) => { if (!p.isTarget) p.opacity = g.revealProgress; });
                        applyVelocityRamp(g.ps, g.revealProgress);
                        physics(g.ps, dt, true);
                        if (g.phaseElapsed >= REVEAL_MS) { g.ph = PHASE.START; g.phaseElapsed = 0; g.ps.forEach((p) => { p.opacity = 1; }); }
                        break;
                    case PHASE.START:
                        g.phaseElapsed += dt; physics(g.ps, dt, true);
                        if (g.phaseElapsed >= cfg.time.game) {
                            g.ph = PHASE.FREEZE; g.phaseElapsed = 0;
                            g.freezeRemaining = cfg.time.freeze; g.freezeStartTime = performance.now();
                            g.ps.forEach((p) => { p.vx = 0; p.vy = 0; p.trail = []; });
                        }
                        break;
                    case PHASE.FREEZE:
                        g.freezeRemaining -= dt;
                        g.ps.forEach((p) => { if (p.hitAnimStart !== null) p.hitAnim = Math.min(1, (performance.now() - p.hitAnimStart) / 300); });
                        physics(g.ps, dt, false);
                        if (g.freezeRemaining <= 0 || g.allGuessed) evaluateRound();
                        break;
                }
            }
            draw(dt);
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [evaluateRound]);

    // ─── Draw ─────────────────────────────────────────────────────────────────
    const draw = useCallback((dt = 16.667) => {
        const cv = cvRef.current;
        if (!cv || !assets.current.loaded) return;
        const ctx = cv.getContext("2d");
        const g = G.current, jc = juice.current, a = assets.current;
        const cfg = ROUNDS_ARR[g.ri];
        const tc  = tierColour(cfg.difficultyTier ?? 1);

        ctx.clearRect(0, 0, CW, CH);
        ctx.save();
        ctx.translate(jc.shake.x, jc.shake.y);

        // ── Background ────────────────────────────────────────────────────
        if (bgRef.current) ctx.drawImage(bgRef.current, 0, 0, CW, CH);
        else { ctx.fillStyle = "#04091a"; ctx.fillRect(0, 0, CW, CH); }

        // Urgency red tint in last 38% of freeze
        if (g.ph === PHASE.FREEZE) {
            const urgency = 1 - Math.max(0, g.freezeRemaining / cfg.time.freeze);
            if (urgency > 0.62) {
                ctx.fillStyle = `rgba(220,55,35,${(urgency - 0.62) / 0.38 * 0.065})`;
                ctx.fillRect(0, 0, CW, CH);
            }
        }

        const { stim, glow, correct, error, distImgs } = a;

        // ── Motion trails ─────────────────────────────────────────────────
        if (g.ph === PHASE.START || g.ph === PHASE.REVEAL) {
            g.ps.forEach((p) => { if (p.opacity > 0) drawTrail(ctx, p, p.isTarget ? null : "rgba(180,160,255,"); });
        }

        // ── Particles ──────────────────────────────────────────────────────
        g.ps.forEach((p) => {
            if (g.ph === PHASE.PREPARE && !p.isTarget) return;
            if (p.opacity <= 0) return;
            ctx.save();
            ctx.globalAlpha = p.opacity;
            const si = p.stimIdx;

            if (p.selected && (g.ph === PHASE.FREEZE || g.ph === PHASE.OVER)) {
                if (p.isTarget) {
                    const img    = correct[si] || stim[si];
                    const bounce = p.hitAnim < 1 ? 1 + 0.18 * Math.sin(p.hitAnim * Math.PI) : 1;
                    if (img) drawParticleImg(ctx, img, p, (img === correct[si] ? CORRECT_SCALE[si] : 1) * bounce);
                } else {
                    const img = error[si] || stim[si];
                    if (img) drawParticleImg(ctx, img, p, img === error[si] ? ERROR_SCALE[si] : 1);
                }
            } else if (g.ph === PHASE.PREPARE && p.isTarget) {
                const pulse = 1 + 0.055 * Math.sin(g.globalTime * 0.003 + p.pulsePhase);
                const img   = glow[si] || stim[si];
                if (img) drawParticleImg(ctx, img, p, (img === glow[si] ? GLOW_SCALE[si] : 1) * pulse);
            } else if (g.ph === PHASE.FREEZE && p.hovered && !p.selected) {
                const img = glow[si] || stim[si];
                if (img) drawParticleImg(ctx, img, p, img === glow[si] ? GLOW_SCALE[si] : 1);
            } else {
                const img = p.isTarget ? stim[si] : (distImgs[p.distIdx] || stim[si]);
                if (img) drawParticleImg(ctx, img, p);
                else { ctx.beginPath(); ctx.arc(p.x, p.y, p.radius - 1, 0, Math.PI * 2); ctx.fillStyle = p.isTarget ? tc.primary : "#F4B459"; ctx.fill(); }
            }
            ctx.restore();

            if (g.ph === PHASE.FREEZE && !p.selected)
                drawCountdownRing(ctx, p, g.freezeRemaining, cfg.time.freeze);
        });

        // ── Bursts & Popups ────────────────────────────────────────────────
        updateAndDrawBursts(ctx, jc.bursts, dt);
        updateAndDrawPopups(ctx, jc.popups, dt);

        // ── Transition overlay (above particles, below HUD) ────────────────
        if (jc.transition && jc.transition.t > 0) {
            drawTransition(ctx, jc.transition, bgRef.current);
        }

        // ── HUD (always on top) ────────────────────────────────────────────
        drawHUD(ctx, g, apiState.current, cfg);

        // ── Count-in (above HUD) ───────────────────────────────────────────
        drawCountIn(ctx, jc.countIn, cfg.difficultyTier ?? 1);

        ctx.restore(); // end screenshake
    }, []);

    // ─── Input ────────────────────────────────────────────────────────────────
    const toCanvasXY = useCallback((cx, cy) => {
        const rect = cvRef.current.getBoundingClientRect();
        return { x: (cx - rect.left) * (CW / rect.width), y: (cy - rect.top) * (CH / rect.height) };
    }, []);

    const handleTap = useCallback((cx, cy) => {
        const g = G.current, jc = juice.current;
        const cfg = ROUNDS_ARR[g.ri];
        const tc  = tierColour(cfg.difficultyTier ?? 1);
        if (g.ph !== PHASE.FREEZE || g.allGuessed) return;
        const { x, y } = toCanvasXY(cx, cy);
        const responseTimeMs = performance.now() - g.freezeStartTime;
        for (let i = g.ps.length - 1; i >= 0; i--) {
            const p = g.ps[i];
            if (!p.selected && d2d({ x, y }, p) <= p.radius + 8) {
                p.selected = true; p.tapX = Math.round(x); p.tapY = Math.round(y);
                p.responseTimeMs = Math.round(responseTimeMs); p.hitAnimStart = performance.now(); p.hitAnim = 0;
                spawnBurst(jc.bursts, p.x, p.y, p.isTarget, tc.primary);
                const hasSpeedBonus = p.responseTimeMs < cfg.time.freeze * 0.5;
                spawnPopup(jc.popups, p.x, p.y - p.radius - 12, p.isTarget ? SCORE.CORRECT_HIT + (hasSpeedBonus ? SCORE.SPEED_BONUS : 0) : SCORE.FALSE_ALARM, tc.primary);
                if (!p.isTarget) jc.shake = { x: 0, y: 0, remaining: 14, total: 14, intensity: 20 };
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

    return (
        <div style={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000", overflow: "hidden" }}>
            <canvas
                ref={cvRef} width={CW} height={CH}
                style={{ display: "block", touchAction: "none", maxWidth: "100vw", maxHeight: "100vh", width: "auto", height: "100vh", objectFit: "contain" }}
                onClick={(e) => handleTap(e.clientX, e.clientY)}
                onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
                onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; handleTap(t.clientX, t.clientY); }}
            />
        </div>
    );
}