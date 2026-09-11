import { Fragment } from "react"
import { useSelector } from "react-redux"

// ─── Screening 1 stages ──────────────────────────────────────────────────────
const SCREENING_1_STEPS = [
    { id: 1, key: "login", label: "Face Scan" },
    { id: 2, key: "bia", label: "Body Scan" },
    { id: 3, key: "smoothie_slash", label: "Mind Scan" },
    { id: 4, key: "voice_analysis", label: "Voice Scan" },
    { id: 5, key: "color_blindness", label: "Vision Scan" }
]

// ─── Screening 2 stages ──────────────────────────────────────────────────────
const SCREENING_2_STEPS = [
    { id: 1, key: "login", label: "Face Scan" },
    { id: 2, key: "height_weight", label: "BMI Scan" },
    { id: 3, key: "perilous_path", label: "Mind Scan" },
    { id: 4, key: "visual_acuity", label: "Vision Test" },
    { id: 5, key: "beat_drop", label: "Beat Drop" },
    { id: 6, key: "result", label: "Result" }
]

/**
 * Derives the active step number from completedStages for a given steps array.
 * The active step is the first step whose key is NOT yet in completedStages.
 * Falls back to the last step index if everything is done.
 */
function deriveActiveStep(steps, completedStages) {
    for (let i = 0; i < steps.length; i++) {
        if (!completedStages.includes(steps[i].key)) {
            return steps[i].id
        }
    }
    return steps[steps.length - 1].id
}

export default function ProgressStage({ current = null }) {
    const screening = useSelector((state) => state.common.screening)
    const completedStages = screening?.completedStages || []
    const screeningOrder = screening?.screeningOrder ?? 1

    // Select the correct step set for the current screening phase
    const steps = screeningOrder === 2 ? SCREENING_2_STEPS : SCREENING_1_STEPS

    // If a `current` prop is passed (route-based, legacy), use it.
    // Otherwise derive from completedStages so Screening 2 works without route mapping.
    const activeStepNum = current !== null ? current : deriveActiveStep(steps, completedStages)

    const isAllDone = activeStepNum >= steps.length

    return (
        <div
            className="
        fixed top-5 left-1/2 -translate-x-1/2
        z-[9999]
        flex items-center
        w-full max-w-[1400px]
        px-3 py-3
        backdrop-blur-md
      "
            style={{
                background: "rgba(82, 82, 82, 0.13)",
                boxShadow: isAllDone
                    ? "0 2px 22px 0 rgba(100, 255, 180, 0.55)"
                    : "0 2px 20px 0 rgba(154, 217, 255, 0.62)",
                WebkitBackdropFilter: "blur(6px)"
            }}
        >
            {/* Screening level badge */}
            {screeningOrder === 2 && (
                <div
                    className="
            shrink-0 mr-4 px-3 py-1 rounded-full
            text-[14px] font-anta tracking-wide
            border border-[#9ad9ff]/40
            text-[#9ad9ff]
            bg-[#9ad9ff]/10
          "
                >
                    S2
                </div>
            )}

            {steps.map((step, index) => {
                const isDone = completedStages.includes(step.key) || step.id < activeStepNum
                const isActive = step.id === activeStepNum

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

                const lineClass =
                    step.id < activeStepNum
                        ? `
              bg-[#9ad9ff]
              shadow-[0_0_10px_rgba(154,217,255,0.9)]
            `
                        : "bg-[#8e8e8e]"

                return (
                    <Fragment key={step.id}>
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
                                {step.id}
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
                                {step.label}
                            </span>
                        </div>

                        {index < steps.length - 1 && (
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
