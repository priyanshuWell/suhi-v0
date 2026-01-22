import React, { useState, useEffect } from 'react'
import biaResultFrame from '../../assets/biaResultFrame.svg'
import bg1 from '../../assets/lightbg.png'
import { useLocation, useNavigate } from 'react-router'
import ErrorAlert from '../ErrorAlert'
import download_report from '../../assets/download_report.png'
import { useSelector } from 'react-redux'
import { Dumbbell, Ruler, Calculator, Droplets } from 'lucide-react'
import axios from "axios"
import BodyConstitution from './BodyConstitution'
import droplet from '../../assets/droplet.png'
import { useTranslation } from 'react-i18next'
const BIAResult = () => {
  const navigate = useNavigate()
  const location = useLocation()

  // Read from Redux store (primary source)
  const storeWeight = useSelector((state) => state.common.weight)
  const storeHeight = useSelector((state) => state.common.height)
  const storeBiaResult = useSelector((state) => state.common.biaResult)

  // Fallback to navigation state for backward compatibility
  const bia = storeBiaResult || location.state?.biaResult
  const weight = storeWeight || location.state?.weight
  const height = storeHeight || location.state?.height
  const { t } = useTranslation()
  const [showError, setShowError] = useState(false)

  // ✅ API State
  const [apiReport, setApiReport] = useState(null)

  // ✅ Missing emojis added
  const animalEmojis = {
    Lion: '🦁',
    Deer: '🦌',
    Dolphin: '🐬',
    Owl: '🦉',
    Eagle: '🦅',
  }

  const learnerTypeConfig = {
    visual: {
      emoji: '👀',
      icon: '👀',
      bgColor: 'from-[#e8f4f8]/80 to-[#d0e8f0]/80',
      borderColor: 'green-400'
    },
    auditory: {
      emoji: '👂',
      icon: '👂',
      bgColor: 'from-[#e8f4f8]/80 to-[#d0e8f0]/80',
      borderColor: 'green-400'
    },
    kinesthetic: {
      emoji: '🙌',
      icon: '🙌',
      bgColor: 'from-[#e8f4f8]/80 to-[#d0e8f0]/80',
      borderColor: 'green-400'
    },
    reading: {
      emoji: '📖',
      icon: '📖',
      bgColor: 'from-[#e8f4f8]/80 to-[#d0e8f0]/80',
      borderColor: 'green-400'
    },
    integrated: {
      emoji: '🧠',
      icon: '🧠',
      bgColor: 'from-[#e8f4f8]/80 to-[#d0e8f0]/80',
      borderColor: 'green-400'
    }
  }

  // ✅ fallback JSON for NULL sections
  const fallbackPartialJson = {
    success: true,
    user_id: "bc242a07-a8a4-4397-a7c8-d898bf50b4d5",
    session_id: "7318cade-bbac-43a8-bf7f-4c8463bcbfe7",
    data: {
      height: null,
      weight: null,
      body_constitution: {
        vata: 0,
        pitta: 50,
        kapha: 50
      },
      hydration: null,
      learner_type: {
        type: "kinesthetic",
        title: "When studying your ears are your hero ",
        subtitle: "When studying, all your senses are your heroes.",
        description: "Listen, Discuss, and Explain out Loud"
      },
      personality: {
        type: "Balanced",
        animal: "You are an Eagle",
        traits: ["Confident", "Expressive", "Kind", "Thoughtful"]
      }
    }
  }



  const constitution = apiReport?.body_constitution;

  const vata = Number(constitution?.vata ?? 0);
  const pitta = Number(constitution?.pitta ?? 0);
  const kapha = Number(constitution?.kapha ?? 0);

  // svg bar max width (same as your rect width)
  const BAR_MAX = 235.765;

  // Make safe percent 0-100
  const clamp = (n) => Math.min(100, Math.max(0, n));

  const vataW = (clamp(vata) / 100) * BAR_MAX;
  const pittaW = (clamp(pitta) / 100) * BAR_MAX;
  const kaphaW = (clamp(kapha) / 100) * BAR_MAX;


  // ✅ Merge API response with fallback only if null
  const mergeWithFallback = (apiData) => {
    const api = apiData?.data || {}

    return {
      height: api?.height ?? fallbackPartialJson?.data?.height,
      weight: api?.weight ?? fallbackPartialJson?.data?.weight,

      body_constitution: api?.body_constitution ?? fallbackPartialJson?.data?.body_constitution,
      hydration: api?.hydration ?? fallbackPartialJson?.data?.hydration,
      learner_type: api?.learner_type ?? fallbackPartialJson?.data?.learner_type,
      personality: api?.personality ?? fallbackPartialJson?.data?.personality,
    }
  }



  const fetchBiometricReport = async () => {
    try {
      const payload = { user_id: "ndekne" };

      const res = await axios.post("/biometric-report/generate", payload);

      // ✅ if API response is valid & success
      if (res?.data?.success && res?.data?.data) {
        const merged = mergeWithFallback(res.data);
        setApiReport(merged);
        return;
      }

      // ✅ if API returns invalid structure / success false
      console.log("⚠️ API success false / data missing. Using fallback JSON...");
      setApiReport(fallbackPartialJson.data);
    } catch (err) {
      console.log("❌ biometric-report API error:", err);

      // ✅ API failed completely → show fallback data
      setApiReport(fallbackPartialJson.data);
    }
  };


  useEffect(() => {
    fetchBiometricReport()
  }, [])

  // Check for errors when component mounts
  useEffect(() => {
    if (!bia) {
      setShowError(true)
    }
  }, [bia])

  console.log(apiReport)

  // ✅ Final Data Source:
  // - height/weight from API (if exists)
  // - else from redux/location
  const finalHeight = 170 ?? height
  const finalWeight = 70 ?? weight



  const analysisData = {
    hydration: apiReport?.hydration,
    studyTip: apiReport?.learner_type
      ? {
        title: apiReport.learner_type.title,
        description: apiReport.learner_type.description
      }
      : null,
    personality: apiReport?.personality
      ? {
        animal: (apiReport.personality.animal || "").replace("You are a ", ""),
        traits: apiReport.personality.traits || []
      }
      : null
  };


  console.log(analysisData)

  // Learner type icon
  const learnerType = apiReport?.learner_type?.type?.toLowerCase()
  const learnerEmoji = learnerTypeConfig?.[learnerType]?.emoji || "👂"

  const vataText = `${clamp(vata).toFixed(0)}%`;
  const pittaText = `${clamp(pitta).toFixed(0)}%`;
  const kaphaText = `${clamp(kapha).toFixed(0)}%`;


  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-black">
      <div
        className="absolute inset-0 bg-no-repeat bg-cover bg-center z-0 opacity-60"
        style={{ backgroundImage: `url(${bg1})` }}
      />

      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4">
        <h1 className="text-white w-[50%] text-center text-4xl leading-10 tracking-wider font-bold ">
          {t('bia_result.congratulations')}
          <br />
          {t('bia_result.here_are_results')} </h1>
        {/* The Frame Container */}
        <div className="relative w-full max-w-[1080px]">
          <img
            src={biaResultFrame}
            alt="BIA Frame"
            className="w-full mb-[33px] h-auto object-contain drop-shadow-[0_0_25px_rgba(6,182,212,0.6)]"
          />

          <div className="absolute inset-0 flex flex-col items-center pt-[18%] pb-[8%] px-[14%] text-white">
            <div className="w-full flex justify-between gap-6 mb-8">
              <div className="flex-1 bg-black/50 border border-cyan-500/30 rounded-3xl p-6 flex flex-col items-center justify-center backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                <div className="flex items-center gap-3 text-cyan-400 mb-2">
                  <Dumbbell size={32} className="fill-cyan-400/20 rotate-45" />
                  <span className="uppercase tracking-widest text-xl font-bold">{t('bia_result.weight')}</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">
                  {Number(finalWeight) || 55} <span className="text-3xl text-gray-400 font-medium">kg</span>
                </div>
              </div>

              <div className="flex-1 bg-black/50 border border-cyan-500/30 rounded-3xl p-6 flex flex-col items-center justify-center backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                <div className="flex items-center gap-3 text-cyan-400 mb-2">
                  <Ruler size={32} className="rotate-45" />
                  <span className="uppercase tracking-widest text-xl font-bold">{t('bia_result.height')}</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">
                  {Number(finalHeight) || 156.3}
                  <span className="text-3xl text-gray-400 font-medium"> cm</span>
                </div>
              </div>
            </div>

            <div className="flex-grow"></div>

            <div className="w-[50%] h-1/2 flex justify-center items-center mb-3 ">
              <div className="w-full">
                <BodyConstitution
                  vata={apiReport?.body_constitution?.vata}
                  pitta={apiReport?.body_constitution?.pitta}
                  kapha={apiReport?.body_constitution?.kapha}
                />
              </div>
            </div>

            {/* ✅ Hydration Card */}
            <div
              className="rounded-[10px] p-6 mb-6 w-full"
              style={{
                background: 'linear-gradient(180deg, rgba(41, 171, 226, 0.05) 0%, rgba(41, 171, 226, 0.2) 100%)',
                border: '0.5px solid #29ABE2',
                borderRadius: '10px'
              }}
            >
              <div className="flex flex-col items-center justify-center text-center gap-3">
                <div className="flex items-center justify-center gap-3">
                  <img src={droplet} className="text-cyan-400 w-7 h-7" />

                  <h3 className="text-[#29ABE2] text-[25px] tracking-wide">
                    {t('bia_result.hydration')} -{" "}
                    <span
                      className={
                        analysisData?.hydration?.level === "Low"
                          ? "text-red-400"
                          : "text-red-400"
                      }
                    >
                      {analysisData?.hydration?.level || "Low"}
                    </span>
                  </h3>
                </div>

                <p className="text-white/90 text-2xl pt-1 tracking-wider">
                  {analysisData?.hydration?.message ||
                    t('bia_result.hydration_low_message')}
                </p>
              </div>
            </div>

            {/* ✅ Study Tip Card */}
            <div
              className="rounded-[10px] p-6 mb-6 w-full"
              style={{
                background: 'linear-gradient(180deg, rgba(41, 171, 226, 0.05) 0%, rgba(41, 171, 226, 0.2) 100%)',
                border: '0.5px solid #29ABE2',
                borderRadius: '10px'
              }}
            >
              <div className="flex flex-col items-center justify-center text-center gap-3">
                <div className="flex items-center justify-center gap-3">
                  <span className="text-4xl">{learnerEmoji}</span>
                  <h3 className="text-[#2CEF94] text-[24px] font-bold tracking-wide">
                    {analysisData?.studyTip?.title || t('bia_result.study_tip_default')}
                  </h3>
                </div>

                <p className="text-white/90 text-2xl tracking-wider">
                  {analysisData?.studyTip?.description ||
                    t('bia_result.study_tip_default')}
                </p>
              </div>
            </div>

            {/* ✅ Personality/Animal Card */}
            <div
              className="rounded-[10px] p-6 mb-8 w-[100%]     bg-gradient-to-b
    from-[rgba(195,68,0,0.2)]
    to-[rgba(195,68,0,0.05)]
    border
    border-[#FEE45A]/80
    shadow-[0_8px_30px_rgba(195,68,0,0.25)] "
              style={{
                background: "linear - gradient(180deg, rgba(255, 157, 92, 0.2) 0 %, rgba(255, 157, 92, 0.05) 100 %)",
                border: " 0.5px solid #FEE45A",
                borderRadius: "10px"

              }}
            >
              <div className="text-center mb-4">
                <h3 className="text-orange-300 text-3xl font-bold">
                  <span className="text-5xl mb-2 inline-block">
                    {animalEmojis[analysisData?.personality?.animal] || "🦅"}
                  </span> {analysisData?.personality?.animal || "Lion"}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(analysisData?.personality?.traits || []).map((trait, index) => (
                  <div
                    key={index}
                    style={{
                      background: " rgba(255, 255, 255, 0.1)",
                      border: " 1px solid rgba(255, 157, 92, 0.3)",
                      borderRadius: "10px"
                    }}
                    className="py-3 text-center text-white/90 text-xl"
                  >
                    {trait}
                  </div>
                ))}
              </div>
            </div>


            <button
              onClick={() => navigate('/welcome')}
              style={{
                backgroundBlendMode: "plus-darker",
                boxShadow: "0px 3.57697px 28.6158px #9AD9FF",
              }}
              className="
    relative
    mt-8
    mb-[14rem]
    flex items-center justify-center
    text-center

    rounded-[30px]
    px-[5rem]
    py-[2rem]

    text-white
    text-4xl
    tracking-wide

    /* 🔹 more transparent bg */
    bg-[#0b0f14]/70
    mix-blend-plus-darker

    drop-shadow-[0_0_25px_rgba(6,182,212,0.6)]
    shadow-[0_0_40px_rgba(0,200,255,0.45)]
    shadow-[inset_0_0_12px_rgba(255,255,255,0.08)]

    border border-white/10

    before:content-['']
    before:absolute
    before:inset-0
    before:rounded-[20px]
    before:bg-gradient-to-b
    before:from-white/12
    before:via-white/4
    before:to-transparent
    before:pointer-events-none

    active:scale-[0.98]
    transition-transform duration-300 ease-in-out
  "
            >
              {t('bia_result.go_to_homepage')}
            </button>


          </div>
        </div>
        <div className="absolute bottom-[50px] ">
          <img
            src={download_report}
            alt="hologram"
            className="landscape:w-[300px] portrait:w-[640px] drop-shadow-[0_0_40px_rgba(0,200,255,0.8)]"
          />
        </div>
      </div>

      {/* <ErrorAlert
        visible={showError}
        title="BIA Result Error"
        description="Failed to load BIA result data. Redirecting to home..."
        onClose={() => setShowError(false)}
        // onRetry={() => navigate('/')}
        autoRetryDelay={3000}
      /> */}
    </div >
  )
}

export default BIAResult


