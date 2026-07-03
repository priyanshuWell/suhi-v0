import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useSelector } from 'react-redux';
import {
  handleStepBufferRouteChange,
  teardownStepBufferSession,
} from '../utils/stepBufferSession';

/**
 * App-level manager for the four screening steps.
 * Each step records at most 1 minute of video across all its routes.
 * Recording continues when navigating between routes within the same step.
 */
export default function BufferCollectionManager() {
  const location = useLocation();
  const storeUser = useSelector((state) => state.common.user);
  const screening = useSelector((state) => state.common.screening);

  const screeningSessionId = screening?.sessionId;
  const userId = storeUser?.data?.user_id;
  useEffect(() => {
    void handleStepBufferRouteChange(location.pathname, {
      screeningSessionId,
      userId,
    });
  }, [location.pathname, screeningSessionId, userId]);

  useEffect(() => () => {
    void teardownStepBufferSession();
  }, []);

  return null;
}
