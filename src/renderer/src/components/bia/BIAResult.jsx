import { useEffect, useState } from 'react'
import biaResultFrame from '../../assets/biaResultFrame1.svg'
import { useNavigate } from 'react-router'
import { useSelector } from 'react-redux'
import axios from "axios"
import BodyConstitution from './BodyConstitution'
import droplet from '../../assets/droplet.png'
import { useTranslation } from 'react-i18next'
import { releaseAllResources } from '../../utils/cleanup'

const renderInsightCard = ({
  title,
  icon,
  titleClassName,
  cardClassName,
  items,
  separatorClassName,
  footer,
  footerClassName
}) => (
  <div className={`w-full rounded-[10px] border-[0.5px] px-5 py-3 ${cardClassName}`}>
    <div className="mx-auto flex items-center justify-center text-center w-fit">
      <div className="flex items-center justify-center gap-2.5 px-3 py-1">
        <span className="text-[22px] leading-none">{icon}</span>
        <h3 className={`text-[20px] tracking-[0.12em] ${titleClassName}`}>{title}</h3>
      </div>
    </div>

    <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch">
      {items.map((item, index) => (
        <div key={item.label} className="contents">
          <div className="flex flex-col items-center justify-center px-4 py-3 text-center shadow-[0_0_44px_rgba(255,255,255,0.05)_inset]">
            <p className="text-[14px] text-white/75 tracking-[0.1em] font-light">{item.label}</p>
            <p className="mt-2 text-[22px] leading-tight text-white tracking-[0.06em] font-medium">
              {item.value}
            </p>
          </div>
          {index < items.length - 1 ? (
            <div className="flex items-center justify-center">
              <div className={`h-8 w-[1.5px] rounded-full ${separatorClassName}`} />
            </div>
          ) : null}
        </div>
      ))}
    </div>

    {footer ? (
      <p className={`mt-2 text-center text-[15px] tracking-[0.06em] font-light ${footerClassName || 'text-white/80'}`}>{footer}</p>
    ) : null}
  </div>
)

const BIAResult = () => {
  const navigate = useNavigate()

  // Read from Redux store (primary source)
  const storeWeight = useSelector((state) => state.common.weight)
  const storeHeight = useSelector((state) => state.common.height)
  const storeUser = useSelector((state) => state.common.user)
  console.log("`BIAResult storeUser:", storeUser, storeHeight, storeHeight);
  const { t } = useTranslation()

  // ✅ API State
  const [apiReport, setApiReport] = useState(null)

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

  const fallbackPartialJson = {
    success: true,
    user_id: "bc242a07-a8a4-4397-a7c8-d898bf50b4d5",
    session_id: "7318cade-bbac-43a8-bf7f-4c8463bcbfe7",
    data: {
      height: null,
      weight: null,

      body_constitution: storeUser?.data?.student_name?.toLowerCase().includes("mukul")
        ? {
          vata: 0,
          pitta: 60,
          kapha: 30
        }
        : {
          vata: 40,
          pitta: 60,
          kapha: 0
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
  };


  const constitution = apiReport?.body_constitution;

  const vata = Number(constitution?.vata ?? 0);
  const pitta = Number(constitution?.pitta ?? 0);
  const kapha = Number(constitution?.kapha ?? 0);

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
      const userId = storeUser?.data?.user_id;
      const sessionId = storeUser?.data?.buffer_id;

      const payload = {
        user_id: userId,
        session_id: sessionId,
      };

      const res = await axios.post("http://localhost:8000/biometric-report/generate", payload);
      console.log("✅ biometric-report API response:", res);
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
    const timer = setTimeout(() => {
      fetchBiometricReport()
    }, 0)

    return () => clearTimeout(timer)
  }, [])

  console.log(apiReport)

  // ✅ Final Data Source:
  // - height/weight from API (if exists)
  // - else from redux/location

  // after reshaping the redux store we now keep weights/heights in nested objects
  const finalHeight = (storeHeight && storeHeight.finalHeight) || apiReport?.height || 170;

  const finalWeight = (storeWeight && storeWeight.finalWeight) || apiReport?.weight || 70;


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

  const formatLabel = (value, fallback = 'Not Available') => {
    if (value === null || value === undefined || value === '') return fallback
    return String(value)
  }

  const titleCase = (value) =>
    formatLabel(value, '')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim()

  const learnerStyleLabel = titleCase(learnerType) || 'Balanced'
  const personalityTraits = analysisData?.personality?.traits || []
  const personalityAnimal = formatLabel(analysisData?.personality?.animal, 'Balanced')
  const hydrationLevel = formatLabel(analysisData?.hydration?.level, 'Low')
  const hydrationMessage =
    analysisData?.hydration?.message || t('bia_result.hydration_low_message')

  const primaryDosha = [
    { key: 'Vata', value: vata },
    { key: 'Pitta', value: pitta },
    { key: 'Kapha', value: kapha }
  ].sort((a, b) => b.value - a.value)[0]?.key || 'Balanced'

  const feelingsItems = [
    {
      label: 'Emotion',
      value: formatLabel(personalityTraits[0], 'Balanced')
    },
    {
      label: 'Self-esteem',
      value: formatLabel(apiReport?.personality?.type, 'Balanced')
    },
    {
      label: 'Personality',
      value: personalityAnimal
    }
  ]

  const learningItems = [
    {
      label: 'Attention',
      value: formatLabel(personalityTraits[1], 'Focused')
    },
    {
      label: 'Memory',
      value: formatLabel(personalityTraits[2], 'Developing')
    },
    {
      label: 'Learning Style',
      value: learnerStyleLabel
    }
  ]

  const healthItems = [
    {
      label: t('bia_result.height'),
      value: `${formatLabel(finalHeight, '--')} cm`
    },
    {
      label: t('bia_result.weight'),
      value: `${formatLabel(finalWeight, '--')} kg`
    },
    {
      label: t('bia_result.hydration'),
      value: hydrationLevel
    }
  ]

  const hasInsightCardsData = Boolean(
    apiReport?.personality || apiReport?.learner_type || apiReport?.color_blindness
  )

  const healthSummaryItems = [
    {
      label: t('bia_result.hydration'),
      value: hydrationLevel
    },
    {
      label: 'Muscle Mass',
      value: formatLabel(apiReport?.muscle_mass?.level, 'Optimal')
    },
    {
      label: 'Fat Mass',
      value: formatLabel(apiReport?.fat_mass?.level, 'Low')
    }
  ]


  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-black">
      <div
        className="absolute inset-0 bg-no-repeat bg-cover bg-center z-0 opacity-60"
      // style={{ backgroundImage: `url(${bg1})` }}
      />

      <div className="relative z-10 flex min-h-full w-full flex-col items-center p-4 pb-6">
        <h1 className="mt-4 w-[50%] text-center text-4xl leading-10 tracking-wider font-bold text-white">
          {t('bia_result.congratulations')}
          <br />
          {t('bia_result.here_are_results')} </h1>

        {/* The Frame Container */}
        <div className="relative mt-4 w-full max-w-[1080px]">
          <img
            src={biaResultFrame}
            alt="BIA Frame"
            className="w-full mb-[33px] h-auto object-contain drop-shadow-[0px_35.76px_176.82px_0px_rgba(154,217,255,0.5)]"
          />

          <div className="absolute inset-0 flex flex-col items-center gap-3 px-[14%] pb-[7%] pt-[13%] text-white">

            {/* Body Constitution - Circular Chart */}
            <div className="w-full flex justify-center items-center mb-2">
              <div className="w-full">
                <BodyConstitution
                // vata={apiReport?.body_constitution?.vata}
                // pitta={apiReport?.body_constitution?.pitta}
                // kapha={apiReport?.body_constitution?.kapha}
                />
              </div>
            </div>

            {hasInsightCardsData ? (
              <>
                {/* Feelings & Behavior Card */}
                {renderInsightCard({
                  title: "Feelings & Behavior",
                  icon: "🧠",
                  titleClassName: "text-[#29ABE2]",
                  cardClassName:
                    "bg-[linear-gradient(180deg,rgba(41,171,226,0.05)_0%,rgba(41,171,226,0.1)_100%)] border-[#29ABE2]",
                  items: feelingsItems,
                  separatorClassName: "bg-[#29ABE2]",
                })}

                {/* Learning & Thinking Card */}
                {renderInsightCard({
                  title: "Learning & Thinking",
                  icon: learnerEmoji,
                  titleClassName: "text-[#2CEF94]",
                  cardClassName:
                    "bg-[linear-gradient(180deg,rgba(44,239,148,0.05)_0%,rgba(44,239,148,0.2)_100%)] border-[#2CEF94]",
                  items: learningItems,
                  separatorClassName: "bg-[#2CEF94]",
                  footer: analysisData?.studyTip?.description || analysisData?.studyTip?.title,
                  footerClassName: "text-[#2CEF94]"
                })}

                {/* Health & Growth Card */}
                <div className="w-full rounded-[10px] border-[0.5px] border-[#FF9D5C] bg-[linear-gradient(180deg,rgba(255,157,92,0.05)_0%,rgba(255,157,92,0.2)_100%)] px-5 py-4">
                  <div className="mx-auto flex w-fit items-center justify-center text-center">
                    <div className="flex items-center justify-center gap-2.5 px-3 py-1">
                      <span className="text-[22px] leading-none">🧍</span>
                      <h3 className="text-[20px] tracking-[0.12em] text-[#FF9D5C]">Health & Growth</h3>
                    </div>
                  </div>

                  {/* Height & Weight row */}
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    {healthItems.slice(0, 2).map((item) => (
                      <div
                        key={item.label}
                        className="flex min-h-[60px] items-center justify-center gap-4 rounded-[4px] border border-white/20 bg-[rgba(0,0,0,0.6)] px-4 py-3 text-center shadow-[0_0_20px_rgba(255,255,255,0.05)_inset]"
                      >
                        <p className="text-[15px] text-white/85 tracking-[0.1em] font-light">{item.label}</p>
                        <p className="text-[22px] leading-none tracking-[0.06em] text-[#FF9D5C] font-medium">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Hydration / Muscle / Fat row */}
                  <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch px-2">
                    {healthSummaryItems.map((item, index) => (
                      <div key={item.label} className="contents">
                        <div className="flex flex-col items-center justify-center px-4 py-3 text-center shadow-[0_0_44px_rgba(255,157,92,0.08)_inset]">
                          <p className="text-[14px] text-white/78 tracking-[0.1em] font-light">{item.label}</p>
                          <p className="mt-2 text-[22px] leading-tight tracking-[0.06em] text-[#FFAB6B] font-medium">
                            {item.value}
                          </p>
                        </div>
                        {index < healthSummaryItems.length - 1 ? (
                          <div className="flex items-center justify-center">
                            <div className="h-8 w-[1.5px] rounded-full bg-[#FF9D5C]" />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Color Blindness Card */}
                <div className="w-full rounded-[10px] border-[0.5px] border-[#FFE15C] bg-[linear-gradient(180deg,rgba(255,225,92,0.05)_0%,rgba(255,225,92,0.2)_100%)] px-5 py-4">
                  <div className="flex items-center justify-center gap-3 text-center">
                    <span className="text-[22px] leading-none">👀</span>
                    <h3 className="text-[20px] tracking-[0.12em] text-[#FFE15C]">
                      Color Blindness -
                    </h3>
                    <span className="text-[22px] tracking-[0.06em] text-white font-medium">
                      {formatLabel(apiReport?.color_blindness?.status, 'Not present')}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full rounded-[10px] border-[0.5px] border-[#29ABE2] bg-[linear-gradient(180deg,rgba(41,171,226,0.05)_0%,rgba(41,171,226,0.1)_100%)] p-5">
                <div className="flex flex-col items-center justify-center gap-2.5 text-center">
                  <div className="flex items-center justify-center gap-2.5">
                    <img src={droplet} className="h-6 w-6 text-cyan-400" />
                    <h3 className="text-[22px] tracking-wide text-[#29ABE2]">
                      {t('bia_result.hydration')} - <span className="text-white">{hydrationLevel}</span>
                    </h3>
                  </div>

                  <p className="pt-0.5 text-xl tracking-wider text-white/90">{hydrationMessage}</p>
                </div>
              </div>
            )}

            {/* Go to Homepage Button */}
            <button
              onClick={() => {
                releaseAllResources()
                navigate('/welcome')
              }}
              style={{
                backgroundBlendMode: "plus-darker",
                boxShadow: "0px 3.57697px 28.6158px #9AD9FF",
              }}
              className="
    relative
    mt-6
    mb-6
    flex items-center justify-center
    text-center

    rounded-[24px]
    px-[4rem]
    py-[1.4rem]

    text-white
    text-3xl
    tracking-wide

    bg-[#0b0f14]/70
    mix-blend-plus-darker

    drop-shadow-[0_0_25px_rgba(6,182,212,0.6)]
    shadow-[0_0_40px_rgba(0,200,255,0.45)]
    shadow-[inset_0_0_12px_rgba(255,255,255,0.08)]

    border border-white/10

    before:content-['']
    before:absolute
    before:inset-0
    before:rounded-[24px]
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
        {/* <div className="absolute bottom-[50px] ">
          <img
            src={download_report}
            alt="hologram"
            className="landscape:w-[300px] portrait:w-[640px] drop-shadow-[0_0_40px_rgba(0,200,255,0.8)]"
          />
        </div> */}
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
