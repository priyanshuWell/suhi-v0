import React, { useEffect, useRef, useState } from "react";
import { BIAComponent } from "./BIAComponents";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import ErrorAlert from "../ErrorAlert";
import { useDispatch, useSelector } from "react-redux";
import { setHeight, setWeight, setBiaResult, setSessionId } from "../../features/common/commonSlice";

export default function BIACalculate({ user, onComplete }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const storeUser = useSelector((state) => state.common.user);

  // Base state
  const [ports, setPorts] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStatus, setCurrentStatus] = useState("");
  const [errorState, setErrorState] = useState(null);
  const [isComplete, setIsComplete] = useState(false);

  // Phase tracking (removed attempt counters - now using parameters)
  const [currentPhase, setCurrentPhase] = useState('init'); // init, leg, wh, arm, impedance, complete

  const resultsRef = useRef({
    legImpedance: null,
    weight: null,
    height: null,
    armImpedance: null,
    impedance: { k20: null, k100: null }
  });

  // Timeout configuration (in milliseconds)
  const TIMEOUTS = {
    GLOBAL: 2000000,     // 120 seconds for entire flow
    WEIGHT: 200000,      // 20 seconds for weight measurement
    HEIGHT: 200000,      // 20 seconds for height measurement
    IMPEDANCE: 200000,   // 25 seconds for each impedance measurement
  };

  const MAX_RETRIES = 2;

  const timeoutRefs = useRef({
    global: null,
    step: null,
  });

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
           // await showError(ERROR_MESSAGES.armImpedance, 5000);
          })();
        }
      }
    };

    // WEIGHT ERROR
    const handleWeightError = (payload) => {
      console.error("[BIA DEBUG] WEIGHT ERROR received from main:", payload);
    };

    // HEIGHT ERROR
    const handleHeightError = (payload) => {
      console.error("[BIA DEBUG] HEIGHT ERROR received from main:", payload);

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
    ];

    return () => {
      console.log("[BIA DEBUG] Cleaning up event listeners...");
      unsubs.forEach(unsub => unsub?.());
      clearAllTimeouts();
    };
  }, []);

  /* =======================
     UTILITY FUNCTIONS
  ======================= */
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const clearAllTimeouts = () => {
    console.log("[BIA DEBUG] Clearing all timeouts");
    if (timeoutRefs.current.global) {
      clearTimeout(timeoutRefs.current.global);
      timeoutRefs.current.global = null;
    }
    if (timeoutRefs.current.step) {
      clearTimeout(timeoutRefs.current.step);
      timeoutRefs.current.step = null;
    }
  };

  const handleTimeout = (stepName) => {
    console.error(`[BIA DEBUG] ${stepName} TIMEOUT - redirecting to /screen1`);
    clearAllTimeouts();
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

  /* =======================
     MEASUREMENT FUNCTIONS
  ======================= */
  const measureWeight = async () => {
    console.log("[BIA DEBUG] Starting weight measurement...");
    // setCurrentStatus("Measuring your weight, please stand still!");
    const res = await window.api.startWeightMeasurement();
    console.log("[BIA DEBUG] Weight result:", res);

    if (!res?.weight) {
      console.error("[BIA DEBUG] Weight measurement failed - no weight data");
      throw new Error("Weight failed");
    }

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
    // setCurrentStatus("Measuring your height, please stand still!");
    await window.api.connectHeightPort(ports[0]?.path);
    const res = await window.api.startHeightMeasurement();
    console.log("[BIA DEBUG] Height result:", res);

    if (!res?.height) {
      console.error("[BIA DEBUG] Height measurement failed - no height data");
      throw new Error("Height failed");
    }

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

  const measureArmImpedance = async () => {
    console.log("[BIA DEBUG] Starting arm impedance 50kHz measurement...");
    // setCurrentStatus("Please hold the hand rails firmly!");
    const res = await window.api.startArmImpedance50kHz();
    console.log("[BIA DEBUG] Arm impedance result:", res);

    if (!res?.success) {
      console.error("[BIA DEBUG] Arm impedance failed");
      throw new Error("Arm impedance failed");
    }

    resultsRef.current.armImpedance = {
      phaseAngle: res.measurement.phaseAngle.value,
      impedance: res.measurement.impedance.value,
      unit: res.measurement.impedance.unit,
      attempts: res.attempts
    };
    console.log(`[BIA DEBUG] Arm impedance stored: ${res.measurement.impedance.value} ${res.measurement.impedance.unit}`);
    return res;
  };

  const measureImpedance = async (freq) => {
    console.log(`[BIA DEBUG] Starting impedance ${freq}kHz measurement...`);
    // setCurrentStatus(`Measuring impedance at ${freq}kHz...`);
    const res = await window.api.startImpedanceMeasurement(freq);
    console.log(`[BIA DEBUG] Impedance ${freq}kHz result:`, res);

    if (!res?.success) {
      console.error(`[BIA DEBUG] Impedance ${freq}kHz failed`);
      throw new Error(`Impedance ${freq}kHz failed`);
    }

    resultsRef.current.impedance[freq === "20" ? "k20" : "k100"] = {
      freq: Number(freq),
      unit: res.impedance.unit,
      avg: Number(res.impedance.avg.toFixed(1)),
      segments: res.impedance.segments
    };
    console.log(`[BIA DEBUG] Impedance ${freq}kHz stored: avg=${res.impedance.avg.toFixed(1)}Ω`);
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
     // showError(ERROR_MESSAGES.maxRetryReached, 4000);
      navigate("/screen1");
      return;
    }

    // Reset attempt tracking and error flags for leg
    attemptTracking.current.leg = 0;
    errorTriggered.current.leg = false;
    console.log("[BIA DEBUG] Reset leg attempt tracking and error flag");

    try {
      await measureLegImpedance();

      console.log("[BIA DEBUG] Phase 1 SUCCESS - Leg impedance measured");
      await sleep(800);

      // Success - proceed to Phase 2
      await runPhase2_WeightHeight();

    } catch (legError) {
 if (attemptCount >= MAX_RETRIES) {
      console.error(`[BIA DEBUG] Priyanshu Phase 3 EXHAUSTED all ${MAX_RETRIES} retries - redirecting to /screen1`);
      //await showError(ERROR_MESSAGES.maxRetryReached, 4000);
      navigate("/screen1");
      return;
    }
      console.error("[BIA DEBUG] Phase 1 FAILED - Leg impedance error:", legError.message);

      // Check if user is on platform by trying weight measurement
      console.log("[BIA DEBUG] Checking if user is on platform via weight...");
      try {
        const weightResult = await window.api.startWeightMeasurement();
        console.log("[BIA DEBUG] Weight check result:", weightResult);

        if (weightResult?.weight && Number(weightResult.weight) > 1) {
          // User IS on platform but leg impedance failed -> barefoot issue
          console.log(`[BIA DEBUG] Weight detected: ${weightResult.weight}kg - User on platform but not barefoot`);
          await showError(ERROR_MESSAGES.legImpedance_hasWeight, 6000);
        } else {
          // User NOT on platform
          console.log("[BIA DEBUG] No weight detected - User not on platform");
          await showError(ERROR_MESSAGES.legImpedance_noWeight, 6000);
        }
      } catch (weightCheckError) {
        console.error("[BIA DEBUG] Weight check also failed:", weightCheckError.message);
        await showError(ERROR_MESSAGES.legImpedance_noWeight, 6000);
      }

      // Retry with incremented attempt count
      console.log(`[BIA DEBUG] Phase 1 retry ${attemptCount + 2}/${MAX_RETRIES}...`);
      await sleep(1000);
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

    try {
      // Measure Weight
      await measureWeight();
      await sleep(1200); // Required settle time
      console.log("[BIA DEBUG] Weight measurement SUCCESS");

      // Measure Height with retry logic
      await runHeightWithRetry();

    } catch (weightError) {
      console.error("[BIA DEBUG] Phase 2 FAILED - Weight error:", weightError.message);
      await showError(ERROR_MESSAGES.weight, 3000);
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

      // Both weight and height success - show whComplete
      console.log("[BIA DEBUG] Phase 2 COMPLETE - navigating to /bia/whcomplete");
      navigate("/bia/whcomplete");
      await sleep(3000); // Wait for whComplete video

      // Proceed to Phase 3
      await runPhase3_Impedance();

    } catch (heightError) {
      console.error("[BIA DEBUG] Height measurement FAILED:", heightError.message);

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
      await measureArmImpedance();
      await sleep(800);
      console.log("[BIA DEBUG] Arm impedance SUCCESS");

      // Impedance 20kHz
      await measureImpedance("20");
      await sleep(1500);
      console.log("[BIA DEBUG] Impedance 20kHz SUCCESS");

      // Impedance 100kHz
      await measureImpedance("100");
      console.log("[BIA DEBUG] Impedance 100kHz SUCCESS");

      // All impedance measurements success
      console.log("[BIA DEBUG] Phase 3 COMPLETE - All impedance measurements done");
      await runCalculateAndComplete();

    } catch (impedanceError) {
      console.error("[BIA DEBUG] Phase 3 FAILED:", impedanceError.message);

      // Reset arm and impedance results to retry from arm
      resultsRef.current.armImpedance = null;
      resultsRef.current.impedance = { k20: null, k100: null };

      // Retry with incremented attempt count
      console.log(`[BIA DEBUG] Phase 3 retry ${attemptCount + 2}/${MAX_RETRIES} - resetting arm/impedance results...`);
      //await showError(ERROR_MESSAGES.armImpedance, 3000);
      await runPhase3_Impedance(attemptCount + 1);
    }
  };

  /* =======================
     CALCULATE BIA & COMPLETE
  ======================= */
  const runCalculateAndComplete = async () => {
    console.log("[BIA DEBUG] ========== CALCULATE & COMPLETE ==========");
    setCurrentPhase('complete');

    // Navigate to imComplete FIRST
    console.log("[BIA DEBUG] Navigating to /bia/imcomplete");
    navigate("/bia/imcomplete");
    // Generate session ID BEFORE calculateBIA call (FIX for the bug)
    const sessionId = crypto.randomUUID();
    console.log("[BIA DEBUG] Generated sessionId:", sessionId);
    dispatch(setSessionId(sessionId));

    console.log("[BIA DEBUG] Calling calculateBIA with params:", {
      height: resultsRef.current.height.value,
      weight: resultsRef.current.weight.value,
      age: storeUser?.data?.age ?? 23,
      gender: storeUser?.data?.gender ?? "male",
      impedance20: resultsRef.current.impedance.k20.segments,
      impedance100: resultsRef.current.impedance.k100.segments,
      session_id: sessionId,
      user_id: storeUser?.data?.user_id || "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    });

    try {
      const bia = await window.api.calculateBIA({
        height: resultsRef.current.height.value,
        weight: resultsRef.current.weight.value,
        age: storeUser?.data?.age ?? 23,
        gender: storeUser?.data?.gender ?? "male",
        impedance20: resultsRef.current.impedance.k20.segments,
        impedance100: resultsRef.current.impedance.k100.segments,
        session_id: sessionId,
        user_id: storeUser?.data?.user_id || "af341b46-4c88-4d67-bb0e-bdf575d0ef2b"
      });

      console.log("[BIA DEBUG] BIA calculation result:", bia);
      console.log("[BIA DEBUG] BIA success:", bia?.success);
      console.log("[BIA DEBUG] BIA packages:", bia?.bodyComposition);
      console.log("[BIA DEBUG] BIA summary:", bia?.summary);

      if (!bia?.success) {
        console.error("[BIA DEBUG] BIA calculation failed:", bia?.error);
        throw new Error(bia?.error || "BIA calculation failed");
      }

      // Save results to Redux
      //dispatch(setHeight(resultsRef.current.height.value));
      //dispatch(setWeight(resultsRef.current.weight.value));
      dispatch(setBiaResult(bia));

      console.log("[BIA DEBUG] Results saved to Redux store");
      console.log("[BIA DEBUG] ========== BIA FLOW COMPLETE ==========");
      await sleep(3000);
      // Clear timeouts
      clearAllTimeouts();
      setIsComplete(true);
      navigate("/screen1");

    } catch (calcError) {
      console.error("[BIA DEBUG] Calculation error:", calcError.message);
      clearAllTimeouts();
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

    // Note: No global timeout - only navigate on MAX_RETRIES exhaustion
    console.log(`[BIA DEBUG] Flow will only redirect on MAX_RETRIES (${MAX_RETRIES}) exhaustion`);

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
      // if (!e.message.includes("timeout")) {
      //   clearAllTimeouts();
      //   navigate("/screen1");
      // }
        navigate("/screen1");
    } finally {
      setIsRunning(false);
      clearAllTimeouts();
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
      clearAllTimeouts();
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
    </>
  );
}