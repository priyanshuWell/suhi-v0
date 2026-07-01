import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useBufferCollection } from '../hooks/useBufferCollection';
import { useLocation } from 'react-router';

/**
 * Higher-Order Component (HOC) that adds buffer collection functionality to components
 * Excludes login and result pages from buffer collection
 */
const withBufferCollection = (WrappedComponent, options = {}) => {
  const {
    bufferType = 'GENERAL',
    excludeRoutes = ['/login-suhi', '/bia/result'],
    maxDuration = 60000 // 1 minute
  } = options;

  const BufferCollectionWrapper = (props) => {
    const location = useLocation();
    const storeUser = useSelector((state) => state.common.user);
    const screening = useSelector((state) => state.common.screening);

    // Check if current route should be excluded
    const shouldExclude = excludeRoutes.includes(location.pathname);
    
    // Determine if buffer collection should be enabled
    const shouldBeEnabled = !shouldExclude && 
                           !!(storeUser?.data?.buffer_id && storeUser?.data?.user_id) &&
                           !!(storeUser?.data?.kiosk_id);

    console.log(`🔍 [BUFFER HOC] Route analysis for ${location.pathname}:`, {
      shouldExclude,
      hasSessionId: !!storeUser?.data?.buffer_id,
      hasUserId: !!storeUser?.data?.user_id,
      hasKioskId: !!storeUser?.data?.kiosk_id,
      shouldBeEnabled
    });
    
    // Buffer collection hook
    const { 
      isCollecting, 
      collectionStatus, 
      lastCollectionTime, 
      error,
      startCollection,
      stopCollection,
      triggerCollection
    } = useBufferCollection({
      sessionId: storeUser?.data?.buffer_id,
      userId: storeUser?.data?.user_id,
      kioskId: storeUser?.data?.kiosk_id || 'default-kiosk',
      bufferType,
      isEnabled: shouldBeEnabled,
      maxDuration
    });

    // Log buffer collection status changes for debugging
    useEffect(() => {
      if (!shouldExclude) {
        console.log(`📊 [BUFFER HOC] ${location.pathname} - Collection status:`, {
          isCollecting,
          status: collectionStatus,
          lastCollectionTime: lastCollectionTime ? new Date(lastCollectionTime).toISOString() : null,
          error,
          routeExcluded: shouldExclude,
          shouldBeEnabled
        });

        // Log specific events
        if (collectionStatus === 'starting') {
          console.log(`🚀 [BUFFER HOC] Buffer collection starting on ${location.pathname}`);
        } else if (collectionStatus === 'collecting') {
          console.log(`🎬 [BUFFER HOC] Buffer collection in progress on ${location.pathname}`);
        } else if (collectionStatus === 'completed') {
          console.log(`✅ [BUFFER HOC] Buffer collection completed on ${location.pathname}`);
        } else if (collectionStatus === 'error') {
          console.log(`❌ [BUFFER HOC] Buffer collection error on ${location.pathname}:`, error);
        }
      }
    }, [isCollecting, collectionStatus, lastCollectionTime, error, shouldExclude, shouldBeEnabled, location.pathname]);

    // Log route changes and buffer collection lifecycle
    useEffect(() => {
      console.log(`🛣️ [BUFFER HOC] Route changed to: ${location.pathname}`);
      
      if (shouldExclude) {
        console.log(`⚠️ [BUFFER HOC] Route ${location.pathname} is excluded from buffer collection`);
        if (isCollecting) {
          console.log(`🛑 [BUFFER HOC] Stopping buffer collection due to route exclusion`);
          stopCollection();
        }
      } else {
        console.log(`✅ [BUFFER HOC] Route ${location.pathname} will have buffer collection enabled`);
        if (shouldBeEnabled && !isCollecting) {
          console.log(`🔄 [BUFFER HOC] Starting buffer collection for new route`);
          startCollection();
        }
      }
    }, [location.pathname, shouldExclude]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (isCollecting) {
          console.log(`🧹 [BUFFER HOC] Cleaning up buffer collection for ${location.pathname}`);
          stopCollection();
        }
      };
    }, []);

    return <WrappedComponent {...props} />;
  };

  return BufferCollectionWrapper;
};

export default withBufferCollection;
