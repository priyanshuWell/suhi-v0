/**
 * Centralized Port Configuration
 * 
 * Reads port settings from environment variables (.env file)
 * Provides a single source of truth for all port-related configurations
 */

/**
 * Port indices for automatic discovery
 * These map to the order in which ports are discovered
 */
export const PORT_INDICES = {
  HEIGHT: parseInt(import.meta.env.VITE_HEIGHT_PORT_INDEX),
  BIA: parseInt(import.meta.env.VITE_BIA_PORT_INDEX),
};
console.log('[PORT CONFIG] Port Indices loaded:', PORT_INDICES)
/**
 * Serial port configuration
 */

export const PORT_PATHS = {
  HEIGHT: import.meta.env.VITE_HEIGHT_PORT_PATH || null,
  BIA: import.meta.env.VITE_BIA_PORT_PATH || null,
};
export const SERIAL_CONFIG = {
  baudRate: parseInt(import.meta.env.VITE_SERIAL_BAUD_RATE || '9600'),
  dataBits: parseInt(import.meta.env.VITE_SERIAL_DATA_BITS || '8'),
  stopBits: parseInt(import.meta.env.VITE_SERIAL_STOP_BITS || '1'),
  parity: import.meta.env.VITE_SERIAL_PARITY || 'none',
};

/**
 * Connection timeout configurations (in milliseconds)
 */
export const CONNECTION_TIMEOUTS = {
  portConnect: parseInt(import.meta.env.VITE_PORT_CONNECT_TIMEOUT || '5000'),
  portRead: parseInt(import.meta.env.VITE_PORT_READ_TIMEOUT || '10000'),
};

/**
 * Measurement timeout configurations (in milliseconds)
 */
export const MEASUREMENT_TIMEOUTS = {
  weight: parseInt(import.meta.env.VITE_WEIGHT_MEASUREMENT_TIMEOUT || '6000'),
  height: parseInt(import.meta.env.VITE_HEIGHT_MEASUREMENT_TIMEOUT || '30000'),
  legImpedance: parseInt(import.meta.env.VITE_LEG_IMPEDANCE_TIMEOUT || '15000'),
  armImpedance: parseInt(import.meta.env.VITE_ARM_IMPEDANCE_TIMEOUT || '15000'),
  impedance20kHz: parseInt(import.meta.env.VITE_IMPEDANCE_20KHZ_TIMEOUT || '20000'),
  impedance100kHz: parseInt(import.meta.env.VITE_IMPEDANCE_100KHZ_TIMEOUT || '20000'),
};

/**
 * Get the height port from the ports array using configured index
 */
export function getHeightPort(ports) {
  if (!ports || ports.length === 0) {
    console.warn('[PORT CONFIG] No ports available');
    return null;
  }

  const heightPort = ports[PORT_INDICES.HEIGHT];
  
  if (!heightPort) {
    console.warn(`[PORT CONFIG] Height port not found at index ${PORT_INDICES.HEIGHT}`);
    return null;
  }

  console.log(`[PORT CONFIG] Height port selected: ${heightPort.path}`);
  return heightPort;
}

/**
 * Get the BIA/Weight port from the ports array using configured index
 */
export function getBiaPort(ports) {
  if (!ports || ports.length === 0) {
    console.warn('[PORT CONFIG] No ports available');
    return null;
  }

  const biaPort = ports[PORT_INDICES.BIA];
  
  if (!biaPort) {
    console.warn(`[PORT CONFIG] BIA port not found at index ${PORT_INDICES.BIA}`);
    return null;
  }

  console.log(`[PORT CONFIG] BIA port selected: ${biaPort.path}`);
  return biaPort;
}

/**
 * Get the height port path
 */
export function getHeightPortPath(ports) {
  const port = getHeightPort(ports);
  return port?.path || null;
}

/**
 * Get the BIA port path
 */
export function getBiaPortPath(ports) {
  const port = getBiaPort(ports);
  return port?.path || null;
}

/**
 * Validate that required ports are available
 */
export function validatePorts(ports) {
  const errors = [];

  if (!ports || ports.length === 0) {
    errors.push('No ports available');
    return { valid: false, errors };
  }

  if (!ports[PORT_INDICES.HEIGHT]) {
    errors.push(`Height port not found at index ${PORT_INDICES.HEIGHT}`);
  }

  if (!ports[PORT_INDICES.BIA]) {
    errors.push(`BIA port not found at index ${PORT_INDICES.BIA}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    ports: {
      height: getHeightPort(ports),
      bia: getBiaPort(ports),
    },
  };
}

/**
 * Log current port configuration for debugging
 */
export function logPortConfiguration() {
  console.log('[PORT CONFIG] ========== PORT CONFIGURATION ==========');
  console.log('[PORT CONFIG] Port Indices:', PORT_INDICES);
  console.log('[PORT CONFIG] Serial Config:', SERIAL_CONFIG);
  console.log('[PORT CONFIG] Connection Timeouts:', CONNECTION_TIMEOUTS);
  console.log('[PORT CONFIG] Measurement Timeouts:', MEASUREMENT_TIMEOUTS);
  console.log('[PORT CONFIG] =============================================');
}

export default {
  PORT_INDICES,
  SERIAL_CONFIG,
  CONNECTION_TIMEOUTS,
  MEASUREMENT_TIMEOUTS,
  getHeightPort,
  getBiaPort,
  getHeightPortPath,
  getBiaPortPath,
  validatePorts,
  logPortConfiguration,
};
