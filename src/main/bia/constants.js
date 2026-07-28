/**
 * bia/constants.js
 * All BMH05108 protocol error-code maps, frequency codes, and impedance modes.
 * Pure data — no imports.
 */

// ──────────────────────────────────────────────────────────────────
// IMPEDANCE (BIA) ERROR CODES
// ──────────────────────────────────────────────────────────────────
export const IMPEDANCE_ERROR_CODES = {
  0x00: {
    code: 'NULL', severity: 'INFO',
    message: 'BIA_NULL - Null state',
    description: 'Device has not received measurement request',
    action: 'INFO', canRetry: false,
    nextStep: 'Continue with measurement',
    userMessage: "Oops, couldn't get body composition analysis. Hold on, we will try once again"
  },
  0x01: {
    code: 'ELECTRODE', severity: 'ERROR',
    message: 'Ensure your are holding electrodes properly',
    description: 'Device detected electrode contact problem',
    action: 'RETRY', canRetry: false,
    nextStep: 'Stop measurement and check electrodes',
    userMessage: 'Please ensure you are barefoot, and holding the hand rails firmly',
    causes: ['Electrode not properly connected','Loose electrode contact','Poor skin contact','Broken electrode pad'],
    solutions: ['1. Inspect all electrodes visually','2. Reseat each electrode firmly','3. Clean electrode pads with alcohol','4. Check for bent pins/connectors','5. Try replacement electrode pads','6. Restart measurement']
  },
  0x02: {
    code: 'MEASURE', severity: 'INFO',
    message: 'BIA_MEASURE - Measurement in progress',
    description: 'Device is currently measuring - wait for completion',
    action: 'WAIT', canRetry: false,
    nextStep: 'Wait for measurement to complete',
    userMessage: 'Measurement in progress... Please wait',
    waitTime: 3000
  },
  0x03: {
    code: 'SUCCESS', severity: 'SUCCESS',
    message: 'BIA_SUCCESS - Measurement successful',
    description: 'Device measurement completed successfully',
    action: 'ACCEPT', canRetry: false,
    nextStep: 'Accept measurement and continue',
    userMessage: 'Impedance measurement successful',
    expectation: 'Data is valid and ready to use'
  },
  0x04: {
    code: 'ERROR_RANGER', severity: 'ERROR',
    message: 'BIA_ERROR_RANGER - Impedance out of range (10-1600Ω)',
    description: 'Measured value is outside acceptable range',
    action: 'RETRY', canRetry: true, maxRetries: 3, waitBeforeRetry: 2000,
    nextStep: 'Retry measurement with corrected conditions',
    userMessage: 'MEASUREMENT OUT OF RANGE | Impedance value is outside valid range\n   • Check electrode contact quality\n   • Verify skin contact\n   • Adjust electrode placement',
    issues: ['Impedance too low (short circuit)','Impedance too high (poor contact)','Invalid measurement'],
    solutions: ['1. Check electrode contact pressure','2. Ensure skin is clean and slightly moist','3. Reposition electrodes if needed','4. Apply conductive gel if dry','5. Dry skin if wet','6. Retry measurement']
  },
  0x05: {
    code: 'ERROR_REPEAT', severity: 'ERROR',
    message: 'BIA_ERROR_REPEAT - Abnormal data detected',
    description: 'Device detected abnormal data, measurement failed',
    action: 'RETRY', canRetry: true, maxRetries: 3, waitBeforeRetry: 2000,
    nextStep: 'Retry the impedance measurement',
    userMessage: "Oops, couldn't get body scan data. Hold on, we will try once again!",
    issues: ['Electrode connection lost during measurement','User moved during measurement','Sensor malfunction'],
    solutions: ['1. Ensure user is still for measurement','2. Check all electrode connections','3. Retry measurement','4. If persists, restart device']
  },
  0x06: {
    code: 'USER_EXIT', severity: 'INFO',
    message: 'BIA_USER_EXIT - User stopped measurement',
    description: 'User cancelled the measurement',
    action: 'CANCEL', canRetry: false,
    nextStep: 'Can retry measurement anytime',
    userMessage: 'Measurement cancelled by user',
    expectation: 'Ready to restart measurement'
  }
}

// ──────────────────────────────────────────────────────────────────
// WEIGHT ERROR CODES
// ──────────────────────────────────────────────────────────────────
export const WEIGHT_ERROR_CODES = {
  0x00: { code: 'NULL', severity: 'INFO', message: 'WEIGHT_NULL - Null state', description: 'Scale has not received measurement request', action: 'INFO', canRetry: false, nextStep: 'Continue with weight measurement', userMessage: 'Stand straight, weight measurement in progess...' },
  0x01: { code: 'ZERO_POINT', severity: 'WARNING', message: 'WEIGHT IS ZERO DETECTED', description: 'Scale is currently empty or reading zero.', action: 'WAIT', canRetry: false, nextStep: 'Accept zero reading (empty scale confirmed)', userMessage: 'Step on the scale and stand still', expectation: 'No weight on scale' },
  0x02: { code: 'UNSTABLE', severity: 'WARNING', message: 'WEIGHT_UNSTABLE - Unstable reading', description: 'Weight reading is fluctuating', action: 'WAIT', canRetry: false, nextStep: 'Wait for weight to stabilize', userMessage: 'Weight reading is unstable, please stand still...', waitTime: 2000, causes: ['User moving on scale','Scale still settling','Wind or vibration','Scale needs stabilization'], solutions: ['1. Keep user still on scale','2. Wait 2-3 seconds for settling','3. Ensure scale is on level surface','4. Remove any vibration sources','5. Retry measurement'] },
  0x03: { code: 'STABLE', severity: 'SUCCESS', message: 'WEIGHT_STABLE - Stable weight reading', description: 'Weight measurement is stable and valid', action: 'ACCEPT', canRetry: false, nextStep: 'Accept weight measurement and continue', userMessage: 'Weight measurement stable and valid', expectation: 'Data is valid and ready to use' },
  0x04: { code: 'OVERLOAD', severity: 'ERROR', message: 'WEIGHT_OVERLOAD - Scale overloaded', description: 'Measured weight exceeds scale maximum capacity', action: 'ABORT', canRetry: false, nextStep: 'Remove weight and retry', userMessage: 'SCALE OVERLOADED! Remove weight from scale and Retry measurement', maxCapacity: 150, issues: ['Weight exceeds 150 kg','Multiple people on scale','Scale needs recalibration'], solutions: ['1. Remove all weight from scale','2. Check if weight is within 0-150 kg range','3. Ensure only one person on scale','4. Wait for scale to zero','5. Retry measurement','6. If persists, recalibrate scale'] },
  0x05: { code: 'UNDERLOAD', severity: 'WARNING', message: 'WEIGHT_UNDERLOAD - Weight too low', description: 'Measured weight is below minimum threshold', action: 'RETRY', canRetry: true, maxRetries: 2, waitBeforeRetry: 1500, nextStep: 'Retry measurement after weight stabilization', userMessage: 'WEIGHT TOO LOW|Ensure proper contact with scale', minThreshold: 1.0, issues: ['User not properly on scale','Poor contact with scale','Scale needs zeroing'], solutions: ['1. Ensure user stands firmly on scale','2. Check all feet contact scale platform','3. Wait 2-3 seconds for settling','4. Remove shoes if very light','5. Retry measurement'] },
  0x06: { code: 'CALIBRATION_ERROR', severity: 'ERROR', message: 'WEIGHT_CALIBRATION_ERROR - Calibration mismatch', description: 'Calibration factor appears incorrect', action: 'RETRY', canRetry: true, maxRetries: 1, waitBeforeRetry: 1000, nextStep: 'Retry measurement, consider recalibration', userMessage: 'CALIBRATION ERROR\n   • Reading seems incorrect\n   • Please retry measurement\n   • If persistent, run calibration', issues: ['Calibration factor incorrect','Scale has drifted','Temperature change'], solutions: ['1. Retry measurement on empty scale (should be 0 kg)','2. Retry with known weight','3. If reading is off, run calibration (case 15)','4. Check scale is on level surface','5. Contact support if persists'] },
  0x07: { code: 'SENSOR_ERROR', severity: 'CRITICAL', message: 'WEIGHT_SENSOR_ERROR - Sensor malfunction', description: 'Scale sensor is not responding correctly', action: 'ABORT', canRetry: false, nextStep: 'Check scale hardware, may need service', userMessage: 'SCALE SENSOR ERROR\n   • Scale sensor not responding\n   • Hardware may be faulty\n   • Contact support or service scale', issues: ['Sensor disconnected','Sensor malfunction','Scale hardware failure'], solutions: ['1. Check power to scale','2. Verify USB/serial connection','3. Restart scale (power cycle)','4. Restart software','5. If persists, scale needs service'] },
  0x08: { code: 'TIMEOUT', severity: 'ERROR', message: 'WEIGHT_TIMEOUT - Measurement timeout', description: 'Scale did not respond to measurement query', action: 'RETRY', canRetry: true, maxRetries: 3, waitBeforeRetry: 2000, nextStep: 'Retry measurement', userMessage: 'Be On Scale! Retrying measurement', issues: ['Serial connection interrupted','Scale unresponsive','Communication error'], solutions: ['1. Check USB/serial cable connection','2. Check scale power LED','3. Restart scale','4. Retry measurement','5. Restart software if persists'] },
  0x09: { code: 'PORT_ERROR', severity: 'CRITICAL', message: 'WEIGHT_PORT_ERROR - Port not connected', description: 'Weight port (scale) is not connected', action: 'ABORT', canRetry: false, nextStep: 'Connect scale and select measurement again', userMessage: 'SCALE NOT CONNECTED\n   • Please connect scale via USB/Serial\n   • Check connection in menu option 3\n   • Try again after connecting', issues: ['USB cable disconnected','Serial port not opened','Scale powered off'], solutions: ['1. Check USB cable is connected to scale','2. Check USB cable is connected to computer','3. Power on the scale','4. Select option 3 to connect weight scale','5. Verify connection shows "connected"','6. Then retry measurement'] },
  0x0a: { code: 'INVALID_RESPONSE', severity: 'ERROR', message: 'WEIGHT_INVALID_RESPONSE - Invalid response format', description: 'Scale responded but with invalid data format', action: 'RETRY', canRetry: true, maxRetries: 2, waitBeforeRetry: 1000, nextStep: 'Retry measurement', userMessage: 'Scale sent invalid data, Retrying measurement...', issues: ['Data corruption','Serial communication error','Scale firmware issue'], solutions: ['1. Retry measurement','2. Check USB cable quality','3. Restart scale','4. Update scale firmware if available','5. Contact support if persists'] }
}

// ──────────────────────────────────────────────────────────────────
// HEIGHT ERROR CODES
// ──────────────────────────────────────────────────────────────────
export const HEIGHT_ERROR_CODES = {
  0x00: { code: 'NULL', severity: 'INFO', message: 'HEIGHT_NULL - Null state', description: 'Height sensor has not received measurement request', action: 'INFO', canRetry: false, nextStep: 'Now we are measuring your height, please stand still!', userMessage: 'Measurement ready to start!' },
  0x01: { code: 'OUT_OF_RANGE_LOW', severity: 'ERROR', message: 'HEIGHT_OUT_OF_RANGE_LOW - Height too low', description: 'Height is below minimum range (< 80 cm)', action: 'RETRY', canRetry: true, maxRetries: 2, waitBeforeRetry: 1500, nextStep: 'Check user height and retry', userMessage: 'HEIGHT OUT OF RANGE (TOO LOW)', minHeight: 80, issues: ['User not standing straight','Sensor not aligned','Child measurement (< 80 cm normal)','Sensor malfunction'], solutions: ['1. Ask user to stand straight','2. Ensure feet are flat on ground','3. Check sensor is at correct height','4. Check sensor alignment','5. Retry measurement','6. If user is child, this is normal'] },
  0x02: { code: 'OUT_OF_RANGE_HIGH', severity: 'ERROR', message: 'HEIGHT_OUT_OF_RANGE_HIGH - Height too high', description: 'Height exceeds maximum range (> 250 cm)', action: 'RETRY', canRetry: true, maxRetries: 2, waitBeforeRetry: 1500, nextStep: 'Check user height and retry', userMessage: 'HEIGHT OUT OF RANGE (TOO HIGH)', maxHeight: 250, issues: ['User standing on object','Sensor misaligned','Sensor malfunction','False reading'], solutions: ['1. Ask user to step down if on anything','2. Check user standing on flat ground','3. Check sensor is properly aligned','4. Verify height is realistic','5. Retry measurement','6. Check for obstructions'] },
  0x03: { code: 'UNSTABLE', severity: 'WARNING', message: 'HEIGHT_UNSTABLE - Unstable reading', description: 'Height reading is fluctuating', action: 'WAIT', canRetry: false, nextStep: 'Wait for reading to stabilize', userMessage: 'We are measuring your Height, Please wait...', waitTime: 2000, causes: ['User moving','Sensor settling','Vibrations','Air currents affecting sensor'], solutions: ['1. Ask user to stand still','2. Remove any moving objects','3. Avoid air vents or fans','4. Wait 2-3 seconds','5. Retry measurement'] },
  0x04: { code: 'STABLE', severity: 'SUCCESS', message: 'HEIGHT_STABLE - Stable height reading', description: 'Height measurement is stable and valid', action: 'ACCEPT', canRetry: false, nextStep: 'Accept height measurement and continue', userMessage: '✅ Height measurement stable and valid', expectation: 'Data is valid and ready to use' },
  0x05: { code: 'SENSOR_ERROR', severity: 'CRITICAL', message: 'HEIGHT_SENSOR_ERROR - Sensor malfunction', description: 'Height sensor is not responding correctly', action: 'ABORT', canRetry: false, nextStep: 'Check sensor hardware, may need service', userMessage: ' HEIGHT SENSOR ERROR\n   • Sensor not responding\n   • Hardware may be faulty\n   • Contact support or service sensor', issues: ['Sensor disconnected','Sensor malfunction','Hardware failure'], solutions: ['1. Check power to sensor','2. Verify USB/serial connection','3. Check sensor cable','4. Restart sensor','5. If persists, sensor needs service'] },
  0x06: { code: 'CALIBRATION_ERROR', severity: 'ERROR', message: 'HEIGHT_CALIBRATION_ERROR - Calibration mismatch', description: 'Height sensor calibration appears incorrect', action: 'RETRY', canRetry: true, maxRetries: 1, waitBeforeRetry: 1000, nextStep: 'Retry measurement, consider recalibration', userMessage: 'CALIBRATION ERROR\n   • Reading seems incorrect\n   • Please retry measurement\n   • If persistent, recalibrate sensor', issues: ['Calibration offset incorrect','Sensor has drifted','Temperature change'], solutions: ['1. Retry measurement','2. Use reference height to verify','3. If off, recalibrate sensor','4. Check sensor is vertical','5. Contact support if persists'] },
  0x07: { code: 'TIMEOUT', severity: 'ERROR', message: 'MEASUREMENT_TIMEOUT - Measurement timeout', description: 'Height sensor did not respond to query', action: 'RETRY', canRetry: true, maxRetries: 3, waitBeforeRetry: 2000, nextStep: 'Retry measurement', userMessage: 'Sensor did not respond | Measurement timeout', issues: ['Serial connection interrupted','Sensor unresponsive','Communication error'], solutions: ['1. Check USB/serial cable','2. Check sensor power LED','3. Restart sensor','4. Retry measurement','5. Restart software if persists'] },
  0x08: { code: 'PORT_ERROR', severity: 'CRITICAL', message: 'HEIGHT_PORT_ERROR - Port not connected', description: 'Height sensor port is not connected', action: 'ABORT', canRetry: false, nextStep: 'Connect height sensor and select measurement again', userMessage: '❌ HEIGHT SENSOR NOT CONNECTED\n   • Please connect height sensor via USB/Serial\n   • Check connection in menu option 2\n   • Try again after connecting', issues: ['USB cable disconnected','Serial port not opened','Sensor powered off'], solutions: ['1. Check USB cable is connected to sensor','2. Check USB cable is connected to computer','3. Power on the height sensor','4. Select option 2 to connect height sensor','5. Verify connection shows "connected"','6. Then retry measurement'] },
  0x09: { code: 'INVALID_RESPONSE', severity: 'ERROR', message: 'HEIGHT_INVALID_RESPONSE - Invalid response format', description: 'Sensor responded but with invalid data format', action: 'RETRY', canRetry: true, maxRetries: 2, waitBeforeRetry: 1000, nextStep: 'Retry measurement', userMessage: ' INVALID RESPONSE\n   • Sensor sent invalid data\n   • May be communication error\n   • Retrying measurement', issues: ['Data corruption','Serial communication error','Sensor firmware issue'], solutions: ['1. Retry measurement','2. Check USB cable quality','3. Restart sensor','4. Update sensor firmware if available','5. Contact support if persists'] },
  0x0a: { code: 'OBSTACLE_DETECTED', severity: 'WARNING', message: 'HEIGHT_OBSTACLE - Obstacle detected', description: 'Object detected in sensor measurement path', action: 'RETRY', canRetry: false, nextStep: 'Remove obstacle and retry', userMessage: '⚠️ OBSTACLE DETECTED\n   • Something blocking sensor\n   • Clear the measurement area\n   • Ensure user can stand freely\n   • Retry measurement', issues: ['Object in measurement path','User holding something','Close to wall or object'], solutions: ['1. Remove any objects near sensor','2. Ask user not to hold items','3. Ensure adequate space','4. Check sensor has clear view','5. Retry measurement'] }
}

// ──────────────────────────────────────────────────────────────────
// MEASUREMENT FREQUENCIES & MODES
// ──────────────────────────────────────────────────────────────────
export const FREQUENCIES = {
  FIVE_KHZ: 0x01,
  TEN_KHZ: 0x02,
  TWENTY_KHZ: 0x03,
  TWENTY_FIVE_KHZ: 0x04,
  FIFTY_KHZ: 0x05,
  HUNDRED_KHZ: 0x06,
  TWO_HUNDRED_KHZ: 0x07,
  TWO_FIFTY_KHZ: 0x08,
  FIVE_HUNDRED_KHZ: 0x09
}

export const IMPEDANCE_MODES = {
  STOP_TEST: 0x00,
  EIGHT_ELECTRODE_SINGLE: 0x01,
  FOUR_ELECTRODE_LEGS: 0x02,
  FOUR_ELECTRODE_ARMS: 0x03,
  EIGHT_ELECTRODE_DUAL: 0x04
}

// ──────────────────────────────────────────────────────────────────
// WEIGHT MEASUREMENT THRESHOLDS
// ──────────────────────────────────────────────────────────────────
export const WEIGHT_STABILITY_COUNT = 5      // sliding window size
export const WEIGHT_CV_THRESHOLD    = 0.01   // 1% coefficient of variation
export const WEIGHT_SD_CEILING      = 0.15   // kg — absolute guard
export const WEIGHT_MIN_VALID       = 1.0    // kg — aligned with UNDERLOAD

// ──────────────────────────────────────────────────────────────────
// HEIGHT MEASUREMENT THRESHOLDS
// ──────────────────────────────────────────────────────────────────
export const STABILITY_COUNT        = 10
export const STABILITY_THRESHOLD    = 2
export const STABILITY_SD_THRESHOLD = 1.0

// ──────────────────────────────────────────────────────────────────
// BODY COMPOSITION COLLECTION
// ──────────────────────────────────────────────────────────────────
export const BC_COLLECT_TIMEOUT_MS = 8000
