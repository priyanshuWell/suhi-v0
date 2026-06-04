import { useEffect, useState } from 'react'
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

const renderInsightCard = ({
  title,
  icon,
  titleClassName,
  cardClassName,
  items,
  separatorClassName,
  footer,
  footerClassName,
  borderColor
}) => (
  <div className={`relative w-full rounded-[10px] px-5 py-3 overflow-hidden ${cardClassName} border border-${borderColor || 'white/20'}`}>

    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-[220px] h-[220px] bg-[#3EC6FF]/20 blur-[70px] rounded-full" />
    </div>

    <div className="relative z-10">

      <div className="mx-auto flex items-center justify-center text-center w-fit">
        <div className="flex items-center justify-center gap-2.5 px-3 py-1">
          <span className="text-[28px] leading-none">{icon}</span>
          <h3 className={`text-[22px] tracking-[0.12em] ${titleClassName}`}>
            {title}
          </h3>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch">
        {items.map((item, index) => (
          <div key={item.label} className="contents">

            <div className="flex flex-col items-center justify-center px-4 py-6 text-center relative">

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[140px] h-[100px] rounded-full blur-[40px] bg-white/15" />
              </div>

              <div className="relative z-10 flex flex-col items-center justify-center">
                <p className="text-[15px] text-white/75 tracking-[0.1em] font-light">
                  {item.label}
                </p>

                <p
                  className={`mt-2.5 text-[28px] leading-tight tracking-[0.06em] font-medium ${item.valueClassName || 'text-white'}`}
                >
                  {item.value}
                </p>
              </div>

            </div>

            {index < items.length - 1 ? (
              <div className="flex items-center justify-center">
                <div className={`h-8 w-[1.5px] rounded-full ${separatorClassName}`} />
              </div>
            ) : null}

          </div>
        ))}
      </div>

      {/* Footer */}
      {footer ? (
        <p className={`mt-2 text-center text-[15px] tracking-[0.06em] font-light ${footerClassName || 'text-white/80'}`}>
          {footer}
        </p>
      ) : null}

    </div>
  </div>
);

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
    height: 170,
    weight: 70,

    body_constitution: {
      vata: 34,
      pitta: 40,
      kapha: 26
    },

    hydration: {
      level: "Low",
      message: "Increase your water intake for better performance"
    },

    learner_type: {
      type: "integrated",
      title: "You learn best using multiple methods",
      description: "Use visual, auditory, and hands-on techniques together"
    },

    personality: {
      animal: "Balanced",
      traits: ["Calm", "Adaptive", "Focused"]
    },

    attention: {
      tracking_accuracy: 55,
      level: "Medium"
    },

    memory: {
      score: 3,
      level: "Beginner"
    },

    self_esteem: {
      level: "Average",
      jitter: 1.5,
      shimmer: 4
    },

    emotional_regulation: {
      level: "Good",
      details: {
        jitter: "Good",
        pitch: "Good",
        pace: "Average"
      }
    },

    color_blindness: {
      status: "Not Present"
    },

    muscle_mass: {
      level: "Ideal"
    },

    fat_mass: {
      level: "Ideal"
    }
  };


  const constitution = apiReport?.body_constitution;

  const vata = Number(constitution?.vata ?? 0);
  const pitta = Number(constitution?.pitta ?? 0);
  const kapha = Number(constitution?.kapha ?? 0);

  // ✅ Merge API response with fallback only if null
  const mergeWithFallback = (api) => {
    return {
      height: api?.height ?? fallbackPartialJson.height,
      weight: api?.weight ?? fallbackPartialJson.weight,

      body_constitution:
        api?.body_constitution ?? fallbackPartialJson.body_constitution,

      hydration: api?.hydration ?? fallbackPartialJson.hydration,

      learner_type: api?.learner_type ?? fallbackPartialJson.learner_type,

      personality: api?.personality ?? fallbackPartialJson.personality,

      attention: api?.attention ?? fallbackPartialJson.attention,

      memory: api?.memory ?? fallbackPartialJson.memory,

      self_esteem: api?.self_esteem ?? fallbackPartialJson.self_esteem,

      emotional_regulation:
        api?.emotional_regulation ?? fallbackPartialJson.emotional_regulation,

      color_blindness:
        api?.color_blindness ?? fallbackPartialJson.color_blindness,

      muscle_mass: api?.muscle_mass ?? fallbackPartialJson.muscle_mass,

      fat_mass: api?.fat_mass ?? fallbackPartialJson.fat_mass
    };
  };
  const mapReportToUI = (api) => {
    if (!api) return null;

    const data = api.data;

    return {
      height: data?.bia?.height_cm ?? null,
      weight: data?.bia?.weight_kg ?? null,

      body_constitution: data?.prakriti
        ? {
          vata: data.prakriti.vata,
          pitta: data.prakriti.pitta,
          kapha: data.prakriti.kapha,
        }
        : null,

      hydration: data?.bia?.hydration
        ? { level: data.bia.hydration }
        : null,

      learner_type: data?.learning_style
        ? {
          type: data.learning_style.toLowerCase(),
          title: `Your learning style is ${data.learning_style}`,
          description: "Personalized learning recommendation",
        }
        : null,

      personality: data?.personality
        ? {
          animal: data.personality,
          traits: [data.personality],
        }
        : null,

      attention: data?.attention,
      memory: data?.memory,
      self_esteem: data?.self_esteem,
      emotional_regulation: data?.emotional_regulation,

      color_blindness: data?.color_blindness
        ? { status: data.color_blindness }
        : null,

      muscle_mass: {
        level: data?.bia?.muscle_mass?.status,
      },
      fat_mass: {
        level: data?.bia?.fat_mass?.status,
      },
    };
  };



  const fetchBiometricReport = async () => {
    try {
      const userId = storeUser?.data?.user_id;
      const sessionId = storeUser?.data?.buffer_id;

      const res = await axios.post("http://localhost:8000/report/", {
        user_id: userId,
        session_id: storeUser?.screening?.session_id,
        screening_session_id: storeUser?.screening?.session_id
      });

      console.log("✅ /report response:", res.data);

      if (res?.data?.success) {
        const mapped = mapReportToUI(res.data);
        const merged = mergeWithFallback(mapped);
        setApiReport(merged);
        return;
      }

      setApiReport(fallbackPartialJson);
    } catch (err) {
      console.log("❌ report API error:", err);
      setApiReport(fallbackPartialJson);
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
      label: 'Emotion Regulation',
      value: formatLabel(apiReport?.emotional_regulation?.level, 'Good'),
      valueClassName: 'text-[#29ABE2]',
    },
    {
      label: 'Self-Esteem',
      value: formatLabel(apiReport?.self_esteem?.level, 'Average'),
      valueClassName: 'text-[#29ABE2]',
    },
    {
      label: 'Personality',
      value: formatLabel(apiReport?.personality?.animal, 'Balanced'),
      valueClassName: 'text-[#29ABE2]',
    }
  ];

  const learningItems = [
    {
      label: 'Divided Attention',
      value: formatLabel(apiReport?.attention?.level, 'Medium'),
      valueClassName: 'text-[#2CEF94]',
    },
    {
      label: 'Cognitive Flexibility',
      value: formatLabel(apiReport?.memory?.level, 'Beginner'),
      valueClassName: 'text-[#2CEF94]',
    },
    {
      label: 'Learning Style',
      value: formatLabel(apiReport?.learner_type?.type, 'Integrated'),
      valueClassName: 'text-[#2CEF94]',
    }
  ];

  const healthItems = [
    {
      label: t('bia_result.height'),
      value: `${formatLabel(finalHeight, '--')} cm`,
      valueClassName: 'text-[#2CEF94]',
      icon: HeightIcon,
      unit: 'cm'
    },
    {
      label: t('bia_result.weight'),
      value: `${formatLabel(finalWeight, '--')} kg`,
      valueClassName: 'text-[#2CEF94]',
      icon: WeightIcon,
      unit: 'kg'
    },
    {
      label: t('bia_result.hydration'),
      value: hydrationLevel,
      valueClassName: 'text-[#2CEF94]'
    }
  ]

  const hasInsightCardsData = Boolean(
    apiReport?.personality || apiReport?.learner_type || apiReport?.color_blindness
  )

  const healthSummaryItems = [
    {
      label: t('bia_result.hydration'),
      value: hydrationLevel,
    },
    {
      label: 'Muscle Mass',
      value: formatLabel(apiReport?.muscle_mass?.level, 'Ideal'),
    },
    {
      label: 'Fat Mass',
      value: formatLabel(apiReport?.fat_mass?.level, 'Ideal'),
    }
  ];


  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-black">
      <div
        className="absolute inset-0 bg-no-repeat bg-cover bg-center z-0 opacity-60"
      // style={{ backgroundImage: `url(${bg1})` }}
      />

      <div className="relative z-10 flex min-h-full w-full flex-col items-center p-4 pb-6">
        <h1 className="mt-4 w-[80%] text-center text-4xl leading-10 tracking-wider font-bold text-white">
          {t('bia_result.congratulations')}
          <br />
          {t('bia_result.here_are_results')}
        </h1>

        {/* The Frame Container */}
        <div className="relative mt-8 max-w-[1080px] m-10 "
          style={{
            boxShadow: "0px 35.76px 176.82px rgba(154, 217, 255, 0.5)"
          }}>
          <img
            src={biaResultFrame}
            alt="BIA Frame"
            style={{
              filter: `drop-shadow(0px 35.76px 176.82px rgba(154, 217, 255, 0.5))`
            }}
            className="w-full h-auto object-contain"
          />

          <div className="absolute inset-0 flex flex-col items-center gap-4 px-[8.5%] pb-[18%] pt-[6%] text-white overflow-hidden">

            {/* Body Constitution - Circular Chart */}
            <div className="w-full flex justify-center items-center mb-1">
              <div className="w-full">
                <BodyConstitution
                  vata={apiReport?.body_constitution?.vata}
                  pitta={apiReport?.body_constitution?.pitta}
                  kapha={apiReport?.body_constitution?.kapha}
                />
              </div>
            </div>

            {hasInsightCardsData ? (
              <div className="w-full flex flex-col gap-6">
                {/* Mind Card */}
                {renderInsightCard({
                  title: "Persona",
                  icon: <MindIcon />,
                  titleClassName: "text-[#29ABE2]",
                  cardClassName:
                    "bg-[linear-gradient(180deg,rgba(41,171,226,0.05)_0%,rgba(41,171,226,0.1)_100%)] border-[#29ABE2] rounded-[12px]",
                  items: feelingsItems,
                  separatorClassName: "bg-[#29ABE2]",
                  borderColor: '#29ABE2',
                })}

                {/* Brain Card */}
                {renderInsightCard({
                  title: "Mind",
                  icon: <BrainIconS />,
                  titleClassName: "text-[#2CEF94]",
                  cardClassName:
                    "bg-[linear-gradient(180deg,rgba(44,239,148,0.05)_0%,rgba(44,239,148,0.2)_100%)] border-[#2CEF94] rounded-[12px]",
                  items: learningItems,
                  separatorClassName: "bg-[#2CEF94]",
                  // footer: "Visual",
                  footerClassName: "text-[#2CEF94]",
                  borderColor: '#2CEF94',

                })}

                {/* Body Card */}
                <div className="w-full rounded-[12px] border-[0.5px] border-[#FF9D5C] bg-[linear-gradient(180deg,rgba(255,157,92,0.05)_0%,rgba(255,157,92,0.2)_100%)] px-5 py-3">
                  <div className="mx-auto flex w-fit items-center justify-center text-center">
                    <div className="flex items-center justify-center gap-2.5 px-3 py-1">
                      <span className="text-[22px] leading-none"><img src={BodyIcon} alt='body icon' /></span>
                      <h3 className="text-[22px] tracking-[0.12em] text-[#FF9D5C]">Body</h3>
                    </div>
                  </div>

                  {/* Height & Weight row */}
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    {healthItems.slice(0, 2).map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-center gap-3 rounded-[4px] border border-white/20 bg-[rgba(0,0,0,0.6)] px-4 py-3 shadow-[0_0_20px_rgba(255,255,255,0.05)_inset]"
                      >

                        <div className="flex items-center gap-2">
                          <img
                            src={item.icon}
                            alt={item.label}
                            className="w-[20px] h-[20px] object-contain"
                          />
                          <p className="text-[18px] text-white/80 tracking-[0.08em] font-light">
                            {item.label}</p>
                        </div>

                        {/* 🔹 RIGHT → Value + Unit (separate control) */}
                        <div className="flex items-baseline">
                          <p className="text-[26px] leading-none text-[#FF9D5C] font-medium">
                            {parseInt(item.value).toFixed(2)}
                          </p>

                          {item.unit && (
                            <span className=" text-[14px] text-white/60">
                              {item.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Hydration / Muscle / Fat row */}
                  <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch px-2">
                    {healthSummaryItems.map((item, index) => (
                      <div key={item.label} className="contents">
                        <div className="flex flex-col items-center justify-center px-4 py-6 text-center relative">
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-[140px] h-[100px] rounded-full blur-[40px] bg-white/15" />
                          </div>

                          {/* Content */}
                          <div className="relative z-10">
                            <p className="text-[15px] text-white/78 tracking-[0.1em] font-light">
                              {item.label}
                            </p>
                            <p className="mt-2.5 text-[26px] leading-tight tracking-[0.06em] text-[#FFAB6B] font-medium">
                              {item.value}
                            </p>
                          </div>
                        </div>

                        {/* Separator */}
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
                <div className="w-full rounded-[12px] border-[0.5px] border-[#FFE15C] bg-[linear-gradient(180deg,rgba(255,225,92,0.05)_0%,rgba(255,225,92,0.2)_100%)] px-5 py-3.5">
                  <div className="flex items-center justify-center gap-3 text-center">
                    <span className="text-[22px] leading-none"><img className='w-[36px] h-[36px]' src={Eye_Icon} alt='eye icon' /> </span>
                    <h3 className="text-[20px] tracking-[0.12em] text-[#FFE15C]">
                      Color Blindness-
                    </h3>
                    <span className="text-[22px] tracking-[0.06em] text-white font-medium ml-1">
                      {formatLabel(apiReport?.color_blindness?.status, 'Not present')}
                    </span>
                  </div>
                </div>
              </div>
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
