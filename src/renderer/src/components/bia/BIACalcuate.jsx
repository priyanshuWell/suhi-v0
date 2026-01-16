import React, { useEffect, useRef, useState, } from "react";
import { BIAComponent } from "./BIAComponents";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import BIAResult from "./BIAResult";
import ErrorAlert from "../ErrorAlert";

export default function BIACalculate({ user, onComplete }) {
  const { t } = useTranslation();
  const [ports, setPorts] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  // Error and status state
  const [errorState, setErrorState] = useState(null);
  const [currentStatus, setCurrentStatus] = useState("");
  const [failedStep, setFailedStep] = useState(null);
  const [retryCount, setRetryCount] = useState({});
  const [attemptCount, setAttemptCount] = useState({});

  const getTexts = (t) => ({
    wh: {
      title: t("measurement.let_measure"),
      description: currentStatus || t("measurement.standStill"),
    },
    im: {
      title: t("measurement.good_job"),
      description: currentStatus || t("measurement.holdThe_Hands"),
    },
  });

  const texts = getTexts(t)
  const navigate = useNavigate();
  // const resultsRef = useRef({
  //   weight:  {
  //     value: 59.61,
  //     unit: "kg"
  //   },
  //   height: null,
  //   impedance: { k20: null, k100: null }
  //  });
  const resultsRef = useRef({
    weight: null,
    height: null,
    impedance: { k20: null, k100: null }
  });
  // Subscribe to error and status events
  useEffect(() => {
    const handleHeightError = (payload) => {
      console.log('[HEIGHT ERROR]', payload);
      const currentAttempt = (attemptCount['height'] || 0) + 1;
      setAttemptCount(prev => ({ ...prev, height: currentAttempt }));
      setErrorState({
        ...payload,
        step: 'height',
        title: payload.userMessage || payload.message,
        currentAttempt
      });
      setFailedStep('height');
    };

    const handleHeightStatus = (payload) => {
      console.log('[HEIGHT STATUS]', payload);
      if (payload.severity === 'ERROR' || payload.severity === 'CRITICAL') {
        handleHeightError(payload);
        return;
      }
      if (payload.severity === 'INFO' || payload.severity === 'WARNING' || payload.severity === 'RETRY') {
        setCurrentStatus(payload.userMessage || payload.message);
      }
    };

    const handleWeightError = (payload) => {
      console.log('[WEIGHT ERROR]', payload);
      const currentAttempt = (attemptCount['weight'] || 0) + 1;
      setAttemptCount(prev => ({ ...prev, weight: currentAttempt }));
      setErrorState({
        ...payload,
        step: 'weight',
        title: payload.userMessage || payload.message,
        currentAttempt
      });
      setFailedStep('weight');
    };

    const handleWeightStatus = (payload) => {
      console.log('[WEIGHT STATUS]', payload);
      if (payload.severity === 'ERROR' || payload.severity === 'CRITICAL') {
        handleWeightError(payload);
        return;
      }
      if (payload.severity === 'INFO' || payload.severity === 'WARNING') {
        setCurrentStatus(payload.userMessage || payload.message);
      }
    };

    const handleImpedanceError = (payload) => {
      console.log('[IMPEDANCE ERROR]', payload);
      const step = payload.frequency === 20 ? 'impedance20' : 'impedance100';
      const currentAttempt = (attemptCount[step] || 0) + 1;
      setAttemptCount(prev => ({ ...prev, [step]: currentAttempt }));
      setErrorState({
        ...payload,
        step,
        title: payload.userMessage || payload.message,
        currentAttempt
      });
      setFailedStep(step);
    };

    const handleImpedanceStatus = (payload) => {
      console.log('[IMPEDANCE STATUS]', payload);
      if (payload.severity === 'ERROR' || payload.severity === 'CRITICAL') {
        handleImpedanceError(payload);
        return;
      }
      setCurrentStatus(payload.userMessage || payload.message);
    };

    // Subscribe to all events
    const unsubHeight = window.api?.onHeightError(handleHeightError);
    const unsubHeightStatus = window.api?.onHeightStatus(handleHeightStatus);
    const unsubWeight = window.api?.onWeightError(handleWeightError);
    const unsubWeightStatus = window.api?.onWeightStatus(handleWeightStatus);
    const unsubImpedance = window.api?.onImpedanceError(handleImpedanceError);
    const unsubImpedanceStatus = window.api?.onImpedanceStatus(handleImpedanceStatus);

    // Cleanup subscriptions
    return () => {
      unsubHeight?.();
      unsubHeightStatus?.();
      unsubWeight?.();
      unsubWeightStatus?.();
      unsubImpedance?.();
      unsubImpedanceStatus?.();
    };
  }, []);

  useEffect(() => {
    window.api?.getPorts?.().then(setPorts);
  }, []);

  const retry = async (fn, retries = 2) => {
    let lastError;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e;
        console.warn(`Attempt ${i + 1} failed, retrying...`, e.message);
        await new Promise(r => setTimeout(r, 500));
      }
    }
    throw lastError;
  };

  const measureWeight = async () => {
    console.log("Measuring Weight...");
    // setCurrentStatus();
    const r = await window.api.connectBiaPort(ports?.[3]?.path);
    console.log(r);
    const res = await window.api.startWeightMeasurement();
    if (!res?.weight) throw new Error("Weight measurement failed");

    resultsRef.current.weight = {
      value: Number(res.weight),
      unit: "kg"
    };
    setCurrentStatus("Weight measurement complete!");
  };

  const measureHeight = async () => {
    console.log("Measuring Height...");
    // setCurrentStatus("Starting height measurement...");
    await window.api.connectHeightPort(ports?.[0]?.path);
    const res = await window.api.startHeightMeasurement();
    if (!res?.height) throw new Error("Height measurement failed");

    resultsRef.current.height = {
      value: Number(res.height),
      unit: "cm"
    };
    // setCurrentStatus("Height measurement complete!");
  };

  const measureImpedance = async (freq) => {
    console.log(`Measuring Impedance ${freq}kHz...`);
    setCurrentStatus(`Measuring impedance at ${freq}kHz...`);
    await window.api.connectBiaPort(ports?.[3]?.path);
    const res = await window.api.startImpedanceMeasurement(freq);
    if (!res?.success) throw new Error(res?.error || "Impedance failed");

    resultsRef.current.impedance[freq === "20" ? "k20" : "k100"] = {
      freq: Number(freq),
      unit: res.impedance.unit,
      avg: Number(res.impedance.avg.toFixed(1)),
      segments: res.impedance.segments
    };
    setCurrentStatus(`Impedance ${freq}kHz complete!`);
  };

  // Retry handler
  const handleRetry = async () => {
    if (!failedStep || !errorState) return;

    const currentAttempt = errorState.currentAttempt || 1;

    // Check if this is the 2nd attempt and it failed
    if (currentAttempt >= 2) {
      console.log("2nd attempt failed, redirecting to verified URL");
      // Clear states
      setErrorState(null);
      setFailedStep(null);
      setCurrentStatus("");
      // Redirect to verified URL
      navigate('/voice');
      return;
    }

    // Check if retry is allowed
    if (!errorState.canRetry) {
      console.log("Error is not retryable");
      return;
    }

    // Clear error state for retry
    setErrorState(null);
    setCurrentStatus("");

    // Retry the failed step
    try {
      console.log(`Retrying ${failedStep} - Attempt ${currentAttempt + 1}/2`);

      switch (failedStep) {
        case 'weight':
          await retry(measureWeight);
          break;
        case 'height':
          await retry(measureHeight);
          break;
        case 'impedance20':
          await retry(() => measureImpedance("20"));
          break;
        case 'impedance100':
          await retry(() => measureImpedance("100"));
          break;
      }

      // Reset attempt count on success
      setAttemptCount(prev => ({ ...prev, [failedStep]: 0 }));
      setFailedStep(null);

      // Continue the flow after successful retry
      runFlow();
    } catch (err) {
      console.error("Retry failed:", err);
      // Error will be caught by error handlers and attempt will increment
    }
  };

  /* =======================
     MAIN ORCHESTRATOR
  ======================= */
  const runFlow = async () => {
    if (isRunning || ports.length < 2) return;

    setIsRunning(true);

    try {
      // await window.api.connectBiaPort(ports?.[3]?.path);
      await new Promise(r => setTimeout(r, 500)); // Brief settle time
      // --- STEP 1: WEIGHT ---
      if (!resultsRef.current.weight) {
        await retry(measureWeight);
      }

      // --- STEP 2: HEIGHT ---
      if (!resultsRef.current.height) {
        await retry(measureHeight);
      }

      console.log("WH Step Done:", resultsRef.current);

      // --- TRANSITION ---
      navigate('/bia/im');

      if (!resultsRef.current.impedance.k20) {
        console.log("Preparing for Impedance...");
        // await new Promise(r => setTimeout(r, 2000));
      }
      // if (!resultsRef.current.impedance.k20 || !resultsRef.current.impedance.k100) {
      //   console.log("Connecting to BIA Port for Impedance...");
      //   await window.api.connectBiaPort(ports?.[3]?.path); // Connect once here
      //   await new Promise(r => setTimeout(r, 1000)); // Give it a second to stabilize
      // }
      await new Promise(r => setTimeout(r, 500));
      //--- STEP 3: IMPEDANCE 20 ---
      if (!resultsRef.current.impedance.k20) {
        await retry(() => measureImpedance("20"));
      }

      await new Promise(r => setTimeout(r, 500));
      // --- STEP 4: IMPEDANCE 100 ---
      if (!resultsRef.current.impedance.k100) {
        await retry(() => measureImpedance("100"));
      }

      console.log("All Completed:", resultsRef.current);

      // DONE → calculate BIA
      const bia = await window.api.calculateBIA({
        height: resultsRef.current.height.value,
        weight: resultsRef.current.weight.value,
        age: 23,
        gender: "male",
        impedance20: resultsRef.current.impedance.k20.segments,
        impedance100: resultsRef.current.impedance.k100.segments
      });

      console.log("completed with the impedance")
      if (!bia?.success) {
        navigate('/bia/result', { state: { biaResult: bia } });
      }

    } catch (err) {
      console.error("Flow failed at current step:", err.message);
      // Error is already handled by event listeners

    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (ports.length >= 2) {
      runFlow();
    }
  }, [ports]);

  return (
    <>
      <BIAComponent texts={texts} />

      {/* Error Alert Modal */}
      <ErrorAlert
        visible={!!errorState}
        title={errorState?.title || ""}
        description={errorState?.description || ""}
        onClose={() => setErrorState(null)}
        onRetry={errorState?.canRetry ? handleRetry : undefined}
        autoRetryDelay={3000}
      />
    </>
  );
}