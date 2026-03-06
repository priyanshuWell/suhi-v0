/**
 * Centralized Measurement Utilities
 * 
 * Provides reusable functions for weight and height measurements
 * with port connection management to prevent conflicts between
 * VideoCaptureScreen and BIACalculate components.
 * 
 * ℹ️ PORT CONFIGURATION:
 *    All port and timeout settings are now configurable via .env file
 *    See portConfig.js for configuration details
 *    Environment variables:
 *    - VITE_HEIGHT_PORT_INDEX (default: 2)
 *    - VITE_BIA_PORT_INDEX (default: 0)
 *    - VITE_WEIGHT_MEASUREMENT_TIMEOUT (default: 6000ms)
 *    - VITE_HEIGHT_MEASUREMENT_TIMEOUT (default: 30000ms)
 */

import { MEASUREMENT_TIMEOUTS, getHeightPortPath, getBiaPortPath } from './portConfig.js';

// Track connected ports to prevent conflicts
let connectedPorts = new Set();

const DEFAULT_MEASUREMENT_TIMEOUT = 6000;

/**
 * Wraps a promise with a timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} errorMessage - Error message to throw on timeout
 * @returns {Promise} Promise that rejects on timeout
 */
function withTimeout(promise, timeoutMs, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

/**
 * Measure weight using BIA device's built-in sensor
 * @param {string} portPath - Optional path to BIA port (if not provided, assumes port is already connected)
 * @param {number} timeoutMs - Optional timeout in milliseconds (default: 6s)
 * @returns {Promise<Object>} { weight: number, unit: 'kg' }
 */
export async function measureWeight(portPath = null, timeoutMs = DEFAULT_MEASUREMENT_TIMEOUT) {
  console.log(`[MEASUREMENT] Starting weight measurement with ${timeoutMs}ms timeout...`);
  
  const shouldManageConnection = !!portPath;
  
  if (shouldManageConnection) {
    console.log('[MEASUREMENT] Port path provided - will manage connection');
  } else {
    console.log('[MEASUREMENT] No port path - assuming port already connected');
  }

  try {
    // Connect to BIA port only if portPath is provided
    if (shouldManageConnection) {
      await connectBiaPort(portPath);
    }
    
    // Wrap measurement with timeout
    const res = await withTimeout(
      window.api.startWeightMeasurement(),
      timeoutMs,
      'Weight measurement timeout - user may not be standing on scale'
    );
    
    console.log('[MEASUREMENT] Weight result:', res);

    if (!res?.weight) {
      console.error('[MEASUREMENT] Weight measurement failed - no weight data');
      throw new Error('Weight measurement failed');
    }

    const weightValue = Number(res.weight);
    console.log(`[MEASUREMENT] Weight measured: ${weightValue} kg`);
    
    // Disconnect port after successful measurement only if we connected it
    if (shouldManageConnection) {
      await disconnectBiaPort(portPath);
    }
    
    return {
      weight: weightValue,
      unit: 'kg'
    };
  } catch (error) {
    console.error('[MEASUREMENT] Weight measurement error:', error);
    await disconnectBiaPort(portPath);
  return {
    weight: null,
    unit: 'kg',
    error: error?.message || 'Weight failed'
  };
  }
}

/**
 * Measure height using height sensor
 * Automatically handles port connection and disconnection
 * @param {string} portPath - Path to height sensor port (e.g., ports[0]?.path)
 * @param {number} timeoutMs - Optional timeout in milliseconds (default: configured via .env VITE_HEIGHT_MEASUREMENT_TIMEOUT)
 * @returns {Promise<Object>} { height: number, unit: 'cm' }
 */
export async function measureHeight(portPath, timeoutMs = DEFAULT_MEASUREMENT_TIMEOUT) {
  console.log(`[MEASUREMENT] Starting height measurement with ${timeoutMs}ms timeout...`);
  
  if (!portPath) {
    throw new Error('Height port path is required');
  }

  try {
    // Connect to height port
    await connectHeightPort(portPath);
    
    // Wrap measurement with timeout
    const res = await withTimeout(
      window.api.startHeightMeasurement(),
      timeoutMs,
      'Height measurement timeout - user may not be standing on sensor'
    );
    
    console.log('[MEASUREMENT] Height result:', res);

    if (!res?.height) {
      console.error('[MEASUREMENT] Height measurement failed - no height data');
      throw new Error('Height measurement failed');
    }

    const heightValue = Number(res.height);
    console.log(`[MEASUREMENT] Height measured: ${heightValue} cm`);

    // Disconnect port after measurement
    await disconnectHeightPort(portPath);

    return {
      height: heightValue,
      unit: 'cm'
    };
  } catch (error) {
    console.error('[MEASUREMENT] Height measurement error:', error);
    // Ensure port is disconnected even on error
     console.error('[MEASUREMENT] Height measurement error:', error);

  await disconnectHeightPort(portPath);

  return {
    height: null,
    unit: 'cm',
    error: error?.message || 'Height failed'
  };
  }
}

/**
 * Connect to height sensor port
 * Checks if port is already connected to prevent conflicts
 * @param {string} portPath - Path to height sensor port
 */
export async function connectHeightPort(portPath) {
  if (!portPath) {
    throw new Error('Port path is required');
  }

  if (connectedPorts.has(portPath)) {
    console.log('[MEASUREMENT] Port already connected:', portPath);
    return;
  }

  console.log('[MEASUREMENT] Connecting to height port:', portPath);
  await window.api.connectHeightPort(portPath);
  connectedPorts.add(portPath);
  console.log('[MEASUREMENT] Height port connected successfully');
}

export async function connectBiaPort(portPath) {
  if (!portPath) {
    throw new Error('Port path is required');
  }

  if (connectedPorts.has(portPath)) {
    console.log('[MEASUREMENT] BIA port already connected:', portPath);
    return;
  }

  console.log('[MEASUREMENT] Connecting to BIA port:', portPath);
  await window.api.connectBiaPort(portPath);
  connectedPorts.add(portPath);
  console.log('[MEASUREMENT] BIA port connected successfully');
}
/**
 * Disconnect from height sensor port
 * @param {string} portPath - Path to height sensor port
 */
export async function disconnectHeightPort(portPath) {
  if (!portPath) {
    console.log('[MEASUREMENT] No port path provided for disconnect');
    return;
  }

  if (!connectedPorts.has(portPath)) {
    console.log('[MEASUREMENT] Port not connected, skipping disconnect:', portPath);
    return;
  }

  console.log('[MEASUREMENT] Disconnecting height port:', portPath);
  
  try {
    // Call disconnect API
    if (window.api.disconnectHeightPort) {
      const result = await window.api.disconnectHeightPort();
      if (result?.success) {
        console.log('[MEASUREMENT] Height port disconnected successfully');
      }
    }
    
    connectedPorts.delete(portPath);
  } catch (error) {
    console.error('[MEASUREMENT] Error disconnecting port:', error);
    // Remove from tracking even if disconnect fails
    connectedPorts.delete(portPath);
  }
}
export async function disconnectBiaPort(portPath) {
  if (!portPath) {
    console.log('[MEASUREMENT] No BIA port path provided for disconnect');
    return;
  }

  if (!connectedPorts.has(portPath)) {
    console.log('[MEASUREMENT] BIA port not in connected set, skipping disconnect:', portPath);
    return;
  }

  console.log('[MEASUREMENT] Disconnecting BIA port:', portPath);
  
  try {
    // Call disconnect API
    if (window.api.disconnectBiaPort) {
      console.log('[MEASUREMENT] Calling backend disconnectBiaPort...');
      const result = await window.api.disconnectBiaPort();
      console.log('[MEASUREMENT] Backend disconnect result:', result);
      
      if (result?.success) {
        console.log('[MEASUREMENT] ✅ BIA port disconnected successfully');
        connectedPorts.delete(portPath);
      } else {
        console.warn('[MEASUREMENT] ⚠️ BIA port disconnect returned non-success:', result);
        // Still remove from tracking to prevent stuck state
        connectedPorts.delete(portPath);
      }
    } else {
      console.error('[MEASUREMENT] ❌ window.api.disconnectBiaPort is not available');
      connectedPorts.delete(portPath);
    }
  } catch (error) {
    console.error('[MEASUREMENT] ❌ Error disconnecting BIA port:', error);
    // Remove from tracking even if disconnect fails
    connectedPorts.delete(portPath);
  }
}

/**
 * Check if a port is currently connected
 * @param {string} portPath - Path to check
 * @returns {boolean} True if port is connected
 */
export function isPortConnected(portPath) {
  return connectedPorts.has(portPath);
}


export async function measureWeightAndHeight(ports, timeoutMs = DEFAULT_MEASUREMENT_TIMEOUT) {
  // Use configured port indices to select correct ports from the discovered list
  const heightPortPath = getHeightPortPath(ports);
  const weightPortPath = getBiaPortPath(ports);

  const result = {
    weight: null,
    height: null,
    errors: {},
    status: "completed"
  };

  // Weight
  if (weightPortPath) {
    const weightData = await measureWeight(weightPortPath, timeoutMs);
    result.weight = weightData.weight;
    if (weightData.error) {
      result.errors.weight = weightData.error;
    }
  } else {
    result.errors.weight = "No weight port available";
  }

  // Height
  if (heightPortPath) {
    const heightData = await measureHeight(heightPortPath, timeoutMs);
    result.height = heightData.height;
    if (heightData.error) {
      result.errors.height = heightData.error;
    }
  } else {
    result.errors.height = "No height port available";
  }

  return result;
}
/**
 * Send measurements to backend
 * @param {Object} data - Measurement data
 * @param {number} data.weight - Weight in kg
 * @param {number} data.height - Height in cm
 * @param {string} data.userId - User ID
 * @returns {Promise<Object>} Backend response
 */
export async function sendMeasurementsToBackend(data) {
  console.log('[MEASUREMENT] Sending measurements to backend:', data);
  
  try {
    const payload = {
      weight: data.weight,
      height: data.height,
      user_id: data.userId,
      timestamp: new Date().toISOString()
    };

    // Use the API function from api.js
    const response = await window.api.sendMeasurements?.(payload);
    
    if (!response) {
      console.warn('[MEASUREMENT] No response from backend, API may not be implemented yet');
      return { success: true, message: 'API not implemented' };
    }

    console.log('[MEASUREMENT] Backend response:', response);
    return response;
  } catch (error) {
    console.error('[MEASUREMENT] Error sending to backend:', error);
    throw error;
  }
}

/**
 * Clear all port connections (cleanup utility)
 */
export function clearAllPortConnections() {
  console.log('[MEASUREMENT] Clearing all port connections');
  connectedPorts.clear();
}
