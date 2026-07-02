import { useEffect, useRef, useState } from 'react';
import { bufferCollection } from '../utils/api';

/**
 * Collects one video buffer per enabled page visit (default max 1 minute).
 * Uses screening session_id for /buffer-collection.
 */
export const useBufferCollection = ({
  sessionId,
  userId,
  kioskId,
  bufferType = 'GENERAL',
  isEnabled = true,
  maxDuration = 60000,
  recordingHook = null,
  pageKey = null,
}) => {
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectionStatus, setCollectionStatus] = useState('idle');
  const [lastCollectionTime, setLastCollectionTime] = useState(null);
  const [error, setError] = useState(null);

  const timeoutRef = useRef(null);
  const hasCollectedRef = useRef(false);
  const isCollectingRef = useRef(false);

  const stopTimers = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const collectAndStoreBuffer = async (reason = 'duration') => {
    if (hasCollectedRef.current) return;
    if (!sessionId || !userId || !kioskId) {
      console.warn('[BUFFER COLLECTION] Missing required parameters, skipping collection');
      return;
    }

    hasCollectedRef.current = true;
    stopTimers();

    try {
      console.log(`[BUFFER COLLECTION] Processing collection (${reason})`);
      setCollectionStatus('processing');
      setError(null);

      let storeResponse = null;

      if (recordingHook?.saveBuffer) {
        storeResponse = await recordingHook.saveBuffer(`${bufferType.toLowerCase()}_${reason}`);
      }

      if (recordingHook?.includesBufferCollection) {
        if (!storeResponse?.success && storeResponse?.data?.shm_path == null) {
          throw new Error('Recording hook failed to store buffer');
        }
        setCollectionStatus('completed');
        setLastCollectionTime(Date.now());
        console.log('[BUFFER COLLECTION] Completed via recording hook');
        return;
      }

      const shmPath = storeResponse?.data?.shm_path ?? storeResponse?.shm_path;

      if (!shmPath) {
        throw new Error('Failed to store buffer or shm_path not received');
      }

      console.log('[BUFFER COLLECTION] Calling /buffer-collection API with screening session:', sessionId);
      const collectionResponse = await bufferCollection(
        shmPath,
        userId,
        sessionId,
        bufferType,
        kioskId
      );

      if (!collectionResponse.success) {
        throw new Error(`Buffer collection API failed: ${collectionResponse.error}`);
      }

      setCollectionStatus('completed');
      setLastCollectionTime(Date.now());
      console.log('[BUFFER COLLECTION] Completed successfully');
    } catch (collectionError) {
      console.error('[BUFFER COLLECTION] Error during buffer collection:', collectionError);
      setError(collectionError.message);
      setCollectionStatus('error');
    } finally {
      setIsCollecting(false);
      isCollectingRef.current = false;
    }
  };

  const startCollection = () => {
    if (!isEnabled || isCollectingRef.current) return;
    if (!sessionId || !userId || !kioskId) return;

    console.log('[BUFFER COLLECTION] Starting page collection', {
      sessionId,
      userId,
      kioskId,
      bufferType,
      maxDuration,
    });

    hasCollectedRef.current = false;
    isCollectingRef.current = true;
    setIsCollecting(true);
    setCollectionStatus('collecting');
    setError(null);

    recordingHook?.startRecording?.();

    timeoutRef.current = setTimeout(() => {
      collectAndStoreBuffer('duration');
    }, maxDuration);
  };

  const stopCollection = (reason = 'manual_stop') => {
    stopTimers();

    if (isCollectingRef.current && !hasCollectedRef.current) {
      collectAndStoreBuffer(reason);
      return;
    }

    recordingHook?.forceCleanup?.();
    setIsCollecting(false);
    isCollectingRef.current = false;
    setCollectionStatus('stopped');
  };

  const triggerCollection = async () => {
    await collectAndStoreBuffer('manual_trigger');
  };

  useEffect(() => {
    if (isEnabled) {
      startCollection();
    } else {
      stopCollection('disabled');
    }

    return () => {
      if (isCollectingRef.current && !hasCollectedRef.current) {
        collectAndStoreBuffer('unmount');
      } else {
        stopTimers();
        recordingHook?.forceCleanup?.();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, sessionId, userId, kioskId, bufferType, maxDuration, pageKey]);

  return {
    isCollecting,
    collectionStatus,
    lastCollectionTime,
    error,
    startCollection,
    stopCollection,
    triggerCollection,
  };
};
