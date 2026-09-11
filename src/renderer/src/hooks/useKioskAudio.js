// hooks/useKioskAudio.js
import { useRef, useCallback, useEffect } from "react"
import { getAudioForCurrentLanguage } from "../utils/audioUtils"

/**
 * useKioskAudio
 *
 * ONE physical audio channel used for BOTH instruction and error clips.
 *
 * Semantics (deliberately different from the old "queue and wait" hook):
 *   - play() ALWAYS interrupts whatever is currently playing/pending.
 *     No clip ever waits for a previous one to finish — this kills the
 *     "waits for 1st audio to complete" bug at the root.
 *   - play() returns a promise that resolves once playback for THIS call
 *     ends (naturally, via error, or because a newer play()/stop() cut
 *     it off): { completed: true|false }.
 *     Callers that must not navigate before the user hears the clip
 *     should simply `await play(...)` before navigating.
 *   - stop() is race-safe: it invalidates any in-flight play() (even one
 *     still awaiting the mp3 import) via a generation token, so a late
 *     resolution can never sneak in and start audio after stop() ran.
 */
export function useKioskAudio() {
    const audioRef = useRef(null)
    const playIdRef = useRef(0) // generation token
    const resolveCurrentRef = useRef(null) // resolves whichever play() is in flight

    const getAudio = useCallback(() => {
        if (!audioRef.current) audioRef.current = new Audio()
        return audioRef.current
    }, [])

    const settleCurrent = useCallback((completed) => {
        if (resolveCurrentRef.current) {
            const resolve = resolveCurrentRef.current
            resolveCurrentRef.current = null
            resolve({ completed })
        }
    }, [])

    const play = useCallback(
        async (key) => {
            const audio = getAudio()

            // New clip always wins. Interrupt immediately — no waiting.
            playIdRef.current += 1
            settleCurrent(false)
            if (!audio.paused) {
                audio.pause()
                audio.currentTime = 0
            }

            if (!key) return { completed: true } // "just stop", nothing new to play

            const myPlayId = playIdRef.current
            const path = await getAudioForCurrentLanguage(key)

            // stop()/another play() happened while we were resolving the import —
            // do NOT start a stale clip.
            if (myPlayId !== playIdRef.current) return { completed: false }

            if (!path) {
                console.warn(`[useKioskAudio] No audio path for key: "${key}"`)
                return { completed: false }
            }

            return new Promise((resolve) => {
                resolveCurrentRef.current = resolve

                const cleanup = () => {
                    audio.removeEventListener("ended", onEnded)
                    audio.removeEventListener("error", onError)
                }
                const finish = (completed) => {
                    if (myPlayId !== playIdRef.current) return // stale listener
                    cleanup()
                    resolveCurrentRef.current = null
                    resolve({ completed })
                }
                const onEnded = () => finish(true)
                const onError = () => finish(false)

                audio.addEventListener("ended", onEnded)
                audio.addEventListener("error", onError)

                audio.src = path
                audio.currentTime = 0
                audio.play().catch((err) => {
                    console.warn(`[useKioskAudio] Playback failed for "${key}":`, err?.message)
                    finish(false)
                })
            })
        },
        [getAudio, settleCurrent]
    )

    const stop = useCallback(() => {
        playIdRef.current += 1
        settleCurrent(false)
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
        }
    }, [settleCurrent])

    // Never let a clip keep playing after the screen unmounts.
    useEffect(() => stop, [stop])

    return { play, stop }
}
