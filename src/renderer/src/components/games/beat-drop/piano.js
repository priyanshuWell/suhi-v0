/**
 * Beat Drop audio — soft piano background loop + per-key note playback.
 *
 * Public API:
 *   startBackgroundMusic({ volume })   → begin the calm piano loop
 *   pauseBackgroundMusic()             → pause during popups
 *   resumeBackgroundMusic()            → resume after popups
 *   stopBackgroundMusic()              → stop + rewind (on session end / unmount)
 *   setBackgroundVolume(v)
 *   playPianoNote(laneIndex, { volume }) → play a musical note for a white key (0..4)
 *
 * Notes on the per-key sound:
 * The 5 lanes are mapped to a C-major pentatonic scale (C, D, E, G, A).
 * A pentatonic scale has no dissonant intervals, so any single tap OR
 * simultaneous chord tap sounds musical.
 *
 * Currently synthesized with Web Audio (2 oscillators + gain envelope).
 * To swap in real piano samples later, replace the body of `playPianoNote`
 * with sample playback — the rest of the app doesn't need to change.
 */

import calmPiano from "../../../assets/beat-drop/audio/alex-morgan-calm-piano-541028.mp3"

// C4, D4, E4, G4, A4 — C-major pentatonic (Hz)
const LANE_FREQ = [261.63, 293.66, 329.63, 392.0, 440.0]

let audioCtx = null
let bgAudio = null

function ensureCtx() {
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return null
        audioCtx = new Ctx()
    }
    // Browsers keep the context suspended until a user gesture — resume on demand.
    if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {})
    }
    return audioCtx
}

/* -------------------- Background music -------------------- */

export function startBackgroundMusic({ volume = 0.35 } = {}) {
    if (!bgAudio) {
        bgAudio = new Audio(calmPiano)
        bgAudio.loop = true
    }
    bgAudio.volume = Math.max(0, Math.min(1, volume))
    bgAudio.play().catch(() => {})
}

export function pauseBackgroundMusic() {
    if (bgAudio) bgAudio.pause()
}

export function resumeBackgroundMusic() {
    if (bgAudio) bgAudio.play().catch(() => {})
}

export function stopBackgroundMusic() {
    if (bgAudio) {
        bgAudio.pause()
        bgAudio.currentTime = 0
    }
}

export function setBackgroundVolume(v) {
    if (bgAudio) bgAudio.volume = Math.max(0, Math.min(1, v))
}

/* -------------------- Per-key piano notes -------------------- */

/**
 * Play a piano-like note for a white-key lane (0..4).
 * Safe to call rapidly — every call spawns its own short-lived oscillators,
 * so overlapping taps / chords never cut each other off.
 */
export function playPianoNote(laneIndex, { volume = 0.35 } = {}) {
    const freq = LANE_FREQ[laneIndex]
    if (freq == null) return
    const ctx = ensureCtx()
    if (!ctx) return

    const now = ctx.currentTime
    const duration = 1.4

    // Master envelope — quick attack, exponential decay (piano-like).
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(volume, now + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    // Fundamental — triangle for a soft, warm body
    const osc1 = ctx.createOscillator()
    osc1.type = "triangle"
    osc1.frequency.setValueAtTime(freq, now)

    // Octave harmonic — sine, quieter, adds sparkle
    const osc2 = ctx.createOscillator()
    osc2.type = "sine"
    osc2.frequency.setValueAtTime(freq * 2, now)
    const osc2Gain = ctx.createGain()
    osc2Gain.gain.setValueAtTime(0.25, now)

    osc1.connect(gain)
    osc2.connect(osc2Gain)
    osc2Gain.connect(gain)
    gain.connect(ctx.destination)

    const stopAt = now + duration + 0.05
    osc1.start(now)
    osc2.start(now)
    osc1.stop(stopAt)
    osc2.stop(stopAt)
}