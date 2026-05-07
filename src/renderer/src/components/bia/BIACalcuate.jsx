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
import { validatePorts, logPortConfiguration, MEASUREMENT_TIMEOUTS } from "../../utils/portConfig";
import { useBIARecording } from "../../utils/useBiaRecording";
import ctaShoesBg from "../../assets/bia/ctaShoes.svg";
import BlueGradientButton from "../ui/BlueGradientButton";
import BlackGradientButton from "../ui/BlackGradientButton";
import { CircleAlert, FileWarning } from "lucide-react";
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
  const barefootCTAResolver = useRef(null);
  const whCompleteResolver = useRef(null);
  const imCompleteResolver = useRef(null);
  const [measuredValues, setMeasuredValues] = useState({
    height: "-- cm", weight: "-- kg", arms50k: {
      fatPercentage: "20",
      waterPercentage: "55",
      muscleMassKg: "30",
      boneMassKg: "3",
    }
  });
  const { startRecording, stopAndSend, saveBuffer, forceCleanup } = useBIARecording({
    sessionId: storeUser?.data?.buffer_id,
    userId: storeUser?.data?.user_id,
  });

  // Phase tracking (removed attempt counters - now using parameters)
  const [currentPhase, setCurrentPhase] = useState('init'); // init, leg, wh, arm, impedance, complete
  const resultsRef = useRef({
    legImpedance: null,
    weight: null,
    preWeight: null,
    height: null,
    preHeight: null,
    armImpedance: null,
    arms50k: null,
    isShoesContinued: false,
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
    impedance20: "Please be barefoot and hold the rods firmly",
    impedance100: "Please be barefoot and hold the rods firmly",
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
      title: "Your Measurement is Completed!",
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
      console.log("[BIA REC] ⏏️  Height port error → saveBuffer('height_port_error')");
      await saveBuffer("height_port_error");
      navigate('/voice');

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
    console.error(`[BIA DEBUG] ${stepName} TIMEOUT - redirecting to /voice`);
    // clearAllTimeouts();
    setIsRunning(false);
    navigate("/voice");
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

  const handleWhNextClick = () => {
    console.log("[BIA DEBUG] whComplete Next button clicked");
    if (whCompleteResolver.current) {
      whCompleteResolver.current();
      whCompleteResolver.current = null;
    }
  };

  const handleImNextClick = () => {
    console.log("[BIA DEBUG] imcomplete Next button clicked");
    if (imCompleteResolver.current) {
      imCompleteResolver.current();
      imCompleteResolver.current = null;
    } else {
      setIsComplete(true);
      navigate("/voice");
    }
  };

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

    /*
    
    
    */

    resultsRef.current.arms50k = {
      fatPercentage: res.body_fat_percentage ?? "20",
      waterPercentage: res.moisture_content_kg ?? "55",
      muscleMassKg: res.muscle_mass_kg ?? "30",
      boneMassKg: res.bone_mass_kg ?? "10",
    };
    setMeasuredValues((prev) => ({
      ...prev,
      arms50k: resultsRef.current.arms50k,
    }));
    console.log("measuredValues 50khz", measuredValues);

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
      console.error(`[BIA DEBUG] Phase 1 EXHAUSTED all ${MAX_RETRIES} retries - redirecting to /voice`);
      // updatePhaseState('leg', 'failed', 'Max retries exhausted');
      // showError(ERROR_MESSAGES.maxRetryReached, 4000);
      await BIAComplete({ session_id: storeUser?.data?.buffer_id });
      console.log("[BIA REC] ⏏️  Phase 1 — leg max retries exhausted → saveBuffer('leg_max_retry')");
      await saveBuffer("leg_max_retry");
      navigate("/voice");
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
        console.error(`[BIA DEBUG] Priyanshu Phase 3 EXHAUSTED all ${MAX_RETRIES} retries - redirecting to /voice`);
        await trackStage(STAGES.LEG_50KHZ, STATUS.ERROR, {}, "Barefoot contact not detected", null, storeUser?.data?.buffer_id, storeUser?.data?.user_id, Number(attemptCount + 1));
        // updatePhaseState('leg', 'failed', 'Max retries exhausted');
        navigate("/voice");
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
        resultsRef.current.isShoesContinued = true;
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
     - After leg success, measure weight and height in parallel
     - If weight fails or height retries exhausted, go back to screen 1
  ======================= */
  const runPhase2_WeightHeight = async () => {
    console.log("[BIA DEBUG] ========== PHASE 2: WEIGHT & HEIGHT ==========");
    setCurrentPhase('wh');

    try {
      // Parallelize Weight and Height measurements
      console.log("[BIA DEBUG] Starting Weight and Height measurements in parallel...");

      const [weightRes, heightRes] = await Promise.all([
        measureWeight(),
        performHeightWithRetry()
      ]);

      console.log("[BIA DEBUG] Both Weight and Height SUCCESS");

      // Track combined Weight and Height
      await trackStage(STAGES.WH_FINAL, STATUS.SUCCESS, {
        weight_kg: resultsRef.current?.weight?.value,
        height_cm: resultsRef?.current?.height?.value
      }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id);

      // Both weight and height success - show whComplete
      console.log("[BIA DEBUG] Phase 2 COMPLETE - navigating to /bia/whcomplete");

      // Calculate Leg BIA immediately after weight/height
      await calculateAndStoreLegBIA();

      setMeasuredValues({
        weight: resultsRef.current?.weight?.value ? `${resultsRef.current?.weight?.value} kg` : "-- kg",
        height: resultsRef.current?.height?.value ? `${resultsRef.current?.height?.value} cm` : "-- cm"
      });

      navigate("/bia/whcomplete");

      await new Promise((resolve) => {
        whCompleteResolver.current = resolve;
      });

      // Proceed to Phase 3
      await runPhase3_Impedance();

    } catch (phase2Error) {
      console.error("[BIA DEBUG] Phase 2 FAILED:", phase2Error.message);

      if (phase2Error.message === "HEIGHT_MAX_RETRY_EXHAUSTED") {
        await showError(ERROR_MESSAGES.height, 3000);
        await trackStage(STAGES.WH_FINAL, STATUS.ERROR, {}, "main height measurement failed", storeUser?.data?.buffer_id, storeUser?.data?.user_id);
        console.log("[BIA REC] ⏏️  Phase 2 — height max retries exhausted → saveBuffer('height_max_retry')");
        await saveBuffer("height_max_retry");
      } else {
        // Assume failure was weight-related or other
        await showError(ERROR_MESSAGES.weight, 3000);
        await trackStage(STAGES.WH_FINAL, STATUS.ERROR, {}, "main weight measurement failed", storeUser?.data?.buffer_id, storeUser?.data?.user_id);
        console.log("[BIA REC] ⏏️  Phase 2 — weight or generic error → saveBuffer('weight_error')");
        await saveBuffer("weight_error");
      }

      navigate("/voice");
    }
  };

  const performHeightWithRetry = async (attemptCount = 0) => {
    console.log(`[BIA DEBUG] Height measurement attempt: ${attemptCount + 1}/${MAX_RETRIES}`);

    // Check if we've exhausted retries
    if (attemptCount >= MAX_RETRIES) {
      console.error(`[BIA DEBUG] Height EXHAUSTED all ${MAX_RETRIES} retries`);
      throw new Error("HEIGHT_MAX_RETRY_EXHAUSTED");
    }

    // Reset height attempt tracking
    attemptTracking.current.height = 0;
    errorTriggered.current.height = false;

    try {
      return await measureHeight();
    } catch (heightError) {
      console.error("[BIA DEBUG] Height measurement FAILED:", heightError.message);

      // Retry with incremented attempt count
      console.log(`[BIA DEBUG] Height retry ${attemptCount + 2}/${MAX_RETRIES}...`);
      await showError(ERROR_MESSAGES.height, 3000);
      return await performHeightWithRetry(attemptCount + 1);
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
      console.error(`[BIA DEBUG] Phase 3 EXHAUSTED all ${MAX_RETRIES} retries - redirecting to /voice`);
      //await showError(ERROR_MESSAGES.maxRetryReached, 4000);
      await BIAComplete({ session_id: storeUser?.data?.buffer_id });
      console.log("[BIA REC] ⏏️  Phase 3 — arm/impedance max retries exhausted → saveBuffer('arm_max_retry')");
      await saveBuffer("arm_max_retry");
   navigate("/bia/imcomplete");
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
    await sleep(8000);

    try {
      // Arm Impedance 50kHz
      const res = await measureArmImpedance(attemptCount);
      await sleep(800);
      console.log("[BIA DEBUG] Arm impedance SUCCESS");
      await trackStage(STAGES.ARM_50KHZ, STATUS.SUCCESS, { impedance_data: { impedance_50khz_ohm: resultsRef.current.armImpedance.impedance } }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id, Number(attemptCount + 1));

      // Calculate Arm BIA immediately after arm impedance
      await calculateAndStoreArmBIA(attemptCount);

      if (resultsRef.current.isShoesContinued) {
        console.log("[BIA DEBUG] Shoes continued - skipping frequency measurements, showing imcomplete screen");
        navigate("/bia/imcomplete");
        await BIAComplete({ session_id: storeUser?.data?.buffer_id });
        console.log("[BIA REC] 🏁 Shoes path — stopping and sending recording via stopAndSend()");
        await stopAndSend(); // ✅ Stop recording before navigating away
        await new Promise((resolve) => { imCompleteResolver.current = resolve; });
        setIsComplete(true);
        navigate("/voice");
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

    resultsRef.current.arms50k = {
      fatPercentage: armBiaPayload.body_fat_percentage ?? "8",
      waterPercentage: armBiaPayload.moisture_content_kg ?? "57",
      muscleMassKg: armBiaPayload.muscle_mass_kg ?? "5",
      boneMassKg: armBiaPayload.bone_mass_kg ?? "2.7",
    };
    setMeasuredValues((prev) => ({
      ...prev,
      arms50k: resultsRef.current.arms50k,
    }));
    console.log("measuredValues 50khz", measuredValues);
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

      await BIAComplete({ session_id: storeUser?.data?.buffer_id });
      console.log("[BIA REC] 🏁 BIA SUCCESS — stopping and sending full recording via stopAndSend()");
      await stopAndSend(); // Upload full BIA recording

      await new Promise((resolve) => { imCompleteResolver.current = resolve; });
      setIsComplete(true);
      navigate("/voice");

    } catch (calcError) {
      console.error("[BIA DEBUG] Calculation error:", calcError.message);
      // updatePhaseState('calculation', 'failed', calcError.message);
      await trackStage(STAGES.BIA_COMPLETE, STATUS.ERROR, {}, "FINAL BIA CALCULATION FAILED", storeUser?.data?.buffer_id, storeUser?.data?.user_id);

      // Even if the final BIA calculation fails, we still show /bia/imcomplete
      // because we are not collecting everything — do NOT navigate away.
      console.log("[BIA DEBUG] Final BIA failed but staying on /bia/imcomplete");
      navigate("/bia/imcomplete");
      await BIAComplete({ session_id: storeUser?.data?.buffer_id });
      console.log("[BIA REC] ⏏️  Final BIA calc failed → saveBuffer('calc_error')");
      await saveBuffer("calc_error");
      await new Promise((resolve) => { imCompleteResolver.current = resolve; });
      setIsComplete(true);
      navigate("/voice");
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

    // Validate ports using centralized port configuration
    const portValidation = validatePorts(ports);
    if (!portValidation.valid) {
      console.error("[BIA DEBUG] PORT VALIDATION FAILED");
      portValidation.errors.forEach(err => console.error("[BIA DEBUG]", err));
      logPortConfiguration();
      await showError("Ports are not connected. Please check device connections.", 3000);
      navigate("/voice");
      return;
    }

    console.log("[BIA DEBUG] ==========================================");
    console.log("[BIA DEBUG] STARTING BIA MEASUREMENT FLOW");
    console.log("[BIA DEBUG] ==========================================");
    logPortConfiguration();
    console.log("[BIA DEBUG] Available ports:", ports.map(p => p.path));
    console.log("[BIA DEBUG] Height port:", portValidation.ports.height?.path);
    console.log("[BIA DEBUG] BIA port:", portValidation.ports.bia?.path);
    console.log("[BIA DEBUG] User:", storeUser?.data);

    setIsRunning(true);
    setCurrentPhase('init');
    resultsRef.current.isShoesContinued = false;
    // clearMetadata(); // Reset metadata at start of flow
    console.log("[BIA REC] 🎬 Starting BIA recording — session:", storeUser?.data?.buffer_id, "user:", storeUser?.data?.user_id);
    await startRecording();
    // Note: No global timeout - only navigate on MAX_RETRIES exhaustion
    console.log(`[BIA DEBUG] Flow will only redirect on MAX_RETRIES (${MAX_RETRIES}) exhaustion`);

    // Recording is handled by BackgroundCameraProvider automatically
    try {
      // Connect BIA port
      console.log("[BIA DEBUG] Connecting BIA port:", portValidation.ports.bia?.path);
      await window.api.connectBiaPort(ports[1]?.path);
      await sleep(800);
      console.log("[BIA DEBUG] BIA port connected");

      // Start Phase 1
      await runPhase1_LegCheck();

    } catch (e) {
      console.error("[BIA DEBUG] Flow error:", e.message);
      // updatePhaseState('flow', 'failed', e.message);
      await trackStage(STAGES.BIA_COMPLETE, STATUS.ERROR, {}, e.message, storeUser?.data?.buffer_id, storeUser?.data?.user_id);
      console.log(`[BIA REC] ⏏️  Unhandled flow exception: "${e.message}" → saveBuffer('flow_exception')`);
      await saveBuffer("flow_exception");
      navigate("/voice");
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
      // ✅ Always release the camera when BIACalculate leaves the screen
      forceCleanup();
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
    console.log("[BIA DEBUG] Completion video ended, navigating to /voice");
    navigate("/voice");
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
        heightValue={measuredValues.height}
        weightValue={measuredValues.weight}
        onNextClick={handleWhNextClick}
        onImNextClick={handleImNextClick}
        arms50k={measuredValues.arms50k}
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



// ✅ Import ctaShoes.svg the same way bg2 is imported in NewDmitScreen


// ── Figma asset URLs (valid 7 days — download and move to local assets) ──

const imgWarningCircle =
  "https://www.figma.com/api/mcp/asset/7c65b087-0dc1-4eee-90e6-b1eaf5c2bb0c";

const BarefootCTAModal = ({ onRemoveShoe, onContinueWithShoes, onClose }) => {
  const [step, setStep] = useState("choose"); // "choose" | "barefoot"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div
        className="relative w-[750px] max-w-[92vw]"
        style={{ filter: "drop-shadow(0px 0px 40px rgba(139, 195, 229, 0.4))" }}
      >
        {/* ── Inline SVG border/frame ── */}
        <svg
          width={500}
          height={700}
          viewBox="0 0 1326 550"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto block"
        >
          <path d="M29.5695 0L545.532 5.17449H1262.19L1304.32 46.9393V466.436L1263.29 510.788L76.8776 510.418L27.3516 459.413L29.5695 0Z" fill="#0C3046" fillOpacity="0.5" />
          <path fillRule="evenodd" clipRule="evenodd" d="M854.5 510.814L866.698 491.595H878.524L864.11 514.51H854.5V510.814ZM883.33 491.964H895.156L880.742 514.88H868.546L883.33 491.964ZM900.332 491.964H912.158L897.744 514.88H885.548L900.332 491.964ZM917.332 491.964H929.16L914.376 514.88H902.918L917.332 491.964ZM933.596 491.964H945.422L931.008 514.88H919.18L933.596 491.964ZM949.858 491.964H962.054L947.64 514.88H935.444L949.858 491.964ZM966.86 491.964H978.686L963.902 515.249H952.076L966.86 491.964ZM983.492 491.964H995.318L980.904 514.88H969.076L983.492 491.964ZM1000.12 491.964H1011.95L997.536 514.88H985.708L1000.12 491.964ZM1016.39 491.964H1028.58L1014.17 514.88H1001.97L1016.39 491.964ZM1033.39 491.964H1045.21L1030.8 514.88H1018.6L1033.39 491.964ZM1050.02 491.964H1065.17V514.88H1052.24L1064.06 496.4L1061.11 493.443L1047.43 514.88H1035.6L1050.02 491.964ZM854.87 503.792V491.964H862.262L854.87 503.792Z" fill="#8BC3E5" />
          <path d="M761.016 539.266V532.243C768.9 525.098 776.908 517.952 785.04 510.807H835.306C841.958 516.72 848.611 522.634 855.264 528.547H1062.98C1071.85 522.634 1080.84 516.72 1089.96 510.807H1261.82L1250.74 521.895L1093.29 521.525L1065.94 539.266H953.578C919.574 539.266 885.447 539.266 851.198 539.266L831.24 521.525H789.106L772.104 537.048V539.266H761.016Z" fill="#8BC3E5" />
          <path d="M239.863 525.978L311.935 526.347L317.109 520.434C355.794 520.434 394.479 520.434 433.163 520.434L437.969 526.347H501.171L505.235 550.002H433.533L428.729 544.088H321.545L316.739 550.002C290.498 550.002 266.105 550.002 239.863 550.002V525.978Z" fill="#8BC3E5" />
          <path d="M19.9727 510.821V505.647C25.6399 500.226 31.431 494.928 37.3446 489.754H73.9346C78.8626 493.943 83.6671 498.255 88.3487 502.69H239.885C246.538 498.255 253.19 493.943 259.843 489.754H381.441V497.885H262.061L242.473 510.821H160.421C135.534 510.821 110.525 510.821 85.3926 510.821L70.9768 497.885H40.3007L27.7346 508.973V510.821H19.9727Z" fill="#8BC3E5" />
          <path fillRule="evenodd" clipRule="evenodd" d="M18.1289 545.915L31.0649 526.326H43.261L28.1088 549.981H18.1289V545.915ZM48.4368 526.326H61.0029L45.8489 549.981H32.9129L48.4368 526.326ZM66.1769 526.326H79.1129L63.589 549.981H51.023L66.1769 526.326ZM83.917 526.326H96.1149L80.9609 549.981H68.3949L83.917 526.326ZM101.289 526.326H113.855L98.3329 549.981H86.135L101.289 526.326ZM118.661 526.326H131.597L116.073 549.981H103.137L118.661 526.326ZM136.401 526.326H148.967L133.813 549.981H121.247L136.401 526.326ZM153.773 526.326H166.339L151.185 549.981H138.619L153.773 526.326ZM171.143 526.326H183.709L168.557 549.981H155.989L171.143 526.326ZM188.515 526.326H201.451L185.927 549.981H173.361L188.515 526.326ZM206.255 526.326H218.821L203.299 549.981H190.733L206.255 526.326ZM223.997 526.326H239.519V549.981H226.213L238.411 530.761L235.453 528.174L221.039 549.981H208.473L223.997 526.326ZM18.1289 538.523V526.326H25.8909L18.1289 538.523Z" fill="#8BC3E5" />
          <path fillRule="evenodd" clipRule="evenodd" d="M723.319 549.632H713.34L697.816 525.978H710.383L723.319 545.936V549.632ZM708.166 549.632H695.598L680.446 525.978H693.012L708.166 549.632ZM690.424 549.632H677.488L662.334 525.608H675.27L690.424 549.632ZM672.684 549.632H660.118L644.594 525.978H657.16L672.684 549.632ZM655.312 549.632H643.116L627.592 525.978H640.158L655.312 549.632ZM637.942 549.632H625.006L609.852 525.978H622.418L637.942 549.632ZM620.2 549.632H607.634L592.48 525.978H605.046L620.2 549.632ZM602.46 549.632H589.894L574.74 525.978H587.306L602.46 549.632ZM584.718 549.632H572.152L556.998 525.978H569.566L584.718 549.632ZM566.978 549.632H554.412L538.888 525.978H551.824L566.978 549.632ZM549.238 549.632H536.67L521.148 525.978H533.714L549.238 549.632ZM531.866 549.632H519.3L504.886 527.456L501.558 530.413L514.126 549.632H500.82V525.978H516.342L531.866 549.632ZM714.818 525.978H722.58V537.805L714.818 525.978Z" fill="#8BC3E5" />
          <path d="M718.515 510.821V505.647C712.848 500.226 707.057 494.928 701.143 489.754H664.553C659.625 493.943 654.697 498.255 649.769 502.69H498.233C491.827 498.255 485.298 493.943 478.645 489.754H357.047V497.885H476.057L496.015 510.821H578.067C602.953 510.821 627.962 510.821 653.095 510.821L667.511 497.885H698.187L710.753 508.973V510.821H718.515Z" fill="#8BC3E5" />
          <path d="M29.9274 430.598L0.359375 467.558V481.233L29.9274 442.795V430.598Z" fill="#8BC3E5" />
          <path d="M12.5508 492.348V527.46L18.0948 535.591L18.4647 484.217L12.5508 492.348Z" fill="#8BC3E5" />
          <path d="M0.722656 457.22L38.4226 401.41L38.7926 378.864L0.722656 433.935V457.22Z" fill="#8BC3E5" />
          <path d="M38.8225 357.797V69.1387L29.2126 83.5532L28.4727 372.211L38.8225 357.797Z" fill="#8BC3E5" />
          <path d="M1.12109 411.773L38.821 357.812V338.962L1.12109 392.554V411.773Z" fill="#8BC3E5" />
          <path d="M18.85 444.276L18.11 549.982H0L0.369961 467.561L18.85 444.276Z" fill="#8BC3E5" />
          <path d="M1317.63 324.515L1310.61 338.929L1310.24 368.867L1317.63 376.259L1318.37 446.113H1318.74L1298.41 474.572L1297.67 92.0361L1317.63 116.43C1317.63 199.22 1317.63 241.724 1317.63 324.515Z" fill="#8BC3E5" />
          <path d="M29.1953 17.3713H1256.64L1309.86 81.6818H1325.75L1258.86 0H29.1953V17.3713Z" fill="#8BC3E5" />
          <path d="M1.125 125.33L38.8249 69.151V46.6055L1.125 101.676V125.33Z" fill="#8BC3E5" />
          <path d="M39.1858 25.872V0H29.5759L28.8359 40.2865L39.1858 25.872Z" fill="#8BC3E5" />
          <path d="M1.48438 79.4673L39.1843 25.8753V6.65625L1.48438 60.6178V79.4673Z" fill="#8BC3E5" />
          <path d="M1168.68 73.5604L1191.22 95.7364C1185.31 101.65 1174.96 111.999 1169.05 118.282C1174.96 124.196 1178.29 127.522 1184.2 133.436C1190.48 127.522 1199.35 118.652 1206.38 111.26L1228.92 133.436L1242.97 119.391L1220.79 97.2149L1242.97 74.6691L1227.44 59.5156L1205.27 81.6916L1182.72 59.5156L1168.68 73.5604Z" fill="#8BC3E5" />
        </svg>

        {/* ── X close button (over SVG's built-in X icon) ── */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute z-10 bg-transparent border-none cursor-pointer p-2 leading-[0] hover:opacity-70 transition-opacity"
          style={{ top: "10%", right: "4%" }}
        >
          <div className="w-[55px] h-[55px]" />
        </button>

        {/* ── Content ── */}
        <div
          className="absolute flex flex-col justify-center"
          style={{
            top: "18%",
            bottom: "20%",
            left: "6%",
            right: "6%",
          }}
        >
          {step === "choose" ? (
            <>
              {/* Title */}
              <div className="flex items-start gap-2.5 mb-[5%]">
                <CircleAlert className="text-[#8BC3E5]" size={32} />
                <h2
                  className="text-[#8BC3E5] text-3xl leading-snug font-normal m-0"
                  style={{ fontFamily: "'Share Tech Mono', monospace" }}
                >
                  Choose how you'd like
                  <br />
                  to continue.
                </h2>
              </div>

              {/* Two-choice buttons */}
              <div className="w-full flex gap-x-10">
                <button
                  onClick={() => setStep("barefoot")}
                  className="
                    w-[clamp(16rem,33vw,31.25rem)]
                    h-[clamp(4rem,8vh,6.25rem)]
                    flex items-center justify-center
                    text-center
                    rounded-[30px]
                    border-2 border-white/30
                    bg-white/5
                    backdrop-blur-sm
                    shadow-[0px_5px_40px_0px_rgba(154,217,255,0.3)]
                    text-white
                    text-[clamp(1.25rem,3vw,3rem)]
                    tracking-wide
                    active:scale-[0.98]
                    transition-all duration-300 ease-in-out
                    hover:bg-white/10
                    hover:border-white/50
                    px-2
                  "
                  style={{ fontFamily: "'Share Tech Mono', monospace" }}
                >
                  🦶 Without Shoes
                </button>

                <button
                  onClick={onContinueWithShoes}
                  className="
                    w-[clamp(16rem,33vw,31.25rem)]
                    h-[clamp(4rem,8vh,6.25rem)]
                    flex items-center justify-center
                    text-center
                    rounded-[30px]
                    border-2 border-white/50
                    bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)]
                    shadow-[0px_0px_30px_rgba(0,179,255,0.5),inset_0px_0px_20px_rgba(255,255,255,0.3)]
                    text-white
                    text-[clamp(1.5rem,3vw,3rem)]
                    tracking-wide
                    active:scale-[0.98]
                    transition-all duration-300 ease-in-out
                    hover:border-white
                  "
                  style={{ fontFamily: "'Share Tech Mono', monospace" }}
                >
                  👟 With Shoes
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Instruction screen */}
              <div className="flex items-start gap-2.5 mb-[6%]">
                <CircleAlert className="text-[#8BC3E5] shrink-0 mt-1" size={32} />
                <p
                  className="text-[#8BC3E5] text-3xl leading-snug font-normal m-0"
                  style={{ fontFamily: "'Share Tech Mono', monospace" }}
                >
                  Remove your socks and shoes
                  <br />
                  and click on start.
                </p>
              </div>

              {/* Start button */}
              <button
                onClick={onRemoveShoe}
                className="
                ml-36
                  w-[clamp(16rem,33vw,31.25rem)]
                  h-[clamp(4rem,8vh,6.25rem)]
                  flex items-center justify-center
                  text-center
                  rounded-[30px]
                  border-2 border-white/50
                  bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)]
                  shadow-[0px_0px_30px_rgba(0,179,255,0.5),inset_0px_0px_20px_rgba(255,255,255,0.3)]
                  text-white
                  text-[clamp(1.5rem,3vw,3rem)]
                  tracking-wide
                  active:scale-[0.98]
                  transition-all duration-300 ease-in-out
                  hover:border-white
                "
                style={{ fontFamily: "'Share Tech Mono', monospace" }}
              >
                Start
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

