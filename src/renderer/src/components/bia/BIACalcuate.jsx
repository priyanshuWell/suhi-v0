// AutoBIAFlow.jsx
import React, { useEffect, useRef, useState,  } from "react";
import { BIAComponent } from "./BIAComponents";
import { useNavigate } from "react-router";
import i18n from "i18next"
import { useTranslation } from "react-i18next";
import BIAResult from "./BIAResult";

// const texts = {
//   wh: {
//     title: "Let’s measure your height and weight",
//     description: "Stand straight and still on the platform, facing forward."
//   },
//   im: {
//     title: "Good Job!",
//     description: "Hold the two handles and keep your elbows straight and relaxed."
//   }
// };

export default function BIACalculate({ user, onComplete }) {
  const {t} = useTranslation();
  const [ports, setPorts] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
 const getTexts = (t) => ({
    wh: {
      title: t("measurement.let_measure"),
      description: t("measurement.standStill"),
    },
    im: {
      title: t("measurement.good_job"),
      description: t("measurement.holdThe_Hands"),
    },
  });

  const texts = getTexts(t)
  const navigate = useNavigate();
  const resultsRef = useRef({
    weight: null,
    height: null,
    impedance: { k20: null, k100: null }
  });

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
        // Optional: Add a small delay between retries
        await new Promise(r => setTimeout(r, 500)); 
      }
    }
    throw lastError;
  };

  const measureWeight = async () => {
    console.log("Measuring Weight...");
    await window.api.connectBiaPort(ports?.[1]?.path);
    const res = await window.api.startWeightMeasurement();
    if (!res?.weight) throw new Error("Weight measurement failed");

    resultsRef.current.weight = {
      value: Number(res.weight),
      unit: "kg"
    };
  };

  const measureHeight = async () => {
    console.log("Measuring Height...");
    await window.api.connectHeightPort(ports?.[0]?.path);
    const res = await window.api.startHeightMeasurement();
    if (!res?.height) throw new Error("Height measurement failed");

    resultsRef.current.height = {
      value: Number(res.height),
      unit: "cm"
    };
  };

  const measureImpedance = async (freq) => {
    console.log(`Measuring Impedance ${freq}kHz...`);
    await window.api.connectBiaPort(ports?.[1]?.path);
    const res = await window.api.startImpedanceMeasurement(freq);
    if (!res?.success) throw new Error(res?.error || "Impedance failed");

    resultsRef.current.impedance[freq === "20" ? "k20" : "k100"] = {
      freq: Number(freq),
      unit: res.impedance.unit,
      avg: Number(res.impedance.avg.toFixed(1)),
      segments: res.impedance.segments
    };
  };

  /* =======================
     MAIN ORCHESTRATOR
  ======================= */
  const runFlow = async () => {
    if (isRunning || ports.length < 2) return;

    setIsRunning(true);

    try {
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
      // Navigate only if we are moving to impedance phase
      navigate('/bia/im');
      
      // Delay for UI transition (only if we are just entering this phase)
      if (!resultsRef.current.impedance.k20) {
        console.log("Preparing for Impedance...");
        await new Promise(r => setTimeout(r, 2000));
      }

      // --- STEP 3: IMPEDANCE 20 ---
      if (!resultsRef.current.impedance.k20) {
        await retry(() => measureImpedance("20"));
      }

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

      // onComplete?.(bia);

    } catch (err) {
      console.error("Flow failed at current step:", err.message);
      
      alert(`Measurement interrupted: ${err.message}. Resuming...`);
      setTimeout(runFlow, 1000); 

    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (ports.length >= 2) {
      runFlow();
    }
  }, [ports]);

  return <BIAComponent texts={texts} />;
}