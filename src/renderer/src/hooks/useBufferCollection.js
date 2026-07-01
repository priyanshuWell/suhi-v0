import { useEffect, useRef, useState } from 'react';
import { sendVideoToBackend, bufferCollection } from '../utils/api';

/**
 * Hook to handle buffer collection for video recording
 * Automatically collects buffers every minute and sends to backend
 * Integrates with existing recording systems
 */
export const useBufferCollection = ({ 
  sessionId, 
  userId, 
  kioskId, 
  bufferType = 'BIA',
  isEnabled = true,
  maxDuration = 60000, // 1 minute
  recordingHook = null // Pass existing recording hook for integration
}) => {
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectionStatus, setCollectionStatus] = useState('idle');
  const [lastCollectionTime, setLastCollectionTime] = useState(null);
  const [error, setError] = useState(null);
  
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const collectionTimeoutRef = useRef(null);

  // Function to store buffer and call collection API
  const collectAndStoreBuffer = async () => {
    if (!isEnabled || !sessionId || !userId || !kioskId) {
      console.log('⚠️ [BUFFER COLLECTION] Missing required parameters, skipping collection');
      return;
    }

    try {
      console.log('🎬 [BUFFER COLLECTION] Starting buffer collection cycle');
      setCollectionStatus('collecting');
      setError(null);

      // Start buffer collection timer
      startTimeRef.current = Date.now();
      
      // Set timeout to stop collection after maxDuration
      collectionTimeoutRef.current = setTimeout(async () => {
        try {
          console.log('⏰ [BUFFER COLLECTION] Buffer duration reached, processing collection');
          setCollectionStatus('processing');

          let shmPath = null;

          // Try to get buffer from recording hook if available
          if (recordingHook && recordingHook.saveBuffer) {
            console.log('📹 [BUFFER COLLECTION] Using integrated recording hook');
            const bufferLabel = `${bufferType.toLowerCase()}_collection_${Date.now()}`;
            await recordingHook.saveBuffer(bufferLabel);
            
            // For now, we'll simulate getting the shm_path
            // In a real implementation, the saveBuffer should return the shm_path
            shmPath = `/tmp/shm/${bufferLabel}_${sessionId}`;
          } else {
            // Fallback: create video data and send to store API
            console.log('📤 [BUFFER COLLECTION] Using fallback video storage');
            const videoData = {
              role: bufferType.toLowerCase(),
              deviceId: kioskId,
              buffer: new Uint8Array(1024), // Placeholder buffer
              timestamp: new Date().toISOString()
            };

            const storeResponse = await sendVideoToBackend(videoData);
            
            if (!storeResponse.success) {
              throw new Error(`Failed to store buffer: ${storeResponse.error}`);
            }

            shmPath = storeResponse.shm_path;
          }

          console.log('✅ [BUFFER COLLECTION] Buffer stored, shm_path:', shmPath);

          // Call buffer collection API with the shm_path
          console.log('📤 [BUFFER COLLECTION] Calling /buffer-collection API');
          const collectionResponse = await bufferCollection(
            shmPath,
            userId,
            sessionId,
            bufferType,
            kioskId
          );
          
          if (collectionResponse.success) {
            console.log('✅ [BUFFER COLLECTION] Buffer collection completed successfully');
            console.log('📊 [BUFFER COLLECTION] API Response:', collectionResponse);
            setCollectionStatus('completed');
            setLastCollectionTime(Date.now());
          } else {
            throw new Error(`Buffer collection API failed: ${collectionResponse.error}`);
          }

        } catch (error) {
          console.error('❌ [BUFFER COLLECTION] Error during buffer collection:', error);
          setError(error.message);
          setCollectionStatus('error');
        }
      }, maxDuration);

    } catch (error) {
      console.error('❌ [BUFFER COLLECTION] Error starting buffer collection:', error);
      setError(error.message);
      setCollectionStatus('error');
    }
  };

  // Start automatic buffer collection
  const startCollection = () => {
    if (!isEnabled) {
      console.log('⚠️ [BUFFER COLLECTION] Collection is disabled');
      return;
    }

    console.log('🚀 [BUFFER COLLECTION] Starting automatic buffer collection');
    console.log('📋 [BUFFER COLLECTION] Configuration:', {
      sessionId,
      userId,
      kioskId,
      bufferType,
      maxDuration,
      hasRecordingHook: !!recordingHook
    });
    
    setIsCollecting(true);
    setCollectionStatus('starting');

    // Collect first buffer immediately
    collectAndStoreBuffer();

    // Set up interval for subsequent collections
    intervalRef.current = setInterval(() => {
      collectAndStoreBuffer();
    }, maxDuration + 5000); // Small buffer between collections
  };

  // Stop buffer collection
  const stopCollection = () => {
    console.log('🛑 [BUFFER COLLECTION] Stopping buffer collection');
    setIsCollecting(false);
    setCollectionStatus('stopped');

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (collectionTimeoutRef.current) {
      clearTimeout(collectionTimeoutRef.current);
      collectionTimeoutRef.current = null;
    }
  };

  // Manual buffer collection trigger
  const triggerCollection = async () => {
    console.log('🔄 [BUFFER COLLECTION] Manual buffer collection triggered');
    await collectAndStoreBuffer();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCollection();
    };
  }, []);

  // Auto-start if enabled and parameters are available
  useEffect(() => {
    if (isEnabled && sessionId && userId && kioskId && !isCollecting) {
      startCollection();
    } else if (!isEnabled && isCollecting) {
      stopCollection();
    }
  }, [isEnabled, sessionId, userId, kioskId]);

  return {
    isCollecting,
    collectionStatus,
    lastCollectionTime,
    error,
    startCollection,
    stopCollection,
    triggerCollection
  };
};
