import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import bg1 from "../../../assets/lightbg.png"
import { visualAcuityStart, visualAcuitySubmit, visualAcuityComplete } from '../../../utils/api'
import { pickRandomDirection, computeEyeResult, SIZE_LEVELS } from './constants';
import InstructionScreen from './InstructionScreen';
import GameScreen from './GameScreen';
import CompletedModal from './CompletedModal';
import { setScreening } from '../../../features/common/commonSlice';
import { getNextRoute } from '../../../utils/stageRouter';
import { useSetProgressStage } from '../../ProgressStageContext';

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
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.common.user)
  const screening = useSelector((state) => state.common.screening)
  const userId = user?.data?.user_id || "bdabcfad-558f-4d36-9cfd-5deaedfdd629"
  const screeningId = screening?.screeningId
  const sessionId = screening?.sessionId;
  const setProgressStage = useSetProgressStage();
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
  const [completeResult, setCompleteResult] = useState(null);

  // One game session covers both eyes — created once up front (mirrors
  // colorBlindessStart in ColorBlindPlate.jsx) and reused for every
  // per-attempt submit + the final complete call.
  const [gameSessionId, setGameSessionId] = useState(null);
  const [starting, setStarting] = useState(false);

  // Show progress bar only on the instruction screen (right & left eye)
  useEffect(() => {
    setProgressStage(phase === 'instruction');
  }, [phase, setProgressStage]);

  const startSession = async () => {
    setStarting(true);
    try {
      const res = await visualAcuityStart(userId, sessionId);
      if (res.success) {
        setGameSessionId(res?.data?.game_session_id ?? null);
      } else {
        console.warn('[AdaptiveEyeVisionC] Failed to start session:', res.error);
      }
    } catch (err) {
      console.warn('[AdaptiveEyeVisionC] Failed to start session:', err.message);
    }
  };

  useEffect(() => {
    startSession();
  }, []);

  const handleStart = () => {
    setLevel(1);
    setAttempt(1);
    setLastPassedLevel(0);
    setDirection(pickRandomDirection());
    setPhase('testing');
  };

  const finishEye = (passedLevel) => {
    const eyeResult = computeEyeResult(passedLevel);
    setResults((prev) => ({ ...prev, [eye]: eyeResult }));

    if (eye === 'right') {
      setEye('left');
      setLastPassedLevel(0);
      setPhase('instruction');   // <-- left eye's InstructionScreen, not straight into testing
    } else {
      setPhase('modal');
      visualAcuityComplete(gameSessionId, screeningId)
        .then((res) => {
          if (res?.screening) {
            dispatch(setScreening(res.screening))
          }
          setCompleteResult(res)
        })
        .catch((err) => {
          console.warn('[AdaptiveEyeVisionC] Failed to complete session:', err.message)
        })
    }
  };

  const handleAnswer = (chosenId) => {
    if (locked) return;
    const correct = chosenId === direction;
    setLocked(true);
    setTimeout(() => {
      setLocked(false);
    }, 150);

    visualAcuitySubmit({
      userId,
      sessionId,
      gameSessionId,
      eyeType: eye,
      sizeLevel: level,
      snellen: SIZE_LEVELS[level - 1]?.snellen,
      attempt,
      gapDirection: direction,
      response: chosenId,
      outcome: correct,
    }).catch((err) => {
      console.warn('[AdaptiveEyeVisionC] Failed to submit response:', err.message);
    });

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
  };

  const handleModalNext = () => {
    const nextStage = completeResult?.screening?.next_stage ?? screening?.nextStage
    const route = getNextRoute(nextStage, "/beat-drop")
    navigate(route)
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
    setGameSessionId(null);
    setPhase('instruction');
    startSession();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black font-anta">
      {/* Background */}
      <div
        className="absolute inset-0 bg-center bg-cover z-0 opacity-50"
        style={{ backgroundImage: `url(${bg1})` }}
      />

      {/* Content */}
      <div className="absolute inset-0 z-10 flex flex-col items-center  pt-20">
        <AnimatePresence mode="wait">
          {phase === 'instruction' ? (
            <motion.div
              key={`instruction-${eye}`}
              className="w-full flex flex-col items-center gap-10"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <InstructionScreen
                eye={eye}
                onStart={handleStart}
              />
            </motion.div>
          ) : (
            <motion.div
              key="game-screen"
              className="w-full flex flex-col items-center gap-10"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              {/* GameScreen now also renders during 'modal' (frozen + disabled)
                  so CompletedModal overlays on top of the last question instead
                  of the screen going blank behind it. */}
              <GameScreen
                eye={eye}
                level={level}
                attempt={attempt}
                direction={direction}
                feedback={feedback}
                locked={locked || phase === 'modal'}
                onAnswer={handleAnswer}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {phase === 'modal' && (
          <CompletedModal key="completed-modal" results={results} onNext={handleModalNext} />
        )}
      </AnimatePresence>
    </div>
  );
}
