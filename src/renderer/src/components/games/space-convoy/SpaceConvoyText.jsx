import { useEffect, useRef, useState } from "react"
import textframe from "../../../assets/textFrame.png"
import BlueGradientButton from '../../ui/BlueGradientButton'
import { useTranslation } from "react-i18next"
import instructionAudio from "../../../assets/audio/cognitive_game_instruction_en.mp3"
import { Volume2 } from "lucide-react"

export function SpaceConvoyText({ onStartDemo }) {
    const { t } = useTranslation()
    const audioRef = useRef(null)
    const [audioDone, setAudioDone] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)

    // Auto-play instruction audio on mount
    useEffect(() => {
        const audio = new Audio(instructionAudio)
        audioRef.current = audio

        const handleEnded = () => {
            setAudioDone(true)
            setIsPlaying(false)
        }
        const handlePlay = () => setIsPlaying(true)
        const handlePause = () => setIsPlaying(false)

        audio.addEventListener("ended", handleEnded)
        audio.addEventListener("play", handlePlay)
        audio.addEventListener("pause", handlePause)

        const playPromise = audio.play()
        if (playPromise !== undefined) {
            playPromise.catch((err) => {
                console.warn("[SpaceConvoyText] Autoplay prevented:", err.message)
                setIsPlaying(false)
            })
        }

        return () => {
            audio.removeEventListener("ended", handleEnded)
            audio.removeEventListener("play", handlePlay)
            audio.removeEventListener("pause", handlePause)
            audio.pause()
            audio.src = ""
        }
    }, [])

    const handleReplay = () => {
        const audio = audioRef.current
        if (!audio) return
        audio.currentTime = 0
        audio.play().catch((err) => console.warn("[SpaceConvoyText] Replay failed:", err.message))
    }

    return (
        <div className="relative z-10 flex flex-col gap-14 items-center justify-center w-full h-full">
            <div className="relative flex flex-col items-center justify-center h-16 w-full text-center">
                <img src={textframe} alt="text-frame" className="absolute top-0 w-1/2" />
                <p className="text-white portrait:text-[32px] tracking-wider z-10">
                    {t('spaceConvoy.title')}
                </p>
                <img src={textframe} alt="text-frame" className="absolute bottom-0 rotate-180 w-1/2" />
            </div>

            <h1 className="text-white/90 text-center text-2xl tracking-wider portrait:text-4xl font-anta max-w-lg">
                {t('spaceConvoy.instruction')}
            </h1>

            {/* Audio replay button */}
            <button
                onClick={handleReplay}
                className="flex items-center gap-3 px-6 py-3 rounded-full border border-white/30 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all duration-300"
            >
                <Volume2 size={24} className={isPlaying ? "animate-pulse text-blue-300" : ""} />
                <span className="text-lg tracking-wide">
                    {isPlaying ? t('audio.playing', 'Playing…') : t('audio.replay', 'Replay Instructions')}
                </span>
            </button>

            {/* Start button — locked until audio completes */}
            <div className="flex flex-col items-center gap-2">
                <BlueGradientButton
                    className="text-2xl"
                    onClick={onStartDemo}
                    disabled={!audioDone}
                >
                    {t('spaceConvoy.start')}
                </BlueGradientButton>
                {!audioDone && (
                    <p className="text-white/50 text-sm tracking-wide mt-1">
                        {t('audio.listenFirst', 'Please listen to the instructions first')}
                    </p>
                )}
            </div>
        </div>
    )
}