import { bufferCollection, sendVideoToBackend } from './api';
import { getRgbCameraConstraints } from './getRgbCamera';
import { getKioskId } from './config';
import { rotateStream90 } from '../components/dmit/NewDmit';
import { BUFFER_COLLECTION_MAX_MS, getStepForPath } from './bufferCollectionRoutes';

const CHUNK_MS = 1000;
// chunk
const session = {
  screeningSessionId: null,
  userId: null,
  activeBufferType: null,
  completedSteps: new Set(),
  isRecording: false,
  hasSent: false,
  isSending: false,
  startTime: null,
  mediaRecorder: null,
  chunks: [],
  stream: null,
  rawStream: null,
  durationTimer: null,
};

function log(...args) {
  console.log('[STEP BUFFER]', ...args);
}

function warn(...args) {
  console.warn('[STEP BUFFER]', ...args);
}

function error(...args) {
  console.error('[STEP BUFFER]', ...args);
}

function getRemainingMs() {
  if (!session.startTime) return BUFFER_COLLECTION_MAX_MS;
  return Math.max(0, BUFFER_COLLECTION_MAX_MS - (Date.now() - session.startTime));
}

function clearDurationTimer() {
  if (session.durationTimer) {
    clearTimeout(session.durationTimer);
    session.durationTimer = null;
  }
}

function scheduleDurationStop() {
  clearDurationTimer();
  const remaining = getRemainingMs();
  if (remaining <= 0) {
    void sendBuffer('duration_reached');
    return;
  }
  session.durationTimer = setTimeout(() => {
    void sendBuffer('duration_reached');
  }, remaining);
}

function cleanupStreams() {
  clearDurationTimer();

  if (typeof session.stream?.stop === 'function') {
    session.stream.stop();
  }
  session.stream?.getTracks().forEach((track) => track.stop());
  session.rawStream?.getTracks().forEach((track) => track.stop());

  session.stream = null;
  session.rawStream = null;
  session.mediaRecorder = null;
  session.chunks = [];
  session.isRecording = false;
  session.startTime = null;
  session.hasSent = false;
}

function resetForNewScreening(screeningSessionId) {
  if (session.screeningSessionId === screeningSessionId) return;

  void stopRecordingOnly();
  session.completedSteps.clear();
  session.screeningSessionId = screeningSessionId;
  session.activeBufferType = null;
  session.userId = null;
  log('Reset for new screening session:', screeningSessionId);
}

async function startRecording(bufferType) {
  if (session.isRecording) return;
  if (session.completedSteps.has(bufferType)) {
    log(`Step ${bufferType} already completed — skipping recording`);
    return;
  }

  const kioskId = getKioskId();
  if (!session.screeningSessionId || !session.userId || !kioskId) {
    warn('Cannot start recording — missing session params');
    return;
  }

  try {
    const videoConstraints = await getRgbCameraConstraints({
      width: 640,
      height: 480,
      frameRate: 15,
    });

    const rawStream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    });

    const stream = await rotateStream90(rawStream);

    session.rawStream = rawStream;
    session.stream = stream;
    session.chunks = [];
    session.hasSent = false;
    session.startTime = Date.now();
    session.activeBufferType = bufferType;

    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8',
    });

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) {
        session.chunks.push(event.data);
      }
    };

    recorder.start(CHUNK_MS);
    session.mediaRecorder = recorder;
    session.isRecording = true;

    scheduleDurationStop();
    log(`Recording started for step ${bufferType} (max ${BUFFER_COLLECTION_MAX_MS / 1000}s)`);
  } catch (err) {
    error('Failed to start recording:', err.message);
    cleanupStreams();
    session.activeBufferType = null;
  }
}

async function stopRecorderAndGetBlob() {
  const recorder = session.mediaRecorder;
  if (!recorder || recorder.state === 'inactive') {
    return new Blob(session.chunks, { type: 'video/webm' });
  }

  await new Promise((resolve) => {
    recorder.onstop = resolve;
    recorder.stop();
  });

  return new Blob(session.chunks, { type: 'video/webm' });
}

async function sendBuffer(reason = 'duration_reached') {
  if (session.hasSent || session.isSending) return;
  if (!session.activeBufferType) return;

  session.isSending = true;
  session.hasSent = true;
  clearDurationTimer();

  const bufferType = session.activeBufferType;
  const elapsed = session.startTime ? Date.now() - session.startTime : 0;

  log(`Sending buffer for step ${bufferType} (reason: ${reason}, elapsed: ${(elapsed / 1000).toFixed(1)}s)`);

  try {
    const blob = await stopRecorderAndGetBlob();
    log(`Buffer size: ${(blob.size / 1024).toFixed(1)}KB, chunks: ${session.chunks.length}`);

    if (blob.size > 0) {
      const kioskId = getKioskId();
      const buffer = await blob.arrayBuffer();
      const storeResponse = await sendVideoToBackend({
        buffer: new Uint8Array(buffer),
        role: bufferType.toLowerCase(),
        deviceId: kioskId,
      });

      if (!storeResponse.success) {
        throw new Error(`/video/store failed: ${storeResponse.error}`);
      }

      const shmPath = storeResponse?.shm_path || storeResponse?.data?.shm_path;
      if (!shmPath) {
        throw new Error('/video/store did not return shm_path');
      }

      const collectionResponse = await bufferCollection(
        shmPath,
        session.userId,
        session.screeningSessionId,
        bufferType,
        kioskId
      );

      if (!collectionResponse.success) {
        throw new Error(`/buffer-collection failed: ${collectionResponse.error}`);
      }

      log(`Step ${bufferType} buffer collection completed`);
    } else {
      warn(`Empty buffer for step ${bufferType} — skipping upload`);
    }

    session.completedSteps.add(bufferType);
  } catch (err) {
    error(`Buffer collection failed for step ${bufferType}:`, err.message);
    session.completedSteps.add(bufferType);
  } finally {
    cleanupStreams();
    session.isSending = false;
  }
}

async function stopRecordingOnly() {
  clearDurationTimer();

  const recorder = session.mediaRecorder;
  if (recorder && recorder.state !== 'inactive') {
    await new Promise((resolve) => {
      recorder.onstop = resolve;
      recorder.stop();
    });
  }

  cleanupStreams();
}

/**
 * React to route changes — keeps recording alive across routes in the same step.
 */
export async function handleStepBufferRouteChange(pathname, { screeningSessionId, userId }) {
  if (screeningSessionId) {
    resetForNewScreening(screeningSessionId);
  }

  session.userId = userId ?? session.userId;

  const step = getStepForPath(pathname);
  const kioskId = getKioskId();

  if (!step || !screeningSessionId || !userId || !kioskId) {
    if (session.isRecording && !session.hasSent && session.activeBufferType) {
      await sendBuffer('left_step');
    } else {
      await stopRecordingOnly();
    }
    session.activeBufferType = null;
    return;
  }

  if (session.completedSteps.has(step.bufferType)) {
    log(`Step ${step.bufferType} already captured — no recording on ${pathname}`);
    if (session.isRecording) {
      await stopRecordingOnly();
    }
    session.activeBufferType = step.bufferType;
    return;
  }

  if (session.isRecording && session.activeBufferType === step.bufferType) {
    log(`Continuing recording for step ${step.bufferType} on ${pathname}`);
    return;
  }

  if (session.isRecording && session.activeBufferType !== step.bufferType) {
    await sendBuffer('step_change');
  }

  session.activeBufferType = step.bufferType;
  await startRecording(step.bufferType);
}

export function isStepBufferCompleted(bufferType) {
  return session.completedSteps.has(bufferType);
}

export async function teardownStepBufferSession() {
  if (session.isRecording && !session.hasSent && session.activeBufferType) {
    await sendBuffer('app_teardown');
  } else {
    await stopRecordingOnly();
  }
  session.activeBufferType = null;
}
