import { stopAllTracks } from './cameraTracker';
import { clearAllPortConnections } from './measurementUtils';

/**
 * Releases all application-level resources, including camera streams
 * and hardware port connections. Should be called when navigating
 * back to the homepage or ending a session.
 */
export function releaseAllResources() {
  console.log('[CLEANUP] Releasing all cameras and resources via global tracker...');
  
  try {
    // This will stop all tracks tracked by the global tracker
    stopAllTracks();
    console.log('[CLEANUP] Global camera release completed.');
  } catch (err) {
    console.warn('[CLEANUP] Error during global camera release:', err);
  }
  
  try {
    clearAllPortConnections();
    console.log('[CLEANUP] All port connections cleared.');
  } catch (err) {
    console.warn('[CLEANUP] Error clearing port connections:', err);
  }
}
