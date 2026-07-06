import React, { useEffect, useRef, useState } from "react";
import { useBackgroundCamera } from "../../services/BackgroundCameraProvider";
import { BIAComponent } from "./BIAComponents";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import ErrorAlert from "../ErrorAlert";
import { useDispatch, useSelector } from "react-redux";
import { setBiaResult, setLegBiaResult, setHeight, setWeight, setArmBiaResult, setSessionId, setScreening } from "../../features/common/commonSlice";
import { measureHeight } from "../../utils/measurementUtils";
import { storePreliminaryMeasurements } from "../../utils/measurementRedux";
import { BIAComplete, BIAMeasurementStage } from "../../utils/api";
import { getNextRoute } from "../../utils/stageRouter";
import { mapArmsPayloadToBIAMeasurement, mapLegsPayloadToBIAMeasurement } from "../../utils/dataCoverter";
import { trackStage } from "../../utils/config";
import { validatePorts, logPortConfiguration, MEASUREMENT_TIMEOUTS, PORT_PATHS } from "../../utils/portConfig";
import bmiWH_male from "../../assets/bia/bia-hwmeasuring_male.mp4"
import biaIm_male from "../../assets/bia/bia-immeasuring_male.mp4"
import bmiWH_female from "../../assets/bia/bia-hwmeasuring_female.mp4"
import biaIm_female from "../../assets/bia/bia-immeasuring_female.mp4"

import ctaShoesBg from "../../assets/bia/ctaShoes.svg";
import textbgframe from "../../assets/textbgframe.svg";
import BlueGradientButton from "../ui/BlueGradientButton";
import BlackGradientButton from "../ui/BlackGradientButton";
export default function BIACalculate({ user, onComplete }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const storeUser = useSelector((state) => state.common.user);
  const screening = useSelector((state) => state.common.screening);

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
  // Stores next_stage from BIAComplete API response for use in handleImNextClick
  const biaNextStageRef = useRef(null);
  const [measuredValues, setMeasuredValues] = useState({
    height: "-- cm", weight: "-- kg", arms50k: {}
  });
  const [displayValues, setDisplayValues] = useState({
    height: null,
    weight: null,
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

  const screenConfig = {
    leg50: {
      title: t("measurement.basic_body_scan"),
      description: t("measurement.let_measure"),
      video: {
        female: bmiWH_female,
        male: bmiWH_male,
      },
    },
    wh: {
      title: t("measurement.basic_body_scan"),
      description: t("measurement.weight_height_measurement"),

      video: {
        female: bmiWH_female,
        male: bmiWH_male,
      },
    },

    im: {
      title: t("measurement.core_body_scan"),
      description: t("measurement.impedance_measurement"),
      video: {
        female: biaIm_female,
        male: biaIm_male,
      },
    },
    whcomplete: {
      title: t("measurement.scan_done"),
      description: t("measurement.weight_height_completed"),
      video: {
        female: bmiWH_female,
        male: bmiWH_male,
      },
    },
    imcomplete: {
      title: t("measurement.scan_done"),
      description: t("measurement.impedance_complete"),
      video: {
        female: biaIm_female,
        male: biaIm_male,
      },
    },
  }
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
      const heightErrorComplete = await BIAComplete({
        session_id: storeUser?.data?.buffer_id,
        screening_session_id: screening?.sessionId
      });
      if (heightErrorComplete?.screening) {
        dispatch(setScreening(heightErrorComplete.screening));
      }
      const heightErrorRoute = getNextRoute(heightErrorComplete?.screening?.next_stage, '/voice');
      console.log('[BIA] handleHeightError — navigating to:', heightErrorRoute);
      navigate(heightErrorRoute);

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
      // Use next_stage captured from the BIAComplete API response
      const nextRoute = getNextRoute(biaNextStageRef.current, '/voice');
      console.log('[BIA] handleImNextClick — navigating to:', nextRoute);
      navigate(nextRoute);
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
    console.log('[MEASUREMENT] Connecting to height port:', PORT_PATHS.HEIGHT);
    await window.api.connectHeightPort(PORT_PATHS.HEIGHT);
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
      console.error(`[BIA DEBUG] Phase 1 EXHAUSTED all ${MAX_RETRIES} retries - redirecting via next_stage`);
      // updatePhaseState('leg', 'failed', 'Max retries exhausted');
      // showError(ERROR_MESSAGES.maxRetryReached, 4000);
      const legMaxRetryComplete = await BIAComplete({
        session_id: storeUser?.data?.buffer_id,
        screening_session_id: screening?.sessionId
      });
      if (legMaxRetryComplete?.screening) {
        dispatch(setScreening(legMaxRetryComplete.screening));
      }
      const legMaxRetryRoute = getNextRoute(legMaxRetryComplete?.screening?.next_stage, '/voice');
      console.log('[BIA] runPhase1 leg max retry — navigating to:', legMaxRetryRoute);
      navigate(legMaxRetryRoute);
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
      navigate('/bia/wh')

      // Success - proceed to Phase 2
      await runPhase2_WeightHeight();

    } catch (legError) {
      if (attemptCount >= MAX_RETRIES) {
        console.error(`[BIA DEBUG] Priyanshu Phase 3 EXHAUSTED all ${MAX_RETRIES} retries - redirecting via next_stage`);
        await trackStage(STAGES.LEG_50KHZ, STATUS.ERROR, {}, "Barefoot contact not detected", null, storeUser?.data?.buffer_id, storeUser?.data?.user_id, Number(attemptCount + 1));
        // updatePhaseState('leg', 'failed', 'Max retries exhausted');
        const legCatchComplete = await BIAComplete({
          session_id: storeUser?.data?.buffer_id,
          screening_session_id: screening?.sessionId
        });
        if (legCatchComplete?.screening) {
          dispatch(setScreening(legCatchComplete.screening));
        }
        const legCatchRoute = getNextRoute(legCatchComplete?.screening?.next_stage, '/voice');
        console.log('[BIA] runPhase1 catch max retry — navigating to:', legCatchRoute);
        navigate(legCatchRoute);
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
        navigate('/bia/wh');
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
      setDisplayValues({
        height: resultsRef.current?.height?.value ?? null,
        weight: resultsRef.current?.weight?.value ?? null,
      });


      // Track combined Weight and Height
      await trackStage(STAGES.WH_FINAL, STATUS.SUCCESS, {
        weight_kg: resultsRef.current?.weight?.value,
        height_cm: resultsRef?.current?.height?.value
      }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id);

      // Both weight and height success - show whComplete
      console.log("[BIA DEBUG] Phase 2 COMPLETE - navigating to /bia/whcomplete");

      // Calculate Leg BIA immediately after weight/height
      await calculateAndStoreLegBIA();

      // setMeasuredValues({
      //   weight: resultsRef.current?.weight?.value ? `${resultsRef.current?.weight?.value} kg` : "-- kg",
      //   height: resultsRef.current?.height?.value ? `${resultsRef.current?.height?.value} cm` : "-- cm"
      // });

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
      } else {
        // Assume failure was weight-related or other
        await showError(ERROR_MESSAGES.weight, 3000);
        await trackStage(STAGES.WH_FINAL, STATUS.ERROR, {}, "main weight measurement failed", storeUser?.data?.buffer_id, storeUser?.data?.user_id);
      }

      const phase2FailComplete = await BIAComplete({
        session_id: storeUser?.data?.buffer_id,
        screening_session_id: screening?.sessionId
      });
      if (phase2FailComplete?.screening) {
        dispatch(setScreening(phase2FailComplete.screening));
      }
      const phase2FailRoute = getNextRoute(phase2FailComplete?.screening?.next_stage, '/voice');
      console.log('[BIA] runPhase2 catch — navigating to:', phase2FailRoute);
      navigate(phase2FailRoute);
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
      await BIAComplete({
        session_id: storeUser?.data?.buffer_id,
        screening_session_id: screening?.sessionId
      });
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
        const shoesCompleteResult = await BIAComplete({
          session_id: storeUser?.data?.buffer_id,
          screening_session_id: screening?.sessionId
        });
        // Cache next_stage from BIAComplete for the shoes path
        biaNextStageRef.current = shoesCompleteResult?.screening?.next_stage ?? null;
        console.log('[BIA] Shoes path BIAComplete next_stage captured:', biaNextStageRef.current);
        if (shoesCompleteResult?.screening) {
          dispatch(setScreening(shoesCompleteResult.screening));
        }
        await new Promise((resolve) => { imCompleteResolver.current = resolve; });
        setIsComplete(true);
        const shoesNextRoute = getNextRoute(shoesCompleteResult?.screening?.next_stage, '/voice');
        console.log('[BIA] runPhase3 shoes path — navigating to:', shoesNextRoute);
        navigate(shoesNextRoute);
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
          skeletalMuscleMassKg: armBiaPayload.skeletal_muscle_mass_kg ?? "10",
          visceralFat: armBiaPayload.visceral_fat_level ?? "5",
          proteinMassKg: armBiaPayload.protein_mass_kg ?? "2.7",
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
    // navigate("/bia/imcomplete");
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
      console.log("[BIA DEBUG] ========== BIA FLOW COMPLETE ==========");
      navigate("/bia/imcomplete");
      await trackStage(STAGES.BIA_COMPLETE, STATUS.SUCCESS, { bia_object: bia?.finalBia }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id);
      console.log("[BIA DEBUG] ========== trackStage BIA FLOW COMPLETE ==========");

      const biaCompleteResult = await BIAComplete({
        session_id: storeUser?.data?.buffer_id,
        screening_session_id: screening?.sessionId
      });

      // Cache next_stage from BIAComplete for handleImNextClick fallback
      biaNextStageRef.current = biaCompleteResult?.screening?.next_stage ?? null;
      console.log('[BIA] BIAComplete next_stage captured:', biaNextStageRef.current);

      // Update Redux screening state with new next_stage from API response
      if (biaCompleteResult?.screening) {
        dispatch(setScreening(biaCompleteResult.screening));
      }

      await new Promise((resolve) => { imCompleteResolver.current = resolve; });
      setIsComplete(true);
      // Navigate to next stage based on backend response
      const nextRoute = getNextRoute(biaCompleteResult?.screening?.next_stage, '/voice');
      console.log('[BIA] runCalculateAndComplete SUCCESS — navigating to:', nextRoute);
      navigate(nextRoute);

    } catch (calcError) {
      console.error("[BIA DEBUG] Calculation error:", calcError.message);
      await trackStage(STAGES.BIA_COMPLETE, STATUS.ERROR, {}, "FINAL BIA CALCULATION FAILED", storeUser?.data?.buffer_id, storeUser?.data?.user_id);

      // Even if the final BIA calculation fails, we still show /bia/imcomplete
      console.log("[BIA DEBUG] Final BIA failed but staying on /bia/imcomplete");
      navigate("/bia/imcomplete");
      const biaCompleteOnError = await BIAComplete({
        session_id: storeUser?.data?.buffer_id,
        screening_session_id: screening?.sessionId
      });

      // Cache next_stage from BIAComplete (error path) for handleImNextClick fallback
      biaNextStageRef.current = biaCompleteOnError?.screening?.next_stage ?? null;
      console.log('[BIA] BIAComplete (error path) next_stage captured:', biaNextStageRef.current);

      if (biaCompleteOnError?.screening) {
        dispatch(setScreening(biaCompleteOnError.screening));
      }
      await new Promise((resolve) => { imCompleteResolver.current = resolve; });
      setIsComplete(true);
      const errorFallbackRoute = getNextRoute(biaCompleteOnError?.screening?.next_stage, '/voice');
      console.log('[BIA] runCalculateAndComplete ERROR — navigating to:', errorFallbackRoute);
      navigate(errorFallbackRoute);
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
      const portFailComplete = await BIAComplete({
        session_id: storeUser?.data?.buffer_id,
        screening_session_id: screening?.sessionId
      });
      if (portFailComplete?.screening) {
        dispatch(setScreening(portFailComplete.screening));
      }
      const portFailRoute = getNextRoute(portFailComplete?.screening?.next_stage, '/voice');
      console.log('[BIA] runFlow port validation failed — navigating to:', portFailRoute);
      navigate(portFailRoute);
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
    console.log("[BIA DEBUG] Starting BIA flow — session:", storeUser?.data?.buffer_id, "user:", storeUser?.data?.user_id);
    // Note: No global timeout - only navigate on MAX_RETRIES exhaustion
    console.log(`[BIA DEBUG] Flow will only redirect on MAX_RETRIES (${MAX_RETRIES}) exhaustion`);

    // Recording is handled by BackgroundCameraProvider automatically
    try {
      // Connect BIA port
      console.log("[BIA DEBUG] Connecting BIA port:", PORT_PATHS.BIA);
      await window.api.connectBiaPort(PORT_PATHS.BIA);
      await sleep(800);
      console.log("[BIA DEBUG] BIA port connected");

      // Start Phase 1
      await runPhase1_LegCheck();

    } catch (e) {
      console.error("[BIA DEBUG] Flow error:", e.message);
      // updatePhaseState('flow', 'failed', e.message);
      await trackStage(STAGES.BIA_COMPLETE, STATUS.ERROR, {}, e.message, storeUser?.data?.buffer_id, storeUser?.data?.user_id);
      // ✅ Ask backend for next stage instead of hardcoding /voice
      const flowExceptionComplete = await BIAComplete({
        session_id: storeUser?.data?.buffer_id,
        screening_session_id: screening?.sessionId,
      });
      if (flowExceptionComplete?.screening) {
        dispatch(setScreening(flowExceptionComplete.screening));
      }
      const flowExceptionRoute = getNextRoute(flowExceptionComplete?.screening?.next_stage, '/voice');
      console.log('[BIA] runFlow unhandled exception — navigating to:', flowExceptionRoute);
      navigate(flowExceptionRoute);
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

  // Handle video end — use backend next_stage if available, fall back to /voice
  const handleVideoEnd = () => {
    // ✅ Use stageRouter so this respects whatever stage the backend set after BIAComplete
    const nextRoute = getNextRoute(screening?.nextStage, '/voice');
    console.log('[BIA DEBUG] Completion video ended, navigating to:', nextRoute);
    navigate(nextRoute);
  };

  /* =======================
     RENDER
  ======================= */
  console.log("[BIA DEBUG] Render - currentPhase:", currentPhase, "isComplete:", isComplete);

  return (
    <>
      <BIAComponent
        screenConfig={screenConfig}
        isComplete={isComplete}
        onVideoEnd={handleVideoEnd}
        heightValue={displayValues.height}
        weightValue={displayValues.weight}
        onNextVoiceClick={handleImNextClick}
        onNextClick={handleWhNextClick}
        arms50k={measuredValues.arms50k}
        user={storeUser}
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
          t={t}
        />
      )}
    </>
  );
}



const BarefootCTAModal = ({ onRemoveShoe, onContinueWithShoes, onClose, t }) => {
  const [step, setStep] = useState("choose"); // "choose" | "barefoot"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="relative w-screen"
        style={{ filter: "drop-shadow(0px 0px 40px rgba(139, 195, 229, 0.4))" }}
      >
        {/* ── textbgframe background ── */}
        <img
          src={textbgframe}
          alt=""
          className="w-full h-full block"
          draggable={false}
        />

        {/* ── Content ── */}
        <div
          className="absolute flex flex-col justify-center"
          style={{
            top: "14%",
            bottom: "20%",
            left: "14%",
            right: "14%",
          }}
        >
          {step === "choose" ? (
            <>
              {/* Title */}
              <div className="flex items-center justify-center mb-10">
                <h2
                  className="text-[#8BC3E5] text-[40px]  m-0 font-anta w-2/3 text-center"
                >
                  {t("bia_component.choose_how")}
                </h2>
              </div>

              {/* Two-choice buttons */}
              <div className="w-full flex gap-x-10">
                <button
                  onClick={() => setStep("barefoot")}
                  className="
                   w-[400px]
                   h-[120px]
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
                    font-anta
                  "
                >
                  {t("bia_component.without_shoes")}
                </button>

                <button
                  onClick={onContinueWithShoes}
                  className="
                  w-[400px]
                   h-[120px]
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
                    font-anta
                  "
                >
                  {t("bia_component.with_shoes")}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Instruction screen */}
              <div className="flex items-center gap-2.5 mb-[6%]">
                <p
                  className="text-[#8BC3E5] text-[40px] font-anta text-center"
                >
                  {t("bia_component.remove_socks_shoes")}
                </p>
              </div>

              {/* Start button */}
              <button
                onClick={onRemoveShoe}
                className="
                  ml-[12rem]
                  w-[clamp(20rem,33vw,31.25rem)]
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
                  font-anta
                "
              >
                {t("bia_component.start")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};