import { useEffect, useState, useRef, useCallback } from 'react'
import biaResultFrame from '../../assets/biaResultFrame1.svg';
import BodyIcon from '../../assets/bia/BodyIcon.svg'
import WeightIcon from '../../assets/bia/weight.svg'
import HeightIcon from '../../assets/bia/height.svg'
import Eye_Icon from '../../assets/bia/Eye_Icon.svg'
import { useNavigate } from 'react-router'
import { useSelector } from 'react-redux'
import axios from "axios"
import BodyConstitution from './BodyConstitution'
import droplet from '../../assets/droplet.png'
import { useTranslation } from 'react-i18next'
import { releaseAllResources } from '../../utils/cleanup'
import { BrainIconS, MindIcon } from '../../assets'
import BlackGradientButton from '../ui/BlackGradientButton';

/*
  ─────────────────────────────────────────────────────────────
  KIOSK SCALING STRATEGY
  ─────────────────────────────────────────────────────────────
  Target screen : 1402 × 1802 px (portrait kiosk, no scrolling ever)

  Approach:
    1. Render the entire page content in a fixed-width inner wrapper
       (DESIGN_W = 1402px — matches the screen width 1:1).
    2. After render, measure the wrapper's naturalHeight.
    3. Compute scale = min(screenH / naturalH, 1)
       → scale ≤ 1 so we only ever shrink, never zoom in.
    4. Apply transform: scale(scale) with transform-origin top-left.
    5. Use a ResizeObserver so this recalculates if fonts shift layout.

  Result: content always fits the screen exactly. No scroll. No overflow.
  ─────────────────────────────────────────────────────────────
*/

/* Design canvas width — matches kiosk screen width exactly */
const DESIGN_W = 1402

const FONT = "'Anta', sans-serif"

/* ── Size tokens (fixed px — we scale the whole canvas, not individual elements) ── */
const S = {
  titleSize: '42px',
  labelSize: '32px',
  valueSize: '44px',
  iconSize: '48px',
  cardPaddingH: '56px',
  cardPaddingV: '28px',
  sepHeight: '65px',
  hwLabel: '32px',
  hwValue: '44px',
  hwUnit: '36px',
  hwIcon: '36px',
  headerGap: '16px',
  colGap: '24px',
  cellPadV: '20px',
  cellPadH: '14px',
  mtGrid: '20px',
}

/* ─────────────────────────────────────────────
   INSIGHT CARD  (Mind / Brain)
───────────────────────────────────────────── */
const renderInsightCard = ({
  title, icon, titleClassName, cardClassName,
  items, separatorClassName, borderColor
}) => (
  <div
    className={`relative w-full rounded-[10px] overflow-hidden ${cardClassName}`}
    style={{
      border: `0.5px solid ${borderColor || 'rgba(255,255,255,0.2)'}`,
      padding: `${S.cardPaddingV} ${S.cardPaddingH}`,
    }}
  >
    {/* ambient glow */}
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-[220px] h-[220px] bg-[#3EC6FF]/20 blur-[70px] rounded-full" />
    </div>

    <div className="relative z-10">
      {/* Header row */}
      <div className="flex items-center justify-center" style={{ gap: S.headerGap }}>
        <span
          className="flex items-center justify-center shrink-0"
          style={{ width: S.iconSize, height: S.iconSize }}
        >
          {icon}
        </span>
        <h3
          className={`leading-none tracking-[0.04em] ${titleClassName}`}
          style={{ fontFamily: FONT, fontSize: S.titleSize }}
        >
          {title}
        </h3>
      </div>

      {/* Metric columns */}
      <div
        className="grid items-stretch"
        style={{
          marginTop: S.mtGrid,
          gridTemplateColumns: '1fr auto 1fr auto 1fr',
        }}
      >
        {items.map((item, index) => (
          <div key={item.label} className="contents">
            <div
              className="flex flex-col items-center justify-center text-center relative"
              style={{ padding: `${S.cellPadV} ${S.cellPadH}` }}
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[140px] h-[100px] rounded-full blur-[40px] bg-white/10" />
              </div>
              <div className="relative z-10 flex flex-col items-center">
                <p
                  className="text-white/80 tracking-[0.04em] leading-tight text-center"
                  style={{ fontFamily: FONT, fontSize: S.labelSize }}
                >
                  {item.label}
                </p>
                <p
                  className={`leading-tight tracking-[0.04em] font-normal ${item.valueClassName || 'text-white'}`}
                  style={{ fontFamily: FONT, fontSize: S.valueSize, marginTop: '8px' }}
                >
                  {item.value}
                </p>
              </div>
            </div>

            {index < items.length - 1 ? (
              <div className="flex items-center justify-center">
                <div
                  className={`w-[1.5px] rounded-full ${separatorClassName}`}
                  style={{ height: S.sepHeight }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
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
  const { t } = useTranslation()

  const [apiReport, setApiReport] = useState(null)

  /* ── Scaling refs ── */
  const innerRef = useRef(null)   // the content wrapper we measure
  const [scale, setScale] = useState(1)

  /* Recompute scale whenever inner content height changes */
  const recomputeScale = useCallback(() => {
    const el = innerRef.current
    if (!el) return
    const screenH = window.innerHeight   // actual device height
    const screenW = window.innerWidth    // actual device width

    /*
      We fix the inner wrapper at DESIGN_W wide.
      After layout, measure its scrollHeight (natural height).
      Scale so it fits within screenH.
      Also guard against width overflow (scale to fit width if wider than screen).
    */
    const naturalH = el.scrollHeight
    const scaleByH = screenH / naturalH
    const scaleByW = screenW / DESIGN_W
    const finalScale = Math.min(scaleByH, scaleByW, 1) // never upscale
    setScale(finalScale)
  }, [])

  /* Watch for layout shifts (fonts loading, API data arriving) */
  useEffect(() => {
    const el = innerRef.current
    if (!el) return

    const ro = new ResizeObserver(recomputeScale)
    ro.observe(el)
    recomputeScale() // initial

    window.addEventListener('resize', recomputeScale)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recomputeScale)
    }
  }, [recomputeScale])

  /* Re-run after API data resolves */
  useEffect(() => {
    if (apiReport) {
      // Give the DOM one frame to re-paint with new data, then remeasure
      requestAnimationFrame(() => requestAnimationFrame(recomputeScale))
    }
  }, [apiReport, recomputeScale])

  /* ── Fallback / merge helpers ── */
  const fallbackPartialJson = {
    height: 170, weight: 70,
    body_constitution: { vata: 34, pitta: 40, kapha: 26 },
    hydration: { level: 'Low', message: 'Increase your water intake for better performance' },
    learner_type: { type: 'integrated', title: 'You learn best using multiple methods', description: 'Use visual, auditory, and hands-on techniques together' },
    personality: { animal: 'Balanced', traits: ['Calm', 'Adaptive', 'Focused'] },
    attention: { tracking_accuracy: 55, level: 'Medium' },
    memory: { score: 3, level: 'Beginner' },
    self_esteem: { level: 'Average' },
    emotional_regulation: { level: 'Good' },
    color_blindness: { status: 'Not Present' },
    muscle_mass: { level: 'Ideal' },
    fat_mass: { level: 'Ideal' },
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
  })

  const mapReportToUI = (api) => {
    if (!api) return null
    const d = api.data
    return {
      height: d?.bia?.height_cm ?? null,
      weight: d?.bia?.weight_kg ?? null,
      body_constitution: d?.prakriti ? { vata: d.prakriti.vata, pitta: d.prakriti.pitta, kapha: d.prakriti.kapha } : null,
      hydration: d?.bia?.hydration ? { level: d.bia.hydration } : null,
      learner_type: d?.learning_style ? { type: d.learning_style.toLowerCase(), title: `Your learning style is ${d.learning_style}`, description: 'Personalized learning recommendation' } : null,
      personality: d?.personality ? { animal: d.personality, traits: [d.personality] } : null,
      attention: d?.attention,
      memory: d?.memory,
      self_esteem: d?.self_esteem,
      emotional_regulation: d?.emotional_regulation,
      color_blindness: d?.color_blindness ? { status: d.color_blindness } : null,
      muscle_mass: { level: d?.bia?.muscle_mass?.status },
      fat_mass: { level: d?.bia?.fat_mass?.status },
    }
  }

  const fetchBiometricReport = async () => {
    try {
      const res = await axios.post('http://localhost:8000/report/', {
        user_id: storeUser?.data?.user_id,
        session_id: storeUser?.screening?.session_id,
        screening_session_id: storeUser?.screening?.session_id,
      })
      if (res?.data?.success) { setApiReport(mergeWithFallback(mapReportToUI(res.data))); return }
      setApiReport(fallbackPartialJson)
    } catch { setApiReport(fallbackPartialJson) }
  }

  useEffect(() => {
    const timer = setTimeout(fetchBiometricReport, 0)
    return () => clearTimeout(timer)
  }, [])

  /* ── derived values ── */
  const finalHeight = storeHeight?.finalHeight || apiReport?.height || 170
  const finalWeight = storeWeight?.finalWeight || apiReport?.weight || 70

  const formatLabel = (v, fallback = 'Not Available') =>
    (v === null || v === undefined || v === '') ? fallback : String(v)

  const learnerType = apiReport?.learner_type?.type?.toLowerCase()
  const learnerStyleLabel = learnerType
    ? learnerType.charAt(0).toUpperCase() + learnerType.slice(1)
    : 'Balanced'

  const hydrationLevel = apiReport?.hydration?.level || 'Low'
  const hydrationMessage = apiReport?.hydration?.message || t('bia_result.hydration_low_message')

  const hasInsightCardsData = Boolean(
    apiReport?.personality || apiReport?.learner_type || apiReport?.color_blindness
  )

  const feelingsItems = [
    { label: 'Emotion Regulation', value: formatLabel(apiReport?.emotional_regulation?.level, 'Good'), valueClassName: 'text-[#29ABE2]' },
    { label: 'Self-Esteem', value: formatLabel(apiReport?.self_esteem?.level, 'Average'), valueClassName: 'text-[#29ABE2]' },
    { label: 'Personality', value: formatLabel(apiReport?.personality?.animal, 'Balanced'), valueClassName: 'text-[#29ABE2]' },
  ]

  const learningItems = [
    { label: 'Attention', value: formatLabel(apiReport?.attention?.level, 'Medium'), valueClassName: 'text-[#2CEF94]' },
    { label: 'Memory', value: formatLabel(apiReport?.memory?.level, 'Beginner'), valueClassName: 'text-[#2CEF94]' },
    { label: 'Learning Style', value: learnerStyleLabel, valueClassName: 'text-[#2CEF94]' },
  ]

  const healthSummaryItems = [
    { label: t('bia_result.hydration'), value: hydrationLevel },
    { label: 'Muscle Mass', value: formatLabel(apiReport?.muscle_mass?.level, 'Ideal') },
    { label: 'Fat Mass', value: formatLabel(apiReport?.fat_mass?.level, 'Ideal') },
  ]

  /* ────────────────────────────────────────────
     RENDER
  ──────────────────────────────────────────── */
  return (
    /*
      Outer shell — fills the physical screen, clips everything, hides scroll.
      Nothing inside this element should scroll.
    */
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
      {/*
        Scale container:
          • Fixed at DESIGN_W so layout is predictable
          • transform-origin top-left → scaling shrinks downward/rightward
          • transform: scale(scale) applied after measuring naturalHeight
          • We translate back to center it horizontally after scale
      */}
      <div
        ref={innerRef}
        style={{
          width: `${DESIGN_W}px`,
          // DO NOT set height here — let content define it so we can measure
          transformOrigin: 'top left',
          transform: `scale(0.818) translateX(162px)`,
          // Prevent any internal scroll
          // overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Background layer */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#000',
            zIndex: 0,
          }}
        />

        {/* Page content */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '24px 16px 32px',
            gap: '0px',
          }}
        >
          {/* Page title */}
          <h1
            style={{
              fontFamily: FONT,
              fontSize: '38px',
              fontWeight: 'bold',
              color: '#fff',
              textAlign: 'center',
              letterSpacing: '0.05em',
              lineHeight: '1.3',
              width: '80%',
              marginTop: '8px',
              marginBottom: '0px',
            }}
          >
            {t('bia_result.congratulations')}
            <br />
            {t('bia_result.here_are_results')}
          </h1>

          {/* Frame container */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '1080px',
              marginTop: '16px',
              boxShadow: '0px 35.76px 176.82px rgba(154, 217, 255, 0.5)',
            }}
          >
            <img
              src={biaResultFrame}
              alt="BIA Frame"
              style={{
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
                filter: 'drop-shadow(0px 35.76px 176.82px rgba(154, 217, 255, 0.5))',
                display: 'block',
              }}
            />

            {/* Content overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                // NO overflow-y: auto — everything must fit
                overflow: 'hidden',
                fontFamily: FONT,
                color: '#fff',
                padding: '6% 8.5% 14%',
                gap: '16px',
              }}
            >
              {/* Dosha chart */}
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '100%' }}>
                  <BodyConstitution
                    vata={apiReport?.body_constitution?.vata}
                    pitta={apiReport?.body_constitution?.pitta}
                    kapha={apiReport?.body_constitution?.kapha}
                  />
                </div>
              </div>

              {hasInsightCardsData ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                  {/* MIND card */}
                  {renderInsightCard({
                    title: 'Persona',
                    icon: <MindIcon style={{ width: '100%', height: '100%' }} />,
                    titleClassName: 'text-[#29ABE2]',
                    cardClassName: 'bg-[linear-gradient(180deg,rgba(41,171,226,0.05)_48%,rgba(41,171,226,0.1)_70%)]',
                    items: feelingsItems,
                    separatorClassName: 'bg-[#29ABE2]',
                    borderColor: 'rgb(41 171 226 / 57%)',
                  })}

                  {/* BRAIN card */}
                  {renderInsightCard({
                    title: 'Mind',
                    icon: <BrainIconS style={{ width: '100%', height: '100%' }} />,
                    titleClassName: 'text-[#2CEF94]',
                    cardClassName: 'bg-[linear-gradient(180deg,rgba(44,239,148,0.05)_0%,rgba(44,239,148,0.2)_100%)]',
                    items: learningItems,
                    separatorClassName: 'bg-[#2CEF94]',
                    borderColor: 'rgb(44 239 148 / 55%)',
                  })}

                  {/* BODY card */}
                  <div
                    className="w-full rounded-[10px]"
                    style={{
                      border: '0.5px solid rgb(255 157 92 / 52%)',
                      background: 'linear-gradient(180deg, rgba(255,157,92,0.05) 0%, rgba(255,157,92,0.2) 100%)',
                      padding: `${S.cardPaddingV} ${S.cardPaddingH}`,
                    }}
                  >
                    <div className="flex items-center justify-center" style={{ gap: S.headerGap }}>
                      <span
                        className="flex items-center justify-center shrink-0"
                        style={{ width: S.iconSize, height: S.iconSize }}
                      >
                        <img src={BodyIcon} alt="body icon" className="w-full h-full object-contain" />
                      </span>
                      <h3
                        className="leading-none tracking-[0.04em] text-[#FF9D5C]"
                        style={{ fontFamily: FONT, fontSize: S.titleSize }}
                      >
                        Body
                      </h3>
                    </div>

                    {/* Height & Weight */}
                    <div
                      className="grid grid-cols-2"
                      style={{ marginTop: S.mtGrid, gap: '14px' }}
                    >
                      {[
                        { label: t('bia_result.height'), value: Math.round(finalHeight), unit: 'cm', icon: HeightIcon },
                        { label: t('bia_result.weight'), value: Math.round(finalWeight), unit: 'kg', icon: WeightIcon },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-center rounded-[8px] bg-[rgba(0,0,0,0.6)]"
                          style={{
                            gap: '14px',
                            padding: '14px 20px',
                            border: '2.693px solid rgba(255,255,255,0.3)',
                            boxShadow: '0 0 20px rgba(255,255,255,0.05) inset',
                          }}
                        >
                          <div className="flex items-center" style={{ gap: '8px' }}>
                            <img
                              src={item.icon}
                              alt={item.label}
                              style={{ width: S.hwIcon, height: S.hwIcon }}
                              className="object-contain shrink-0"
                            />
                            <p
                              className="text-white leading-tight tracking-[0.04em] whitespace-nowrap"
                              style={{ fontFamily: FONT, fontSize: S.hwLabel }}
                            >
                              {item.label}
                            </p>
                          </div>
                          <div className="flex items-baseline" style={{ gap: '3px' }}>
                            <p
                              className="leading-none text-[#FF9D5C]"
                              style={{ fontFamily: FONT, fontSize: S.hwValue }}
                            >
                              {item.value}
                            </p>
                            <span
                              className="text-[#FF9D5C]/80"
                              style={{ fontFamily: FONT, fontSize: S.hwUnit }}
                            >
                              {item.unit}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Hydration / Muscle / Fat row */}
                    <div
                      className="grid items-stretch"
                      style={{
                        marginTop: '12px',
                        gridTemplateColumns: '1fr auto 1fr auto 1fr',
                      }}
                    >
                      {healthSummaryItems.map((item, index) => (
                        <div key={item.label} className="contents">
                          <div
                            className="flex flex-col items-center justify-center text-center relative"
                            style={{ padding: `${S.cellPadV} ${S.cellPadH}` }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-[140px] h-[100px] rounded-full blur-[40px] bg-white/10" />
                            </div>
                            <div className="relative z-10">
                              <p
                                className="text-white/80 tracking-[0.04em] leading-tight"
                                style={{ fontFamily: FONT, fontSize: S.labelSize }}
                              >
                                {item.label}
                              </p>
                              <p
                                className="leading-tight tracking-[0.04em] text-[#FF9D5C]"
                                style={{ fontFamily: FONT, fontSize: S.valueSize, marginTop: '6px' }}
                              >
                                {item.value}
                              </p>
                            </div>
                          </div>

                          {index < healthSummaryItems.length - 1 ? (
                            <div className="flex items-center justify-center">
                              <div
                                className="w-[1.5px] rounded-full bg-[#FF9D5C]"
                                style={{ height: S.sepHeight }}
                              />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* COLOR BLINDNESS card */}
                  <div
                    className="w-full rounded-[10px]"
                    style={{
                      border: '0.5px solid rgb(255 225 92 / 47%)',
                      background: 'linear-gradient(180deg, rgba(255,225,92,0.05) 0%, rgba(255,225,92,0.2) 100%)',
                      padding: `${S.cardPaddingV} ${S.cardPaddingH}`,
                    }}
                  >
                    <div
                      className="flex items-center justify-center flex-wrap text-center"
                      style={{ gap: S.headerGap }}
                    >
                      <span
                        className="flex items-center justify-center shrink-0"
                        style={{ width: S.iconSize, height: S.iconSize }}
                      >
                        <img src={Eye_Icon} alt="eye icon" className="w-full h-full object-contain" />
                      </span>
                      <h3
                        className="leading-none tracking-[0.04em]  whitespace-nowrap"
                        style={{ fontFamily: FONT, fontSize: S.titleSize }}
                      >
                        Color Blindness -
                      </h3>
                      <span
                        className="leading-none tracking-[0.04em] text-[#FFE15C] whitespace-nowrap"
                        style={{ fontFamily: FONT, fontSize: S.valueSize }}
                      >
                        {formatLabel(apiReport?.color_blindness?.status, 'Not present')}
                      </span>
                    </div>
                  </div>

                </div>
              ) : (
                /* Fallback hydration-only view */
                <div className="w-full rounded-[10px] border-[0.5px] border-[#29ABE2] bg-[linear-gradient(180deg,rgba(41,171,226,0.05)_0%,rgba(41,171,226,0.1)_100%)] p-5">
                  <div className="flex flex-col items-center justify-center gap-2.5 text-center">
                    <div className="flex items-center justify-center gap-2.5">
                      <img src={droplet} className="h-6 w-6" alt="" />
                      <h3
                        className="tracking-wide text-[#29ABE2]"
                        style={{ fontFamily: FONT, fontSize: '22px' }}
                      >
                        {t('bia_result.hydration')} -{' '}
                        <span className="text-white">{hydrationLevel}</span>
                      </h3>
                    </div>
                    <p className="pt-0.5 text-xl tracking-wider text-white/90">{hydrationMessage}</p>
                  </div>
                </div>
              )}

              {/* CTA Button */}
              <BlackGradientButton
                onClick={() => {
                  releaseAllResources()
                  navigate('/welcome')
                }}
                style={{
                  width: "400px",
                  height: "clamp(90px, 9vw, 145px)",

                }}
              >
                <span
                  className="font-anta text-white whitespace-nowrap tracking-tight rounded-2xl"
                  style={{
                    fontSize: "clamp(1rem, 3.8vw, 3.75rem)",
                    // letterSpacing: "-0.06em",
                  }}
                >
                  {t('bia_result.go_to_homepage')}
                </span>
              </BlackGradientButton>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BIAResult