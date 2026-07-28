import { useCallback, useEffect, useRef } from 'react';
import { getRgbCameraConstraints } from '../utils/getRgbCamera';
import { rotateStream90 } from '../utils/rotateStream90';
import { sendVideoToBackend } from '../utils/api';
import {
  registerPageRecordingRelease,
  unregisterPageRecordingRelease,
} from '../utils/pageRecordingControl';

const CHUNK_MS = 1000;

/**
 * Lightweight page-level video recorder for buffer collection on non-BIA screens.
 */
export function usePageRecording({ role = 'page_buffer' } = {}) {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const rawStreamRef = useRef(null);
  const isRecordingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (typeof streamRef.current?.stop === 'function') {
      streamRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    rawStreamRef.current?.getTracks().forEach((track) => track.stop());
    rawStreamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    isRecordingRef.current = false;
  }, []);

  const forceCleanup = useCallback(() => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore if already stopped
      }
    }
    cleanup();
    unregisterPageRecordingRelease(forceCleanup);
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;

    try {
      const videoConstraints = await getRgbCameraConstraints({
        width: 640,
        height: 480,
        frameRate: 30,
      });

      const rawStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      rawStreamRef.current = rawStream;
      const stream = await rotateStream90(rawStream);
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8',
      });

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.start(CHUNK_MS);
      mediaRecorderRef.current = recorder;
      isRecordingRef.current = true;
      registerPageRecordingRelease(forceCleanup);
    } catch (error) {
      console.error('[PAGE REC] Failed to start recording:', error.message);
    }
  }, [forceCleanup]);

  const saveBuffer = useCallback(
    (reason = 'partial') =>
      new Promise((resolve) => {
        const recorder = mediaRecorderRef.current;

        if (!recorder || !isRecordingRef.current) {
          resolve(null);
          return;
        }

        recorder.onstop = async () => {
          cleanup();

          try {
            if (!chunksRef.current.length) {
              resolve(null);
              return;
            }

            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            const buffer = await blob.arrayBuffer();
            const ts = Date.now();
            const filename = `${role}_${reason}_${ts}.webm`;

            const result = await sendVideoToBackend({
              buffer: new Uint8Array(buffer),
              role: `${role}_${reason}`,
              deviceId: filename,
              meta: { role, reason, ts },
            });

            resolve(result);
          } catch (error) {
            console.error('[PAGE REC] Failed to save buffer:', error.message);
            resolve(null);
          }
        };

        recorder.stop();
        isRecordingRef.current = false;
      }),
    [cleanup, role]
  );

  useEffect(() => () => forceCleanup(), [forceCleanup]);

  return { startRecording, saveBuffer, forceCleanup };
}
