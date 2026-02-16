/**
 * Centralized Measurement Utilities
 * 
 * Provides reusable functions for weight and height measurements
 * with port connection management to prevent conflicts between
 * VideoCaptureScreen and BIACalculate components.
 */

// Track connected ports to prevent conflicts
let connectedPorts = new Set();

/**
 * Measure weight using BIA device's built-in sensor
 * @returns {Promise<Object>} { weight: number, unit: 'kg' }
 */
export async function measureWeight() {
  console.log('[MEASUREMENT] Starting weight measurement...');
  
  try {
     //await connectBiaPort(weightPortPath);
    
    const res = await window.api.startWeightMeasurement();
    console.log('[MEASUREMENT] Weight result:', res);

    if (!res?.weight) {
      console.error('[MEASUREMENT] Weight measurement failed - no weight data');
      throw new Error('Weight measurement failed');
    }

    const weightValue = Number(res.weight);
    console.log(`[MEASUREMENT] Weight measured: ${weightValue} kg`);
      // await disconnectBiaPort(weightPortPath)
    return {
      weight: weightValue,
      unit: 'kg'
    };
  } catch (error) {
    console.error('[MEASUREMENT] Weight measurement error:', error);
    throw error;
  }
}

/**
 * Measure height using height sensor
 * Automatically handles port connection and disconnection
 * @param {string} portPath - Path to height sensor port (e.g., ports[0]?.path)
 * @returns {Promise<Object>} { height: number, unit: 'cm' }
 */
export async function measureHeight(portPath) {
  console.log('[MEASUREMENT] Starting height measurement...');
  
  if (!portPath) {
    throw new Error('Height port path is required');
  }

  try {
    // Connect to height port
    await connectHeightPort(portPath);
    
    // Measure height
    const res = await window.api.startHeightMeasurement();
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
    console.log('[MEASUREMENT] Port already connected:', portPath);
    return;
  }

  console.log('[MEASUREMENT] Connecting to height port:', portPath);
  await window.api.connectBiaPort(portPath);
  connectedPorts.add(portPath);
  console.log('[MEASUREMENT] Height port connected successfully');
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
    console.log('[MEASUREMENT] No port path provided for disconnect');
    return;
  }

  if (!connectedPorts.has(portPath)) {
    console.log('[MEASUREMENT] Port not connected, skipping disconnect:', portPath);
    return;
  }

  console.log('[MEASUREMENT] Disconnecting bia port:', portPath);
  
  try {
    // Call disconnect API
    if (window.api.disconnectBiaPort) {
      const result = await window.api.disconnectBiaPort();
      if (result?.success) {
        console.log('[MEASUREMENT] weight port disconnected successfully');
      }
    }
    
    connectedPorts.delete(portPath);
  } catch (error) {
    console.error('[MEASUREMENT] Error disconnecting port:', error);
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
 * Measure both weight and height
 * @param {string} heightPortPath - Path to height sensor port
 * @returns {Promise<Object>} { weight: number, height: number }
 */
export async function measureWeightAndHeight(ports) {
  const heightPortPath = ports[0].path;
  const weigthPortPath =  ports[2].path;
  // await window.api.connectBiaPort(heightPortPath)
  await connectBiaPort(weigthPortPath)
  console.log('[MEASUREMENT] Starting weight and height measurement...');
  
  try {
    // Measure weight first
    const weightResult = await measureWeight();
    console.log("weight port is going to disconnect")
    await disconnectBiaPort(weigthPortPath)
    console.log("weight disconnect")
    // Small delay between measurements
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Measure height
    const heightResult = await measureHeight(heightPortPath);
    
    return {
      weight: weightResult.weight,
      height: heightResult.height
    };
  } catch (error) {
    console.error('[MEASUREMENT] Combined measurement error:', error);
    throw error;
  }
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
