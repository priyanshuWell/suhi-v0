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
            className="fixed top-0 left-0 right-0 z-9999 flex items-center w-full px-10 py-7"
            style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.45) 70%, transparent 100%)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
            }}
        >
            {steps.map((s, i) => {
                const isDone = s.id < current
                const isActive = s.id === current

                const circleClass = (isDone || isActive)
                    ? "bg-[#9ad9ff] text-black"
                    : "bg-[#616161] text-white"

                const labelClass = (isDone || isActive)
                    ? "text-[rgba(255,255,255,0.87)]"
                    : "text-[rgba(255,255,255,0.6)]"

                const lineClass = isDone
                    ? "bg-[#9ad9ff]"
                    : "bg-[#bdbdbd]"

                return (
                    <Fragment key={s.id}>
                        <div className="flex items-center gap-2 shrink-0">
                            <div
                                className={`w-[46px] h-[46px] flex items-center justify-center rounded-full text-[23px] tracking-wide font-anta shrink-0 ${circleClass}`}

                            >
                                {s.id}
                            </div>
                            <span
                                className={`text-[22px] whitespace-nowrap tracking-wide font-anta ${labelClass}`}
                            >
                                {s.label}
                            </span>
                        </div>

                        {i < steps.length - 1 && (
                            <div className={`flex-1 h-[2px] mx-3 ${lineClass}`} />
                        )}
                    </Fragment>
                )
            })}
        </div>
    )
}