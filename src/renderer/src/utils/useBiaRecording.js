import { useRef, useCallback ,useEffect} from "react";
import { bufferCollection, sendVideoToBackend } from "./api";
import { getRgbCameraConstraints } from "./getRgbCamera";
import { rotateStream90 } from "../components/dmit/NewDmit";
import { getKioskId } from "./config";
import { STAGE_BUFFER_TYPE } from "./stageRouter";

/**
 * useStageRecording
 *
 * Background video capture for any screening stage. Handles:
 *  1. COMPLETE  — stage finished normally   → stopAndSend()
 *  2. PARTIAL   — skipped / error exit     → saveBuffer(reason)
 *
 * Camera selection:
 *  - Prefers any camera whose label includes "RGB" (case-insensitive)
 *  - Falls back to the first available video device if no RGB camera found
 *
 * Usage:
 *   const { startRecording, stopAndSend, saveBuffer } = useStageRecording({
 *     sessionId, userId, stageKey: 'voice_analysis'
 *   });
 */
const CHUNK_SIZE = 1000; // 1-second timeslices → denser keyframes, smoother playback
export function useStageRecording({ sessionId, userId, stageKey = "bia" }) {
  const stageKeyRef = useRef(stageKey);
  stageKeyRef.current = stageKey;
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const streamRef        = useRef(null);      // canvas stream (rotated)
  const rawStreamRef     = useRef(null);      // ✅ original getUserMedia stream (camera device)
  const isRecordingRef   = useRef(false);




  // ─── Start ────────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) {
      console.warn("[BIA REC] ⚠️ Already recording — skipping startRecording()");
      return;
    }

    console.log("[BIA REC] 🎬 startRecording() called — session:", sessionId, "user:", userId);

    try {
      const videoConstraints = await getRgbCameraConstraints({
        width: 640, height: 480, frameRate: 30,
      });

      const rawstream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      rawStreamRef.current = rawstream;                 // ✅ keep a ref so we can stop device later
      const stream = await rotateStream90(rawstream);
      streamRef.current  = stream;
      chunksRef.current  = [];

      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8",
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          console.log(
            `[BIA REC] 📦 Chunk received — #${chunksRef.current.length}, size: ${e.data.size}B, total chunks so far: ${chunksRef.current.length}`
          );
        }
      };

      // Collect a chunk every 5 s so the buffer is always fresh
      recorder.start(CHUNK_SIZE);
      mediaRecorderRef.current = recorder;
      isRecordingRef.current   = true;

      console.log("[BIA REC] ✅ Recording STARTED — session:", sessionId);
    } catch (err) {
      console.error("[BIA REC] ❌ Could not start recording:", err.message);
      // Non-blocking — BIA flow must not depend on recording
    }
  }, [sessionId, userId]);

  // ─── Shared: flush chunks → Blob → backend ────────────────────────────────
  const _flushAndSend = useCallback(
    (role) =>
      new Promise((resolve) => {
        const recorder = mediaRecorderRef.current;
        const stage = stageKeyRef.current;

        if (!recorder || !isRecordingRef.current) {
          console.warn(`[STAGE REC:${stage}] ⚠️ No active recorder to flush — nothing to send`);
          resolve(null);
          return;
        }

        console.log(
          `[STAGE REC:${stage}] 🛑 Stopping recorder — role: "${role}", total chunks collected: ${chunksRef.current.length}`
        );

        // Collect the final in-flight chunk, then send
        recorder.onstop = async () => {
          // ✅ Release camera IMMEDIATELY — chunks are already in memory, upload is unaffected
          _cleanup();

          try {
            const blob = new Blob(chunksRef.current, { type: "video/webm" });
            const ts   = Date.now();
            const filename = `${role}_${sessionId ?? "unknown"}_${ts}.webm`;

            console.log(
              `[STAGE REC:${stage}] 📤 Preparing to upload & save — role: "${role}", size: ${(blob.size / 1024).toFixed(1)}KB, chunks: ${chunksRef.current.length}`
            );

            const buffer = await blob.arrayBuffer();

            // ── 1. Save locally (non-blocking, runs in parallel) ──────────────
            const localSavePromise = (async () => {
              try {
                const localResult = await window.api.saveRecording({
                  arrayBuffer: buffer,
                  filename,
                  session_id: sessionId,
                  user_id:    userId,
                  phase_states: { role, ts: new Date(ts).toISOString() },
                });
                if (localResult?.success) {
                  console.log(`[STAGE REC:${stage}] 💾 Saved locally → ${localResult.filePath}`);
                } else {
                  console.warn(`[STAGE REC:${stage}] ⚠️ Local save failed:`, localResult?.error);
                }
              } catch (localErr) {
                console.warn(`[STAGE REC:${stage}] ⚠️ Local save threw:`, localErr.message);
              }
            })();

            // ── 2. Upload to backend ──────────────────────────────────────────
            const result = await sendVideoToBackend({
              buffer:   new Uint8Array(buffer),
              role,
              deviceId: sessionId ?? "unknown",
              meta: { sessionId, userId, role, ts },
            });

            console.log(`[STAGE REC:${stage}] ✅ Backend upload DONE — role: "${role}"`, result);
            const kioskId = getKioskId();
            const shmPath = result?.shm_path ?? result?.data?.shm_path;
            const bufferType = STAGE_BUFFER_TYPE[stage] ?? stage.toUpperCase();
            const bufferResult = await bufferCollection(shmPath, kioskId, userId, bufferType);
            console.log(`[STAGE REC:${stage}] ✅ Buffer collection DONE — role: "${role}"`, bufferResult);
            // Wait for local save to finish (so cleanup doesn't race it)
            await localSavePromise;

            resolve(result);
          } catch (err) {
            console.error(`[STAGE REC:${stageKeyRef.current}] ❌ Upload/save FAILED — role: "${role}"`, err.message);
            resolve(null);
          }
        };

        recorder.stop();
        isRecordingRef.current = false;
      }),
    [sessionId, userId]
  );

  const _cleanup = () => {
    // ✅ Cancel the rAF draw loop inside rotateStream90 and release the hidden video element
    if (typeof streamRef.current?.stop === "function") {
      streamRef.current.stop();
    }
    // Stop the canvas/rotated stream tracks
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    // Stop the ORIGINAL camera device stream so other components can use the camera
    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    rawStreamRef.current     = null;
    mediaRecorderRef.current = null;
    chunksRef.current        = [];
    console.log(`[STAGE REC:${stageKeyRef.current}] 🧹 Stream and recorder cleaned up (canvas + raw camera released)`);
  };

  // ─── 1. COMPLETE — normal BIA finish ──────────────────────────────────────
  /**
   * Call after runCalculateAndComplete() succeeds.
   * Stops the recorder cleanly and sends the full video.
   */
  const stopAndSend = useCallback(() => {
    const stage = stageKeyRef.current;
    console.log(`[STAGE REC:${stage}] 🏁 stopAndSend() — stage completed, sending full recording`);
    return _flushAndSend(`${stage}_complete`);
  }, [_flushAndSend]);

  const saveBuffer = useCallback(
    (reason = "partial") => {
      const stage = stageKeyRef.current;
      console.log(
        `[STAGE REC:${stage}] ⏏️  saveBuffer() — partial recording, reason: "${reason}"`
      );
      return _flushAndSend(`${stage}_partial__${reason}`);
    },
    [_flushAndSend]
  );

  const forceCleanup = useCallback(() => {
    console.log("[BIA REC] 🧹 forceCleanup() called — stopping any active stream/recorder");
    if (mediaRecorderRef.current && isRecordingRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) { /* ignore if already stopped */ }
      isRecordingRef.current = false;
    }
    _cleanup();
  }, []);

  // ✅ Auto-cleanup on unmount to prevent leaks
  useEffect(() => {
    return () => {
      console.log("[BIA REC] 🧹 Component unmounting — ensuring camera release");
      forceCleanup();
    };
  }, [forceCleanup]);

  return { startRecording, stopAndSend, saveBuffer, forceCleanup };
}

/** @deprecated Use useStageRecording — kept for existing BIA imports */
export const useBIARecording = useStageRecording;