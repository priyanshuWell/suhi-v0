// AutoBIAFlow.jsx
import React, { useEffect, useRef, useState } from "react";
import { BIAComponent } from "./BIAComponents";
import { useNavigate } from "react-router";

const texts = {
 wh: {
     title: "Let’s measure your body composition",
  description: "Please stand still. Measurement will start automatically."
 },
 im: {
     title : "Good Job!",
    description: "Hold the two handles and keep your elbows straight and relaxed."
 }
};

export default function BIACalcuate({ user, onComplete }) {
  const [ports, setPorts] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
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
        console.warn(`Retry ${i + 1} failed`, e.message);
      }
    }
    throw lastError;
  };

  const measureWeight = async () => {
    await window.api.connectBiaPort(ports?.[1]?.path);
    const res = await window.api.startWeightMeasurement();
    if (!res?.weight) throw new Error("Weight measurement failed");

    resultsRef.current.weight = {
      value: Number(res.weight),
      unit: "kg"
    };
  };

  const measureHeight = async () => {
    await window.api.connectHeightPort(ports?.[0]?.path);
    const res = await window.api.startHeightMeasurement();
    if (!res?.height) throw new Error("Height measurement failed");

    resultsRef.current.height = {
      value: Number(res.height),
      unit: "cm"
    };
  };

  const measureImpedance = async (freq) => {
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
      // WEIGHT + HEIGHT
      console.log("Weight and height started");
      await retry(async () => {
        await measureWeight();
        await measureHeight();
      });
      console.log("Weight and height started measureed");

      // IMPEDANCE
      navigate('/bia/imp')
      await retry(async () => {
        await measureImpedance("20");
        await measureImpedance("100");
      });

      // DONE → calculate BIA
      // const bia = await window.api.calculateBIA({
      //   height: resultsRef.current.height.value,
      //   weight: resultsRef.current.weight.value,
      //   age: user.age,
      //   gender: user.gender,
      //   impedance20: resultsRef.current.impedance.k20.segments,
      //   impedance100: resultsRef.current.impedance.k100.segments
      // });

      console.log("completed with the impedance")
      // if (!bia?.success) {
      //   throw new Error(bia?.error || "BIA calculation failed");
      // }

      // onComplete?.(bia);

    } catch (err) {
      alert(err.message || "Measurement failed. Restarting…");
      resultsRef.current = {
        weight: null,
        height: null,
        impedance: { k20: null, k100: null }
      };

      setTimeout(runFlow, 1000); // auto-restart
    } finally {
      setIsRunning(false);
    }
  };

  /* =======================
     AUTO START
  ======================= */
  useEffect(() => {
    if (ports.length >= 2) {
      runFlow();
    }
  }, [ports]);

  return <BIAComponent texts={texts} />;
}
