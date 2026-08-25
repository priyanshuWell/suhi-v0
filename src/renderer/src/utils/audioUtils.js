import i18n from "i18next"

/**
 * audioUtils.js — Language-aware audio loader
 *
 * Folder convention:
 *   assets/audio/{lang}/instructions/{name}.mp3  ← screen instructions
 *   assets/audio/{lang}/errors/{name}.mp3         ← error/warning feedback
 *
 * Pass baseName as:
 *   "instructions/camera_scan"     → assets/audio/{lang}/instructions/camera_scan.mp3
 *   "errors/face_not_detected"     → assets/audio/{lang}/errors/face_not_detected.mp3
 *   "camera_scan"                  → tries instructions/ first, then flat path (backward compat)
 *
 * Strategy: use new URL(..., import.meta.url) which Vite resolves reliably
 * for all asset paths, including fully dynamic subfolder paths.
 */

const audioCache = new Map()

/**
 * Try to resolve an audio file URL using Vite's URL constructor.
 * Returns the href string if the file exists, or null on any error.
 */
const tryResolve = (path) => {
  try {
    // new URL with import.meta.url is the idiomatic Vite way to resolve
    // dynamic asset paths — it works in both dev and built Electron apps.
    const url = new URL(`../assets/audio/${path}.mp3`, import.meta.url)
    return url.href
  } catch {
    return null
  }
}

/**
 * Verify a resolved URL actually loads (fetch HEAD check).
 * Falls back silently — returns null if the file isn't found.
 */
const verifyUrl = async (href) => {
  if (!href) return null
  try {
    const res = await fetch(href, { method: "HEAD" })
    return res.ok ? href : null
  } catch {
    // In Electron with file:// protocol, fetch HEAD can fail even for valid files.
    // In that case we trust the URL and return it directly.
    return href
  }
}

const preloadAudio = async (baseName, langCode) => {
  const cacheKey = `${langCode}/${baseName}`
  if (audioCache.has(cacheKey)) return audioCache.get(cacheKey)

  let result = null

  // 1. Try the exact path as given ("instructions/x", "errors/x", or a prefixed path)
  const url1 = tryResolve(`${langCode}/${baseName}`)
  result = await verifyUrl(url1)

  // 2. If no subfolder prefix given, try instructions/ subfolder (backward compat)
  if (!result && !baseName.includes('/')) {
    const url2 = tryResolve(`${langCode}/instructions/${baseName}`)
    result = await verifyUrl(url2)
  }

  if (result) audioCache.set(cacheKey, result)
  return result ?? null
}

/**
 * Resolves the audio path for the current i18n language.
 * Falls back silently to "en" if the target language file is not found.
 *
 * @param {string} baseName  e.g. "instructions/camera_scan" | "errors/face_not_detected" | "camera_scan"
 * @returns {Promise<string|null>} Resolved URL or null
 */
export const getAudioForCurrentLanguage = async (baseName) => {
  const currentLang = i18n.language || "en"
  console.log("[audioUtils] lang:", currentLang, "key:", baseName)

  const audio = await preloadAudio(baseName, currentLang)
  if (audio) return audio

  // Language fallback → en
  if (currentLang !== "en") {
    console.warn(`[audioUtils] "${baseName}" not found in "${currentLang}", falling back to en`)
    const fallback = await preloadAudio(baseName, "en")
    if (fallback) return fallback
  }

  console.warn(`[audioUtils] No audio found for "${baseName}" in "${currentLang}" or "en"`)
  return null
}

/**
 * Call this when the app language changes to clear stale cached paths.
 * Wire this into your i18n.on('languageChanged') handler.
 */
export const clearAudioCache = () => {
  audioCache.clear()
  console.log("[audioUtils] Cache cleared on language change")
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
