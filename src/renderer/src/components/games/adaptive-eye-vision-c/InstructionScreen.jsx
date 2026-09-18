import { Eye } from 'lucide-react';
import BlueGradientButton from '../../ui/BlueGradientButton';
import adaptive from '../../../assets/adaptive-c/AdaptiveEyeVisionC.png';
import handCoverGif from '../../../assets/adaptive-c/hand_cover.gif';
import { EYE_INFO } from './constants';

/* ------------------------------------------------------------------ */
/*  Instruction screen — shown before each eye's test                  */
/* ------------------------------------------------------------------ */
export default function InstructionScreen({ eye, onStart, disabled = false, loading = false }) {
  const info = EYE_INFO[eye];
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
            Vision Test
          </p>
        </div>
      </div>

      {/* Cover-eye instruction */}
      <p
        className="text-[#8BC3E5] text-center font-anta w-[90%] max-w-[1149px]"
        style={{ fontSize: 'clamp(2rem, 4vw, 4rem)' }}
      >
        Cover your {info.cover} eye with your hand.
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
        Look at the C shape and tap the matching gap button
      </p>

      {/* Direction pad preview */}
      <div className="relative overflow-hidden rounded-3xl w-[70%]  min-h-[700px] my-14 flex  items-center justify-center">
        <img src={adaptive} alt="cover" className="w-full h-full object-cover" />
      </div>

      {/* Start button */}
      <div className="flex flex-col items-center gap-2 pb-16">
        <BlueGradientButton onClick={onStart}>
          Start
        </BlueGradientButton>
      </div>
    </>
  );
}
