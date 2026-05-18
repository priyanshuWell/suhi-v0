import React, { useEffect, useState, useRef } from "react"
import bg1 from "../../assets/lightbg.png"
import biaCompleteAlertSvg from "../../assets/bia/bia_complete_alert.svg"
import { useParams } from "react-router"
import progessbg from "../../assets/progress-bg.svg"
import textframe from "../../assets/textFrame.png"
import { useTranslation } from "react-i18next"
import bmiWH from "../../assets/bia/bia-hwmeasuring.mp4"
import biaIm from "../../assets/bia/bia-immeasuring.mp4"
import biawhComplete from "../../assets/bia/bia-whcomplete.mp4"
import biaImComplete from "../../assets/bia/bia-imcomplete.mp4"
import heightResSvg from "../../assets/bia/height_res.svg"
import weightResSvg from "../../assets/bia/weight_res.svg"
import BlueGradientButton from "../ui/BlueGradientButton"
import { Volume2 } from "lucide-react"
import HeightWeightComplete from "./HeightWeightComplete"
import standstraightAudio from "../../assets/audio/standstraight_en.mp3"
import impedanceAudio from "../../assets/audio/impedance_en.mp3"
import ReplayAudio from "../ReplayAudio"
import ImComplete from "./ImComplete"
import { getAudioForCurrentLanguage } from "../../utils/audioUtils"
import biaHydrationIcon from "../../assets/icons/bia-hydration.svg"
import biaSkeletonIcon from "../../assets/icons/bia-skeleton.svg"
import biaFatMassIcon from "../../assets/icons/bia-fat-mass.svg"
import biaMuscleMassIcon from "../../assets/icons/bia-muscle-mass.svg"

/* ─────────────────────────────────────────────────────────────
   BIA metric config  –  swap final values with real API data
───────────────────────────────────────────────────────────── */
const BIA_METRICS = [
  {
    key: "hydration",
    label: "Hydration",
    icon: biaHydrationIcon,
    final: "63.4%",
    min: 30,
    max: 80,
    unit: "%",
    dec: 1,
    position: "left-top",   // upper-left of video
  },
  {
    key: "skeletal",
    label: "Skeletal mass",
    icon: biaSkeletonIcon,
    final: "12.8 kg",
    min: 8,
    max: 20,
    unit: " kg",
    dec: 1,
    position: "right-top",  // upper-right
  },
  {
    key: "fat",
    label: "Fat mass",
    icon: biaFatMassIcon,
    final: "18.2%",
    min: 5,
    max: 40,
    unit: "%",
    dec: 1,
    position: "left-bottom", // lower-left
  },
  {
    key: "muscle",
    label: "Muscle mass",
    icon: biaMuscleMassIcon,
    final: "42.6 kg",
    min: 20,
    max: 60,
    unit: " kg",
    dec: 1,
    position: "right-bottom", // lower-right
  },
]

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
`

const FLOAT_ANIMATIONS = ["biaFloatA", "biaFloatB", "biaFloatC", "biaFloatD"]
const FLOAT_DURATIONS = ["3.2s", "2.9s", "3.5s", "3.1s"]

/* ─────────────────────────────────────────────────────────────
   Card position styles (absolute, around the video)
───────────────────────────────────────────────────────────── */
const cardPositionStyle = (position) => {
  const shared = {
    position: "absolute",
    zIndex: 40,
  }
  switch (position) {
    case "left-top": return { ...shared, left: "-4px", top: "15%" }
    case "right-top": return { ...shared, right: "-4px", top: "18%" }
    case "left-bottom": return { ...shared, left: "2px", bottom: "37%" }
    case "right-bottom": return { ...shared, right: "-4px", bottom: "45%" }
    default: return shared
  }
}

/* ─────────────────────────────────────────────────────────────
   Single floating metric card
───────────────────────────────────────────────────────────── */
const BiaMetricCard = ({ metric, value, isSettled, index }) => {
  const isRight = metric.position.startsWith("right")

  const cardStyle = {
    ...cardPositionStyle(metric.position),
    background: "rgba(82, 82, 82, 0.13)",
    border: "1px solid rgba(255, 255, 255, 0.72)",
    borderRadius: "14px",
    boxShadow: isSettled
      ? "0 2px 22px 0 rgba(100, 255, 180, 0.55)"
      : "0 2px 20px 0 rgba(154, 217, 255, 0.62)",
    padding: "12px 20px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    overflow: "hidden",
    minWidth: "175px",
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
    fontSize: "15px",
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
  texts,
  total = 28,
  percent = 50,
  attemptCount = 0,
  isComplete = false,
  onVideoEnd,
  heightValue = "132 cm",
  weightValue = "30 kg",
  onNextClick,
  onImNextClick,
  arms50k,
}) => {
  const { t } = useTranslation()
  const { screenType } = useParams()
  const currentText = texts[screenType]

  /* existing progress state */
  const [progress, setProgress] = useState(0)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const audioRef = useRef(null)
  const activeCount = Math.round((progress / 100) * total)

  /* ── new: BIA card states ── */
  const [biaValues, setBiaValues] = useState({})   // key → display string
  const [isSettled, setIsSettled] = useState(false) // true when calc done
  const biaIntervalRef = useRef(null)

  /* ──────────────── random-number scramble ──────────────── */
  const startScramble = () => {
    if (biaIntervalRef.current) clearInterval(biaIntervalRef.current)
    setIsSettled(false)

    biaIntervalRef.current = setInterval(() => {
      const next = {}
      BIA_METRICS.forEach(({ key, min, max, unit, dec }) => {
        const rand = (Math.random() * (max - min) + min).toFixed(dec)
        next[key] = rand + unit
      })
      //console.log(next)
      setBiaValues(next)
    }, 80)
  }

  const settleValues = () => {
    if (biaIntervalRef.current) {
      clearInterval(biaIntervalRef.current)
      biaIntervalRef.current = null
    }
    const final = {}
    BIA_METRICS.forEach(({ key, final: v }) => { final[key] = v })
    setBiaValues(final)
    setIsSettled(true)
  }

  /* start scramble when entering im screen */
  useEffect(() => {
    if (screenType === "im") {
      startScramble()
    } else {
      if (biaIntervalRef.current) clearInterval(biaIntervalRef.current)
      setIsSettled(false)
      setBiaValues({})
    }
    return () => {
      if (biaIntervalRef.current) clearInterval(biaIntervalRef.current)
    }
  }, [screenType])

  /* settle when parent signals completion */
  useEffect(() => {
    if (isComplete && screenType === "im") {
      settleValues()
    }
  }, [isComplete, screenType])



  /* ──────────────── audio helpers (unchanged) ──────────────── */
  const getAudioBaseName = (type) => {
    const audioMap = { wh: "standstraight", im: "impedance" }
    return audioMap[type] || "standstraight"
  }

  useEffect(() => { playAudio() }, [screenType])

  const playAudio = async () => {
    const baseName = getAudioBaseName(screenType)
    const audioPath = await getAudioForCurrentLanguage(baseName)
    if (audioPath && audioRef.current) {
      audioRef.current.src = audioPath
      setIsAudioPlaying(true)
      audioRef.current.play().catch((err) => {
        console.log("Audio playback failed:", err)
        setIsAudioPlaying(false)
      })
    } else if (!audioPath) {
      console.log(`No audio found for ${baseName} in current language`)
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
    const audioMap = { wh: standstraightAudio, im: impedanceAudio }
    return audioMap[type] || standstraightAudio
  }

  const showWhResults = screenType === "whcomplete"
  const showIMResults = screenType === "imcomplete"

  /* ──────────────── video source ──────────────── */
  const videoSrc =
    screenType === "wh" ? bmiWH :
      screenType === "im" ? biaIm :
        null

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

            {/* Title Frame */}
            <div className="relative flex items-center justify-center">
              <img
                src={textframe}
                alt="text-frame"
                className="w-full"
              />

              <p className="absolute text-white text-center portrait:text-[32px] tracking-wider mt-14">
                {currentText.title}
              </p>
            </div>

            {/* Bottom Decorative Frame */}
            <img
              src={textframe}
              alt="text-frame"
              className="rotate-180  mt-10"
            />

            {/* Description OUTSIDE frame */}
            <p className="mt-6 text-white font-medium tracking-tight landscape:text-4xl portrait:text-[46px] text-center">
              {currentText.description}
            </p>

          </div>
        </div>
        {/* SVG Result Frames (whcomplete screen) */}
        {showWhResults && (
          <HeightWeightComplete
            heightValue={heightValue}
            weightValue={weightValue}
            onNextClick={onNextClick}
          />
        )}
      </div>

      {/* ─── VIDEO + FLOATING BIA CARDS ─── */}
      {videoSrc && (
        <div
          className="absolute inset-0 flex justify-center items-end mb-22 xl:items-center xl:justify-center z-10 pointer-events-none mt-[26rem]"
          style={{ position: "absolute" }}
        >
          {/* wrapper keeps cards relative to the video */}
          <div style={{ position: "relative", width: "60%", display: "flex", justifyContent: "center" }}>
            {/* video */}
            <video
              key={videoSrc}
              src={videoSrc}
              autoPlay
              loop
              playsInline
              className="rounded-4xl object-cover w-full "
            />

            {/* ── floating metric cards (im screen only) ── */}
            {screenType === "im" &&
              BIA_METRICS.map((metric, i) => (
                <BiaMetricCard
                  key={metric.key}
                  metric={metric}
                  value={biaValues[metric.key]}
                  isSettled={isSettled}
                  index={i}
                />
              ))}
          </div>
        </div>
      )}

      {/* imcomplete overlay */}
      {screenType === "imcomplete" && (
        <ImComplete onNextClick={onImNextClick} arms50k={arms50k} />
      )}
    </>
  )
}