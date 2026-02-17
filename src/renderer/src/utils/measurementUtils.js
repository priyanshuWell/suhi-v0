/**
 * Centralized Measurement Utilities
 * 
 * Provides reusable functions for weight and height measurements
 * with port connection management to prevent conflicts between
 * VideoCaptureScreen and BIACalculate components.
 */

// Track connected ports to prevent conflicts
let connectedPorts = new Set();

// Default timeout for measurements (30 seconds)
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
    // Ensure port is disconnected even on error, but only if we connected it
    if (shouldManageConnection) {
      await disconnectBiaPort(portPath);
    }
    throw error;
  }
}

/**
 * Measure height using height sensor
 * Automatically handles port connection and disconnection
 * @param {string} portPath - Path to height sensor port (e.g., ports[0]?.path)
 * @param {number} timeoutMs - Optional timeout in milliseconds (default: 30s)
 * @returns {Promise<Object>} { height: number, unit: 'cm' }
 */
export async function measureHeight(portPath=null, timeoutMs = DEFAULT_MEASUREMENT_TIMEOUT) {
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
    await disconnectHeightPort(portPath);
    throw error;
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

/**
 * Measure both weight and height sequentially (weight first, then height)
 * This runs in parallel with FPT processing but weight and height run in sequence
 * @param {Array} ports - Array of available ports
 * @param {number} timeoutMs - Optional timeout in milliseconds for each measurement (default: 30s)
 * @returns {Promise<Object>} { weight: number|null, height: number|null, errors: Object }
 */
// export async function measureWeightAndHeight(ports, timeoutMs = DEFAULT_MEASUREMENT_TIMEOUT) {
//   const heightPortPath = ports[0]?.path;
//   const weightPortPath = ports[2]?.path;
  
//   console.log(`[MEASUREMENT] Starting parallel weight and height measurement with ${timeoutMs}ms timeout...`);
  
//   // Run measurements in parallel using Promise.allSettled
//   // const [weightResult, heightResult] = await Promise.allSettled([
//   //   weightPortPath ? measureWeight(weightPortPath, timeoutMs) : Promise.reject(new Error('No weight port available')),
//   //   heightPortPath ? measureHeight(heightPortPath, timeoutMs) : Promise.reject(new Error('No height port available'))
//   // ]);
//   const weightResult = await measureWeight(weightPortPath);

//   const result = {
//     weight: null,
//     height: null,
//     errors: {}
//   };
  
//   // Process weight result
//   if (weightResult.status === 'fulfilled') {
//     result.weight = weightResult.value.weight;
//     console.log('[MEASUREMENT] Weight measurement succeeded:', result.weight);
//   } else {
//     result.errors.weight = weightResult.reason?.message || 'Weight measurement failed';
//     console.error('[MEASUREMENT] Weight measurement failed:', result.errors.weight);
//   }
  
//   // Process height result
//   if (heightResult.status === 'fulfilled') {
//     result.height = heightResult.value.height;
//     console.log('[MEASUREMENT] Height measurement succeeded:', result.height);
//   } else {
//     result.errors.height = heightResult.reason?.message || 'Height measurement failed';
//     console.error('[MEASUREMENT] Height measurement failed:', result.errors.height);
//   }
  
//   console.log('[MEASUREMENT] Parallel measurement completed:', result);
//   return result;
// }
export async function measureWeightAndHeight(ports, timeoutMs = DEFAULT_MEASUREMENT_TIMEOUT) {
  const heightPortPath = ports[0]?.path;
  const weightPortPath = ports[2]?.path;

  console.log(`[MEASUREMENT] Starting sequential weight then height measurement with ${timeoutMs}ms timeout...`);

  const result = {
    weight: null,
    height: null,
    errors: {}
  };
  
  // Measure weight first
  if (weightPortPath) {
    try {
      console.log('[MEASUREMENT] Step 1: Measuring weight...');
      const weightData = await measureWeight(weightPortPath, timeoutMs);
      result.weight = weightData.weight;
      console.log('[MEASUREMENT] Weight measurement succeeded:', result.weight);
    } catch (error) {
      result.errors.weight = error?.message || 'Weight measurement failed';
      console.error('[MEASUREMENT] Weight measurement failed:', result.errors.weight);
    }
  } else {
    result.errors.weight = 'No weight port available';
    console.error('[MEASUREMENT] No weight port available');
  }
  
  // Then measure height (only after weight completes)
  if (heightPortPath) {
    try {
      console.log('[MEASUREMENT] Step 2: Measuring height...');
      const heightData = await measureHeight(heightPortPath, timeoutMs);
      result.height = heightData.height;
      console.log('[MEASUREMENT] Height measurement succeeded:', result.height);
    } catch (error) {
      result.errors.height = error?.message || 'Height measurement failed';
      console.error('[MEASUREMENT] Height measurement failed:', result.errors.height);
    }
  } else {
    result.errors.height = 'No height port available';
    console.error('[MEASUREMENT] No height port available');
  }
  
  console.log('[MEASUREMENT] Sequential measurement completed:', result);
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
