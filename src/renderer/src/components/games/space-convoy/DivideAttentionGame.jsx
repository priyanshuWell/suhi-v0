import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { sfx } from "../../../utils/soundManager";
import gameBgMusic from "../../../assets/audio/space_convoy/game_background.wav";
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
import stimulus_glow_1 from "../../../assets/games/stimulus_glow_1.svg";
import stimulus_glow_2 from "../../../assets/games/stimulus_glow_2.svg";
import stimulus_glow_3 from "../../../assets/games/stimulus_glow_3.svg";
import stimulus_error_1 from "../../../assets/games/stimulus_error_1.svg";
import stimulus_error_2 from "../../../assets/games/stimulus_error_2.svg";
import stimulus_error_3 from "../../../assets/games/stimulus_error_3.svg";

import { ROUNDS } from "./rounds";
import {
    DivideAttentionSession,         // called ONCE — creates session, returns active session_id
    DivideAttentionTrialStart,      // called PER ROUND — gets trial_id for that round
    DivideAttentionTrialComplete,
    DivideAttentionResponseBatch,
    DivideAttentionSessionComplete,
} from "../../../utils/api";
import { useSelector, useDispatch } from "react-redux";
import { setScreening } from "../../../features/common/commonSlice";
import { getNextRoute } from "../../../utils/stageRouter";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCORE = { CORRECT_HIT: 10, CORRECT_REJECTION: 5, MISS: -5, FALSE_ALARM: -5, SPEED_BONUS: 3 };
const ROUNDS_ARR = Object.values(ROUNDS);
const NUM_ROUNDS = ROUNDS_ARR.length;

const PHASE = { PREPARE: "PREPARE", REVEAL: "REVEAL", START: "START", FREEZE: "FREEZE", OVER: "OVER" };
const SESS = { IDLE: "IDLE", PLAYING: "PLAYING", ENDED: "ENDED" };

const CW = 1014;
const CH = 1802;
const PAD = 24;

const HUD_H = 130;

const SUBMIT_BTN = { w: 420, h: 100, r: 20, bottomPad: 60 };

const ARENA = { l: PAD, t: HUD_H + PAD, r: CW - PAD, b: CH - PAD - SUBMIT_BTN.h - SUBMIT_BTN.bottomPad - 20 };

const REVEAL_MS = 1000;
const OVER_MS = 1800;
const tierToStimIdx = (tier) => Math.min(tier - 1, 2);

const STIM_PATHS = [stimulus_1, stimulus_2, stimulus_3];
const DIST_PATHS = [distractor_1, distractor_2];

const GLOW_SCALE = [394 / 194, 394 / 194, 394 / 194];

const TIER_COLOURS = [
    { primary: "#3DB39E", glow: "rgba(61,179,158,0.55)", name: "Teal" },
    { primary: "#7B6EF6", glow: "rgba(123,110,246,0.55)", name: "Violet" },
    { primary: "#F6A23E", glow: "rgba(246,162,62,0.55)", name: "Amber" },
    { primary: "#E05C8A", glow: "rgba(224,92,138,0.55)", name: "Crimson" },
];
const tierColour = (tier) => TIER_COLOURS[Math.min(tier - 1, TIER_COLOURS.length - 1)];

const rnd = (a, b) => Math.random() * (b - a) + a;
const d2d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutExp = (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

function maxRoundScore(cfg) {
    return cfg.targets * (SCORE.CORRECT_HIT + SCORE.SPEED_BONUS);
}

// ─── Procedural Background ────────────────────────────────────────────────────

function buildBackground() {
    const oc = new OffscreenCanvas(CW, CH);
    const ctx = oc.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, CW * 0.3, CH);
    bg.addColorStop(0, "#04091a");
    bg.addColorStop(0.4, "#060c1e");
    bg.addColorStop(0.75, "#080d1b");
    bg.addColorStop(1, "#030609");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CW, CH);

    const nebulas = [
        { x: CW * 0.18, y: CH * 0.12, rx: 420, ry: 260, rot: -0.3, h: 220, s: 70, a: 0.10 },
        { x: CW * 0.82, y: CH * 0.28, rx: 360, ry: 220, rot: 0.2, h: 200, s: 65, a: 0.08 },
        { x: CW * 0.35, y: CH * 0.55, rx: 480, ry: 290, rot: 0.5, h: 195, s: 60, a: 0.07 },
        { x: CW * 0.72, y: CH * 0.70, rx: 320, ry: 200, rot: -0.4, h: 215, s: 72, a: 0.09 },
        { x: CW * 0.15, y: CH * 0.86, rx: 280, ry: 170, rot: 0.1, h: 180, s: 55, a: 0.06 },
        { x: CW * 0.60, y: CH * 0.42, rx: 240, ry: 150, rot: -0.6, h: 230, s: 80, a: 0.07 },
    ];
    for (const n of nebulas) {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, `hsla(${n.h},${n.s}%,35%,${n.a})`);
        g.addColorStop(0.5, `hsla(${n.h},${n.s}%,25%,${n.a * 0.5})`);
        g.addColorStop(1, "transparent");
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


function spawn(cfg) {
    const ps = [];
    const gap = cfg.radius * 2 + 12;
    const si = tierToStimIdx(cfg.difficultyTier ?? 1);

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
    for (let i = ps.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[ps[i], ps[j]] = [ps[j], ps[i]]; }
    return ps;
}

// ─── Physics ──────────────────────────────────────────────────────────────────

function physics(ps, dt, moving, onCollision = null) {
    const step = dt / 16.667;
    if (moving) {
        for (const p of ps) {
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > 7) p.trail.shift();
            p.x += p.vx * step; p.y += p.vy * step;
        }
    }
    for (const p of ps) {
        if (p.x - p.radius < ARENA.l) { p.x = ARENA.l + p.radius; p.vx = Math.abs(p.vx); p.baseVx = Math.abs(p.baseVx); }
        if (p.x + p.radius > ARENA.r) { p.x = ARENA.r - p.radius; p.vx = -Math.abs(p.vx); p.baseVx = -Math.abs(p.baseVx); }
        if (p.y - p.radius < ARENA.t) { p.y = ARENA.t + p.radius; p.vy = Math.abs(p.vy); p.baseVy = Math.abs(p.baseVy); }
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
                if (moving && onCollision) {
                    onCollision();
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

// ─── Submit Button (drawn on canvas) ─────────────────────────────────────────

function drawSubmitButton(ctx, g, cfg, globalTime) {
    const tc = tierColour(cfg.difficultyTier ?? 1);
    const bw = SUBMIT_BTN.w, bh = SUBMIT_BTN.h, br = SUBMIT_BTN.r;
    const bx = (CW - bw) / 2;
    const by = CH - SUBMIT_BTN.bottomPad - bh;

    ctx.save();
    ctx.fillStyle = "rgba(4,9,26,0.88)";
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, br); ctx.fill();

    const pulse = 0.55 + 0.45 * Math.sin(globalTime * 0.004);
    ctx.strokeStyle = tc.primary + Math.round(pulse * 200).toString(16).padStart(2, "0");
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, br); ctx.stroke();

    const anySelected = g.ps.some(p => p.selected);
    ctx.font = `bold 44px 'Arial Black', Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = anySelected ? "#ffffff" : "rgba(255,255,255,0.35)";
    ctx.fillText("Submit", CW / 2, by + bh * 0.62);

    if (!anySelected) {
        ctx.font = "400 26px Arial, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillText("Tap the targets first", CW / 2, by + bh * 0.85);
    }

    ctx.restore();
}

// ─── Transition Effects ───────────────────────────────────────────────────────

function initTransitionForward(trans, tier) {
    trans.type = "forward";
    trans.t = 0;
    trans.duration = OVER_MS;
    trans.tier = tier;
    trans.streaks = Array.from({ length: 55 }, () => {
        const angle = rnd(0, Math.PI * 2);
        return { angle, startR: rnd(40, 160), len: rnd(80, 340), delay: Math.random() * 0.35, width: rnd(0.8, 2.5) };
    });
}

function drawTransition(ctx, trans, bgCanvas) {
    if (!trans || trans.t <= 0) return;
    const t = clamp(trans.t, 0, 1);

    if (trans.type === "forward") {
        const tc = tierColour(trans.tier ?? 1);
        const cx = CW / 2, cy = CH / 2;

        ctx.save();
        for (let ring = 0; ring < 5; ring++) {
            const rt = clamp(t * 1.6 - ring * 0.12, 0, 1);
            if (rt <= 0) continue;
            const r = rt * CH * 0.85;
            const alpha = (1 - rt) * 0.28;
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = tc.primary + Math.round(alpha * 255).toString(16).padStart(2, "0");
            ctx.lineWidth = (1 - rt) * 18;
            ctx.stroke();
        }
        ctx.restore();

        for (const s of trans.streaks) {
            const lt = clamp((t - s.delay) * 1.8, 0, 1);
            if (lt <= 0) continue;
            const ease = easeOutExp(lt);
            const sx = cx + Math.cos(s.angle) * (s.startR + ease * s.len * 0.2);
            const ex = cx + Math.cos(s.angle) * (s.startR + ease * s.len);
            const sy = cy + Math.sin(s.angle) * (s.startR + ease * s.len * 0.2);
            const ey = cy + Math.sin(s.angle) * (s.startR + ease * s.len);
            ctx.save();
            ctx.globalAlpha = (1 - lt) * 0.75;
            ctx.strokeStyle = lt < 0.4 ? "#ffffff" : tc.primary;
            ctx.lineWidth = s.width;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.restore();
        }

        const flashAlpha = t < 0.12 ? (t / 0.12) * 0.55 : t > 0.55 ? ((1 - t) / 0.45) * 0.18 : 0.18;
        ctx.save();
        ctx.fillStyle = tc.primary + Math.round(flashAlpha * 255).toString(16).padStart(2, "0");
        ctx.fillRect(0, 0, CW, CH);
        ctx.restore();

        const labelAlpha = t < 0.18 ? t / 0.18 : t > 0.72 ? (1 - t) / 0.28 : 1;
        ctx.save();
        ctx.globalAlpha = labelAlpha;
        ctx.font = `bold 60px 'Arial Black', Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillText("LEVEL UP →", CW / 2 + 3, CH / 2 + 3);
        ctx.fillStyle = tc.primary;
        ctx.fillText("LEVEL UP →", CW / 2, CH / 2);
        ctx.restore();
    }
}

// ─── Bursts ───────────────────────────────────────────────────────────────────

function spawnBurst(pool, x, y, tierPrimary) {
    const count = 16;
    const colors = [tierPrimary, "#ffffff", tierPrimary + "aa", "#aaffee"];
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + rnd(-0.25, 0.25);
        const speed = rnd(5, 11);
        pool.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.0, decay: rnd(0.025, 0.06), radius: rnd(3, 7), color: colors[Math.floor(Math.random() * colors.length)] });
    }
    pool.push({ ring: true, x, y, r: 0, maxR: 90, life: 1, decay: 0.055, color: tierPrimary });
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
        ctx.fillStyle = p.color; ctx.fillText(p.label, p.x, p.y);
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
    const t = Math.min(1, ci.elapsed / ci.duration);
    const alpha = t < 0.15 ? t / 0.15 : t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
    const scale = 0.62 + 0.48 * easeInOut(Math.min(1, t * 2.4));
    const label = `Round ${ci.roundIdx + 1}`;
    const tc = tierColour(tier ?? 1);

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
    ctx.lineWidth = 2.5; ctx.stroke();

    ctx.fillStyle = "#e8fff8";
    ctx.fillText(label, 0, fSize * 0.37);
    ctx.restore();
}

// ─── Build Responses ──────────────────────────────────────────────────────────
// Scoring rubric:
//   Correct Hit  (H)  — target selected              → +10, +3 speed bonus if tap < 50% of window
//   Correct Rejection (CR) — distractor not selected → +5
//   Miss (M)     — target not selected               → −5
//   False Alarm  (FA) — distractor selected          → −5
//
// CHANGE: removed points_awarded and speed_bonus from response objects (new API spec)
// CHANGE: now returns hit/miss/falseAlarm/correctRejection counts directly

function buildResponses(ps, responseWindowMs) {
    const speedThresholdMs = responseWindowMs * 0.5;
    let roundScore = 0;
    const responses = [];

    // counters — used for TrialComplete payload
    let hits = 0, misses = 0, falseAlarms = 0, correctRejections = 0;

    ps.forEach((p, idx) => {
        if (p.selected) {
            if (p.isTarget) {
                // Correct Hit
                const hasSpeedBonus = p.responseTimeMs !== null && p.responseTimeMs < speedThresholdMs;
                const points = SCORE.CORRECT_HIT + (hasSpeedBonus ? SCORE.SPEED_BONUS : 0);
                roundScore += points;
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
                roundScore += SCORE.FALSE_ALARM;
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
                // Miss
                roundScore += SCORE.MISS;
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
                // Correct Rejection
                roundScore += SCORE.CORRECT_REJECTION;
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

    return { responses, roundScore, hits, misses, falseAlarms, correctRejections };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SpaceConvoy() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const location = useLocation();
    const sessionId = location.state?.sessionId ?? null;
    const sessionType = location.state?.sessionType ?? "main";
    const storeUser = useSelector((state) => state.common.user);  // "practice" | "main"
    const screeningSessionId = storeUser?.screening?.session_id;
    const userId = storeUser?.data?.user_id;
    // pull userId from redux
    //const userId = useSelector((state) => state.auth?.user?.id);

    const cvRef = useRef(null);
    const bgRef = useRef(null);
    const assets = useRef({ stim: [], glow: [], correct: [], error: [], distImgs: [], loaded: false });
    const apiState = useRef({ trialId: null, trialNumber: 0, totalScore: 0, activeSessionId: null });
    const juice = useRef({
        bursts: [], popups: [],
        shake: { x: 0, y: 0, remaining: 0, total: 0, intensity: 0 },
        countIn: { active: false, elapsed: 0, duration: 900, roundIdx: 0 },
        transition: null,
    });

    const G = useRef({
        sess: SESS.IDLE, ph: PHASE.PREPARE, ri: 0, ps: [],
        phaseElapsed: 0, freezeStartTime: 0,
        revealProgress: 0,
        submitted: false,
        results: [], highestRound: 0, totalCorrect: 0, totalWrong: 0, totalAttempts: 0,
        globalTime: 0,
    });

    const rafRef = useRef(null);
    const prevTime = useRef(0);
    const bgAudioRef = useRef(null);  // dedicated looping background music

    const [hud, setHud] = useState({ ri: 0, totalScore: 0, tierPrimary: TIER_COLOURS[0].primary, tierGlow: TIER_COLOURS[0].glow, roundName: "" });

    useEffect(() => { bgRef.current = buildBackground(); }, []);

    useEffect(() => {
        // Set up looping background music
        const audio = new Audio(gameBgMusic);
        audio.loop = true;
        audio.volume = 0.15;
        bgAudioRef.current = audio;

        (async () => {
            const stim = await Promise.all(STIM_PATHS.map(loadSvg));
            const glow = await Promise.all([stimulus_glow_1, stimulus_glow_2, stimulus_glow_3].map(loadSvg));
            const correct = await Promise.all([stimulus_correct_1, stimulus_correct_2, stimulus_correct_3].map(loadSvg));
            const error = await Promise.all([stimulus_error_1, stimulus_error_2, stimulus_error_3].map(loadSvg));
            assets.current = { stim, glow, correct, error, loaded: true };
            startSession();
        })();

        return () => {
            audio.pause();
            audio.src = "";
        };
    }, []);

    // Called once when the game starts.
    // DivideAttentionSession creates the main session and returns the active session_id.
    // All trial calls use activeSessionId, not the raw sessionId prop.
    const startSession = useCallback(async () => {
        const g = G.current, api = apiState.current;
        Object.assign(g, {
            sess: SESS.PLAYING, ri: 0, results: [],
            highestRound: 0, totalCorrect: 0, totalWrong: 0, totalAttempts: 0,
        });
        api.trialNumber = 0; api.totalScore = 0;

        const sessionRes = await DivideAttentionSession(userId, screeningSessionId, "main");
        if (sessionRes.success) {
            api.activeSessionId = sessionRes.data?.game_session_id ?? null;
            console.log("[SpaceConvoy] Main session created:", api.activeSessionId);
        } else {
            console.warn("[SpaceConvoy] Session creation failed — activeSessionId not set");
        }

        sfx.startAmbient();
        // Start background music
        if (bgAudioRef.current) {
            bgAudioRef.current.play().catch(() => {
                G.current._bgPending = true;
            });
        }
        initRound(0);
    }, [userId, screeningSessionId]);

    // Called per round. DivideAttentionTrialStart fires here to get a fresh trial_id.
    // No session_type here — that belongs to the session, not the trial.
    const initRound = useCallback(async (idx) => {
        const g = G.current, api = apiState.current, cfg = ROUNDS_ARR[idx];
        Object.assign(g, {
            ri: idx, ph: PHASE.PREPARE, phaseElapsed: 0,
            freezeStartTime: 0,
            revealProgress: 0,
            submitted: false,
            ps: spawn(cfg),
        });
        juice.current.countIn = { active: true, elapsed: 0, duration: 900, roundIdx: idx };
        sfx.roundStart();
        api.trialNumber += 1;

        const activeSessionId = api.activeSessionId;
        if (activeSessionId) {
            const res = await DivideAttentionTrialStart({
                session_id: activeSessionId,
                trial_number: api.trialNumber,
                num_targets: cfg.targets,
                num_distractors: cfg.particles - cfg.targets,
                total_objects: cfg.particles,
                trial_type: "main"
            });
            // store trial_id for this round — used in ResponseBatch and TrialComplete
            api.trialId = res.success ? (res.data?.trial_id ?? res.trial_id ?? null) : null;
        }
    }, [sessionId]);

    // CHANGE: evaluateRound now:
    //   1. Destructures hits/misses/falseAlarms/correctRejections from buildResponses
    //   2. tracking_duration_ms = time from freeze start to submit tap (responseWindowMs)
    //   3. Passes summary stats as body to DivideAttentionTrialComplete
    const evaluateRound = useCallback(async () => {
        const g = G.current, api = apiState.current, cfg = ROUNDS_ARR[g.ri];
        if (g.submitted) return;
        g.submitted = true;

        // tracking_duration_ms: time from when freeze started to when user tapped Submit
        const submitTime = performance.now();
        const responseWindowMs = submitTime - g.freezeStartTime;

        // buildResponses now returns counts alongside responses
        const { responses, roundScore, hits, misses, falseAlarms, correctRejections } =
            buildResponses(g.ps, responseWindowMs);

        api.totalScore += roundScore;
        g.results.push({
            round: g.ri + 1,
            name: cfg.name,
            targets: cfg.targets,
            particles: cfg.particles,
            correct: hits,
            wrong: falseAlarms,
            missed: misses,
            score: roundScore,
        });
        g.totalCorrect += hits;
        g.totalWrong += falseAlarms;
        g.totalAttempts++;
        if (g.ri + 1 > g.highestRound) g.highestRound = g.ri + 1;
        g.ph = PHASE.OVER; g.phaseElapsed = 0;

        initTransitionForward(juice.current.transition = {}, cfg.difficultyTier ?? 1);
        sfx.levelUp();
        sfx.duckAmbient();

        if (api.trialId) {
            // Step 1: send per-particle responses (points_awarded / speed_bonus removed)
            await DivideAttentionResponseBatch({ trial_id: api.trialId, responses });

            // Step 2: complete the trial with summary stats
            // tracking_duration_ms = freeze start → submit tap (no artificial time window)
            await DivideAttentionTrialComplete(api.trialId, {
                tracking_duration_ms: Math.round(responseWindowMs),
                hits,
                misses,
                false_alarms: falseAlarms,
                correct_rejections: correctRejections,
            });
        }

        setTimeout(() => {
            if (g.sess !== SESS.PLAYING) return;
            juice.current.transition = null;
            if (g.ri + 1 < NUM_ROUNDS) {
                initRound(g.ri + 1);
            } else {
                endSession();
            }
        }, OVER_MS);
    }, [initRound]);

    const endSession = useCallback(async () => {
        G.current.sess = SESS.ENDED;
        sfx.sessionComplete();
        sfx.stopAmbient();
        // Stop background music
        if (bgAudioRef.current) { bgAudioRef.current.pause(); bgAudioRef.current.currentTime = 0; }
        const activeSessionId = apiState.current.activeSessionId;
        let nextRoute; // fallback
        if (activeSessionId) {
            const completeResult = await DivideAttentionSessionComplete(activeSessionId);
            // Update Redux screening state with next_stage from API response
            // if (completeResult?.screening) {
            //     dispatch(setScreening(completeResult.screening));
            //     nextRoute = getNextRoute(completeResult.screening?.next_stage, '/colorblindness');
            // }
            nextRoute = getNextRoute(completeResult.screening?.next_stage, '/colorblindness');
            console.log('[DivideAttention] endSession — navigating to:', nextRoute);
        } else {
            console.warn('[DivideAttention] No activeSessionId — skipping SessionComplete');
        }
        setTimeout(() => navigate("/space-convoy-complete", {
            state: { results: G.current.results, totalScore: apiState.current.totalScore, nextRoute }
        }), 500);
    }, [navigate, dispatch]);

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
                        physics(g.ps, dt, true, () => sfx.collision());
                        if (g.phaseElapsed >= REVEAL_MS) { g.ph = PHASE.START; g.phaseElapsed = 0; g.ps.forEach((p) => { p.opacity = 1; }); }
                        break;
                    case PHASE.START:
                        g.phaseElapsed += dt; physics(g.ps, dt, true, () => sfx.collision());
                        if (g.phaseElapsed >= cfg.time.game) {
                            g.ph = PHASE.FREEZE; g.phaseElapsed = 0;
                            // freezeStartTime marks when tracking window begins
                            g.freezeStartTime = performance.now();
                            sfx.freeze();
                            g.ps.forEach((p) => { p.vx = 0; p.vy = 0; p.trail = []; });
                        }
                        break;
                    case PHASE.FREEZE:
                        g.ps.forEach((p) => { if (p.hitAnimStart !== null) p.hitAnim = Math.min(1, (performance.now() - p.hitAnimStart) / 300); });
                        physics(g.ps, dt, false);
                        break;
                }
            }
            draw(dt);

            const _cfg = ROUNDS_ARR[g.ri];
            const _tc = tierColour(_cfg.difficultyTier ?? 1);
            setHud({ ri: g.ri, totalScore: apiState.current.totalScore, tierPrimary: _tc.primary, tierGlow: _tc.glow, roundName: _cfg.name || "" });

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
        const tc = tierColour(cfg.difficultyTier ?? 1);

        ctx.clearRect(0, 0, CW, CH);
        ctx.save();
        ctx.translate(jc.shake.x, jc.shake.y);

        if (bgRef.current) ctx.drawImage(bgRef.current, 0, 0, CW, CH);
        else { ctx.fillStyle = "#04091a"; ctx.fillRect(0, 0, CW, CH); }

        const { stim, glow } = a;

        if (g.ph === PHASE.START || g.ph === PHASE.REVEAL) {
            g.ps.forEach((p) => { if (p.opacity > 0) drawTrail(ctx, p, p.isTarget ? null : "rgba(180,160,255,"); });
        }

        g.ps.forEach((p) => {
            if (g.ph === PHASE.PREPARE && !p.isTarget) return;
            if (p.opacity <= 0) return;
            ctx.save();
            ctx.globalAlpha = p.opacity;
            const si = p.stimIdx;

            if ((g.ph === PHASE.OVER || g.ph === PHASE.FREEZE) && p.selected) {
                const img = glow[si] || stim[si];
                if (img) drawParticleImg(ctx, img, p, img === glow[si] ? GLOW_SCALE[si] : 1);
            } else if (g.ph === PHASE.PREPARE && p.isTarget) {
                const pulse = 1 + 0.055 * Math.sin(g.globalTime * 0.003 + p.pulsePhase);
                const img = glow[si] || stim[si];
                if (img) drawParticleImg(ctx, img, p, (img === glow[si] ? GLOW_SCALE[si] : 1) * pulse);
            } else if (g.ph === PHASE.FREEZE && p.hovered && !p.selected) {
                const img = glow[si] || stim[si];
                if (img) drawParticleImg(ctx, img, p, img === glow[si] ? GLOW_SCALE[si] : 1);
            } else {
                const img = p.isTarget ? stim[si] : stim[si];
                if (img) drawParticleImg(ctx, img, p);
                else { ctx.beginPath(); ctx.arc(p.x, p.y, p.radius - 1, 0, Math.PI * 2); ctx.fillStyle = p.isTarget ? tc.primary : "#F4B459"; ctx.fill(); }
            }
            ctx.restore();
        });

        updateAndDrawBursts(ctx, jc.bursts, dt);
        updateAndDrawPopups(ctx, jc.popups, dt);

        if (jc.transition && jc.transition.t > 0) {
            drawTransition(ctx, jc.transition, bgRef.current);
        }

        drawCountIn(ctx, jc.countIn, cfg.difficultyTier ?? 1);

        if (g.ph === PHASE.FREEZE && !g.submitted) {
            drawSubmitButton(ctx, g, cfg, g.globalTime);
        }

        ctx.restore();
    }, []);

    // ─── Input ────────────────────────────────────────────────────────────────
    const toCanvasXY = useCallback((cx, cy) => {
        const rect = cvRef.current.getBoundingClientRect();
        return { x: (cx - rect.left) * (CW / rect.width), y: (cy - rect.top) * (CH / rect.height) };
    }, []);

    const isSubmitTap = useCallback((x, y) => {
        const bw = SUBMIT_BTN.w, bh = SUBMIT_BTN.h;
        const bx = (CW - bw) / 2;
        const by = CH - SUBMIT_BTN.bottomPad - bh;
        return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
    }, []);

    const handleTap = useCallback((cx, cy) => {
        sfx.unlock();
        // Resume background music on first tap if autoplay was blocked
        const g = G.current;
        if (g._bgPending && bgAudioRef.current) {
            bgAudioRef.current.play().catch(() => { });
            g._bgPending = false;
        }
        const cfg = ROUNDS_ARR[g.ri];
        if (g.ph !== PHASE.FREEZE || g.submitted) return;
        const { x, y } = toCanvasXY(cx, cy);

        if (isSubmitTap(x, y)) {
            sfx.submitTap();
            evaluateRound();
            return;
        }

        // response_time_ms = time from freeze start to this tap
        const responseTimeMs = performance.now() - g.freezeStartTime;
        for (let i = g.ps.length - 1; i >= 0; i--) {
            const p = g.ps[i];
            if (!p.selected && d2d({ x, y }, p) <= p.radius + 8) {
                p.selected = true; p.tapX = Math.round(x); p.tapY = Math.round(y);
                p.responseTimeMs = Math.round(responseTimeMs); p.hitAnimStart = performance.now(); p.hitAnim = 0;
                sfx.particleTap();
                if (p.isTarget) {
                    const speedThreshold = (performance.now() - g.freezeStartTime) * 0.5;
                    if (p.responseTimeMs < speedThreshold) sfx.speedBonus();
                    const tc = tierColour(cfg.difficultyTier ?? 1);
                    // spawnBurst(juice.current.bursts, p.x, p.y, tc.primary);
                    // spawnPopup(juice.current.popups, p.x, p.y - p.radius - 20, SCORE.CORRECT_HIT, tc.primary);
                } else {
                    sfx.falseAlarm();
                    spawnPopup(juice.current.popups, p.x, p.y - p.radius - 20, SCORE.FALSE_ALARM, null);
                }
                break;
            }
        }
    }, [toCanvasXY, isSubmitTap, evaluateRound]);

    const handleMove = useCallback((cx, cy) => {
        const g = G.current;
        if (g.ph !== PHASE.FREEZE) return;
        const { x, y } = toCanvasXY(cx, cy);
        let didHover = false;
        g.ps.forEach((p) => {
            const wasHovered = p.hovered;
            p.hovered = d2d({ x, y }, p) <= p.radius + 8;
            if (p.hovered && !wasHovered) didHover = true;
        });
        if (didHover) sfx.hover();
    }, [toCanvasXY]);

    return (
        <div style={{ position: "relative", width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000", overflow: "hidden" }}>
            <canvas
                ref={cvRef} width={CW} height={CH}
                style={{ display: "block", touchAction: "none", maxWidth: "100vw", maxHeight: "100vh", width: "auto", height: "100vh", objectFit: "contain" }}
                onClick={(e) => handleTap(e.clientX, e.clientY)}
                onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
                onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; handleTap(t.clientX, t.clientY); }}
            />

            {/* ── DOM HUD overlay ── */}
            <div style={{
                position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                width: "min(100vw, calc(100vh * (1014/1802)))",
                pointerEvents: "none",
            }}>
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 27px 12px",
                    background: "rgba(4,9,26,0.82)",
                }}>
                    {/* Left spacer — mirrors skip button width so dots stay centred */}
                    <div style={{ minWidth: 70 }} />

                    {/* Centre: round dots */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "clamp(6px,0.8vw,10px)" }}>
                            {ROUNDS_ARR.map((_, i) => {
                                const isDone = i < hud.ri;
                                const isCurrent = i === hud.ri;
                                const size = "clamp(10px,1.1vw,16px)";
                                return (
                                    <div key={i} style={{
                                        width: size, height: size, borderRadius: "50%",
                                        background: isDone || isCurrent ? hud.tierPrimary : "transparent",
                                        border: isDone || isCurrent ? "none" : "1.5px solid rgba(255,255,255,0.2)",
                                        boxShadow: isCurrent ? `0 0 0 3px ${hud.tierGlow}` : "none",
                                        transition: "background 0.3s, box-shadow 0.3s",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                    }}>
                                        {isDone && (
                                            <svg width="55%" height="55%" viewBox="0 0 10 10" fill="none">
                                                <polyline points="1.5,5 4,7.5 8.5,2" stroke="rgba(4,9,26,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Skip button */}
                    <button
                        id="space-convoy-skip-btn"
                        onClick={endSession}
                        style={{
                            pointerEvents: "auto",
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "6px 14px",
                            background: "rgba(255,255,255,0.07)",
                            border: "1.5px solid rgba(255,255,255,0.18)",
                            borderRadius: 20,
                            color: "rgba(255,255,255,0.70)",
                            fontSize: "clamp(11px,1.1vw,14px)",
                            fontFamily: "'Arial', sans-serif",
                            fontWeight: 500,
                            letterSpacing: "0.04em",
                            cursor: "pointer",
                            transition: "background 0.2s, border-color 0.2s, color 0.2s",
                            minWidth: 70,
                            justifyContent: "center",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.14)";
                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.38)";
                            e.currentTarget.style.color = "#fff";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
                            e.currentTarget.style.color = "rgba(255,255,255,0.70)";
                        }}
                    >
                        Skip
                        {/* forward chevron */}
                        <svg width="11" height="11" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2 }}>
                            <polyline points="3,1.5 7.5,5 3,8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}