/**
 * constants/audio.js — Single source of truth for all audio imports
 *
 * Every audio-related symbol in the app should be imported from here.
 *
 * Categories re-exported:
 *   - Audio key maps        (ERROR_AUDIO, INSTRUCTION_AUDIO, etc.)
 *   - Core utilities        (getAudioForCurrentLanguage, createLanguageAudioPlayer, clearAudioCache)
 *   - React hooks           (useKioskAudio, useBackgroundAudio)
 *   - Game sound engines    (sfx, SoundManager, perilousPathSfx, PerilousPathSoundManager)
 */

// ── Audio key maps ─────────────────────────────────────────────────────────────
export {
    ERROR_AUDIO,
    INSTRUCTION_AUDIO,
    Error_AUDIO,
    INSTRCUTION_AUDIO,
    Instruction_AUDIO,
    getErrorAudioKey,
    getInstructionAudioKey
} from "./audioConstants"

// ── Core utilities ─────────────────────────────────────────────────────────────
export {
    getAudioForCurrentLanguage,
    createLanguageAudioPlayer,
    clearAudioCache
} from "../utils/audioUtils"

// ── React hooks ────────────────────────────────────────────────────────────────
export { useKioskAudio } from "../hooks/useKioskAudio"
export { useBackgroundAudio } from "../hooks/useBackgroundAudio"

// ── Game sound engines ─────────────────────────────────────────────────────────
export { sfx, SoundManager, perilousPathSfx, PerilousPathSoundManager } from "../utils/soundManager"
