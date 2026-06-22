import React, { createContext, useContext, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { useSelector } from "react-redux";
import { useStageRecording } from "../utils/useBiaRecording";
import { getStageKeyFromPath, isScreeningStage } from "../utils/stageRouter";

const StageRecordingContext = createContext(null);

/**
 * Manages one continuous background video session from post-login screening
 * through the result page. Rolling 30-second chunks upload in the background.
 */
export function StageRecordingProvider({ children }) {
  const { pathname } = useLocation();
  const user = useSelector((state) => state.common.user);
  const stageKey = getStageKeyFromPath(pathname);
  const sessionActiveRef = useRef(false);

  const recording = useStageRecording({
    sessionId: user?.data?.buffer_id,
    userId: user?.data?.user_id,
    stageKey: stageKey ?? "unknown",
  });

  const { startSession, stopSession } = recording;
  const hasUser = Boolean(user?.data?.user_id);

  useEffect(() => {
    const onScreeningStage = isScreeningStage(stageKey);
    const onResultPage = stageKey === "result";
    const shouldStop =
      onResultPage || stageKey === "login" || (!hasUser && sessionActiveRef.current);

    if (hasUser && onScreeningStage && !sessionActiveRef.current) {
      sessionActiveRef.current = true;
      startSession();
    }

    if (shouldStop && sessionActiveRef.current) {
      sessionActiveRef.current = false;
      stopSession();
    }
  }, [pathname, stageKey, hasUser, startSession, stopSession]);

  return (
    <StageRecordingContext.Provider value={recording}>
      {children}
    </StageRecordingContext.Provider>
  );
}

export function useStageRecordingControl() {
  return useContext(StageRecordingContext);
}
