import i18n from "i18next"

const audioCache = new Map()

const preloadAudio = async (baseName, langCode) => {
  const key = `${baseName}_${langCode}`
  if (audioCache.has(key)) return audioCache.get(key)

  try {
    const module = await import(`../assets/audio/${baseName}_${langCode}.mp3`)
    console.log("module", module.default)
    audioCache.set(key, module.default)
    return module.default
  } catch {
    return null
  }
}

export const getAudioForCurrentLanguage = async (baseName) => {
  const currentLang = i18n.language || null;
  console.log("baselang",currentLang)

  const langAudio = await preloadAudio(baseName, currentLang)
  if (langAudio) return langAudio

  // if (currentLang !== "en") {
  //   const fallbackAudio = await preloadAudio(baseName, "en")
  //   return fallbackAudio
  // }

  return null
}

export const createLanguageAudioPlayer = (audioRef, onPlayingChange) => {
  return async (baseName) => {
    const audioPath = await getAudioForCurrentLanguage(baseName)

    if (audioPath && audioRef.current) {
      audioRef.current.src = audioPath
      onPlayingChange?.(true)
      audioRef.current.play().catch((err) => {
        console.log("Audio playback failed:", err)
        onPlayingChange?.(false)
      })
      return true
    }

    console.log(`No audio found for ${baseName} in any language`)
    onPlayingChange?.(false)
    return false
  }
}

export default getAudioForCurrentLanguage
