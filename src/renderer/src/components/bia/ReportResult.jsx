import { useEffect, useState, useRef, useCallback } from 'react'
import BodyIcon from '../../assets/bia/BodyIcon.svg'
import WeightIcon from '../../assets/bia/weight.svg'
import HeightIcon from '../../assets/bia/height.svg'
import Eye_Icon from '../../assets/bia/Eye_Icon.svg'
import bgTexture from '../../assets/lightbg.png'
import qrCode from '../../assets/bia/qr-code.png'
import vitalsIcon from '../../assets/bia/vitals.png'
import { useNavigate } from 'react-router'
import { useSelector } from 'react-redux'
import axios from 'axios'
import BodyConstitution from './BodyConstitution'
import { useTranslation } from 'react-i18next'
import { releaseAllResources } from '../../utils/cleanup'
import { BrainIconS, MindIcon } from '../../assets'
import { API_BASE_URL } from '../../utils/config'

/* ─────────────────────────────────────────────────────────────
   KIOSK SCALING STRATEGY
   Target screen : 1402 × 1802 px (portrait kiosk, no scrolling ever)
   Render at DESIGN_W, measure natural height, scale down to fit.
───────────────────────────────────────────────────────────── */
const DESIGN_W = 1402
const FONT = "'Anta', sans-serif"

/* ── Liquid-glass pill shared styling ── */
const pill = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '28px',
    boxShadow: '0px 3.58px 28.62px #9ad9ff',
    background:
        'rgba(82,82,82,0.3) padding-box, linear-gradient(135.77deg, rgba(255,255,255,0.1), rgba(255,255,255,0)) border-box',
    border: '1.4px solid transparent',
    backdropFilter: 'blur(35px)',
    WebkitBackdropFilter: 'blur(35px)',
}

const pillRow = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    padding: '20px 24px',
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

/**
 * Returns true only when v is a real, displayable value.
 * null / undefined / '' all return false.
 */
const hasValue = (v) => v !== null && v !== undefined && v !== ''

/**
 * Builds the blood pressure display string from whatever sub-fields
 * are present. Systolic is guaranteed non-null when this is called.
 *   126/82 mmHg (Elevated)   — all three present
 *   126/82 mmHg              — no category
 *   126 mmHg (Elevated)      — no diastolic
 *   126 mmHg                 — only systolic
 */
const buildBPString = (bp) => {
    const nums = hasValue(bp?.diastolic)
        ? `${bp.systolic}/${bp.diastolic} mmHg`
        : `${bp.systolic} mmHg`
    return hasValue(bp?.category) ? `${nums} (${bp.category})` : nums
}

/**
 * Maps the raw API response to the normalized UI shape.
 * Returns null when api is falsy.
 *
 * Backend shape (single fetch):
 *   api.data.bia            → height_cm, weight_kg, hydration, muscle_mass, fat_mass
 *   api.data.prakriti       → vata, pitta, kapha
 *   api.data.learning_style → string
 *   api.data.personality    → string
 *   api.data.divided_attention → string   (NOT api.data.attention)
 *   api.data.cognitive_flexibility → string (NOT api.data.memory)
 *   api.data.self_esteem    → { level }
 *   api.data.emotional_regulation → { level }
 *   api.data.color_blindness → string
 *   api.data.heart_rate     → { heart_rate, stress_category }
 *   api.data.breathing_rate → { breathing_rate }
 *   api.data.blood_pressure → { systolic, diastolic, category }
 *   api.data.facial_emotion → { dominant_emotion, sub_dominant_emotion, masked_emotion }
 */
const mapReportToUI = (api) => {
    if (!api) return null
    const d = api.data

    return {
        /* ── measurements ── */
        height: d?.bia?.height_cm ?? null,
        weight: d?.bia?.weight_kg ?? null,

        /* ── ayurveda ── */
        body_constitution: d?.prakriti
            ? { vata: d.prakriti.vata, pitta: d.prakriti.pitta, kapha: d.prakriti.kapha }
            : null,

        /* ── body ── */
        hydration: d?.bia?.hydration ? { level: d.bia.hydration } : null,
        muscle_mass: d?.bia?.muscle_mass ? { level: d.bia.muscle_mass.status } : null,
        fat_mass: d?.bia?.fat_mass ? { level: d.bia.fat_mass.status } : null,

        /* ── brain ── */
        learner_type: d?.learning_style
            ? { type: d.learning_style.toLowerCase(), title: d.learning_style }
            : null,
        // backend key is divided_attention, not attention
        attention: d?.divided_attention ? { level: d.divided_attention } : null,
        // backend key is cognitive_flexibility, not memory
        memory: d?.cognitive_flexibility ? { level: d.cognitive_flexibility } : null,

        /* ── mind ── */
        personality: d?.personality ? { animal: d.personality } : null,
        self_esteem: d?.self_esteem ?? null,
        emotional_regulation: d?.emotional_regulation ?? null,

        /* ── eye ── */
        color_blindness: d?.color_blindness ? { status: d.color_blindness } : null,

        /* ── vitals — each sub-field null-safe independently ── */
        vitals: {
            heart_rate: d?.heart_rate?.heart_rate != null
                ? Math.round(d.heart_rate.heart_rate)
                : null,
            breathing_rate: d?.breathing_rate?.breathing_rate != null
                ? Math.round(d.breathing_rate.breathing_rate)
                : null,
            stress: d?.heart_rate?.stress_category ?? null,
            blood_pressure: d?.blood_pressure
                ? {
                    systolic: d.blood_pressure.systolic != null ? Math.round(d.blood_pressure.systolic) : null,
                    diastolic: d.blood_pressure.diastolic != null ? Math.round(d.blood_pressure.diastolic) : null,
                    category: d.blood_pressure.category ?? null,
                }
                : null,
        },

        /* ── emotion ── */
        emotion: d?.facial_emotion?.dominant_emotion
            ? { label: d.facial_emotion.dominant_emotion }
            : null,
    }
}

/**
 * Merges a mapped API result with safe fallbacks for fields that
 * must always render (height, weight, body constitution).
 * Vitals and emotion are NOT fallback-filled — they gate their own
 * sections and simply won't render when null.
 */
const mergeWithFallback = (mapped) => ({
    height: mapped?.height ?? 170,
    weight: mapped?.weight ?? 70,
    body_constitution: mapped?.body_constitution ?? { vata: 34, pitta: 40, kapha: 26 },

    hydration: mapped?.hydration ?? { level: 'Ideal' },
    muscle_mass: mapped?.muscle_mass ?? { level: 'Ideal' },
    fat_mass: mapped?.fat_mass ?? { level: 'Low' },

    learner_type: mapped?.learner_type ?? { type: 'visual', title: 'Visual' },
    attention: mapped?.attention ?? { level: 'Good' },
    memory: mapped?.memory ?? { level: 'Developing' },

    personality: mapped?.personality ?? { animal: 'Dominant' },
    self_esteem: mapped?.self_esteem ?? { level: 'Well Developed' },
    emotional_regulation: mapped?.emotional_regulation ?? { level: 'Good' },

    color_blindness: mapped?.color_blindness ?? { status: 'Not present' },

    // vitals — no fallback, sections hide when null
    vitals: mapped?.vitals ?? {
        heart_rate: null,
        breathing_rate: null,
        stress: null,
        blood_pressure: null,
    },

    // emotion — no fallback, pill hides when null
    emotion: mapped?.emotion ?? null,
})

/* ─────────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────────── */

/** Stat card: icon + title + dynamic rows (only rows with real values) */
const StatCard = ({ title, icon, color, rows }) => (
    <div
        className="flex flex-col items-center rounded-[28px]"
        style={{ ...pill, flex: 1, padding: '28px 16px', gap: '16px' }}
    >
        <div className="flex items-center justify-center" style={{ gap: '16px' }}>
            <span
                className="flex items-center justify-center shrink-0"
                style={{ width: '48px', height: '48px' }}
            >
                {icon}
            </span>
            <h3
                className="leading-none tracking-[0.04em]"
                style={{ fontFamily: FONT, fontSize: '48px', color }}
            >
                {title}
            </h3>
        </div>

        <div className="flex flex-col w-full" style={{ gap: '12px' }}>
            {rows.map((row) => (
                <div
                    key={row.label}
                    className="flex items-center justify-center w-full"
                    style={{ ...pillRow, gap: '12px' }}
                >
                    <p
                        className="text-white text-center whitespace-nowrap"
                        style={{ fontFamily: FONT, fontSize: '28px' }}
                    >
                        {row.label}:
                    </p>
                    <p
                        className="text-center whitespace-nowrap"
                        style={{ fontFamily: FONT, fontSize: '36px', color }}
                    >
                        {row.value}
                    </p>
                </div>
            ))}
        </div>
    </div>
)

/** Full-width single-row pill — only rendered when parent decides value is present */
const InfoPill = ({ icon, label, value, color }) => (
    <div
        className="flex items-center justify-center w-full"
        style={{ ...pill, gap: '16px', padding: '24px' }}
    >
        <span
            className="flex items-center justify-center shrink-0"
            style={{ width: '40px', height: '40px' }}
        >
            {icon}
        </span>
        <p className="text-white whitespace-nowrap" style={{ fontFamily: FONT, fontSize: '36px' }}>
            {label}:
        </p>
        <p className="whitespace-nowrap" style={{ fontFamily: FONT, fontSize: '38px', color }}>
            {value}
        </p>
    </div>
)

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
const ReportResult = () => {
    const navigate = useNavigate()
    const storeWeight = useSelector((s) => s.common.weight)
    const storeHeight = useSelector((s) => s.common.height)
    const storeUser = useSelector((s) => s.common.user)
    const screening = useSelector((s) => s.common.screening)
    const { t } = useTranslation()

    const [report, setReport] = useState(null)   // normalized, fallback-merged
    const [reportError, setReportError] = useState(false)
    const [loading, setLoading] = useState(true)

    const innerRef = useRef(null)
    const [scale, setScale] = useState(1)

    /* ── kiosk scale ── */
    const recomputeScale = useCallback(() => {
        const el = innerRef.current
        if (!el) return
        const scaleByH = window.innerHeight / el.scrollHeight
        const scaleByW = window.innerWidth / DESIGN_W
        setScale(Math.min(scaleByH, scaleByW, 1))
    }, [])

    useEffect(() => {
        const el = innerRef.current
        if (!el) return
        const ro = new ResizeObserver(recomputeScale)
        ro.observe(el)
        recomputeScale()
        window.addEventListener('resize', recomputeScale)
        return () => { ro.disconnect(); window.removeEventListener('resize', recomputeScale) }
    }, [recomputeScale])

    useEffect(() => {
        if (report) requestAnimationFrame(() => requestAnimationFrame(recomputeScale))
    }, [report, recomputeScale])

    /* ── single API fetch ── */
    useEffect(() => {
        const fetchReport = async () => {
            setReportError(false)
            setLoading(true)
            try {
                const res = await axios.post(`${API_BASE_URL}/report/`, {
                    user_id: storeUser?.data?.user_id,
                    session_id: screening?.sessionId,
                    screening_session_id: screening?.sessionId,
                })
                if (res?.data?.success) {
                    setReport(mergeWithFallback(mapReportToUI(res.data)))
                } else {
                    console.warn('[HealthResult] success:false', res?.data)
                    setReportError(true)
                }
            } catch (err) {
                console.error('[HealthResult] fetch failed:', err)
                setReportError(true)
            } finally {
                setLoading(false)
            }
        }

        const timer = setTimeout(fetchReport, 0)
        return () => clearTimeout(timer)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    /* ─────────────────────────────────────────────────────────
       DERIVED VALUES
    ───────────────────────────────────────────────────────── */
    const finalHeight = storeHeight?.finalHeight || report?.height || 170
    const finalWeight = storeWeight?.finalWeight || report?.weight || 70
    const userName = storeUser?.data?.name || t('bia_result.default_name', 'there')

    const learnerStyleLabel = report?.learner_type?.type
        ? report.learner_type.type.charAt(0).toUpperCase() + report.learner_type.type.slice(1)
        : 'Visual'

    /* ── vitals: build rows only for fields that actually have values ── */
    const vitalsRows = [
        hasValue(report?.vitals?.heart_rate) && {
            label: 'Heart Rate',
            value: `${report.vitals.heart_rate} bpm`,
        },
        hasValue(report?.vitals?.breathing_rate) && {
            label: 'Breathing Rate',
            value: `${report.vitals.breathing_rate} breaths/min`,
        },
        hasValue(report?.vitals?.blood_pressure?.systolic) && {
            label: 'Blood Pressure',
            value: buildBPString(report.vitals.blood_pressure),
        },
        hasValue(report?.vitals?.stress) && {
            label: 'Stress',
            value: report.vitals.stress,
        },
    ].filter(Boolean)

    /* Show Vitals card only if at least one row has real data */
    const showVitals = vitalsRows.length > 0

    /* Show Emotion pill only if dominant_emotion is present */
    const showEmotion = hasValue(report?.emotion?.label)

    /* ─────────────────────────────────────────────────────────
       LOADING / ERROR STATES
    ───────────────────────────────────────────────────────── */
    if (loading) {
        return (
            <div
                style={{
                    position: 'fixed', inset: 0, background: '#000',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
            >
                <p style={{ fontFamily: FONT, fontSize: '48px', color: '#fff' }}>
                    Loading your results…
                </p>
            </div>
        )
    }

    /* ─────────────────────────────────────────────────────────
       RENDER
    ───────────────────────────────────────────────────────── */
    return (
        <div
            style={{
                position: 'fixed', inset: 0, overflow: 'hidden',
                background: '#000', display: 'flex',
                alignItems: 'flex-start', justifyContent: 'center',
            }}
        >
            <div
                ref={innerRef}
                style={{
                    width: `${DESIGN_W}px`,
                    transformOrigin: 'top center',
                    transform: `scale(${scale})`,
                    flexShrink: 0,
                }}
            >
                {/* ── Background texture ── */}
                <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
                    <img
                        src={bgTexture}
                        alt=""
                        style={{
                            position: 'absolute', top: '-9px', left: '-5px',
                            width: '109%', opacity: 0.5, objectFit: 'cover',
                        }}
                    />
                </div>

                {/* ── Page content ── */}
                <div
                    style={{
                        position: 'relative', zIndex: 1,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center',
                        padding: '60px 40px 40px', gap: '48px',
                    }}
                >
                    {/* Title */}
                    <h1
                        style={{
                            fontFamily: FONT, fontSize: '60px', color: '#fff',
                            textAlign: 'center', lineHeight: 1.25,
                            width: '1220px', maxWidth: '100%',
                            filter: 'drop-shadow(0px 4px 2px rgba(0,0,0,0.6))',
                        }}
                    >
                        {t('bia_result.congratulations_named', `Congratulations ${userName}, Here are your results`)}
                    </h1>

                    {/* Prakriti / dosha chart */}
                    <div style={{ width: '717px', maxWidth: '100%' }}>
                        <BodyConstitution
                            vata={report?.body_constitution?.vata}
                            pitta={report?.body_constitution?.pitta}
                            kapha={report?.body_constitution?.kapha}
                        />
                    </div>

                    {/* Height / Weight row */}
                    <div className="flex w-full" style={{ gap: '24px' }}>
                        {[
                            { label: t('bia_result.height'), value: Math.round(finalHeight), unit: 'cm', icon: HeightIcon },
                            { label: t('bia_result.weight'), value: Math.round(finalWeight), unit: 'kg', icon: WeightIcon },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className="flex flex-1 items-center justify-center"
                                style={{ ...pill, gap: '16px', padding: '28px' }}
                            >
                                <img
                                    src={item.icon} alt=""
                                    style={{ width: '36px', height: '36px' }}
                                    className="object-contain shrink-0"
                                />
                                <p className="text-white whitespace-nowrap" style={{ fontFamily: FONT, fontSize: '40px' }}>
                                    {item.label}:
                                </p>
                                <p className="whitespace-nowrap" style={{ fontFamily: FONT, fontSize: '42px', color: '#FF9D5C' }}>
                                    {item.value} {item.unit}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Mind + Brain row */}
                    <div className="flex w-full" style={{ gap: '24px' }}>
                        <StatCard
                            title="Mind"
                            icon={<MindIcon style={{ width: '100%', height: '100%' }} />}
                            color="#29ABE2"
                            rows={[
                                { label: 'Emotion Regulation', value: report?.emotional_regulation?.level ?? 'Good' },
                                { label: 'Self-Esteem', value: report?.self_esteem?.level ?? 'Well Developed' },
                                { label: 'Personality', value: report?.personality?.animal ?? 'Dominant' },
                            ]}
                        />
                        <StatCard
                            title="Brain"
                            icon={<BrainIconS style={{ width: '100%', height: '100%' }} />}
                            color="#2CEF94"
                            rows={[
                                { label: 'Attention', value: report?.attention?.level ?? 'Good' },
                                { label: 'Memory', value: report?.memory?.level ?? 'Developing' },
                                { label: 'Learning Style', value: learnerStyleLabel },
                            ]}
                        />
                    </div>

                    {/* Body + Vitals row
                        — if no vitals data: Body card spans full width
                        — if vitals present:  side-by-side with only populated rows
                    */}
                    <div className="flex w-full" style={{ gap: '24px' }}>
                        <StatCard
                            title="Body"
                            icon={<img src={BodyIcon} alt="" className="w-full h-full object-contain" />}
                            color="#FF9D5C"
                            rows={[
                                { label: 'Hydration', value: report?.hydration?.level ?? 'Ideal' },
                                { label: 'Muscle Mass', value: report?.muscle_mass?.level ?? 'Ideal' },
                                { label: 'Fat Mass', value: report?.fat_mass?.level ?? 'Low' },
                            ]}
                        />

                        {showVitals && (
                            <StatCard
                                title="Vitals"
                                icon={<img src={vitalsIcon} alt="" className="w-full h-full object-contain" />}
                                color="#EA73FF"
                                rows={vitalsRows}
                            />
                        )}
                    </div>

                    {/* Color Blindness pill — always shown (has fallback) */}
                    <div className="flex flex-col w-full" style={{ gap: '24px' }}>
                        <InfoPill
                            icon={<img src={Eye_Icon} alt="" className="w-full h-full object-contain" />}
                            label="Color Blindness"
                            value={report?.color_blindness?.status ?? 'Not present'}
                            color="#FFE15C"
                        />

                        {/* Emotion pill — only rendered when dominant_emotion is present */}
                        {showEmotion && (
                            <InfoPill
                                icon={<p className="text-4xl">😌</p>}
                                label="Emotion"
                                value={report.emotion.label}
                                color="#FFE15C"
                            />
                        )}
                    </div>

                    {/* Go to homepage CTA */}
                    <button
                        onClick={() => { releaseAllResources(); navigate('/welcome') }}
                        className="flex items-center justify-center cursor-pointer"
                        style={{ ...pill, padding: '28px 86px', borderRadius: '28px' }}
                    >
                        <span className="text-white whitespace-nowrap" style={{ fontFamily: FONT, fontSize: '60px' }}>
                            {t('bia_result.go_to_homepage')}
                        </span>
                    </button>

                    {/* QR + download report */}
                    <div className="flex items-center justify-center" style={{ gap: '28px' }}>
                        <p
                            className="text-white"
                            style={{ fontFamily: FONT, fontSize: '35px', maxWidth: '716px' }}
                        >
                            {t('bia_result.download_report', 'Download Suhi Holistic Wellness report for more details')}
                        </p>
                        <img src={qrCode} alt="QR Code" style={{ width: '134px', height: '134px' }} />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ReportResult