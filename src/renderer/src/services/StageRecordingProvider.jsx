import React, { createContext, useContext, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { useSelector } from "react-redux";
import { useStageRecording } from "../utils/useBiaRecording";
import { getStageKeyFromPath, isSelfManagedStage } from "../utils/stageRouter";

const StageRecordingContext = createContext(null);

/**
 * Manages background video recording for all screening stages defined in stageRouter.
 * BIA (/bia/*) is self-managed by BIACalcuate and is excluded from auto start/stop.
 */
export function StageRecordingProvider({ children }) {
  const { pathname } = useLocation();
  const user = useSelector((state) => state.common.user);
  const stageKey = getStageKeyFromPath(pathname);
  const prevStageKeyRef = useRef(null);

  const recording = useStageRecording({
    sessionId: user?.data?.buffer_id,
    userId: user?.data?.user_id,
    stageKey: stageKey ?? "unknown",
  });

  const { startRecording, saveBuffer } = recording;

  useEffect(() => {
    const prev = prevStageKeyRef.current;
    const current = stageKey;

    if (prev && prev !== current && !isSelfManagedStage(prev)) {
      saveBuffer("route_change");
    }

    if (current && !isSelfManagedStage(current) && current !== prev) {
      startRecording();
    }

    prevStageKeyRef.current = current;
  }, [stageKey, startRecording, saveBuffer]);

  return (
    <StageRecordingContext.Provider value={recording}>
      {children}
    </StageRecordingContext.Provider>
  );
}

export function useStageRecordingControl() {
  return useContext(StageRecordingContext);
}
