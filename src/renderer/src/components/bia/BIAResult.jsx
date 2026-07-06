import { useEffect, useState, useRef, useCallback } from 'react'
import BodyIcon from '../../assets/bia/BodyIcon.svg'
import WeightIcon from '../../assets/bia/weight.svg'
import HeightIcon from '../../assets/bia/height.svg'
import Eye_Icon from '../../assets/bia/Eye_Icon.svg'
import bgTexture from '../../assets/lightbg.png' // TODO: save Figma "image 1190" asset locally
// import qrCode from '../../assets/bia/qr-code.png'        // TODO: save Figma "QR Code" asset locally
// import emotionIcon from '../../assets/bia/emotion.svg'   // TODO: save Figma "😌" asset locally
// import vitalsIcon from '../../assets/bia/vitals.svg'     // TODO: save Figma "🫀" asset locally
import { useNavigate } from 'react-router'
import { useSelector } from 'react-redux'
import axios from "axios"
import BodyConstitution from './BodyConstitution'
import { useTranslation } from 'react-i18next'
import { releaseAllResources } from '../../utils/cleanup'
import { BrainIconS, MindIcon } from '../../assets'
import { API_BASE_URL } from '../../utils/config';

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
    background: 'rgba(0,0,0,0.55)',
    border: '1.5px solid rgba(255,255,255,0.3)',
    borderRadius: '28px',
    boxShadow: '0 4px 28px 0 rgba(154,217,255,0.35)',
    backdropFilter: 'blur(12px)',
}

const pillRow = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    padding: '20px 24px',
}

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
            padding: '28px 16px',
            gap: '16px',
        }}
    >
        <div className="flex items-center justify-center" style={{ gap: '16px' }}>
            <span className="flex items-center justify-center shrink-0" style={{ width: '48px', height: '48px' }}>
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

/* Full-width single-row pill (Color Blindness / Emotion) */
const InfoPill = ({ icon, label, value, color }) => (
    <div
        className="flex items-center justify-center w-full"
        style={{ ...pill, gap: '16px', padding: '24px' }}
    >
        <span className="flex items-center justify-center shrink-0" style={{ width: '40px', height: '40px' }}>
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

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
const BIAResult = () => {
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
        window.addEventListener('resize', recomputeScale)
        return () => {
            ro.disconnect()
            window.removeEventListener('resize', recomputeScale)
        }
    }, [recomputeScale])

    useEffect(() => {
        if (apiReport) {
            requestAnimationFrame(() => requestAnimationFrame(recomputeScale))
        }
    }, [apiReport, recomputeScale])

    /* ── Fallback / merge helpers ── */
    const fallbackPartialJson = {
        height: 170, weight: 70,
        body_constitution: { vata: 34, pitta: 40, kapha: 26 },
        hydration: { level: 'Ideal' },
        learner_type: { type: 'visual', title: 'Visual' },
        personality: { animal: 'Dominant', traits: ['Calm', 'Adaptive', 'Focused'] },
        attention: { level: 'Good' },
        memory: { level: 'Developing' },
        self_esteem: { level: 'Well Developed' },
        emotional_regulation: { level: 'Good' },
        color_blindness: { status: 'Not present' },
        muscle_mass: { level: 'Ideal' },
        fat_mass: { level: 'Low' },
        vitals: { heart_rate: '--', breathing_rate: '--', stress: 'Low' },
        emotion: { label: 'Happy' },
    }

    const mergeWithFallback = (api) => ({
        height: api?.height ?? fallbackPartialJson.height,
        weight: api?.weight ?? fallbackPartialJson.weight,
        body_constitution: api?.body_constitution ?? fallbackPartialJson.body_constitution,
        hydration: api?.hydration ?? fallbackPartialJson.hydration,
        learner_type: api?.learner_type ?? fallbackPartialJson.learner_type,
        personality: api?.personality ?? fallbackPartialJson.personality,
        attention: api?.attention ?? fallbackPartialJson.attention,
        memory: api?.memory ?? fallbackPartialJson.memory,
        self_esteem: api?.self_esteem ?? fallbackPartialJson.self_esteem,
        emotional_regulation: api?.emotional_regulation ?? fallbackPartialJson.emotional_regulation,
        color_blindness: api?.color_blindness ?? fallbackPartialJson.color_blindness,
        muscle_mass: api?.muscle_mass ?? fallbackPartialJson.muscle_mass,
        fat_mass: api?.fat_mass ?? fallbackPartialJson.fat_mass,
        vitals: api?.vitals ?? fallbackPartialJson.vitals,
        emotion: api?.emotion ?? fallbackPartialJson.emotion,
    })

    const mapReportToUI = (api) => {
        if (!api) return null
        const d = api.data
        return {
            height: d?.bia?.height_cm ?? null,
            weight: d?.bia?.weight_kg ?? null,
            body_constitution: d?.prakriti ? { vata: d.prakriti.vata, pitta: d.prakriti.pitta, kapha: d.prakriti.kapha } : null,
            hydration: d?.bia?.hydration ? { level: d.bia.hydration } : null,
            learner_type: d?.learning_style ? { type: d.learning_style.toLowerCase(), title: d.learning_style } : null,
            personality: d?.personality ? { animal: d.personality, traits: [d.personality] } : null,
            attention: d?.attention,
            memory: d?.memory,
            self_esteem: d?.self_esteem,
            emotional_regulation: d?.emotional_regulation,
            color_blindness: d?.color_blindness ? { status: d.color_blindness } : null,
            muscle_mass: { level: d?.bia?.muscle_mass?.status },
            fat_mass: { level: d?.bia?.fat_mass?.status },
            // NOTE: backend does not yet return vitals/emotion — wire these up once available
            vitals: d?.vitals ? {
                heart_rate: d.vitals.heart_rate,
                breathing_rate: d.vitals.breathing_rate,
                stress: d.vitals.stress,
            } : null,
            emotion: d?.emotion ? { label: d.emotion } : null,
        }
    }

    const fetchBiometricReport = async () => {
        setReportError(false)
        try {
            const sessionId = screening?.sessionId
            const userId = storeUser?.data?.user_id
            const res = await axios.post(`${API_BASE_URL}/report/`, {
                user_id: userId,
                session_id: sessionId,
                screening_session_id: sessionId,
            })
            if (res?.data?.success) {
                setApiReport(mergeWithFallback(mapReportToUI(res.data)))
                return
            }
            console.warn('[BIAResult] Report API returned success:false', res?.data)
            setReportError(true)
        } catch (err) {
            console.error('[BIAResult] Report fetch failed:', err)
            setReportError(true)
        }
    }

    useEffect(() => {
        const timer = setTimeout(fetchBiometricReport, 0)
        return () => clearTimeout(timer)
    }, [])

    /* ── derived values ── */
    const finalHeight = storeHeight?.finalHeight || apiReport?.height || 170
    const finalWeight = storeWeight?.finalWeight || apiReport?.weight || 70
    const userName = storeUser?.data?.name || t('bia_result.default_name', 'there')

    const formatLabel = (v, fallback = 'Not Available') =>
        (v === null || v === undefined || v === '') ? fallback : String(v)

    const learnerType = apiReport?.learner_type?.type
    const learnerStyleLabel = learnerType
        ? learnerType.charAt(0).toUpperCase() + learnerType.slice(1)
        : 'Visual'

    /* ────────────────────────────────────────────
       RENDER
    ──────────────────────────────────────────── */
    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                overflow: 'hidden',
                background: '#000',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
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
                {/* Background layer — Figma "image 1190", 50% opacity, oversized/cropped */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 0,
                        overflow: 'hidden',
                    }}
                >
                    <img
                        src={bgTexture}
                        alt=""
                        style={{
                            position: 'absolute',
                            top: '-9px',
                            left: '-5px',
                            width: '109%',
                            opacity: 0.5,
                            objectFit: 'cover',
                        }}
                    />
                </div>

                {/* Page content */}
                <div
                    style={{
                        position: 'relative',
                        zIndex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '60px 40px 40px',
                        gap: '48px',
                    }}
                >
                    {/* Title */}
                    <h1
                        style={{
                            fontFamily: FONT,
                            fontSize: '60px',
                            color: '#fff',
                            textAlign: 'center',
                            lineHeight: 1.25,
                            width: '1220px',
                            maxWidth: '100%',
                            filter: 'drop-shadow(0px 4px 2px rgba(0,0,0,0.6))',
                        }}
                    >
                        {t('bia_result.congratulations_named', `Congratulations ${userName}, Here are your results`)}
                    </h1>

                    {/* Prakriti / dosha chart */}
                    <div style={{ width: '717px', maxWidth: '100%' }}>
                        <BodyConstitution
                            vata={apiReport?.body_constitution?.vata}
                            pitta={apiReport?.body_constitution?.pitta}
                            kapha={apiReport?.body_constitution?.kapha}
                        />
                    </div>

                    {/* Height / Weight row */}
                    <div className="flex w-full" style={{ gap: '24px' }}>
                        {[
                            { label: t('bia_result.height'), value: finalHeight != null ? Math.round(finalHeight) : '–', unit: 'cm', icon: HeightIcon },
                            { label: t('bia_result.weight'), value: finalWeight != null ? Math.round(finalWeight) : '–', unit: 'kg', icon: WeightIcon },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className="flex flex-1 items-center justify-center"
                                style={{ ...pill, gap: '16px', padding: '28px' }}
                            >
                                <img src={item.icon} alt="" style={{ width: '36px', height: '36px' }} className="object-contain shrink-0" />
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
                                { label: 'Emotion Regulation', value: formatLabel(apiReport?.emotional_regulation?.level, 'Good') },
                                { label: 'Self-Esteem', value: formatLabel(apiReport?.self_esteem?.level, 'Well Developed') },
                                { label: 'Personality', value: formatLabel(apiReport?.personality?.animal, 'Dominant') },
                            ]}
                        />
                        <StatCard
                            title="Brain"
                            icon={<BrainIconS style={{ width: '100%', height: '100%' }} />}
                            color="#2CEF94"
                            rows={[
                                { label: 'Attention', value: formatLabel(apiReport?.attention?.level, 'Good') },
                                { label: 'Memory', value: formatLabel(apiReport?.memory?.level, 'Developing') },
                                { label: 'Learning Style', value: learnerStyleLabel },
                            ]}
                        />
                    </div>

                    {/* Body + Vitals row */}
                    <div className="flex w-full" style={{ gap: '24px' }}>
                        <StatCard
                            title="Body"
                            icon={<img src={BodyIcon} alt="" className="w-full h-full object-contain" />}
                            color="#FF9D5C"
                            rows={[
                                { label: 'Hydration', value: formatLabel(apiReport?.hydration?.level, 'Ideal') },
                                { label: 'Muscle Mass', value: formatLabel(apiReport?.muscle_mass?.level, 'Ideal') },
                                { label: 'Fat Mass', value: formatLabel(apiReport?.fat_mass?.level, 'Low') },
                            ]}
                        />
                        <StatCard
                            title="Vitals"
                            icon={<img src={""} alt="" className="w-full h-full object-contain" />}
                            color="#EA73FF"
                            rows={[
                                { label: 'Heart Rate', value: `${formatLabel(apiReport?.vitals?.heart_rate, '--')} bpm` },
                                { label: 'Breathing Rate', value: `${formatLabel(apiReport?.vitals?.breathing_rate, '--')} breaths/min` },
                                { label: 'Stress', value: formatLabel(apiReport?.vitals?.stress, 'Low') },
                            ]}
                        />
                    </div>

                    {/* Color Blindness + Emotion pills */}
                    <div className="flex flex-col w-full" style={{ gap: '24px' }}>
                        <InfoPill
                            icon={<img src={Eye_Icon} alt="" className="w-full h-full object-contain" />}
                            label="Color Blindness"
                            value={formatLabel(apiReport?.color_blindness?.status, 'Not present')}
                            color="#FFE15C"
                        />
                        <InfoPill
                            icon={<img src={""} alt="" className="w-full h-full object-contain" />}
                            label="Emotion"
                            value={formatLabel(apiReport?.emotion?.label, 'Happy')}
                            color="#FFE15C"
                        />
                    </div>

                    {/* QR + download report */}
                    <div className="flex items-center justify-center" style={{ gap: '28px' }}>
                        <p
                            className="text-white"
                            style={{ fontFamily: FONT, fontSize: '45px', maxWidth: '716px' }}
                        >
                            {t('bia_result.download_report', 'Download Suhi Holistic Wellness report for more details')}
                        </p>
                        <img src={""} alt="QR Code" style={{ width: '134px', height: '134px' }} />
                    </div>

                    {/* CTA */}
                    <button
                        onClick={() => {
                            releaseAllResources()
                            navigate('/welcome')
                        }}
                        className="flex items-center justify-center cursor-pointer"
                        style={{
                            ...pill,
                            padding: '28px 86px',
                            borderRadius: '28px',
                        }}
                    >
                        <span
                            className="text-white whitespace-nowrap"
                            style={{ fontFamily: FONT, fontSize: '60px' }}
                        >
                            {t('bia_result.go_to_homepage')}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default BIAResult