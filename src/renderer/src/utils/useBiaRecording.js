import { useRef, useCallback } from "react";
import { sendVideoToBackend } from "../../utils/api"; // adjust path as needed

/**
 * useBIARecording
 *
 * Handles two recording outcomes:
 *  1. COMPLETE  — BIA finished normally   → stopAndSend()
 *  2. PARTIAL   — skipped / error exit    → saveBuffer()
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
      console.warn("[BIA REC] Already recording — skipping startRecording()");
      return;
    }

    try {
      // Camera + mic (drop audio: true if not needed)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      streamRef.current  = stream;
      chunksRef.current  = [];

      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8",
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // Collect a chunk every 5 s so the buffer is always fresh
      recorder.start(5000);
      mediaRecorderRef.current = recorder;
      isRecordingRef.current   = true;

      console.log("[BIA REC] Recording started — session:", sessionId);
    } catch (err) {
      console.error("[BIA REC] Could not start recording:", err.message);
      // Non-blocking — BIA flow must not depend on recording
    }
  }, [sessionId]);

  // ─── Shared: flush chunks → Blob → backend ────────────────────────────────
  const _flushAndSend = useCallback(
    (role = "bia_complete") =>
      new Promise((resolve) => {
        const recorder = mediaRecorderRef.current;

        if (!recorder || !isRecordingRef.current) {
          console.warn("[BIA REC] No active recorder to flush");
          resolve(null);
          return;
        }

        // Collect the final in-flight chunk, then send
        recorder.onstop = async () => {
          try {
            const blob = new Blob(chunksRef.current, { type: "video/webm" });
            const buffer = await blob.arrayBuffer();

            const result = await sendVideoToBackend({
              buffer:   new Uint8Array(buffer),
              role,
              deviceId: sessionId ?? "unknown",
              // extra context attached to each upload
              meta: { sessionId, userId, role, ts: Date.now() },
            });

            console.log(`[BIA REC] Upload done (${role}):`, result);
            resolve(result);
          } catch (err) {
            console.error("[BIA REC] Upload failed:", err.message);
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
  };

  // ─── 1. COMPLETE — normal BIA finish ──────────────────────────────────────
  /**
   * Call after runCalculateAndComplete() succeeds.
   * Stops the recorder cleanly and sends the full video.
   */
  const stopAndSend = useCallback(
    () => _flushAndSend("bia_complete"),
    [_flushAndSend]
  );

  // ─── 2. PARTIAL — skipped or error exit ───────────────────────────────────
  /**
   * Call before every navigate('/screen1') that represents an early exit.
   * Flushes whatever chunks exist and sends them as a partial recording.
   *
   * @param {string} reason  e.g. "shoes_skipped" | "leg_max_retry" | "weight_error"
   */
  const saveBuffer = useCallback(
    (reason = "partial") => _flushAndSend(`bia_partial__${reason}`),
    [_flushAndSend]
  );

  return { startRecording, stopAndSend, saveBuffer };
}