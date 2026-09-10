import { useEffect, useState, useRef, useCallback } from "react"
import BodyIcon from "../../assets/bia/BodyIcon.svg"
import WeightIcon from "../../assets/bia/weight.svg"
import HeightIcon from "../../assets/bia/height.svg"
import Eye_Icon from "../../assets/bia/Eye_Icon.svg"
import bgTexture from "../../assets/lightbg.png" // TODO: save Figma "image 1190" asset locally
import qrCode from "../../assets/bia/qr-code.png" // TODO: save Figma "QR Code" asset locally
// import emotionIcon from '../../assets/bia/emotion.svg'   // TODO: save Figma "😌" asset locally
import vitalsIcon from "../../assets/bia/vitals.png" // TODO: save Figma "🫀" asset locally
import { useNavigate } from "react-router"
import { useSelector } from "react-redux"
import axios from "axios"
import BodyConstitution from "./BodyConstitution"
import { useTranslation } from "react-i18next"
import { releaseAllResources } from "../../utils/cleanup"
import { BrainIconS, MindIcon } from "../../assets"
import { API_BASE_URL } from "../../utils/config"

/*
  ─────────────────────────────────────────────────────────────
  KIOSK SCALING STRATEGY
  ─────────────────────────────────────────────────────────────
  Target screen : 1402 × 1802 px (portrait kiosk, no scrolling ever)
  Same approach as before: render at DESIGN_W, measure natural
  height, scale down to fit, never upscale.
  ─────────────────────────────────────────────────────────────
*/
const DESIGN_W = 1402
const FONT = "'Anta', sans-serif"

/* ── Liquid-glass pill shared styling ── */
const pill = {
    position: "relative",
    overflow: "hidden",

    borderRadius: "28px",

    boxShadow: "0px 3.58px 28.62px #9ad9ff",
    background:
        "rgba(82,82,82,0.3) padding-box, linear-gradient(135.77deg, rgba(255,255,255,0.1), rgba(255,255,255,0)) border-box",
    border: "1.4px solid transparent",

    backdropFilter: "blur(35px)",
    WebkitBackdropFilter: "blur(35px)"
}

const pillRow = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "8px",
    padding: "20px 24px"
}

/* ── Random-but-plausible vitals, used only when the backend hasn't
     returned a real reading for a given field. Generated once per
     mount (see randomVitalsRef below) so the UI doesn't flicker
     between renders. ── */
// const generateRandomVitals = () => ({
//     heart_rate: Math.round(60 + Math.random() * 40),       // 60–100 bpm
//     breathing_rate: Math.round(12 + Math.random() * 8),    // 12–20 breaths/min
//     stress: ['Low', 'Moderate'][Math.floor(Math.random() * 2)],
//     systolic: Math.round(110 + Math.random() * 20),        // 110–130 mmHg
//     diastolic: Math.round(70 + Math.random() * 15),        // 70–85 mmHg
//     bp_category: 'Normal',
// })

/* ─────────────────────────────────────────────
   STAT CARD  (Mind / Brain / Body / Vitals)
   Each card = icon + title + stacked label:value pill rows
───────────────────────────────────────────── */
const StatCard = ({ title, icon, color, rows }) => (
    <div
        className="flex flex-col items-center rounded-[28px]"
        style={{
            ...pill,
            flex: 1,
            padding: "28px 16px",
            gap: "16px"
        }}
    >
        <div className="flex items-center justify-center" style={{ gap: "16px" }}>
            <span
                className="flex items-center justify-center shrink-0"
                style={{ width: "48px", height: "48px" }}
            >
                {icon}
            </span>
            <h3
                className="leading-none tracking-[0.04em]"
                style={{ fontFamily: FONT, fontSize: "48px", color }}
            >
                {title}
            </h3>
        </div>

        <div className="flex flex-col w-full" style={{ gap: "12px" }}>
            {rows.map((row) => (
                <div
                    key={row.label}
                    className="flex items-center justify-center w-full"
                    style={{ ...pillRow, gap: "12px" }}
                >
                    <p
                        className="text-white text-center whitespace-nowrap"
                        style={{ fontFamily: FONT, fontSize: "28px" }}
                    >
                        {row.label}:
                    </p>
                    <p
                        className="text-center whitespace-nowrap"
                        style={{ fontFamily: FONT, fontSize: "36px", color }}
                    >
                        {row.value}
                    </p>
                </div>
            ))}
        </div>
    </div>
)

const formatColorBlindness = (val, type) => {
    switch (val) {
        case "color_vision_deficit_not_present":
            return `Color Vision Deficit Not Present ${type !== null ? `[${type}]` : ""} `
        case "color_vision_deficit_present":
            return `color Vision Deficit Present ${type !== null ? `[${type}]` : ""}`
        case "rescan_recommended":
            return `Rescan Recommended ${type !== null ? `[${type}]` : ""}`
        default:
            return `Rescan Recommended `
    }
}


/* Full-width single-row pill (Color Blindness / Emotion) */
const InfoPill = ({ icon, label, value, color }) => (
    <div
        className="flex items-center justify-center w-full"
        style={{ ...pill, gap: "16px", padding: "24px" }}
    >
        <span
            className="flex items-center justify-center shrink-0"
            style={{ width: "40px", height: "40px" }}
        >
            {icon}
        </span>
        <p className="text-white whitespace-nowrap" style={{ fontFamily: FONT, fontSize: "36px" }}>
            {label}:
        </p>
        <p className="whitespace-nowrap" style={{ fontFamily: FONT, fontSize: "38px", color }}>
            {value}
        </p>
    </div>
)

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
const Result = ({ apiReportRaw, reportError: reportErrorProp = false, screeningOrder }) => {
    const navigate = useNavigate()
    const storeWeight = useSelector((s) => s.common.weight)
    const storeHeight = useSelector((s) => s.common.height)
    const storeUser = useSelector((s) => s.common.user)
    const screening = useSelector((s) => s.common.screening)
    const { t } = useTranslation()

    const [apiReport, setApiReport] = useState(null)
    const [reportError, setReportError] = useState(false)

    const innerRef = useRef(null)
    const [scale, setScale] = useState(1)

    // Generated once on mount so fallback values stay stable across re-renders
    // const randomVitalsRef = useRef(generateRandomVitals())
    const vitalsRows = [
        apiReport?.vitals?.heart_rate != null && {
            label: "Heart Rate",
            value: `${apiReport.vitals.heart_rate} bpm`
        },
        apiReport?.vitals?.breathing_rate != null &&
        apiReport?.vitals?.breathing_rate != 0.0 && {
            label: "Breathing Rate",
            value: `${apiReport.vitals.breathing_rate} breaths/min`
        },
        //  (apiReport?.vitals?.blood_pressure?.systolic != null && apiReport?.vitals?.blood_pressure?.diastolic != null) &&
        // {
        //     label: 'Blood Pressure',
        //     value: `${apiReport.vitals.blood_pressure.systolic}/${apiReport.vitals.blood_pressure.diastolic} mmHg`,
        // },
        { label: "Stress", value: apiReport?.vitals?.stress }
    ].filter(Boolean)

    const recomputeScale = useCallback(() => {
        const el = innerRef.current
        if (!el) return
        const screenH = window.innerHeight
        const screenW = window.innerWidth
        const naturalH = el.scrollHeight
        const scaleByH = screenH / naturalH
        const scaleByW = screenW / DESIGN_W
        setScale(Math.min(scaleByH, scaleByW, 1))
    }, [])

    useEffect(() => {
        const el = innerRef.current
        if (!el) return
        const ro = new ResizeObserver(recomputeScale)
        ro.observe(el)
        recomputeScale()
        window.addEventListener("resize", recomputeScale)
        return () => {
            ro.disconnect()
            window.removeEventListener("resize", recomputeScale)
        }
    }, [recomputeScale])

    useEffect(() => {
        if (apiReport) {
            requestAnimationFrame(() => requestAnimationFrame(recomputeScale))
        }
    }, [apiReport, recomputeScale])

    /* ── Fallback / merge helpers ── */
    const fallbackPartialJson = {
        height: 170,
        weight: 70,
        body_constitution: { vata: 34, pitta: 40, kapha: 26 },
        hydration: { level: "Ideal" },
        learner_type: { type: "visual", title: "Visual" },
        personality: { animal: "Dominant", traits: ["Calm", "Adaptive", "Focused"] },
        attention: { level: "Good" },
        memory: { level: "Developing" },
        self_esteem: { level: "Well Developed" },
        emotional_regulation: { level: "Good" },
        color_blindness: { status: "Rescan Recommended" },
        muscle_mass: { level: "Ideal" },
        fat_mass: { level: "Low" },
        vitals: {
            heart_rate: null,
            breathing_rate: null,
            stress: "Low"
            // blood_pressure: null,
        },
        emotion: { label: "Calm" }
    }

    const mergeWithFallback = (api) => ({
        height: api?.height ?? fallbackPartialJson.height,
        weight: api?.weight ?? fallbackPartialJson.weight,

        body_constitution:
            api?.body_constitution ??
            fallbackPartialJson.body_constitution,

        hydration:
            api?.hydration ??
            fallbackPartialJson.hydration,

        learner_type:
            api?.learner_type ??
            fallbackPartialJson.learner_type,

        personality:
            api?.personality ??
            fallbackPartialJson.personality,

        attention:
            api?.attention ??
            fallbackPartialJson.attention,

        memory:
            api?.memory ??
            fallbackPartialJson.memory,

        self_esteem:
            api?.self_esteem ??
            fallbackPartialJson.self_esteem,

        emotional_regulation:
            api?.emotional_regulation ??
            fallbackPartialJson.emotional_regulation,

        color_blindness:
            api?.color_blindness ??
            fallbackPartialJson.color_blindness,

        muscle_mass:
            api?.muscle_mass ??
            fallbackPartialJson.muscle_mass,

        fat_mass:
            api?.fat_mass ??
            fallbackPartialJson.fat_mass,

        // ───────── SESSION 2 ─────────
        mind: api?.mind ?? {
            short_term_recall: null,
            fine_motor_skills: null,
            visual_spatial_judgement: null
        },

        brain: api?.brain ?? {
            musical_preference: null,
            learning_style: null,
            stress: null
        },

        body: api?.body ?? {
            visual_acuity: null,
            reaction_time: null,
            motor_coordination: null
        },

        vitals: {
            heart_rate:
                api?.vitals?.heart_rate ??
                fallbackPartialJson.vitals.heart_rate,

            breathing_rate:
                api?.vitals?.breathing_rate ??
                fallbackPartialJson.vitals.breathing_rate,

            stress:
                api?.vitals?.stress ??
                fallbackPartialJson.vitals.stress,

            blood_pressure:
                api?.vitals?.blood_pressure ??
                null
        },

        emotion:
            api?.emotion ??
            fallbackPartialJson.emotion
    })

    const mapSession1ReportToUI = (api) => {
        if (!api) return null
        const d = api.data
        return {
            height: d?.bia?.height_cm ?? null,
            weight: d?.bia?.weight_kg ?? null,
            body_constitution: d?.prakriti
                ? { vata: d.prakriti.vata, pitta: d.prakriti.pitta, kapha: d.prakriti.kapha }
                : null,
            hydration: d?.bia?.hydration ? { level: d.bia.hydration } : null,
            learner_type: d?.learning_style
                ? { type: d.learning_style.toLowerCase(), title: d.learning_style }
                : null,
            personality: d?.personality ? { animal: d.personality, traits: [d.personality] } : null,
            // backend key is `divided_attention`, not `attention`
            attention: d?.divided_attention
                ? {
                    level: d.divided_attention.level,
                    tracking_accuracy: d.divided_attention.tracking_accuracy
                }
                : null,
            // backend key is `cognitive_flexibility`, not `memory`
            memory: d?.cognitive_flexibility
                ? {
                    level: d.cognitive_flexibility.level,
                    score: d.cognitive_flexibility.score
                }
                : null,
            self_esteem: d?.self_esteem,
            emotional_regulation: d?.emotional_regulation,
            color_blindness: d?.color_blindness
                ? {
                    result: d.color_blindness.result,
                    deficiency_type: d.color_blindness.deficiency_type,
                    normal_score: d.color_blindness.normal_score,
                    colorblind_score: d.color_blindness.colorblind_score,
                    irrelevant_score: d.color_blindness.irrelevant_score
                }
                : null,
            muscle_mass: { level: d?.bia?.muscle_mass?.status },
            fat_mass: { level: d?.bia?.fat_mass?.status },
            // backend returns heart_rate / breathing_rate / blood_pressure as
            // separate top-level objects, not a single `vitals` object
            vitals: {
                heart_rate:
                    d?.heart_rate?.heart_rate != null ? Math.round(d.heart_rate.heart_rate) : null,
                breathing_rate:
                    d?.breathing_rate?.breathing_rate != null
                        ? Math.round(d.breathing_rate.breathing_rate)
                        : null,
                stress: d?.heart_rate?.stress_category ?? null
                // blood_pressure: d?.blood_pressure ? {
                //     systolic: d.blood_pressure.systolic != null ? Math.round(d.blood_pressure.systolic) : null,
                //     diastolic: d.blood_pressure.diastolic != null ? Math.round(d.blood_pressure.diastolic) : null,
                //     category: d.blood_pressure.category ?? null,
                // } : null,
            },
            // backend key is `facial_emotion.dominant_emotion`, not `emotion.label`
            emotion: d?.facial_emotion?.masked_emotion
                ? { label: d.facial_emotion.masked_emotion }
                : null
        }
    }

    const mapSession2ReportToUI = (api) => {
        const d = api?.data ?? api

        return {
            height: d?.bia?.height_cm ?? SESSION_2_FALLBACK.height,

            weight: d?.bia?.weight_kg ?? SESSION_2_FALLBACK.weight,

            body_constitution: d?.prakriti
                ? {
                    vata: d.prakriti.vata_percentage,
                    pitta: d.prakriti.pitta_percentage,
                    kapha: d.prakriti.kapha_percentage,
                }
                : SESSION_2_FALLBACK.body_constitution,

            mind: {
                short_term_recall:
                    d?.mind?.short_term_recall ??
                    SESSION_2_FALLBACK.mind.short_term_recall,

                fine_motor_skills:
                    d?.mind?.fine_motor_skills ??
                    SESSION_2_FALLBACK.mind.fine_motor_skills,

                visual_spatial_judgement:
                    d?.mind?.visual_spatial_judgement ??
                    SESSION_2_FALLBACK.mind.visual_spatial_judgement,
            },

            brain: {
                musical_preference:
                    d?.brain?.musical_preference ??
                    SESSION_2_FALLBACK.brain.musical_preference,

                learning_style:
                    d?.brain?.learning_style ??
                    SESSION_2_FALLBACK.brain.learning_style,

                stress:
                    d?.brain?.stress ??
                    SESSION_2_FALLBACK.brain.stress,
            },

            body: {
                visual_acuity:
                    d?.body?.visual_acuity ??
                    SESSION_2_FALLBACK.body.visual_acuity,

                reaction_time:
                    d?.body?.reaction_time ??
                    SESSION_2_FALLBACK.body.reaction_time,

                motor_coordination:
                    d?.body?.motor_coordination ??
                    SESSION_2_FALLBACK.body.motor_coordination,
            },

            vitals: {
                heart_rate:
                    d?.vitals?.heart_rate_bpm ??
                    SESSION_2_FALLBACK.vitals.heart_rate,

                breathing_rate:
                    d?.vitals?.breathing_rate_bpm ??
                    SESSION_2_FALLBACK.vitals.breathing_rate,

                blood_pressure:
                    d?.vitals?.blood_pressure ??
                    SESSION_2_FALLBACK.vitals.blood_pressure,
            },

            emotion: {
                label:
                    d?.emotion ??
                    SESSION_2_FALLBACK.emotion.label,
            },
        }
    }

    const mapReportToUI = (api, screeningOrder) => {
        if (!api) return null

        if (
            screeningOrder === 1 ||
            screeningOrder === "1"
        ) {
            return mapSession1ReportToUI(api)
        }

        if (
            screeningOrder === 2 ||
            screeningOrder === "2"
        ) {
            return mapSession2ReportToUI(api)
        }

        return null
    }
    const fetchBiometricReport = async () => {
        setReportError(false)
        try {
            const sessionId = screening?.sessionId
            const userId = storeUser?.data?.user_id
            const res = await axios.post(`${API_BASE_URL}/report/`, {
                user_id: userId,
                session_id: sessionId,
                screening_session_id: sessionId
            })
            if (res?.data?.success) {
                setApiReport(mergeWithFallback(mapReportToUI(res.data)))
                return
            }
            console.warn("[Result] Report API returned success:false", res?.data)
            setReportError(true)
        } catch (err) {
            console.error("[Result] Report fetch failed:", err)
            setReportError(true)
        }
    }


    const SESSION_2_FALLBACK = {
        height: "-",
        weight: "-",

        body_constitution: {
            vata: 32.5,
            pitta: 38.2,
            kapha: 29.3,
        },

        mind: {
            short_term_recall: {
                score: 82.4,
                level: "Good",
            },
            fine_motor_skills: {
                score: 76.8,
                level: "Good",
            },
            visual_spatial_judgement: {
                score: 88.1,
                level: "Strong",
            },
        },

        brain: {
            musical_preference: {
                score: 71.6,
                level: "Age Appropriate",
            },
            learning_style: "Visual",
            stress: "low",
        },

        body: {
            visual_acuity: "Normal",
            reaction_time: {
                score: 84.2,
                level: "Good",
            },
            motor_coordination: {
                score: 91.3,
                level: "Strong",
            },
        },

        vitals: {
            heart_rate: 74,
            breathing_rate: 16,

            blood_pressure: {
                systolic: 118,
                diastolic: 77,
                unit: "mmHg",
            },
        },

        emotion: {
            label: "happy",
        },
    }
    useEffect(() => {
        if (!apiReportRaw) {
            setApiReport(null)
            return
        }

        const mappedReport = mapReportToUI(
            apiReportRaw,
            screeningOrder
        )

        setApiReport(
            mergeWithFallback(mappedReport)
        )

        setReportError(reportErrorProp)
    }, [apiReportRaw, screeningOrder, reportErrorProp])

    /* ── derived values ── */
    const finalHeight = storeHeight?.finalHeight || apiReport?.height || 170
    const finalWeight = storeWeight?.finalWeight || apiReport?.weight || 70
    const userName = storeUser?.data?.name || t("bia_result.default_name", "there")

    const formatLabel = (value, fallback = "—") => {
        if (value === null || value === undefined || value === "") {
            return fallback
        }

      

        if (typeof value !== "object") {
            return String(value)
        }

        // score + level object
        if ("score" in value || "level" in value) {
            const parts = []

            if (value.score != null && Number.isFinite(Number(value.score))) {
                parts.push(Number(value.score).toFixed(2))
            }

            if (value.level) {
                parts.push(value.level)
            }

            return parts.length ? parts.join(" • ") : fallback
        }

        // Blood pressure
        if ("systolic" in value || "diastolic" in value) {
            const systolic =
                value.systolic != null
                    ? Number(value.systolic)
                    : "—"

            const diastolic =
                value.diastolic != null
                    ? Number(value.diastolic)
                    : "—"

            return `${systolic}/${diastolic}${value.unit ? ` ${value.unit}` : ""
                }`
        }

        // Generic nested object
        return Object.entries(value)
            .filter(([, v]) => v !== null && v !== undefined && v !== "")
            .map(([key, val]) => {
                const label = key
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())

                return `${label}: ${formatLabel(val, "")}`
            })
            .join(" • ") || fallback
    }

    const learnerType = apiReport?.learner_type?.type
    const learnerStyleLabel = learnerType
        ? learnerType.charAt(0).toUpperCase() + learnerType.slice(1)
        : "Visual"

    const getBoxContent = (screeningOrder, apiReport) => {
        // SCREENING 1
        if (
            screeningOrder === 1 ||
            screeningOrder === "1"
        ) {
            return {
                mind: [
                    {
                        label: "Emotion Regulation",
                        value: formatLabel(
                            apiReport?.emotional_regulation?.level,
                            "Good"
                        )
                    },
                    {
                        label: "Self-Esteem",
                        value: formatLabel(
                            apiReport?.self_esteem?.level,
                            "Well Developed"
                        )
                    },
                    {
                        label: "Personality",
                        value: formatLabel(
                            apiReport?.personality?.animal,
                            "Dominant"
                        )
                    }
                ],

                brain: [
                    {
                        label: "Divided Attention",
                        value: formatLabel(
                            apiReport?.attention?.level,
                            "Good"
                        )
                    },
                    {
                        label: "Cognitive Flexibility",
                        value: formatLabel(
                            apiReport?.memory?.level,
                            "Developing"
                        )
                    },
                    {
                        label: "Learning Style",
                        value: learnerStyleLabel
                    }
                ],

                body: [
                    {
                        label: "Hydration",
                        value: formatLabel(
                            apiReport?.hydration?.level,
                            "Ideal"
                        )
                    },
                    {
                        label: "Muscle Mass",
                        value: formatLabel(
                            apiReport?.muscle_mass?.level,
                            "Ideal"
                        )
                    },
                    {
                        label: "Fat Mass",
                        value: formatLabel(
                            apiReport?.fat_mass?.level,
                            "Low"
                        )
                    }
                ],

                vitals: vitalsRows
            }
        }

        // SCREENING 2
        if (
            screeningOrder === 2 ||
            screeningOrder === "2"
        ) {
            return {
                mind: [
                    {
                        label: "Short Term Recall",
                        value: formatLabel(
                            apiReport?.mind?.short_term_recall?.level ??
                            apiReport?.mind?.short_term_recall,
                            "Developing"
                        )
                    },
                    {
                        label: "Fine Motor Skills",
                        value: formatLabel(
                            apiReport?.mind?.fine_motor_skills?.level ??
                            apiReport?.mind?.fine_motor_skills,
                            "Strong"
                        )
                    },
                    {
                        label: "Visual Spatial Judgement",
                        value: formatLabel(
                            apiReport?.mind?.visual_spatial_judgement?.level ??
                            apiReport?.mind?.visual_spatial_judgement,
                            "Strong"
                        )
                    }
                ],

                brain: [
                    {
                        label: "Musical Preference",
                        value: formatLabel(
                            apiReport?.brain?.musical_preference?.level ??
                            apiReport?.brain?.musical_preference,
                            "Strong"
                        )
                    },
                    {
                        label: "Learning Style",
                        value: formatLabel(
                            apiReport?.brain?.learning_style,
                            "Reader"
                        )
                    },
                    {
                        label: "Stress",
                        value: formatLabel(
                            apiReport?.brain?.stress,
                            "Low"
                        )
                    }
                ],

                body: [
                    {
                        label: "Visual Acuity",
                        value: formatLabel(
                            apiReport?.body?.visual_acuity,
                            "Good"
                        )
                    },
                    {
                        label: "Reaction Time",
                        value: formatLabel(
                            apiReport?.body?.reaction_time?.level ??
                            apiReport?.body?.reaction_time,
                            "Strong"
                        )
                    },
                    {
                        label: "Motor Coordination",
                        value: formatLabel(
                            apiReport?.body?.motor_coordination?.level ??
                            apiReport?.body?.motor_coordination,
                            "Developing"
                        )
                    }
                ],

                vitals: [
                    {
                        label: "Heart Rate",
                        value: apiReport?.vitals?.heart_rate != null
                            ? `${apiReport.vitals.heart_rate} bpm`
                            : "—"
                    },
                    {
                        label: "Breathing Rate",
                        value: apiReport?.vitals?.breathing_rate != null
                            ? `${apiReport.vitals.breathing_rate} breaths/min`
                            : "—"
                    },
                    {
                        label: "BP",
                        value: formatLabel(
                            apiReport?.vitals?.blood_pressure,
                            "—"
                        )
                    }
                ]
            }
        }

        return {
            mind: [],
            brain: [],
            body: [],
            vitals: []
        }
    }

    const boxContent = getBoxContent(
        screeningOrder,
        apiReport
    )

    // /* ── vitals display values: real reading if present, otherwise the
    //      stable per-mount random fallback ── */
    // const heartRateDisplay = apiReport?.vitals?.heart_rate ?? randomVitalsRef.current.heart_rate
    // const breathingRateDisplay = apiReport?.vitals?.breathing_rate ?? randomVitalsRef.current.breathing_rate
    // const stressDisplay = apiReport?.vitals?.stress ?? randomVitalsRef.current.stress
    // const bpSystolicDisplay = apiReport?.vitals?.blood_pressure?.systolic ?? randomVitalsRef.current.systolic
    // const bpDiastolicDisplay = apiReport?.vitals?.blood_pressure?.diastolic ?? randomVitalsRef.current.diastolic
    // const bpCategoryDisplay = apiReport?.vitals?.blood_pressure?.category ?? randomVitalsRef.current.bp_category

    /* ────────────────────────────────────────────
       RENDER
    ──────────────────────────────────────────── */
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                overflow: "hidden",
                background: "#000",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center"
            }}
        >
            <div
                ref={innerRef}
                style={{
                    width: `${DESIGN_W}px`,
                    transformOrigin: "top center",
                    transform: `scale(${scale})`,
                    flexShrink: 0
                }}
            >
                {/* Background layer — Figma "image 1190", 50% opacity, oversized/cropped */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 0,
                        overflow: "hidden"
                    }}
                >
                    <img
                        src={bgTexture}
                        alt=""
                        style={{
                            position: "absolute",
                            top: "-9px",
                            left: "-5px",
                            width: "109%",
                            opacity: 0.5,
                            objectFit: "cover"
                        }}
                    />
                </div>

                {/* Page content */}
                <div
                    style={{
                        position: "relative",
                        zIndex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        padding: "60px 40px 40px",
                        gap: "48px"
                    }}
                >
                    {/* Title */}
                    <h1
                        style={{
                            fontFamily: FONT,
                            fontSize: "60px",
                            color: "#fff",
                            textAlign: "center",
                            lineHeight: 1.25,
                            width: "1220px",
                            maxWidth: "100%",
                            filter: "drop-shadow(0px 4px 2px rgba(0,0,0,0.6))"
                        }}
                    >
                        {t(
                            "bia_result.congratulations_named",
                            `Congratulations ${userName}, Here are your results`
                        )}
                    </h1>

                    {/* Prakriti / dosha chart */}
                    <div style={{ width: "717px", maxWidth: "100%" }}>
                        <BodyConstitution
                            vata={apiReport?.body_constitution?.vata}
                            pitta={apiReport?.body_constitution?.pitta}
                            kapha={apiReport?.body_constitution?.kapha}
                        />
                    </div>

                    {/* Height / Weight row */}
                    <div className="flex w-full" style={{ gap: "24px" }}>
                        {[
                            {
                                label: t("bia_result.height"),
                                value:
                                    finalHeight != null ? parseFloat(finalHeight).toFixed(2) : "–",
                                unit: "cm",
                                icon: HeightIcon
                            },
                            {
                                label: t("bia_result.weight"),
                                value:
                                    finalWeight != null ? parseFloat(finalWeight).toFixed(2) : "–",
                                unit: "kg",
                                icon: WeightIcon
                            }
                        ].map((item) => (
                            <div
                                key={item.label}
                                className="flex flex-1 items-center justify-center"
                                style={{ ...pill, gap: "16px", padding: "28px" }}
                            >
                                <img
                                    src={item.icon}
                                    alt=""
                                    style={{ width: "36px", height: "36px" }}
                                    className="object-contain shrink-0"
                                />
                                <p
                                    className="text-white whitespace-nowrap"
                                    style={{ fontFamily: FONT, fontSize: "40px" }}
                                >
                                    {item.label}:
                                </p>
                                <p
                                    className="whitespace-nowrap"
                                    style={{ fontFamily: FONT, fontSize: "42px", color: "#FF9D5C" }}
                                >
                                    {item.value} {item.unit}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Mind + Brain row */}
                    <div className="flex w-full" style={{ gap: "24px" }}>
                        <StatCard
                            title="Mind"
                            icon={<MindIcon style={{ width: "100%", height: "100%" }} />}
                            color="#29ABE2"
                            rows={boxContent.mind}
                        />
                        <StatCard
                            title="Brain"
                            icon={<BrainIconS style={{ width: "100%", height: "100%" }} />}
                            color="#2CEF94"
                            rows={boxContent.brain}
                        />
                    </div>

                    {/* Body + Vitals row */}
                    <div className="flex w-full" style={{ gap: "24px" }}>
                        <StatCard
                            title="Body"
                            icon={
                                <img
                                    src={BodyIcon}
                                    alt=""
                                    className="w-full h-full object-contain"
                                />
                            }
                            color="#FF9D5C"
                            rows={boxContent.body}
                        />
                        <StatCard
                            title="Vitals"
                            icon={
                                <img
                                    src={vitalsIcon}
                                    alt=""
                                    className="w-full h-full object-contain"
                                />
                            }
                            color="#EA73FF"
                            rows={boxContent.vitals}
                        />
                    </div>

                    {/* Color Blindness + Emotion pills */}
                    <div className="flex flex-col w-full" style={{ gap: "24px" }}>
                        {screeningOrder !== 2 && screeningOrder !== "2" && (
                            <InfoPill
                                icon={
                                    <img
                                        src={Eye_Icon}
                                        alt=""
                                        className="w-full h-full object-contain"
                                    />
                                }
                                label="Color Blindness"
                                value={formatColorBlindness(
                                    apiReport?.color_blindness?.result,
                                    apiReport?.color_blindness?.deficiency_type
                                )}
                                color="#FFE15C"
                            />
                        )}
                        <InfoPill
                            icon={<p className="text-4xl">😌</p>}
                            label="Emotion"
                            value={formatLabel(
                                apiReport?.emotion?.label === "neutral"
                                    ? "Calm"
                                    : apiReport?.emotion?.label
                            )}
                            color="#FFE15C"
                        />
                    </div>

                    <button
                        onClick={() => {
                            releaseAllResources()
                            navigate("/welcome")
                        }}
                        className="flex items-center justify-center cursor-pointer"
                        style={{
                            ...pill,
                            padding: "28px 86px",
                            borderRadius: "28px"
                        }}
                    >
                        <span
                            className="text-white whitespace-nowrap"
                            style={{ fontFamily: FONT, fontSize: "60px" }}
                        >
                            {t("bia_result.go_to_homepage")}
                        </span>
                    </button>
                    {/* QR + download report */}
                    <div className="flex items-center justify-center" style={{ gap: "28px" }}>
                        <p
                            className="text-white"
                            style={{ fontFamily: FONT, fontSize: "35px", maxWidth: "716px" }}
                        >
                            {t(
                                "bia_result.download_report",
                                "Download SUHI Holistic Wellness report for more details."
                            )}
                        </p>
                        <img
                            src={qrCode}
                            alt="QR Code"
                            style={{ width: "134px", height: "134px" }}
                        />
                    </div>

                    {/* CTA */}
                </div>
            </div>
        </div>
    )
}

export default Result
