import LandoltC from './LandoltC';
import DirectionButton from './DirectionButton';
import TapHint from './TapHint';
import { DIRECTIONS, PAD_RADIUS_PERCENT, SIZE_LEVELS } from './constants';

/* ------------------------------------------------------------------ */
/*  Direction pad, center holds the Landolt C ring.                    */
/*  Buttons are positioned on a circle via trig (angle -> x/y %)       */
/*  rather than a 3x3 CSS grid — a plain grid puts the diagonal        */
/*  (corner) buttons noticeably farther from center than the cardinal  */
/*  (edge) buttons, which doesn't match the reference design, where    */
/*  all 8 buttons sit at roughly the same radius.                      */
/*  PAD_RADIUS_PERCENT is the one knob to tune spacing on real         */
/*  hardware — it's a % of the pad's half-width/half-height.           */
/* ------------------------------------------------------------------ */
export default function DirectionPad({ direction, disabled, feedback, onAnswer, hintDirId, ringSizePx = SIZE_LEVELS[0].pxSize }) {
  const activeRot = DIRECTIONS.find((d) => d.id === direction)?.rot ?? 0;

  return (
    <div className="bg-white rounded-3xl p-10 mt-44 sm:p-8 w-full min-h-[60%] flex items-center justify-center">
      <div className="relative w-full max-w-[660px] aspect-square">
        {/* center Landolt C ring */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* min-width/height keeps the wrapper from collapsing to 0 at the
              smallest levels (~2.8px) so layout stays stable; the ring
              itself still renders at its true acuity size. */}
          <div style={{ minWidth: 50, minHeight: 50 }} className="flex items-center justify-center">
            <LandoltC rotationDeg={activeRot} size={ringSizePx} className="text-slate-900" />
          </div>
        </div>

        {/* 8 direction buttons placed on a circle around the ring */}
        {DIRECTIONS.map((dir) => {
          const rad = (dir.angle - 90) * (Math.PI / 180); // angle 0 = "up" on screen
          const x = 50 + PAD_RADIUS_PERCENT * Math.cos(rad);
          const y = 50 + PAD_RADIUS_PERCENT * Math.sin(rad);
          return (
            <div
              key={dir.id}
              className="absolute"
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
            >
              <DirectionButton
                dir={dir}
                disabled={disabled}
                feedback={feedback && feedback.dirId === dir.id ? (feedback.correct ? 'correct' : 'incorrect') : null}
                onClick={() => onAnswer(dir.id)}
              />
              {hintDirId === dir.id && <TapHint />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
