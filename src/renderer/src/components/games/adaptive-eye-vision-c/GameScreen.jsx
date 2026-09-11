import DirectionPad from './DirectionPad';
import { SIZE_LEVELS } from './constants';

/* ------------------------------------------------------------------ */
/*  Active test screen                                                 */
/* ------------------------------------------------------------------ */
export default function GameScreen({ eye, level, attempt, direction, feedback, locked, onAnswer }) {
  let statusText = null;
  if (feedback) {
    statusText = feedback.correct ? 'Correct!' : attempt === 1 ? 'Incorrect — try again' : 'Incorrect';
  }

  // Ring size is driven by the current level — this is the actual adaptive
  // acuity mechanic (see SIZE_LEVELS / KIOSK_CONFIG above). eye/attempt are
  // still tracked in state and available here (e.g. analytics, debug
  // overlay) — just not rendered as a visible caption, to match the
  // reference design.
  const sizeLevel = SIZE_LEVELS[level - 1] ?? SIZE_LEVELS[0];

  return (
    <div className="flex flex-col items-center gap-10 w-full pb-16">
      <p
        className="text-[#8BC3E5] text-center font-anta w-[90%] max-w-[900px] pt-20"
        style={{ fontSize: 'clamp(1rem, 3vw, 2rem)' }}
      >
        Look at the C shape and tap the matching gap button
      </p>

      <div className="w-[75%] max-w-[920px] h-screen">
        <DirectionPad
          direction={direction}
          disabled={locked}
          feedback={feedback}
          onAnswer={onAnswer}
          ringSizePx={sizeLevel.pxSize}
        />
      </div>
    </div>
  );
}
