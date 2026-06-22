import React, { useEffect, useState, useRef } from "react"
import bg1 from "../../assets/lightbg.png"
import biaCompleteAlertSvg from "../../assets/bia/bia_complete_alert.svg"
import { useNavigate, useParams } from "react-router"
import progessbg from "../../assets/progress-bg.svg"
import { useTranslation } from "react-i18next"
import BlueGradientButton from "../ui/BlueGradientButton"
import HeightWeightDisplay from "./HeightWeightDisplay"
import standstraightAudio from "../../assets/audio/standstraight_en.mp3"
import wh_completeAudio from "../../assets/audio/wh_complete_en.mp3"
import wh_measuringAudio from "../../assets/audio/wh_measuring_en.mp3"
import impedanceAudio from "../../assets/audio/impedance_en.mp3"
import im_completeAudio from "../../assets/audio/im_complete_en.mp3"
import holdRods from "../../assets/bia/hold_rods.mp4"
import ReplayAudio from "../ReplayAudio"
import { getAudioForCurrentLanguage } from "../../utils/audioUtils"
import biaHydrationIcon from "../../assets/icons/bia-hydration.svg"
import biaSkeletonIcon from "../../assets/icons/bia-skeleton.svg"
import biaFatMassIcon from "../../assets/icons/bia-fat-mass.svg"
import biaMuscleMassIcon from "../../assets/icons/bia-muscle-mass.svg"
import heightIcon from '../../assets/bia/scale.svg'
import weightIcon from '../../assets/bia/bag.svg'
import visceralFatIcon from '../../assets/bia/visceral_fat.svg'
import proteinMassIcon from '../../assets/bia/protein_mass.svg'
import HeightWeightComplete from "./HeightWeightComplete"

const ARC_POSITIONS = {
  "arc-left-top": {
    left: "-8%",
    top: "18%",
  },

  "arc-left-middle": {
    left: "-10%",
    top: "44%",
  },

  "arc-left-bottom": {
    left: "-3%",
    top: "60%",
  },

  "arc-right-top": {
    left: "76%",
    top: "18%",
  },

  "arc-right-middle": {
    left: "80%",
    top: "43%",
  },

  "arc-right-bottom": {
    left: "70%",
    top: "60%",
  },

  "arc-center-top": {
    left: "34%",
    top: "-0%",
  },

  "arc-center-bottom": {
    left: "32.4%",
    top: "80%",
  },
}
/* ─────────────────────────────────────────────────────────────
   Inline keyframes injected once (avoids Tailwind limitations)
───────────────────────────────────────────────────────────── */
const BIA_CARD_STYLES = `
  @keyframes biaFloatA {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-12px); }
  }
  @keyframes biaFloatB {
    0%, 100% { transform: translateY(-6px); }
    50%       { transform: translateY(6px); }
  }
  @keyframes biaFloatC {
    0%, 100% { transform: translateY(5px); }
    50%       { transform: translateY(-9px); }
  }
  @keyframes biaFloatD {
    0%, 100% { transform: translateY(-3px); }
    50%       { transform: translateY(10px); }
  }
  @keyframes biaShimmer {
    0%   { left: -100%; }
    100% { left: 200%; }
  }
  @keyframes biaScanLine {
    0%   { top: 0%;   opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes biaScanLineB {
    0%   { top: 0%;   opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes biaScanLineC {
    0%   { top: 0%;   opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes biaScanLineD {
    0%   { top: 0%;   opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
`

const FLOAT_ANIMATIONS = ["biaFloatA", "biaFloatB", "biaFloatC", "biaFloatD", "biaFloatA", "biaFloatB", "biaFloatC", "biaFloatD"]
const FLOAT_DURATIONS = ["3.2s", "2.9s", "3.5s", "3.1s", "3.2s", "2.9s", "3.5s", "3.1s"]

/* ─────────────────────────────────────────────────────────────
   Card position styles (absolute, around the video)
───────────────────────────────────────────────────────────── */
const cardPositionStyle = (position) => ({
  position: "absolute",
  zIndex: 40,
  transform: "translate(-50%, -50%)",
  ...ARC_POSITIONS[position],
})
/* ─────────────────────────────────────────────────────────────
   Single floating metric card
───────────────────────────────────────────────────────────── */
const BiaMetricCard = ({ metric, value, isSettled, index, isInstant }) => {
  const isRight = metric.position.startsWith("right")

  const cardStyle = {
    ...cardPositionStyle(metric.position),
    background: "rgba(82, 82, 82, 0.13)",
    border: "1px solid rgba(255, 255, 255, 0.72)",
    borderRadius: "14px",
    boxShadow: isSettled || isInstant
      ? "0 2px 22px 0 rgba(100, 255, 180, 0.55)"
      : "0 2px 20px 0 rgba(154, 217, 255, 0.62)",
    padding: "12px 20px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    overflow: "hidden",
    minWidth: "220px",
    minHeight: "80px",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    animation: `${FLOAT_ANIMATIONS[index]} ${FLOAT_DURATIONS[index]} ease-in-out infinite`,
    transition: "box-shadow 2.34px 18.716px 0 #9AD9FF;",
    flexDirection: isRight ? "row-reverse" : "row",
    fontFamily: "'Anta', sans-serif",
  }

  const shimmerStyle = {
    position: "absolute",
    top: 0,
    left: "-100%",
    width: "50%",
    height: "100%",
    background:
      "linear-gradient(90deg, transparent, rgba(154,217,255,0.18), transparent)",
    animation: isSettled ? "none" : "biaShimmer 1.35s linear infinite",
    pointerEvents: "none",
    display: isSettled ? "none" : "block",
  }

  const valueStyle = {
    fontSize: "18px",
    color: isSettled ? "#7affb2" : "#9ad9ff",
    letterSpacing: "0.04em",
    fontVariantNumeric: "tabular-nums",
    minHeight: "20px",
    transition: "color 0.6s",
    textAlign: isRight ? "right" : "left",
  }

  const labelStyle = {
    fontSize: "20px",
    color: "#fff",
    whiteSpace: "nowrap",
    lineHeight: 1.1,
    textAlign: isRight ? "right" : "left",
  }

  return (
    <div style={cardStyle}>
      {/* shimmer sweep */}
      <div style={shimmerStyle} />

      {/* icon */}
      <span style={{ fontSize: "26px", flexShrink: 0 }}>
        <img src={metric.icon} alt={metric.label} style={{ width: "26px", height: "26px" }} />
      </span>

      {/* text */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <span style={labelStyle}>{metric.label}</span>
        <span style={valueStyle}>
          {value ?? "—"}
        </span>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────── */
export const BIAComponent = ({
  screenConfig,
  total = 28,
  isComplete = false,
  onVideoEnd,
  heightValue,
  weightValue,
  onNextClick,
  onNextVoiceClick,
  arms50k,
  user
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { screenType } = useParams()
  const gender = user?.data?.gender?.toLowerCase() === "female" ? "female" : "male"
  console.log("gender bia component", gender)
  const currentScreen = screenConfig[screenType]
  const title = currentScreen?.title
  const description = currentScreen?.description
  const videoSrc = currentScreen?.video?.[gender]
  /* existing progress state */
  const [progress, setProgress] = useState(0)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const audioRef = useRef(null)
  const videoRef = useRef(null)
  const activeCount = Math.round((progress / 100) * total)

  /* Stop video on complete screens, resume on active screens */
  const COMPLETE_SCREENS = ["whcomplete", "imcomplete"]
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (COMPLETE_SCREENS.includes(screenType)) {
      video.pause()
    } else {
      // Only play if the video is paused (avoid DOMException on already-playing)
      if (video.paused) {
        video.play().catch((err) => console.log("Video play failed:", err))
      }
    }
  }, [screenType])

  /* ── new: BIA card states ── */
  const [biaValues, setBiaValues] = useState({})   // key → display string
  const [isSettled, setIsSettled] = useState(false) // true when calc done
  const biaIntervalRef = useRef(null)
  // Keep a ref to the latest biaMetrics so closures always read fresh data
  const biaMetricsRef = useRef([])
  const buildBiaMetrics = (arms50k) => [
    {
      key: "hydration",
      label: "Hydration",
      icon: biaHydrationIcon,
      final: arms50k?.waterPercentage != null
        ? `${parseFloat(arms50k.waterPercentage).toFixed(1)}%`
        : "--",
      min: 30,
      max: 80,
      unit: "%",
      dec: 1,
      position: "arc-left-top",
      isInstant: false,
    },

    {
      key: "skeletalMass",
      label: "Skeletal Mass",
      icon: biaSkeletonIcon,
      final: arms50k?.skeletalMuscleMassKg != null
        ? `${parseFloat(arms50k.skeletalMuscleMassKg).toFixed(1)} kg`
        : "--",
      min: 8,
      max: 20,
      unit: " kg",
      dec: 1,
      position: "arc-left-middle",
      isInstant: false,
    },

    {
      key: "fatMass",
      label: "Fat Mass",
      icon: biaFatMassIcon,
      final: arms50k?.fatPercentage != null
        ? `${parseFloat(arms50k.fatPercentage).toFixed(1)}%`
        : "--",
      min: 5,
      max: 40,
      unit: "%",
      dec: 1,
      position: "arc-left-bottom",
      isInstant: false,
    },

    {
      key: "muscleMass",
      label: "Muscle Mass",
      icon: biaMuscleMassIcon,
      final: arms50k?.muscleMassKg != null
        ? `${parseFloat(arms50k.muscleMassKg).toFixed(1)} kg`
        : "--",
      min: 20,
      max: 60,
      unit: " kg",
      dec: 1,
      position: "arc-right-top",
      isInstant: false,
    },

    {
      key: "proteinMass",
      label: "Protein Mass",
      icon: proteinMassIcon,
      final: arms50k?.proteinMassKg != null
        ? `${arms50k.proteinMassKg} kg`
        : "--",
      min: 18,
      max: 70,
      unit: "kg",
      dec: 1,
      position: "arc-right-middle",
      isInstant: false,
    },

    {
      key: "visceralFat",
      label: "Visceral Fat",
      icon: visceralFatIcon,
      final: arms50k?.visceralFat != null
        ? `${arms50k.visceralFat}`
        : "--",
      min: 1,
      max: 30,
      unit: "",
      dec: 0,
      position: "arc-right-bottom",
      isInstant: false,
    },
    {
      key: "height",
      label: "Height",
      icon: heightIcon,
      final: heightValue != null
        ? `${heightValue.toFixed(1)} cm`
        : "--",
      min: 1,
      max: 30,
      unit: "cm",
      dec: 0,
      position: "arc-center-top",
      isInstant: true,
    },
    {
      key: "weight",
      label: "Weight",
      icon: weightIcon,
      final: weightValue != null
        ? `${weightValue.toFixed(1)} kg`

        : "--",
      min: 1,
      max: 30,
      unit: "kg",
      dec: 0,
      position: "arc-center-bottom",

      isInstant: true,
    },
  ]

  const biaMetrics = buildBiaMetrics(arms50k)
  // Keep the ref in sync on every render so closures always read fresh data
  biaMetricsRef.current = biaMetrics

  /* ──────────────── random-number scramble ──────────────── */
  const startScramble = () => {
    if (biaIntervalRef.current) clearInterval(biaIntervalRef.current)
    setIsSettled(false)

    biaIntervalRef.current = setInterval(() => {
      const next = {}
      biaMetricsRef.current.forEach((metric) => {
        const {
          key,
          min,
          max,
          unit,
          dec,
          final,
          isInstant,
        } = metric

        // Already known metrics stay fixed
        if (isInstant) {
          next[key] = final
          return
        }

        // Scanning metrics animate
        const rand = (
          Math.random() * (max - min) + min
        ).toFixed(dec)

        next[key] = rand + unit
      })
      setBiaValues(next)
    }, 80)
  }

  const settleValues = () => {
    if (biaIntervalRef.current) {
      clearInterval(biaIntervalRef.current)
      biaIntervalRef.current = null
    }
    const final = {}
    // Always read from the ref so we get the latest arms50k data
    biaMetricsRef.current.forEach(({ key, final: v }) => { final[key] = v })
    setBiaValues(final)
    setIsSettled(true)
  }

  /* start scramble when entering im screen */
  useEffect(() => {
    if (screenType === "im") {
      startScramble()
    } else if (screenType === "imcomplete") {
      settleValues()
    } else {
      if (biaIntervalRef.current) clearInterval(biaIntervalRef.current)
      setIsSettled(false)
      setBiaValues({})
    }
    return () => {
      if (biaIntervalRef.current) clearInterval(biaIntervalRef.current)
    }
  }, [screenType])

  /* Re-settle whenever arms50k data arrives/updates on the imcomplete screen.
     This handles the race where navigate() fires before setMeasuredValues
     has propagated the new arms50k prop down to this component. */
  useEffect(() => {
    if (screenType === "imcomplete") {
      settleValues()
    }
  }, [arms50k])



  /* ──────────────── audio helpers (unchanged) ──────────────── */
  const getAudioBaseName = (type) => {
    const audioMap = {
      wh: "wh_measuring",
      whcomplete: "wh_complete",
      im: "impedance",
      hold: "impedance",
      imcomplete: "im_complete",
      leg50: "standstraight"
    }
    return audioMap[type] || "standstraight"
  }

  useEffect(() => { playAudio() }, [screenType])

  const playAudio = async () => {
    const baseName = getAudioBaseName(screenType)
    let audioPath = await getAudioForCurrentLanguage(baseName)
    if (!audioPath) {
      console.log(`No audio found for ${baseName} in current language, using fallback`)
      audioPath = getAudioPath(screenType)
    }
    if (audioPath && audioRef.current) {
      audioRef.current.src = audioPath
      setIsAudioPlaying(true)
      audioRef.current.play().catch((err) => {
        console.log("Audio playback failed:", err)
        setIsAudioPlaying(false)
      })
    }
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsAudioPlaying(false)
    }
  }

  const handleAudioEnd = () => { setIsAudioPlaying(false) }

  const getAudioPath = (type) => {
    const audioMap = { leg50: standstraightAudio, wh: wh_measuringAudio, whcomplete: wh_completeAudio, im: impedanceAudio, hold: impedanceAudio, imcomplete: im_completeAudio }
    return audioMap[type] || standstraightAudio
  }

  const showWhResults = screenType === "whcomplete"
  const showIMResults = screenType === "imcomplete"

  /* ──────────────── video source ──────────────── */
  // const videoSrc =
  //   screenType === "wh" || screenType === "leg50" || screenType === "whcomplete" || screenType === "imcomplete" ? user?.gender === "female" ? bmiWH_female : bmiWH_male :
  //     screenType === "im" || screenType === "leg20" || screenType === "imcomplete" || screenType === "imcomplete" ? user?.gender === "female" ? biaIm_female : biaIm_male :
  //       null

  return (
    <>
      {/* inject keyframes once */}
      <style>{BIA_CARD_STYLES}</style>

      <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
        <audio
          ref={audioRef}
          onEnded={handleAudioEnd}
          onPlay={() => setIsAudioPlaying(true)}
        >
          <source src={getAudioPath(screenType)} type="audio/mpeg" />
          {t("common.audio_not_supported")}
        </audio>

        {/* Background */}
        <div
          className="absolute inset-0 bg-center bg-cover z-0"
          style={{ backgroundImage: `url(${bg1})` }}
        />

        {/* TEXT + PROGRESS */}
        <div className="absolute landscape:top-15 landscape:left-[20%] portrait:top-30 portrait:left-[20%] z-10 w-[60%] pt-6">
          <div className="relative flex flex-col items-center">

            {/* Title */}
            <p className="text-white text-center portrait:text-[44px] tracking-wider">
              {title}
            </p>

            {/* Description */}
            <p className="mt-6 text-[#8BC3E5] font-medium tracking-tight landscape:text-4xl portrait:text-[38px] text-center">
              {description}
            </p>

          </div>
        </div>
      </div>


      {/* ─── VIDEO + FLOATING BIA CARDS ─── */}
      {videoSrc && (
        <div
          className="absolute z-0 inset-0 flex justify-center items-end mb-22 xl:items-center xl:justify-center  pointer-events-none mt-[26rem]"
        >
          {/* wrapper keeps cards relative to the video */}
          <div style={{ position: "relative", width: "60%", display: "flex", justifyContent: "center" }}>
            {/* video */}
            <video
              ref={videoRef}
              key={videoSrc}
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
              className="rounded-4xl object-cover w-full "
            />

            {/* ── floating metric cards (im screen only) ── */}
            {(screenType === "im") &&
              biaMetrics.map((metric, i) => (
                <BiaMetricCard
                  key={metric.key}
                  metric={metric}
                  value={biaValues[metric.key]}
                  isSettled={isSettled}
                  index={i}
                  isInstant={metric.isInstant}
                />
              ))}

            {screenType === "imcomplete" &&
              biaMetrics.map((metric, i) => (
                <BiaMetricCard
                  key={metric.key}
                  metric={metric}
                  value={biaValues[metric.key]}
                  isSettled={isSettled}
                  index={i}
                  isInstant={metric.isInstant}
                />
              ))}
          </div>
        </div>
      )}

      {/* WH Screen overlay */}
      {screenType === "wh" && (
        <HeightWeightDisplay
          heightValue={heightValue}
          weightValue={weightValue}
          isHideNext={true}
          isRandomHeightWeight={true}

        />
      )}

      {/* SVG Result Frames (whcomplete screen) */}
      {showWhResults && (
        <HeightWeightComplete
          heightValue={heightValue}
          weightValue={weightValue}
          onNextClick={onNextClick}
        />
      )}
      {/* Hold screen – background blur overlay */}
      {screenType === "hold" && (
        <div
          className="absolute inset-0 z-10"
          style={{
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            backgroundColor: "rgba(0, 0, 0, 0.2)",
          }}
        />
      )}

      {/* {screenType === "hold" && (
        <div
          className="absolute bottom-[28%] right-[34%] w-[45%] rounded-full overflow-hidden z-20"
          // style={{ filter: "drop-shadow(0px 0px 40px rgba(154, 217, 255, 0.5))" }}
        >
          <video src={holdRods} autoPlay loop muted playsInline className="" />
        </div>
      )} */}

      {screenType === "imcomplete" && (
        <div className="absolute bottom-20 left-[31%]">
          <BlueGradientButton onClick={onNextVoiceClick}>
            {t("common.next")}
          </BlueGradientButton>
        </div>
      )}
    </>
  )
}