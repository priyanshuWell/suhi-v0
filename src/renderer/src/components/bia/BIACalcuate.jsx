import React, { useEffect, useRef, useState } from "react";
import { BIAComponent } from "./BIAComponents";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import ErrorAlert from "../ErrorAlert";

const MAX_RETRIES = 2;

export default function BIACalculate({ user, onComplete }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [ports, setPorts] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStatus, setCurrentStatus] = useState("");
  const [errorState, setErrorState] = useState(null);
  const [failedStep, setFailedStep] = useState(null);
  const [attemptCount, setAttemptCount] = useState({});

  const resultsRef = useRef({
    weight: null,
    height: null,
    impedance: { k20: null, k100: null }
  });

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


  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const retry = async (fn, retries = 0) => {
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

  useEffect(() => {
    const onWeightError = (p) => registerError("weight", p);
    const onHeightError = (p) => registerError("height", p);
    const onImpedanceError = (p) => {
      const step = p.frequency === 20 ? "impedance20" : "impedance100";
      registerError(step, p);
    };

    const onStatus = handleStatus;

    const unsubs = [
      window.api?.onWeightError(onWeightError),
      window.api?.onHeightError(onHeightError),
      window.api?.onImpedanceError(onImpedanceError),
      window.api?.onWeightStatus(onStatus),
      window.api?.onHeightStatus(onStatus),
      window.api?.onImpedanceStatus(onStatus),
    ];

    return () => unsubs.forEach(u => u?.());
  }, []);

  function handleStatus(payload) {
    if (payload.severity === "INFO" || payload.severity === "WARNING") {
      setCurrentStatus(payload.userMessage || payload.message);
      return;
    }

    if (payload.severity === "ERROR" || payload.severity === "CRITICAL") {
      registerError(payload.step, payload);
    }
  }

  function registerError(step, payload) {
    setAttemptCount(prev => {
      const next = (prev[step] || 0) + 1;

      setErrorState({
        ...payload,
        step,
        title: payload.userMessage || payload.message,
        currentAttempt: next,
      });

      setFailedStep(step);
      return { ...prev, [step]: next };
    });
  }

  /* =======================
     MAX RETRY REDIRECT
  ======================= */
  useEffect(() => {
    if (!failedStep) return;

    const attempts = attemptCount[failedStep] || 0;

    if (attempts >= MAX_RETRIES) {
      console.error(`[BIA] Max retries reached for ${failedStep}`);

      setIsRunning(false);

      navigate("/dmit", {
        replace: true,
        state: {
          step: failedStep,
          attempts,
          error: errorState,
        },
      });
    }
  }, [attemptCount, failedStep, errorState, navigate]);


  useEffect(() => {
    window.api?.getPorts?.().then(setPorts);
  }, []);


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

  const runFlow = async () => {
    if (isRunning || ports.length < 2) return;
    setIsRunning(true);

    try {
      await window.api.connectBiaPort(ports[2]?.path);

      if (!resultsRef.current.weight) {
        await retry(measureWeight);
        await sleep(1200);
      }

      if (!resultsRef.current.height) {
        await retry(measureHeight);
      }

      navigate("/bia/im");
      await sleep(800);

      if (!resultsRef.current.impedance.k20) {
        await retry(() => measureImpedance("20"));
      }

      if (!resultsRef.current.impedance.k100) {
        await retry(() => measureImpedance("100"));
      }

      const bia = await window.api.calculateBIA({
        height: resultsRef.current.height.value,
        weight: resultsRef.current.weight.value,
        age: 30,
        gender: "male",
        impedance20: resultsRef.current.impedance.k20.segments,
        impedance100: resultsRef.current.impedance.k100.segments
      });

      navigate("/bia/result", {
        state: {
          biaResult: bia,
          height: resultsRef.current.height.value,
          weight: resultsRef.current.weight.value
        }
      });

    } catch (e) {
      console.error("Flow failed:", e.message);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (ports.length >= 2) runFlow();
  }, [ports]);

  const handleRetry = async () => {
    if (!failedStep || !errorState) return;
    if (errorState.currentAttempt >= MAX_RETRIES) return;

    setErrorState(null);
    setCurrentStatus("");

    await sleep(2000);

    try {
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
    } catch (e) {
      console.error("Retry failed:", e.message);
    }
  };
  return (
    <>
      <BIAComponent texts={texts} />

      <ErrorAlert
        visible={!!errorState}
        title={errorState?.title}
        description={errorState?.description}
        onClose={() => setErrorState(null)}
        onRetry={
          errorState && errorState.currentAttempt < MAX_RETRIES
            ? handleRetry
            : undefined
        }
      />
    </>
  );
}
