import { useEffect } from 'react';
import { Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BlueGradientButton from '../../ui/BlueGradientButton';
import adaptive from '../../../assets/adaptive-c/AdaptiveEyeVisionC.png';
import handCoverGif from '../../../assets/adaptive-c/hand_cover.gif';
import { EYE_INFO } from './constants';
import { useKioskAudio } from '../../../constants/audio';
import { INSTRUCTION_AUDIO } from '../../../constants/audioConstants';

/* ------------------------------------------------------------------ */
/*  Instruction screen — shown before each eye's test                  */
/* ------------------------------------------------------------------ */
export default function InstructionScreen({ eye, onStart, disabled = false, loading = false }) {
  const { t } = useTranslation();
  const info = EYE_INFO[eye];
  const { play, stop } = useKioskAudio();

  useEffect(() => {
    let cancelled = false;

    const sequence = eye === 'right'
      ? [
        { key: INSTRUCTION_AUDIO.VISUAL_ACUITY_LETS_LEARN_HOW_TO_PLAY, delay: 0 },
        { key: INSTRUCTION_AUDIO.VISUAL_ACUITY_COVER_YOUR_LEFT_EYE, delay: 250 },
        { key: INSTRUCTION_AUDIO.VISUAL_ACUITY_LOOK_CAREFULLY_AT_THE_C_SHAPE, delay: 250 },
        { key: INSTRUCTION_AUDIO.VISUAL_ACUITY_PRESS_START_WHEN_READY, delay: 250 },
      ]
      : [
        { key: INSTRUCTION_AUDIO.VISUAL_ACUITY_COVER_YOUR_RIGHT_EYE, delay: 0 },
        { key: INSTRUCTION_AUDIO.VISUAL_ACUITY_PRESS_START_WHEN_READY, delay: 250 },
      ];

    const runSequence = async () => {
      for (const { key, delay } of sequence) {
        if (cancelled) break;
        if (delay > 0) {
          await new Promise((res) => setTimeout(res, delay));
        }
        if (cancelled) break;
        await play(key);
      }
    };

    runSequence();

    return () => {
      cancelled = true;
      stop();
    };
  }, [eye, play, stop]);

  const handleStart = () => {
    stop();
    onStart?.();
  };
  const isLeftCover = info.cover === 'left';

  return (
    <>
      {/* Title */}
      <div className="mt-12 z-10 w-[80%]">
        <div className="relative text-center flex flex-col items-center gap-20">
          <p
            className="text-white text-center tracking-wider my-5 font-anta"
            style={{ fontSize: 'clamp(1rem, 4vw, 4rem)' }}
          >
            {t('adaptiveEye.instruction.title')}
          </p>
        </div>
      </div>

      {/* Cover-eye instruction */}
      <p
        className="text-[#8BC3E5] text-center font-anta w-[90%] max-w-[1149px]"
        style={{ fontSize: 'clamp(2rem, 4vw, 4rem)' }}
      >
        {t('adaptiveEye.instruction.cover_eye', { eye: t(`adaptiveEye.eyes.${info.cover}`) })}
      </p>

      {/* Eye with Hand covering it */}
      <div className="relative flex items-center justify-center w-72 h-36 sm:w-96 sm:h-48 md:w-[460px] md:h-[230px] text-white my-2">
        <Eye className="w-20 h-20 sm:w-20 sm:h-20 text-white" strokeWidth={2.5} />
        <img
          src={handCoverGif}
          alt={`Cover ${info.cover} eye`}
          className={`absolute inset-0 w-full h-full object-contain pointer-events-none ${isLeftCover ? 'scale-x-[-1]' : ''
            }`}
        />
      </div>

      {/* How-to instruction */}
      <p
        className="text-[#8BC3E5] text-center font-anta w-[90%] max-w-[900px]"
        style={{ fontSize: 'clamp(2rem, 3vw, 4rem)' }}
      >
        {t('adaptiveEye.instruction.tap_gap')}
      </p>

      {/* Direction pad preview */}
      <div className="relative overflow-hidden rounded-3xl w-[70%]  min-h-[700px] my-14 flex  items-center justify-center">
        <img src={adaptive} alt="cover" className="w-full h-full object-cover" />
      </div>

      {/* Start button */}
      <div className="flex flex-col items-center gap-2 pb-16">
        <BlueGradientButton onClick={onStart}>
          {t('common.start')}
        </BlueGradientButton>
      </div>
    </>
  );
}
