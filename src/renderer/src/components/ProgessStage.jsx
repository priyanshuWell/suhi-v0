import { Fragment } from "react"
import { useSelector } from "react-redux"
import { useTranslation } from "react-i18next"
import PropTypes from "prop-types"

// ─── Known stage key aliases (handles backend variations, typos & legacy keys) ──
const STAGE_ALIASES = {
    login: ["login", "face", "face_scan", "face_capture", "facecapture"],
    bia: ["bia", "body_scan", "bia_scan"],
    smoothie_slash: [
        "smoothie_slash",
        "divide_attention",
        "smoothie",
        "smoothieslash",
        "space_convoy",
        "spaceconvoy"
    ],
    voice_analysis: ["voice_analysis", "voice", "voice_scan", "voicescan", "voiceanalysis"],
    color_blindness: [
        "color_blindness",
        "colorblindness",
        "congitive", // known backend typo
        "cognitive",
        "vision_scan",
        "visionscan"
    ],
    height_weight: ["height_weight", "weight_height", "bmi", "bia", "heightweight", "weightheight"],
    perilous_path: ["perilous_path", "perilous", "perilouspath", "mind_scan"],
    visual_acuity: [
        "visual_acuity",
        "visual-acuity",
        "visualacuity",
        "adaptive_eye",
        "adaptiveeye",
        "vision_test",
        "vision"
    ],
    beat_drop: ["beat_drop", "beatdrop"],
    result: ["result", "report"]
}

/**
 * Normalizes a key by stripping hyphens, underscores, spaces and lowercasing.
 * Handles both string keys and objects like { stage_key: "..." }.
 */
function normalizeKey(k) {
    if (!k) return ""
    const raw = typeof k === "object" ? k.stage_key || k.key || k.name || "" : k
    return String(raw)
        .trim()
        .toLowerCase()
        .replace(/[-_\s]/g, "")
}

/**
 * Checks if a step's key (or any of its known aliases) is present in completedStages.
 */
function isStageComplete(step, completedStages) {
    if (!completedStages || !Array.isArray(completedStages) || completedStages.length === 0) {
        return false
    }
    const stepKey = typeof step === "string" ? step : step.key
    const customKeys = Array.isArray(step?.keys) ? step.keys : []
    const aliases = [stepKey, ...customKeys, ...(STAGE_ALIASES[stepKey] || [])]
    const normalizedAliases = aliases.map(normalizeKey)

    const normalizedCompleted = completedStages.map(normalizeKey)
    return normalizedAliases.some((alias) => normalizedCompleted.includes(alias))
}

// ─── Screening 1 stages ──────────────────────────────────────────────────────
const SCREENING_1_STEPS = [
    { id: 1, key: "login", label: "Face Scan" },
    { id: 2, key: "bia", label: "Body Scan" },
    { id: 3, key: "smoothie_slash", label: "Smoothie Slash" },
    { id: 4, key: "voice_analysis", label: "Voice Scan" },
    { id: 5, key: "color_blindness", label: "Vision Scan" }
]

// ─── Screening 2 stages ──────────────────────────────────────────────────────
const SCREENING_2_STEPS = [
    { id: 1, key: "login", label: "Face Scan" },
    { id: 2, key: "height_weight", label: "BMI Scan" },
    { id: 3, key: "perilous_path", label: "Perilous Path" },
    { id: 4, key: "visual_acuity", label: "Vision Test" },
    { id: 5, key: "beat_drop", label: "Beat Drop" },
    { id: 6, key: "result", label: "Result" }
]

/**
 * Derives the active step number from completedStages and nextStage for a given steps array.
 * 1. If nextStage matches a step, that step is active.
 * 2. Otherwise, first uncompleted step is active.
 * 3. If all steps are complete, returns steps.length + 1 so all are marked complete.
 */
function deriveActiveStep(steps, completedStages, nextStage) {
    if (nextStage) {
        const nextKey = normalizeKey(nextStage)
        const match = steps.find((step) => {
            const aliases = [step.key, ...(STAGE_ALIASES[step.key] || [])].map(normalizeKey)
            return aliases.includes(nextKey)
        })
        if (match) {
            return match.id
        }
    }

    for (let i = 0; i < steps.length; i++) {
        if (!isStageComplete(steps[i], completedStages)) {
            return steps[i].id
        }
    }
    return steps.length + 1
}

export default function ProgressStage({ current = null }) {
    const { t } = useTranslation()
    const screening = useSelector((state) => state.common.screening)
    const user = useSelector((state) => state.common.user)

    // Gather completed stages from all possible Redux locations
    const completedStages = [
        ...(screening?.completedStages || []),
        ...(screening?.completed_stages || []),
        ...(user?.screening?.completed_stages || []),
        ...(user?.screening?.completedStages || [])
    ]
    const nextStage = screening?.nextStage
    const screeningOrder = screening?.screeningOrder ?? 1

    // Select the correct step set for the current screening phase
    const steps = screeningOrder === 2 ? SCREENING_2_STEPS : SCREENING_1_STEPS

    // If a `current` prop is passed (route-based, legacy), use it.
    // Otherwise derive from completedStages and nextStage.
    const activeStepNum =
        current !== null ? current : deriveActiveStep(steps, completedStages, nextStage)

    const isAllDone =
        activeStepNum > steps.length || steps.every((s) => isStageComplete(s, completedStages))

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
                const isDone = isStageComplete(step, completedStages) || step.id < activeStepNum
                const isActive = step.id === activeStepNum && !isDone

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
                    isDone || step.id < activeStepNum
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
                                {t(`progress_stages.${step.key}`, step.label)}
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

ProgressStage.propTypes = {
    current: PropTypes.number
}
