import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import bg1 from "../../../assets/lightbg.png"
// NOTE: submitLandoltCResponse is assumed to live in utils/api.js, mirroring
// getColorBlindessPlates / colorBlindessStart in ColorBlindPlate.jsx. If your
// real function has a different name/signature, update this import and the
// single call site in handleAnswer below — the payload shape stays the same.
// import { submitLandoltCResponse } from '../../../utils/api'
import { pickRandomDirection, computeEyeResult, EYE_TYPE } from './constants';
import InstructionScreen from './InstructionScreen';
import GameScreen from './GameScreen';
import CompletedModal from './CompletedModal';

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/*                                                                      */
/*  Flow:                                                              */
/*   1. Right eye instruction screen -> Start                          */
/*   2. Right eye test: correct advances a size level (1-9);           */
/*      wrong -> 1 retry at same level with a new gap direction;       */
/*      wrong again -> right eye test ends                             */
/*   3. Left eye instruction screen -> Start                           */
/*   4. Left eye test: identical rule                                  */
/*   5. When the left eye test ends (pass or fail) -> completed modal  */
/*      is shown overlaid on top of that final GameScreen (it stays    */
/*      mounted/frozen, disabled, rather than being unmounted).        */
/* ------------------------------------------------------------------ */
export default function AdaptiveEyeVisionC({ onComplete } = {}) {
  // Same redux shape ColorBlindPlate.jsx reads from — user_id/session_id for
  // the response payload below come from here rather than props.
  const user = useSelector((state) => state.common.user)
  const screening = useSelector((state) => state.common.screening)
  // NOTE: this fallback UUID mirrors the dev fallback already used in
  // ColorBlindPlate.jsx — worth confirming that's intentional for prod.
  const userId = user?.data?.user_id || "bdabcfad-558f-4d36-9cfd-5deaedfdd629"
  const sessionId = screening?.sessionId

  const [phase, setPhase] = useState('instruction'); // 'instruction' | 'testing' | 'modal'
  const [eye, setEye] = useState('right');
  const [level, setLevel] = useState(1);
  const [attempt, setAttempt] = useState(1);
  const [direction, setDirection] = useState(() => pickRandomDirection());
  const [feedback, setFeedback] = useState(null); // { dirId, correct }
  const [locked, setLocked] = useState(false);

  // Highest level correctly identified so far *for the eye currently being
  // tested* — reset to 0 at the start of each eye. This is what "HOW ACUITY
  // IS SCORED FOR EACH EYE" is computed from once the eye's test ends.
  const [lastPassedLevel, setLastPassedLevel] = useState(0);
  const [results, setResults] = useState({ right: null, left: null });

  const handleStart = () => {
    setLevel(1);
    setAttempt(1);
    setLastPassedLevel(0);
    setDirection(pickRandomDirection());
    setPhase('testing');
  };

  // passedLevel is passed explicitly (rather than read back off state)
  // because this fires from inside the same setTimeout tick that may have
  // just called setLastPassedLevel — reading state here could still see
  // the pre-update value.
  const finishEye = (passedLevel) => {
    const eyeResult = computeEyeResult(passedLevel);
    setResults((prev) => ({ ...prev, [eye]: eyeResult }));

    if (eye === 'right') {
      setEye('left');
      setLastPassedLevel(0);
      setPhase('instruction');   // <-- left eye's InstructionScreen, not straight into testing
    } else {
      setPhase('modal');
    }
  };

  const handleAnswer = (chosenId) => {
    if (locked) return;
    const correct = chosenId === direction;
    setLocked(true);
    setFeedback({ dirId: chosenId, correct });

    // Log this tap — every attempt, including the retry — as its own
    // payload. Sent immediately (not inside the setTimeout below) so it
    // captures level/attempt/direction exactly as shown for this item;
    // fire-and-forget so a slow/failed network call never delays the
    // 700ms feedback animation.
    // submitLandoltCResponse({
    //   user_id: userId,
    //   session_id: sessionId,
    //   type: EYE_TYPE[eye],
    //   size_level: level,
    //   retry: attempt,
    //   right_direction: direction,
    //   response: chosenId,
    //   outcome: correct,
    // }).catch((err) => {
    //   console.warn('[AdaptiveEyeVisionC] Failed to submit response:', err.message)
    // })

    setTimeout(() => {
      setFeedback(null);
      setLocked(false);

      if (correct) {
        setLastPassedLevel(level); // this level is now the last one passed
        if (level >= 9) {
          finishEye(level); // passed the smallest line — chart complete for this eye
        } else {
          setLevel((l) => l + 1);
          setAttempt(1);
          setDirection((prev) => pickRandomDirection(prev));
        }
      } else if (attempt === 1) {
        setAttempt(2);
        setDirection((prev) => pickRandomDirection(prev)); // retry, same level, new gap
      } else {
        finishEye(lastPassedLevel); // 2 consecutive misses at this level — eye test ends
      }
    }, 700);
  };

  const restart = () => {
    setEye('right');
    setLevel(1);
    setAttempt(1);
    setLastPassedLevel(0);
    setDirection(pickRandomDirection());
    setFeedback(null);
    setLocked(false);
    setResults({ right: null, left: null });
    setPhase('instruction');
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Background */}
      <div
        className="absolute inset-0 bg-center bg-cover z-0 opacity-50"
        style={{ backgroundImage: `url(${bg1})` }}
      />

      {/* Content */}
      <div className="absolute inset-0 z-10 flex flex-col items-center overflow-y-auto pt-20 gap-10">
        {phase === 'instruction' && <InstructionScreen eye={eye} onStart={handleStart} />}
        {/* GameScreen now also renders during 'modal' (frozen + disabled)
            so CompletedModal overlays on top of the last question instead
            of the screen going blank behind it. */}
        {(phase === 'testing' || phase === 'modal') && (
          <GameScreen
            eye={eye}
            level={level}
            attempt={attempt}
            direction={direction}
            feedback={feedback}
            locked={locked || phase === 'modal'}
            onAnswer={handleAnswer}
          />
        )}
      </div>

      {phase === 'modal' && <CompletedModal results={results} onNext={restart} />}
    </div>
  );
}
