import i18n from "i18next"

/**
 * audioUtils.js — Language-aware audio loader
 *
 * Folder convention:
 *   assets/audio/{lang}/instructions/{name}.mp3  ← screen instructions (existing)
 *   assets/audio/{lang}/errors/{name}.mp3         ← error/warning feedback (new)
 *
 * Pass baseName as:
 *   "instructions/camera_scan"     → assets/audio/{lang}/instructions/camera_scan.mp3
 *   "errors/face_not_detected"     → assets/audio/{lang}/errors/face_not_detected.mp3
 *   "camera_scan"                  → tries instructions/ first, then flat path (backward compat)
 */

const audioCache = new Map()

const tryImport = async (path) => {
  try {
    const module = await import(/* @vite-ignore */ `../assets/audio/${path}.mp3`)
    return module.default ?? null
  } catch {
    return null
  }
}

const preloadAudio = async (baseName, langCode) => {
  const cacheKey = `${langCode}/${baseName}`
  if (audioCache.has(cacheKey)) return audioCache.get(cacheKey)

  let result = null

  // 1. Try the exact path as given (handles "instructions/x" and "errors/x" directly)
  result = await tryImport(`${langCode}/${baseName}`)

  // 2. If no subfolder prefix was given, try instructions/ subfolder (migration path)
  if (!result && !baseName.includes('/')) {
    result = await tryImport(`${langCode}/instructions/${baseName}`)
  }

  // 3. Fall back to the flat path (backward compat for callers not yet updated)
  if (!result && !baseName.includes('/')) {
    result = await tryImport(`${langCode}/${baseName}`)
  }

  if (result) audioCache.set(cacheKey, result)
  return result ?? null
}

/**
 * Resolves the audio path for the current i18n language.
 * Falls back silently if not found (returns null).
 *
 * @param {string} baseName  e.g. "instructions/camera_scan" | "errors/face_not_detected" | "camera_scan"
 */
export const getAudioForCurrentLanguage = async (baseName) => {
  const currentLang = i18n.language || "en"
  console.log("[audioUtils] lang:", currentLang, "key:", baseName)

  const audio = await preloadAudio(baseName, currentLang)
  if (audio) return audio

  // Language fallback → en
  if (currentLang !== "en") {
    const fallback = await preloadAudio(baseName, "en")
    if (fallback) return fallback
  }

  console.warn(`[audioUtils] No audio found for "${baseName}" in "${currentLang}" or "en"`)
  return null
}

/**
 * Convenience factory — returns a `play(baseName)` function pre-wired to an
 * audio ref. Same API as the old createLanguageAudioPlayer.
 */
export const createLanguageAudioPlayer = (audioRef, onPlayingChange) => {
  return async (baseName) => {
    const audioPath = await getAudioForCurrentLanguage(baseName)

    if (audioPath && audioRef.current) {
      audioRef.current.src = audioPath
      onPlayingChange?.(true)
      audioRef.current.play().catch((err) => {
        console.log("[audioUtils] Playback failed:", err)
        onPlayingChange?.(false)
      })
      return true
    }

    console.log(`[audioUtils] No audio found for "${baseName}"`)
    onPlayingChange?.(false)
    return false
  }
}

export default getAudioForCurrentLanguage
