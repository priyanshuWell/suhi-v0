import { useRef, useCallback } from "react";
import { bufferCollection, sendVideoToBackend } from "./api";
import { getRgbCameraConstraints } from "./getRgbCamera";
import { rotateStream90 } from "../components/dmit/NewDmit";
import { getKioskId } from "./config";

/**
 * useBIARecording
 *
 * Handles two recording outcomes:
 *  1. COMPLETE  — BIA finished normally   → stopAndSend()
 *  2. PARTIAL   — skipped / error exit    → saveBuffer(reason)
 *
 * Camera selection:
 *  - Prefers any camera whose label includes "RGB" (case-insensitive)
 *  - Falls back to the first available video device if no RGB camera found
 *
 * Usage:
 *   const { startRecording, stopAndSend, saveBuffer } = useBIARecording({ sessionId, userId });
 */
export function useBIARecording({ sessionId, userId }) {
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const streamRef        = useRef(null);
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

      const stream = await rotateStream90(rawstream)
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
      recorder.start(5000);
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
    (role = "bia_complete") =>
      new Promise((resolve) => {
        const recorder = mediaRecorderRef.current;

        if (!recorder || !isRecordingRef.current) {
          console.warn("[BIA REC] ⚠️ No active recorder to flush — nothing to send");
          resolve(null);
          return;
        }

        console.log(
          `[BIA REC] 🛑 Stopping recorder — role: "${role}", total chunks collected: ${chunksRef.current.length}`
        );

        // Collect the final in-flight chunk, then send
        recorder.onstop = async () => {
          try {
            const blob = new Blob(chunksRef.current, { type: "video/webm" });
            const ts   = Date.now();
            const filename = `${role}_${sessionId ?? "unknown"}_${ts}.webm`;

            console.log(
              `[BIA REC] 📤 Preparing to upload & save — role: "${role}", size: ${(blob.size / 1024).toFixed(1)}KB, chunks: ${chunksRef.current.length}`
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
                  console.log(`[BIA REC] 💾 Saved locally → ${localResult.filePath}`);
                } else {
                  console.warn("[BIA REC] ⚠️ Local save failed:", localResult?.error);
                }
              } catch (localErr) {
                console.warn("[BIA REC] ⚠️ Local save threw:", localErr.message);
              }
            })();

            // ── 2. Upload to backend ──────────────────────────────────────────
            const result = await sendVideoToBackend({
              buffer:   new Uint8Array(buffer),
              role,
              deviceId: sessionId ?? "unknown",
              meta: { sessionId, userId, role, ts },
            });

            console.log(`[BIA REC] ✅ Backend upload DONE — role: "${role}"`, result);
            const kioskId = getKioskId()
            const bufferResult = await bufferCollection(result?.data?.shm_path,kioskId, userId);
            console.log(`[BIA REC] ✅ Buffer collection DONE — role: "${role}"`, bufferResult);
            // Wait for local save to finish (so cleanup doesn't race it)
            await localSavePromise;

            resolve(result);
          } catch (err) {
            console.error(`[BIA REC] ❌ Upload/save FAILED — role: "${role}"`, err.message);
            resolve(null);
          } finally {
            _cleanup();
          }
        };

        recorder.stop();
        isRecordingRef.current = false;
      }),
    [sessionId, userId]
  );

  const _cleanup = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current        = null;
    mediaRecorderRef.current = null;
    chunksRef.current        = [];
    console.log("[BIA REC] 🧹 Stream and recorder cleaned up");
  };

  // ─── 1. COMPLETE — normal BIA finish ──────────────────────────────────────
  /**
   * Call after runCalculateAndComplete() succeeds.
   * Stops the recorder cleanly and sends the full video.
   */
  const stopAndSend = useCallback(() => {
    console.log("[BIA REC] 🏁 stopAndSend() — BIA completed successfully, sending full recording");
    return _flushAndSend("bia_complete");
  }, [_flushAndSend]);

  // ─── 2. PARTIAL — skipped or error exit ───────────────────────────────────
  /**
   * Call before every navigate('/screen1') that represents an early exit.
   * Flushes whatever chunks exist and sends them as a partial recording.
   *
   * @param {string} reason  e.g. "shoes_skipped" | "leg_max_retry" | "weight_error"
   */
  const saveBuffer = useCallback(
    (reason = "partial") => {
      console.log(
        `[BIA REC] ⏏️  saveBuffer() — early exit / partial recording, reason: "${reason}"`
      );
      return _flushAndSend(`bia_partial__${reason}`);
    },
    [_flushAndSend]
  );

  return { startRecording, stopAndSend, saveBuffer };
}