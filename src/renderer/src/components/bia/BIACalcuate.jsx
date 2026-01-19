import React, { useEffect, useRef, useState } from "react";
import { BIAComponent } from "./BIAComponents";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import ErrorAlert from "../ErrorAlert";
import { useDispatch } from "react-redux";
import { setHeight, setWeight, setBiaResult, setSessionId } from "../../features/common/commonSlice";

export default function BIACalculate({ user, onComplete }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();


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

    // If this is the second failure, navigate to /screen1
    if (currentAttempt >= 2) {
      console.error(`[BIA] ${step} failed ${currentAttempt} times. Redirecting to /screen1`);
      navigate("/screen1");
      return;
    }

    setErrorState({
      ...payload,
      step,
      title: payload.userMessage || payload.message,
      currentAttempt,
      canRetry: true,
    });
    setFailedStep(step);
  }

  /* =======================
     LOAD PORTS
  ======================= */
  useEffect(() => {
    window.api?.getPorts?.().then(setPorts);
  }, []);


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


  const measureWeight = async () => {
    setCurrentStatus("Now we are measuring your weight, please stand still!");
    const res = await window.api.startWeightMeasurement();
    if (!res?.weight) throw new Error("Weight failed");

    resultsRef.current.weight = {
      value: Number(res.weight),
      unit: "kg"
    };
  };

  const measureHeight = async () => {
    setCurrentStatus("Now we are measuring your height, please stand still!");
    await window.api.connectHeightPort(ports[0]?.path);
    const res = await window.api.startHeightMeasurement();
    if (!res?.height) throw new Error("Height failed");

    resultsRef.current.height = {
      value: Number(res.height),
      unit: "cm"
    };
  };

  const measureImpedance = async (freq) => {
    setCurrentStatus(`Please ensure you are barefoot, and holding the hand rails firmly! Measuring impedance ${freq} kHz...`);
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
      /* CONNECT BIA ONCE */
      await window.api.connectBiaPort(ports[2]?.path);
      // await sleep(800);

      /* WEIGHT */
      if (!resultsRef.current.weight) {
        await retry(measureWeight);
        await sleep(1200); // :red_circle: REQUIRED SETTLE
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
      setCurrentStatus("Preparing next impedance...");
      await sleep(1500);

      /* IMPEDANCE 100 kHz */
      if (!resultsRef.current.impedance.k100) {
        await retry(() => measureImpedance("100"));
      }

      /* CALCULATE */
      console.log("[BIA] Calling calculateBIA with params:", {
        height: resultsRef.current.height.value,
        weight: resultsRef.current.weight.value,
        age: 23,
        gender: "male",
        impedance20: resultsRef.current.impedance.k20.segments,
        impedance100: resultsRef.current.impedance.k100.segments
      });

      const bia = await window.api.calculateBIA({
        height: resultsRef.current.height.value,
        weight: resultsRef.current.weight.value,
        age: 23,
        gender: "male",
        impedance20: resultsRef.current.impedance.k20.segments,
        impedance100: resultsRef.current.impedance.k100.segments
      });

      console.log("[BIA] Full BIA Result:", bia);
      console.log("[BIA] BIA Success:", bia?.success);
      console.log("[BIA] BIA Packages:", bia?.bodyComposition);
      console.log("[BIA] BIA Summary:", bia?.summary);
      console.log("[BIA] BIA API Response:", bia?.apiResponse);
      console.log("[BIA] BIA API Error:", bia?.apiError);

      // Generate session ID and save to Redux store
      const sessionId = crypto.randomUUID();
      dispatch(setSessionId(sessionId));
      dispatch(setHeight(resultsRef.current.height.value));
      dispatch(setWeight(resultsRef.current.weight.value));
      dispatch(setBiaResult(bia));

      console.log("[BIA] Saved to Redux store with sessionId:", sessionId);

      // Navigate to screen1 (DMIT) instead of result
      navigate("/screen1");

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

    await sleep(2000); // :red_circle: cooldown before retry

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
      <BIAComponent
        texts={texts}
        attemptCount={attemptCount.impedance20 || attemptCount.impedance100 || 0}
      />

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