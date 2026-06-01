import { Fragment } from "react"

const steps = [
    { id: 1, label: 'Face Scan' },
    { id: 2, label: 'Body Scan' },
    { id: 3, label: 'Voice Scan' },
    { id: 4, label: 'Cognitive Games' },
    { id: 5, label: 'Vision Test' },
]

export default function ProgressStage({ current }) {
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
                border: "1px solid rgba(255, 255, 255, 0.72)",
                boxShadow:
                    current >= steps.length
                        ? "0 2px 22px 0 rgba(100, 255, 180, 0.55)"
                        : "0 2px 20px 0 rgba(154, 217, 255, 0.62)",
                WebkitBackdropFilter: "blur(6px)",
            }}
        >
            {steps.map((s, i) => {
                const isDone = s.id < current
                const isActive = s.id === current

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