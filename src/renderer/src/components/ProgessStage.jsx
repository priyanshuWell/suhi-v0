import { Fragment } from "react"
import { useSelector } from "react-redux"

const steps = [
    { id: 1, key: 'login', label: 'Face Scan' },
    { id: 2, key: 'bia', label: 'Body Scan' },
    { id: 3, key: 'divide_attention', label: 'Cognitive Games' },
    { id: 4, keys: ['color_blindness'], label: 'Vision Test' },
        { id: 5, key: 'voice_analysis', label: 'Voice Scan' },
]

const STAGE_KEY_TO_STEP = {
    login: 1,
    bia: 2,
    voice_analysis: 5,
    divide_attention: 3,
    congitive: 4,
    color_blindness: 4,
    result: 6,
}

export default function ProgressStage({ current }) {
    const user = useSelector((state) => state.common.user)

    // Determine current active step number
    const nextStageKey = user?.screening?.nextStage?.stage_key
    const activeStepNum = nextStageKey ? (STAGE_KEY_TO_STEP[nextStageKey] ?? current) : current

    return (
        <div
            className="
                fixed top-5 left-1/2 -translate-x-1/2
                z-[9999]
                flex items-center
                w-full max-w-[1400px]
                px-3
                 py-3
                backdrop-blur-md
            "
            style={{
                background: "rgba(82, 82, 82, 0.13)",
                boxShadow:
                    activeStepNum >= steps.length
                        ? "0 2px 22px 0 rgba(100, 255, 180, 0.55)"
                        : "0 2px 20px 0 rgba(154, 217, 255, 0.62)",
                WebkitBackdropFilter: "blur(6px)",
            }}
        >
            {steps.map((s, i) => {
                let isDone = false
                let isActive = false

                if (nextStageKey) {
                    // Check if this step is done
                    const isStepInCompleted = s.key
                        ? screening.completedStages?.includes(s.key)
                        : s.keys?.some(k => screening.completedStages?.includes(k))

                    isDone = isStepInCompleted || (s.id < activeStepNum)

                    // Check if this step is active
                    isActive = s.key
                        ? nextStageKey === s.key
                        : s.keys?.includes(nextStageKey)
                } else {
                    isDone = s.id < current
                    isActive = s.id === current
                }

                const circleClass =
                    isDone || isActive
                        ? `
                            bg-[#9ad9ff]
                            text-black
                            border border-[#d8f3ff]
                            shadow-[0_0_16px_rgba(154,217,255,0.8)]
                          `
                        : `
                            bg-[#616161]
                            text-white
                            border border-[#8a8a8a]
                          `

                const labelClass =
                    isDone || isActive
                        ? "text-[rgba(255,255,255,0.92)]"
                        : "text-[rgba(255,255,255,0.6)]"

                const lineClass = isDone
                    ? `
                        bg-[#9ad9ff]
                        shadow-[0_0_10px_rgba(154,217,255,0.9)]
                      `
                    : "bg-[#8e8e8e]"

                return (
                    <Fragment key={s.id}>
                        <div className="flex items-center gap-2 shrink-0">
                            <div
                                className={`
                                    w-[28px]
                                    h-[28px]
                                    flex
                                    items-center
                                    justify-center
                                    rounded-full
                                    text-[20px]
                                    tracking-wide
                                    font-anta
                                    shrink-0
                                    transition-all
                                    duration-300
                                    ${circleClass}
                                `}
                            >
                                {s.id}
                            </div>

                            <span
                                className={`
                                    text-[18px]
                                    font-anta
                                    transition-all
                                    duration-300
                                    ${labelClass}
                                `}
                            >
                                {s.label}
                            </span>
                        </div>

                        {i < steps.length - 1 && (
                            <div
                                className={`
                                    flex-1
                                    min-w-[40px]
                                    h-[2px]
                                    mx-3
                                    rounded-full
                                    transition-all
                                    duration-300
                                    ${lineClass}
                                `}
                            />
                        )}
                    </Fragment>
                )
            })}
        </div>
    )
}