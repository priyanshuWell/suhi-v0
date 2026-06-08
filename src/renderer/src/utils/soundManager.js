/**
 * SoundManager.js — SpaceConvoy Audio Engine
 *
 * SOUND MAPPING:
 *  submit           → mixkit-video-game-treasure-2066.wav  (submit button)
 *  particle_tap     → laserSmall_000.ogg  (SAME sound for correct hit + false alarm)
 *  collision        → laserSmall_001.ogg  (particles hitting each other)
 *  round_start      → forceField_000.ogg
 *  freeze           → forceField_003.ogg
 *  speed_bonus      → laserRetro_001.ogg
 *  burst            → explosionCrunch_000.ogg
 *  level_up         → laserLarge_002.ogg
 *  session_complete → laserLarge_004.ogg
 *  hover            → computerNoise_000.ogg
 *  ambient_loop     → spaceEngineLarge_000.ogg
 */

// import roundStartSfx      from "../assets/sounds/forceField_000.ogg";
import freezeSfx          from "../assets/audio/space_convoy/space_convoy_freeze.wav";
import particleTapSfx     from "../assets/audio/space_convoy/laserSmall_000.wav";   // correct hit + false alarm — same sound
// import collisionSfx       from "../assets/audio/space_convoy/laserSmall_001.ogg";   // particle-to-particle collision
// import speedBonusSfx      from "../assets/sounds/laserRetro_001.ogg";
import submitSfx          from "../assets/audio/space_convoy/Submit_Button_Tap.wav";
// import burstSfx           from "../assets/sounds/explosionCrunch_000.ogg";
// import levelUpSfx         from "../assets/sounds/laserLarge_002.ogg";
// import sessionCompleteSfx from "../assets/sounds/laserLarge_004.ogg";
// import hoverSfx           from "../assets/sounds/computerNoise_000.ogg";
import ambientLoopSfx     from "../assets/audio/space_convoy/game_background.wav";

const SOUND_FILES = {
    // round_start:      roundStartSfx,
    freeze:           freezeSfx,
    particle_tap:     particleTapSfx,
    // collision:        collisionSfx,
    // speed_bonus:      speedBonusSfx,
    submit:           submitSfx,
    // burst:            burstSfx,
    // level_up:         levelUpSfx,
    // session_complete: sessionCompleteSfx,
    // hover:            hoverSfx,
    // ambient_loop:     ambientLoopSfx,
};

const SOUND_VOLUMES = {
    round_start:      0.55,
    freeze:           0.70,
    particle_tap:     0.55,   // same volume for hit and false alarm
    collision:        0.25,   // quiet — fires many times per second, don't overpower
    speed_bonus:      0.50,
    submit:           0.80,
    burst:            0.45,
    level_up:         0.75,
    session_complete: 0.80,
    hover:            0.15,
    ambient_loop:     60
};

// ─── Synth Fallbacks ──────────────────────────────────────────────────────────

function envelope(gainNode, ctx, { attack = 0.01, sustain = 1, release = 0.15, peak = 1 } = {}) {
    const t = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(peak, t + attack);
    gainNode.gain.setValueAtTime(peak * sustain, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
}
function playNoise(ctx, mg, { duration = 0.12, freq = 800, q = 1.5, volume = 0.4, type = "bandpass" } = {}) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const gain = ctx.createGain();
    envelope(gain, ctx, { attack: 0.005, sustain: 0.8, release: duration * 0.7, peak: volume });
    src.connect(filter); filter.connect(gain); gain.connect(mg);
    src.start(ctx.currentTime); src.stop(ctx.currentTime + duration + 0.05);
}
function playTone(ctx, mg, { freq = 440, type = "sine", duration = 0.2, volume = 0.3, attack = 0.01, release = 0.15 } = {}) {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    envelope(gain, ctx, { attack, sustain: 1, release, peak: volume });
    osc.connect(gain); gain.connect(mg);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + attack + release + 0.05);
}
function playSweep(ctx, mg, { startFreq = 200, endFreq = 600, type = "sine", duration = 0.3, volume = 0.3, curve = "exp" } = {}) {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    if (curve === "exp") osc.frequency.exponentialRampToValueAtTime(Math.max(0.01, endFreq), ctx.currentTime + duration);
    else osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration);
    envelope(gain, ctx, { attack: 0.01, sustain: 0.9, release: duration * 0.5, peak: volume });
    osc.connect(gain); gain.connect(mg);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration + 0.1);
}

// ─── SoundManager ─────────────────────────────────────────────────────────────

export class SoundManager {
    constructor() {
        this._ctx               = null;
        this._master            = null;
        this._buffers           = {};
        this._ambientSrc        = null;
        this._ambientGain       = null;
        this._synthAmbientNodes = null;
        this._muted             = false;
        this._volume            = 0.85;

        // Throttle for collision sound — prevent 60fps spam
        // Only one collision sound allowed every 80ms
        this._lastCollisionAt   = 0;
        this._collisionCooldown = 80;
    }

    // ── Setup ──────────────────────────────────────────────────────────────────

    unlock() {
        if (this._ctx) return;
        try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch { return; }
        this._master = this._ctx.createGain();
        this._master.gain.value = this._volume;
        this._master.connect(this._ctx.destination);
        if (this._ctx.state === "suspended") this._ctx.resume();
        this._preloadAll();
    }

    async _preloadAll() {
        await Promise.all(
            Object.entries(SOUND_FILES).map(async ([name, url]) => {
                if (!url) return;
                try {
                    const res = await fetch(url);
                    const ab  = await res.arrayBuffer();
                    this._buffers[name] = await this._ctx.decodeAudioData(ab);
                } catch (e) {
                    console.warn(`[SoundManager] "${name}" failed to load, using synth fallback.`, e);
                }
            })
        );
    }

    _play(name) {
        const buf = this._buffers[name];
        if (!buf || !this._ctx) return false;
        const gainNode = this._ctx.createGain();
        gainNode.gain.value = SOUND_VOLUMES[name] ?? 0.6;
        gainNode.connect(this._master);
        const src = this._ctx.createBufferSource();
        src.buffer = buf;
        src.connect(gainNode);
        src.start(this._ctx.currentTime);
        return true;
    }

    get _ready() { return !!this._ctx && !this._muted; }

    setVolume(v) { this._volume = Math.max(0, Math.min(1, v)); if (this._master) this._master.gain.value = this._volume; }
    mute()       { this._muted = true;  if (this._master) this._master.gain.value = 0; }
    unmute()     { this._muted = false; if (this._master) this._master.gain.value = this._volume; }

    // ── Game Sounds ────────────────────────────────────────────────────────────

    roundStart() {
        if (!this._ready) return;
        if (this._play("round_start")) return;
        playTone(this._ctx, this._master, { freq: 523, type: "sine", duration: 0.18, volume: 0.28, attack: 0.01, release: 0.18 });
        setTimeout(() => playTone(this._ctx, this._master, { freq: 784, type: "sine", duration: 0.22, volume: 0.32 }), 120);
    }

    freeze() {
        if (!this._ready) return;
        if (this._play("freeze")) return;
        playSweep(this._ctx, this._master, { startFreq: 180, endFreq: 55, type: "triangle", duration: 0.22, volume: 0.45 });
        playNoise(this._ctx, this._master, { duration: 0.08, freq: 200, q: 0.8, volume: 0.25, type: "lowpass" });
    }

    /**
     * particleTap — called for BOTH correct hit and false alarm.
     * Same sound, no distinction. Clean and simple.
     */
    particleTap() {
        if (!this._ready) return;
        if (this._play("particle_tap")) return;
        playSweep(this._ctx, this._master, { startFreq: 440, endFreq: 660, type: "sine", duration: 0.1, volume: 0.35, curve: "exp" });
    }

    speedBonus() {
        if (!this._ready) return;
        if (this._play("speed_bonus")) return;
        [1047, 1319, 1568].forEach((freq, i) => setTimeout(() =>
            playTone(this._ctx, this._master, { freq, type: "sine", duration: 0.1, volume: 0.18 }), i * 50));
    }

    /**
     * collision — particles hitting each other during START phase.
     * Throttled to max once per 80ms so it doesn't become noise.
     */
    collision() {
        if (!this._ready) return;
        const now = performance.now();
        if (now - this._lastCollisionAt < this._collisionCooldown) return; // throttle
        this._lastCollisionAt = now;
        if (this._play("collision")) return;
        playNoise(this._ctx, this._master, { duration: 0.06, freq: 700, q: 2, volume: 0.18, type: "bandpass" });
    }

    /**
     * submit — mixkit treasure sound on submit button tap.
     */
    submitTap() {
        if (!this._ready) return;
        if (this._play("submit")) return;
        playNoise(this._ctx, this._master, { duration: 0.04, freq: 1200, q: 3, volume: 0.3, type: "highpass" });
        setTimeout(() => playTone(this._ctx, this._master, { freq: 880, type: "sine", duration: 0.25, volume: 0.35 }), 30);
    }

    burst() {
        if (!this._ready) return;
        if (this._play("burst")) return;
        playNoise(this._ctx, this._master, { duration: 0.09, freq: 900, q: 2, volume: 0.22, type: "bandpass" });
    }

    levelUp() {
        if (!this._ready) return;
        if (this._play("level_up")) return;
        playSweep(this._ctx, this._master, { startFreq: 180, endFreq: 1200, type: "sawtooth", duration: 0.35, volume: 0.3, curve: "exp" });
        [523, 659, 784, 1047].forEach((freq, i) => setTimeout(() =>
            playTone(this._ctx, this._master, { freq, type: "sine", duration: 0.22, volume: 0.25 }), i * 65));
    }

    sessionComplete() {
        if (!this._ready) return;
        if (this._play("session_complete")) return;
        [{ freq: 523, delay: 0 }, { freq: 659, delay: 80 }, { freq: 784, delay: 160 }, { freq: 1047, delay: 260 }, { freq: 1319, delay: 380 }]
            .forEach(({ freq, delay }) => setTimeout(() =>
                playTone(this._ctx, this._master, { freq, type: "sine", duration: 0.5, volume: 0.28 }), delay));
    }

    hover() {
        if (!this._ready) return;
        if (this._play("hover")) return;
        playTone(this._ctx, this._master, { freq: 1800, type: "sine", duration: 0.05, volume: 0.06 });
    }

    // ── Ambient ────────────────────────────────────────────────────────────────

    startAmbient() {
        if (!this._ready) return;
        if (this._buffers["ambient_loop"]) {
            const gainNode = this._ctx.createGain();
            gainNode.gain.setValueAtTime(0, this._ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(SOUND_VOLUMES.ambient_loop, this._ctx.currentTime + 3);
            gainNode.connect(this._master);
            const src = this._ctx.createBufferSource();
            src.buffer = this._buffers["ambient_loop"];
            src.loop = true;
            src.connect(gainNode);
            src.start(this._ctx.currentTime);
            this._ambientSrc = src; this._ambientGain = gainNode;
            return;
        }
        // Synth fallback
        if (this._synthAmbientNodes) return;
        const ctx = this._ctx;
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2.5);
        gainNode.connect(this._master);
        const osc1 = ctx.createOscillator(); osc1.type = "sine"; osc1.frequency.value = 55;
        const osc2 = ctx.createOscillator(); osc2.type = "sine"; osc2.frequency.value = 57.5;
        const lfo  = ctx.createOscillator(); lfo.frequency.value = 0.08;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.025;
        lfo.connect(lfoGain); lfoGain.connect(gainNode.gain);
        [osc1, osc2].forEach(o => { o.connect(gainNode); o.start(ctx.currentTime); });
        lfo.start(ctx.currentTime);
        this._synthAmbientNodes = { osc1, osc2, lfo, gainNode };
    }

    stopAmbient() {
        const ctx = this._ctx; if (!ctx) return;
        if (this._ambientGain) {
            this._ambientGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
            setTimeout(() => { try { this._ambientSrc?.stop(); } catch {} this._ambientSrc = null; this._ambientGain = null; }, 1600);
        }
        if (this._synthAmbientNodes) {
            const { osc1, osc2, lfo, gainNode } = this._synthAmbientNodes;
            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
            setTimeout(() => { [osc1, osc2, lfo].forEach(o => { try { o.stop(); } catch {} }); this._synthAmbientNodes = null; }, 1600);
        }
    }

    duckAmbient(level = 0.02, durationMs = 1200) {
        const gainNode = this._ambientGain || this._synthAmbientNodes?.gainNode;
        if (!gainNode || !this._ctx) return;
        gainNode.gain.linearRampToValueAtTime(level, this._ctx.currentTime + 0.1);
        setTimeout(() => gainNode.gain.linearRampToValueAtTime(SOUND_VOLUMES.ambient_loop, this._ctx.currentTime + 0.8), durationMs);
    }
}

export const sfx = new SoundManager();