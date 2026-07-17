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
import AreYouThereModal from "./AreYouThereModal";
export default function BIACalculate({ user, onComplete }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const storeUser = useSelector((state) => state.common.user);
  const screeningState = useSelector((state) => state.common.screening);

  // const { updateMetadata, clearMetadata } = useBackgroundCamera();

  // Base state
  const [ports, setPorts] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStatus, setCurrentStatus] = useState("");
  const [errorState, setErrorState] = useState(null);
  const [showHeightError, setShowHeightError] = useState(true);
  const [heightErrorCountdown, setHeightErrorCountdown] = useState(10);
  const [isComplete, setIsComplete] = useState(false);
  // Shoes CTA step: null | 'ctaA' | 'ctaB_1st' | 'ctaB_2nd' | 'ctaC' | 'ctaD'
  const [shoesCtaStep, setShoesCtaStep] = useState(null);
  const shoesCtaResolverRef = useRef(null);   // resolves 'shoes' | 'barefoot_success' | 'barefoot_fail'
  const ctaTimerRef = useRef(null);            // active CTA countdown timer
  const lastLegErrorCodeRef = useRef(null);   // 'ELECTRODE' or other, from main process
  const shoesCtaHandlersRef = useRef({});     // live callbacks for the CTA modals
  const whCompleteResolver = useRef(null);
  const imCompleteResolver = useRef(null);
  // Stores next_stage from BIAComplete API response for use in handleImNextClick
  const biaNextStageRef = useRef(null);
  const [measuredValues, setMeasuredValues] = useState({
    height: "-- cm",
    weight: "-- kg",
    arms50k: {},
    leg50k: {},
    bia20k_100khz: {}
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
    leg50k: null,
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
        // Capture the leg error code so runPhase2_LegCheck can detect ELECTRODE errors
        if (payload.source === 'LEG' && payload.code) {
          lastLegErrorCodeRef.current = payload.code;
          console.log("[BIA DEBUG] lastLegErrorCodeRef set from handleStatus:", payload.code);
        }

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

    // LEG ERROR: Store error code for use in Phase 2 logic
    const handleLegError = (payload) => {
      console.error("[BIA DEBUG] LEG ERROR received from main:", payload);
      console.error(`[BIA DEBUG] Leg attempt: ${payload.attempt}, code: ${payload.code}`);
      // Store the error code so runPhase2_LegCheck can distinguish electrode vs hardware error
      lastLegErrorCodeRef.current = payload.code ?? null;
      if (payload.attempt) {
        attemptTracking.current.leg = payload.attempt;
      }
    };

    // ARM ERROR: Check if user is holding electrodes
    // const handleArmError = (payload) => {
    //   console.error("[BIA DEBUG] ARM ERROR received from main:", payload);
    //   console.error(`[BIA DEBUG] Arm attempt: ${payload.attempt}, code: ${payload.code}`);

    //   // Track attempt
    //   if (payload.attempt) {
    //     attemptTracking.current.arm = payload.attempt;
    //   }

    //   // ✅ ACTIVE ERROR TRIGGERING: Show error immediately when threshold exceeded
    //   if (payload.attempt >= ATTEMPT_THRESHOLDS.arm && !errorTriggered.current.arm) {
    //     if (payload.code === 'ELECTRODE') {
    //       console.error(`[BIA DEBUG] ⚠️ Arm ELECTRODE error at attempt ${payload.attempt} - TRIGGERING ERROR NOW!`);
    //       errorTriggered.current.arm = true;

    //       // Show error immediately
    //       (async () => {
    //         console.log("[BIA DEBUG] Showing arm electrode error");
    //         await showError(ERROR_MESSAGES.armImpedance, 5000);
    //       })();
    //     }
    //   }
    // };

    // // WEIGHT ERROR
    // const handleWeightError = (payload) => {
    //   console.error("[BIA DEBUG] WEIGHT ERROR received from main:", payload);
    // };

    // // HEIGHT ERROR
    // const handleHeightError = async (payload) => {
    //   console.error("[BIA DEBUG] HEIGHT ERROR received from main:", payload);
    //   await showError(ERROR_MESSAGES.HEIGHT_PORT_NOT_CONNECTED, 3000);
    //   console.log("[BIA REC] ⏏️  Height port error → saveBuffer('height_port_error')");
    //   await saveBuffer("height_port_error");
    //   const heightErrorComplete = await BIAComplete({
    //     session_id: storeUser?.data?.buffer_id,
    //     screening_session_id: storeUser?.screening?.session_id
    //   });
    //   if (heightErrorComplete?.screening) {
    //     dispatch(setScreening(heightErrorComplete.screening));
    //   }
    //   const heightErrorRoute = getNextRoute(heightErrorComplete?.screening?.next_stage, '/voice');
    //   console.log('[BIA] handleHeightError — navigating to:', heightErrorRoute);
    //   navigate(heightErrorRoute);

    //   // Track attempt for height (continuous polling)
    //   if (payload.attempt) {
    //     attemptTracking.current.height = payload.attempt;
    //   }
    // };

    // // IMPEDANCE ERROR (20kHz / 100kHz)
    // const handleImpedanceError = (payload) => {
    //   console.error("[BIA DEBUG] IMPEDANCE ERROR received from main:", payload);
    //   console.error(`[BIA DEBUG] Impedance attempt: ${payload.attempt}, frequency: ${payload.frequency}`);

    //   // Track attempts
    //   if (payload.attempt) {
    //     if (payload.frequency === 20) {
    //       attemptTracking.current.impedance20 = payload.attempt;
    //     } else if (payload.frequency === 100) {
    //       attemptTracking.current.impedance100 = payload.attempt;
    //     }
    //   }
    // };

    // Subscribe to events
    const unsubs = [
      // window.api?.onLegError?.(handleLegError),
      window.api?.onLegStatus?.(handleStatus),
      // window.api?.onArmError?.(handleArmError),
      window.api?.onArmStatus?.(handleStatus),
      // window.api?.onWeightError?.(handleWeightError),
      window.api?.onWeightStatus?.(handleStatus),
      // window.api?.onHeightError?.(handleHeightError),
      window.api?.onHeightStatus?.(handleStatus),
      // window.api?.onImpedanceError?.(handleImpedanceError),
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

  /**
   * Shows the animated "Stand Properly" modal for 10 seconds with a live countdown,
   * then hides it and resolves — caller then retries height measurement.
   */
  const showHeightErrorModal = () => {
    console.log('[BIA DEBUG] Showing StandProperly modal for 10s');
    setHeightErrorCountdown(10);
    setShowHeightError(true);
    return new Promise((resolve) => {
      let count = 10;
      const tick = setInterval(() => {
        count -= 1;
        setHeightErrorCountdown(count);
        if (count <= 0) {
          clearInterval(tick);
          setShowHeightError(false);
          resolve();
        }
      }, 1000);
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
      const nextRoute = getNextRoute(biaNextStageRef.current, '/space-convoy-main');
      console.log('[BIA] handleImNextClick — navigating to:', nextRoute);
      navigate(nextRoute);
    }
  };

  // measurePreliminaryWeight removed — W+H is now Phase 1, no pre-weight check needed

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

    // resultsRef.current.arms50k = {
    //   fatPercentage: res.body_fat_percentage ?? "20",
    //   waterPercentage: res.moisture_content_kg ?? "55",
    //   muscleMassKg: res.muscle_mass_kg ?? "30",
    //   boneMassKg: res.bone_mass_kg ?? "10",
    // };
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
     PHASE 1: WEIGHT + HEIGHT
     - Parallel measurement, one automatic 10s-timeout retry.
     - No user button — fully automatic.
     - Double failure → skip BIA entirely.
  ======================= */
  const runPhase1_WeightHeight = async () => {
    console.log("[BIA DEBUG] ========== PHASE 1: WEIGHT + HEIGHT ==========");
    setCurrentPhase('wh');
    navigate('/bia/wh');

    // Run W+H in parallel; returns settled status without throwing.
    const attemptWH = async () => {
      const [wRes, hRes] = await Promise.allSettled([
        measureWeight(),
        measureHeight(),
      ]);
      return { weightOk: wRes.status === 'fulfilled', heightOk: hRes.status === 'fulfilled' };
    };

    // --- Attempt 1 ---
    console.log("[BIA DEBUG] Phase 1 — Attempt 1: W+H parallel");
    let { weightOk, heightOk } = await attemptWH();

    if (!weightOk || !heightOk) {
      console.warn(`[BIA DEBUG] Phase 1 Attempt 1 FAILED — W:${weightOk} H:${heightOk}`);

      if (!heightOk) {
        // Height failed → show animated "Stand Properly" modal for 10 seconds
        console.warn('[BIA DEBUG] Height failed — showing StandProperly modal for 10s');
        await showHeightErrorModal();
      } else {
        // Only weight failed → show generic error for 3s
        setErrorState({ title: ERROR_MESSAGES.weight, canRetry: false });
        await sleep(3000);
        setErrorState(null);
      }

      // --- Attempt 2 (auto retry) ---
      console.log("[BIA DEBUG] Phase 1 — Attempt 2 (auto-retry): W+H parallel");
      ({ weightOk, heightOk } = await attemptWH());

      if (!weightOk || !heightOk) {
        // Double fail — skip BIA
        console.error(`[BIA DEBUG] Phase 1 DOUBLE FAIL — W:${weightOk} H:${heightOk} — skipping BIA`);
        await trackStage(STAGES.WH_FINAL, STATUS.ERROR, {}, 'W+H failed after auto-retry', storeUser?.data?.buffer_id, storeUser?.data?.user_id);
        console.log("[BIA REC] ⏏️  Phase 1 — W+H double fail → saveBuffer('wh_skip')");
        await saveBuffer('wh_skip');
        // Disconnect ports before navigating away
        console.log("[BIA DEBUG] Phase 1 double-fail — disconnecting BIA + height ports");
        await Promise.allSettled([
          // window.api.disconnectBiaPort(),
          window.api.disconnectHeightPort(),
        ]);
        const whSkipComplete = await BIAComplete({
          session_id: storeUser?.data?.buffer_id,
          screening_session_id: screeningState?.sessionId,
        });
        if (whSkipComplete?.screening) dispatch(setScreening(whSkipComplete.screening));
        const whSkipRoute = getNextRoute(whSkipComplete?.screening?.next_stage, '/space-convoy-main');
        console.log('[BIA] Phase 1 W+H skip — navigating to:', whSkipRoute);
        navigate(whSkipRoute);
        return;
      }
    }

    // --- Both W+H succeeded ---
    console.log("[BIA DEBUG] Phase 1 SUCCESS — W+H both measured");
    setDisplayValues({
      height: resultsRef.current?.height?.value ?? null,
      weight: resultsRef.current?.weight?.value ?? null,
    });
    await trackStage(STAGES.WH_FINAL, STATUS.SUCCESS, {
      weight_kg: resultsRef.current?.weight?.value,
      height_cm: resultsRef.current?.height?.value,
    }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id);

    // Disconnect BIA + height ports — W+H done, no longer needed
    console.log("[BIA DEBUG] Phase 1 SUCCESS — disconnecting BIA + height ports before Phase 2");
    await Promise.allSettled([
      // window.api.disconnectBiaPort(),
      window.api.disconnectHeightPort(),
    ]);

    await runPhase2_LegCheck();
  };


  /* =======================
     PHASE 2: LEG 50KHZ
     - Runs after W+H. All outcomes land at /bia/whcomplete.
     - User clicks "Next" → Phase 3 starts.
  ======================= */

  const clearCtaTimer = () => {
    if (ctaTimerRef.current) { clearTimeout(ctaTimerRef.current); ctaTimerRef.current = null; }
  };
  const startCtaTimer = (ms, cb) => { clearCtaTimer(); ctaTimerRef.current = setTimeout(cb, ms); };
  const resolveShoesCta = (outcome) => {
    clearCtaTimer();
    setShoesCtaStep(null);
    lastLegErrorCodeRef.current = null;
    shoesCtaResolverRef.current?.(outcome);
    shoesCtaResolverRef.current = null;
  };

  /**
   * Promise-based shoes CTA tree (A → B/D → C → B2).
   * Resolves with 'shoes' | 'barefoot_success' | 'barefoot_fail'.
   */
  const runShoesCtaTree = () =>
    new Promise((resolve) => {
      shoesCtaResolverRef.current = resolve;

      const showCtaA = () => {
        setShoesCtaStep('ctaA');
        startCtaTimer(10000, () => showCtaD());
      };

      const showCtaB_1st = () => {
        setShoesCtaStep('ctaB_1st');
        startCtaTimer(30000, () => showCtaC());
      };

      const showCtaB_2nd = () => {
        setShoesCtaStep('ctaB_2nd');
        startCtaTimer(10000, () => { resultsRef.current.isShoesContinued = true; resolveShoesCta('shoes'); });
      };

      const showCtaC = () => {
        setShoesCtaStep('ctaC');
        startCtaTimer(10000, () => { resultsRef.current.isShoesContinued = true; resolveShoesCta('shoes'); });
      };

      const showCtaD = () => {
        setShoesCtaStep('ctaD');
        startCtaTimer(10000, () => { resultsRef.current.isShoesContinued = true; resolveShoesCta('shoes'); });
      };

      const retryLeg = async (fromCta) => {
        setShoesCtaStep(null);
        clearCtaTimer();
        try {
          await measureLegImpedance();
          console.log(`[BIA] Leg retry (${fromCta}) SUCCESS — barefoot confirmed`);
          await trackStage(STAGES.LEG_50KHZ, STATUS.SUCCESS, { impedance_data: { impedance_50khz_ohm: resultsRef.current.legImpedance?.impedance } }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id);
          await calculateAndStoreLegBIA();
          resolveShoesCta('barefoot_success');
        } catch {
          console.warn(`[BIA] Leg retry (${fromCta}) FAILED — proceeding shoes path`);
          resultsRef.current.isShoesContinued = true;
          resolveShoesCta('barefoot_fail');
        }
      };

      shoesCtaHandlersRef.current = {
        onCtaAYes: () => { resultsRef.current.isShoesContinued = true; resolveShoesCta('shoes'); },
        onCtaANo: () => { clearCtaTimer(); showCtaB_1st(); },
        onCtaB1stStart: () => retryLeg('CTA-B-1st'),
        onCtaB2ndStart: () => retryLeg('CTA-B-2nd'),
        onCtaCYes: () => { clearCtaTimer(); showCtaB_2nd(); },
        onCtaCNoOrTimeout: () => { resultsRef.current.isShoesContinued = true; resolveShoesCta('shoes'); },
        onCtaDYes: () => { clearCtaTimer(); showCtaA(); },
        onCtaDNoOrTimeout: () => { resultsRef.current.isShoesContinued = true; resolveShoesCta('shoes'); },
      };

      showCtaA();
    });

  const runPhase2_LegCheck = async () => {
    console.log("[BIA DEBUG] ========== PHASE 2: LEG 50KHZ ==========");
    setCurrentPhase('leg');
    lastLegErrorCodeRef.current = null;
    attemptTracking.current.leg = 0;
    errorTriggered.current.leg = false;

    try {
      await measureLegImpedance();
      console.log("[BIA DEBUG] Phase 2 Leg SUCCESS — barefoot confirmed");
      await trackStage(STAGES.LEG_50KHZ, STATUS.SUCCESS, { impedance_data: { impedance_50khz_ohm: resultsRef.current.legImpedance.impedance } }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id);
      await calculateAndStoreLegBIA();
    } catch (legError) {
      console.error("[BIA DEBUG] Phase 2 Leg FAILED:", legError.message);
      // Wait briefly for the async IPC handleLegError event to fire and populate lastLegErrorCodeRef
      await sleep(300);
      console.log("[BIA DEBUG] lastLegErrorCodeRef after sleep:", lastLegErrorCodeRef.current);
      if (lastLegErrorCodeRef.current === 'ELECTRODE') {
        console.log("[BIA DEBUG] ELECTRODE error — starting shoes CTA tree");
        const outcome = await runShoesCtaTree();
        console.log(`[BIA DEBUG] Shoes CTA resolved: ${outcome}`);
      } else {
        console.warn("[BIA DEBUG] Hardware/generic leg error — skipping leg");
        await trackStage(STAGES.LEG_50KHZ, STATUS.ERROR, {}, legError.message, storeUser?.data?.buffer_id, storeUser?.data?.user_id);
        resultsRef.current.isShoesContinued = true;
      }
    }

    // All Phase 2 paths land here
    console.log("[BIA DEBUG] Phase 2 complete — navigating to /bia/whcomplete");
    navigate('/bia/whcomplete');
    await new Promise((resolve) => { whCompleteResolver.current = resolve; });
    await runPhase3_Impedance();
  };


  /* =======================
     PHASE 3: ARM IMPEDANCE + 20kHz + 100kHz
     - If any fails, retry from arm impedance
  ======================= */
  // const runPhase3_Impedance = async (attemptCount = 0) => {
  //   console.log("[BIA DEBUG] ========== PHASE 3: IMPEDANCE MEASUREMENTS ==========");
  //   console.log(`[BIA DEBUG] Phase 3 attempt: ${attemptCount + 1}/${MAX_RETRIES}`);
  //   setCurrentPhase('arm');

  //   // Check if we've exhausted retries BEFORE attempting
  //   if (attemptCount >= MAX_RETRIES) {
  //     console.error(`[BIA DEBUG] Phase 3 EXHAUSTED all ${MAX_RETRIES} retries - redirecting to /space-convoy-main`);
  //     //await showError(ERROR_MESSAGES.maxRetryReached, 4000);
  //     await BIAComplete({
  //       session_id: storeUser?.data?.buffer_id,
  //       screening_session_id: screeningState?.sessionId
  //     });
  //     console.log("[BIA REC] ⏏️  Phase 3 — arm/impedance max retries exhausted → saveBuffer('arm_max_retry')");
  //     await saveBuffer("arm_max_retry");
  //     navigate("/bia/imcomplete");
  //     return;
  //   }

  //   // Reset attempt tracking and error flags for arm and impedance
  //   attemptTracking.current.arm = 0;
  //   attemptTracking.current.impedance20 = 0;
  //   attemptTracking.current.impedance100 = 0;
  //   errorTriggered.current.arm = false;
  //   errorTriggered.current.impedance20 = false;
  //   errorTriggered.current.impedance100 = false;
  //   console.log("[BIA DEBUG] Reset arm/impedance attempt tracking and error flags");

  //   // Navigate to impedance screen
  //   navigate("/bia/im");
  //   await sleep(8000);

  //   try {
  //     // Arm Impedance 50kHz
  //     const res = await measureArmImpedance(attemptCount);
  //     await sleep(800);
  //     console.log("[BIA DEBUG] Arm impedance SUCCESS");
  //     await trackStage(STAGES.ARM_50KHZ, STATUS.SUCCESS, { impedance_data: { impedance_50khz_ohm: resultsRef.current.armImpedance.impedance } }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id, Number(attemptCount + 1));

  //     // Calculate Arm BIA immediately after arm impedance
  //     await calculateAndStoreArmBIA(attemptCount);

  //     if (resultsRef.current.isShoesContinued) {
  //       console.log("[BIA DEBUG] Shoes continued - skipping frequency measurements, showing imcomplete screen");
  //       navigate("/bia/imcomplete");
  //       const shoesCompleteResult = await BIAComplete({
  //         session_id: storeUser?.data?.buffer_id,
  //         screening_session_id: screeningState?.sessionId
  //       });
  //       // Cache next_stage from BIAComplete for the shoes path
  //       biaNextStageRef.current = shoesCompleteResult?.screening?.next_stage ?? null;
  //       console.log('[BIA] Shoes path BIAComplete next_stage captured:', biaNextStageRef.current);
  //       if (shoesCompleteResult?.screening) {
  //         dispatch(setScreening(shoesCompleteResult.screening));
  //       }
  //       console.log("[BIA REC] 🏁 Shoes path — stopping and sending recording via stopAndSend()");
  //       await stopAndSend(); // ✅ Stop recording before navigating away
  //       await new Promise((resolve) => { imCompleteResolver.current = resolve; });
  //       setIsComplete(true);
  //       const shoesNextRoute = getNextRoute(shoesCompleteResult?.screening?.next_stage, '/space-convoy-main');
  //       console.log('[BIA] runPhase3 shoes path — navigating to:', shoesNextRoute);
  //       navigate(shoesNextRoute);
  //       return;
  //     }
  //     // Impedance 20kHz
  //     await measureImpedance("20", attemptCount);
  //     // await trackStage(STAGES.IMPEDANCE_20KHZ, STATUS.SUCCESS, { impedance20: resultsRef.current.impedance.k20 }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id);
  //     await sleep(1500);
  //     console.log("[BIA DEBUG] Impedance 20kHz SUCCESS");


  //     // Impedance 100kHz
  //     await measureImpedance("100", attemptCount);

  //     // Track combined Impedances
  //     if (resultsRef.current.impedance.k20 && resultsRef.current.impedance.k100) {
  //       await trackStage(STAGES.IMPDEDANCE_20_100KHZ, STATUS.SUCCESS, {
  //         impedance_data: {
  //           impedance_20khz_ohm: resultsRef.current.impedance.k20.avg,
  //           impedance_100khz_ohm: resultsRef.current.impedance.k100.avg
  //         }
  //       }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id, Number(attemptCount + 1));
  //     }
  //     console.log("[BIA DEBUG] Impedance 100kHz SUCCESS");

  //     // All impedance measurements success
  //     console.log("[BIA DEBUG] Phase 3 COMPLETE - All impedance measurements done");
  //     await runCalculateAndComplete();

  //   } catch (impedanceError) {
  //     console.error("[BIA DEBUG] Phase 3 FAILED:", impedanceError.message);

  //     // Track Error for Consolidated Impedances
  //     await trackStage(STAGES.IMPDEDANCE_20_100KHZ, STATUS.ERROR, {

  //     }, impedanceError.message, storeUser?.data?.buffer_id, storeUser?.data?.user_id);

  //     // Reset arm and impedance results to retry from arm
  //     resultsRef.current.armImpedance = null;
  //     resultsRef.current.impedance = { k20: null, k100: null };

  //     // Retry with incremented attempt count
  //     console.log(`[BIA DEBUG] Phase 3 retry ${attemptCount + 2}/${MAX_RETRIES} - resetting arm/impedance results...`);
  //     if (attemptCount === 0) {
  //       await showError(ERROR_MESSAGES.armImpedance, 3000);
  //     }
  //     await runPhase3_Impedance(attemptCount + 1);
  //   }
  // };
  const runPhase3_Impedance = async () => {
    console.log("[BIA DEBUG] ========== PHASE 3: IMPEDANCE MEASUREMENTS (revised) ==========");
    setCurrentPhase('arm');

    const legExists = !!resultsRef.current.legImpedance;
    console.log("[BIA DEBUG] Phase 3 — leg detected:", legExists);

    if (legExists) {
      await runPhase3_LegExists();
    } else {
      await runPhase3_NoLeg();
    }
  };

  const try20kHz = async (attemptLabel) => {
    console.log(`[BIA DEBUG] ${attemptLabel}: attempting 20kHz`);
    try {
      await measureImpedance("20", 0);
      console.log(`[BIA DEBUG] ${attemptLabel}: 20kHz SUCCESS`);
      return true;
    } catch {
      console.warn(`[BIA DEBUG] ${attemptLabel}: 20kHz FAILED`);
      resultsRef.current.impedance.k20 = null;
      return false;
    }
  };

  const try100kHz = async (attemptLabel) => {
    console.log(`[BIA DEBUG] ${attemptLabel}: attempting 100kHz`);
    try {
      await measureImpedance("100", 0);
      console.log(`[BIA DEBUG] ${attemptLabel}: 100kHz SUCCESS`);
      return true;
    } catch {
      console.warn(`[BIA DEBUG] ${attemptLabel}: 100kHz FAILED`);
      resultsRef.current.impedance.k100 = null;
      return false;
    }
  };

  /**
 * Thin wrapper around the existing measureArmImpedance + calculateAndStoreArmBIA.
 * attemptCount is passed through for trackStage numbering.
 * Returns true on success, false on failure.
 */
  const tryArm50kHz = async (attemptLabel, attemptCount = 0) => {
    console.log(`[BIA DEBUG] ${attemptLabel}: attempting arm 50kHz (attemptCount=${attemptCount})`);
    try {
      await measureArmImpedance(attemptCount);
      await trackStage(STAGES.ARM_50KHZ, STATUS.SUCCESS, { impedance_data: { impedance_50khz_ohm: resultsRef.current.armImpedance?.impedance } }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id, attemptCount + 1);
      await calculateAndStoreArmBIA(attemptCount);
      console.log(`[BIA DEBUG] ${attemptLabel}: arm 50kHz SUCCESS`);
      return true;
    } catch {
      console.warn(`[BIA DEBUG] ${attemptLabel}: arm 50kHz FAILED`);
      resultsRef.current.armImpedance = null;
      return false;
    }
  };

  /**
  * Navigate to /bia/imcomplete, call BIAComplete, wait for user click, then navigate away.
  * Used by all fallback paths that skip runCalculateAndComplete().
  */
  const finishWithImcomplete = async (bufferTag) => {
    navigate("/bia/imcomplete");

    const result = await BIAComplete({
      session_id: storeUser?.data?.buffer_id,
      screening_session_id: screeningState?.sessionId,
    });
    biaNextStageRef.current = result?.screening?.next_stage ?? null;
    if (result?.screening) dispatch(setScreening(result.screening));

    console.log(`[BIA REC] ⏏️  ${bufferTag} → saveBuffer('${bufferTag}')`);
    await saveBuffer(bufferTag);

    await new Promise((resolve) => { imCompleteResolver.current = resolve; });
    setIsComplete(true);
    const route = getNextRoute(result?.screening?.next_stage, '/space-convoy-main');
    console.log('[BIA] finishWithImcomplete — navigating to:', route);
    navigate(route);
  };


  /* ─────────────────────────────────────────────
     PATH A: Leg was detected in Phase 2
  ───────────────────────────────────────────── */
  const runPhase3_LegExists = async () => {
    console.log("[BIA DEBUG] Phase 3 path: LEG EXISTS — skipping arm 50kHz, starting 20kHz");
    navigate("/bia/im");
    await sleep(8000);

    // Reset tracking
    attemptTracking.current.arm = 0;
    attemptTracking.current.impedance20 = 0;
    attemptTracking.current.impedance100 = 0;
    errorTriggered.current.arm = false;
    errorTriggered.current.impedance20 = false;
    errorTriggered.current.impedance100 = false;

    // ── Try 20kHz (first attempt) ──
    const ok20_first = await try20kHz("P3-LegExists-1st");

    if (ok20_first) {
      // ── Try 100kHz ──
      const ok100 = await try100kHz("P3-LegExists");
      if (ok100) {
        await trackStage(STAGES.IMPDEDANCE_20_100KHZ, STATUS.SUCCESS, {
          impedance_data: {
            impedance_20khz_ohm: resultsRef.current.impedance.k20?.avg,
            impedance_100khz_ohm: resultsRef.current.impedance.k100?.avg,
          }
        }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id, 1);
        await runCalculateAndComplete();
      } else {
        // 100kHz failed — treat same as full fail, fallback
        await trackStage(STAGES.IMPDEDANCE_20_100KHZ, STATUS.ERROR, {}, "100kHz failed", storeUser?.data?.buffer_id, storeUser?.data?.user_id);
        await finishWithImcomplete("100khz_fail");
      }
      return;
    }

    // ── 20kHz failed → arm 50kHz [v1] ──
    console.log("[BIA DEBUG] 20kHz failed — entering arm 50kHz [v1] path");
    const armOk = await runArm50kHz_v1();

    if (!armOk) {
      // Arm completely failed after retries → show leg result
      console.log("[BIA DEBUG] Arm 50kHz exhausted — showing leg result");
      await trackStage(STAGES.ARM_50KHZ, STATUS.ERROR, {}, "Arm 50kHz exhausted, showing leg result", storeUser?.data?.buffer_id, storeUser?.data?.user_id);
      await finishWithImcomplete("leg_result_fallback");
      return;
    }

    // Arm succeeded → retry 20kHz up to 2 times
    await retry20kHz_after_arm();
  };

  /**
   * Try arm 50kHz, retry up to 2 times on failure.
   * Returns true if arm eventually succeeded, false if exhausted.
   */
  const runArm50kHz_v1 = async () => {
    // Attempt 1
    const ok1 = await tryArm50kHz("Arm-v1-attempt-1", 0);
    if (ok1) return true;

    // Attempt 2 — show error first
    await showError(ERROR_MESSAGES.armImpedance, 3000);
    const ok2 = await tryArm50kHz("Arm-v1-attempt-2", 1);
    if (ok2) return true;

    // Attempt 3 — show error first
    await showError(ERROR_MESSAGES.armImpedance, 3000);
    const ok3 = await tryArm50kHz("Arm-v1-attempt-3", 2);
    return ok3;
  };

  /**
   * After arm 50kHz succeeded ([v1]), retry 20kHz up to 2 times.
   * Shows error before the 2nd attempt.
   * On continued failure → show 50kHz arm result.
   * On success → do 100kHz → runCalculateAndComplete().
   */
  const retry20kHz_after_arm = async () => {
    console.log("[BIA DEBUG] Retrying 20kHz after arm 50kHz success (up to 2 attempts)");

    // Attempt 1
    const ok1 = await try20kHz("20kHz-retry-1");
    if (ok1) {
      const ok100 = await try100kHz("20kHz-retry-1-then-100kHz");
      if (ok100) {
        await trackStage(STAGES.IMPDEDANCE_20_100KHZ, STATUS.SUCCESS, {
          impedance_data: {
            impedance_20khz_ohm: resultsRef.current.impedance.k20?.avg,
            impedance_100khz_ohm: resultsRef.current.impedance.k100?.avg,
          }
        }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id, 1);
        await runCalculateAndComplete();
      } else {
        await finishWithImcomplete("arm50k_result_100khz_fail");
      }
      return;
    }

    // Show error before attempt 2
    await showError(ERROR_MESSAGES.armImpedance, 3000);

    // Attempt 2
    const ok2 = await try20kHz("20kHz-retry-2");
    if (ok2) {
      const ok100 = await try100kHz("20kHz-retry-2-then-100kHz");
      if (ok100) {
        await trackStage(STAGES.IMPDEDANCE_20_100KHZ, STATUS.SUCCESS, {
          impedance_data: {
            impedance_20khz_ohm: resultsRef.current.impedance.k20?.avg,
            impedance_100khz_ohm: resultsRef.current.impedance.k100?.avg,
          }
        }, null, storeUser?.data?.buffer_id, storeUser?.data?.user_id, 2);
        await runCalculateAndComplete();
      } else {
        await finishWithImcomplete("arm50k_result_100khz_fail");
      }
      return;
    }

    // Both retries failed → show 50kHz arm result
    console.log("[BIA DEBUG] 20kHz failed after 2 retries — showing 50kHz arm result");
    await trackStage(STAGES.IMPDEDANCE_20_100KHZ, STATUS.ERROR, {}, "20kHz failed after arm 50kHz retries", storeUser?.data?.buffer_id, storeUser?.data?.user_id);
    await finishWithImcomplete("arm50k_result_20khz_exhausted");
  };

  /* ─────────────────────────────────────────────
     PATH B: Leg was NOT detected in Phase 2
  ───────────────────────────────────────────── */
  const runPhase3_NoLeg = async () => {
    console.log("[BIA DEBUG] Phase 3 path: NO LEG — doing arm 50kHz only");
    navigate("/bia/im");
    await sleep(8000);

    attemptTracking.current.arm = 0;
    errorTriggered.current.arm = false;

    // Attempt 1
    const ok1 = await tryArm50kHz("NoLeg-arm-attempt-1", 0);
    if (ok1) {
      console.log("[BIA DEBUG] No-leg path: arm 50kHz success — showing hand result");
      await finishWithImcomplete("noleg_arm50k_success");
      return;
    }

    // Attempt 2 — show error first
    await showError(ERROR_MESSAGES.armImpedance, 3000);
    const ok2 = await tryArm50kHz("NoLeg-arm-attempt-2", 1);
    if (ok2) {
      await finishWithImcomplete("noleg_arm50k_success_retry2");
      return;
    }

    // Attempt 3 — show error first
    await showError(ERROR_MESSAGES.armImpedance, 3000);
    const ok3 = await tryArm50kHz("NoLeg-arm-attempt-3", 2);
    if (ok3) {
      await finishWithImcomplete("noleg_arm50k_success_retry3");
      return;
    }

    // All failed → move to next screen
    console.log("[BIA DEBUG] No-leg path: arm 50kHz exhausted — moving to next screen");
    await trackStage(STAGES.ARM_50KHZ, STATUS.ERROR, {}, "No-leg arm 50kHz exhausted", storeUser?.data?.buffer_id, storeUser?.data?.user_id);
    const result = await BIAComplete({
      session_id: storeUser?.data?.buffer_id,
      screening_session_id: screeningState?.sessionId,
    });
    if (result?.screening) dispatch(setScreening(result.screening));
    await saveBuffer("noleg_arm_exhausted");
    const route = getNextRoute(result?.screening?.next_stage, '/space-convoy-main');
    console.log('[BIA] No-leg exhausted — navigating to:', route);
    navigate(route);
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
          gender: storeUser?.data?.gender?.toLowerCase() === "male" ? 1 : 0,
          heightCm: resultsRef.current.height.value,
          ageYears: storeUser?.data?.age,
          weightKg: resultsRef.current.weight.value
        });
        console.log("[BIA DEBUG] Leg BIA payload:", legBiaPayload);
        resultsRef.current.leg50k = {
          fatPercentage: legBiaPayload.body_fat_percentage ?? "8",
          waterPercentage: legBiaPayload.moisture_content_kg ?? "57",
          muscleMassKg: legBiaPayload.muscle_mass_kg ?? "5",
          boneMassKg: legBiaPayload.bone_mass_kg ?? "2.7",
          skeletalMuscleMassKg: legBiaPayload.skeletal_muscle_mass_kg ?? "10",
          visceralFat: legBiaPayload.visceral_fat_level ?? "5",
          proteinMassKg: legBiaPayload.protein_mass_kg ?? "2.7",
        };

        setMeasuredValues((prev) => ({
          ...prev,
          leg50k: resultsRef.current.leg50k,
        }));
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
          gender: storeUser?.data?.gender?.toLowerCase() === "male" ? 1 : 0,
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
        gender: storeUser?.data?.gender?.toLowerCase() ?? "male",
        impedance20: resultsRef.current.impedance.k20.segments,
        impedance100: resultsRef.current.impedance.k100.segments
      });

      console.log("[BIA DEBUG] BIA calculation result:", bia);
      console.log("[BIA DEBUG] BIA success:", bia?.success);
      console.log("[BIA DEBUG] BIA summary:", bia?.summary);

      resultsRef.current.bia20k_100khz = bia?.summary;

      setMeasuredValues((prev) => ({
        ...prev,
        bia20k_100khz: bia?.summary,
      }));
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
        screening_session_id: screeningState?.sessionId
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
      const nextRoute = getNextRoute(biaCompleteResult?.screening?.next_stage, '/space-convoy-main');
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
        screening_session_id: screeningState?.sessionId
      });

      // Cache next_stage from BIAComplete (error path) for handleImNextClick fallback
      biaNextStageRef.current = biaCompleteOnError?.screening?.next_stage ?? null;
      console.log('[BIA] BIAComplete (error path) next_stage captured:', biaNextStageRef.current);

      if (biaCompleteOnError?.screening) {
        dispatch(setScreening(biaCompleteOnError.screening));
      }
      await new Promise((resolve) => { imCompleteResolver.current = resolve; });
      setIsComplete(true);
      const errorFallbackRoute = getNextRoute(biaCompleteOnError?.screening?.next_stage, '/space-convoy-main');
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
        screening_session_id: screeningState?.sessionId
      });
      if (portFailComplete?.screening) {
        dispatch(setScreening(portFailComplete.screening));
      }
      const portFailRoute = getNextRoute(portFailComplete?.screening?.next_stage, '/space-convoy-main');
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

      // Start Phase 1 (W+H)
      await runPhase1_WeightHeight();

    } catch (e) {
      console.error("[BIA DEBUG] Flow error:", e.message);
      // updatePhaseState('flow', 'failed', e.message);
      await trackStage(STAGES.BIA_COMPLETE, STATUS.ERROR, {}, e.message, storeUser?.data?.buffer_id, storeUser?.data?.user_id);
      // ✅ Ask backend for next stage instead of hardcoding /voice
      const flowExceptionComplete = await BIAComplete({
        session_id: storeUser?.data?.buffer_id,
        screening_session_id: screeningState?.sessionId,
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

  // Handle video end - navigate to screen1
  const handleVideoEnd = () => {
    console.log("[BIA DEBUG] Completion video ended, navigating to /space-convoy-main");
    navigate("/space-convoy-main");
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
        leg50k={measuredValues.leg50k}
        bia20k_100khz={measuredValues.bia20k_100khz}
        user={storeUser}
      />

      <ErrorAlert
        visible={!!errorState}
        title={errorState?.title}
        description={errorState?.description}
        onClose={() => setErrorState(null)}
        onRetry={undefined}
      />

      {/* Stand Properly Modal — shown when height measurement fails */}
      {showHeightError && (
        <StandProperlyModal countdown={heightErrorCountdown} />
      )}

      {/* Shoes CTA Tree — driven by shoesCtaStep state */}
      {shoesCtaStep === 'ctaA' && (
        <ContinueWithShoesModal
          onYes={shoesCtaHandlersRef.current.onCtaAYes}
          onNo={shoesCtaHandlersRef.current.onCtaANo}
        />
      )}
      {(shoesCtaStep === 'ctaB_1st' || shoesCtaStep === 'ctaB_2nd') && (
        <PressStartModal
          timeoutSecs={shoesCtaStep === 'ctaB_1st' ? 30 : 10}
          onStart={shoesCtaStep === 'ctaB_1st'
            ? shoesCtaHandlersRef.current.onCtaB1stStart
            : shoesCtaHandlersRef.current.onCtaB2ndStart}
        />
      )}
      {shoesCtaStep === 'ctaC' && (
        <AreYouThereModal
          timeoutSecs={10}
          onYes={shoesCtaHandlersRef.current.onCtaCYes}
          onNo={shoesCtaHandlersRef.current.onCtaCNoOrTimeout}
        />
      )}
      {shoesCtaStep === 'ctaD' && (
        <AreYouThereModal
          timeoutSecs={10}
          onYes={shoesCtaHandlersRef.current.onCtaDYes}
          onNo={shoesCtaHandlersRef.current.onCtaDNoOrTimeout}
          t={t}
        />
      )}
    </>
  );
}


/* ── CTA A: Continue with shoes? ─────────────────────────────────── */
const ContinueWithShoesModal = ({ onYes, onNo, t }) => {
  const [remaining, setRemaining] = React.useState(10);
  const firedRef = React.useRef(false);
  const intervalRef = React.useRef(null);

  const fireNo = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    clearInterval(intervalRef.current);
    onNo?.();
  };
  const fireYes = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    clearInterval(intervalRef.current);
    onYes?.();
  };

  React.useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((p) => {
        if (p <= 1) { clearInterval(intervalRef.current); setTimeout(fireNo, 0); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative w-screen" style={{ filter: 'drop-shadow(0px 0px 40px rgba(139,195,229,0.4))' }}>
        <img src={textbgframe} alt="" className="w-full h-full block" draggable={false} />
        <div className="absolute flex flex-col items-center justify-center gap-8"
          style={{ top: '14%', bottom: '20%', left: '14%', right: '14%' }}>
          <h2 className="text-[#8BC3E5] text-[40px] font-anta text-center m-0">
            Do you want to continue with shoes?
          </h2>
          <p className="text-white/60 font-anta text-2xl">Auto-continuing in {remaining}s…</p>
          <div className="flex gap-10">
            <button onClick={fireNo}
              className="w-[220px] h-[90px] rounded-[30px] border-2 border-white/30 bg-white/5 backdrop-blur-sm text-white text-2xl font-anta hover:bg-white/10 active:scale-[0.98] transition-all duration-200">
              🦶 No
            </button>
            <button onClick={fireYes}
              className="w-[220px] h-[90px] rounded-[30px] border-2 border-white/50 bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)] shadow-[0px_0px_30px_rgba(0,179,255,0.5)] text-white text-2xl font-anta hover:border-white active:scale-[0.98] transition-all duration-200">
              👟 Yes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── CTA B: Press Start ───────────────────────────────────────────── */
const PressStartModal = ({ timeoutSecs = 30, onStart }) => {
  const [remaining, setRemaining] = React.useState(timeoutSecs);
  const firedRef = React.useRef(false);
  const intervalRef = React.useRef(null);

  const fireStart = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    clearInterval(intervalRef.current);
    onStart?.();
  };

  React.useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((p) => {
        if (p <= 1) { clearInterval(intervalRef.current); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative w-screen" style={{ filter: 'drop-shadow(0px 0px 40px rgba(139,195,229,0.4))' }}>
        <img src={textbgframe} alt="" className="w-full h-full block" draggable={false} />
        <div className="absolute flex flex-col items-center justify-center gap-8"
          style={{ top: '14%', bottom: '20%', left: '14%', right: '14%' }}>
          <h2 className="text-[#8BC3E5] text-[40px] font-anta text-center m-0">
            Remove your socks and shoes,<br />then press Start.
          </h2>
          <p className="text-white/60 font-anta text-2xl">{remaining}s remaining</p>
          <button onClick={fireStart}
            className="w-[clamp(18rem,30vw,28rem)] h-[clamp(4rem,8vh,6rem)] rounded-[30px] border-2 border-white/50 bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)] shadow-[0px_0px_30px_rgba(0,179,255,0.5)] text-white text-3xl font-anta hover:border-white active:scale-[0.98] transition-all duration-200">
            Start
          </button>
        </div>
      </div>
    </div>
  );
};


/* ── Stand Properly Modal — animated height error prompt ────────── */
const StandProperlyModal = ({ countdown }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '32px',
        animation: 'standProperlyFadeIn 0.4s ease',
      }}>

        {/* Animated silhouette figure */}
        <div style={{ position: 'relative', width: '180px', height: '260px' }}>
          {/* Glow ring behind figure */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,195,229,0.18) 0%, transparent 70%)',
            animation: 'standGlowPulse 2s ease-in-out infinite',
          }} />

          {/* SVG standing figure */}
          <svg viewBox="0 0 120 200" width="180" height="260" xmlns="http://www.w3.org/2000/svg"
            style={{ filter: 'drop-shadow(0 0 18px rgba(139,195,229,0.7))', animation: 'standBobble 2.5s ease-in-out infinite' }}>
            {/* Head */}
            <circle cx="60" cy="22" r="16" fill="#8BC3E5" opacity="0.95" />
            {/* Neck */}
            <rect x="54" y="36" width="12" height="10" rx="4" fill="#8BC3E5" opacity="0.9" />
            {/* Body */}
            <rect x="38" y="44" width="44" height="58" rx="10" fill="#5aacd8" opacity="0.85" />
            {/* Left arm */}
            <rect x="18" y="48" width="22" height="10" rx="5" fill="#8BC3E5" opacity="0.8"
              style={{ transformOrigin: '38px 53px', animation: 'armSwingLeft 2.5s ease-in-out infinite' }} />
            {/* Right arm */}
            <rect x="80" y="48" width="22" height="10" rx="5" fill="#8BC3E5" opacity="0.8"
              style={{ transformOrigin: '82px 53px', animation: 'armSwingRight 2.5s ease-in-out infinite' }} />
            {/* Left leg */}
            <rect x="42" y="100" width="14" height="60" rx="7" fill="#8BC3E5" opacity="0.85" />
            {/* Right leg */}
            <rect x="64" y="100" width="14" height="60" rx="7" fill="#8BC3E5" opacity="0.85" />
            {/* Left foot */}
            <ellipse cx="49" cy="163" rx="12" ry="6" fill="#5aacd8" opacity="0.9" />
            {/* Right foot */}
            <ellipse cx="71" cy="163" rx="12" ry="6" fill="#5aacd8" opacity="0.9" />

            {/* Posture alignment arrows — pointing up on each side */}
            <g style={{ animation: 'arrowPulse 1.2s ease-in-out infinite' }}>
              <polygon points="10,90 16,110 4,110" fill="#FFD700" opacity="0.85" />
              <rect x="11" y="110" width="6" height="30" rx="3" fill="#FFD700" opacity="0.75" />
            </g>
            <g style={{ animation: 'arrowPulse 1.2s ease-in-out infinite 0.3s' }}>
              <polygon points="110,90 116,110 104,110" fill="#FFD700" opacity="0.85" />
              <rect x="105" y="110" width="6" height="30" rx="3" fill="#FFD700" opacity="0.75" />
            </g>
          </svg>
        </div>

        {/* Instruction text */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{
            color: '#8BC3E5',
            fontSize: '2.4rem',
            fontFamily: 'Anta, sans-serif',
            margin: 0,
            letterSpacing: '0.02em',
            textShadow: '0 0 20px rgba(139,195,229,0.6)',
          }}>
            Stand Straight &amp; Still
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontFamily: 'Anta, sans-serif',
            fontSize: '1.2rem',
            marginTop: '8px',
          }}>
            Keep your arms at your sides and look forward
          </p>
        </div>

        {/* Countdown ring */}
        <div style={{ position: 'relative', width: '80px', height: '80px' }}>
          <svg viewBox="0 0 80 80" width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(139,195,229,0.15)" strokeWidth="6" />
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke="#8BC3E5"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (countdown / 10)}`}
              style={{ transition: 'stroke-dashoffset 0.9s linear', filter: 'drop-shadow(0 0 8px #8BC3E5)' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#8BC3E5',
            fontSize: '1.6rem',
            fontFamily: 'Anta, sans-serif',
            fontWeight: 'bold',
          }}>
            {countdown}
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Anta, sans-serif', fontSize: '1rem', margin: 0 }}>
          Retrying in {countdown}s…
        </p>
      </div>

      {/* Keyframe animations injected via a style tag */}
      <style>{`
        @keyframes standProperlyFadeIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes standGlowPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.15); }
        }
        @keyframes standBobble {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes armSwingLeft {
          0%, 100% { transform: rotate(0deg); }
          50%       { transform: rotate(-15deg); }
        }
        @keyframes armSwingRight {
          0%, 100% { transform: rotate(0deg); }
          50%       { transform: rotate(15deg); }
        }
        @keyframes arrowPulse {
          0%, 100% { opacity: 0.5; transform: translateY(0px); }
          50%       { opacity: 1;   transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
};
