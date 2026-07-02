import { useLocation } from 'react-router';
import { useSelector } from 'react-redux';
import { useBufferCollection } from '../hooks/useBufferCollection';
import { usePageRecording } from '../hooks/usePageRecording';
import { getKioskId } from '../utils/config';
import {
  BUFFER_COLLECTION_MAX_MS,
  getBufferCollectionConfig,
} from '../utils/bufferCollectionRoutes';

/**
 * Starts buffer collection on screening pages that are not handled inside BIACalcuate.
 */
export default function BufferCollectionManager() {
  const location = useLocation();
  const storeUser = useSelector((state) => state.common.user);
  const screening = useSelector((state) => state.common.screening);

  const routeConfig = getBufferCollectionConfig(location.pathname);
  const screeningSessionId = screening?.sessionId;
  const userId = storeUser?.data?.user_id;
  const kioskId = getKioskId();

  const isEnabled = !!routeConfig && !!screeningSessionId && !!userId;

  const { startRecording, saveBuffer, forceCleanup } = usePageRecording({
    role: routeConfig?.bufferType?.toLowerCase() ?? 'page_buffer',
  });

  useBufferCollection({
    sessionId: screeningSessionId,
    userId,
    kioskId,
    bufferType: routeConfig?.bufferType ?? 'GENERAL',
    isEnabled,
    maxDuration: BUFFER_COLLECTION_MAX_MS,
    pageKey: location.pathname,
    recordingHook: { startRecording, saveBuffer, forceCleanup },
  });

  return null;
}
