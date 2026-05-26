biaimport { useEffect, useRef, useState } from "react"
import textframe from "../../../assets/textFrame.png"
import { useTranslation } from "react-i18next"

import countdownVoice from "../../../assets/audio/space_convoy/countdown.mp3"

export function StartCountDown({ onComplete }) {
    const { t } = useTranslation()

    const sequence = [3, 2, 1, "GO!"]
    const [step, setStep] = useState(0)

    const audioRef = useRef(null)

    useEffect(() => {
        // create audio once
        audioRef.current = new Audio(countdownVoice)

        // play once at start
        audioRef.current.play().catch((err) => {
            console.log("Audio blocked:", err)
        })

        return () => {
            audioRef.current?.pause()
            audioRef.current = null
        }
    }, [])

    useEffect(() => {
        if (step >= sequence.length) {
            onComplete?.()
            return
        }

        const timer = setTimeout(() => {
            setStep((prev) => prev + 1)
        }, 1200)

        return () => clearTimeout(timer)
    }, [step])

    const current = sequence[step]

    return (
        <div className="relative z-10 flex flex-col gap-14 items-center justify-center w-full h-full overflow-hidden ">
            <div className="relative flex flex-col items-center justify-center h-16 w-full text-center">
                <img src={textframe} className="absolute top-0 w-1/2" />

                <p className="text-white portrait:text-[32px] tracking-wider z-10">
                    {t("spaceConvoy.countdownText")}
                </p>

                <img src={textframe} className="absolute bottom-0 rotate-180 w-1/2" />
            </div>

            <div className="flex items-center justify-center">
                {current !== undefined && (
                    <p
                        key={step}
                        className="text-white text-[28rem] font-bold tracking-tight"
                        style={{
                            animation: "slideInDiag 300ms linear forwards",
                        }}
                    >
                        {current}
                    </p>
                )}
            </div>

            <style>{`
                @keyframes slideInDiag {
                    from {
                        opacity: 0;
                        transform: translate(300px, -300px) scale(0.5);
                    }
                    to {
                        opacity: 1;
                        transform: translate(0, 0) scale(1);
                    }
                }
            `}</style>
        </div>
    )
}