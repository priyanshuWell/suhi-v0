import fs from 'fs'
import {SerialPort} from 'serialport'
import  readline from 'readline';
import { BrowserWindow } from 'electron';
import { eventBus, EVENTS } from './eventbus';
export let serialPort = null;
export let heightPort = null;
export let biaPort = null;
let heightResponseTimeout = null;
export const IS_ELECTRON = true;
let heightCompleted = false;
let weightCompleted = false;
// ================================================================
// GLOBAL ERROR HANDLER - BMH05108 PROTOCOL
// ================================================================

export const IMPEDANCE_ERROR_CODES = {
    0x00: {
        code: 'NULL',
        severity: 'INFO',
        message: 'BIA_NULL - Null state',
        description: 'Device has not received measurement request',
        action: 'INFO',
        canRetry: false,
        nextStep: 'Continue with measurement',
        userMessage: 'Device not initialized - measurement ready to start'
    },
    0x01: {
        code: 'CHECK_ELECTRODE',
        severity: 'CRITICAL',
        message: 'BIA_CHECK_ELECTRODE - Checking electrode contact',
        description: 'Device detected electrode contact problem',
        action: 'ABORT',
        canRetry: false,
        nextStep: 'Stop measurement and check electrodes',
        userMessage: 'CRITICAL: ELECTRODE PROBLEM DETECTED!\n   • Check all electrode connections\n   • Ensure electrodes are firmly attached\n   • Clean electrode pads\n   • Verify no loose wires',
        causes: [
            'Electrode not properly connected',
            'Loose electrode contact',
            'Poor skin contact',
            'Broken electrode pad'
        ],
        solutions: [
            '1. Inspect all electrodes visually',
            '2. Reseat each electrode firmly',
            '3. Clean electrode pads with alcohol',
            '4. Check for bent pins/connectors',
            '5. Try replacement electrode pads',
            '6. Restart measurement'
        ]
    },
    0x02: {
        code: 'MEASURE',
        severity: 'INFO',
        message: 'BIA_MEASURE - Measurement in progress',
        description: 'Device is currently measuring - wait for completion',
        action: 'WAIT',
        canRetry: false,
        nextStep: 'Wait for measurement to complete',
        userMessage: 'Device is measuring... Please wait',
        waitTime: 3000
    },
    0x03: {
        code: 'SUCCESS',
        severity: 'SUCCESS',
        message: 'BIA_SUCCESS - Measurement successful',
        description: 'Device measurement completed successfully',
        action: 'ACCEPT',
        canRetry: false,
        nextStep: 'Accept measurement and continue',
        userMessage: 'Impedance measurement successful',
        expectation: 'Data is valid and ready to use'
    },
    0x04: {
        code: 'ERROR_RANGER',
        severity: 'ERROR',
        message: 'BIA_ERROR_RANGER - Impedance out of range (10-1600Ω)',
        description: 'Measured value is outside acceptable range',
        action: 'RETRY',
        canRetry: true,
        maxRetries: 3,
        waitBeforeRetry: 2000,
        nextStep: 'Retry measurement with corrected conditions',
        userMessage: 'MEASUREMENT OUT OF RANGE | Impedance value is outside valid range\n   • Check electrode contact quality\n   • Verify skin contact\n   • Adjust electrode placement',
        issues: [
            'Impedance too low (short circuit)',
            'Impedance too high (poor contact)',
            'Invalid measurement'
        ],
        solutions: [
            '1. Check electrode contact pressure',
            '2. Ensure skin is clean and slightly moist',
            '3. Reposition electrodes if needed',
            '4. Apply conductive gel if dry',
            '5. Dry skin if wet',
            '6. Retry measurement'
        ]
    },
    0x05: {
        code: 'ERROR_REPEAT',
        severity: 'ERROR',
        message: 'BIA_ERROR_REPEAT - Abnormal data detected',
        description: 'Device detected abnormal data, measurement failed',
        action: 'RETRY',
        canRetry: true,
        maxRetries: 3,
        waitBeforeRetry: 2000,
        nextStep: 'Retry the impedance measurement',
        userMessage: 'Device detected abnormal data, Please Hold The Electrode Properly!',
        issues: [
            'Electrode connection lost during measurement',
            'User moved during measurement',
            'Sensor malfunction'
        ],
        solutions: [
            '1. Ensure user is still for measurement',
            '2. Check all electrode connections',
            '3. Retry measurement',
            '4. If persists, restart device'
        ]
    },
    0x06: {
        code: 'USER_EXIT',
        severity: 'INFO',
        message: 'BIA_USER_EXIT - User stopped measurement',
        description: 'User cancelled the measurement',
        action: 'CANCEL',
        canRetry: false,
        nextStep: 'Can retry measurement anytime',
        userMessage: 'Measurement cancelled by user',
        expectation: 'Ready to restart measurement'
    }
};

export const WEIGHT_ERROR_CODES = {
    0x00: {
        code: 'NULL',
        severity: 'INFO',
        message: 'WEIGHT_NULL - Null state',
        description: 'Scale has not received measurement request',
        action: 'INFO',
        canRetry: false,
        nextStep: 'Continue with weight measurement',
        userMessage: 'Scale not initialized - measurement ready to start'
    },
    0x01: {
        code: 'ZERO_POINT',
        severity: 'WARNING',
        message: 'WEIGHT IS ZERO DETECTED',
        description: 'Scale is currently empty or reading zero.',
        action: 'WAIT',
        canRetry: false,
        nextStep: 'Accept zero reading (empty scale confirmed)',
        userMessage: '⚖️ Scale reading: 0 kg (Empty scale)',
        expectation: 'No weight on scale'
    },
    0x02: {
        code: 'UNSTABLE',
        severity: 'WARNING',
        message: 'WEIGHT_UNSTABLE - Unstable reading',
        description: 'Weight reading is fluctuating',
        action: 'WAIT',
        canRetry: false,
        nextStep: 'Wait for weight to stabilize',
        userMessage: '⏳ Weight is unstable, please wait...',
        waitTime: 2000,
        causes: [
            'User moving on scale',
            'Scale still settling',
            'Wind or vibration',
            'Scale needs stabilization'
        ],
        solutions: [
            '1. Keep user still on scale',
            '2. Wait 2-3 seconds for settling',
            '3. Ensure scale is on level surface',
            '4. Remove any vibration sources',
            '5. Retry measurement'
        ]
    },
    0x03: {
        code: 'STABLE',
        severity: 'SUCCESS',
        message: 'WEIGHT_STABLE - Stable weight reading',
        description: 'Weight measurement is stable and valid',
        action: 'ACCEPT',
        canRetry: false,
        nextStep: 'Accept weight measurement and continue',
        userMessage: '✅ Weight measurement stable and valid',
        expectation: 'Data is valid and ready to use'
    },
    0x04: {
        code: 'OVERLOAD',
        severity: 'ERROR',
        message: 'WEIGHT_OVERLOAD - Scale overloaded',
        description: 'Measured weight exceeds scale maximum capacity',
        action: 'ABORT',
        canRetry: false,
        nextStep: 'Remove weight and retry',
        userMessage: '⚠️ SCALE OVERLOADED! Remove weight from scale and Retry measurement',
        maxCapacity: 150,  // kg
        issues: [
            'Weight exceeds 150 kg',
            'Multiple people on scale',
            'Scale needs recalibration'
        ],
        solutions: [
            '1. Remove all weight from scale',
            '2. Check if weight is within 0-150 kg range',
            '3. Ensure only one person on scale',
            '4. Wait for scale to zero',
            '5. Retry measurement',
            '6. If persists, recalibrate scale'
        ]
    },
    0x05: {
        code: 'UNDERLOAD',
        severity: 'WARNING',
        message: 'WEIGHT_UNDERLOAD - Weight too low',
        description: 'Measured weight is below minimum threshold',
        action: 'RETRY',
        canRetry: true,
        maxRetries: 2,
        waitBeforeRetry: 1500,
        nextStep: 'Retry measurement after weight stabilization',
        userMessage: '⚠️ WEIGHT TOO LOW|Ensure proper contact with scale',
        minThreshold: 1.0,  // kg
        issues: [
            'User not properly on scale',
            'Poor contact with scale',
            'Scale needs zeroing'
        ],
        solutions: [
            '1. Ensure user stands firmly on scale',
            '2. Check all feet contact scale platform',
            '3. Wait 2-3 seconds for settling',
            '4. Remove shoes if very light',
            '5. Retry measurement'
        ]
    },
    0x06: {
        code: 'CALIBRATION_ERROR',
        severity: 'ERROR',
        message: 'WEIGHT_CALIBRATION_ERROR - Calibration mismatch',
        description: 'Calibration factor appears incorrect',
        action: 'RETRY',
        canRetry: true,
        maxRetries: 1,
        waitBeforeRetry: 1000,
        nextStep: 'Retry measurement, consider recalibration',
        userMessage: 'CALIBRATION ERROR\n   • Reading seems incorrect\n   • Please retry measurement\n   • If persistent, run calibration',
        issues: [
            'Calibration factor incorrect',
            'Scale has drifted',
            'Temperature change'
        ],
        solutions: [
            '1. Retry measurement on empty scale (should be 0 kg)',
            '2. Retry with known weight',
            '3. If reading is off, run calibration (case 15)',
            '4. Check scale is on level surface',
            '5. Contact support if persists'
        ]
    },
    0x07: {
        code: 'SENSOR_ERROR',
        severity: 'CRITICAL',
        message: 'WEIGHT_SENSOR_ERROR - Sensor malfunction',
        description: 'Scale sensor is not responding correctly',
        action: 'ABORT',
        canRetry: false,
        nextStep: 'Check scale hardware, may need service',
        userMessage: 'SCALE SENSOR ERROR\n   • Scale sensor not responding\n   • Hardware may be faulty\n   • Contact support or service scale',
        issues: [
            'Sensor disconnected',
            'Sensor malfunction',
            'Scale hardware failure'
        ],
        solutions: [
            '1. Check power to scale',
            '2. Verify USB/serial connection',
            '3. Restart scale (power cycle)',
            '4. Restart software',
            '5. If persists, scale needs service'
        ]
    },
    0x08: {
        code: 'TIMEOUT',
        severity: 'ERROR',
        message: 'WEIGHT_TIMEOUT - Measurement timeout',
        description: 'Scale did not respond to measurement query',
        action: 'RETRY',
        canRetry: true,
        maxRetries: 3,
        waitBeforeRetry: 2000,
        nextStep: 'Retry measurement',
        userMessage: 'Be On Scale! Retrying measurement',
        issues: [
            'Serial connection interrupted',
            'Scale unresponsive',
            'Communication error'
        ],
        solutions: [
            '1. Check USB/serial cable connection',
            '2. Check scale power LED',
            '3. Restart scale',
            '4. Retry measurement',
            '5. Restart software if persists'
        ]
    },
    0x09: {
        code: 'PORT_ERROR',
        severity: 'CRITICAL',
        message: 'WEIGHT_PORT_ERROR - Port not connected',
        description: 'Weight port (scale) is not connected',
        action: 'ABORT',
        canRetry: false,
        nextStep: 'Connect scale and select measurement again',
        userMessage: 'SCALE NOT CONNECTED\n   • Please connect scale via USB/Serial\n   • Check connection in menu option 3\n   • Try again after connecting',
        issues: [
            'USB cable disconnected',
            'Serial port not opened',
            'Scale powered off'
        ],
        solutions: [
            '1. Check USB cable is connected to scale',
            '2. Check USB cable is connected to computer',
            '3. Power on the scale',
            '4. Select option 3 to connect weight scale',
            '5. Verify connection shows "connected"',
            '6. Then retry measurement'
        ]
    },
    0x0A: {
        code: 'INVALID_RESPONSE',
        severity: 'ERROR',
        message: 'WEIGHT_INVALID_RESPONSE - Invalid response format',
        description: 'Scale responded but with invalid data format',
        action: 'RETRY',
        canRetry: true,
        maxRetries: 2,
        waitBeforeRetry: 1000,
        nextStep: 'Retry measurement',
        userMessage: 'Scale sent invalid data, Retrying measurement...',
        issues: [
            'Data corruption',
            'Serial communication error',
            'Scale firmware issue'
        ],
        solutions: [
            '1. Retry measurement',
            '2. Check USB cable quality',
            '3. Restart scale',
            '4. Update scale firmware if available',
            '5. Contact support if persists'
        ]
    }
};

export const HEIGHT_ERROR_CODES = {
    0x00: {
        code: 'NULL',
        severity: 'INFO',
        message: 'HEIGHT_NULL - Null state',
        description: 'Height sensor has not received measurement request',
        action: 'INFO',
        canRetry: false,
        nextStep: 'Continue with height measurement',
        userMessage: 'Measurement ready to start!'
    },
    0x01: {
        code: 'OUT_OF_RANGE_LOW',
        severity: 'ERROR',
        message: 'HEIGHT_OUT_OF_RANGE_LOW - Height too low',
        description: 'Height is below minimum range (< 80 cm)',
        action: 'RETRY',
        canRetry: true,
        maxRetries: 2,
        waitBeforeRetry: 1500,
        nextStep: 'Check user height and retry',
        userMessage: 'HEIGHT OUT OF RANGE (TOO LOW)',
        minHeight: 80,  // cm
        issues: [
            'User not standing straight',
            'Sensor not aligned',
            'Child measurement (< 80 cm normal)',
            'Sensor malfunction'
        ],
        solutions: [
            '1. Ask user to stand straight',
            '2. Ensure feet are flat on ground',
            '3. Check sensor is at correct height',
            '4. Check sensor alignment',
            '5. Retry measurement',
            '6. If user is child, this is normal'
        ]
    },
    0x02: {
        code: 'OUT_OF_RANGE_HIGH',
        severity: 'ERROR',
        message: 'HEIGHT_OUT_OF_RANGE_HIGH - Height too high',
        description: 'Height exceeds maximum range (> 250 cm)',
        action: 'RETRY',
        canRetry: true,
        maxRetries: 2,
        waitBeforeRetry: 1500,
        nextStep: 'Check user height and retry',
        userMessage: 'HEIGHT OUT OF RANGE (TOO HIGH)',
        maxHeight: 250,  // cm
        issues: [
            'User standing on object',
            'Sensor misaligned',
            'Sensor malfunction',
            'False reading'
        ],
        solutions: [
            '1. Ask user to step down if on anything',
            '2. Check user standing on flat ground',
            '3. Check sensor is properly aligned',
            '4. Verify height is realistic',
            '5. Retry measurement',
            '6. Check for obstructions'
        ]
    },
    0x03: { 
        code: 'UNSTABLE',
        severity: 'WARNING',
        message: 'HEIGHT_UNSTABLE - Unstable reading',
        description: 'Height reading is fluctuating',
        action: 'WAIT',
        canRetry: false,
        nextStep: 'Wait for reading to stabilize',
        userMessage: 'We are measuring your Height, Please wait...',
        waitTime: 2000,
        causes: [
            'User moving',
            'Sensor settling',
            'Vibrations',
            'Air currents affecting sensor'
        ],
        solutions: [
            '1. Ask user to stand still',
            '2. Remove any moving objects',
            '3. Avoid air vents or fans',
            '4. Wait 2-3 seconds',
            '5. Retry measurement'
        ]
    },
    0x04: {
        code: 'STABLE',
        severity: 'SUCCESS',
        message: 'HEIGHT_STABLE - Stable height reading',
        description: 'Height measurement is stable and valid',
        action: 'ACCEPT',
        canRetry: false,
        nextStep: 'Accept height measurement and continue',
        userMessage: '✅ Height measurement stable and valid',
        expectation: 'Data is valid and ready to use'
    },
    0x05: {
        code: 'SENSOR_ERROR',
        severity: 'CRITICAL',
        message: 'HEIGHT_SENSOR_ERROR - Sensor malfunction',
        description: 'Height sensor is not responding correctly',
        action: 'ABORT',
        canRetry: false,
        nextStep: 'Check sensor hardware, may need service',
        userMessage: ' HEIGHT SENSOR ERROR\n   • Sensor not responding\n   • Hardware may be faulty\n   • Contact support or service sensor',
        issues: [
            'Sensor disconnected',
            'Sensor malfunction',
            'Hardware failure'
        ],
        solutions: [
            '1. Check power to sensor',
            '2. Verify USB/serial connection',
            '3. Check sensor cable',
            '4. Restart sensor',
            '5. If persists, sensor needs service'
        ]
    },
    0x06: {
        code: 'CALIBRATION_ERROR',
        severity: 'ERROR',
        message: 'HEIGHT_CALIBRATION_ERROR - Calibration mismatch',
        description: 'Height sensor calibration appears incorrect',
        action: 'RETRY',
        canRetry: true,
        maxRetries: 1,
        waitBeforeRetry: 1000,
        nextStep: 'Retry measurement, consider recalibration',
        userMessage: 'CALIBRATION ERROR\n   • Reading seems incorrect\n   • Please retry measurement\n   • If persistent, recalibrate sensor',
        issues: [
            'Calibration offset incorrect',
            'Sensor has drifted',
            'Temperature change'
        ],
        solutions: [
            '1. Retry measurement',
            '2. Use reference height to verify',
            '3. If off, recalibrate sensor',
            '4. Check sensor is vertical',
            '5. Contact support if persists'
        ]
    },
    0x07: {
        code: 'TIMEOUT',
        severity: 'ERROR',
        message: 'MEASUREMENT_TIMEOUT - Measurement timeout',
        description: 'Height sensor did not respond to query',
        action: 'RETRY',
        canRetry: true,
        maxRetries: 3,
        waitBeforeRetry: 2000,
        nextStep: 'Retry measurement',
        userMessage: 'Sensor did not respond | Measurement timeout',
        issues: [
            'Serial connection interrupted',
            'Sensor unresponsive',
            'Communication error'
        ],
        solutions: [
            '1. Check USB/serial cable',
            '2. Check sensor power LED',
            '3. Restart sensor',
            '4. Retry measurement',
            '5. Restart software if persists'
        ]
    },
    0x08: {
        code: 'PORT_ERROR',
        severity: 'CRITICAL',
        message: 'HEIGHT_PORT_ERROR - Port not connected',
        description: 'Height sensor port is not connected',
        action: 'ABORT',
        canRetry: false,
        nextStep: 'Connect height sensor and select measurement again',
        userMessage: '❌ HEIGHT SENSOR NOT CONNECTED\n   • Please connect height sensor via USB/Serial\n   • Check connection in menu option 2\n   • Try again after connecting',
        issues: [
            'USB cable disconnected',
            'Serial port not opened',
            'Sensor powered off'
        ],
        solutions: [
            '1. Check USB cable is connected to sensor',
            '2. Check USB cable is connected to computer',
            '3. Power on the height sensor',
            '4. Select option 2 to connect height sensor',
            '5. Verify connection shows "connected"',
            '6. Then retry measurement'
        ]
    },
    0x09: {
        code: 'INVALID_RESPONSE',
        severity: 'ERROR',
        message: 'HEIGHT_INVALID_RESPONSE - Invalid response format',
        description: 'Sensor responded but with invalid data format',
        action: 'RETRY',
        canRetry: true,
        maxRetries: 2,
        waitBeforeRetry: 1000,
        nextStep: 'Retry measurement',
        userMessage: ' INVALID RESPONSE\n   • Sensor sent invalid data\n   • May be communication error\n   • Retrying measurement',
        issues: [
            'Data corruption',
            'Serial communication error',
            'Sensor firmware issue'
        ],
        solutions: [
            '1. Retry measurement',
            '2. Check USB cable quality',
            '3. Restart sensor',
            '4. Update sensor firmware if available',
            '5. Contact support if persists'
        ]
    },
    0x0A: {
        code: 'OBSTACLE_DETECTED',
        severity: 'WARNING',
        message: 'HEIGHT_OBSTACLE - Obstacle detected',
        description: 'Object detected in sensor measurement path',
        action: 'RETRY',
        canRetry: false,
        nextStep: 'Remove obstacle and retry',
        userMessage: '⚠️ OBSTACLE DETECTED\n   • Something blocking sensor\n   • Clear the measurement area\n   • Ensure user can stand freely\n   • Retry measurement',
        issues: [
            'Object in measurement path',
            'User holding something',
            'Close to wall or object'
        ],
        solutions: [
            '1. Remove any objects near sensor',
            '2. Ask user not to hold items',
            '3. Ensure adequate space',
            '4. Check sensor has clear view',
            '5. Retry measurement'
        ]
    }
};



class ImprovedImpedanceStatusHandler {
    /**
     * Handle impedance status code with comprehensive error information
     */
    static handleImpedanceStatus(statusCode, attemptNumber = 1) {
        try {
            // Validate status code
            if (!IMPEDANCE_ERROR_CODES[statusCode]) {
                return this.handleUnknownStatus(statusCode);
            }

            const errorInfo = IMPEDANCE_ERROR_CODES[statusCode];

            // Display error information
            this.displayErrorInfo(errorInfo, attemptNumber);

            // Return decision object
            return {
                code: statusCode,
                ...errorInfo,
                decision: this.makeDecision(errorInfo, attemptNumber)
            };

        } catch (error) {
            console.error('Error handling impedance status:', error.message);
            return {
                code: statusCode,
                error: error.message,
                action: 'ERROR'
            };
        }
    }

    /**
     * Display formatted error information
     */
    static displayErrorInfo(errorInfo, attemptNumber) {
        console.log('\n' + '='.repeat(70));
        console.log(` ${errorInfo.message}`);
        console.log('='.repeat(70));

        // Show severity
        const severityEmoji = {
            'CRITICAL': '❌',
            'ERROR': '❌',
            'WARNING': '⚠️',
            'INFO': 'ℹ️',
            'SUCCESS': '✅'
        };

        console.log(`\nSeverity: ${severityEmoji[errorInfo.severity]} ${errorInfo.severity}`);
        console.log(`Status Code: 0x${errorInfo.code.charCodeAt(0).toString(16).toUpperCase()} (${errorInfo.code})`);

        if (attemptNumber > 1) {
            console.log(`Attempt: ${attemptNumber}`);
        }

        // Show description
        console.log(`\nDescription: ${errorInfo.description}`);

        // Show user-friendly message
        if (errorInfo.userMessage) {
            console.log(`\nMessage:\n${errorInfo.userMessage}`);
        }

        // Show causes if critical or error
        if (errorInfo.severity === 'CRITICAL' || errorInfo.severity === 'ERROR') {
            if (errorInfo.causes && errorInfo.causes.length > 0) {
                console.log(`\n Possible Causes:`);
                errorInfo.causes.forEach((cause, idx) => {
                    console.log(`   ${idx + 1}. ${cause}`);
                });
            }

            if (errorInfo.solutions && errorInfo.solutions.length > 0) {
                console.log(`\n✅ Recommended Solutions:`);
                errorInfo.solutions.forEach((solution) => {
                    console.log(`   ${solution}`);
                });
            }
        }

        // Show next step
        console.log(`\nNext Step: ${errorInfo.nextStep}`);

        if (errorInfo.canRetry) {
            console.log(`   Retry Capability: YES (Max ${errorInfo.maxRetries} attempts)`);
            console.log(`   Wait Before Retry: ${errorInfo.waitBeforeRetry / 1000} seconds`);
        }

        console.log('\n' + '='.repeat(70) + '\n');
    }

    /**
     * Handle unknown status code
     */
    static handleUnknownStatus(statusCode) {
        console.log(`\nUNKNOWN IMPEDANCE STATUS: 0x${statusCode.toString(16).toUpperCase()}`);
        console.log(`This status code is not recognized in the protocol.`);
        console.log(`Please check device documentation or verify the response data.\n`);

        return {
            code: statusCode,
            severity: 'ERROR',
            message: `Unknown impedance status: 0x${statusCode.toString(16).toUpperCase()}`,
            action: 'ERROR',
            canRetry: false,
            decision: {
                shouldRetry: false,
                shouldAbort: true,
                isCritical: true
            }
        };
    }

    /**
     * Make decision based on error code
     */
    static makeDecision(errorInfo, attemptNumber) {
        return {
            shouldRetry: errorInfo.canRetry,
            shouldAbort: errorInfo.action === 'ABORT' || errorInfo.action === 'CANCEL',
            shouldWait: errorInfo.action === 'WAIT',
            shouldAccept: errorInfo.action === 'ACCEPT',
            isCritical: errorInfo.severity === 'CRITICAL',
            isSuccess: errorInfo.severity === 'SUCCESS',
            waitTime: errorInfo.waitTime || errorInfo.waitBeforeRetry || 0,
            maxRetriesReached: attemptNumber >= errorInfo.maxRetries,
            action: errorInfo.action,
            attemptNumber: attemptNumber
        };
    }

    /**
     * Handle retry logic
     */
    static async handleRetry(statusCode, currentAttempt, maxAttempts) {
        const errorInfo = IMPEDANCE_ERROR_CODES[statusCode];

        if (!errorInfo || !errorInfo.canRetry) {
            return {
                shouldRetry: false,
                reason: 'Retry not allowed for this error'
            };
        }

        if (currentAttempt >= maxAttempts) {
            return {
                shouldRetry: false,
                reason: `Maximum retry attempts (${maxAttempts}) reached`
            };
        }

        const waitTime = errorInfo.waitBeforeRetry || 2000;

        console.log(`\nRetrying measurement in ${waitTime / 1000} seconds...`);
        console.log(`   Attempt ${currentAttempt + 1} of ${maxAttempts}`);

        await new Promise(resolve => setTimeout(resolve, waitTime));

        return {
            shouldRetry: true,
            nextAttempt: currentAttempt + 1,
            waitTime: waitTime
        };
    }

    /**
     * Display error statistics
     */
    static displayErrorStatistics(errorCounts) {
        console.log('\n' + '='.repeat(70));
        console.log('ERROR STATISTICS');
        console.log('='.repeat(70));

        let totalErrors = 0;
        const sortedCodes = Object.keys(errorCounts).sort();

        sortedCodes.forEach(code => {
            const count = errorCounts[code];
            if (count > 0) {
                const errorInfo = IMPEDANCE_ERROR_CODES[code];
                const message = errorInfo ? errorInfo.code : `Unknown (0x${code})`;
                console.log(`   0x${code}: ${message.padEnd(20)} - ${count} occurrence(s)`);
                totalErrors += count;
            }
        });

        console.log(`\nTotal Errors: ${totalErrors}`);
        console.log('='.repeat(70) + '\n');
    }
}


class BIAError extends Error {
    constructor(message, severity = 'ERROR', code = null) {
        super(message);
        this.name = 'BIAError';
        this.severity = severity;
        this.code = code;
        this.timestamp = new Date().toISOString();
    }
}

class ErrorStats {
    constructor() {
        this.total = 0;
        this.successes = 0;
        this.errors = 0;
        this.warnings = 0;
        this.infos = 0;
    }
    record(severity) {
        this.total++;
        if (severity === 'SUCCESS') this.successes++;
        else if (severity === 'ERROR') this.errors++;
        else if (severity === 'WARNING') this.warnings++;
        else if (severity === 'INFO') this.infos++;
    }
    print() {
        console.log('\n' + '='.repeat(60));
        console.log('ERROR STATISTICS');
        console.log('='.repeat(60));
        console.log(`Total: ${this.total} | ✅ ${this.successes} | ❌ ${this.errors} | ⚠️ ${this.warnings} | ℹ️ ${this.infos}`);
        console.log('='.repeat(60) + '\n');
    }
}

const errorStats = new ErrorStats();

export function handleError(code, message, severity = 'ERROR') {
    let icon = '❌';
    if (severity === 'SUCCESS') icon = '✅';
    else if (severity === 'WARNING') icon = '⚠️';
    else if (severity === 'INFO') icon = 'ℹ️';

    console.log(`${icon} [${severity}] ${message}`);
    errorStats.record(severity);
    return new BIAError(message, severity, code);
}

export function handleHeightStatus(statusCode, height = null) {
    const errorInfo = HEIGHT_ERROR_CODES[statusCode];

    if (!errorInfo) {
        console.log(`⚠️ Unknown height status code: 0x${statusCode.toString(16)}`);
        return;
    }
errorInfo
    console.log('\n' + '='.repeat(70));
    console.log(`📏 HEIGHT MEASUREMENT STATUS`);
    console.log('='.repeat(70));

    console.log(`\nStatus: ${errorInfo.message}`);
    console.log(`Severity: ${errorInfo.severity}`);
    console.log(`Action: ${errorInfo.action}`);

    if (height !== null && height !== undefined) {
        console.log(`Height: ${height.toFixed(1)} cm`);
    }

    console.log(`\n${errorInfo.userMessage}`);

    if (errorInfo.issues) {
        console.log(`\nPossible Causes:`);
        errorInfo.issues.forEach((issue, idx) => {
            console.log(`   ${idx + 1}. ${issue}`);
        });
    }

    if (errorInfo.solutions) {
        console.log(`\nRecommended Solutions:`);
        errorInfo.solutions.forEach(solution => {
            console.log(`   ${solution}`);
        });
    }

    console.log('='.repeat(70) + '\n');
    console.log("RETURNING THE ERROR!!")
    return  errorInfo
}

export function handleWeightStatus(statusCode, weight = null) {
    const errorInfo = WEIGHT_ERROR_CODES[statusCode];

    if (!errorInfo) {
        console.log(`⚠️ Unknown weight status code: 0x${statusCode.toString(16)}`);
        return;
    }

    console.log('\n' + '='.repeat(70));
    console.log(`📊 WEIGHT MEASUREMENT STATUS`);
    console.log('='.repeat(70));

    console.log(`\nStatus: ${errorInfo.message}`);
    console.log(`Severity: ${errorInfo.severity}`);
    console.log(`Action: ${errorInfo.action}`);

    if (weight !== null && weight !== undefined) {
        console.log(`Weight: ${weight.toFixed(2)} kg`);
    }

    console.log(`\n${errorInfo.userMessage}`);

    if (errorInfo.issues) {
        console.log(`\nPossible Causes:`);
        errorInfo.issues.forEach((issue, idx) => {
            console.log(`   ${idx + 1}. ${issue}`);
        });
    }

    if (errorInfo.solutions) {
        console.log(`\nRecommended Solutions:`);
        errorInfo.solutions.forEach(solution => {
            console.log(`   ${solution}`);
        });
    }

    console.log('='.repeat(70) + '\n');
    return errorInfo
}





// ================================================================
// END ERROR HANDLER
// ================================================================

// Create readline interface for CLI
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const FREQUENCIES = {
    FIVE_KHZ: 0x01,
    TEN_KHZ: 0x02,
    TWENTY_KHZ: 0x03,
    TWENTY_FIVE_KHZ: 0x04,
    FIFTY_KHZ: 0x05,
    HUNDRED_KHZ: 0x06,
    TWO_HUNDRED_KHZ: 0x07,
    TWO_FIFTY_KHZ: 0x08,
    FIVE_HUNDRED_KHZ: 0x09
};

const IMPEDANCE_MODES = {
    STOP_TEST: 0x00,
    EIGHT_ELECTRODE_SINGLE: 0x01,
    FOUR_ELECTRODE_LEGS: 0x02,
    FOUR_ELECTRODE_ARMS: 0x03,
    EIGHT_ELECTRODE_DUAL: 0x04
};

// ======================== HEIGHT MEASUREMENT ========================
const STABILITY_COUNT = 10;
const STABILITY_THRESHOLD = 2;
export let stableReadings = [];
export let isMeasurementStopped = false;
let heightBuffer = Buffer.alloc(0);
let impedance20kHzResults = null;
let impedance100kHzResults = null;
export let finalweight = null;
export let finalheight = null;

const READ_CMD = Buffer.from([0x55, 0xaa, 0x01, 0x01, 0x01]);

function verifyChecksum(frame) {
    let sum = 0;
    for (let i = 0; i < 6; i++) sum += frame[i];
    return (sum & 0xff) === frame[6];
}

function parseDistance(frame) {
    return (frame[4] << 8) + frame[5];
}

function checkStability(value) {
    stableReadings.push(value);

    if (stableReadings.length > STABILITY_COUNT) {
        stableReadings.shift();
    }

    const max = Math.max(...stableReadings);
    const min = Math.min(...stableReadings);

    return max - min <= STABILITY_THRESHOLD;
}

// ======================== BIA FUNCTIONS ========================
// Calculate checksum for BMH05108 protocol
function calculateChecksum(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i];
    }
    // Checksum = ~(sum) + 1 (two's complement)
    return (~sum + 1) & 0xFF;
}


// Create BMH05108 command packet
function createCommand(commandByte, dataBytes = []) {
    const frameLength = 4 + dataBytes.length;
    const buffer = Buffer.alloc(frameLength);

    buffer[0] = 0x55;
    buffer[1] = frameLength;
    buffer[2] = commandByte;

    for (let i = 0; i < dataBytes.length; i++) {
        buffer[3 + i] = dataBytes[i];
    }

    const checksumData = buffer.slice(0, frameLength - 1);
    buffer[frameLength - 1] = calculateChecksum(checksumData);

    return buffer;
}

// Create 8-electrode body composition command (0xD0)
export function create8ElectrodeBodyCompositionCommand(gender, height, age, weight,
    rh20, lh20, tr20, rf20, lf20, rh100, lh100, tr100, rf100, lf100) {

    const buffer = Buffer.alloc(39);

    buffer[0] = 0x55;
    buffer[1] = 0x27;
    buffer[2] = 0xD0;
    buffer[3] = gender & 0xFF;
    buffer[4] = 0x00;
    buffer[5] = height & 0xFF;
    buffer[6] = age & 0xFF;

    const weightInt = Math.round(weight * 10);
    buffer.writeUInt16LE(weightInt, 7);

    buffer.writeUInt16LE(Math.round(rh20 * 10), 9);
    buffer.writeUInt16LE(Math.round(lh20 * 10), 11);
    buffer.writeUInt16LE(Math.round(tr20 * 10), 13);
    buffer.writeUInt16LE(Math.round(rf20 * 10), 15);
    buffer.writeUInt16LE(Math.round(lf20 * 10), 17);

    buffer.writeUInt16LE(Math.round(rh100 * 10), 19);
    buffer.writeUInt16LE(Math.round(lh100 * 10), 21);
    buffer.writeUInt16LE(Math.round(tr100 * 10), 23);
    buffer.writeUInt16LE(Math.round(rf100 * 10), 25);
    buffer.writeUInt16LE(Math.round(lf100 * 10), 27);

    for (let i = 29; i < 38; i++) {
        buffer[i] = 0x00;
    }

    const checksumData = buffer.slice(0, 38);
    buffer[38] = calculateChecksum(checksumData);

    return buffer;
}


// Get available serial ports
export async function getPorts() {
    try {
        const ports = await SerialPort.list();
        console.log('\n Available Serial Ports:');
        console.log('========================');
        if (ports.length === 0) {
            console.log('No serial ports found!');
        } else {
            ports.forEach((port, index) => {
                console.log(`${index + 1}. ${port.path}`);
                if (port.manufacturer) console.log(`   Manufacturer: ${port.manufacturer}`);
                if (port.serialNumber) console.log(`   Serial Number: ${port.serialNumber}`);
                console.log('');
            });
        }
        return ports;
    } catch (error) {
        console.error(' Error listing ports:', error.message);
        return [];
    }
}


export function parseBodyCompositionResponse(data) {

    console.log('Parsing Body Composition Response:');
    console.log(`Full Response Length: ${data.length}`);
    console.log(`First Byte: 0x${data[0].toString(16).toUpperCase()}`);
    console.log(`Second Byte: 0x${data[1].toString(16).toUpperCase()}`);
    console.log(`Third Byte: 0x${data[2].toString(16).toUpperCase()}`);
    console.log(`Fourth Byte: 0x${data[3].toString(16).toUpperCase()}`);
    // Validate response
    if (data[0] !== 0xAA || data[2] !== 0xD0) {
        console.log('❌ Invalid body composition response');
        return null;
    }


    const parsePackages = {
        // Package 1: Whole Body Composition (page 15-16)
        1: (data) => ({
            bodyWeight: ((data[5] & 0xFF) | ((data[6] & 0xFF) << 8)) / 10,
            bodyWeightStandardMin: ((data[7] & 0xFF) | ((data[8] & 0xFF) << 8)) / 10,
            bodyWeightStandardMax: ((data[9] & 0xFF) | ((data[10] & 0xFF) << 8)) / 10,

            moistureContent: ((data[11] & 0xFF) | ((data[12] & 0xFF) << 8)) / 10,
            moistureContentStandardMin: ((data[13] & 0xFF) | ((data[14] & 0xFF) << 8)) / 10,
            moistureContentStandardMax: ((data[15] & 0xFF) | ((data[16] & 0xFF) << 8)) / 10,

            bodyFatMass: ((data[17] & 0xFF) | ((data[18] & 0xFF) << 8)) / 10,
            bodyFatMassStandardMin: ((data[19] & 0xFF) | ((data[20] & 0xFF) << 8)) / 10,
            bodyFatMassStandardMax: ((data[21] & 0xFF) | ((data[22] & 0xFF) << 8)) / 10,

            proteinMass: ((data[23] & 0xFF) | ((data[24] & 0xFF) << 8)) / 10,
            proteinMassStandardMin: ((data[25] & 0xFF) | ((data[26] & 0xFF) << 8)) / 10,
            proteinMassStandardMax: ((data[27] & 0xFF) | ((data[28] & 0xFF) << 8)) / 10,

            inorganicSaltMass: ((data[29] & 0xFF) | ((data[30] & 0xFF) << 8)) / 10,
            inorganicSaltMassStandardMin: ((data[31] & 0xFF) | ((data[32] & 0xFF) << 8)) / 10,
            inorganicSaltMassStandardMax: ((data[33] & 0xFF) | ((data[34] & 0xFF) << 8)) / 10,

            leanBodyWeight: ((data[35] & 0xFF) | ((data[36] & 0xFF) << 8)) / 10,
            leanBodyWeightStandardMin: ((data[37] & 0xFF) | ((data[38] & 0xFF) << 8)) / 10,
            leanBodyWeightStandardMax: ((data[39] & 0xFF) | ((data[40] & 0xFF) << 8)) / 10,

            muscleMass: ((data[41] & 0xFF) | ((data[42] & 0xFF) << 8)) / 10,
            muscleMassStandardMin: ((data[43] & 0xFF) | ((data[44] & 0xFF) << 8)) / 10,
            muscleMassStandardMax: ((data[45] & 0xFF) | ((data[46] & 0xFF) << 8)) / 10,

            boneMass: ((data[47] & 0xFF) | ((data[48] & 0xFF) << 8)) / 10,
            boneMassStandardMin: ((data[49] & 0xFF) | ((data[50] & 0xFF) << 8)) / 10,
            boneMassStandardMax: ((data[51] & 0xFF) | ((data[52] & 0xFF) << 8)) / 10,

            skeletalMuscleMass: ((data[53] & 0xFF) | ((data[54] & 0xFF) << 8)) / 10,
            skeletalMuscleMassStandardMin: ((data[55] & 0xFF) | ((data[56] & 0xFF) << 8)) / 10,
            skeletalMuscleMassStandardMax: ((data[57] & 0xFF) | ((data[58] & 0xFF) << 8)) / 10,
            intracellularWaterVolume: ((data[59] & 0xFF) | ((data[60] & 0xFF) << 8)) / 10,
            intracellularWaterVolumeMin: ((data[61] & 0xFF) | ((data[62] & 0xFF) << 8)) / 10,
            intracellularWaterVolumeMax: ((data[63] & 0xFF) | ((data[64] & 0xFF) << 8)) / 10,
            extracellularWaterVolume: ((data[65] & 0xFF) | ((data[66] & 0xFF) << 8)) / 10,
            extracellularWaterVolumeMin: ((data[67] & 0xFF) | ((data[68] & 0xFF) << 8)) / 10,
            extracellularWaterVolumeMax: ((data[69] & 0xFF) | ((data[70] & 0xFF) << 8)) / 10,
            bodyCellMass: ((data[71] & 0xFF) | ((data[72] & 0xFF) << 8)) / 10,
            bodyCellMassMin: ((data[73] & 0xFF) | ((data[74] & 0xFF) << 8)) / 10,
            bodyCellMassMax: ((data[75] & 0xFF) | ((data[76] & 0xFF) << 8)) / 10,
            subcutaneousFatMass: ((data[77] & 0xFF) | ((data[78] & 0xFF) << 8)) / 10
        }),

        // Package 2: Segmental Fat and Muscle Information (page 17-18)
        2: (data) => ({
            segmentalFatMass: {
                rightHand: ((data[5] & 0xFF) | ((data[6] & 0xFF) << 8)) / 10,
                leftHand: ((data[7] & 0xFF) | ((data[8] & 0xFF) << 8)) / 10,
                trunk: ((data[9] & 0xFF) | ((data[10] & 0xFF) << 8)) / 10,
                rightFoot: ((data[11] & 0xFF) | ((data[12] & 0xFF) << 8)) / 10,
                leftFoot: ((data[13] & 0xFF) | ((data[14] & 0xFF) << 8)) / 10
            },
            segmentalFatPercentage: {
                rightHand: ((data[15] & 0xFF) | ((data[16] & 0xFF) << 8)) / 10,
                leftHand: ((data[17] & 0xFF) | ((data[18] & 0xFF) << 8)) / 10,
                trunk: ((data[19] & 0xFF) | ((data[20] & 0xFF) << 8)) / 10,
                rightFoot: ((data[21] & 0xFF) | ((data[22] & 0xFF) << 8)) / 10,
                leftFoot: ((data[23] & 0xFF) | ((data[24] & 0xFF) << 8)) / 10
            },
            segmentalMuscleMass: {
                rightHand: ((data[25] & 0xFF) | ((data[26] & 0xFF) << 8)) / 10,
                leftHand: ((data[27] & 0xFF) | ((data[28] & 0xFF) << 8)) / 10,
                trunk: ((data[29] & 0xFF) | ((data[30] & 0xFF) << 8)) / 10,
                rightFoot: ((data[31] & 0xFF) | ((data[32] & 0xFF) << 8)) / 10,
                leftFoot: ((data[33] & 0xFF) | ((data[34] & 0xFF) << 8)) / 10
            },
            segmentalMuscleRatio: {
                rightHand: ((data[35] & 0xFF) | ((data[36] & 0xFF) << 8)) / 10,
                leftHand: ((data[37] & 0xFF) | ((data[38] & 0xFF) << 8)) / 10,
                trunk: ((data[39] & 0xFF) | ((data[40] & 0xFF) << 8)) / 10,
                rightFoot: ((data[41] & 0xFF) | ((data[42] & 0xFF) << 8)) / 10,
                leftFoot: ((data[43] & 0xFF) | ((data[44] & 0xFF) << 8)) / 10
            }
        }),

        // Package 3: Evaluation Suggestions (page 19-20)
        3: (data) => ({
            bodyScore: data[5],
            physicalAge: data[6],
            bodyType: data[7],
            skeletalMuscleMassIndex: data[8],

            waistToHipRatio: data[9] / 100,
            waistToHipRatioStandardMin: data[10] / 100,
            waistToHipRatioStandardMax: data[11] / 100,

            visceralFatLevel: data[12],
            visceralFatLevelStandardMin: data[13],
            visceralFatLevelStandardMax: data[14],

            obesityPercentage: ((data[15] & 0xFF) | ((data[16] & 0xFF) << 8)) / 10,
            obesityPercentageStandardMin: ((data[17] & 0xFF) | ((data[18] & 0xFF) << 8)) / 10,
            obesityPercentageStandardMax: ((data[19] & 0xFF) | ((data[20] & 0xFF) << 8)) / 10,

            bodyMassIndex: ((data[21] & 0xFF) | ((data[22] & 0xFF) << 8)) / 10,
            bodyMassIndexStandardMin: ((data[23] & 0xFF) | ((data[24] & 0xFF) << 8)) / 10,
            bodyMassIndexStandardMax: ((data[25] & 0xFF) | ((data[26] & 0xFF) << 8)) / 10,

            bodyFatPercentage: ((data[27] & 0xFF) | ((data[28] & 0xFF) << 8)) / 10,
            bodyFatPercentageStandardMin: ((data[29] & 0xFF) | ((data[30] & 0xFF) << 8)) / 10,
            bodyFatPercentageStandardMax: ((data[31] & 0xFF) | ((data[32] & 0xFF) << 8)) / 10,

            basalMetabolism: ((data[33] & 0xFF) | ((data[34] & 0xFF) << 8)),
            basalMetabolismStandardMin: ((data[35] & 0xFF) | ((data[36] & 0xFF) << 8)),
            basalMetabolismStandardMax: ((data[37] & 0xFF) | ((data[38] & 0xFF) << 8)),

            recommendedIntake: ((data[39] & 0xFF) | ((data[40] & 0xFF) << 8)),
            idealWeight: ((data[41] & 0xFF) | ((data[42] & 0xFF) << 8)) / 10,
            targetWeight: ((data[43] & 0xFF) | ((data[44] & 0xFF) << 8)) / 10,

            weightControlAmount: ((data[45] & 0xFF) | ((data[46] & 0xFF) << 8)) / 10,
            muscleControlAmount: ((data[47] & 0xFF) | ((data[48] & 0xFF) << 8)) / 10,
            fatControlAmount: ((data[49] & 0xFF) | ((data[50] & 0xFF) << 8)) / 10,

            subcutaneousFatPercentage: ((data[51] & 0xFF) | ((data[52] & 0xFF) << 8)) / 10,
            subcutaneousFatPercentageStandardMin: ((data[53] & 0xFF) | ((data[54] & 0xFF) << 8)) / 10,
            subcutaneousFatPercentageStandardMax: ((data[55] & 0xFF) | ((data[56] & 0xFF) << 8)) / 10
        }),

        // Package 4: Exercise Consumption (page 21)
        4: (data) => ({
            exerciseConsumption: {
                walk: ((data[5] & 0xFF) | ((data[6] & 0xFF) << 8)),
                golf: ((data[7] & 0xFF) | ((data[8] & 0xFF) << 8)),
                croquet: ((data[9] & 0xFF) | ((data[10] & 0xFF) << 8)),
                tennis: ((data[11] & 0xFF) | ((data[12] & 0xFF) << 8)),
                squash: ((data[13] & 0xFF) | ((data[14] & 0xFF) << 8)),
                mountainClimbing: ((data[15] & 0xFF) | ((data[16] & 0xFF) << 8)),
                swimming: ((data[17] & 0xFF) | ((data[18] & 0xFF) << 8)),
                badminton: ((data[19] & 0xFF) | ((data[20] & 0xFF) << 8))
            }
        }),

        // Package 5: Segment Standards (page 22)
        5: (data) => ({
            segmentalFatStandards: {
                rightHand: data[5],
                leftHand: data[6],
                trunk: data[7],
                rightFoot: data[8],
                leftFoot: data[9]
            },
            segmentalMuscleStandards: {
                rightHand: data[10],
                leftHand: data[11],
                trunk: data[12],
                rightFoot: data[13],
                leftFoot: data[14]
            }
        })
    };

    // Determine package number
    const packageNumber = data[3];
    const totalPackages = (packageNumber >> 4) & 0x0F;
    const currentPackage = packageNumber & 0x0F;

    console.log(`Total Packages: ${totalPackages}, Current Package: ${currentPackage}`);

    // Parse based on current package
    const packageParser = parsePackages[currentPackage];

    if (packageParser) {
        return {
            totalPackages,
            currentPackage,
            data: packageParser(data)
        };
    }

    return null;
}

let bodyCompositionPackages = {};
let totalPackages = 0;

export function collectBodyCompositionOnce(timeout = 8000) {
  return new Promise((resolve, reject) => {
    let packages = {};

    const timer = setTimeout(() => {
      biaPort.off("data", onData);
      reject(new Error("BIA response timeout"));
    }, timeout);

    const onData = (data) => {
      if (data[0] !== 0xAA || data[2] !== 0xD0) return;

      const parsed = parseBodyCompositionResponse(data);
      if (!parsed) return;

      packages[parsed.currentPackage] = parsed.data;

      // ✅ Resolve when LAST package arrives
      if (parsed.currentPackage === parsed.totalPackages) {
        clearTimeout(timer);
        biaPort.off("data", onData);

        const ordered = {};
        for (let i = 1; i <= parsed.totalPackages; i++) {
          if (packages[i]) {
            ordered[`package${i}`] = packages[i];
          }
        }

        resolve(ordered);
      }
    };

    biaPort.on("data", onData);
  });
}
export function processBodyCompositionResponse(data) {
    const parsedData = parseBodyCompositionResponse(data);

    if (parsedData) {
        // Store the package
        bodyCompositionPackages[parsedData.currentPackage] = parsedData.data;
        totalPackages = parsedData.totalPackages;

        console.log(`\n📦 Body Composition Package ${parsedData.currentPackage} of ${parsedData.totalPackages}`);
        console.log(JSON.stringify(parsedData.data, null, 2));

        // Check if all packages are collected
        if (Object.keys(bodyCompositionPackages).length === totalPackages) {
            console.log('\n🏁 Complete Body Composition Data:');

            // Organize packages in order
            const orderedPackages = {};
            for (let i = 1; i <= totalPackages; i++) {
                orderedPackages[`package${i}`] = bodyCompositionPackages[i];
            }

            console.log(JSON.stringify(orderedPackages, null, 2));

            // Reset for next measurement
            bodyCompositionPackages = {};
            totalPackages = 0;
        }
    }
}

function parseImpedanceResponse(data) {
    console.log('\n🔍 DETAILED IMPEDANCE RESPONSE');

    // Validate basic response
    /*  if (data[0] !== 0xAA || data[2] !== 0xB1) {
        console.log('❌ Invalid impedance response');
        return;
      }*/
    if (data[1] !== 0xB1 || data[1] !== 0xB0) {
        console.log(' Invalid impedance response');
        return;
    }

    // Extract frequency and response type
    const responseFrequency = (data[2] >> 4) & 0x0F;
    const responseType = data[2] & 0x0F;

    console.log(`📡 Frequency: ${getFrequencyName(responseFrequency)}`);
    console.log(`📝 Response Type: ${getResponseTypeName(responseType)}`);

    // Additional status information
    const measurementStatus = data[3];
    const mode = data[4];

    console.log(`🔬 Measurement Status: 0x${measurementStatus.toString(16).toUpperCase()}`);
    console.log(`🔄 Mode: 0x${mode.toString(16).toUpperCase()}`);

    // Parsing 8-electrode response
    if (data.length >= 26) {
        console.log('\n🌐 Eight-Electrode Impedance Details:');
        const segments = [
            { name: 'Right Hand', offset: 5 },
            { name: 'Left Hand', offset: 9 },
            { name: 'Trunk', offset: 13 },
            { name: 'Right Foot', offset: 17 },
            { name: 'Left Foot', offset: 21 }
        ];

        segments.forEach(segment => {
            // Safely read 32-bit value
            const rawValue = data[segment.offset] |
                (data[segment.offset + 1] << 8) |
                (data[segment.offset + 2] << 16) |
                (data[segment.offset + 3] << 24);

            const impedanceValue = rawValue / 10;
            console.log(`   ${segment.name}: ${impedanceValue}Ω ${impedanceValue === 0 ? '❌ No contact' : '✅'}`);
        });

        // Check if all impedances are zero
        const allZero = segments.every(segment =>
            (data[segment.offset] |
                data[segment.offset + 1] |
                data[segment.offset + 2] |
                data[segment.offset + 3]) === 0
        );

        if (allZero) {
            console.log('\n⚠️  ALL IMPEDANCE VALUES ARE ZERO!');
            console.log('Possible reasons:');
            console.log('1. No electrode contact');
            console.log('2. Incorrect measurement mode');
            console.log('3. Device not in proper measurement state');
        }
    }
    // Parsing 4-electrode response
    else if (data.length >= 12) {
        console.log('\n🌐 Four-Electrode Impedance Details:');

        // Phase Angle (16-bit signed, little-endian)
        const phaseAngleRaw = data[6] | (data[7] << 8);
        const phaseAngle = phaseAngleRaw / 10;

        // Impedance (32-bit unsigned, little-endian)
        const impedanceRaw = data[8] |
            (data[9] << 8) |
            (data[10] << 16) |
            (data[11] << 24);

        console.log(`📐 Phase Angle: ${phaseAngle.toFixed(1)}°`);
        console.log(`Ω Impedance: ${impedanceRaw}Ω ${impedanceRaw === 0 ? '❌ No contact' : '✅'}`);

        // Mode interpretation for 4-electrode
        const modeNames = {
            0x00: 'Feet',
            0x01: 'Feet (Alt)',
            0x02: 'Hands',
            0x03: '8-Electrode'
        };

        console.log(`   Mode Type: ${modeNames[mode] || 'Unknown'}`);

        if (impedanceRaw === 0) {
            console.log('\n⚠️  ZERO IMPEDANCE DETECTED!');
            console.log('Possible reasons:');
            console.log('1. No electrode contact');
            console.log('2. Incorrect measurement mode');
            console.log('3. Improper electrode placement');
        }
    }
    // If response is too short
    else {
        console.log('\n⚠️ Insufficient data for impedance parsing');
        console.log(`   Received data length: ${data.length} bytes`);
    }
}



// Connect to BIA port
export async function connectBiaPort(portPath, baudRate = 38400) {
    try {
        if (biaPort && biaPort.isOpen) {
            await new Promise((resolve) => biaPort.close(resolve));
        }

        biaPort = new SerialPort({
            path: portPath,
            baudRate: baudRate,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });

        biaPort.on('data', (data) => {
            if (heightResponseTimeout) {
                clearTimeout(heightResponseTimeout);
                heightResponseTimeout = null;
            }

            const hex = Buffer.from(data).toString('hex').toUpperCase();
            const bytes = Array.from(data).map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(', ');

            console.log(`\n${'='.repeat(60)}`);
            console.log(`BIA RESPONSE RECEIVED`);
            console.log(`${'='.repeat(60)}`);
            //  console.log(`Time: ${new Date().toLocaleTimeString()}`);
            console.log(`Length: ${data.length} bytes`);
            console.log(`Hex: ${hex}`);
            console.log(`Bytes: [${bytes}]`);


            if (data[1] === 0xB1 || data[1] === 0xB0) {

                parseImpedanceResponse(data);
            }

            // Body Composition response parsing
            if (data[0] === 0xAA && data[2] === 0xD0) {
                try {
                    processBodyCompositionResponse(data);
                } catch (error) {
                    console.error('Error parsing body composition response:', error);
                }
            }
            console.log(`${'='.repeat(60)}\n`);

            // heightWaitingForResponse = false;
            if(!IS_ELECTRON) showMenu();
        });

        // biaPort.on('error', (err) => {
        //     handleError('SERIAL_ERROR', `BIA Serial Error: ${err.message}`, 'ERROR');
        // });
         biaPort.on('error', (err) => {
            // if (weightCompleted) return;
            console.error(`❌ Weight port error: ${err.message}`);
               let errorInfo;
  if (err.message.includes('Permission denied')) {
    errorInfo = WEIGHT_ERROR_CODES[0x08]; // PORT_ERROR
  } else {
    errorInfo = WEIGHT_ERROR_CODES[0x05]; // SENSOR_ERROR
  }

  eventBus.emit('weight:error', {
    source: 'WEIGHT',
    osError: err.message,
    ...errorInfo
  });
            isMeasurementStopped = true;
        });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 10000);

            biaPort.on('open', () => {
                clearTimeout(timeout);
                console.log(`✅ BIA Connected to ${portPath} at ${baudRate} baud`);
                resolve();
            });
        });
    } catch (error) {
        console.error('❌ BIA Connection failed:', error.message);
        throw error;
    }
}




// EMIT Status and Error handler
function emitHeightStatus(statusCode, height = null) {
  const info = handleHeightStatus(statusCode, height);
  if (!info) return;

const normalizedAction = info.action || 'INFO';

eventBus.emit(
  normalizedAction === 'ABORT'
    ? EVENTS.HEIGHT_ERROR
    : EVENTS.HEIGHT_STATUS,
  {
    source: 'HEIGHT',
    ...info,
    action: normalizedAction,
    height
  }
);


  return info;
}

export function emitWeightStatus(statusCode, weight = null) {
  const info = handleWeightStatus(statusCode,weight);
  console.log("INFFFFFFFFFFFFFFFFF",info)
  if (!info) return;

  eventBus.emit(
    info.action === 'ABORT' ? EVENTS.WEIGHT_ERROR : EVENTS.WEIGHT_STATUS,
    {
      source: 'WEIGHT',
      ...info,
      weight
    }
  );

  return info;
}

function emitImpedanceStatus(statusCode, meta = {}) {
  const info = IMPEDANCE_ERROR_CODES[statusCode];
  if (!info) return;

  eventBus.emit(
    info.action === 'ABORT' ? EVENTS.IMPEDANCE_ERROR : EVENTS.IMPEDANCE_STATUS,
    {
      source: 'IMPEDANCE',
      ...info,
      ...meta   // frequency, attempt, segments etc.
    }
  );

  return info;
}


// measure height
export async function height_measurement() {
  return new Promise((resolve) => {
    isMeasurementStopped = false;
    heightCompleted = false;
    stableReadings = [];
    finalheight = null;

    emitHeightStatus(0x00); // INFO

    const interval = setInterval(() => {
      /* ---------- SUCCESS ---------- */
      if (heightCompleted) {
        clearInterval(interval);

        try {
          heightPort?.close(); // intentional close
        } catch {}

        return resolve({
          success: true,
          height: finalheight
        });
      }

      /* ---------- ABORT ---------- */
      if (isMeasurementStopped && !heightCompleted) {
        clearInterval(interval);
        return resolve({
          success: false,
          handledByEvent: true
        });
      }

      /* ---------- SEND READ CMD ---------- */
      try {
        heightPort.write(READ_CMD);
      } catch (err) {
        clearInterval(interval);
        emitHeightStatus(0x08); // PORT_ERROR
        isMeasurementStopped = true;

        return resolve({
          success: false,
          handledByEvent: true
        });
      }
    }, 200);
  });
}




// Connect to Height port
export async function connectHeightPort(portPath, baudRate = 9600) {
    try {
        // Close existing port
        if (heightPort && heightPort.isOpen) {
            await new Promise((resolve) => heightPort.close(resolve));
        }

        // Create new port
        heightPort = new SerialPort({
            path: portPath,
            baudRate: baudRate,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });

        // ====================================================================
        // DATA HANDLER WITH ERROR CHECKING
        // ====================================================================

        // heightPort.on('data', (data) => {
        //     try {
        //         if (isMeasurementStopped) return;

        //         heightBuffer = Buffer.concat([heightBuffer, data]);

        //         while (heightBuffer.length >= 7) {
        //             const start = heightBuffer.indexOf(Buffer.from([0x55, 0xaa]));

        //             // No frame found
        //             if (start === -1) {
        //                 heightBuffer = Buffer.alloc(0);
        //                 return;
        //             }

        //             // Frame incomplete
        //             if (heightBuffer.length - start < 7) return;

        //             const frame = heightBuffer.slice(start, start + 7);
        //             heightBuffer = heightBuffer.slice(start + 7);

        //             // ══════════════════════════════════════════════════════
        //             // CHECKSUM VERIFICATION
        //             // ══════════════════════════════════════════════════════

        //             if (!verifyChecksum(frame)) {
        //                 console.log('❌ Checksum verification failed');
        //                 const err = handleHeightStatus(0x09); // INVALID_RESPONSE
        //                 continue;
        //             }

        //             // ══════════════════════════════════════════════════════
        //             // PARSE DISTANCE & CALCULATE HEIGHT
        //             // ══════════════════════════════════════════════════════

        //             try {
        //                 const distance = parseDistance(frame);

        //                 // Validate distance
        //                 if (distance < 0 || distance > 3000) {
        //                     handleHeightStatus(0x09);  // INVALID_RESPONSE
        //                     console.log(`❌ Invalid distance: ${distance} mm`);
        //                     continue;
        //                 }

        //                 const distanceCm = distance / 10;
        //                 const calculatedHeight = 194 - distanceCm;

        //                 // ════════════════════════════════════════════════════
        //                 // VALIDATE HEIGHT RANGE
        //                 // ════════════════════════════════════════════════════

        //                 let statusCode = 0x04;  // Default STABLE

        //                 if (calculatedHeight < 80) {
        //                     statusCode = 0x01;  // OUT_OF_RANGE_LOW
        //                 } else if (calculatedHeight > 250) {
        //                     statusCode = 0x02;  // OUT_OF_RANGE_HIGH
        //                 }

        //                 // Show error if out of range
        //                 if (statusCode !== 0x04) {
        //                     emitHeightStatus(0x04, calculatedHeight);
        //                     isMeasurementStopped = true;
        //                     heightPort.close();
        //                     console.log('\n❌ Height measurement stopped (out of range)');
        //                     stableReadings = [];
        //                    if(!IS_ELECTRON) showMenu();
        //                     return;
        //                 }

        //                 finalheight = calculatedHeight;

        //                 console.log(`\n${'='.repeat(60)}`);
        //                 console.log('📏 HEIGHT MEASUREMENT');
        //                 console.log(`${'='.repeat(60)}`);
        //                 console.log(`Distance: ${distance} mm (${distanceCm.toFixed(1)} cm)`);
        //                 console.log(`Calculated Height: ${calculatedHeight.toFixed(1)} cm`);

        //                 // ════════════════════════════════════════════════════
        //                 // CHECK STABILITY
        //                 // ════════════════════════════════════════════════════

        //                 if (checkStability(distance)) {
        //                     if (stableReadings.length >= STABILITY_COUNT) {
        //                         emitHeightStatus(0x04, calculatedHeight);  // STABLE success
        //                         console.log(`\n${'='.repeat(60)}`);
        //                         console.log(`✅ STABLE HEIGHT FOUND: ${calculatedHeight.toFixed(1)} cm`);
        //                         console.log(`${'='.repeat(60)}\n`);

        //                         isMeasurementStopped = true;
        //                         heightPort.close();
        //                         console.log('🛑 Height measurement stopped.\n');
        //                         stableReadings = [];
        //                         showMenu();
        //                         return;
        //                     }
        //                 } else {
        //                    emitHeightStatus(0x03);   // UNSTABLE
        //                     console.log(`   Readings: ${stableReadings.length}/${STABILITY_COUNT}`);
        //                     console.log(`${'='.repeat(60)}\n`);
        //                 }

        //             } catch (parseError) {
        //                emitHeightStatus(0x09);  // INVALID_RESPONSE
        //                 console.error(`❌ Parse error: ${parseError.message}`);
        //                 continue;
        //             }
        //         }

        //     } catch (error) {
        //         console.error(`❌ Data handler error: ${error.message}`);
        //        emitHeightStatus(0x05);  // SENSOR_ERROR
        //         isMeasurementStopped = true;
        //         heightPort.close();
        //         return {success:false}
        //     }
        // });
            heightPort.on('data', (data) => {
  if (isMeasurementStopped || heightCompleted) return;

  try {
    heightBuffer = Buffer.concat([heightBuffer, data]);

    while (heightBuffer.length >= 7) {
      const start = heightBuffer.indexOf(Buffer.from([0x55, 0xaa]));

      // No frame header
      if (start === -1) {
        heightBuffer = Buffer.alloc(0);
        return;
      }

      // Incomplete frame
      if (heightBuffer.length - start < 7) return;

      const frame = heightBuffer.slice(start, start + 7);
      heightBuffer = heightBuffer.slice(start + 7);

      /* ---------- CHECKSUM ---------- */
      if (!verifyChecksum(frame)) {
        emitHeightStatus(0x09); // INVALID_RESPONSE
        continue;
      }

      /* ---------- PARSE DISTANCE ---------- */
      const distance = parseDistance(frame);

      if (distance < 0 || distance > 3000) {
        emitHeightStatus(0x09); // INVALID_RESPONSE
        continue;
      }

      const distanceCm = distance / 10;
      const calculatedHeight = 194 - distanceCm;

      /* ---------- RANGE CHECK ---------- */
      if (calculatedHeight < 80) {
        emitHeightStatus(0x01, calculatedHeight); // TOO LOW
        continue;
      }

      if (calculatedHeight > 250) {
        emitHeightStatus(0x02, calculatedHeight); // TOO HIGH
        continue;
      }

      /* ---------- STABILITY CHECK ---------- */
      if (!checkStability(distance)) {
        emitHeightStatus(0x03); // UNSTABLE / WAIT
        continue;
      }

      /* ---------- SUCCESS ---------- */
      if (stableReadings.length >= STABILITY_COUNT) {
        finalheight = calculatedHeight;
        heightCompleted = true;
        isMeasurementStopped = true;

        emitHeightStatus(0x04, calculatedHeight); // STABLE / ACCEPT
        return;
      }
    }
  } catch (err) {
    if (heightCompleted) return;

    emitHeightStatus(0x05); // SENSOR_ERROR
    isMeasurementStopped = true;
  }
});


        // ====================================================================
        // ERROR HANDLER
        // ====================================================================

        heightPort.on('error', (err) => {
            if (heightCompleted) return;
            console.error(`❌ Height port error: ${err.message}`);
               let errorInfo;
  if (err.message.includes('Permission denied')) {
    errorInfo = HEIGHT_ERROR_CODES[0x08]; // PORT_ERROR
  } else {
    errorInfo = HEIGHT_ERROR_CODES[0x05]; // SENSOR_ERROR
  }

  eventBus.emit('height:error', {
    source: 'HEIGHT',
    osError: err.message,
    ...errorInfo
  });
            isMeasurementStopped = true;
        });

        // ====================================================================
        // CLOSE HANDLER
        // ====================================================================

        heightPort.on('close', () => {
            console.log('⚠️ Height port closed');
        });

        // ====================================================================
        // CONNECTION TIMEOUT
        // ====================================================================

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (heightPort) {
                    heightPort.close();
                }
                reject(new Error('Connection timeout (10 seconds)'));
            }, 10000);

            heightPort.on('open', () => {
                clearTimeout(timeout);
                console.log(`✅ Height Connected to ${portPath} at ${baudRate} baud`);
                resolve();
            });

            heightPort.on('error', (err) => {
                clearTimeout(timeout);
                resolve({
                    success:false,
                    handleByEvent:false
                });
            });
        });

    } catch (error) {
        console.error(`❌ Height connection failed: ${error.message}`);
       const errorInfo = handleHeightStatus(0x08);  // PORT_ERROR
        if (heightPort) {
            try {
                heightPort.close();
            } catch (e) {
                // Ignore close error
            }
        }
        return {
    success: false,
    error: {
      source: 'HEIGHT',
      ...errorInfo
    }
  };
    }
}




// Send BIA command
export async function sendBiaCommand(command, options = {}) {
    const defaultOptions = {
        waitForResponse: true,
        timeout: 10000,  // 10 seconds
        verbose: true,
        responseHandler: null
    };

    const config = { ...defaultOptions, ...options };

    return new Promise((resolve, reject) => {
        // Check port connection
        if (!biaPort || !biaPort.isOpen) {
            const error = new Error('BIA Port not connected');
            if (config.verbose) console.error(`❌ ${error.message}`);
            reject(error);
            return;
        }

        // Ensure command is a buffer
        const buffer = Buffer.isBuffer(command) ? command : Buffer.from(command);
        const hexString = buffer.toString('hex').toUpperCase();

        // Verbose logging
        if (config.verbose) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(` SENDING BIA COMMAND`);
            console.log(`${'='.repeat(60)}`);
            console.log(` Hex: ${hexString}`);
            //console.log(`Time: ${new Date().toLocaleTimeString()}`);
            console.log(`${'='.repeat(60)}`);
        }

        // Write command
        biaPort.write(buffer, (err) => {
            if (err) {
                if (config.verbose) console.error(' Write error:', err.message);
                reject(err);
                return;
            }

            if (config.verbose) console.log('✅ BIA Command sent successfully\n');

            // Response handling
            if (config.waitForResponse) {
                let responseTimeout;

                const responseListener = (data) => {
                    // Clear timeout
                    if (responseTimeout) clearTimeout(responseTimeout);

                    // Custom or default response handling
                    if (config.responseHandler) {
                        config.responseHandler(data);
                    } else {
                        // Default parsing
                        // parseBodyComposition1(data);
                    }

                    // Remove listener to prevent memory leaks
                    biaPort.removeListener('data', responseListener);

                    resolve(data);
                };

                // Set timeout
                responseTimeout = setTimeout(() => {
                    biaPort.removeListener('data', responseListener);
                    const timeoutError = new Error('No response received');
                    if (config.verbose) console.warn('\n  WARNING:', timeoutError.message);
                    reject(timeoutError);
                }, config.timeout);

                // Add response listener
                biaPort.on('data', responseListener);
            } else {
                resolve();
            }
        });
    });
}

function getFrequencyName(frequencyCode) {
    const frequencyNames = {
        0x00: 'Current Measurement',
        0x01: '5 kHz',
        0x02: '10 kHz',
        0x03: '20 kHz',
        0x04: '25 kHz',
        0x05: '50 kHz',
        0x06: '100 kHz',
        0x07: '200 kHz',
        0x08: '250 kHz',
        0x09: '500 kHz'
    };
    return frequencyNames[frequencyCode] || `Unknown (0x${frequencyCode.toString(16).toUpperCase()})`;
}
function getResponseTypeName(responseTypeCode) {
    const responseTypes = {
        0x01: 'Original Impedance',
        0x02: 'Encrypted Impedance',
        0x03: 'ADC Value'
    };
    return responseTypes[responseTypeCode] || `Unknown (0x${responseTypeCode.toString(16).toUpperCase()})`;
}








export async function case38_20kHzImpedanceQuery() {
    try {
        // Step 1: Stop current test
        await sendBiaCommand([0x55, 0x06, 0xB0, 0x00, 0x00, 0xF5]);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 2: Set impedance mode for 8-electrode 20 kHz
        await sendBiaCommand([0x55, 0x06, 0xB0, 0x01, 0x03, 0xF1]);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Query command for 20 kHz
        const query20kHzCommand = [0x55, 0x05, 0xB1, 0x31, 0xC4];

        // Track results
        const results = {
            totalAttempts: 50,
            meaningfulResponses: [],
            zeroResponses: [],
            errorResponses: [],
            errorCounts: {}  // Track error codes
        };

        // Function to check if responses are stable
        const isStableResponse = (responses) => {
            if (responses.length < 5) return false;

            // Get the last 5 responses
            const lastFive = responses.slice(-5);

            // Check if all last 5 responses are meaningful and similar
            const allMeaningful = lastFive.every(isMeaningful20kHzResult);

            if (!allMeaningful) return false;

            // Compare segments across last 5 responses
            const segments = ['rightHand', 'leftHand', 'trunk', 'rightFoot', 'leftFoot'];

            return segments.every(segment => {
                const values = lastFive.map(r => r.segments[segment]);
                const max = Math.max(...values);
                const min = Math.min(...values);
                return (max - min) / max < 0.1; // Within 10% variation
            });
        };

        // 50 attempts
        for (let attempt = 1; attempt <= 50; attempt++) {
            try {
                console.log(`\n📡 Attempt ${attempt}: Querying 20 kHz Impedance`);

                const responseData = await sendBiaCommand(query20kHzCommand, {
                    timeout: 5000,
                    verbose: true
                });

                //Handle impedance status
                const statusCode = responseData[4];
                console.log("statusCode",statusCode)
                const statusResult = ImprovedImpedanceStatusHandler.handleImpedanceStatus(statusCode, attempt);
                emitImpedanceStatus(statusCode, {
                    frequency: '20kHz',
                    attempt,
                     decision: statusResult.decision
                });
                console.log("------statusResult-------");
                console.log(statusResult);
                // Track errors
                if (!results.errorCounts[statusCode]) {
                    results.errorCounts[statusCode] = 0;
                }
                results.errorCounts[statusCode]++;
                // Decision logic
                if (statusResult.decision.isCritical) {
                    console.error('CRITICAL ERROR - Stopping measurement');
                    break;
                }
                if (statusResult.decision.shouldAbort) {
                    console.error('Measurement aborted');
                    break;
                }
                if (statusResult.decision.shouldWait) {
                    console.log('Waiting for device...');
                    await new Promise(r => setTimeout(r, statusResult.waitTime));
                    continue;
                }
                if (statusResult.decision.shouldRetry && !statusResult.decision.maxRetriesReached) {
                    const retryResult = await ImprovedImpedanceStatusHandler.handleRetry(statusCode, attempt, 3);
                    if (retryResult.shouldRetry) {
                        continue;
                    }
                }
                if (statusResult.decision.shouldAccept) {


                    // Parse response
                    const parsedResult = parse20kHzImpedanceResponse(responseData);

                    console.log("-----");
                    console.log(parsedResult);

                    // Check if result is meaningful
                    if (isMeaningful20kHzResult(parsedResult)) {
                        results.meaningfulResponses.push(parsedResult);
                    } else {
                        results.zeroResponses.push({
                            attempt,
                            rawResponse: responseData
                        });
                    }
                }

                // Check for stable responses
                if (isStableResponse(results.meaningfulResponses)) {
                    console.log('✅ Stable impedance values detected!');
                    break;
                }

                // Delay between attempts
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (queryError) {
                console.error(`Attempt ${attempt} failed:`, queryError);
                results.errorResponses.push({
                    attempt,
                    error: queryError.message
                });
            }
        }
        // ✅ Display statistics
        ImprovedImpedanceStatusHandler.displayErrorStatistics(results.errorCounts);

        // Display comprehensive results
        console.log('\n20 kHz Impedance Query Results:');
        console.log(`Total Attempts: ${results.totalAttempts}`);
        console.log(`Meaningful Responses: ${results.meaningfulResponses.length}`);
        console.log(`Zero Responses: ${results.zeroResponses.length}`);
        console.log(`Error Responses: ${results.errorResponses.length}`);

        // Detailed meaningful responses
        if (results.meaningfulResponses.length > 0) {
            console.log('\n Final Meaningful Data:');
            const finalResponse = results.meaningfulResponses[results.meaningfulResponses.length - 1];
            console.log(JSON.stringify(finalResponse, null, 2));
        }
        // Save the results globally
        // impedance20kHzResults = results.meaningfulResponses.length > 0
        //     ? results.meaningfulResponses[results.meaningfulResponses.length - 1]
        //     : null;
const finalResult =
  results.meaningfulResponses.length > 0
    ? results.meaningfulResponses[results.meaningfulResponses.length - 1]
    : null;
    impedance20kHzResults = finalResult
        return finalResult;
    } catch (error) {
        console.error('Overall 20 kHz impedance query failed:', error);
        throw error;
    }
}

// Helper functions remain the same as in previous implementation
function parse20kHzImpedanceResponse(data) {
    console.log("coming 20khz frequency")
    // Validate response
    if (data[0] !== 0xAA || data[2] !== 0xB1) {
        console.log('❌ Invalid impedance response');
        return null;
    }
    console.log(data.length);
    // 8-electrode parsing
    if (data.length >= 27) {
        return {
            frequency: getFrequencyName((data[3] >> 4) & 0x0F),
            responseType: getResponseTypeName(data[3] & 0x0F),
            measurementStatus: data[4],
            segments: {
                rightHand: readImpedanceValue(data, 6),   // Bytes 6-9
                leftHand: readImpedanceValue(data, 10),   // Bytes 10-13
                trunk: readImpedanceValue(data, 14),      // Bytes 14-17
                rightFoot: readImpedanceValue(data, 18),  // Bytes 18-21
                leftFoot: readImpedanceValue(data, 22)    // Bytes 22-25
            }
        };
    }

    return null;
}


function isMeaningful20kHzResult(result) {
    if (!result || !result.segments) return false;

    return Object.values(result.segments).some(value => value > 0);
}

export async function case39_100kHzImpedanceQuery() {
    try {
        // Step 1: Stop current test
        console.log('   Stopping previous measurement...');
        await sendBiaCommand([0x55, 0x06, 0xB0, 0x00, 0x00, 0xF5]);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 2: Set impedance mode for 8-electrode 100 kHz
        console.log('   Setting 100 kHz impedance mode...');
        await sendBiaCommand([0x55, 0x06, 0xB0, 0x01, 0x06, 0xEE]);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Query command for 100 kHz
        const query100kHzCommand = [0x55, 0x05, 0xB1, 0x61, 0x94];

        // Track results
        const results = {
            totalAttempts: 50,
            meaningfulResponses: [],
            zeroResponses: [],
            errorResponses: [],
            statusCodes: {}  // ✅ ENHANCED: Track status codes
        };

        // ✅ ENHANCED: Global error tracking
        const globalErrorCounts = {};

        // Function to check if responses are stable
        const isStableResponse = (responses) => {
            if (responses.length < 5) return false;

            // Get the last 5 responses
            const lastFive = responses.slice(-5);

            // Check if all last 5 responses are meaningful and similar
            const allMeaningful = lastFive.every(isMeaningful100kHzResult);

            if (!allMeaningful) return false;

            // Compare segments across last 5 responses
            const segments = ['rightHand', 'leftHand', 'trunk', 'rightFoot', 'leftFoot'];

            return segments.every(segment => {
                const values = lastFive.map(r => r.segments[segment]);
                const max = Math.max(...values);
                const min = Math.min(...values);
                return (max - min) / max < 0.1; // Within 10% variation
            });
        };

        console.log('\n📡 Starting 100 kHz Impedance Query\n');

        // 50 attempts
        for (let attempt = 1; attempt <= 50; attempt++) {
            try {
                console.log(`   Attempt ${attempt}`);

                const responseData = await sendBiaCommand(query100kHzCommand, {
                    timeout: 5000,
                    verbose: false
                });

                // Handle variable response lengths
                if (responseData && responseData.length >= 27) {
                    // Check if response is valid 8-electrode response
                    if (responseData[0] === 0xAA && responseData[2] === 0xB1) {

                        // Extract measurement status (byte 4)
                        const measurementStatus = responseData[4];

                        // ✅ ENHANCED: Track status codes
                        if (!results.statusCodes[measurementStatus]) {
                            results.statusCodes[measurementStatus] = 0;
                        }
                        results.statusCodes[measurementStatus]++;

                        if (!globalErrorCounts[measurementStatus]) {
                            globalErrorCounts[measurementStatus] = 0;
                        }
                        globalErrorCounts[measurementStatus]++;

                        // ✅ ENHANCED: Use ImprovedImpedanceStatusHandler
                        const statusResult = ImprovedImpedanceStatusHandler.handleImpedanceStatus(
                            measurementStatus,
                            attempt
                        );

                        console.log("------statusResult-------");
                        console.log(statusResult);

                        // ============================================================
                        // DECISION LOGIC: Handle different status codes intelligently
                        // ============================================================

                        if (statusResult.decision.shouldAccept) {
                            // Status 0x03: SUCCESS - Device ready with real data
                            // ✅ This is what we want - accept the measurement
                            const parsedResult = parse100kHzImpedanceResponse(responseData);

                            if (isMeaningful100kHzResult(parsedResult)) {
                                // Real data received - store it
                                results.meaningfulResponses.push(parsedResult);
                                console.log(`      ✅ ${statusResult.message}`);

                                // Display impedance values
                                console.log(`         Right Hand: ${parsedResult.segments.rightHand}Ω`);
                                console.log(`         Left Hand: ${parsedResult.segments.leftHand}Ω`);
                                console.log(`         Trunk: ${parsedResult.segments.trunk}Ω`);
                                console.log(`         Right Foot: ${parsedResult.segments.rightFoot}Ω`);
                                console.log(`         Left Foot: ${parsedResult.segments.leftFoot}Ω`);

                                // Check for stable responses
                                if (isStableResponse(results.meaningfulResponses)) {
                                    console.log(`\n   ✅ Stable impedance values detected after ${attempt} attempts!`);
                                    break;  // Exit loop - we have stable data
                                }
                            } else {
                                // Status says success but data is not meaningful
                                console.log(`      ⚠️  Status success but measurement not meaningful`);
                                results.zeroResponses.push({
                                    attempt,
                                    rawResponse: responseData,
                                    reason: 'Status success but measurement not meaningful',
                                    statusCode: measurementStatus
                                });
                            }

                        } else if (statusResult.decision.shouldWait) {
                            // Status 0x02: MEASURE - Device still measuring
                            // ⏳ Wait for device to complete measurement
                            console.log(`      ⏳ ${statusResult.message} (waiting ${statusResult.waitTime || 500}ms)`);
                            results.zeroResponses.push({
                                attempt,
                                rawResponse: responseData,
                                reason: 'Device still measuring (status 0x02)',
                                statusCode: measurementStatus
                            });
                            // Wait before next attempt
                            await new Promise(resolve => setTimeout(resolve, statusResult.waitTime || 500));
                            continue;

                        } else if (statusResult.decision.shouldRetry) {
                            // Status 0x04: ERROR_RANGER or 0x05: ERROR_REPEAT
                            // ⚠️ Retryable error - can try again
                            console.log(`      ⚠️  ${statusResult.message}`);

                            results.errorResponses.push({
                                attempt,
                                error: statusResult.message,
                                statusCode: measurementStatus,
                                canRetry: statusResult.canRetry
                            });

                            // Check if we can retry
                            if (!statusResult.decision.maxRetriesReached) {
                                // Use handler's smart retry logic
                                const retryResult = await ImprovedImpedanceStatusHandler.handleRetry(
                                    measurementStatus,
                                    attempt,
                                    50  // Max attempts in this loop
                                );

                                if (retryResult.shouldRetry) {
                                    console.log(`Retrying (attempt ${retryResult.nextAttempt})...`);
                                    continue;  // Continue loop to retry
                                }
                            } else {
                                console.log(`Max retries reached for this error`);
                            }

                        } else if (statusResult.decision.isCritical) {
                            // Status 0x01: CHECK_ELECTRODE
                            // ❌ CRITICAL - Electrode problem, must stop
                            console.log(`\n CRITICAL: ${statusResult.message}`);

                            results.errorResponses.push({
                                attempt,
                                error: statusResult.message,
                                statusCode: measurementStatus,
                                isCritical: true
                            });

                            // Show user-friendly error message
                            if (statusResult.userMessage) {
                                console.log(`\n${statusResult.userMessage}`);
                            }

                            // Show solutions
                            if (statusResult.solutions) {
                                console.log(`\nRecommended Actions:`);
                                statusResult.solutions.forEach(solution => {
                                    console.log(`   ${solution}`);
                                });
                            }

                            console.log(`\n CRITICAL ERROR - Stopping 100 kHz impedance measurement`);
                            break;  // Exit loop - can't continue with electrode problem

                        } else if (statusResult.decision.shouldAbort) {
                            // Status 0x06: USER_EXIT or other abort conditions
                            // ⏹️ Stop measurement (user cancelled or other reason)
                            console.log(`      ⏹️  ${statusResult.message}`);

                            results.zeroResponses.push({
                                attempt,
                                rawResponse: responseData,
                                reason: statusResult.message,
                                statusCode: measurementStatus
                            });
                            break;  // Exit loop

                        } else {
                            // Unknown/unhandled status
                            console.log(`      ❓ Unhandled status: 0x${measurementStatus.toString(16).toUpperCase()}`);
                            results.zeroResponses.push({
                                attempt,
                                rawResponse: responseData,
                                reason: `Unknown status: 0x${measurementStatus.toString(16)}`,
                                statusCode: measurementStatus
                            });
                        }

                    } else {
                        // Invalid response format (header mismatch)
                        console.warn(` Invalid response format`);
                        results.zeroResponses.push({
                            attempt,
                            rawResponse: responseData,
                            reason: 'Invalid response format'
                        });
                    }
                } else if (responseData) {
                    console.warn(` Unexpected response length: ${responseData.length} bytes`);
                    results.zeroResponses.push({
                        attempt,
                        rawResponse: responseData,
                        reason: 'Unexpected response length'
                    });
                }

                // Delay between attempts
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (queryError) {
                console.error(`Attempt ${attempt} failed: ${queryError.message}`);
                results.errorResponses.push({
                    attempt,
                    error: queryError.message,
                    exception: true
                });
            }
        }

        // ✅ ENHANCED: Display comprehensive results
        console.log('\n' + '='.repeat(70));
        console.log('📊 100 kHz IMPEDANCE QUERY RESULTS');
        console.log('='.repeat(70));

        console.log(`\nTotal Attempts: ${results.totalAttempts}`);
        console.log(`Meaningful Responses: ${results.meaningfulResponses.length}`);
        console.log(`Zero/Waiting Responses: ${results.zeroResponses.length}`);
        console.log(`Error Responses: ${results.errorResponses.length}`);

        // ✅ ENHANCED: Show status code breakdown
        if (Object.keys(results.statusCodes).length > 0) {
            console.log(`\nStatus Code Breakdown:`);
            Object.entries(results.statusCodes).forEach(([code, count]) => {
                const codeNum = parseInt(code);
                const codeMap = {
                    0x00: 'NULL',
                    0x01: 'CHECK_ELECTRODE',
                    0x02: 'MEASURE',
                    0x03: 'SUCCESS',
                    0x04: 'ERROR_RANGER',
                    0x05: 'ERROR_REPEAT',
                    0x06: 'USER_EXIT'
                };
                const codeName = codeMap[codeNum] || 'UNKNOWN';
                console.log(`   0x${codeNum.toString(16).toUpperCase()} (${codeName}): ${count}x`);
            });
        }

        // Show error details if any
        if (results.errorResponses.length > 0) {
            console.log(`\nError Details:`);
            results.errorResponses.slice(0, 5).forEach(err => {
                const statusStr = err.statusCode !== undefined
                    ? ` [0x${err.statusCode.toString(16).toUpperCase()}]`
                    : '';
                const criticalStr = err.isCritical ? ' (CRITICAL)' : '';
                console.log(`   Attempt ${err.attempt}: ${err.error}${statusStr}${criticalStr}`);
            });
            if (results.errorResponses.length > 5) {
                console.log(`   ... and ${results.errorResponses.length - 5} more errors`);
            }
        }

        // Display meaningful responses
        if (results.meaningfulResponses.length > 0) {
            console.log('\nImpedance Measurements:');

            const allSegments = {
                rightHand: [],
                leftHand: [],
                trunk: [],
                rightFoot: [],
                leftFoot: []
            };

            results.meaningfulResponses.forEach((response, idx) => {
                allSegments.rightHand.push(response.segments.rightHand);
                allSegments.leftHand.push(response.segments.leftHand);
                allSegments.trunk.push(response.segments.trunk);
                allSegments.rightFoot.push(response.segments.rightFoot);
                allSegments.leftFoot.push(response.segments.leftFoot);
            });

            console.log(`\nSegment Statistics:`);

            Object.entries(allSegments).forEach(([segment, values]) => {
                if (values.length > 0) {
                    const min = Math.min(...values);
                    const max = Math.max(...values);
                    const avg = values.reduce((a, b) => a + b, 0) / values.length;
                    const variation = ((max - min) / avg * 100).toFixed(2);

                    console.log(`\n   ${segment}:`);
                    console.log(`      Min: ${min}Ω, Max: ${max}Ω, Avg: ${avg.toFixed(1)}Ω`);
                    console.log(`      Variation: ${variation}%`);
                }
            });

            // Show final measurement
            console.log('\n\nFinal Measurement (100 kHz):\n');
            const finalResponse = results.meaningfulResponses[results.meaningfulResponses.length - 1];
            console.log(JSON.stringify(finalResponse, null, 2));
        } else {
            console.log('\nNo successful measurements received!');
        }

        // ✅ ENHANCED: Display global error statistics
        if (Object.keys(globalErrorCounts).length > 0) {
            console.log('\n' + '='.repeat(70));
            console.log('GLOBAL ERROR CODE STATISTICS');
            console.log('='.repeat(70));
            ImprovedImpedanceStatusHandler.displayErrorStatistics(globalErrorCounts);
        }

        console.log('='.repeat(70));

        const finalResult =
  results.meaningfulResponses.length > 0
    ? results.meaningfulResponses[results.meaningfulResponses.length - 1]
    : null;
        // Store final result
        // impedance100kHzResults = results.meaningfulResponses.length > 0
        //     ? results.meaningfulResponses[results.meaningfulResponses.length - 1]
        //     : null;
        impedance100kHzResults = finalResult

        return finalResult;

    } catch (error) {
        console.error('Overall 100 kHz impedance query failed:', error);
        throw error;
    }
}

// Helper function to parse 100 kHz impedance response
function parse100kHzImpedanceResponse(data) {
    // Validate response
    if (data[0] !== 0xAA || data[2] !== 0xB1) {
        console.log(' Invalid impedance response');
        return null;
    }

    // 8-electrode parsing
    if (data.length >= 27) {
        return {
            segments: {
                rightHand: readImpedanceValue(data, 6),   // Bytes 6-9
                leftHand: readImpedanceValue(data, 10),   // Bytes 10-13
                trunk: readImpedanceValue(data, 14),      // Bytes 14-17
                rightFoot: readImpedanceValue(data, 18),  // Bytes 18-21
                leftFoot: readImpedanceValue(data, 22)    // Bytes 22-25
            }
        };
    }

    return null;
}

// Helper to read impedance value
function readImpedanceValue(data, offset) {
    // Read 32-bit little-endian value with resolution 0.1Ω
    const rawValue = data[offset] |
        (data[offset + 1] << 8) |
        (data[offset + 2] << 16) |
        (data[offset + 3] << 24);

    // Convert to decimal value (divide by 10 for 0.1Ω resolution)
    return rawValue / 10.0;
}

// Helper to check if result is meaningful
function isMeaningful100kHzResult(result) {
    if (!result || !result.segments) return false;

    return Object.values(result.segments).some(value => value > 0);
}

async function case40_PhaseAngleDetailedQuery() {
    try {
        // Measurement modes for 50 kHz
        const modes = [
            {
                code: IMPEDANCE_MODES.FOUR_ELECTRODE_LEGS,
                name: 'Four-Electrode Legs',
                setImpedanceCommand: [0x55, 0x06, 0xB0, 0x02, 0x05, 0xEE]
            },
            {
                code: IMPEDANCE_MODES.FOUR_ELECTRODE_ARMS,
                name: 'Four-Electrode Arms',
                setImpedanceCommand: [0x55, 0x06, 0xB0, 0x03, 0x05, 0xED]
            }
        ];

        // Results storage
        const phaseAngleResults = {
            'Four-Electrode Legs': [],
            'Four-Electrode Arms': []
        };

        // ✅ ENHANCED: Global error tracking
        const globalErrorCounts = {};

        // Stability check function
        const isStableResponse = (responses) => {
            if (responses.length < 5) return false;

            const lastFive = responses.slice(-5);

            const phaseAngles = lastFive.map(r => r.phaseAngle.value);
            const impedanceValues = lastFive.map(r => r.impedance.value);

            const phaseAngleMax = Math.max(...phaseAngles);
            const phaseAngleMin = Math.min(...phaseAngles);
            const phaseAngleVariation = phaseAngleMax - phaseAngleMin;

            const impedanceMax = Math.max(...impedanceValues);
            const impedanceMin = Math.min(...impedanceValues);
            const impedanceVariation = impedanceMax - impedanceMin;

            const isStablePhaseAngle = phaseAngleVariation < 1.0;
            const isStableImpedance = impedanceVariation < 10.0;

            return isStablePhaseAngle && isStableImpedance;
        };

        // Process each measurement mode
        for (const mode of modes) {
            console.log(`\n📡 Measuring Phase Angle: 50 kHz, ${mode.name}`);

            // Step 1: Stop current test
            console.log('   Stopping previous measurement...');
            await sendBiaCommand([0x55, 0x06, 0xB0, 0x00, 0x00, 0xF5]);
            await new Promise(resolve => setTimeout(resolve, 500));

            // Step 2: Set impedance mode at 50 kHz
            console.log(`   Setting ${mode.name} mode at 50 kHz...`);
            await sendBiaCommand(mode.setImpedanceCommand);

            await new Promise(resolve => setTimeout(resolve, 800));

            const queryCommand = [0x55, 0x05, 0xB1, 0x01, 0xF4];

            // Track results
            const results = {
                attempts: 0,
                meaningfulResponses: [],
                zeroResponses: [],
                errorResponses: [],
                statusCodes: {}  // ✅ ENHANCED: Track status codes
            };

            console.log(`   Starting measurement attempts...\n`);

            // Collect up to 50 attempts until stable
            for (let attempt = 1; attempt <= 50; attempt++) {
                results.attempts = attempt;

                try {
                    console.log(`   Attempt ${attempt}`);

                    const responseData = await sendBiaCommand(queryCommand, {
                        timeout: 5000,
                        verbose: false
                    });

                    // Handle variable response lengths (at least 13 bytes)
                    if (responseData && responseData.length >= 13) {
                        // Check if response is valid 4-electrode response
                        if (responseData[0] === 0xAA && responseData[2] === 0xB1) {

                            // Extract measurement status (byte 4)
                            const measurementStatus = responseData[4];

                            // ✅ ENHANCED: Track status codes
                            if (!results.statusCodes[measurementStatus]) {
                                results.statusCodes[measurementStatus] = 0;
                            }
                            results.statusCodes[measurementStatus]++;

                            if (!globalErrorCounts[measurementStatus]) {
                                globalErrorCounts[measurementStatus] = 0;
                            }
                            globalErrorCounts[measurementStatus]++;

                            // ✅ ENHANCED: Use ImprovedImpedanceStatusHandler
                            // This provides comprehensive error handling for status codes
                            const statusResult = ImprovedImpedanceStatusHandler.handleImpedanceStatus(
                                measurementStatus,
                                attempt
                            );

                            // ============================================================
                            // DECISION LOGIC: Handle different status codes intelligently
                            // ============================================================

                            if (statusResult.decision.shouldAccept) {
                                // Status 0x03: SUCCESS - Device ready with real data
                                // ✅ This is what we want - accept the measurement
                                const parsedResult = parse4Electrode50kHzImpedance(responseData);

                                if (parsedResult && parsedResult.impedance.value > 0) {
                                    // Real data received - store it
                                    results.meaningfulResponses.push(parsedResult);
                                    console.log(`${statusResult.message}`);
                                    console.log(`         Phase Angle: ${parsedResult.phaseAngle.value.toFixed(1)}°, Impedance: ${parsedResult.impedance.value}Ω`);

                                    // Check for stable responses
                                    if (isStableResponse(results.meaningfulResponses)) {
                                        console.log(`\n Stable measurements detected after ${attempt} attempts!`);
                                        break;  // Exit loop - we have stable data
                                    }
                                } else {
                                    // Status says success but impedance is 0 - something's wrong
                                    console.log(` Status success but impedance is 0`);
                                    results.zeroResponses.push({
                                        attempt,
                                        rawResponse: responseData,
                                        reason: 'Status success but impedance is 0',
                                        statusCode: measurementStatus
                                    });
                                }

                            } else if (statusResult.decision.shouldWait) {
                                // Status 0x02: MEASURE - Device still measuring
                                // ⏳ Wait for device to complete measurement
                                console.log(`      ⏳ ${statusResult.message} (waiting ${statusResult.waitTime || 500}ms)`);
                                results.zeroResponses.push({
                                    attempt,
                                    rawResponse: responseData,
                                    reason: 'Device still measuring (status 0x02)',
                                    statusCode: measurementStatus
                                });
                                // Small wait before next attempt
                                await new Promise(resolve => setTimeout(resolve, statusResult.waitTime || 500));
                                continue;

                            } else if (statusResult.decision.shouldRetry) {
                                // Status 0x04: ERROR_RANGER or 0x05: ERROR_REPEAT
                                //  Retryable error - can try again
                                console.log(` ${statusResult.message}`);

                                results.errorResponses.push({
                                    attempt,
                                    error: statusResult.message,
                                    statusCode: measurementStatus,
                                    canRetry: statusResult.canRetry,
                                    maxRetries: statusResult.maxRetries
                                });

                                // Check if we can retry
                                if (!statusResult.decision.maxRetriesReached) {
                                    // Use handler's smart retry logic
                                    const retryResult = await ImprovedImpedanceStatusHandler.handleRetry(
                                        measurementStatus,
                                        attempt,
                                        50  // Max attempts in this loop
                                    );

                                    if (retryResult.shouldRetry) {
                                        console.log(`      ↻ Retrying (attempt ${retryResult.nextAttempt})...`);
                                        continue;  // Continue loop to retry
                                    }
                                } else {
                                    console.log(` Max retries reached (${statusResult.maxRetries})`);
                                }

                            } else if (statusResult.decision.isCritical) {
                                // Status 0x01: CHECK_ELECTRODE
                                // CRITICAL - Electrode problem, must stop
                                console.log(`\n CRITICAL: ${statusResult.message}`);

                                results.errorResponses.push({
                                    attempt,
                                    error: statusResult.message,
                                    statusCode: measurementStatus,
                                    isCritical: true
                                });

                                // Show user-friendly error message
                                if (statusResult.userMessage) {
                                    console.log(`\n${statusResult.userMessage}`);
                                }

                                // Show solutions
                                if (statusResult.solutions) {
                                    console.log(`\nRecommended Actions:`);
                                    statusResult.solutions.forEach(solution => {
                                        console.log(`   ${solution}`);
                                    });
                                }

                                console.log(`\n  CRITICAL ERROR - Stopping measurement for ${mode.name}`);
                                break;  // Exit loop - can't continue with electrode problem

                            } else if (statusResult.decision.shouldAbort) {
                                // Status 0x06: USER_EXIT or other abort conditions
                                // ⏹️ Stop measurement (user cancelled or other reason)
                                console.log(`      ⏹️  ${statusResult.message}`);

                                results.zeroResponses.push({
                                    attempt,
                                    rawResponse: responseData,
                                    reason: statusResult.message,
                                    statusCode: measurementStatus
                                });
                                break;  // Exit loop

                            } else {
                                // Unknown/unhandled status
                                console.log(` Unhandled status: 0x${measurementStatus.toString(16).toUpperCase()}`);
                                results.zeroResponses.push({
                                    attempt,
                                    rawResponse: responseData,
                                    reason: `Unknown status: 0x${measurementStatus.toString(16)}`,
                                    statusCode: measurementStatus
                                });
                            }

                        } else {
                            // Invalid response format (header mismatch)
                            console.warn(`Invalid response format`);
                            results.zeroResponses.push({
                                attempt,
                                rawResponse: responseData,
                                reason: 'Invalid response format'
                            });
                        }
                    } else if (responseData) {
                        console.warn(` Unexpected response length: ${responseData.length} bytes`);
                        results.zeroResponses.push({
                            attempt,
                            rawResponse: responseData,
                            reason: 'Unexpected response length'
                        });
                    }

                    // Delay between attempts
                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (queryError) {
                    console.error(`      ❌ Attempt ${attempt} failed: ${queryError.message}`);
                    results.errorResponses.push({
                        attempt,
                        error: queryError.message,
                        exception: true
                    });
                }
            }

            // Store results for this mode
            phaseAngleResults[mode.name] = results;
        }

        // ✅ ENHANCED: Display comprehensive results
        console.log('\n' + '='.repeat(70));
        console.log('📊 PHASE ANGLE MEASUREMENT RESULTS');
        console.log('='.repeat(70));

        Object.entries(phaseAngleResults).forEach(([mode, results]) => {
            console.log(`\n${mode}:`);
            console.log(`   Total Attempts: ${results.attempts}`);
            console.log(`   Successful Readings: ${results.meaningfulResponses.length}`);
            console.log(`   Measuring/Waiting: ${results.zeroResponses.length}`);
            console.log(`   Errors: ${results.errorResponses.length}`);

            // ✅ ENHANCED: Show status code breakdown
            if (Object.keys(results.statusCodes).length > 0) {
                console.log(`\n   Status Code Breakdown:`);
                Object.entries(results.statusCodes).forEach(([code, count]) => {
                    const codeNum = parseInt(code);
                    const codeMap = {
                        0x00: 'NULL',
                        0x01: 'CHECK_ELECTRODE',
                        0x02: 'MEASURE',
                        0x03: 'SUCCESS',
                        0x04: 'ERROR_RANGER',
                        0x05: 'ERROR_REPEAT',
                        0x06: 'USER_EXIT'
                    };
                    const codeName = codeMap[codeNum] || 'UNKNOWN';
                    console.log(`      0x${codeNum.toString(16).toUpperCase()} (${codeName}): ${count}x`);
                });
            }

            // Show error details if any
            if (results.errorResponses.length > 0) {
                console.log(`\n   Error Details:`);
                results.errorResponses.slice(0, 5).forEach(err => {
                    const statusStr = err.statusCode !== undefined
                        ? ` [0x${err.statusCode.toString(16).toUpperCase()}]`
                        : '';
                    const criticalStr = err.isCritical ? ' (CRITICAL)' : '';
                    console.log(`      Attempt ${err.attempt}: ${err.error}${statusStr}${criticalStr}`);
                });
                if (results.errorResponses.length > 5) {
                    console.log(`      ... and ${results.errorResponses.length - 5} more errors`);
                }
            }

            // Analyze phase angle results if we have any
            if (results.meaningfulResponses.length > 0) {
                const rawPhaseAngles = results.meaningfulResponses.map(r => r.phaseAngle.phaseAngleRaw);
                const phaseAngles = results.meaningfulResponses.map(r => r.phaseAngle.value);
                const impedanceValues = results.meaningfulResponses.map(r => r.impedance.value);

                console.log('\n   📐 Phase Angle Statistics:');
                console.log(`      Phase angle raw: ${rawPhaseAngles}°`);
                console.log(`      Min: ${Math.min(...phaseAngles).toFixed(1)}°`);
                console.log(`      Max: ${Math.max(...phaseAngles).toFixed(1)}°`);
                console.log(`      Avg: ${(phaseAngles.reduce((a, b) => a + b, 0) / phaseAngles.length).toFixed(1)}°`);
                console.log(`      Range: ${(Math.max(...phaseAngles) - Math.min(...phaseAngles)).toFixed(1)}°`);

                console.log('\n   ⚡ Impedance Statistics:');
                console.log(`      Min: ${Math.min(...impedanceValues)} Ω`);
                console.log(`      Max: ${Math.max(...impedanceValues)} Ω`);
                console.log(`      Avg: ${(impedanceValues.reduce((a, b) => a + b, 0) / impedanceValues.length).toFixed(1)} Ω`);
                console.log(`      Range: ${Math.max(...impedanceValues) - Math.min(...impedanceValues)} Ω`);

                // Show all readings
                console.log('\n   📈 All Readings:');
                results.meaningfulResponses.forEach((reading, idx) => {
                    console.log(`      Reading ${idx + 1}: ${reading.phaseAngle.value.toFixed(1)}°, ${reading.impedance.value}Ω`);
                });
            } else {
                console.log('\n   ❌ No successful readings received!');
            }
        });

        // ✅ ENHANCED: Display global error statistics
        if (Object.keys(globalErrorCounts).length > 0) {
            console.log('\n' + '='.repeat(70));
            console.log('📊 GLOBAL ERROR CODE STATISTICS');
            console.log('='.repeat(70));
            // Display error statistics using handler
            ImprovedImpedanceStatusHandler.displayErrorStatistics(globalErrorCounts);
        }

        console.log('='.repeat(70));
        showMenu();

    } catch (error) {
        console.error('❌ Phase angle query failed:', error);
        showMenu();
    }
}

// Specific parsing function for 50 kHz 4-electrode response

function parse4Electrode50kHzImpedance(data) {
    // Validate response header
    if (data[0] !== 0xAA || data[2] !== 0xB1) {
        return null;
    }

    // Verify response length
    if (data.length < 13) {
        return null;
    }

    try {
        // Parse Byte 3: Frequency Code
        const frequencyCode = (data[3] >> 4) & 0x0F;
        const responseTypeCode = data[3] & 0x0F;

        // Parse Byte 4: Measurement Status
        const measurementStatus = data[4];

        // Parse Byte 5: Data Type
        const dataType = data[5];

        // ✅ Parse Bytes 6-7: Phase Angle (SIGNED 16-bit, little-endian)
        // Resolution: 0.1° (magnified 10 times)
        let phaseAngleRaw = (data[6] & 0xFF) | ((data[7] & 0xFF) << 8);

        // Convert to signed if necessary
        if (phaseAngleRaw > 32767) {
            phaseAngleRaw = phaseAngleRaw - 65536;
        }
        const phaseAngle = phaseAngleRaw / 10;

        // ✅ Parse Bytes 8-11: Impedance (UNSIGNED 32-bit, little-endian)
        // Resolution: 1Ω (NOT 0.1Ω)
        const impedanceRaw =
            (data[8] & 0xFF) |
            ((data[9] & 0xFF) << 8) |
            ((data[10] & 0xFF) << 16) |
            ((data[11] & 0xFF) << 24);
        const impedance = impedanceRaw;  // Resolution: 1Ω

        // Parse Byte 12: Checksum
        const checksum = data[12];

        // Return parsed result
        return {
            measurementType: '4-Electrode 50 kHz',
            frequency: getFrequencyName(frequencyCode),
            responseType: getResponseTypeName(responseTypeCode),
            measurementStatus: {
                code: measurementStatus,
                description: interpretMeasurementStatus(measurementStatus)
            },
            phaseAngle: {
                value: phaseAngle,
                unit: '°',
                rawBytes: [data[6], data[7]],
                rawValue: phaseAngleRaw,
                resolution: 0.1
            },
            impedance: {
                value: impedance,
                unit: 'Ω',
                rawBytes: [data[8], data[9], data[10], data[11]],
                rawValue: impedanceRaw,
                resolution: 1  // ✅ Resolution is 1Ω
            },
            rawData: {
                fullResponse: Array.from(data)
            }
        };
    } catch (error) {
        console.error(`Error parsing response: ${error.message}`);
        return null;
    }
}





// Helper function to interpret measurement status
function interpretMeasurementStatus(statusByte) {
    const statusDescriptions = {
        0x00: 'Normal measurement',
        0x01: 'Working mode error',
        0x02: 'Frequency error',
        0x03: 'Impedance measurement error',
        0x04: 'Over range',
        0x05: 'Under range'
    };

    return statusDescriptions[statusByte] || 'Unknown status';
}


//weight case
export async function case41_WeightMeasurement() {
    try {
        // ====================================================================
        // PORT CHECK
        // ====================================================================

        if (!biaPort || !biaPort.isOpen) {
            emitWeightStatus(0x09);  // PORT_ERROR
            console.log('❌ BIA port not connected');
           if(!IS_ELECTRON) showMenu();
            return;
        }

        // ====================================================================
        // RESULTS STORAGE
        // ====================================================================
        emitWeightStatus(0x00); // INFO / START
        const weightResults = {
            attempts: 0,
            measurements: [],
            stabilityChecks: [],
            errors: []
        };
        let finalweight = 0;

        // ====================================================================
        // STABILITY CHECK FUNCTION
        // ====================================================================

        const isStableWeight = (measurements) => {
            if (measurements.length < 4) return false;

            // 1. QUICK EXIT: CHECK FOR 4 CONSISTENT READINGS
            const lastThree = measurements.slice(-4);
            const weights3 = lastThree.map(m => m.calibratedWeight);
            
            // Ignore low weights
            if (weights3.some(w => w < 0.5)) return false;

            // Check max difference is minimal (< 0.1kg)
            const maxW = Math.max(...weights3);
            const minW = Math.min(...weights3);
            const range = maxW - minW;
            
            if (range < 0.1) {
                console.log(`\n✅ 4 Stable readings detected: ${weights3[weights3.length-1].toFixed(2)} kg (Range: ${range.toFixed(3)}kg). Stopping early.`);
                return true;
            }

            // 2. STANDARD VARIATION CHECK (Original Logic)
            if (measurements.length < 5) return false;

            // Get the last 5 measurements
            const lastFive = measurements.slice(-5);

            // Ensure all measurements have valid weight
            let validMeasurements = lastFive.filter(m =>
                m && m.calibratedWeight !== undefined && m.calibratedWeight > 0.5
            );

            if (validMeasurements.length < 5) return false;

            // Calculate weight variations
            let weights = validMeasurements.map(m => m.calibratedWeight);
            const maxWeight = Math.max(...weights);
            const minWeight = Math.min(...weights);
            const weightVariation = (maxWeight - minWeight) / maxWeight;

            console.log('Weight Stability Check:');
            console.log(`Weights: [${weights.map(w => w.toFixed(2)).join(', ')} kg]`);
            console.log(`Weight Variation: ${(weightVariation * 100).toFixed(2)}%`);
            measurements.statusCode = 0x03;
            // Stability criteria: within 5% variation
            return weightVariation < 0.05;
        };

        // ====================================================================
        // SETUP COMMANDS
        // ====================================================================

        const setWeightModeCommand = [0x55, 0x05, 0xA0, 0x01, 0x05];
        const weightQueryCommand = [0x55, 0x05, 0xA1, 0x00, 0x05];

        // Stop current test
        try {
            await sendBiaCommand([0x55, 0x06, 0xB0, 0x00, 0x00, 0xF5]);
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.log('⚠️ Warning: Could not stop current test');
        }

        // Set weight mode
        try {
            await sendBiaCommand(setWeightModeCommand);
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            emitWeightStatus(0x08);  // TIMEOUT
            console.log('❌ Failed to set weight mode');
           if(!IS_ELECTRON) showMenu();
            return;
        }

        // Maximum attempts
        const MAX_ATTEMPTS = 20;

        // ====================================================================
        // MEASUREMENT LOOP
        // ====================================================================

        while (weightResults.attempts < MAX_ATTEMPTS) {
            try {
                weightResults.attempts++;
                console.log(`\n Weight Measurement Attempt ${weightResults.attempts}`);

                // ══════════════════════════════════════════════════════════
                // SEND QUERY COMMAND
                // ══════════════════════════════════════════════════════════

                let responseData;
                try {
                    responseData = await sendBiaCommand(weightQueryCommand, {
                        timeout: 5000,
                        verbose: false
                    });
                } catch (error) {
                    emitWeightStatus(0x08);  // TIMEOUT
                    console.log(` Attempt ${weightResults.attempts}: No response`);
                    weightResults.errors.push({
                        attempt: weightResults.attempts,
                        error: 'Timeout'
                    });

                    if (weightResults.attempts >= MAX_ATTEMPTS) {
                        console.log(' Max attempts reached with no response');
                        break;
                    }

                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }

                // ══════════════════════════════════════════════════════════
                // VALIDATE RESPONSE FORMAT
                // ══════════════════════════════════════════════════════════

                if (!responseData || responseData.length < 14) {
                    emitWeightStatus(0x0A);  // INVALID_RESPONSE
                    console.log(` Attempt ${weightResults.attempts}: Invalid response format`);
                    weightResults.errors.push({
                        attempt: weightResults.attempts,
                        error: 'Invalid response format'
                    });
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }

                if (responseData[0] !== 0xAA || responseData[2] !== 0xA1) {
                    emitWeightStatus(0x0A);  // INVALID_RESPONSE
                    console.log(` Attempt ${weightResults.attempts}: Invalid response header`);
                    weightResults.errors.push({
                        attempt: weightResults.attempts,
                        error: 'Invalid response header'
                    });
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }

                // ══════════════════════════════════════════════════════════
                // PARSE WEIGHT
                // ══════════════════════════════════════════════════════════

                const statusByte = responseData[3];
                const rawWeight = ((responseData[6] << 8) | responseData[5]) / 10.0;

                // Validate raw weight
                if (isNaN(rawWeight) || rawWeight < 0) {
                    emitWeightStatus(0x0A);  // INVALID_RESPONSE
                    console.log(`Attempt ${weightResults.attempts}: Invalid weight value`);
                    weightResults.errors.push({
                        attempt: weightResults.attempts,
                        error: 'Invalid weight value'
                    });
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
        }   

                // ══════════════════════════════════════════════════════════
                // APPLY CALIBRATION
                // ══════════════════════════════════════════════════════════

                const WEIGHT_ZERO_OFFSET = 0.0;    // Set from case 15
                const CALIBRATION_FACTOR = 2.200244;     // Set from case 15
                const calibratedWeightCatty = (rawWeight - WEIGHT_ZERO_OFFSET) * CALIBRATION_FACTOR;
                const calibratedWeight = calibratedWeightCatty * 0.5;
                // const calibratedWeight = rawWeight * CALIBRATION_FACTOR;
                // Validate calibrated weight
                if (isNaN(calibratedWeight) || calibratedWeight < 0) {
                    emitWeightStatus(0x06);  // CALIBRATION_ERROR
                    console.log(` Attempt ${weightResults.attempts}: Calibration error`);
                    weightResults.errors.push({
                        attempt: weightResults.attempts,
                        error: 'Calibration error'
                    });

                    if (weightResults.attempts >= MAX_ATTEMPTS) {
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }
                // ══════════════════════════════════════════════════════════
                // PARSE STATUS BITS
                // ══════════════════════════════════════════════════════════

                let isStable = false;
                let isZero = false;
                let isOverload = false;
                let isUnderload = false;

                // ══════════════════════════════════════════════════════════
                // DETERMINE ERROR CODE & CHECK VALIDITY
                // ══════════════════════════════════════════════════════════

                let statusCode = 0x03;  // Default STABLE

                // Check for zero weight
                if (calibratedWeight === 0) {
                    
                    isZero = true;
                    statusCode = 0x01;  // ZERO_POINT
                   // emitWeightStatus(statusCode, calibratedWeight);
                }
                // Check for overload
                else if (calibratedWeight > 150) {
                    isOverload =true
                    statusCode = 0x04;  // OVERLOAD
                    emitWeightStatus(statusCode, calibratedWeight);
                    console.log(' Scale overloaded - measurement aborted');
                    weightResults.errors.push({
                        attempt: weightResults.attempts,
                        statusCode: statusCode,
                        weight: calibratedWeight,
                        error: 'Scale overloaded'
                    });
                    break;  // Stop on overload
                }
                // Check for underload - user standing but weight very low
                else if (calibratedWeight < 1.0) {
                    isUnderload = true;
                    statusCode = 0x05;  // UNDERLOAD
                    emitWeightStatus(statusCode, calibratedWeight);
                    console.log(`  Weight too low: ${calibratedWeight.toFixed(2)} kg`);
                    weightResults.errors.push({
                        attempt: weightResults.attempts,
                        statusCode: statusCode,
                        weight: calibratedWeight,
                        error: 'Weight too low'
                    });
                    // Continue trying for valid weight
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }
                // Check for unstable
                // else if (!isStable) {
                //     statusCode = 0x02;  // UNSTABLE
                // }
                // Valid stable weight
                else if (calibratedWeight > 20 && calibratedWeight <= 150) {
                    isStable = true;
                    statusCode = 0x03;  // STABLE
                }

                // ══════════════════════════════════════════════════════════
                // HANDLE STATUS
                // ══════════════════════════════════════════════════════════

                emitWeightStatus(statusCode, calibratedWeight);

                console.log(`   Raw Weight: ${rawWeight.toFixed(2)} kg`);
                console.log(`   Calibrated Weight: ${calibratedWeight.toFixed(2)} kg`);
                console.log(`   Status: ${statusCode === 0x03 ? '✅ Stable' : '⏳ Unstable'}`);

                // ══════════════════════════════════════════════════════════
                // STORE MEASUREMENT
                // ══════════════════════════════════════════════════════════

                const measurementDetails = {
                    attempt: weightResults.attempts,
                    rawWeight: rawWeight,
                    calibratedWeight: calibratedWeight,
                    statusByte: statusByte,
                    statusCode: statusCode,
                    isStable: isStable,
                    isOverload: isOverload,
                    isUnderload: isUnderload,
                    isZero: isZero
                };

                weightResults.measurements.push(measurementDetails);

                // ══════════════════════════════════════════════════════════
                // CHECK FOR STABILITY
                // ══════════════════════════════════════════════════════════

                if (calibratedWeight > 0.5) {  // Only check stability for valid weights
                    if (isStableWeight(weightResults.measurements)) {
                        console.log("------neetu------");
                        console.log(weightResults.measurements);
                        console.log('\n Stable weight measurement detected!');
                        break;
                    }
                }

                // Delay between attempts
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (queryError) {
                emitWeightStatus(0x07);  // SENSOR_ERROR
                console.error(` Attempt ${weightResults.attempts} error: ${queryError.message}`);
                weightResults.errors.push({
                    attempt: weightResults.attempts,
                    error: queryError.message
                });

                if (weightResults.attempts >= MAX_ATTEMPTS) {
                    break;
                }
            }
        }

        // ====================================================================
        // DISPLAY RESULTS
        // ====================================================================

        console.log('\n' + '='.repeat(70));
        console.log('⚖️  WEIGHT MEASUREMENT RESULTS');
        console.log('='.repeat(70));

        console.log(`\nTotal Attempts: ${weightResults.attempts}`);
        console.log(`Valid Measurements: ${weightResults.measurements.length}`);
        console.log(`Errors: ${weightResults.errors.length}`);

        // ════════════════════════════════════════════════════════════════
        // SHOW MEASUREMENTS
        // ════════════════════════════════════════════════════════════════

        if (weightResults.measurements.length > 0) {
            console.log('\nWEIGHT MEASUREMENTS:');

            weightResults.measurements.forEach((m) => {
                const statusName = {
                    0x01: 'ZERO',
                    0x02: 'UNSTABLE',
                    0x03: 'STABLE',
                    0x04: 'OVERLOAD',
                    0x05: 'UNDERLOAD'
                }[m.statusCode] || 'UNKNOWN';

                console.log(`   Attempt ${m.attempt}: ${m.calibratedWeight.toFixed(2)} kg (${statusName})`);
            });

            // Calculate statistics
            const validMeasurements = weightResults.measurements.filter(m => m.statusCode === 0x03);

            if (validMeasurements.length > 0) {
                const weights = validMeasurements.map(m => m.calibratedWeight);
                const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
                const maxWeight = Math.max(...weights);
                const minWeight = Math.min(...weights);

                console.log(`\n   Average: ${avgWeight.toFixed(2)} kg`);
                console.log(`   Range: ${minWeight.toFixed(2)} - ${maxWeight.toFixed(2)} kg`);

                const finalMeasurement = weightResults.measurements[weightResults.measurements.length - 1];
                console.log(`\n✅ FINAL WEIGHT: ${finalMeasurement.calibratedWeight.toFixed(2)} kg`);
                finalweight = finalMeasurement.calibratedWeight

            } else {
                console.log('\n No valid stable measurements collected');
            }
            
        } else {
            console.log('\n No measurements collected');
        }

        // ════════════════════════════════════════════════════════════════
        // SHOW ERRORS
        // ════════════════════════════════════════════════════════════════

        if (weightResults.errors.length > 0) {
            console.log('\n ERRORS ENCOUNTERED:');
            weightResults.errors.forEach((e) => {
                console.log(`   Attempt ${e.attempt}: ${e.error || e.statusCode}`);
            });
        }

        console.log('='.repeat(70) + '\n');

         if(!IS_ELECTRON)showMenu();
        
         const finalResult = {
            success: true,
            weight: finalweight
         };
         console.log(`\n📤 Sending Final Result to UI:`, finalResult);
         
         return finalResult;

    } catch (error) {
        emitWeightStatus(0x07);  // SENSOR_ERROR
        console.error(' Weight measurement failed:', error.message);
        console.error(error);
      if(!IS_ELECTRON)showMenu();
    }
}

// Show menu
function showMenu() {
     if(IS_ELECTRON) return;
    console.log('1. List available ports');
    console.log('2. Connect Height Sensor (9600 baud)');
    console.log('3. Connect BIA Scale (38400 baud)');
    console.log('4. Disconnect Height');
    console.log('5. Disconnect BIA');
    console.log('6. Start Height Measurement');
    //  console.log('7.  Switch to Normal Weighing Mode (0xA0)');
    // console.log('8. Read Weight Status (0xA1)');
    console.log('7. Measure Weight');
    console.log('9. Calculate Impedance 20khz');
    console.log('10. Calculate Impedance 100khz');
    console.log('11. Calculate Full Body Composition');
    console.log('12. Phase Angle Calculation');
    console.log('13. Send Custom Command');
    console.log('14. Calibrate the machine');
    console.log('15. Tare the machine');
    console.log('0. Exit');
    console.log('='.repeat(60));
}

// Handle menu choice

// Main startup
showMenu();

// Graceful shutdown
if (!IS_ELECTRON) {
    process.on('SIGINT', async () => {
    console.log('\n Shutting down...');
    if (heightPort && heightPort.isOpen) {
        await new Promise((resolve) => heightPort.close(resolve));
    }
    if (biaPort && biaPort.isOpen) {
        await new Promise((resolve) => biaPort.close(resolve));
    }
    process.exit(0);
});
}