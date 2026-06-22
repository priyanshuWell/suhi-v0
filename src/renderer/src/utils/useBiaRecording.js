import { useRef, useCallback, useEffect } from "react";
import { bufferCollection, sendVideoToBackend } from "./api";
import { getRgbCameraConstraints } from "./getRgbCamera";
import { rotateStream90 } from "../components/dmit/NewDmit";
import { getKioskId } from "./config";
import { STAGE_BUFFER_TYPE } from "./stageRouter";

/**
 * useStageRecording
 *
 * Session-based background video capture from post-login through the result page.
 * Records rolling 30-second chunks; uploads fire-and-forget while the next chunk
 * starts immediately.
 */
const TIMESLICE_MS = 1000;
const SESSION_CHUNK_MS = 30_000;

export function useStageRecording({ sessionId, userId, stageKey = "bia" }) {
  const stageKeyRef = useRef(stageKey);
  stageKeyRef.current = stageKey;

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const rawStreamRef = useRef(null);
  const isRecordingRef = useRef(false);
  const isSessionActiveRef = useRef(false);
  const chunkTimerRef = useRef(null);
  const rotatingRef = useRef(false);

  const clearChunkTimer = () => {
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
  };

  const scheduleNextChunk = useCallback(() => {
    clearChunkTimer();
    if (!isSessionActiveRef.current) return;

    chunkTimerRef.current = setTimeout(() => {
      if (isSessionActiveRef.current && isRecordingRef.current) {
        rotateChunk("rolling");
      }
    }, SESSION_CHUNK_MS);
  }, []);

  const _uploadInBackground = useCallback((buffer, role, stage) => {
    const ts = Date.now();
    const filename = `${role}_${sessionId ?? "unknown"}_${ts}.webm`;

    console.log(
      `[STAGE REC:${stage}] 📤 Uploading chunk (async) — role: "${role}", size: ${(buffer.byteLength / 1024).toFixed(1)}KB`
    );

    (async () => {
      try {
        window.api
          ?.saveRecording?.({
            arrayBuffer: buffer,
            filename,
            session_id: sessionId,
            user_id: userId,
            phase_states: { role, ts: new Date(ts).toISOString() },
          })
          .catch((err) => {
            console.warn(`[STAGE REC:${stage}] ⚠️ Local save failed:`, err?.message ?? err);
          });

        const result = await sendVideoToBackend({
          buffer: new Uint8Array(buffer),
          role,
          deviceId: sessionId ?? "unknown",
          meta: { sessionId, userId, role, ts },
        });

        const shmPath = result?.shm_path ?? result?.data?.shm_path;
        if (shmPath) {
          const kioskId = getKioskId();
          const bufferType = STAGE_BUFFER_TYPE[stage] ?? stage.toUpperCase();
          bufferCollection(shmPath, kioskId, userId, bufferType).catch((err) => {
            console.warn(`[STAGE REC:${stage}] ⚠️ bufferCollection failed:`, err?.message ?? err);
          });
        }

        console.log(`[STAGE REC:${stage}] ✅ Chunk upload dispatched — role: "${role}"`);
      } catch (err) {
        console.error(`[STAGE REC:${stage}] ❌ Chunk upload failed — role: "${role}"`, err.message);
      }
    })();
  }, [sessionId, userId]);

  const _startRecorderOnStream = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return false;

    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8",
    });

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.start(TIMESLICE_MS);
    mediaRecorderRef.current = recorder;
    isRecordingRef.current = true;
    return true;
  }, []);

  const _releaseCamera = useCallback(() => {
    if (typeof streamRef.current?.stop === "function") {
      streamRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    rawStreamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    isRecordingRef.current = false;
    console.log(`[STAGE REC:${stageKeyRef.current}] 🧹 Camera released`);
  }, []);

  const _restartRecorderAfterChunk = useCallback(() => {
    if (!isSessionActiveRef.current || !streamRef.current) return;

    if (_startRecorderOnStream()) {
      scheduleNextChunk();
      console.log(`[STAGE REC:${stageKeyRef.current}] 🔄 Next 30s chunk started`);
    }
  }, [_startRecorderOnStream, scheduleNextChunk]);

  const rotateChunk = useCallback(
    (role, { endSession = false } = {}) => {
      if (rotatingRef.current) return Promise.resolve(null);
      rotatingRef.current = true;

      return new Promise((resolve) => {
        const recorder = mediaRecorderRef.current;
        const stage = stageKeyRef.current;

        if (!recorder || !isRecordingRef.current) {
          rotatingRef.current = false;
          if (endSession) {
            isSessionActiveRef.current = false;
            clearChunkTimer();
            _releaseCamera();
          }
          resolve(null);
          return;
        }

        clearChunkTimer();
        isRecordingRef.current = false;

        recorder.onstop = async () => {
          rotatingRef.current = false;
          const parts = chunksRef.current;
          chunksRef.current = [];

          if (parts.length) {
            const blob = new Blob(parts, { type: "video/webm" });
            const buffer = await blob.arrayBuffer();
            _uploadInBackground(buffer, role, stage);
          }

          if (endSession) {
            isSessionActiveRef.current = false;
            _releaseCamera();
          } else {
            _restartRecorderAfterChunk();
          }

          resolve(null);
        };

        try {
          recorder.stop();
        } catch {
          rotatingRef.current = false;
          resolve(null);
        }
      });
    },
    [_uploadInBackground, _releaseCamera, _restartRecorderAfterChunk]
  );

  const startSession = useCallback(async () => {
    if (isSessionActiveRef.current) {
      console.warn("[STAGE REC] ⚠️ Session already active — skipping startSession()");
      return;
    }

    console.log("[STAGE REC] 🎬 startSession() — session:", sessionId, "user:", userId);

    try {
      const videoConstraints = await getRgbCameraConstraints({
        width: 640,
        height: 480,
        frameRate: 30,
      });

      const rawstream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      rawStreamRef.current = rawstream;
      const stream = await rotateStream90(rawstream);
      streamRef.current = stream;

      isSessionActiveRef.current = true;

      if (_startRecorderOnStream()) {
        scheduleNextChunk();
        console.log("[STAGE REC] ✅ Session recording started (30s rolling chunks)");
      }
    } catch (err) {
      console.error("[STAGE REC] ❌ Could not start session recording:", err.message);
      isSessionActiveRef.current = false;
      _releaseCamera();
    }
  }, [sessionId, userId, _startRecorderOnStream, scheduleNextChunk, _releaseCamera]);

  const stopSession = useCallback(() => {
    if (!isSessionActiveRef.current && !isRecordingRef.current) {
      console.warn("[STAGE REC] ⚠️ No active session to stop");
      return Promise.resolve(null);
    }

    console.log(`[STAGE REC:${stageKeyRef.current}] 🏁 stopSession() — flushing final chunk`);
    clearChunkTimer();
    return rotateChunk("session_end", { endSession: true });
  }, [rotateChunk]);

  const startRecording = useCallback(() => startSession(), [startSession]);

  const stopAndSend = useCallback(() => {
    console.log(`[STAGE REC:${stageKeyRef.current}] 🏁 stopAndSend() — ending session`);
    return stopSession();
  }, [stopSession]);

  const saveBuffer = useCallback(
    (reason = "partial") => {
      const stage = stageKeyRef.current;
      console.log(`[STAGE REC:${stage}] ⏏️ saveBuffer() — early flush, reason: "${reason}"`);
      if (!isSessionActiveRef.current) return Promise.resolve(null);
      return rotateChunk(`${stage}_partial__${reason}`);
    },
    [rotateChunk]
  );

  const forceCleanup = useCallback(() => {
    console.log("[STAGE REC] 🧹 forceCleanup() — stopping session");
    clearChunkTimer();
    isSessionActiveRef.current = false;

    if (mediaRecorderRef.current && isRecordingRef.current) {
      try {
        mediaRecorderRef.current.onstop = () => _releaseCamera();
        mediaRecorderRef.current.stop();
      } catch {
        _releaseCamera();
      }
    } else {
      _releaseCamera();
    }
  }, [_releaseCamera]);

  useEffect(() => {
    return () => {
      console.log("[STAGE REC] 🧹 Provider unmounting — ensuring camera release");
      forceCleanup();
    };
  }, [forceCleanup]);

  return { startSession, stopSession, startRecording, stopAndSend, saveBuffer, forceCleanup };
}

/** @deprecated Use useStageRecording — kept for existing BIA imports */
export const useBIARecording = useStageRecording;
