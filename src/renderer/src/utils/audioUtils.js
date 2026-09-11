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
 * Uses Vite's `import.meta.glob` to statically discover all available audio assets.
 * This guarantees 100% reliable resolution, instant synchronous checks, and seamless
 * fallback to 'en' when audio files are missing in other languages.
 */

// Eagerly map all audio files under assets/audio
const audioModules = import.meta.glob("../assets/audio/**/*.{mp3,wav,ogg}", {
    eager: true,
    import: "default"
})

/**
 * Helper to retrieve a resolved module URL from audioModules.
 */
const getModule = (relPath) => {
    const fullPath = `../assets/audio/${relPath}`
    return audioModules[fullPath] || null
}

/**
 * Attempt to match a baseName within a specific language folder.
 */
const resolvePath = (baseName, langCode) => {
    const cleanName = baseName.replace(/^\//, "")

    // 1. Try exact path (e.g. "bn/errors/remove_your_shoes_and_socks.mp3")
    let mod =
        getModule(`${langCode}/${cleanName}.mp3`) ||
        getModule(`${langCode}/${cleanName}.wav`) ||
        getModule(`${langCode}/${cleanName}.ogg`)
    if (mod) return mod

    // 2. If no subfolder prefix given (e.g. "camera_scan"), try instructions/ subfolder
    if (!cleanName.includes("/")) {
        mod =
            getModule(`${langCode}/instructions/${cleanName}.mp3`) ||
            getModule(`${langCode}/instructions/${cleanName}.wav`) ||
            getModule(`${langCode}/instructions/${cleanName}.ogg`)
        if (mod) return mod
    }

    return null
}

/**
 * Resolves the audio path for the current i18n language.
 * Falls back silently to "en" if the target language file is not found.
 *
 * @param {string} baseName  e.g. "instructions/camera_scan" | "errors/remove_your_shoes_and_socks" | "welcome_screen"
 * @returns {Promise<string|null>} Resolved URL string or null
 */
export const getAudioForCurrentLanguage = async (baseName) => {
    if (!baseName) return null
    const currentLang = i18n.language || "en"
    console.log("[audioUtils] lang:", currentLang, "key:", baseName)

    // Try target language
    let audio = resolvePath(baseName, currentLang)
    if (audio) return audio

    // Language fallback -> en
    if (currentLang !== "en") {
        console.warn(
            `[audioUtils] "${baseName}" not found in "${currentLang}", falling back to "en"`
        )
        audio = resolvePath(baseName, "en")
        if (audio) return audio
    }

    console.warn(`[audioUtils] No audio found for "${baseName}" in "${currentLang}" or "en"`)
    return null
}

/**
 * Kept for backward compatibility.
 */
export const clearAudioCache = () => {
    console.log("[audioUtils] Audio map active")
}

/**
 * Convenience factory — returns a `play(baseName)` function pre-wired to an
 * audio ref.
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
