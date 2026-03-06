import React, { useEffect, useRef, useState } from "react";
import { useBackgroundCamera } from "../../services/BackgroundCameraProvider";
import { BIAComponent } from "./BIAComponents";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import ErrorAlert from "../ErrorAlert";
import { useDispatch, useSelector } from "react-redux";
import { setBiaResult, setLegBiaResult, setHeight, setWeight, setArmBiaResult, setSessionId } from "../../features/common/commonSlice";
import { measureHeight } from "../../utils/measurementUtils";
import { storePreliminaryMeasurements } from "../../utils/measurementRedux";
import { BIAComplete, BIAMeasurementStage } from "../../utils/api";
import { mapArmsPayloadToBIAMeasurement, mapLegsPayloadToBIAMeasurement } from "../../utils/dataCoverter";
import { trackStage } from "../../utils/config";
export default function BIACalculate({ user, onComplete }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const storeUser = useSelector((state) => state.common.user);
  // const { updateMetadata, clearMetadata } = useBackgroundCamera();

  // Base state
  const [ports, setPorts] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStatus, setCurrentStatus] = useState("");
  const [errorState, setErrorState] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [barefootCTAVisible, setBarefootCTAVisible] = useState(false);
  const [isShoesContinued, setIsShoesContinued] = useState(false);
  const barefootCTAResolver = useRef(null);

  // Phase tracking (removed attempt counters - now using parameters)
  const [currentPhase, setCurrentPhase] = useState('init'); // init, leg, wh, arm, impedance, complete

  // const trackStage = async (stage, status, data = {}, error = null) => {
  //   const payload = {
  //     session_id: storeUser?.data.buffer_id,
  //     user_id: storeUser?.data?.user_id || "unknown",
  //     measurement_stage: stage,
  //     status: status,
  //     retry_reason: error,
  //     attempt_number: attemptTracking.current[stage.toLowerCase()] || 1,
  //     measurement_timestamp: new Date().toISOString(),
  //     data: {
  //       ...data,

  //     }
  //   };

  //   try {
  //     // Replace with your actual fetch/axios call to /bia/measurement/stage
  //     await BIAMeasurementStage(payload);
  //   } catch (err) {
  //     console.error(`[API ERROR] Failed to track stage ${stage}:`, err);
  //   }
  // };
  const resultsRef = useRef({
    legImpedance: null,
    weight: null,
    preWeight: null,
    height: null,
    preHeight: null,
    armImpedance: null,
    impedance: { k20: null, k100: null }
  });
  const STAGES = {
    LEG_50KHZ: "LEG_50KHZ",
    LEG_BIA_50KHZ: "BIA_50KHZ_LEG_4ELECTRODE",
    ARM_50KHZ: "ARM_50KHZ",
    ARM_BIA_50KHZ: "BIA_50KHZ_HAND_4ELECTRODE",
    WH_FINAL: "WH_FINAL",
    IMPDEDANCE_20_100KHZ: "IMPEDANCE_20_100KHZ",
    HEIGHT: "HEIGHT",
    PRE_HEIGHT: "PRE_HEIGHT",
    WEIGHT: "WEIGHT",
    PRE_WEIGHT_LEG: "PRE_WEIGHT_LEG",
    BIA_COMPLETE: "BIA_COMPLETE",
  }

  const STATUS = {
    PARTIAL: "PARTIAL",
    SUCCESS: "SUCCESS",
    ERROR: "ERROR",
  }
  const MAX_RETRIES = 2;

  const timeoutRefs = useRef({
    global: null,
    step: null,
  });

  // No local recording state needed anymore


  // Error messages map
  const ERROR_MESSAGES = {
    legImpedance_noWeight: "Please step on the platform barefoot",
    legImpedance_hasWeight: "Please make sure you are barefoot",
    weight: "Please step on the platform barefoot",
    height: "Please stand straight & still",
    armImpedance: "Please hold the rods firmly",
    impedance20: "Please hold the rods firmly",
    impedance100: "Please hold the rods firmly",
    maxRetryReached: "Maximum retries reached. redirecting to dmit.",
    HEIGHT_PORT_NOT_CONNECTED: "Height port is not connected"
  };

  const texts = {
    wh: {
      title: t("measurement.let_measure"),
      description: currentStatus || t("measurement.standStill"),
    },
    im: {
      title: t("measurement.good_job"),
      description: currentStatus || t("measurement.holdThe_Hands"),
    },
    whcomplete: {
      title: "Good Job!",
      description: "Weight and Height Measurement Completed!",
    },
    imcomplete: {
      title: "Good Job!",
      description: "Body Composition Analysis Complete!",
    }
  };
  /* =======================
     EVENT LISTENERS - Receive errors/status from main process (bia-scriptv1.js)
  ======================= */
  // Attempt tracking for threshold-based error detection
  const attemptTracking = useRef({
    leg: 0,
    arm: 0,
    impedance20: 0,
    impedance100: 0,
    height: 0
  });

  const ATTEMPT_THRESHOLDS = {
    leg: 25,         // Show error after 15 attempts (~7.5 seconds)
    arm: 15,         // Show error after 15 attempts
    impedance20: 20, // Show error after 20 attempts
    impedance100: 20,
    height: 30       // 30 polling cycles (~6 seconds)
  };

  // Flag to prevent multiple error triggers
  const errorTriggered = useRef({
    leg: false,
    arm: false,
    impedance20: false,
    impedance100: false,
    height: false
  });
  useEffect(() => {
    console.log("[BIA DEBUG] Setting up event listeners for main process events...");

    // Status handlers - update UI with current measurement status
    const handleStatus = (payload) => {
      console.log("[BIA DEBUG] Status received:", payload);

      // Track attempts from status events
      if (payload.attempt) {
        if (payload.source === 'LEG') {
          attemptTracking.current.leg = payload.attempt;
        } else if (payload.source === 'ARM') {
          attemptTracking.current.arm = payload.attempt;
        } else if (payload.frequency === 20) {
          attemptTracking.current.impedance20 = payload.attempt;
        } else if (payload.frequency === 100) {
          attemptTracking.current.impedance100 = payload.attempt;
        }
      }

      // Show ERROR/WARNING messages in ErrorAlert ONLY ONCE after threshold
      if (payload.severity === "ERROR" || payload.severity === "WARNING") {
        if (payload.userMessage) {
          // Check if we should show this error based on attempt threshold
          let shouldShow = false;

          if (payload.source === 'LEG' && payload.attempt === ATTEMPT_THRESHOLDS.leg && !errorTriggered.current.leg) {
            shouldShow = true;
            errorTriggered.current.leg = true;
          } else if (payload.source === 'ARM' && payload.attempt === ATTEMPT_THRESHOLDS.arm && !errorTriggered.current.arm) {
            shouldShow = true;
            errorTriggered.current.arm = true;
          } else if (payload.frequency === 20 && payload.attempt === ATTEMPT_THRESHOLDS.impedance20 && !errorTriggered.current.impedance20) {
            shouldShow = true;
            errorTriggered.current.impedance20 = true;
          } else if (payload.frequency === 100 && payload.attempt === ATTEMPT_THRESHOLDS.impedance100 && !errorTriggered.current.impedance100) {
            shouldShow = true;
            errorTriggered.current.impedance100 = true;
          }

          if (shouldShow) {
            console.log(`[BIA DEBUG] Showing status error at attempt ${payload.attempt}: "${payload.userMessage}"`);
            // showError(payload.userMessage, 3000);
          } else {
            console.log(`[BIA DEBUG] Skipping duplicate error at attempt ${payload.attempt}`);
          }
        }
      }
      // Only update currentStatus for INFO messages
      else if (payload.severity === "INFO") {
        if (payload.userMessage) {
          // setCurrentStatus(payload.userMessage);
        }
      }
    };

    // LEG ERROR: Check if user is on platform (barefoot contact issue)
    const handleLegError = (payload) => {
      console.error("[BIA DEBUG] LEG ERROR received from main:", payload);
      console.error(`[BIA DEBUG] Leg attempt: ${payload.attempt}, code: ${payload.code}`);

      // Track attempt
      if (payload.attempt) {
        attemptTracking.current.leg = payload.attempt;
      }

      // ✅ ACTIVE ERROR TRIGGERING: Show error immediately when threshold exceeded
      if (payload.attempt >= ATTEMPT_THRESHOLDS.leg && !errorTriggered.current.leg) {
        if (payload.code === 'ELECTRODE') {
          console.error(`[BIA DEBUG] ⚠️ Leg ELECTRODE error at attempt ${payload.attempt} - TRIGGERING ERROR NOW!`);
          errorTriggered.current.leg = true;

          // Check weight to determine appropriate error message
          (async () => {
            try {
              const weightResult = await window.api.startWeightMeasurement();
              console.log("[BIA DEBUG] Weight check for leg error:", weightResult);

              if (weightResult?.weight && Number(weightResult.weight) > 1) {
                // User IS on platform but leg impedance failed → barefoot issue
                console.log(`[BIA DEBUG] Weight detected: ${weightResult.weight}kg - showing barefoot error`);
                await showError(ERROR_MESSAGES.legImpedance_hasWeight, 5000);
              } else {
                // User NOT on platform
                console.log("[BIA DEBUG] No weight detected - showing platform error");
                await showError(ERROR_MESSAGES.legImpedance_noWeight, 5000);
              }
            } catch (weightCheckError) {
              console.error("[BIA DEBUG] Weight check failed:", weightCheckError.message);
              await showError(ERROR_MESSAGES.legImpedance_noWeight, 5000);
            }
          })();
        }
      }
    };

    // ARM ERROR: Check if user is holding electrodes
    const handleArmError = (payload) => {
      console.error("[BIA DEBUG] ARM ERROR received from main:", payload);
      console.error(`[BIA DEBUG] Arm attempt: ${payload.attempt}, code: ${payload.code}`);

      // Track attempt
      if (payload.attempt) {
        attemptTracking.current.arm = payload.attempt;
      }

      // ✅ ACTIVE ERROR TRIGGERING: Show error immediately when threshold exceeded
      if (payload.attempt >= ATTEMPT_THRESHOLDS.arm && !errorTriggered.current.arm) {
        if (payload.code === 'ELECTRODE') {
          console.error(`[BIA DEBUG] ⚠️ Arm ELECTRODE error at attempt ${payload.attempt} - TRIGGERING ERROR NOW!`);
          errorTriggered.current.arm = true;

          // Show error immediately
          (async () => {
            console.log("[BIA DEBUG] Showing arm electrode error");
            await showError(ERROR_MESSAGES.armImpedance, 5000);
          })();
        }
      }
    };

    // WEIGHT ERROR
    const handleWeightError = (payload) => {
      console.error("[BIA DEBUG] WEIGHT ERROR received from main:", payload);
    };

    // HEIGHT ERROR
    const handleHeightError = async (payload) => {
      console.error("[BIA DEBUG] HEIGHT ERROR received from main:", payload);
      await showError(ERROR_MESSAGES.HEIGHT_PORT_NOT_CONNECTED, 3000);
      navigate('/screen1');

      // Track attempt for height (continuous polling)
      if (payload.attempt) {
        attemptTracking.current.height = payload.attempt;
      }
    };

    // IMPEDANCE ERROR (20kHz / 100kHz)
    const handleImpedanceError = (payload) => {
      console.error("[BIA DEBUG] IMPEDANCE ERROR received from main:", payload);
      console.error(`[BIA DEBUG] Impedance attempt: ${payload.attempt}, frequency: ${payload.frequency}`);

      // Track attempts
      if (payload.attempt) {
        if (payload.frequency === 20) {
          attemptTracking.current.impedance20 = payload.attempt;
        } else if (payload.frequency === 100) {
          attemptTracking.current.impedance100 = payload.attempt;
        }
      }
    };

    // Subscribe to events
    const unsubs = [
      window.api?.onLegError?.(handleLegError),
      window.api?.onLegStatus?.(handleStatus),
      window.api?.onArmError?.(handleArmError),
      window.api?.onArmStatus?.(handleStatus),
      window.api?.onWeightError?.(handleWeightError),
      window.api?.onWeightStatus?.(handleStatus),
      window.api?.onHeightError?.(handleHeightError),
      window.api?.onHeightStatus?.(handleStatus),
      window.api?.onImpedanceError?.(handleImpedanceError),
      window.api?.onImpedanceStatus?.(handleStatus),
      // 4-electrode BIA calculation results
      window.api?.onLegCalcResult?.((payload) => {
        console.log("[BIA DEBUG] Leg calc result received from main:", payload);
      }),
      window.api?.onArmCalcResult?.((payload) => {
        console.log("[BIA DEBUG] Arm calc result received from main:", payload);
      }),
    ];

    return () => {
      console.log("[BIA DEBUG] Cleaning up event listeners...");
      unsubs.forEach(unsub => unsub?.());
      // clearAllTimeouts();
    };
  }, []);

  /* =======================
     UTILITY FUNCTIONS
  ======================= */
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // const clearAllTimeouts = () => {
  //   console.log("[BIA DEBUG] Clearing all timeouts");
  //   if (timeoutRefs.current.global) {
  //     clearTimeout(timeoutRefs.current.global);
  //     timeoutRefs.current.global = null;
  //   }
  //   if (timeoutRefs.current.step) {
  //     clearTimeout(timeoutRefs.current.step);
  //     timeoutRefs.current.step = null;
  //   }
  // };

  const handleTimeout = (stepName) => {
    console.error(`[BIA DEBUG] ${stepName} TIMEOUT - redirecting to /screen1`);
    // clearAllTimeouts();
    setIsRunning(false);
    navigate("/screen1");
  };

  const withTimeout = (promise, timeoutMs, stepName) => {
    return new Promise((resolve, reject) => {
      console.log(`[BIA DEBUG] Setting timeout for ${stepName}: ${timeoutMs}ms`);
      timeoutRefs.current.step = setTimeout(() => {
        handleTimeout(stepName);
        reject(new Error(`${stepName} timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          console.log(`[BIA DEBUG] ${stepName} completed successfully`);
          if (timeoutRefs.current.step) {
            clearTimeout(timeoutRefs.current.step);
            timeoutRefs.current.step = null;
          }
          resolve(result);
        })
        .catch((error) => {
          console.error(`[BIA DEBUG] ${stepName} failed:`, error.message);
          if (timeoutRefs.current.step) {
            clearTimeout(timeoutRefs.current.step);
            timeoutRefs.current.step = null;
          }
          reject(error);
        });
    });
  };

  const showError = (message, duration = 5000) => {
    console.log(`[BIA DEBUG] Showing error: "${message}" for ${duration}ms`);
    setErrorState({
      title: message,
      canRetry: false,
    });
    return sleep(duration).then(() => {
      setErrorState(null);
    });
  };

  // const updatePhaseState = (phase, status, error = null) => {
  //   updateMetadata(`phase_${phase}`, {
  //     status,
  //     timestamp: new Date().toISOString(),
  //     error
  //   });
  // };

  /**
   * Shows the barefoot CTA modal and pauses the flow.
   * Returns a Promise that resolves with "retry" or "skip" when the user clicks.
   */
  const showBarefootCTA = () => {
    console.log("[BIA DEBUG] Showing barefoot CTA modal - flow paused");
    setBarefootCTAVisible(true);
    return new Promise((resolve) => {
      barefootCTAResolver.current = resolve;
    });
  };

  const handleBarefootChoice = (choice) => {
    console.log(`[BIA DEBUG] Barefoot CTA choice: "${choice}"`);
    setBarefootCTAVisible(false);
    if (barefootCTAResolver.current) {
      barefootCTAResolver.current(choice);
      barefootCTAResolver.current = null;
    }
  };

  // Use BackgroundCameraProvider for recording

  const measurePreliminaryWeight = async () => {
    console.log("[BIA DEBUG] Starting weight measurement...");
    // setCurrentStatus("Measuring your weight, please stand still!");
    const res = await window.api.startWeightMeasurement();
    console.log("[BIA DEBUG] Weight result:", res);

    // if (!res?.weight) {
    //   console.error("[BIA DEBUG] Weight measurement failed - no weight data");
    //   throw new Error("Weight failed");
    // }
    storePreliminaryMeasurements(dispatch, res.weight, null);

    resultsRef.current.preWeight = {
      value: Number(res.weight),
      unit: "kg"
    };
    // console.log(`[BIA DEBUG] Weight stored: ${res.weight} kg`);
    // dispatch(setWeight(resultsRef.current.preWeight?.value));
    return res;
  };

  const measureWeight = async () => {
    console.log("[BIA DEBUG] Starting weight measurement...");
    // setCurrentStatus("Measuring your weight, please stand still!");
    const res = await window.api.startWeightMeasurement();
    console.log("[BIA DEBUG] Weight result:", res);

    if (!res?.weight) {
      console.error("[BIA DEBUG] Weight measurement failed - no weight data");
      throw new Error("Weight failed");
    }
    // storePreliminaryMeasurements(dispatch, res.weight, null);

    resultsRef.current.weight = {
      value: Number(res.weight),
      unit: "kg"
    };
    console.log(`[BIA DEBUG] Weight stored: ${res.weight} kg`);
    dispatch(setWeight(resultsRef.current.weight?.value));
    return res;
  };

  const measureHeight = async () => {
    console.log("[BIA DEBUG] Starting height measurement...");
    // setCurrentStatus("Measuring your weight, please stand still!")
    console.log('[MEASUREMENT] Connecting to height port:');
    await window.api.connectHeightPort(ports[0]?.path);
    const res = await window.api.startHeightMeasurement();
    console.log("[BIA DEBUG] Height result:", res);

    if (!res?.height) {
      console.error("[BIA DEBUG] Height measurement failed - no height data");
      throw new Error("Height failed");
    }
    // storePreliminaryMeasurements(dispatch, res.weight, null);

    resultsRef.current.height = {
      value: Number(res.height),
      unit: "cm"
    };
    console.log(`[BIA DEBUG] Height stored: ${res.height} cm`);
    dispatch(setHeight(resultsRef.current.height?.value));
    return res;
  };
  const measureLegImpedance = async () => {
    console.log("[BIA DEBUG] Starting leg impedance 50kHz measurement...");
    // setCurrentStatus("Please ensure you are barefoot on the platform!");
    const res = await window.api.startLegImpedance50kHz();
    console.log("[BIA DEBUG] Leg impedance result:", res);

    if (!res?.success) {
      console.error("[BIA DEBUG] Leg impedance failed");
      throw new Error("Leg impedance failed");
    }

    resultsRef.current.legImpedance = {
      phaseAngle: res.measurement.phaseAngle.value,
      impedance: res.measurement.impedance.value,
      unit: res.measurement.impedance.unit,
      attempts: res.attempts
    };
    console.log(`[BIA DEBUG] Leg impedance stored: ${res.measurement.impedance.value} ${res.measurement.impedance.unit}`);
    return res;
  };

  const measureArmImpedance = async (attemptCount) => {
    console.log("[BIA DEBUG] Starting arm impedance 50kHz measurement...");
    // updatePhaseState('arm', 'in_progress');
    // setCurrentStatus("Please hold the hand rails firmly!");
    const res = await window.api.startArmImpedance50kHz();
    console.log("[BIA DEBUG] Arm impedance result:", res);

    if (!res?.success) {
      console.error("[BIA DEBUG] Arm impedance failed");
      // updatePhaseState('arm', 'failed', 'Arm impedance failed');
      await trackStage(STAGES.ARM_50KHZ, STATUS.ERROR, {}, "Arm impedance measurement failed", storeUser?.data?.buffer_id, storeUser?.data?.user_id, Number(attemptCount + 1));
      throw new Error("Arm impedance failed");

    }

    resultsRef.current.armImpedance = {
      phaseAngle: res.measurement.phaseAngle.value,
      impedance: res.measurement.impedance.value,
      unit: res.measurement.impedance.unit,
      attempts: res.attempts
    };
    console.log(`[BIA DEBUG] Arm impedance stored: ${res.measurement.impedance.value} ${res.measurement.impedance.unit}`);
    // updatePhaseState('arm', 'success');
    return res;
  };

  const measureImpedance = async (freq, attemptCount) => {
    console.log(`[BIA DEBUG] Starting impedance ${freq}kHz measurement...`);
    // updatePhaseState(`impedance${freq}`, 'in_progress');
    // setCurrentStatus(`Measuring impedance at ${freq}kHz...`);
    const res = await window.api.startImpedanceMeasurement(freq);
    console.log(`[BIA DEBUG] Impedance ${freq}kHz result:`, res);

    if (!res?.success) {
      console.error(`[BIA DEBUG] Impedance ${freq}kHz failed`);
      // updatePhaseState(`impedance${freq}`, 'failed', `Impedance ${freq}kHz failed`);
      await trackStage(STAGES.IMPDEDANCE_20_100KHZ, STATUS.ERROR, {}, "8 electrode impedance measurement failed", storeUser?.data?.buffer_id, storeUser?.data?.user_id, Number(attemptCount + 1));
      throw new Error("Arm impedance failed");
      // throw new Error(`Impedance ${freq}kHz failed`);
    }

    resultsRef.current.impedance[freq === "20" ? "k20" : "k100"] = {
      freq: Number(freq),
      unit: res.impedance.unit,
      avg: Number(res.impedance.avg.toFixed(1)),
      segments: res.impedance.segments
    };
    console.log(`[BIA DEBUG] Impedance ${freq}kHz stored: avg=${res.impedance.avg.toFixed(1)}Ω`);
    // updatePhaseState(`impedance${freq}`, 'success');
    return res;
  };

  /* =======================
     PHASE 1: LEG IMPEDANCE CHECK
     - If leg fails, check weight to determine error
  ======================= */
  const runPhase1_LegCheck = async (attemptCount = 0) => {
    console.log("[BIA DEBUG] ========== PHASE 1: LEG CHECK ==========");
    console.log(`[BIA DEBUG] Phase 1 attempt: ${attemptCount + 1}/${MAX_RETRIES}`);
    setCurrentPhase('leg');

    // Check if we've exhausted retries BEFORE attempting
    if (attemptCount >= MAX_RETRIES) {
      console.error(`[BIA DEBUG] Phase 1 EXHAUSTED all ${MAX_RETRIES} retries - redirecting to /screen1`);
      // updatePhaseState('leg', 'failed', 'Max retries exhausted');
      // showError(ERROR_MESSAGES.maxRetryReached, 4000);
      await BIAComplete({ session_id: storeUser?.data?.buffer_id });
      navigate("/screen1");
      return;
    }

    // Reset attempt tracking and error flags for leg
    attemptTracking.current.leg = 0;
    errorTriggered.current.leg = false;
    console.log("[BIA DEBUG] Reset leg attempt tracking and error flag");

    try {
      // updatePhaseState('leg', 'in_progress');
      await measureLegImpedance();

      console.log("[BIA DEBUG] Phase 1 SUCCESS - Leg impedance measured");
      await trackStage(STAGES.LEG_50KHZ, STATUS.SUCCESS, { impedance_data: { impedance_50khz_ohm: resultsRef.current.legImpedance.impedance } }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id);
      // updatePhaseState('leg', 'success');
      await sleep(800);

      // Success - proceed to Phase 2
      await runPhase2_WeightHeight();

    } catch (legError) {
      if (attemptCount >= MAX_RETRIES) {
        console.error(`[BIA DEBUG] Priyanshu Phase 3 EXHAUSTED all ${MAX_RETRIES} retries - redirecting to /screen1`);
        await trackStage(STAGES.LEG_50KHZ, STATUS.ERROR, {}, "Barefoot contact not detected", null, storeUser?.data?.buffer_id, storeUser?.data?.user_id, Number(attemptCount + 1));
        // updatePhaseState('leg', 'failed', 'Max retries exhausted');
        navigate("/screen1");
        return;
      }
      console.error("[BIA DEBUG] Phase 1 FAILED - Leg impedance error:", legError.message);

      // Check if user is on platform by trying weight measurement
      console.log("[BIA DEBUG] Checking if user is on platform via weight...");
      try {
        const weightResult = await measurePreliminaryWeight();
        console.log("[BIA DEBUG] Weight check result:", weightResult);
        if (weightResult.success) {
          await trackStage(STAGES.PRE_WEIGHT_LEG, STATUS.SUCCESS, { weight_kg: resultsRef.current.preWeight.value }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id, Number(attemptCount + 1));
        } else {
          await trackStage(STAGES.PRE_WEIGHT_LEG, STATUS.ERROR, {}, "leg and pre weight measurement failed", storeUser?.data?.buffer_id, storeUser?.data?.user_id, Number(attemptCount + 1));
        }
      } catch (weightCheckError) {
        console.error("[BIA DEBUG] Weight check also failed:", weightCheckError.message);
      }

      // Show blocking CTA modal and wait for user choice
      let choice = "retry";
      if (attemptCount === 0) {
        choice = await showBarefootCTA();
      }

      if (choice === "skip") {
        // User chose to continue with shoes - skip leg phase, go to Phase 2
        console.log("[BIA DEBUG] User chose 'Continue with Shoes' - skipping leg, going to Phase 2");
        setIsShoesContinued(true);
        // updatePhaseState('leg', 'skipped');
        await runPhase2_WeightHeight();
        return;
      }

      // User chose to remove shoes - retry leg from scratch
      console.log(`[BIA DEBUG] User chose 'Remove the Shoe' - retrying Phase 1 (attempt ${attemptCount + 1})...`);
      await sleep(500);
      await runPhase1_LegCheck(attemptCount + 1);
    }
  };

  /* =======================
     PHASE 2: WEIGHT & HEIGHT
     - After leg success, measure weight and height
     - If height fails, retry height only
  ======================= */
  const runPhase2_WeightHeight = async () => {
    console.log("[BIA DEBUG] ========== PHASE 2: WEIGHT & HEIGHT ==========");
    setCurrentPhase('wh');
    // updatePhaseState('weight', 'in_progress');
    // updatePhaseState('height', 'in_progress');

    try {
      // Measure Weight
      await measureWeight();
      await sleep(1200); // Required settle time
      console.log("[BIA DEBUG] Weight measurement SUCCESS");
      // updatePhaseState('weight', 'success');
      // await trackStage(STAGES.WEIGHT, STATUS.SUCCESS, { weight_kg: resultsRef.current?.weight?.value }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id);

      // Measure Height with retry logic
      await runHeightWithRetry();

    } catch (weightError) {
      console.error("[BIA DEBUG] Phase 2 FAILED - Weight error:", weightError.message);
      // updatePhaseState('weight', 'failed', weightError.message);
      await showError(ERROR_MESSAGES.weight, 3000);
      await trackStage(STAGES.WH_FINAL, STATUS.ERROR, {}, "main weight measurement failed", storeUser?.data?.buffer_id, storeUser?.data?.user_id);
      navigate("/screen1");
      return;
    }
  };

  const runHeightWithRetry = async (attemptCount = 0) => {
    console.log(`[BIA DEBUG] Height measurement attempt: ${attemptCount + 1}/${MAX_RETRIES}`);

    // Check if we've exhausted retries BEFORE attempting
    if (attemptCount >= MAX_RETRIES) {
      console.error(`[BIA DEBUG] Height EXHAUSTED all ${MAX_RETRIES} retries - redirecting to /screen1`);
      await showError(ERROR_MESSAGES.height, 3000);
      await trackStage(STAGES.WH_FINAL, STATUS.ERROR, {}, "main height measurement failed", storeUser?.data?.buffer_id, storeUser?.data?.user_id);
      navigate("/screen1");
      return;
    }

    // Reset height attempt tracking
    attemptTracking.current.height = 0;
    errorTriggered.current.height = false;
    console.log("[BIA DEBUG] Reset height attempt tracking and error flag");

    try {
      await measureHeight();
      console.log("[BIA DEBUG] Height measurement SUCCESS");
      // updatePhaseState('height', 'success');

      // Track combined Weight and Height
      await trackStage(STAGES.WH_FINAL, STATUS.SUCCESS, {
        weight_kg: resultsRef.current?.weight?.value,
        height_cm: resultsRef?.current?.height?.value
      }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id);

      // Both weight and height success - show whComplete
      console.log("[BIA DEBUG] Phase 2 COMPLETE - navigating to /bia/whcomplete");

      // Calculate Leg BIA immediately after weight/height
      await calculateAndStoreLegBIA();


      navigate("/bia/whcomplete");
      //   await sleep(6000); // Wait for whComplete video

      // Proceed to Phase 3
      await runPhase3_Impedance();
      await sleep(6000); // Wait for whComplete video

    } catch (heightError) {
      console.error("[BIA DEBUG] Height measurement FAILED:", heightError.message);
      // updatePhaseState('height', 'failed', heightError.message);

      // Retry with incremented attempt count
      console.log(`[BIA DEBUG] Height retry ${attemptCount + 2}/${MAX_RETRIES}...`);
      await showError(ERROR_MESSAGES.height, 3000);
      await runHeightWithRetry(attemptCount + 1);
    }
  };

  /* =======================
     PHASE 3: ARM IMPEDANCE + 20kHz + 100kHz
     - If any fails, retry from arm impedance
  ======================= */
  const runPhase3_Impedance = async (attemptCount = 0) => {
    console.log("[BIA DEBUG] ========== PHASE 3: IMPEDANCE MEASUREMENTS ==========");
    console.log(`[BIA DEBUG] Phase 3 attempt: ${attemptCount + 1}/${MAX_RETRIES}`);
    setCurrentPhase('arm');

    // Check if we've exhausted retries BEFORE attempting
    if (attemptCount >= MAX_RETRIES) {
      console.error(`[BIA DEBUG] Phase 3 EXHAUSTED all ${MAX_RETRIES} retries - redirecting to /screen1`);
      //await showError(ERROR_MESSAGES.maxRetryReached, 4000);
      await BIAComplete({ session_id: storeUser?.data?.buffer_id });
      navigate("/screen1");
      return;
    }

    // Reset attempt tracking and error flags for arm and impedance
    attemptTracking.current.arm = 0;
    attemptTracking.current.impedance20 = 0;
    attemptTracking.current.impedance100 = 0;
    errorTriggered.current.arm = false;
    errorTriggered.current.impedance20 = false;
    errorTriggered.current.impedance100 = false;
    console.log("[BIA DEBUG] Reset arm/impedance attempt tracking and error flags");

    // Navigate to impedance screen
    navigate("/bia/im");
    await sleep(2000);

    try {
      // Arm Impedance 50kHz
      const res = await measureArmImpedance(attemptCount);
      await sleep(800);
      console.log("[BIA DEBUG] Arm impedance SUCCESS");
      await trackStage(STAGES.ARM_50KHZ, STATUS.SUCCESS, { impedance_data: { impedance_50khz_ohm: resultsRef.current.armImpedance.impedance } }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id, Number(attemptCount + 1));

      // Calculate Arm BIA immediately after arm impedance
      await calculateAndStoreArmBIA(attemptCount);

      if (isShoesContinued) {
        console.log("[BIA DEBUG] Shoes continued - skipping Phase 3, showing imcomplete screen");
        navigate("/bia/imcomplete");
        await sleep(3000);
        await BIAComplete({ session_id: storeUser?.data?.buffer_id });
        setIsComplete(true);
        navigate("/screen1");
        return;
      }
      // Impedance 20kHz
      await measureImpedance("20", attemptCount);
      // await trackStage(STAGES.IMPEDANCE_20KHZ, STATUS.SUCCESS, { impedance20: resultsRef.current.impedance.k20 }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id);
      await sleep(1500);
      console.log("[BIA DEBUG] Impedance 20kHz SUCCESS");


      // Impedance 100kHz
      await measureImpedance("100", attemptCount);

      // Track combined Impedances
      if (resultsRef.current.impedance.k20 && resultsRef.current.impedance.k100) {
        await trackStage(STAGES.IMPDEDANCE_20_100KHZ, STATUS.SUCCESS, {
          impedance_data: {
            impedance_20khz_ohm: resultsRef.current.impedance.k20.avg,
            impedance_100khz_ohm: resultsRef.current.impedance.k100.avg
          }
        }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id, Number(attemptCount + 1));
      }
      console.log("[BIA DEBUG] Impedance 100kHz SUCCESS");

      // All impedance measurements success
      console.log("[BIA DEBUG] Phase 3 COMPLETE - All impedance measurements done");
      await runCalculateAndComplete();

    } catch (impedanceError) {
      console.error("[BIA DEBUG] Phase 3 FAILED:", impedanceError.message);

      // Track Error for Consolidated Impedances
      await trackStage(STAGES.IMPDEDANCE_20_100KHZ, STATUS.ERROR, {

      }, impedanceError.message, storeUser?.data?.buffer_id, storeUser?.data?.user_id);

      // Reset arm and impedance results to retry from arm
      resultsRef.current.armImpedance = null;
      resultsRef.current.impedance = { k20: null, k100: null };

      // Retry with incremented attempt count
      console.log(`[BIA DEBUG] Phase 3 retry ${attemptCount + 2}/${MAX_RETRIES} - resetting arm/impedance results...`);
      if (attemptCount === 0) {
        await showError(ERROR_MESSAGES.armImpedance, 3000);
      }
      await runPhase3_Impedance(attemptCount + 1);
    }
  };

  /* =======================
     INTERMEDIATE CALCULATIONS
  ======================= */
  const calculateAndStoreLegBIA = async () => {
    console.log("[BIA DEBUG] ========== CALCULATING LEG BIA ==========");

    try {
      const legBia = await window.api.calculateLegBIA({
        height: resultsRef.current.height.value,
        weight: resultsRef.current.weight.value,
        age: storeUser?.data?.age ?? 23,
        gender: storeUser?.data?.gender ?? "male",
        impedanceVal: resultsRef.current.legImpedance?.impedance
      });

      console.log("[BIA DEBUG] Leg BIA calculation result:", legBia);

      if (legBia?.success) {
        // Store in Redux
        dispatch(setLegBiaResult(legBia));
        console.log("[BIA DEBUG] Leg BIA saved to Redux");
        const legBiaPayload = mapLegsPayloadToBIAMeasurement({
          payload: legBia?.data?.parsed,
          sessionId: storeUser?.data?.buffer_id,
          userId: storeUser?.data?.user_id,
          gender: storeUser?.data?.gender.toLowerCase() === "male" ? 1 : 0,
          heightCm: resultsRef.current.height.value,
          ageYears: storeUser?.data?.age,
          weightKg: resultsRef.current.weight.value
        });
        console.log("[BIA DEBUG] Leg BIA payload:", legBiaPayload);
        //  await window.api.sendLegBiaResult(legBiaPayload);
        await trackStage(STAGES.LEG_BIA_50KHZ, STATUS.SUCCESS, { bia_object: legBiaPayload }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id);
      } else {
        console.error("[BIA DEBUG] Leg BIA calculation failed:", legBia?.error);
        // Non-blocking - continue flow
      }
    } catch (error) {
      console.error("[BIA DEBUG] Leg BIA calculation error:", error);
      await trackStage(STAGES.LEG_BIA_50KHZ, STATUS.ERROR, {}, "Leg BIA calculation error", storeUser?.data?.buffer_id, storeUser?.data?.user_id);
      // Non-blocking - continue flow
    }
  };

  const calculateAndStoreArmBIA = async (attemptCount) => {
    console.log("[BIA DEBUG] ========== CALCULATING ARM BIA ==========");

    try {
      const armBia = await window.api.calculateArmBIA({
        height: resultsRef.current.height.value,
        weight: resultsRef.current.weight.value,
        age: storeUser?.data?.age ?? 23,
        gender: storeUser?.data?.gender ?? "male",
        impedanceVal: resultsRef.current.armImpedance?.impedance
      });

      console.log("[BIA DEBUG] Arm BIA calculation result:", armBia);

      if (armBia?.success) {
        // Store in Redux
        dispatch(setArmBiaResult(armBia));
        console.log("[BIA DEBUG] Arm BIA saved to Redux");
        const armBiaPayload = mapArmsPayloadToBIAMeasurement({
          payload: armBia?.data?.parsed,
          sessionId: storeUser?.data?.buffer_id,
          userId: storeUser?.data?.user_id,
          gender: storeUser?.data?.gender.toLowerCase() === "male" ? 1 : 0,
          heightCm: resultsRef.current.height.value,
          ageYears: storeUser?.data?.age,
          weightKg: resultsRef.current.weight.value
        });
        console.log("[BIA DEBUG] Arm BIA payload:", armBiaPayload);
        //  await window.api.sendLegBiaResult(legBiaPayload);
        await trackStage(STAGES.ARM_BIA_50KHZ, STATUS.SUCCESS, { bia_object: armBiaPayload }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id, Number(attemptCount + 1));
      } else {
        console.error("[BIA DEBUG] Arm BIA calculation failed:", armBia?.error);
        // Non-blocking - continue flow
      }
    } catch (error) {
      console.error("[BIA DEBUG] Arm BIA calculation error:", error);
      await trackStage(STAGES.ARM_BIA_50KHZ, STATUS.ERROR, {}, "Arm BIA calculation error", storeUser?.data?.buffer_id, storeUser?.data?.user_id, Number(attemptCount + 1));
      // Non-blocking - continue flow
    }
  };

  /* =======================
     CALCULATE BIA & COMPLETE
  ======================= */
  const runCalculateAndComplete = async () => {
    console.log("[BIA DEBUG] ========== CALCULATE & COMPLETE ==========");
    setCurrentPhase('complete');
    // updatePhaseState('calculation', 'in_progress');

    // Navigate to imComplete FIRST
    console.log("[BIA DEBUG] Navigating to /bia/imcomplete");
    navigate("/bia/imcomplete");
    console.log("[BIA DEBUG] Calling calculateBIA with params:", {
      height: resultsRef.current.height.value,
      weight: resultsRef.current.weight.value,
      age: storeUser?.data?.age ?? 23,
      gender: storeUser?.data?.gender ?? "male",
      impedance20: resultsRef.current.impedance.k20.segments,
      impedance100: resultsRef.current.impedance.k100.segments,
      session_id: storeUser?.data?.buffer_id,
      user_id: storeUser?.data?.user_id || "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    });

    try {
      // ========== 8-ELECTRODE BIA CALCULATION ==========
      const bia = await window.api.calculateBIA({
        height: resultsRef.current.height.value,
        weight: resultsRef.current.weight.value,
        age: storeUser?.data?.age ?? 23,
        gender: storeUser?.data?.gender.toLowerCase() ?? "male",
        impedance20: resultsRef.current.impedance.k20.segments,
        impedance100: resultsRef.current.impedance.k100.segments
      });

      console.log("[BIA DEBUG] BIA calculation result:", bia);
      console.log("[BIA DEBUG] BIA success:", bia?.success);
      console.log("[BIA DEBUG] BIA summary:", bia?.summary);

      if (!bia?.success) {
        console.error("[BIA DEBUG] BIA calculation failed:", bia?.error);
        throw new Error(bia?.error || "BIA calculation failed");
      }

      // ========== LEG BIA CALCULATION (Moved to Phase 2) ==========
      // console.log("[BIA DEBUG] Leg BIA already calculated in Phase 2");

      // Save results to Redux
      //dispatch(setHeight(resultsRef.current.height.value));
      //dispatch(setWeight(resultsRef.current.weight.value));
      dispatch(setBiaResult(bia));

      console.log("[BIA DEBUG] Results saved to Redux store");
      // updatePhaseState('calculation', 'success');
      console.log("[BIA DEBUG] ========== BIA FLOW COMPLETE ==========");
      navigate("/bia/imcomplete");
      await trackStage(STAGES.BIA_COMPLETE, STATUS.SUCCESS, { bia_object: bia?.finalBia }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id);
      console.log("[BIA DEBUG] ========== trackStage BIA FLOW COMPLETE ==========");


      // Recording is handled by BackgroundCameraProvider automatically
      await BIAComplete({ session_id: storeUser?.data?.buffer_id });
      await sleep(3000); // Wait for complete video
      // Clear timeouts
      //clearAllTimeouts();
      setIsComplete(true);
      navigate("/screen1");

    } catch (calcError) {
      console.error("[BIA DEBUG] Calculation error:", calcError.message);
      // updatePhaseState('calculation', 'failed', calcError.message);
      await trackStage(STAGES.BIA_COMPLETE, STATUS.ERROR, {}, "FINAL BIA CALCULATION FAILED", storeUser?.data?.buffer_id, storeUser?.data?.user_id);

      // Even if the final BIA calculation fails, we still show /bia/imcomplete
      // because we are not collecting everything — do NOT navigate away.
      console.log("[BIA DEBUG] Final BIA failed but staying on /bia/imcomplete");
      navigate("/bia/imcomplete");
      await sleep(3000);
      await BIAComplete({ session_id: storeUser?.data?.buffer_id });
      setIsComplete(true);
      navigate("/screen1");
    }
  };

  /* =======================
     MAIN FLOW ENTRY
  ======================= */
  const runFlow = async () => {
    if (isRunning) {
      console.log("[BIA DEBUG] Flow already running, skipping...");
      return;
    }

    // Check if required ports are available
    if (ports.length < 3) {
      console.error("[BIA DEBUG] PORTS NOT CONNECTED - Required: 3, Available:", ports.length);
      console.error("[BIA DEBUG] Expected ports: [0]=Height, [1]=Weight, [2]=BIA");
      await showError("Ports are not connected. Please check device connections.", 3000);
      navigate("/screen1");
      return;
    }

    // Validate specific ports exist
    if (!ports[0]?.path || !ports[2]?.path) {
      console.error("[BIA DEBUG] MISSING REQUIRED PORTS");
      console.error("[BIA DEBUG] Height port (0):", ports[0]?.path || "MISSING");
      console.error("[BIA DEBUG] BIA port (2):", ports[2]?.path || "MISSING");
      await showError("Ports are not connected. Please check device connections.", 3000);
      navigate("/screen1");
      return;
    }

    console.log("[BIA DEBUG] ==========================================");
    console.log("[BIA DEBUG] STARTING BIA MEASUREMENT FLOW");
    console.log("[BIA DEBUG] ==========================================");
    console.log("[BIA DEBUG] Available ports:", ports.map(p => p.path));
    console.log("[BIA DEBUG] Height port:", ports[0]?.path);
    console.log("[BIA DEBUG] BIA port:", ports[2]?.path);
    console.log("[BIA DEBUG] User:", storeUser?.data);

    setIsRunning(true);
    setCurrentPhase('init');
    // clearMetadata(); // Reset metadata at start of flow

    // Note: No global timeout - only navigate on MAX_RETRIES exhaustion
    console.log(`[BIA DEBUG] Flow will only redirect on MAX_RETRIES (${MAX_RETRIES}) exhaustion`);

    // Recording is handled by BackgroundCameraProvider automatically

    try {
      // Connect BIA port
      console.log("[BIA DEBUG] Connecting BIA port:", ports[2]?.path);
      await window.api.connectBiaPort(ports[2]?.path);
      await sleep(800);
      console.log("[BIA DEBUG] BIA port connected");

      // Start Phase 1
      await runPhase1_LegCheck();

    } catch (e) {
      console.error("[BIA DEBUG] Flow error:", e.message);
      // updatePhaseState('flow', 'failed', e.message);
      await trackStage(STAGES.BIA_COMPLETE, STATUS.ERROR, {}, e.message, storeUser?.data?.buffer_id, storeUser?.data?.user_id);

      navigate("/screen1");
    } finally {
      setIsRunning(false);
      //clearAllTimeouts();
      console.log("[BIA DEBUG] Flow ended, isRunning set to false");
    }
  };

  /* =======================
     EFFECTS
  ======================= */
  useEffect(() => {
    console.log("[BIA DEBUG] Component mounted, loading ports...");
    window.api?.getPorts?.().then((p) => {
      console.log("[BIA DEBUG] Ports loaded:", p);
      setPorts(p);
    });

    return () => {
      console.log("[BIA DEBUG] Component unmounting, cleaning up...");
      //clearAllTimeouts();
    };
  }, []);

  useEffect(() => {
    if (ports.length > 0) {
      console.log("[BIA DEBUG] Ports available:", ports.length, "- triggering flow...");
      runFlow();
    }
  }, [ports]);

  // Handle video end - navigate to screen1
  const handleVideoEnd = () => {
    console.log("[BIA DEBUG] Completion video ended, navigating to /screen1");
    navigate("/screen1");
  };

  /* =======================
     RENDER
  ======================= */
  console.log("[BIA DEBUG] Render - currentPhase:", currentPhase, "isComplete:", isComplete);

  return (
    <>
      <BIAComponent
        texts={texts}
        isComplete={isComplete}
        onVideoEnd={handleVideoEnd}
      />

      <ErrorAlert
        visible={!!errorState}
        title={errorState?.title}
        description={errorState?.description}
        onClose={() => setErrorState(null)}
        onRetry={undefined}
      />

      {/* Barefoot CTA Modal - blocks flow until user makes a choice */}
      {barefootCTAVisible && (
        <BarefootCTAModal
          onRemoveShoe={() => handleBarefootChoice("retry")}
          onContinueWithShoes={() => handleBarefootChoice("skip")}
        />
      )}
    </>
  );
}

/* =======================
   BAREFOOT CTA MODAL
   Shown when leg impedance fails - pauses flow until user chooses
======================= */
function BarefootCTAModal({ onRemoveShoe, onContinueWithShoes }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-[90%] max-w-[700px] rounded-2xl border border-[#FFC568]/40 bg-[#1a1208] px-10 py-10 shadow-2xl flex flex-col items-center gap-8">

        {/* Icon */}
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-[#FFC568]/10 border border-[#FFC568]/30">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#FFC568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#FFC568]">Please be on the bare foot</h2>
          <p className="mt-3 text-lg text-[#FFC568]/70">
            How would you like to proceed?
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          {/* Remove Shoe - primary action */}
          <button
            onClick={onRemoveShoe}
            className="flex-1 max-w-[280px] py-4 px-6 rounded-xl text-xl font-semibold
              bg-[#FFC568] text-[#1a1208]
              hover:bg-[#ffd48a] active:scale-95
              transition-all duration-200 shadow-lg shadow-[#FFC568]/20"
          >
            Remove the Shoe
          </button>

          {/* Continue with Shoes - secondary action */}
          <button
            onClick={onContinueWithShoes}
            className="flex-1 max-w-[280px] py-4 px-6 rounded-xl text-xl font-semibold
              border border-[#FFC568]/50 text-[#FFC568]
              hover:bg-[#FFC568]/10 active:scale-95
              transition-all duration-200"
          >
            Continue with Shoes
          </button>
        </div>
      </div>
    </div>
  );
}