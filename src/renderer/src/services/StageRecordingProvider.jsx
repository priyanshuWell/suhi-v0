import React, { createContext, useContext, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { useSelector } from "react-redux";
import { useStageRecording } from "../utils/useBiaRecording";
import { getStageKeyFromPath, isScreeningStage } from "../utils/stageRouter";

const StageRecordingContext = createContext(null);

/**
 * Captures video buffers on all screening routes (after login, before result).
 * Flushes on route change with the leaving stage's buffer_type; auto-flushes every 1 minute.
 */
export function StageRecordingProvider({ children }) {
  const { pathname } = useLocation();
  const user = useSelector((state) => state.common.user);
  const stageKey = getStageKeyFromPath(pathname);
  const prevStageKeyRef = useRef(null);
  const sessionActiveRef = useRef(false);

  console.log("[StageRecordingProvider] user.screening:", user?.screening, "session_id:", user?.screening?.session_id, "buffer_id:", user?.data?.buffer_id, "user_id:", user?.data?.user_id);

  const recording = useStageRecording({
    sessionId: user?.screening?.session_id,
    bufferId: user?.data?.buffer_id,
    userId: user?.data?.user_id,
    stageKey: stageKey ?? "unknown",
  });

  const { startSession, stopSession, saveBuffer } = recording;
  const hasUser = Boolean(user?.data?.user_id);

  useEffect(() => {
    const prev = prevStageKeyRef.current;
    const current = stageKey;

    // Flush buffer for the stage being left (skip when heading to result/login — stopSession handles that)
    if (prev && isScreeningStage(prev) && prev !== current && isScreeningStage(current)) {
      saveBuffer("route_change", prev);
    }

    // Start session when entering first screening stage after login
    if (hasUser && isScreeningStage(current) && !sessionActiveRef.current) {
      sessionActiveRef.current = true;
      startSession();
    }

    // Stop on result or login pages
    const shouldStop =
      current === "result" || current === "login" || (!hasUser && sessionActiveRef.current);

    if (shouldStop && sessionActiveRef.current) {
      sessionActiveRef.current = false;
      const flushStage = prev && isScreeningStage(prev) ? prev : null;
      stopSession(flushStage);
    }

    prevStageKeyRef.current = current;
  }, [pathname, stageKey, hasUser, startSession, stopSession, saveBuffer]);

  return (
    <StageRecordingContext.Provider value={recording}>
      {children}
    </StageRecordingContext.Provider>
  );
}

export function useStageRecordingControl() {
  return useContext(StageRecordingContext);
}
