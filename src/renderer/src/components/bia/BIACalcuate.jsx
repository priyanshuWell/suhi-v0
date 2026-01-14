// AutoBIAFlow.jsx
import React, { useEffect, useRef, useState } from "react";
import { BIAComponent } from "./BIAComponents";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import ErrorAlert from "../ErrorAlert";

export default function BIACalculate({ user, onComplete }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  /* =======================
     STATE
  ======================= */
  const [ports, setPorts] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStatus, setCurrentStatus] = useState("");
  const [errorState, setErrorState] = useState(null);
  const [failedStep, setFailedStep] = useState(null);
  const [attemptCount, setAttemptCount] = useState({});

  /* =======================
     RESULTS (PERSISTENT)
  ======================= */
  const resultsRef = useRef({
    weight: null,
    height: null,
    impedance: { k20: null, k100: null }
  });

  /* =======================
     TEXTS
  ======================= */
  const texts = {
    wh: {
      title: t("measurement.let_measure"),
      description: currentStatus || t("measurement.standStill"),
    },
    im: {
      title: t("measurement.good_job"),
      description: currentStatus || t("measurement.holdThe_Hands"),
    },
  };

  /* =======================
     EVENT SUBSCRIPTIONS
  ======================= */
  useEffect(() => {
    const onWeightError = (p) => registerError("weight", p);
    const onHeightError = (p) => registerError("height", p);
    const onImpedanceError = (p) => {
      const step = p.frequency === 20 ? "impedance20" : "impedance100";
      registerError(step, p);
    };

    const onWeightStatus = handleStatus;
    const onHeightStatus = handleStatus;
    const onImpedanceStatus = handleStatus;

    const unsubs = [
      window.api?.onWeightError(onWeightError),
      window.api?.onHeightError(onHeightError),
      window.api?.onImpedanceError(onImpedanceError),
      window.api?.onWeightStatus(onWeightStatus),
      window.api?.onHeightStatus(onHeightStatus),
      window.api?.onImpedanceStatus(onImpedanceStatus),
    ];

    return () => unsubs.forEach(u => u?.());
  }, []);

  function handleStatus(payload) {
    // IMPORTANT: MEASURE / INFO = WAIT (do not advance flow)
    if (payload.severity === "INFO" || payload.severity === "WARNING") {

      setCurrentStatus(payload.userMessage || payload.message);
      return;
    }

    if (payload.severity === "ERROR" || payload.severity === "CRITICAL") {
      registerError(payload.step, payload);
    }
  }

  function registerError(step, payload) {
    const currentAttempt = (attemptCount[step] || 0) + 1;
    setAttemptCount(p => ({ ...p, [step]: currentAttempt }));

    setErrorState({
      ...payload,
      step,
      title: payload.userMessage || payload.message,
      currentAttempt,
    });
    setFailedStep(step);
  }

  /* =======================
     LOAD PORTS
  ======================= */
  useEffect(() => {
    window.api?.getPorts?.().then(setPorts);
  }, []);

  /* =======================
     HELPERS
  ======================= */
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const retry = async (fn, retries = 1) => {
    let err;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (e) {
        err = e;
        await sleep(500);
      }
    }
    throw err;
  };

  /* =======================
     MEASURE FUNCTIONS
  ======================= */
  const measureWeight = async () => {
    setCurrentStatus("Measuring weight...");
    const res = await window.api.startWeightMeasurement();
    if (!res?.weight) throw new Error("Weight failed");

    resultsRef.current.weight = {
      value: Number(res.weight),
      unit: "kg"
    };
  };

  const measureHeight = async () => {
    setCurrentStatus("Measuring height...");
    await window.api.connectHeightPort(ports[0]?.path);
    const res = await window.api.startHeightMeasurement();
    if (!res?.height) throw new Error("Height failed");

    resultsRef.current.height = {
      value: Number(res.height),
      unit: "cm"
    };
  };

  const measureImpedance = async (freq) => {
    setCurrentStatus(`Measuring impedance ${freq} kHz...`);
    const res = await window.api.startImpedanceMeasurement(freq);
    if (!res?.success) throw new Error("Impedance failed");

    resultsRef.current.impedance[freq === "20" ? "k20" : "k100"] = {
      freq: Number(freq),
      unit: res.impedance.unit,
      avg: Number(res.impedance.avg.toFixed(1)),
      segments: res.impedance.segments
    };
  };

  /* =======================
     MAIN FLOW (FIXED)
  ======================= */
  const runFlow = async () => {
    if (isRunning || ports.length < 2) return;
    setIsRunning(true);

    try {
      /* CONNECT BIA ONCE */
      await window.api.connectBiaPort(ports[3]?.path);
      await sleep(800);

      /* WEIGHT */
      if (!resultsRef.current.weight) {
        await retry(measureWeight);
        await sleep(1200); // 🔴 REQUIRED SETTLE
      }

      /* HEIGHT */
      if (!resultsRef.current.height) {
        await retry(measureHeight);
      }

      navigate("/bia/im");
      await sleep(800);

      /* IMPEDANCE 20 kHz */
      if (!resultsRef.current.impedance.k20) {
        await retry(() => measureImpedance("20"));
      }

      // 🔴 CRITICAL HARDWARE SETTLE
      setCurrentStatus("Preparing next impedance...");
      await sleep(1500);

      /* IMPEDANCE 100 kHz */
      if (!resultsRef.current.impedance.k100) {
        await retry(() => measureImpedance("100"));
      }

      /* CALCULATE */
      const bia = await window.api.calculateBIA({
        height: resultsRef.current.height.value,
        weight: resultsRef.current.weight.value,
        age: 23,
        gender: "male",
        impedance20: resultsRef.current.impedance.k20.segments,
        impedance100: resultsRef.current.impedance.k100.segments
      });

      onComplete?.(bia);
      navigate("/bia/result", { state: { biaResult: bia } });

    } catch (e) {
      console.error("Flow failed:", e.message);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (ports.length >= 2) runFlow();
  }, [ports]);

  /* =======================
     RETRY HANDLER
  ======================= */
  const handleRetry = async () => {
    if (!failedStep || !errorState) return;

    setErrorState(null);
    setCurrentStatus("");

    await sleep(2000); // 🔴 cooldown before retry

    switch (failedStep) {
      case "weight":
        await retry(measureWeight);
        break;
      case "height":
        await retry(measureHeight);
        break;
      case "impedance20":
        await retry(() => measureImpedance("20"));
        break;
      case "impedance100":
        await retry(() => measureImpedance("100"));
        break;
      default:
        break;
    }

    setFailedStep(null);
    runFlow();
  };

  /* =======================
     RENDER
  ======================= */
  return (
    <>
      <BIAComponent texts={texts} />

      <ErrorAlert
        visible={!!errorState}
        title={errorState?.title}
        description={errorState?.description}
        onClose={() => setErrorState(null)}
        onRetry={errorState?.canRetry ? handleRetry : undefined}
      />
    </>
  );
}
