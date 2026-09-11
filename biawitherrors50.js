import { SerialPort } from "serialport"
import readline from "readline"
import fs from "fs"
let heightPort = null
let biaPort = null
let heightResponseTimeout = null
let heightWaitingForResponse = false

const IS_ELECTRON = false // or however you actually detect the Electron host

const WEIGHT_STABILITY_COUNT = 10     // samples in the rolling stability window
const WEIGHT_MIN_VALID = 1.0          // kg — matches your underload threshold
const WEIGHT_CV_THRESHOLD = 0.01      // 1% coefficient of variation
const WEIGHT_SD_CEILING = 0.05        // kg

function emitWeightStatus(code, weight = null) {
    handleWeightStatus(code, weight) // reuse the function that already exists
}
// ================================================================
// GLOBAL ERROR HANDLER - BMH05108 PROTOCOL
// ================================================================

const IMPEDANCE_ERROR_CODES = {
    0x00: {
        code: "NULL",
        severity: "INFO",
        message: "BIA_NULL - Null state",
        description: "Device has not received measurement request",
        action: "INFO",
        canRetry: false,
        nextStep: "Continue with measurement",
        userMessage: "ℹDevice not initialized - measurement ready to start"
    },
    0x01: {
        code: "ELECTRODE",
        severity: "WARNING",
        message: "Ensure your are holding electrodes properly",
        description: "Device detected electrode contact problem",
        action: "ACCEPT",
        canRetry: false,
        nextStep: "Stop measurement and check electrodes",
        userMessage: "Ensure your are holding electrodes properly",
        causes: [
            "Electrode not properly connected",
            "Loose electrode contact",
            "Poor skin contact",
            "Broken electrode pad"
        ],
        solutions: [
            "1. Inspect all electrodes visually",
            "2. Reseat each electrode firmly",
            "3. Clean electrode pads with alcohol",
            "4. Check for bent pins/connectors",
            "5. Try replacement electrode pads",
            "6. Restart measurement"
        ]
    },
    0x02: {
        code: "MEASURE",
        severity: "INFO",
        message: "BIA_MEASURE - Measurement in progress",
        description: "Device is currently measuring - wait for completion",
        action: "WAIT",
        canRetry: false,
        nextStep: "Wait for measurement to complete",
        userMessage: "Device is measuring... Please wait",
        waitTime: 3000
    },
    0x03: {
        code: "SUCCESS",
        severity: "SUCCESS",
        message: "BIA_SUCCESS - Measurement successful",
        description: "Device measurement completed successfully",
        action: "ACCEPT",
        canRetry: false,
        nextStep: "Accept measurement and continue",
        userMessage: "Impedance measurement successful",
        expectation: "Data is valid and ready to use"
    },
    0x04: {
        code: "ERROR_RANGER",
        severity: "ERROR",
        message: "BIA_ERROR_RANGER - Impedance out of range (10-1600Ω)",
        description: "Measured value is outside acceptable range",
        action: "RETRY",
        canRetry: true,
        maxRetries: 3,
        waitBeforeRetry: 2000,
        nextStep: "Retry measurement with corrected conditions",
        userMessage:
            "MEASUREMENT OUT OF RANGE\n   • Impedance value is outside valid range\n   • Check electrode contact quality\n   • Verify skin contact\n   • Adjust electrode placement",
        issues: [
            "Impedance too low (short circuit)",
            "Impedance too high (poor contact)",
            "Invalid measurement"
        ],
        solutions: [
            "1. Check electrode contact pressure",
            "2. Ensure skin is clean and slightly moist",
            "3. Reposition electrodes if needed",
            "4. Apply conductive gel if dry",
            "5. Dry skin if wet",
            "6. Retry measurement"
        ]
    },
    0x05: {
        code: "ERROR_REPEAT",
        severity: "ERROR",
        message: "BIA_ERROR_REPEAT - Abnormal data detected",
        description: "Device detected abnormal data, measurement failed",
        action: "RETRY",
        canRetry: true,
        maxRetries: 3,
        waitBeforeRetry: 2000,
        nextStep: "Retry the impedance measurement",
        userMessage:
            "MEASUREMENT FAILED\n   • Please try again\n   • If problem persists:\n     - Check electrode connections\n     - Verify skin contact\n     - Check device status",
        issues: [
            "Electrode connection lost during measurement",
            "User moved during measurement",
            "Sensor malfunction"
        ],
        solutions: [
            "1. Ensure user is still for measurement",
            "2. Check all electrode connections",
            "3. Retry measurement",
            "4. If persists, restart device"
        ]
    },
    0x06: {
        code: "USER_EXIT",
        severity: "INFO",
        message: "BIA_USER_EXIT - User stopped measurement",
        description: "User cancelled the measurement",
        action: "CANCEL",
        canRetry: false,
        nextStep: "Can retry measurement anytime",
        userMessage: "Measurement cancelled by user",
        expectation: "Ready to restart measurement"
    }
}

const WEIGHT_ERROR_CODES = {
    0x00: {
        code: "NULL",
        severity: "INFO",
        message: "WEIGHT_NULL - Null state",
        description: "Scale has not received measurement request",
        action: "INFO",
        canRetry: false,
        nextStep: "Continue with weight measurement",
        userMessage: "ℹ️ Scale not initialized - measurement ready to start"
    },
    0x01: {
        code: "ZERO_POINT",
        severity: "WARNING",
        message: "WEIGHT_ZERO - Zero weight detected",
        description: "Scale reading is at zero point",
        action: "ACCEPT",
        canRetry: false,
        nextStep: "Accept zero reading (empty scale confirmed)",
        userMessage: "⚖️ Scale reading: 0 kg (Empty scale)",
        expectation: "No weight on scale"
    },
    0x02: {
        code: "UNSTABLE",
        severity: "WARNING",
        message: "WEIGHT_UNSTABLE - Unstable reading",
        description: "Weight reading is fluctuating",
        action: "WAIT",
        canRetry: false,
        nextStep: "Wait for weight to stabilize",
        userMessage: "⏳ Weight is unstable, please wait...",
        waitTime: 2000,
        causes: [
            "User moving on scale",
            "Scale still settling",
            "Wind or vibration",
            "Scale needs stabilization"
        ],
        solutions: [
            "1. Keep user still on scale",
            "2. Wait 2-3 seconds for settling",
            "3. Ensure scale is on level surface",
            "4. Remove any vibration sources",
            "5. Retry measurement"
        ]
    },
    0x03: {
        code: "STABLE",
        severity: "SUCCESS",
        message: "WEIGHT_STABLE - Stable weight reading",
        description: "Weight measurement is stable and valid",
        action: "ACCEPT",
        canRetry: false,
        nextStep: "Accept weight measurement and continue",
        userMessage: "✅ Weight measurement stable and valid",
        expectation: "Data is valid and ready to use"
    },
    0x04: {
        code: "OVERLOAD",
        severity: "ERROR",
        message: "WEIGHT_OVERLOAD - Scale overloaded",
        description: "Measured weight exceeds scale maximum capacity",
        action: "ABORT",
        canRetry: false,
        nextStep: "Remove weight and retry",
        userMessage:
            "⚠️ SCALE OVERLOADED!\n   • Weight exceeds maximum capacity\n   • Remove weight from scale\n   • Check weight is reasonable\n   • Retry measurement",
        maxCapacity: 150, // kg
        issues: ["Weight exceeds 150 kg", "Multiple people on scale", "Scale needs recalibration"],
        solutions: [
            "1. Remove all weight from scale",
            "2. Check if weight is within 0-150 kg range",
            "3. Ensure only one person on scale",
            "4. Wait for scale to zero",
            "5. Retry measurement",
            "6. If persists, recalibrate scale"
        ]
    },
    0x05: {
        code: "UNDERLOAD",
        severity: "WARNING",
        message: "WEIGHT_UNDERLOAD - Weight too low",
        description: "Measured weight is below minimum threshold",
        action: "RETRY",
        canRetry: true,
        maxRetries: 2,
        waitBeforeRetry: 1500,
        nextStep: "Retry measurement after weight stabilization",
        userMessage:
            "⚠️ WEIGHT TOO LOW\n   • Check if user is on scale\n   • Ensure proper contact with scale\n   • Wait for scale to settle\n   • Retry measurement",
        minThreshold: 20, // kg
        issues: ["User not properly on scale", "Poor contact with scale", "Scale needs zeroing"],
        solutions: [
            "1. Ensure user stands firmly on scale",
            "2. Check all feet contact scale platform",
            "3. Wait 2-3 seconds for settling",
            "4. Remove shoes if very light",
            "5. Retry measurement"
        ]
    },
    0x06: {
        code: "CALIBRATION_ERROR",
        severity: "ERROR",
        message: "WEIGHT_CALIBRATION_ERROR - Calibration mismatch",
        description: "Calibration factor appears incorrect",
        action: "RETRY",
        canRetry: true,
        maxRetries: 1,
        waitBeforeRetry: 1000,
        nextStep: "Retry measurement, consider recalibration",
        userMessage:
            "CALIBRATION ERROR\n   • Reading seems incorrect\n   • Please retry measurement\n   • If persistent, run calibration",
        issues: ["Calibration factor incorrect", "Scale has drifted", "Temperature change"],
        solutions: [
            "1. Retry measurement on empty scale (should be 0 kg)",
            "2. Retry with known weight",
            "3. If reading is off, run calibration (case 15)",
            "4. Check scale is on level surface",
            "5. Contact support if persists"
        ]
    },
    0x07: {
        code: "SENSOR_ERROR",
        severity: "CRITICAL",
        message: "WEIGHT_SENSOR_ERROR - Sensor malfunction",
        description: "Scale sensor is not responding correctly",
        action: "ABORT",
        canRetry: false,
        nextStep: "Check scale hardware, may need service",
        userMessage:
            "SCALE SENSOR ERROR\n   • Scale sensor not responding\n   • Hardware may be faulty\n   • Contact support or service scale",
        issues: ["Sensor disconnected", "Sensor malfunction", "Scale hardware failure"],
        solutions: [
            "1. Check power to scale",
            "2. Verify USB/serial connection",
            "3. Restart scale (power cycle)",
            "4. Restart software",
            "5. If persists, scale needs service"
        ]
    },
    0x08: {
        code: "TIMEOUT",
        severity: "ERROR",
        message: "WEIGHT_TIMEOUT - Measurement timeout",
        description: "Scale did not respond to measurement query",
        action: "RETRY",
        canRetry: true,
        maxRetries: 3,
        waitBeforeRetry: 2000,
        nextStep: "Retry measurement",
        userMessage:
            "⏱️ MEASUREMENT TIMEOUT\n   • Scale did not respond\n   • Check connection\n   • Retry measurement",
        issues: ["Serial connection interrupted", "Scale unresponsive", "Communication error"],
        solutions: [
            "1. Check USB/serial cable connection",
            "2. Check scale power LED",
            "3. Restart scale",
            "4. Retry measurement",
            "5. Restart software if persists"
        ]
    },
    0x09: {
        code: "PORT_ERROR",
        severity: "CRITICAL",
        message: "WEIGHT_PORT_ERROR - Port not connected",
        description: "Weight port (scale) is not connected",
        action: "ABORT",
        canRetry: false,
        nextStep: "Connect scale and select measurement again",
        userMessage:
            "SCALE NOT CONNECTED\n   • Please connect scale via USB/Serial\n   • Check connection in menu option 3\n   • Try again after connecting",
        issues: ["USB cable disconnected", "Serial port not opened", "Scale powered off"],
        solutions: [
            "1. Check USB cable is connected to scale",
            "2. Check USB cable is connected to computer",
            "3. Power on the scale",
            "4. Select option 3 to connect weight scale",
            '5. Verify connection shows "connected"',
            "6. Then retry measurement"
        ]
    },
    0x0a: {
        code: "INVALID_RESPONSE",
        severity: "ERROR",
        message: "WEIGHT_INVALID_RESPONSE - Invalid response format",
        description: "Scale responded but with invalid data format",
        action: "RETRY",
        canRetry: true,
        maxRetries: 2,
        waitBeforeRetry: 1000,
        nextStep: "Retry measurement",
        userMessage:
            "INVALID RESPONSE\n   • Scale sent invalid data\n   • May be communication error\n   • Retrying measurement",
        issues: ["Data corruption", "Serial communication error", "Scale firmware issue"],
        solutions: [
            "1. Retry measurement",
            "2. Check USB cable quality",
            "3. Restart scale",
            "4. Update scale firmware if available",
            "5. Contact support if persists"
        ]
    }
}

const HEIGHT_ERROR_CODES = {
    0x00: {
        code: "NULL",
        severity: "INFO",
        message: "HEIGHT_NULL - Null state",
        description: "Height sensor has not received measurement request",
        action: "INFO",
        canRetry: false,
        nextStep: "Continue with height measurement",
        userMessage: "ℹ️ Height sensor not initialized - measurement ready to start"
    },
    0x01: {
        code: "OUT_OF_RANGE_LOW",
        severity: "ERROR",
        message: "HEIGHT_OUT_OF_RANGE_LOW - Height too low",
        description: "Measured height is below minimum range (< 80 cm)",
        action: "RETRY",
        canRetry: true,
        maxRetries: 2,
        waitBeforeRetry: 1500,
        nextStep: "Check user height and retry",
        userMessage:
            "HEIGHT OUT OF RANGE (TOO LOW)\n   • Measured height below 80 cm\n   • Check sensor alignment\n   • Ensure user standing straight\n   • Retry measurement",
        minHeight: 80, // cm
        issues: [
            "User not standing straight",
            "Sensor not aligned",
            "Child measurement (< 80 cm normal)",
            "Sensor malfunction"
        ],
        solutions: [
            "1. Ask user to stand straight",
            "2. Ensure feet are flat on ground",
            "3. Check sensor is at correct height",
            "4. Check sensor alignment",
            "5. Retry measurement",
            "6. If user is child, this is normal"
        ]
    },
    0x02: {
        code: "OUT_OF_RANGE_HIGH",
        severity: "ERROR",
        message: "HEIGHT_OUT_OF_RANGE_HIGH - Height too high",
        description: "Measured height exceeds maximum range (> 250 cm)",
        action: "RETRY",
        canRetry: true,
        maxRetries: 2,
        waitBeforeRetry: 1500,
        nextStep: "Check user height and retry",
        userMessage:
            "⚠️ HEIGHT OUT OF RANGE (TOO HIGH)\n   • Measured height above 250 cm\n   • Check sensor alignment\n   • Verify measurement is realistic\n   • Retry measurement",
        maxHeight: 250, // cm
        issues: [
            "User standing on object",
            "Sensor misaligned",
            "Sensor malfunction",
            "False reading"
        ],
        solutions: [
            "1. Ask user to step down if on anything",
            "2. Check user standing on flat ground",
            "3. Check sensor is properly aligned",
            "4. Verify height is realistic",
            "5. Retry measurement",
            "6. Check for obstructions"
        ]
    },
    0x03: {
        code: "UNSTABLE",
        severity: "WARNING",
        message: "HEIGHT_UNSTABLE - Unstable reading",
        description: "Height reading is fluctuating",
        action: "WAIT",
        canRetry: false,
        nextStep: "Wait for reading to stabilize",
        userMessage: "⏳ Height reading unstable, please wait...",
        waitTime: 2000,
        causes: ["User moving", "Sensor settling", "Vibrations", "Air currents affecting sensor"],
        solutions: [
            "1. Ask user to stand still",
            "2. Remove any moving objects",
            "3. Avoid air vents or fans",
            "4. Wait 2-3 seconds",
            "5. Retry measurement"
        ]
    },
    0x04: {
        code: "STABLE",
        severity: "SUCCESS",
        message: "HEIGHT_STABLE - Stable height reading",
        description: "Height measurement is stable and valid",
        action: "ACCEPT",
        canRetry: false,
        nextStep: "Accept height measurement and continue",
        userMessage: "✅ Height measurement stable and valid",
        expectation: "Data is valid and ready to use"
    },
    0x05: {
        code: "SENSOR_ERROR",
        severity: "CRITICAL",
        message: "HEIGHT_SENSOR_ERROR - Sensor malfunction",
        description: "Height sensor is not responding correctly",
        action: "ABORT",
        canRetry: false,
        nextStep: "Check sensor hardware, may need service",
        userMessage:
            " HEIGHT SENSOR ERROR\n   • Sensor not responding\n   • Hardware may be faulty\n   • Contact support or service sensor",
        issues: ["Sensor disconnected", "Sensor malfunction", "Hardware failure"],
        solutions: [
            "1. Check power to sensor",
            "2. Verify USB/serial connection",
            "3. Check sensor cable",
            "4. Restart sensor",
            "5. If persists, sensor needs service"
        ]
    },
    0x06: {
        code: "CALIBRATION_ERROR",
        severity: "ERROR",
        message: "HEIGHT_CALIBRATION_ERROR - Calibration mismatch",
        description: "Height sensor calibration appears incorrect",
        action: "RETRY",
        canRetry: true,
        maxRetries: 1,
        waitBeforeRetry: 1000,
        nextStep: "Retry measurement, consider recalibration",
        userMessage:
            "CALIBRATION ERROR\n   • Reading seems incorrect\n   • Please retry measurement\n   • If persistent, recalibrate sensor",
        issues: ["Calibration offset incorrect", "Sensor has drifted", "Temperature change"],
        solutions: [
            "1. Retry measurement",
            "2. Use reference height to verify",
            "3. If off, recalibrate sensor",
            "4. Check sensor is vertical",
            "5. Contact support if persists"
        ]
    },
    0x07: {
        code: "TIMEOUT",
        severity: "ERROR",
        message: "HEIGHT_TIMEOUT - Measurement timeout",
        description: "Height sensor did not respond to query",
        action: "RETRY",
        canRetry: true,
        maxRetries: 3,
        waitBeforeRetry: 2000,
        nextStep: "Retry measurement",
        userMessage:
            "⏱️ MEASUREMENT TIMEOUT\n   • Sensor did not respond\n   • Check connection\n   • Retry measurement",
        issues: ["Serial connection interrupted", "Sensor unresponsive", "Communication error"],
        solutions: [
            "1. Check USB/serial cable",
            "2. Check sensor power LED",
            "3. Restart sensor",
            "4. Retry measurement",
            "5. Restart software if persists"
        ]
    },
    0x08: {
        code: "PORT_ERROR",
        severity: "CRITICAL",
        message: "HEIGHT_PORT_ERROR - Port not connected",
        description: "Height sensor port is not connected",
        action: "ABORT",
        canRetry: false,
        nextStep: "Connect height sensor and select measurement again",
        userMessage:
            "❌ HEIGHT SENSOR NOT CONNECTED\n   • Please connect height sensor via USB/Serial\n   • Check connection in menu option 2\n   • Try again after connecting",
        issues: ["USB cable disconnected", "Serial port not opened", "Sensor powered off"],
        solutions: [
            "1. Check USB cable is connected to sensor",
            "2. Check USB cable is connected to computer",
            "3. Power on the height sensor",
            "4. Select option 2 to connect height sensor",
            '5. Verify connection shows "connected"',
            "6. Then retry measurement"
        ]
    },
    0x09: {
        code: "INVALID_RESPONSE",
        severity: "ERROR",
        message: "HEIGHT_INVALID_RESPONSE - Invalid response format",
        description: "Sensor responded but with invalid data format",
        action: "RETRY",
        canRetry: true,
        maxRetries: 2,
        waitBeforeRetry: 1000,
        nextStep: "Retry measurement",
        userMessage:
            " INVALID RESPONSE\n   • Sensor sent invalid data\n   • May be communication error\n   • Retrying measurement",
        issues: ["Data corruption", "Serial communication error", "Sensor firmware issue"],
        solutions: [
            "1. Retry measurement",
            "2. Check USB cable quality",
            "3. Restart sensor",
            "4. Update sensor firmware if available",
            "5. Contact support if persists"
        ]
    },
    0x0a: {
        code: "OBSTACLE_DETECTED",
        severity: "WARNING",
        message: "HEIGHT_OBSTACLE - Obstacle detected",
        description: "Object detected in sensor measurement path",
        action: "RETRY",
        canRetry: false,
        nextStep: "Remove obstacle and retry",
        userMessage:
            "⚠️ OBSTACLE DETECTED\n   • Something blocking sensor\n   • Clear the measurement area\n   • Ensure user can stand freely\n   • Retry measurement",
        issues: ["Object in measurement path", "User holding something", "Close to wall or object"],
        solutions: [
            "1. Remove any objects near sensor",
            "2. Ask user not to hold items",
            "3. Ensure adequate space",
            "4. Check sensor has clear view",
            "5. Retry measurement"
        ]
    }
}

class ImprovedImpedanceStatusHandler {
    /**
     * Handle impedance status code with comprehensive error information
     */
    static handleImpedanceStatus(statusCode, attemptNumber = 1) {
        console.log("STATUS CODE RECEIVED:", statusCode)
        try {
            // Validate status code
            if (!IMPEDANCE_ERROR_CODES[statusCode]) {
                return this.handleUnknownStatus(statusCode)
            }

            const errorInfo = IMPEDANCE_ERROR_CODES[statusCode]

            // Display error information
            this.displayErrorInfo(errorInfo, attemptNumber)

            // Return decision object
            return {
                code: statusCode,
                ...errorInfo,
                decision: this.makeDecision(errorInfo, attemptNumber)
            }
        } catch (error) {
            console.error("Error handling impedance status:", error.message)
            return {
                code: statusCode,
                error: error.message,
                action: "ERROR"
            }
        }
    }

    /**
     * Display formatted error information
     */
    static displayErrorInfo(errorInfo, attemptNumber) {
        console.log("\n" + "=".repeat(70))
        console.log(` ${errorInfo.message}`)
        console.log("=".repeat(70))

        // Show severity
        const severityEmoji = {
            CRITICAL: "❌",
            ERROR: "❌",
            WARNING: "⚠️",
            INFO: "ℹ️",
            SUCCESS: "✅"
        }

        console.log(`\nSeverity: ${severityEmoji[errorInfo.severity]} ${errorInfo.severity}`)
        console.log(
            `Status Code: 0x${errorInfo.code.charCodeAt(0).toString(16).toUpperCase()} (${errorInfo.code})`
        )

        if (attemptNumber > 1) {
            console.log(`Attempt: ${attemptNumber}`)
        }

        // Show description
        console.log(`\nDescription: ${errorInfo.description}`)

        // Show user-friendly message
        if (errorInfo.userMessage) {
            console.log(`\nMessage:\n${errorInfo.userMessage}`)
        }

        // Show causes if critical or error
        if (errorInfo.severity === "CRITICAL" || errorInfo.severity === "ERROR") {
            if (errorInfo.causes && errorInfo.causes.length > 0) {
                console.log(`\n Possible Causes:`)
                errorInfo.causes.forEach((cause, idx) => {
                    console.log(`   ${idx + 1}. ${cause}`)
                })
            }

            if (errorInfo.solutions && errorInfo.solutions.length > 0) {
                console.log(`\n✅ Recommended Solutions:`)
                errorInfo.solutions.forEach((solution) => {
                    console.log(`   ${solution}`)
                })
            }
        }

        // Show next step
        console.log(`\nNext Step: ${errorInfo.nextStep}`)

        if (errorInfo.canRetry) {
            console.log(`   Retry Capability: YES (Max ${errorInfo.maxRetries} attempts)`)
            console.log(`   Wait Before Retry: ${errorInfo.waitBeforeRetry / 1000} seconds`)
        }

        console.log("\n" + "=".repeat(70) + "\n")
    }

    /**
     * Handle unknown status code
     */
    static handleUnknownStatus(statusCode) {
        console.log(`\nUNKNOWN IMPEDANCE STATUS: 0x${statusCode.toString(16).toUpperCase()}`)
        console.log(`This status code is not recognized in the protocol.`)
        console.log(`Please check device documentation or verify the response data.\n`)

        return {
            code: statusCode,
            severity: "ERROR",
            message: `Unknown impedance status: 0x${statusCode.toString(16).toUpperCase()}`,
            action: "ERROR",
            canRetry: false,
            decision: {
                shouldRetry: false,
                shouldAbort: true,
                isCritical: true
            }
        }
    }

    /**
     * Make decision based on error code
     */
    static makeDecision(errorInfo, attemptNumber) {
        return {
            shouldRetry: errorInfo.canRetry,
            shouldAbort: errorInfo.action === "ABORT" || errorInfo.action === "CANCEL",
            shouldWait: errorInfo.action === "WAIT",
            shouldAccept: errorInfo.action === "ACCEPT",
            isCritical: errorInfo.severity === "CRITICAL",
            isSuccess: errorInfo.severity === "SUCCESS",
            waitTime: errorInfo.waitTime || errorInfo.waitBeforeRetry || 0,
            maxRetriesReached: attemptNumber >= errorInfo.maxRetries,
            action: errorInfo.action,
            attemptNumber: attemptNumber
        }
    }

    /**
     * Handle retry logic
     */
    static async handleRetry(statusCode, currentAttempt, maxAttempts) {
        const errorInfo = IMPEDANCE_ERROR_CODES[statusCode]

        if (!errorInfo || !errorInfo.canRetry) {
            return {
                shouldRetry: false,
                reason: "Retry not allowed for this error"
            }
        }

        if (currentAttempt >= maxAttempts) {
            return {
                shouldRetry: false,
                reason: `Maximum retry attempts (${maxAttempts}) reached`
            }
        }

        const waitTime = errorInfo.waitBeforeRetry || 2000

        console.log(`\nRetrying measurement in ${waitTime / 1000} seconds...`)
        console.log(`   Attempt ${currentAttempt + 1} of ${maxAttempts}`)

        await new Promise((resolve) => setTimeout(resolve, waitTime))

        return {
            shouldRetry: true,
            nextAttempt: currentAttempt + 1,
            waitTime: waitTime
        }
    }

    /**
     * Display error statistics
     */
    static displayErrorStatistics(errorCounts) {
        console.log("\n" + "=".repeat(70))
        console.log("ERROR STATISTICS")
        console.log("=".repeat(70))

        let totalErrors = 0
        const sortedCodes = Object.keys(errorCounts).sort()

        sortedCodes.forEach((code) => {
            const count = errorCounts[code]
            if (count > 0) {
                const errorInfo = IMPEDANCE_ERROR_CODES[code]
                const message = errorInfo ? errorInfo.code : `Unknown (0x${code})`
                console.log(`   0x${code}: ${message.padEnd(20)} - ${count} occurrence(s)`)
                totalErrors += count
            }
        })

        console.log(`\nTotal Errors: ${totalErrors}`)
        console.log("=".repeat(70) + "\n")
    }
}

class BIAError extends Error {
    constructor(message, severity = "ERROR", code = null) {
        super(message)
        this.name = "BIAError"
        this.severity = severity
        this.code = code
        this.timestamp = new Date().toISOString()
    }
}

class ErrorStats {
    constructor() {
        this.total = 0
        this.successes = 0
        this.errors = 0
        this.warnings = 0
        this.infos = 0
    }
    record(severity) {
        this.total++
        if (severity === "SUCCESS") this.successes++
        else if (severity === "ERROR") this.errors++
        else if (severity === "WARNING") this.warnings++
        else if (severity === "INFO") this.infos++
    }
    print() {
        console.log("\n" + "=".repeat(60))
        console.log("ERROR STATISTICS")
        console.log("=".repeat(60))
        console.log(
            `Total: ${this.total} | ✅ ${this.successes} | ❌ ${this.errors} | ⚠️ ${this.warnings} | ℹ️ ${this.infos}`
        )
        console.log("=".repeat(60) + "\n")
    }
}

const errorStats = new ErrorStats()

function handleError(code, message, severity = "ERROR") {
    let icon = "❌"
    if (severity === "SUCCESS") icon = "✅"
    else if (severity === "WARNING") icon = "⚠️"
    else if (severity === "INFO") icon = "ℹ️"

    console.log(`${icon} [${severity}] ${message}`)
    errorStats.record(severity)
    return new BIAError(message, severity, code)
}

function handleHeightStatus(statusCode, height = null) {
    const errorInfo = HEIGHT_ERROR_CODES[statusCode]

    if (!errorInfo) {
        console.log(`⚠️ Unknown height status code: 0x${statusCode.toString(16)}`)
        return
    }

    console.log("\n" + "=".repeat(70))
    console.log(`📏 HEIGHT MEASUREMENT STATUS`)
    console.log("=".repeat(70))

    console.log(`\nStatus: ${errorInfo.message}`)
    console.log(`Severity: ${errorInfo.severity}`)
    console.log(`Action: ${errorInfo.action}`)

    if (height !== null && height !== undefined) {
        console.log(`Height: ${height.toFixed(1)} cm`)
    }

    console.log(`\n${errorInfo.userMessage}`)

    if (errorInfo.issues) {
        console.log(`\nPossible Causes:`)
        errorInfo.issues.forEach((issue, idx) => {
            console.log(`   ${idx + 1}. ${issue}`)
        })
    }

    if (errorInfo.solutions) {
        console.log(`\nRecommended Solutions:`)
        errorInfo.solutions.forEach((solution) => {
            console.log(`   ${solution}`)
        })
    }

    console.log("=".repeat(70) + "\n")
}

function handleWeightStatus(statusCode, weight = null) {
    const errorInfo = WEIGHT_ERROR_CODES[statusCode]

    if (!errorInfo) {
        console.log(`⚠️ Unknown weight status code: 0x${statusCode.toString(16)}`)
        return
    }

    console.log("\n" + "=".repeat(70))
    console.log(`📊 WEIGHT MEASUREMENT STATUS`)
    console.log("=".repeat(70))

    console.log(`\nStatus: ${errorInfo.message}`)
    console.log(`Severity: ${errorInfo.severity}`)
    console.log(`Action: ${errorInfo.action}`)

    if (weight !== null && weight !== undefined) {
        console.log(`Weight: ${weight.toFixed(2)} kg`)
    }

    console.log(`\n${errorInfo.userMessage}`)

    if (errorInfo.issues) {
        console.log(`\nPossible Causes:`)
        errorInfo.issues.forEach((issue, idx) => {
            console.log(`   ${idx + 1}. ${issue}`)
        })
    }

    if (errorInfo.solutions) {
        console.log(`\nRecommended Solutions:`)
        errorInfo.solutions.forEach((solution) => {
            console.log(`   ${solution}`)
        })
    }

    console.log("=".repeat(70) + "\n")
}

// ================================================================
// END ERROR HANDLER
// ================================================================

// Create readline interface for CLI
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

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
}

const IMPEDANCE_MODES = {
    STOP_TEST: 0x00,
    EIGHT_ELECTRODE_SINGLE: 0x01,
    FOUR_ELECTRODE_LEGS: 0x02,
    FOUR_ELECTRODE_ARMS: 0x03,
    EIGHT_ELECTRODE_DUAL: 0x04
}

// ======================== HEIGHT MEASUREMENT ========================
const STABILITY_COUNT = 10
const STABILITY_THRESHOLD = 2
const WEIGHT_DEADBAND_KG = 0.02
const WEIGHT_MIN_SANE_KG = -5.0
let stableReadings = []
let isMeasurementStopped = false
let heightBuffer = Buffer.alloc(0)
let impedance20kHzResults = null
let impedance100kHzResults = null
let finalweight = null
let finalheight = null

// ======================== DEVICE CONFIG CALIBRATION ========================
// MDM writes weight/height calibration to this file (same file the camera
// rotations come from). We read it once at startup so a technician can
// correct calibration in the field without a code change. Any value missing
// from the file, or the file itself being missing/unreadable/invalid JSON,
// falls back to the defaults this script has always used — capture must
// never be blocked by a bad or absent config file.
const DEVICE_CONFIG_PATH = "/etc/wellwiz-mdm/device-config.json"

const DEFAULT_WEIGHT_ZERO_OFFSET = 0.0 // rawWeight subtracted before applying factor
const DEFAULT_WEIGHT_CALIBRATION_FACTOR = 1.53138 // multiply (rawWeight - zeroOffset) to get kg
const DEFAULT_HEIGHT_CALIBRATION_FACTOR = 192.7 // cm; sensor-to-floor reference distance

function readInt32LE(d, o) {

    return (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) | 0

}
function frameChecksum(bytes) {

    let sum = 0

    for (const b of bytes) sum += b

    return (~sum + 1) & 0xff

}

function loadDeviceCalibration(configPath = DEVICE_CONFIG_PATH) {
    const calibration = {
        weightZeroOffset: DEFAULT_WEIGHT_ZERO_OFFSET,
        weightCalibrationFactor: DEFAULT_WEIGHT_CALIBRATION_FACTOR,
        heightCalibrationFactor: DEFAULT_HEIGHT_CALIBRATION_FACTOR
    }

    let raw
    try {
        raw = fs.readFileSync(configPath, "utf8")
    } catch (err) {
        console.warn(
            `[CAL] device-config not found/unreadable at ${configPath} (${err.code || err.message}); using default calibration`
        )
        return calibration
    }

    let data
    try {
        data = JSON.parse(raw)
    } catch (err) {
        console.warn(
            `[CAL] device-config at ${configPath} is not valid JSON (${err.message}); using default calibration`
        )
        return calibration
    }

    const weight = data.weight
    if (weight && typeof weight === "object") {
        if (typeof weight.zeroOffset === "number") {
            calibration.weightZeroOffset = weight.zeroOffset
        } else if (weight.zeroOffset !== undefined) {
            console.warn(`[CAL] device-config weight.zeroOffset is not a number; using default`)
        }

        if (typeof weight.calibrationFactor === "number") {
            calibration.weightCalibrationFactor = weight.calibrationFactor
        } else if (weight.calibrationFactor !== undefined) {
            console.warn(
                `[CAL] device-config weight.calibrationFactor is not a number; using default`
            )
        }
    }

    const height = data.height
    if (height && typeof height === "object") {
        if (typeof height.calibrationFactor === "number") {
            calibration.heightCalibrationFactor = height.calibrationFactor
        } else if (height.calibrationFactor !== undefined) {
            console.warn(
                `[CAL] device-config height.calibrationFactor is not a number; using default`
            )
        }
    }

    console.log(
        `[CAL] Loaded from device-config: weight.zeroOffset=${calibration.weightZeroOffset}, ` +
            `weight.calibrationFactor=${calibration.weightCalibrationFactor}, ` +
            `height.calibrationFactor=${calibration.heightCalibrationFactor}`
    )

    return calibration
}

const deviceCalibration = loadDeviceCalibration()

// ======================== DYNAMIC CALIBRATION ========================
// Module-level calibration state. Initial values come from device-config.json
// (read above); calibratedAt/isCalibrated below still get updated at runtime
// by performTare()/performFullCalibration() (and, as before, may also be
// overwritten by index.js on startup from its own calibration flow).
// Falls back to the original hardcoded values so existing behaviour is
// preserved if no config file exists yet.
export let weightCalibration = {
    zeroOffset: deviceCalibration.weightZeroOffset, // from device-config.json: weight.zeroOffset (default 0.0)
    zeroAdc: -2431.81757066827,
    factor: -0.0018237348624755882, // from device-config.json: weight.calibrationFactor (default 1.53138)
    calibratedAt: null, // ISO timestamp of last full calibration
    isCalibrated: true // false until a real calibration has been performed
}

// Height calibration — same idea as weightCalibration above.
// calibrationFactor is the sensor-to-floor reference distance (cm) used as
// `calibrationFactor - distanceCm` to compute height.
export let heightCalibration = {
    calibrationFactor: 215.8 // from device-config.json: height.calibrationFactor (default 192.7)
}

const READ_CMD = Buffer.from([0x55, 0xaa, 0x01, 0x01, 0x01])

function verifyChecksum(frame) {
    let sum = 0
    for (let i = 0; i < 6; i++) sum += frame[i]
    return (sum & 0xff) === frame[6]
}

function parseDistance(frame) {
    return (frame[4] << 8) + frame[5]
}

function checkStability(value) {
    stableReadings.push(value)

    if (stableReadings.length > STABILITY_COUNT) {
        stableReadings.shift()
    }

    const max = Math.max(...stableReadings)
    const min = Math.min(...stableReadings)

    return max - min <= STABILITY_THRESHOLD
}

// ======================== BIA FUNCTIONS ========================
// Calculate checksum for BMH05108 protocol
function calculateChecksum(buffer) {
    let sum = 0
    for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i]
    }
    // Checksum = ~(sum) + 1 (two's complement)
    return (~sum + 1) & 0xff
}

// Create BMH05108 command packet
function createCommand(commandByte, dataBytes = []) {
    const frameLength = 4 + dataBytes.length
    const buffer = Buffer.alloc(frameLength)

    buffer[0] = 0x55
    buffer[1] = frameLength
    buffer[2] = commandByte

    for (let i = 0; i < dataBytes.length; i++) {
        buffer[3 + i] = dataBytes[i]
    }

    const checksumData = buffer.slice(0, frameLength - 1)
    buffer[frameLength - 1] = calculateChecksum(checksumData)

    return buffer
}

// Create 8-electrode body composition command (0xD0)
function create8ElectrodeBodyCompositionCommand(
    gender,
    height,
    age,
    weight,
    rh20,
    lh20,
    tr20,
    rf20,
    lf20,
    rh100,
    lh100,
    tr100,
    rf100,
    lf100
) {
    const buffer = Buffer.alloc(39)

    buffer[0] = 0x55
    buffer[1] = 0x27
    buffer[2] = 0xd0
    buffer[3] = gender & 0xff
    buffer[4] = 0x00
    buffer[5] = height & 0xff
    buffer[6] = age & 0xff

    const weightInt = Math.round(weight * 10)
    buffer.writeUInt16LE(weightInt, 7)

    buffer.writeUInt16LE(Math.round(rh20 * 10), 9)
    buffer.writeUInt16LE(Math.round(lh20 * 10), 11)
    buffer.writeUInt16LE(Math.round(tr20 * 10), 13)
    buffer.writeUInt16LE(Math.round(rf20 * 10), 15)
    buffer.writeUInt16LE(Math.round(lf20 * 10), 17)

    buffer.writeUInt16LE(Math.round(rh100 * 10), 19)
    buffer.writeUInt16LE(Math.round(lh100 * 10), 21)
    buffer.writeUInt16LE(Math.round(tr100 * 10), 23)
    buffer.writeUInt16LE(Math.round(rf100 * 10), 25)
    buffer.writeUInt16LE(Math.round(lf100 * 10), 27)

    for (let i = 29; i < 38; i++) {
        buffer[i] = 0x00
    }

    const checksumData = buffer.slice(0, 38)
    buffer[38] = calculateChecksum(checksumData)

    return buffer
}

// Get available serial ports
async function getPorts() {
    try {
        const ports = await SerialPort.list()
        console.log("\n Available Serial Ports:")
        console.log("========================")
        if (ports.length === 0) {
            console.log("No serial ports found!")
        } else {
            ports.forEach((port, index) => {
                console.log(`${index + 1}. ${port.path}`)
                if (port.manufacturer) console.log(`   Manufacturer: ${port.manufacturer}`)
                if (port.serialNumber) console.log(`   Serial Number: ${port.serialNumber}`)
                console.log("")
            })
        }
        return ports
    } catch (error) {
        console.error(" Error listing ports:", error.message)
        return []
    }
}

function parseBodyCompositionResponse(data) {
    console.log("Parsing Body Composition Response:")
    console.log(`Full Response Length: ${data.length}`)
    console.log(`First Byte: 0x${data[0].toString(16).toUpperCase()}`)
    console.log(`Second Byte: 0x${data[1].toString(16).toUpperCase()}`)
    console.log(`Third Byte: 0x${data[2].toString(16).toUpperCase()}`)
    console.log(`Fourth Byte: 0x${data[3].toString(16).toUpperCase()}`)
    // Validate response
    if (data[0] !== 0xaa || data[2] !== 0xd0) {
        console.log("❌ Invalid body composition response")
        return null
    }

    const parsePackages = {
        // Package 1: Whole Body Composition (page 15-16)
        1: (data) => ({
            bodyWeight: ((data[5] & 0xff) | ((data[6] & 0xff) << 8)) / 10,
            bodyWeightStandardMin: ((data[7] & 0xff) | ((data[8] & 0xff) << 8)) / 10,
            bodyWeightStandardMax: ((data[9] & 0xff) | ((data[10] & 0xff) << 8)) / 10,

            moistureContent: ((data[11] & 0xff) | ((data[12] & 0xff) << 8)) / 10,
            moistureContentStandardMin: ((data[13] & 0xff) | ((data[14] & 0xff) << 8)) / 10,
            moistureContentStandardMax: ((data[15] & 0xff) | ((data[16] & 0xff) << 8)) / 10,

            bodyFatMass: ((data[17] & 0xff) | ((data[18] & 0xff) << 8)) / 10,
            bodyFatMassStandardMin: ((data[19] & 0xff) | ((data[20] & 0xff) << 8)) / 10,
            bodyFatMassStandardMax: ((data[21] & 0xff) | ((data[22] & 0xff) << 8)) / 10,

            proteinMass: ((data[23] & 0xff) | ((data[24] & 0xff) << 8)) / 10,
            proteinMassStandardMin: ((data[25] & 0xff) | ((data[26] & 0xff) << 8)) / 10,
            proteinMassStandardMax: ((data[27] & 0xff) | ((data[28] & 0xff) << 8)) / 10,

            inorganicSaltMass: ((data[29] & 0xff) | ((data[30] & 0xff) << 8)) / 10,
            inorganicSaltMassStandardMin: ((data[31] & 0xff) | ((data[32] & 0xff) << 8)) / 10,
            inorganicSaltMassStandardMax: ((data[33] & 0xff) | ((data[34] & 0xff) << 8)) / 10,

            leanBodyWeight: ((data[35] & 0xff) | ((data[36] & 0xff) << 8)) / 10,
            leanBodyWeightStandardMin: ((data[37] & 0xff) | ((data[38] & 0xff) << 8)) / 10,
            leanBodyWeightStandardMax: ((data[39] & 0xff) | ((data[40] & 0xff) << 8)) / 10,

            muscleMass: ((data[41] & 0xff) | ((data[42] & 0xff) << 8)) / 10,
            muscleMassStandardMin: ((data[43] & 0xff) | ((data[44] & 0xff) << 8)) / 10,
            muscleMassStandardMax: ((data[45] & 0xff) | ((data[46] & 0xff) << 8)) / 10,

            boneMass: ((data[47] & 0xff) | ((data[48] & 0xff) << 8)) / 10,
            boneMassStandardMin: ((data[49] & 0xff) | ((data[50] & 0xff) << 8)) / 10,
            boneMassStandardMax: ((data[51] & 0xff) | ((data[52] & 0xff) << 8)) / 10,

            skeletalMuscleMass: ((data[53] & 0xff) | ((data[54] & 0xff) << 8)) / 10,
            skeletalMuscleMassStandardMin: ((data[55] & 0xff) | ((data[56] & 0xff) << 8)) / 10,
            skeletalMuscleMassStandardMax: ((data[57] & 0xff) | ((data[58] & 0xff) << 8)) / 10,

            subcutaneousFatMass: ((data[77] & 0xff) | ((data[78] & 0xff) << 8)) / 10
        }),

        // Package 2: Segmental Fat and Muscle Information (page 17-18)
        2: (data) => ({
            segmentalFatMass: {
                rightHand: ((data[5] & 0xff) | ((data[6] & 0xff) << 8)) / 10,
                leftHand: ((data[7] & 0xff) | ((data[8] & 0xff) << 8)) / 10,
                trunk: ((data[9] & 0xff) | ((data[10] & 0xff) << 8)) / 10,
                rightFoot: ((data[11] & 0xff) | ((data[12] & 0xff) << 8)) / 10,
                leftFoot: ((data[13] & 0xff) | ((data[14] & 0xff) << 8)) / 10
            },
            segmentalFatPercentage: {
                rightHand: ((data[15] & 0xff) | ((data[16] & 0xff) << 8)) / 10,
                leftHand: ((data[17] & 0xff) | ((data[18] & 0xff) << 8)) / 10,
                trunk: ((data[19] & 0xff) | ((data[20] & 0xff) << 8)) / 10,
                rightFoot: ((data[21] & 0xff) | ((data[22] & 0xff) << 8)) / 10,
                leftFoot: ((data[23] & 0xff) | ((data[24] & 0xff) << 8)) / 10
            },
            segmentalMuscleMass: {
                rightHand: ((data[25] & 0xff) | ((data[26] & 0xff) << 8)) / 10,
                leftHand: ((data[27] & 0xff) | ((data[28] & 0xff) << 8)) / 10,
                trunk: ((data[29] & 0xff) | ((data[30] & 0xff) << 8)) / 10,
                rightFoot: ((data[31] & 0xff) | ((data[32] & 0xff) << 8)) / 10,
                leftFoot: ((data[33] & 0xff) | ((data[34] & 0xff) << 8)) / 10
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

            obesityPercentage: ((data[15] & 0xff) | ((data[16] & 0xff) << 8)) / 10,
            obesityPercentageStandardMin: ((data[17] & 0xff) | ((data[18] & 0xff) << 8)) / 10,
            obesityPercentageStandardMax: ((data[19] & 0xff) | ((data[20] & 0xff) << 8)) / 10,

            bodyMassIndex: ((data[21] & 0xff) | ((data[22] & 0xff) << 8)) / 10,
            bodyMassIndexStandardMin: ((data[23] & 0xff) | ((data[24] & 0xff) << 8)) / 10,
            bodyMassIndexStandardMax: ((data[25] & 0xff) | ((data[26] & 0xff) << 8)) / 10,

            bodyFatPercentage: ((data[27] & 0xff) | ((data[28] & 0xff) << 8)) / 10,
            bodyFatPercentageStandardMin: ((data[29] & 0xff) | ((data[30] & 0xff) << 8)) / 10,
            bodyFatPercentageStandardMax: ((data[31] & 0xff) | ((data[32] & 0xff) << 8)) / 10,

            basalMetabolism: (data[33] & 0xff) | ((data[34] & 0xff) << 8),
            basalMetabolismStandardMin: (data[35] & 0xff) | ((data[36] & 0xff) << 8),
            basalMetabolismStandardMax: (data[37] & 0xff) | ((data[38] & 0xff) << 8),

            recommendedIntake: (data[39] & 0xff) | ((data[40] & 0xff) << 8),
            idealWeight: ((data[41] & 0xff) | ((data[42] & 0xff) << 8)) / 10,
            targetWeight: ((data[43] & 0xff) | ((data[44] & 0xff) << 8)) / 10,

            weightControlAmount: ((data[45] & 0xff) | ((data[46] & 0xff) << 8)) / 10,
            muscleControlAmount: ((data[47] & 0xff) | ((data[48] & 0xff) << 8)) / 10,
            fatControlAmount: ((data[49] & 0xff) | ((data[50] & 0xff) << 8)) / 10,

            subcutaneousFatPercentage: ((data[51] & 0xff) | ((data[52] & 0xff) << 8)) / 10,
            subcutaneousFatPercentageStandardMin:
                ((data[53] & 0xff) | ((data[54] & 0xff) << 8)) / 10,
            subcutaneousFatPercentageStandardMax:
                ((data[55] & 0xff) | ((data[56] & 0xff) << 8)) / 10
        }),

        // Package 4: Exercise Consumption (page 21)
        4: (data) => ({
            exerciseConsumption: {
                walk: (data[5] & 0xff) | ((data[6] & 0xff) << 8),
                golf: (data[7] & 0xff) | ((data[8] & 0xff) << 8),
                croquet: (data[9] & 0xff) | ((data[10] & 0xff) << 8),
                tennis: (data[11] & 0xff) | ((data[12] & 0xff) << 8),
                squash: (data[13] & 0xff) | ((data[14] & 0xff) << 8),
                mountainClimbing: (data[15] & 0xff) | ((data[16] & 0xff) << 8),
                swimming: (data[17] & 0xff) | ((data[18] & 0xff) << 8),
                badminton: (data[19] & 0xff) | ((data[20] & 0xff) << 8)
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
    }

    // Determine package number
    const packageNumber = data[3]
    const totalPackages = (packageNumber >> 4) & 0x0f
    const currentPackage = packageNumber & 0x0f

    console.log(`Total Packages: ${totalPackages}, Current Package: ${currentPackage}`)

    // Parse based on current package
    const packageParser = parsePackages[currentPackage]

    if (packageParser) {
        return {
            totalPackages,
            currentPackage,
            data: packageParser(data)
        }
    }

    return null
}

let bodyCompositionPackages = {}
let totalPackages = 0

function processBodyCompositionResponse(data) {
    const parsedData = parseBodyCompositionResponse(data)

    if (parsedData) {
        // Store the package
        bodyCompositionPackages[parsedData.currentPackage] = parsedData.data
        totalPackages = parsedData.totalPackages

        console.log(
            `\n📦 Body Composition Package ${parsedData.currentPackage} of ${parsedData.totalPackages}`
        )
        console.log(JSON.stringify(parsedData.data, null, 2))

        // Check if all packages are collected
        if (Object.keys(bodyCompositionPackages).length === totalPackages) {
            console.log("\n🏁 Complete Body Composition Data:")

            // Organize packages in order
            const orderedPackages = {}
            for (let i = 1; i <= totalPackages; i++) {
                orderedPackages[`package${i}`] = bodyCompositionPackages[i]
            }

            console.log(JSON.stringify(orderedPackages, null, 2))

            // Reset for next measurement
            bodyCompositionPackages = {}
            totalPackages = 0
        }
    }
}

function parseImpedanceResponse(data) {
    console.log("\n🔍 DETAILED IMPEDANCE RESPONSE")

    // Validate basic response
    /*  if (data[0] !== 0xAA || data[2] !== 0xB1) {
        console.log('❌ Invalid impedance response');
        return;
      }*/
    if (data[1] !== 0xb1 || data[1] !== 0xb0) {
        console.log(" Invalid impedance response")
        return
    }

    // Extract frequency and response type
    const responseFrequency = (data[2] >> 4) & 0x0f
    const responseType = data[2] & 0x0f

    console.log(`📡 Frequency: ${getFrequencyName(responseFrequency)}`)
    console.log(`📝 Response Type: ${getResponseTypeName(responseType)}`)

    // Additional status information
    const measurementStatus = data[3]
    const mode = data[4]

    console.log(`🔬 Measurement Status: 0x${measurementStatus.toString(16).toUpperCase()}`)
    console.log(`🔄 Mode: 0x${mode.toString(16).toUpperCase()}`)

    // Parsing 8-electrode response
    if (data.length >= 26) {
        console.log("\n🌐 Eight-Electrode Impedance Details:")
        const segments = [
            { name: "Right Hand", offset: 5 },
            { name: "Left Hand", offset: 9 },
            { name: "Trunk", offset: 13 },
            { name: "Right Foot", offset: 17 },
            { name: "Left Foot", offset: 21 }
        ]

        segments.forEach((segment) => {
            // Safely read 32-bit value
            const rawValue =
                data[segment.offset] |
                (data[segment.offset + 1] << 8) |
                (data[segment.offset + 2] << 16) |
                (data[segment.offset + 3] << 24)

            const impedanceValue = rawValue / 10
            console.log(
                `   ${segment.name}: ${impedanceValue}Ω ${impedanceValue === 0 ? "❌ No contact" : "✅"}`
            )
        })

        // Check if all impedances are zero
        const allZero = segments.every(
            (segment) =>
                (data[segment.offset] |
                    data[segment.offset + 1] |
                    data[segment.offset + 2] |
                    data[segment.offset + 3]) ===
                0
        )

        if (allZero) {
            console.log("\n⚠️  ALL IMPEDANCE VALUES ARE ZERO!")
            console.log("Possible reasons:")
            console.log("1. No electrode contact")
            console.log("2. Incorrect measurement mode")
            console.log("3. Device not in proper measurement state")
        }
    }
    // Parsing 4-electrode response
    else if (data.length >= 12) {
        console.log("\n🌐 Four-Electrode Impedance Details:")

        // Phase Angle (16-bit signed, little-endian)
        const phaseAngleRaw = data[6] | (data[7] << 8)
        const phaseAngle = phaseAngleRaw / 10

        // Impedance (32-bit unsigned, little-endian)
        const impedanceRaw = data[8] | (data[9] << 8) | (data[10] << 16) | (data[11] << 24)

        console.log(`📐 Phase Angle: ${phaseAngle.toFixed(1)}°`)
        console.log(`Ω Impedance: ${impedanceRaw}Ω ${impedanceRaw === 0 ? "❌ No contact" : "✅"}`)

        // Mode interpretation for 4-electrode
        const modeNames = {
            0x00: "Feet",
            0x01: "Feet (Alt)",
            0x02: "Hands",
            0x03: "8-Electrode"
        }

        console.log(`   Mode Type: ${modeNames[mode] || "Unknown"}`)

        if (impedanceRaw === 0) {
            console.log("\n⚠️  ZERO IMPEDANCE DETECTED!")
            console.log("Possible reasons:")
            console.log("1. No electrode contact")
            console.log("2. Incorrect measurement mode")
            console.log("3. Improper electrode placement")
        }
    }
    // If response is too short
    else {
        console.log("\n⚠️ Insufficient data for impedance parsing")
        console.log(`   Received data length: ${data.length} bytes`)
    }
}

// Connect to BIA port
async function connectBiaPort(portPath, baudRate = 38400) {
    try {
        if (biaPort && biaPort.isOpen) {
            await new Promise((resolve) => biaPort.close(resolve))
        }

        biaPort = new SerialPort({
            path: portPath,
            baudRate: baudRate,
            dataBits: 8,
            stopBits: 1,
            parity: "none"
        })

        biaPort.on("data", (data) => {
            if (heightResponseTimeout) {
                clearTimeout(heightResponseTimeout)
                heightResponseTimeout = null
            }

            const hex = Buffer.from(data).toString("hex").toUpperCase()
            const bytes = Array.from(data)
                .map((b) => "0x" + b.toString(16).padStart(2, "0").toUpperCase())
                .join(", ")

            console.log(`\n${"=".repeat(60)}`)
            console.log(`BIA RESPONSE RECEIVED`)
            console.log(`${"=".repeat(60)}`)
            //  console.log(`Time: ${new Date().toLocaleTimeString()}`);
            console.log(`Length: ${data.length} bytes`)
            console.log(`Hex: ${hex}`)
            console.log(`Bytes: [${bytes}]`)

            if (data[1] === 0xb1 || data[1] === 0xb0) {
                parseImpedanceResponse(data)
            }

            // Body Composition response parsing
            if (data[0] === 0xaa && data[2] === 0xd0) {
                try {
                    processBodyCompositionResponse(data)
                } catch (error) {
                    console.error("Error parsing body composition response:", error)
                }
            }

            /*  if (data[0] === 0xAA && data[2] === 0xB1) {
                  // Check if it's a 4-electrode response (length >= 12)
                  if (data.length >= 12) {
                      try {
                          const parsedPhaseAngleResult = parse4Electrode100kHzImpedance(data);
  
                          if (parsedPhaseAngleResult) {
                              console.log('\n📐 Phase Angle Measurement:');
                              console.log(`Frequency: ${parsedPhaseAngleResult.frequency}`);
                              console.log(`Phase Angle: ${parsedPhaseAngleResult.phaseAngle.value.toFixed(1)}°`);
                              console.log(`Impedance: ${parsedPhaseAngleResult.impedance.value.toFixed(1)} Ω`);
                              console.log(`Measurement Status: ${parsedPhaseAngleResult.measurementStatus.description}`);
                          }
                      } catch (error) {
                          console.error('Error parsing phase angle response:', error);
                      }
                  }
              }*/

            /* if (data[2] === 0xA1 && data.length >= 14) {
                 console.log(`\n WEIGHT STATUS:`);
 
                 // Status byte interpretation
                 const statusByte = data[3];
 
                 // Raw weight from device (little-endian)
             
                 const rawWeight = ((data[6] << 8) | data[5]) / 10.0;
 
                 // Calibration factor (adjust as needed)
                 const CALIBRATION_FACTOR = 1.84;  // You might need to fine-tune this
 
                 // Calibrated weight
                 const calibratedWeight = rawWeight * CALIBRATION_FACTOR;
                 finalweight = rawWeight * CALIBRATION_FACTOR;
 
                 // Status interpretation
                 const isStable = (statusByte & 0x01) !== 0;
                 const isZero = (statusByte & 0x02) !== 0;
                 const isOverload = (statusByte & 0x10) !== 0;
                 const peeling = data[4];
                 const adcValue = ((data[10] << 24) | (data[9] << 16) | (data[8] << 8) | data[7]);
 
                 console.log(`   Status Byte: 0x${statusByte.toString(16).toUpperCase()}`);
                 console.log(`   Stability: ${isStable ? '✅ Stable' : '❌ Unstable'}`);
                 console.log(`   Raw Weight: ${rawWeight.toFixed(2)} kg`);
                 console.log(`   ➝ Calibrated Weight: ${calibratedWeight.toFixed(2)} kg`);
 
 
                 if (isZero) console.log('   🔶 Zero Weight Detected');
                 if (isOverload) console.log('   ⚠️ OVERLOAD!');
             }*/

            console.log(`${"=".repeat(60)}\n`)

            heightWaitingForResponse = false
            showMenu()
        })

        biaPort.on("error", (err) => {
            handleError("SERIAL_ERROR", `BIA Serial Error: ${err.message}`, "ERROR")
        })

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Connection timeout"))
            }, 10000)

            biaPort.on("open", () => {
                clearTimeout(timeout)
                console.log(`✅ BIA Connected to ${portPath} at ${baudRate} baud`)
                resolve()
            })
        })
    } catch (error) {
        console.error("❌ BIA Connection failed:", error.message)
        throw error
    }
}

// Connect to Height port
async function connectHeightPort(portPath, baudRate = 9600) {
    try {
        // Close existing port
        if (heightPort && heightPort.isOpen) {
            await new Promise((resolve) => heightPort.close(resolve))
        }

        // Create new port
        heightPort = new SerialPort({
            path: portPath,
            baudRate: baudRate,
            dataBits: 8,
            stopBits: 1,
            parity: "none"
        })

        // ====================================================================
        // DATA HANDLER WITH ERROR CHECKING
        // ====================================================================

        heightPort.on("data", (data) => {
            try {
                if (isMeasurementStopped) return

                heightBuffer = Buffer.concat([heightBuffer, data])

                while (heightBuffer.length >= 7) {
                    const start = heightBuffer.indexOf(Buffer.from([0x55, 0xaa]))

                    // No frame found
                    if (start === -1) {
                        heightBuffer = Buffer.alloc(0)
                        return
                    }

                    // Frame incomplete
                    if (heightBuffer.length - start < 7) return

                    const frame = heightBuffer.slice(start, start + 7)
                    heightBuffer = heightBuffer.slice(start + 7)

                    // ══════════════════════════════════════════════════════
                    // CHECKSUM VERIFICATION
                    // ══════════════════════════════════════════════════════

                    if (!verifyChecksum(frame)) {
                        handleHeightStatus(0x09) // INVALID_RESPONSE
                        console.log("❌ Checksum verification failed")
                        continue
                    }

                    // ══════════════════════════════════════════════════════
                    // PARSE DISTANCE & CALCULATE HEIGHT
                    // ══════════════════════════════════════════════════════

                    try {
                        const distance = parseDistance(frame)

                        // Validate distance
                        if (distance < 0 || distance > 3000) {
                            handleHeightStatus(0x09) // INVALID_RESPONSE
                            console.log(`❌ Invalid distance: ${distance} mm`)
                            continue
                        }

                        const distanceCm = distance / 10
                        const calculatedHeight = 192.7 - distanceCm

                        // ════════════════════════════════════════════════════
                        // VALIDATE HEIGHT RANGE
                        // ════════════════════════════════════════════════════

                        let statusCode = 0x04 // Default STABLE

                        // if (calculatedHeight < 80) {
                        //   statusCode = 0x01 // OUT_OF_RANGE_LOW
                        // } else if (calculatedHeight > 250) {
                        //   statusCode = 0x02 // OUT_OF_RANGE_HIGH
                        // }

                        // Show error if out of range
                        if (statusCode !== 0x04) {
                            handleHeightStatus(statusCode, calculatedHeight)
                            isMeasurementStopped = true
                            heightPort.close()
                            console.log("\n❌ Height measurement stopped (out of range)")
                            stableReadings = []
                            showMenu()
                            return
                        }

                        finalheight = calculatedHeight

                        console.log(`\n${"=".repeat(60)}`)
                        console.log("📏 HEIGHT MEASUREMENT")
                        console.log(`${"=".repeat(60)}`)
                        console.log(`Distance: ${distance} mm (${distanceCm.toFixed(1)} cm)`)
                        console.log(`Calculated Height: ${calculatedHeight.toFixed(1)} cm`)

                        // ════════════════════════════════════════════════════
                        // CHECK STABILITY
                        // ════════════════════════════════════════════════════

                        if (checkStability(distance)) {
                            if (stableReadings.length >= STABILITY_COUNT) {
                                handleHeightStatus(0x04, calculatedHeight) // STABLE success
                                console.log(`\n${"=".repeat(60)}`)
                                console.log(
                                    `✅ STABLE HEIGHT FOUND: ${calculatedHeight.toFixed(1)} cm`
                                )
                                console.log(`${"=".repeat(60)}\n`)

                                isMeasurementStopped = true
                                heightPort.close()
                                console.log("🛑 Height measurement stopped.\n")
                                stableReadings = []
                                showMenu()
                                return
                            }
                        } else {
                            handleHeightStatus(0x03) // UNSTABLE
                            console.log(`   Readings: ${stableReadings.length}/${STABILITY_COUNT}`)
                            console.log(`${"=".repeat(60)}\n`)
                        }
                    } catch (parseError) {
                        handleHeightStatus(0x09) // INVALID_RESPONSE
                        console.error(`❌ Parse error: ${parseError.message}`)
                        continue
                    }
                }
            } catch (error) {
                console.error(`❌ Data handler error: ${error.message}`)
                handleHeightStatus(0x05) // SENSOR_ERROR
                isMeasurementStopped = true
                heightPort.close()
            }
        })

        // ====================================================================
        // ERROR HANDLER
        // ====================================================================

        heightPort.on("error", (err) => {
            console.error(`❌ Height port error: ${err.message}`)
            handleHeightStatus(0x05) // SENSOR_ERROR
            isMeasurementStopped = true
        })

        // ====================================================================
        // CLOSE HANDLER
        // ====================================================================

        heightPort.on("close", () => {
            console.log("⚠️ Height port closed")
        })

        // ====================================================================
        // CONNECTION TIMEOUT
        // ====================================================================

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (heightPort) {
                    heightPort.close()
                }
                reject(new Error("Connection timeout (10 seconds)"))
            }, 10000)

            heightPort.on("open", () => {
                clearTimeout(timeout)
                console.log(`✅ Height Connected to ${portPath} at ${baudRate} baud`)
                resolve()
            })

            heightPort.on("error", (err) => {
                clearTimeout(timeout)
                reject(new Error(`Connection error: ${err.message}`))
            })
        })
    } catch (error) {
        console.error(`❌ Height connection failed: ${error.message}`)
        handleHeightStatus(0x08) // PORT_ERROR
        if (heightPort) {
            try {
                heightPort.close()
            } catch (e) {
                // Ignore close error
            }
        }
        throw error
    }
}

// Send BIA command
async function sendBiaCommand(command, options = {}) {
    const defaultOptions = {
        waitForResponse: true,
        timeout: 10000, // 10 seconds
        verbose: true,
        responseHandler: null
    }

    const config = { ...defaultOptions, ...options }

    return new Promise((resolve, reject) => {
        // Check port connection
        if (!biaPort || !biaPort.isOpen) {
            const error = new Error("BIA Port not connected")
            if (config.verbose) console.error(`❌ ${error.message}`)
            reject(error)
            return
        }

        // Ensure command is a buffer
        const buffer = Buffer.isBuffer(command) ? command : Buffer.from(command)
        const hexString = buffer.toString("hex").toUpperCase()

        // Verbose logging
        if (config.verbose) {
            console.log(`\n${"=".repeat(60)}`)
            console.log(` SENDING BIA COMMAND`)
            console.log(`${"=".repeat(60)}`)
            console.log(` Hex: ${hexString}`)
            //console.log(`Time: ${new Date().toLocaleTimeString()}`);
            console.log(`${"=".repeat(60)}`)
        }

        // Write command
        biaPort.write(buffer, (err) => {
            if (err) {
                if (config.verbose) console.error(" Write error:", err.message)
                reject(err)
                return
            }

            if (config.verbose) console.log("✅ BIA Command sent successfully\n")

            // Response handling
            if (config.waitForResponse) {
                let responseTimeout

                const responseListener = (data) => {
                    // Clear timeout
                    if (responseTimeout) clearTimeout(responseTimeout)

                    // Custom or default response handling
                    if (config.responseHandler) {
                        config.responseHandler(data)
                    } else {
                        // Default parsing
                        // parseBodyComposition1(data);
                    }

                    // Remove listener to prevent memory leaks
                    biaPort.removeListener("data", responseListener)

                    resolve(data)
                }

                // Set timeout
                responseTimeout = setTimeout(() => {
                    biaPort.removeListener("data", responseListener)
                    const timeoutError = new Error("No response received")
                    if (config.verbose) console.warn("\n  WARNING:", timeoutError.message)
                    reject(timeoutError)
                }, config.timeout)

                // Add response listener
                biaPort.on("data", responseListener)
            } else {
                resolve()
            }
        })
    })
}

function getFrequencyName(frequencyCode) {
    const frequencyNames = {
        0x00: "Current Measurement",
        0x01: "5 kHz",
        0x02: "10 kHz",
        0x03: "20 kHz",
        0x04: "25 kHz",
        0x05: "50 kHz",
        0x06: "100 kHz",
        0x07: "200 kHz",
        0x08: "250 kHz",
        0x09: "500 kHz"
    }
    return (
        frequencyNames[frequencyCode] || `Unknown (0x${frequencyCode.toString(16).toUpperCase()})`
    )
}
function getResponseTypeName(responseTypeCode) {
    const responseTypes = {
        0x01: "Original Impedance",
        0x02: "Encrypted Impedance",
        0x03: "ADC Value"
    }
    return (
        responseTypes[responseTypeCode] ||
        `Unknown (0x${responseTypeCode.toString(16).toUpperCase()})`
    )
}

async function case38_20kHzImpedanceQuery() {
    try {
        await sendBiaCommand([0x55, 0x06, 0xb0, 0x00, 0x00, 0xf5])
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Step 2: Set impedance mode for 8-electrode 20 kHz
        // await sendBiaCommand([0x55, 0x06, 0xb0, 0x01, 0x03, 0xf1])
        // await new Promise((resolve) => setTimeout(resolve, 500))

        await sendBiaCommand([0x55, 0x06, 0xb0, 0x01, 0x03, 0xf1])
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Query command for 20 kHz
        // const query20kHzCommand = [0x55, 0x05, 0xb1, 0x31, 0xc4]
        const query20kHzCommand = [0x55, 0x05, 0xb1, 0x31, 0xc4]

        // Track results
        const results = {
            totalAttempts: 50,
            meaningfulResponses: [],
            zeroResponses: [],
            errorResponses: [],
            errorCounts: {} // Track error codes
        }

        // Function to check if responses are stable
        const isStableResponse = (responses) => {
            if (responses.length < 5) return false

            // Get the last 5 responses
            const lastFive = responses.slice(-5)

            // Check if all last 5 responses are meaningful and similar
            const allMeaningful = lastFive.every(isMeaningful20kHzResult)

            if (!allMeaningful) return false

            // Compare segments across last 5 responses
            const segments = ["rightHand", "leftHand", "trunk", "rightFoot", "leftFoot"]

            return segments.every((segment) => {
                const values = lastFive.map((r) => r.segments[segment])
                const max = Math.max(...values)
                const min = Math.min(...values)
                return (max - min) / max < 0.1 // Within 10% variation
            })
        }

        // 50 attempts
        for (let attempt = 1; attempt <= 50; attempt++) {
            try {
                console.log(`\n📡 Attempt ${attempt}: Querying 20 kHz Impedance`)

                const responseData = await sendBiaCommand(query20kHzCommand, {
                    timeout: 5000,
                    verbose: true
                })

                //Handle impedance status
                const statusCode = responseData[4]
                // const statusResult = ImprovedImpedanceStatusHandler.handleImpedanceStatus(statusCode, attempt);
                // console.log("------statusResult-------");
                // console.log(statusResult);
                // // Track errors
                // if (!results.errorCounts[statusCode]) {
                //     results.errorCounts[statusCode] = 0;
                // }
                // results.errorCounts[statusCode]++;
                // // Decision logic
                // if (statusResult.decision.isCritical) {
                //     console.error('CRITICAL ERROR - Stopping measurement');
                //     continue;
                // }
                // if (statusResult.decision.shouldAbort) {
                //     console.error('Measurement aborted');
                //    continue;
                // }
                // if (statusResult.decision.shouldWait) {
                //     console.log('Waiting for device...');
                //     await new Promise(r => setTimeout(r, statusResult.waitTime));
                //     continue;
                // }
                // if (statusResult.decision.shouldRetry && !statusResult.decision.maxRetriesReached) {
                //     const retryResult = await ImprovedImpedanceStatusHandler.handleRetry(statusCode, attempt, 3);
                //     if (retryResult.shouldRetry) {
                //         continue;
                //     }
                // }

                // Parse response
                const parsedResult = parse20kHzImpedanceResponse(responseData)

                console.log("-----")
                console.log(parsedResult)

                // Check if result is meaningful
                if (isMeaningful20kHzResult(parsedResult)) {
                    results.meaningfulResponses.push(parsedResult)
                } else {
                    results.zeroResponses.push({
                        attempt,
                        rawResponse: responseData
                    })
                }

                // Check for stable responses
                if (isStableResponse(results.meaningfulResponses)) {
                    console.log("✅ Stable impedance values detected!")
                    break
                }

                // Delay between attempts
                await new Promise((resolve) => setTimeout(resolve, 500))
            } catch (queryError) {
                console.error(`Attempt ${attempt} failed:`, queryError)
                results.errorResponses.push({
                    attempt,
                    error: queryError.message
                })
            }
        }
        // ✅ Display statistics
        ImprovedImpedanceStatusHandler.displayErrorStatistics(results.errorCounts)

        // Display comprehensive results
        console.log("\n20 kHz Impedance Query Results:")
        console.log(`Total Attempts: ${results.totalAttempts}`)
        console.log(`Meaningful Responses: ${results.meaningfulResponses.length}`)
        console.log(`Zero Responses: ${results.zeroResponses.length}`)
        console.log(`Error Responses: ${results.errorResponses.length}`)

        // Detailed meaningful responses
        if (results.meaningfulResponses.length > 0) {
            console.log("\n Final Meaningful Data:")
            const finalResponse =
                results.meaningfulResponses[results.meaningfulResponses.length - 1]
            console.log(JSON.stringify(finalResponse, null, 2))
        }
        // Save the results globally
        impedance20kHzResults =
            results.meaningfulResponses.length > 0
                ? results.meaningfulResponses[results.meaningfulResponses.length - 1]
                : null

        return results
    } catch (error) {
        console.error("Overall 20 kHz impedance query failed:", error)
        throw error
    }
}

// Helper functions remain the same as in previous implementation
function parse20kHzImpedanceResponse(data) {
    console.log("coming 20khz frequency")
    // Validate response
    if (data[0] !== 0xaa || data[2] !== 0xb1) {
        console.log("❌ Invalid impedance response")
        return null
    }
    console.log(data.length)
    // 8-electrode parsing
    if (data.length >= 26) {
        return {
            frequency: getFrequencyName((data[3] >> 4) & 0x0f),
            responseType: getResponseTypeName(data[3] & 0x0f),
            measurementStatus: data[4],
            segments: {
                rightHand: readImpedanceValue(data, 6), // Bytes 6-9
                leftHand: readImpedanceValue(data, 10), // Bytes 10-13
                trunk: readImpedanceValue(data, 14), // Bytes 14-17
                rightFoot: readImpedanceValue(data, 18), // Bytes 18-21
                leftFoot: readImpedanceValue(data, 22) // Bytes 22-25
            }
        }
    }

    return null
}

function isMeaningful20kHzResult(result) {
    if (!result || !result.segments) return false

    return Object.values(result.segments).some((value) => value > 0)
}

// async function case39_100kHzImpedanceQuery() {
//     try {
//           console.log('   Stopping previous measurement...')
//           // await sendBiaCommand([0x55, 0x06, 0xb0, 0x00, 0x00, 0xf5])
//           // await new Promise((resolve) => setTimeout(resolve, 500))
//           await sendBiaCommand([0x55, 0x06, 0xB0, 0x00, 0x00, 0xF5])
//           await new Promise((resolve) => setTimeout(resolve, 500))

//           // Step 2: Set impedance mode for 8-electrode 100 kHz
//           console.log('   Setting 100 kHz impedance mode...')
//           // await sendBiaCommand([0x55, 0x06, 0xb0, 0x01, 0x06, 0xee])
//           // await new Promise((resolve) => setTimeout(resolve, 500))
//           await sendBiaCommand([0x55, 0x06, 0xB0, 0x01, 0x06, 0xEE])
//           await new Promise((resolve) => setTimeout(resolve, 500))

//           // Query command for 100 kHz
//           // const query100kHzCommand = [0x55, 0x05, 0xb1, 0x61, 0x94]
//           const query100kHzCommand = [0x55, 0x05, 0xB1, 0x61, 0x94];
//         // Track results
//         const results = {
//             totalAttempts: 50,
//             meaningfulResponses: [],
//             zeroResponses: [],
//             errorResponses: [],
//             statusCodes: {}  // ✅ ENHANCED: Track status codes
//         };

//         // ✅ ENHANCED: Global error tracking
//         const globalErrorCounts = {};

//         // Function to check if responses are stable
//         const isStableResponse = (responses) => {
//             if (responses.length < 5) return false;

//             // Get the last 5 responses
//             const lastFive = responses.slice(-5);

//             // Check if all last 5 responses are meaningful and similar
//             const allMeaningful = lastFive.every(isMeaningful100kHzResult);

//             if (!allMeaningful) return false;

//             // Compare segments across last 5 responses
//             const segments = ['rightHand', 'leftHand', 'trunk', 'rightFoot', 'leftFoot'];

//             return segments.every(segment => {
//                 const values = lastFive.map(r => r.segments[segment]);
//                 const max = Math.max(...values);
//                 const min = Math.min(...values);
//                 return (max - min) / max < 0.1; // Within 10% variation
//             });
//         };

//         console.log('\n📡 Starting 100 kHz Impedance Query\n');

//         // 50 attempts
//         for (let attempt = 1; attempt <= 50; attempt++) {
//             try {
//                 console.log(`   Attempt ${attempt}`);

//                 const responseData = await sendBiaCommand(query100kHzCommand, {
//                     timeout: 5000,
//                     verbose: false
//                 });

//                 // Handle variable response lengths
//                 // if (responseData && responseData.length >= 26) {
//                 //     // Check if response is valid 8-electrode response
//                 //     if (responseData[0] === 0xAA && responseData[2] === 0xB1) {

//                 //         // Extract measurement status (byte 4)
//                 //         const measurementStatus = responseData[4];

//                 //         // ✅ ENHANCED: Track status codes
//                 //         if (!results.statusCodes[measurementStatus]) {
//                 //             results.statusCodes[measurementStatus] = 0;
//                 //         }
//                 //         results.statusCodes[measurementStatus]++;

//                 //         if (!globalErrorCounts[measurementStatus]) {
//                 //             globalErrorCounts[measurementStatus] = 0;
//                 //         }
//                 //         globalErrorCounts[measurementStatus]++;

//                 //         // ✅ ENHANCED: Use ImprovedImpedanceStatusHandler
//                 //         const statusResult = ImprovedImpedanceStatusHandler.handleImpedanceStatus(
//                 //             measurementStatus,
//                 //             attempt
//                 //         );

//                 //         console.log("------statusResult-------");
//                 //         console.log(statusResult);

//                 //         // ============================================================
//                 //         // DECISION LOGIC: Handle different status codes intelligently
//                 //         // ============================================================

//                 //         if (statusResult.decision.shouldAccept || measurementStatus === 0x02) {
//                 //             // Status 0x03: SUCCESS - Device ready with real data
//                 //             // ✅ This is what we want - accept the measurement
//                 //             const parsedResult = parse100kHzImpedanceResponse(responseData);

//                 //             if (isMeaningful100kHzResult(parsedResult)) {
//                 //                 // Real data received - store it
//                 //                 results.meaningfulResponses.push(parsedResult);
//                 //                 console.log(`      ✅ ${statusResult.message}`);

//                 //                 // Display impedance values
//                 //                 console.log(`         Right Hand: ${parsedResult.segments.rightHand}Ω`);
//                 //                 console.log(`         Left Hand: ${parsedResult.segments.leftHand}Ω`);
//                 //                 console.log(`         Trunk: ${parsedResult.segments.trunk}Ω`);
//                 //                 console.log(`         Right Foot: ${parsedResult.segments.rightFoot}Ω`);
//                 //                 console.log(`         Left Foot: ${parsedResult.segments.leftFoot}Ω`);

//                 //                 // Check for stable responses
//                 //                 if (isStableResponse(results.meaningfulResponses)) {
//                 //                     console.log(`\n   ✅ Stable impedance values detected after ${attempt} attempts!`);
//                 //                     break;  // Exit loop - we have stable data
//                 //                 }
//                 //             } else {
//                 //                 // Status says success but data is not meaningful
//                 //                 console.log(`      ⚠️  Status success but measurement not meaningful`);
//                 //                 results.zeroResponses.push({
//                 //                     attempt,
//                 //                     rawResponse: responseData,
//                 //                     reason: 'Status success but measurement not meaningful',
//                 //                     statusCode: measurementStatus
//                 //                 });
//                 //             }

//                 //         } else if (statusResult.decision.shouldWait) {
//                 //             // Status 0x02: MEASURE - Device still measuring
//                 //             // ⏳ Wait for device to complete measurement
//                 //             console.log(`      ⏳ ${statusResult.message} (waiting ${statusResult.waitTime || 500}ms)`);
//                 //             results.zeroResponses.push({
//                 //                 attempt,
//                 //                 rawResponse: responseData,
//                 //                 reason: 'Device still measuring (status 0x02)',
//                 //                 statusCode: measurementStatus
//                 //             });
//                 //             // Wait before next attempt
//                 //             await new Promise(resolve => setTimeout(resolve, statusResult.waitTime || 500));
//                 //             continue;

//                 //         } else if (statusResult.decision.shouldRetry) {
//                 //             // Status 0x04: ERROR_RANGER or 0x05: ERROR_REPEAT
//                 //             // ⚠️ Retryable error - can try again
//                 //             console.log(`      ⚠️  ${statusResult.message}`);

//                 //             results.errorResponses.push({
//                 //                 attempt,
//                 //                 error: statusResult.message,
//                 //                 statusCode: measurementStatus,
//                 //                 canRetry: statusResult.canRetry
//                 //             });

//                 //             // Check if we can retry
//                 //             if (!statusResult.decision.maxRetriesReached) {
//                 //                 // Use handler's smart retry logic
//                 //                 const retryResult = await ImprovedImpedanceStatusHandler.handleRetry(
//                 //                     measurementStatus,
//                 //                     attempt,
//                 //                     50  // Max attempts in this loop
//                 //                 );

//                 //                 if (retryResult.shouldRetry) {
//                 //                     console.log(`Retrying (attempt ${retryResult.nextAttempt})...`);
//                 //                     continue;  // Continue loop to retry
//                 //                 }
//                 //             } else {
//                 //                 console.log(`Max retries reached for this error`);
//                 //             }

//                 //         } else if (statusResult.decision.isCritical) {
//                 //             // Status 0x01: CHECK_ELECTRODE
//                 //             // ❌ CRITICAL - Electrode problem, must stop
//                 //             console.log(`\n CRITICAL: ${statusResult.message}`);

//                 //             results.errorResponses.push({
//                 //                 attempt,
//                 //                 error: statusResult.message,
//                 //                 statusCode: measurementStatus,
//                 //                 isCritical: true
//                 //             });

//                 //             // Show user-friendly error message
//                 //             if (statusResult.userMessage) {
//                 //                 console.log(`\n${statusResult.userMessage}`);
//                 //             }

//                 //             // Show solutions
//                 //             if (statusResult.solutions) {
//                 //                 console.log(`\nRecommended Actions:`);
//                 //                 statusResult.solutions.forEach(solution => {
//                 //                     console.log(`   ${solution}`);
//                 //                 });
//                 //             }

//                 //             console.log(`\n CRITICAL ERROR - Stopping 100 kHz impedance measurement`);
//                 //             break;  // Exit loop - can't continue with electrode problem

//                 //         } else if (statusResult.decision.shouldAbort) {
//                 //             // Status 0x06: USER_EXIT or other abort conditions
//                 //             // ⏹️ Stop measurement (user cancelled or other reason)
//                 //             console.log(`      ⏹️  ${statusResult.message}`);

//                 //             results.zeroResponses.push({
//                 //                 attempt,
//                 //                 rawResponse: responseData,
//                 //                 reason: statusResult.message,
//                 //                 statusCode: measurementStatus
//                 //             });
//                 //             break;  // Exit loop

//                 //         } else {
//                 //             // Unknown/unhandled status
//                 //             console.log(`      ❓ Unhandled status: 0x${measurementStatus.toString(16).toUpperCase()}`);
//                 //             results.zeroResponses.push({
//                 //                 attempt,
//                 //                 rawResponse: responseData,
//                 //                 reason: `Unknown status: 0x${measurementStatus.toString(16)}`,
//                 //                 statusCode: measurementStatus
//                 //             });
//                 //         }

//                 //     } else {
//                 //         // Invalid response format (header mismatch)
//                 //         console.warn(` Invalid response format`);
//                 //         results.zeroResponses.push({
//                 //             attempt,
//                 //             rawResponse: responseData,
//                 //             reason: 'Invalid response format'
//                 //         });
//                 //     }
//                 // } else if (responseData) {
//                 //     console.warn(` Unexpected response length: ${responseData.length} bytes`);
//                 //     results.zeroResponses.push({
//                 //         attempt,
//                 //         rawResponse: responseData,
//                 //         reason: 'Unexpected response length'
//                 //     });
//                 // }
//         const parsedResult = parse100kHzImpedanceResponse(responseData);

//                             if (isMeaningful100kHzResult(parsedResult)) {
//                                 // Real data received - store it
//                                 results.meaningfulResponses.push(parsedResult);
//                                 console.log(`      ✅ ${statusResult.message}`);

//                                 // Display impedance values
//                                 console.log(`         Right Hand: ${parsedResult.segments.rightHand}Ω`);
//                                 console.log(`         Left Hand: ${parsedResult.segments.leftHand}Ω`);
//                                 console.log(`         Trunk: ${parsedResult.segments.trunk}Ω`);
//                                 console.log(`         Right Foot: ${parsedResult.segments.rightFoot}Ω`);
//                                 console.log(`         Left Foot: ${parsedResult.segments.leftFoot}Ω`);

//                                 // Check for stable responses
//                                 if (isStableResponse(results.meaningfulResponses)) {
//                                     console.log(`\n   ✅ Stable impedance values detected after ${attempt} attempts!`);
//                                     break;  // Exit loop - we have stable data
//                                 }
//                             } else {
//                                 // Status says success but data is not meaningful
//                                 console.log(`      ⚠️  Status success but measurement not meaningful`);
//                                 results.zeroResponses.push({
//                                     attempt,
//                                     rawResponse: responseData,
//                                     reason: 'Status success but measurement not meaningful',
//                                     statusCode: measurementStatus
//                                 });
//                             }
//                 // Delay between attempts
//                 await new Promise(resolve => setTimeout(resolve, 500));

//             } catch (queryError) {
//                 console.error(`Attempt ${attempt} failed: ${queryError.message}`);
//                 results.errorResponses.push({
//                     attempt,
//                     error: queryError.message,
//                     exception: true
//                 });
//             }
//         }

//         // ✅ ENHANCED: Display comprehensive results
//         console.log('\n' + '='.repeat(70));
//         console.log('📊 100 kHz IMPEDANCE QUERY RESULTS');
//         console.log('='.repeat(70));

//         console.log(`\nTotal Attempts: ${results.totalAttempts}`);
//         console.log(`Meaningful Responses: ${results.meaningfulResponses.length}`);
//         console.log(`Zero/Waiting Responses: ${results.zeroResponses.length}`);
//         console.log(`Error Responses: ${results.errorResponses.length}`);

//         // ✅ ENHANCED: Show status code breakdown
//         if (Object.keys(results.statusCodes).length > 0) {
//             console.log(`\nStatus Code Breakdown:`);
//             Object.entries(results.statusCodes).forEach(([code, count]) => {
//                 const codeNum = parseInt(code);
//                 const codeMap = {
//                     0x00: 'NULL',
//                     0x01: 'CHECK_ELECTRODE',
//                     0x02: 'MEASURE',
//                     0x03: 'SUCCESS',
//                     0x04: 'ERROR_RANGER',
//                     0x05: 'ERROR_REPEAT',
//                     0x06: 'USER_EXIT'
//                 };
//                 const codeName = codeMap[codeNum] || 'UNKNOWN';
//                 console.log(`   0x${codeNum.toString(16).toUpperCase()} (${codeName}): ${count}x`);
//             });
//         }

//         // Show error details if any
//         if (results.errorResponses.length > 0) {
//             console.log(`\nError Details:`);
//             results.errorResponses.slice(0, 5).forEach(err => {
//                 const statusStr = err.statusCode !== undefined
//                     ? ` [0x${err.statusCode.toString(16).toUpperCase()}]`
//                     : '';
//                 const criticalStr = err.isCritical ? ' (CRITICAL)' : '';
//                 console.log(`   Attempt ${err.attempt}: ${err.error}${statusStr}${criticalStr}`);
//             });
//             if (results.errorResponses.length > 5) {
//                 console.log(`   ... and ${results.errorResponses.length - 5} more errors`);
//             }
//         }

//         // Display meaningful responses
//         if (results.meaningfulResponses.length > 0) {
//             console.log('\nImpedance Measurements:');

//             const allSegments = {
//                 rightHand: [],
//                 leftHand: [],
//                 trunk: [],
//                 rightFoot: [],
//                 leftFoot: []
//             };

//             results.meaningfulResponses.forEach((response, idx) => {
//                 allSegments.rightHand.push(response.segments.rightHand);
//                 allSegments.leftHand.push(response.segments.leftHand);
//                 allSegments.trunk.push(response.segments.trunk);
//                 allSegments.rightFoot.push(response.segments.rightFoot);
//                 allSegments.leftFoot.push(response.segments.leftFoot);
//             });

//             console.log(`\nSegment Statistics:`);

//             Object.entries(allSegments).forEach(([segment, values]) => {
//                 if (values.length > 0) {
//                     const min = Math.min(...values);
//                     const max = Math.max(...values);
//                     const avg = values.reduce((a, b) => a + b, 0) / values.length;
//                     const variation = ((max - min) / avg * 100).toFixed(2);

//                     console.log(`\n   ${segment}:`);
//                     console.log(`      Min: ${min}Ω, Max: ${max}Ω, Avg: ${avg.toFixed(1)}Ω`);
//                     console.log(`      Variation: ${variation}%`);
//                 }
//             });

//             // Show final measurement
//             console.log('\n\nFinal Measurement (100 kHz):\n');
//             const finalResponse = results.meaningfulResponses[results.meaningfulResponses.length - 1];
//             console.log(JSON.stringify(finalResponse, null, 2));
//         } else {
//             console.log('\nNo successful measurements received!');
//         }

//         // ✅ ENHANCED: Display global error statistics
//         if (Object.keys(globalErrorCounts).length > 0) {
//             console.log('\n' + '='.repeat(70));
//             console.log('GLOBAL ERROR CODE STATISTICS');
//             console.log('='.repeat(70));
//             ImprovedImpedanceStatusHandler.displayErrorStatistics(globalErrorCounts);
//         }

//         console.log('='.repeat(70));

//         // Store final result
//         impedance100kHzResults = results.meaningfulResponses.length > 0
//             ? results.meaningfulResponses[results.meaningfulResponses.length - 1]
//             : null;

//         return results;

//     } catch (error) {
//         console.error('Overall 100 kHz impedance query failed:', error);
//         throw error;
//     }
// }

// Helper function to parse 100 kHz impedance response

async function case39_100kHzImpedanceQuery() {
    try {
        // Step 1: Stop current test
        await sendBiaCommand([0x55, 0x06, 0xb0, 0x00, 0x00, 0xf5])
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Step 2: Set impedance mode for 8-electrode 100 kHz
        await sendBiaCommand([0x55, 0x06, 0xb0, 0x01, 0x06, 0xee])
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Query command for 100 kHz
        const query100kHzCommand = [0x55, 0x05, 0xb1, 0x61, 0x94]

        // Track results
        const results = {
            totalAttempts: 50,
            meaningfulResponses: [],
            zeroResponses: [],
            errorResponses: []
        }

        // Function to check if responses are stable
        const isStableResponse = (responses) => {
            if (responses.length < 5) return false

            // Get the last 5 responses
            const lastFive = responses.slice(-5)

            // Check if all last 5 responses are meaningful and similar
            const allMeaningful = lastFive.every(isMeaningful100kHzResult)

            if (!allMeaningful) return false

            // Compare segments across last 5 responses
            const segments = ["rightHand", "leftHand", "trunk", "rightFoot", "leftFoot"]

            return segments.every((segment) => {
                const values = lastFive.map((r) => r.segments[segment])
                const max = Math.max(...values)
                const min = Math.min(...values)
                return (max - min) / max < 0.1 // Within 10% variation
            })
        }

        // 50 attempts
        for (let attempt = 1; attempt <= 50; attempt++) {
            try {
                console.log(`\n📡 Attempt ${attempt}: Querying 100 kHz Impedance`)

                const responseData = await sendBiaCommand(query100kHzCommand, {
                    timeout: 5000,
                    verbose: true
                })

                // Parse response
                const parsedResult = parse100kHzImpedanceResponse(responseData)

                // Check if result is meaningful
                if (isMeaningful100kHzResult(parsedResult)) {
                    results.meaningfulResponses.push(parsedResult)
                } else {
                    results.zeroResponses.push({
                        attempt,
                        rawResponse: responseData
                    })
                }

                // Check for stable responses
                if (isStableResponse(results.meaningfulResponses)) {
                    console.log("✅ Stable impedance values detected!")
                    break
                }

                // Delay between attempts
                await new Promise((resolve) => setTimeout(resolve, 500))
            } catch (queryError) {
                console.error(`Attempt ${attempt} failed:`, queryError)
                results.errorResponses.push({
                    attempt,
                    error: queryError.message
                })
            }
        }

        // Display comprehensive results
        console.log("\n📊 100 kHz Impedance Query Results:")
        console.log(`Total Attempts: ${results.totalAttempts}`)
        console.log(`Meaningful Responses: ${results.meaningfulResponses.length}`)
        console.log(`Zero Responses: ${results.zeroResponses.length}`)
        console.log(`Error Responses: ${results.errorResponses.length}`)

        // Detailed meaningful responses
        if (results.meaningfulResponses.length > 0) {
            console.log("\n✅ Final Meaningful Data:")
            const finalResponse =
                results.meaningfulResponses[results.meaningfulResponses.length - 1]
            console.log(JSON.stringify(finalResponse, null, 2))
        }
        const finalResult =
            results.meaningfulResponses.length > 0
                ? results.meaningfulResponses[results.meaningfulResponses.length - 1]
                : null

        impedance100kHzResults = finalResult

        return finalResult
    } catch (error) {
        console.error("Overall 100 kHz impedance query failed:", error)
        throw error
    }
}

function parse100kHzImpedanceResponse(data) {
    // Validate response
    if (data[0] !== 0xaa || data[2] !== 0xb1) {
        console.log(" Invalid impedance response")
        return null
    }

    // 8-electrode parsing
    if (data.length >= 27) {
        return {
            segments: {
                rightHand: readImpedanceValue(data, 6), // Bytes 6-9
                leftHand: readImpedanceValue(data, 10), // Bytes 10-13
                trunk: readImpedanceValue(data, 14), // Bytes 14-17
                rightFoot: readImpedanceValue(data, 18), // Bytes 18-21
                leftFoot: readImpedanceValue(data, 22) // Bytes 22-25
            }
        }
    }

    return null
}

// Helper to read impedance value
function readImpedanceValue(data, offset) {
    // Read 32-bit little-endian value with resolution 0.1Ω
    const rawValue =
        data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)

    // Convert to decimal value (divide by 10 for 0.1Ω resolution)
    return rawValue / 10.0
}

// Helper to check if result is meaningful
function isMeaningful100kHzResult(result) {
    if (!result || !result.segments) return false

    return Object.values(result.segments).some((value) => value > 0)
}

async function case40_PhaseAngleDetailedQuery() {
    try {
        // Measurement modes for 50 kHz
        const modes = [
            {
                code: IMPEDANCE_MODES.FOUR_ELECTRODE_LEGS,
                name: "Four-Electrode Legs",
                setImpedanceCommand: [0x55, 0x06, 0xb0, 0x02, 0x05, 0xee]
            },
            {
                code: IMPEDANCE_MODES.FOUR_ELECTRODE_ARMS,
                name: "Four-Electrode Arms",
                setImpedanceCommand: [0x55, 0x06, 0xb0, 0x03, 0x05, 0xed]
            }
        ]

        // Results storage
        const phaseAngleResults = {
            "Four-Electrode Legs": [],
            "Four-Electrode Arms": []
        }

        // ✅ ENHANCED: Global error tracking
        const globalErrorCounts = {}

        // Stability check function
        const isStableResponse = (responses) => {
            if (responses.length < 5) return false

            const lastFive = responses.slice(-5)

            const phaseAngles = lastFive.map((r) => r.phaseAngle.value)
            const impedanceValues = lastFive.map((r) => r.impedance.value)

            const phaseAngleMax = Math.max(...phaseAngles)
            const phaseAngleMin = Math.min(...phaseAngles)
            const phaseAngleVariation = phaseAngleMax - phaseAngleMin

            const impedanceMax = Math.max(...impedanceValues)
            const impedanceMin = Math.min(...impedanceValues)
            const impedanceVariation = impedanceMax - impedanceMin

            const isStablePhaseAngle = phaseAngleVariation < 1.0
            const isStableImpedance = impedanceVariation < 10.0

            return isStablePhaseAngle && isStableImpedance
        }

        // Process each measurement mode
        for (const mode of modes) {
            console.log(`\n📡 Measuring Phase Angle: 50 kHz, ${mode.name}`)

            // Step 1: Stop current test
            console.log("   Stopping previous measurement...")
            await sendBiaCommand([0x55, 0x06, 0xb0, 0x00, 0x00, 0xf5])
            await new Promise((resolve) => setTimeout(resolve, 500))

            // Step 2: Set impedance mode at 50 kHz
            console.log(`   Setting ${mode.name} mode at 50 kHz...`)
            await sendBiaCommand(mode.setImpedanceCommand)

            await new Promise((resolve) => setTimeout(resolve, 800))

            const queryCommand = [0x55, 0x05, 0xb1, 0x01, 0xf4]

            // Track results
            const results = {
                attempts: 0,
                meaningfulResponses: [],
                zeroResponses: [],
                errorResponses: [],
                statusCodes: {} // ✅ ENHANCED: Track status codes
            }

            console.log(`   Starting measurement attempts...\n`)

            // Collect up to 50 attempts until stable
            for (let attempt = 1; attempt <= 50; attempt++) {
                results.attempts = attempt

                try {
                    console.log(`   Attempt ${attempt}`)

                    const responseData = await sendBiaCommand(queryCommand, {
                        timeout: 5000,
                        verbose: false
                    })

                    // Handle variable response lengths (at least 13 bytes)
                    if (responseData && responseData.length >= 13) {
                        // Check if response is valid 4-electrode response
                        if (responseData[0] === 0xaa && responseData[2] === 0xb1) {
                            // Extract measurement status (byte 4)
                            const measurementStatus = responseData[4]

                            // ✅ ENHANCED: Track status codes
                            if (!results.statusCodes[measurementStatus]) {
                                results.statusCodes[measurementStatus] = 0
                            }
                            results.statusCodes[measurementStatus]++

                            if (!globalErrorCounts[measurementStatus]) {
                                globalErrorCounts[measurementStatus] = 0
                            }
                            globalErrorCounts[measurementStatus]++

                            // ✅ ENHANCED: Use ImprovedImpedanceStatusHandler
                            // This provides comprehensive error handling for status codes
                            const statusResult =
                                ImprovedImpedanceStatusHandler.handleImpedanceStatus(
                                    measurementStatus,
                                    attempt
                                )

                            // ============================================================
                            // DECISION LOGIC: Handle different status codes intelligently
                            // ============================================================

                            if (statusResult.decision.shouldAccept) {
                                // Status 0x03: SUCCESS - Device ready with real data
                                // ✅ This is what we want - accept the measurement
                                const parsedResult = parse4Electrode50kHzImpedance(responseData)

                                if (parsedResult && parsedResult.impedance.value > 0) {
                                    // Real data received - store it
                                    results.meaningfulResponses.push(parsedResult)
                                    console.log(`${statusResult.message}`)
                                    console.log(
                                        `         Phase Angle: ${parsedResult.phaseAngle.value.toFixed(1)}°, Impedance: ${parsedResult.impedance.value}Ω`
                                    )

                                    // Check for stable responses
                                    if (isStableResponse(results.meaningfulResponses)) {
                                        console.log(
                                            `\n Stable measurements detected after ${attempt} attempts!`
                                        )
                                        break // Exit loop - we have stable data
                                    }
                                } else {
                                    // Status says success but impedance is 0 - something's wrong
                                    console.log(` Status success but impedance is 0`)
                                    results.zeroResponses.push({
                                        attempt,
                                        rawResponse: responseData,
                                        reason: "Status success but impedance is 0",
                                        statusCode: measurementStatus
                                    })
                                }
                            } else if (statusResult.decision.shouldWait) {
                                // Status 0x02: MEASURE - Device still measuring
                                // ⏳ Wait for device to complete measurement
                                console.log(
                                    `      ⏳ ${statusResult.message} (waiting ${statusResult.waitTime || 500}ms)`
                                )
                                results.zeroResponses.push({
                                    attempt,
                                    rawResponse: responseData,
                                    reason: "Device still measuring (status 0x02)",
                                    statusCode: measurementStatus
                                })
                                // Small wait before next attempt
                                await new Promise((resolve) =>
                                    setTimeout(resolve, statusResult.waitTime || 500)
                                )
                                continue
                            } else if (statusResult.decision.shouldRetry) {
                                // Status 0x04: ERROR_RANGER or 0x05: ERROR_REPEAT
                                //  Retryable error - can try again
                                console.log(` ${statusResult.message}`)

                                results.errorResponses.push({
                                    attempt,
                                    error: statusResult.message,
                                    statusCode: measurementStatus,
                                    canRetry: statusResult.canRetry,
                                    maxRetries: statusResult.maxRetries
                                })

                                // Check if we can retry
                                if (!statusResult.decision.maxRetriesReached) {
                                    // Use handler's smart retry logic
                                    const retryResult =
                                        await ImprovedImpedanceStatusHandler.handleRetry(
                                            measurementStatus,
                                            attempt,
                                            50 // Max attempts in this loop
                                        )

                                    if (retryResult.shouldRetry) {
                                        console.log(
                                            `      ↻ Retrying (attempt ${retryResult.nextAttempt})...`
                                        )
                                        continue // Continue loop to retry
                                    }
                                } else {
                                    console.log(` Max retries reached (${statusResult.maxRetries})`)
                                }
                            } else if (statusResult.decision.isCritical) {
                                // Status 0x01: CHECK_ELECTRODE
                                // CRITICAL - Electrode problem, must stop
                                console.log(`\n CRITICAL: ${statusResult.message}`)

                                results.errorResponses.push({
                                    attempt,
                                    error: statusResult.message,
                                    statusCode: measurementStatus,
                                    isCritical: true
                                })

                                // Show user-friendly error message
                                if (statusResult.userMessage) {
                                    console.log(`\n${statusResult.userMessage}`)
                                }

                                // Show solutions
                                if (statusResult.solutions) {
                                    console.log(`\nRecommended Actions:`)
                                    statusResult.solutions.forEach((solution) => {
                                        console.log(`   ${solution}`)
                                    })
                                }

                                console.log(
                                    `\n  CRITICAL ERROR - Stopping measurement for ${mode.name}`
                                )
                                break // Exit loop - can't continue with electrode problem
                            } else if (statusResult.decision.shouldAbort) {
                                // Status 0x06: USER_EXIT or other abort conditions
                                // ⏹️ Stop measurement (user cancelled or other reason)
                                console.log(`      ⏹️  ${statusResult.message}`)

                                results.zeroResponses.push({
                                    attempt,
                                    rawResponse: responseData,
                                    reason: statusResult.message,
                                    statusCode: measurementStatus
                                })
                                break // Exit loop
                            } else {
                                // Unknown/unhandled status
                                console.log(
                                    ` Unhandled status: 0x${measurementStatus.toString(16).toUpperCase()}`
                                )
                                results.zeroResponses.push({
                                    attempt,
                                    rawResponse: responseData,
                                    reason: `Unknown status: 0x${measurementStatus.toString(16)}`,
                                    statusCode: measurementStatus
                                })
                            }
                        } else {
                            // Invalid response format (header mismatch)
                            console.warn(`Invalid response format`)
                            results.zeroResponses.push({
                                attempt,
                                rawResponse: responseData,
                                reason: "Invalid response format"
                            })
                        }
                    } else if (responseData) {
                        console.warn(` Unexpected response length: ${responseData.length} bytes`)
                        results.zeroResponses.push({
                            attempt,
                            rawResponse: responseData,
                            reason: "Unexpected response length"
                        })
                    }

                    // Delay between attempts
                    await new Promise((resolve) => setTimeout(resolve, 500))
                } catch (queryError) {
                    console.error(`      ❌ Attempt ${attempt} failed: ${queryError.message}`)
                    results.errorResponses.push({
                        attempt,
                        error: queryError.message,
                        exception: true
                    })
                }
            }

            // Store results for this mode
            phaseAngleResults[mode.name] = results
        }

        // ✅ ENHANCED: Display comprehensive results
        console.log("\n" + "=".repeat(70))
        console.log("📊 PHASE ANGLE MEASUREMENT RESULTS")
        console.log("=".repeat(70))

        Object.entries(phaseAngleResults).forEach(([mode, results]) => {
            console.log(`\n${mode}:`)
            console.log(`   Total Attempts: ${results.attempts}`)
            console.log(`   Successful Readings: ${results.meaningfulResponses.length}`)
            console.log(`   Measuring/Waiting: ${results.zeroResponses.length}`)
            console.log(`   Errors: ${results.errorResponses.length}`)

            // ✅ ENHANCED: Show status code breakdown
            if (Object.keys(results.statusCodes).length > 0) {
                console.log(`\n   Status Code Breakdown:`)
                Object.entries(results.statusCodes).forEach(([code, count]) => {
                    const codeNum = parseInt(code)
                    const codeMap = {
                        0x00: "NULL",
                        0x01: "CHECK_ELECTRODE",
                        0x02: "MEASURE",
                        0x03: "SUCCESS",
                        0x04: "ERROR_RANGER",
                        0x05: "ERROR_REPEAT",
                        0x06: "USER_EXIT"
                    }
                    const codeName = codeMap[codeNum] || "UNKNOWN"
                    console.log(
                        `      0x${codeNum.toString(16).toUpperCase()} (${codeName}): ${count}x`
                    )
                })
            }

            // Show error details if any
            if (results.errorResponses.length > 0) {
                console.log(`\n   Error Details:`)
                results.errorResponses.slice(0, 5).forEach((err) => {
                    const statusStr =
                        err.statusCode !== undefined
                            ? ` [0x${err.statusCode.toString(16).toUpperCase()}]`
                            : ""
                    const criticalStr = err.isCritical ? " (CRITICAL)" : ""
                    console.log(
                        `      Attempt ${err.attempt}: ${err.error}${statusStr}${criticalStr}`
                    )
                })
                if (results.errorResponses.length > 5) {
                    console.log(`      ... and ${results.errorResponses.length - 5} more errors`)
                }
            }

            // Analyze phase angle results if we have any
            if (results.meaningfulResponses.length > 0) {
                const rawPhaseAngles = results.meaningfulResponses.map(
                    (r) => r.phaseAngle.phaseAngleRaw
                )
                const phaseAngles = results.meaningfulResponses.map((r) => r.phaseAngle.value)
                const impedanceValues = results.meaningfulResponses.map((r) => r.impedance.value)

                console.log("\n   📐 Phase Angle Statistics:")
                console.log(`      Phase angle raw: ${rawPhaseAngles}°`)
                console.log(`      Min: ${Math.min(...phaseAngles).toFixed(1)}°`)
                console.log(`      Max: ${Math.max(...phaseAngles).toFixed(1)}°`)
                console.log(
                    `      Avg: ${(phaseAngles.reduce((a, b) => a + b, 0) / phaseAngles.length).toFixed(1)}°`
                )
                console.log(
                    `      Range: ${(Math.max(...phaseAngles) - Math.min(...phaseAngles)).toFixed(1)}°`
                )

                console.log("\n   ⚡ Impedance Statistics:")
                console.log(`      Min: ${Math.min(...impedanceValues)} Ω`)
                console.log(`      Max: ${Math.max(...impedanceValues)} Ω`)
                console.log(
                    `      Avg: ${(impedanceValues.reduce((a, b) => a + b, 0) / impedanceValues.length).toFixed(1)} Ω`
                )
                console.log(
                    `      Range: ${Math.max(...impedanceValues) - Math.min(...impedanceValues)} Ω`
                )

                // Show all readings
                console.log("\n   📈 All Readings:")
                results.meaningfulResponses.forEach((reading, idx) => {
                    console.log(
                        `      Reading ${idx + 1}: ${reading.phaseAngle.value.toFixed(1)}°, ${reading.impedance.value}Ω`
                    )
                })
            } else {
                console.log("\n   ❌ No successful readings received!")
            }
        })

        // ✅ ENHANCED: Display global error statistics
        if (Object.keys(globalErrorCounts).length > 0) {
            console.log("\n" + "=".repeat(70))
            console.log("📊 GLOBAL ERROR CODE STATISTICS")
            console.log("=".repeat(70))
            // Display error statistics using handler
            ImprovedImpedanceStatusHandler.displayErrorStatistics(globalErrorCounts)
        }

        console.log("=".repeat(70))
        showMenu()
    } catch (error) {
        console.error("❌ Phase angle query failed:", error)
        showMenu()
    }
}

// ============================================================================
// CASE 40A: LEG IMPEDANCE AT 50 kHz (4-Electrode)
// ============================================================================
async function case40a_LegImpedance50kHz() {
    try {
        console.log("\n📡 Measuring Leg Impedance: 50 kHz (4-Electrode)")

        // Stability check function
        const isStableResponse = (responses) => {
            if (responses.length < 5) return false

            const lastFive = responses.slice(-5)
            const phaseAngles = lastFive.map((r) => r.phaseAngle.value)
            const impedanceValues = lastFive.map((r) => r.impedance.value)

            const phaseAngleVariation = Math.max(...phaseAngles) - Math.min(...phaseAngles)
            const impedanceVariation = Math.max(...impedanceValues) - Math.min(...impedanceValues)

            const isStablePhaseAngle = phaseAngleVariation < 1.0
            const isStableImpedance = impedanceVariation < 10.0

            return isStablePhaseAngle && isStableImpedance
        }

        // Step 1: Stop current test
        console.log("   Stopping previous measurement...")
        await sendBiaCommand([0x55, 0x06, 0xb0, 0x00, 0x00, 0xf5])
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Step 2: Set impedance mode for 4-electrode legs at 50 kHz
        console.log("   Setting 4-Electrode Legs mode at 50 kHz...")
        await sendBiaCommand([0x55, 0x06, 0xb0, 0x02, 0x05, 0xee])
        await new Promise((resolve) => setTimeout(resolve, 800))

        // Query command
        const queryCommand = [0x55, 0x05, 0xb1, 0x01, 0xf4]
        // Track results
        const results = {
            attempts: 0,
            meaningfulResponses: [],
            zeroResponses: [],
            errorResponses: [],
            statusCodes: {}
        }

        console.log("   Starting measurement attempts...\n")

        // Collect up to 50 attempts until stable
        for (let attempt = 1; attempt <= 50; attempt++) {
            results.attempts = attempt

            try {
                console.log(`   Attempt ${attempt}`)

                const responseData = await sendBiaCommand(queryCommand, {
                    timeout: 5000,
                    verbose: false
                })

                // Handle variable response lengths (at least 13 bytes)
                if (responseData && responseData.length >= 13) {
                    // Check if response is valid 4-electrode response
                    if (responseData[0] === 0xaa && responseData[2] === 0xb1) {
                        // Extract measurement status (byte 4)
                        const measurementStatus = responseData[4]

                        // Track status codes
                        if (!results.statusCodes[measurementStatus]) {
                            results.statusCodes[measurementStatus] = 0
                        }
                        results.statusCodes[measurementStatus]++

                        // Use ImprovedImpedanceStatusHandler
                        const statusResult = ImprovedImpedanceStatusHandler.handleImpedanceStatus(
                            measurementStatus,
                            attempt
                        )
                        console.log(statusResult)
                        if (statusResult.decision.shouldAccept) {
                            // Status 0x03: SUCCESS
                            const parsedResult = parse4Electrode50kHzImpedance(responseData)

                            if (parsedResult && parsedResult.impedance.value > 0) {
                                results.meaningfulResponses.push(parsedResult)
                                console.log(`${statusResult.message}`)
                                console.log(
                                    `         Phase Angle: ${parsedResult.phaseAngle.value.toFixed(1)}°, Impedance: ${parsedResult.impedance.value}Ω`
                                )

                                // Check for stable responses
                                if (isStableResponse(results.meaningfulResponses)) {
                                    console.log(
                                        `\n✅ Stable measurements detected after ${attempt} attempts!`
                                    )
                                    break
                                }
                            } else {
                                console.log("⚠️ Status success but impedance is 0")
                                results.zeroResponses.push({
                                    attempt,
                                    rawResponse: responseData,
                                    reason: "Status success but impedance is 0",
                                    statusCode: measurementStatus
                                })
                            }
                        } else if (statusResult.decision.shouldWait) {
                            // Status 0x02: MEASURE
                            console.log(
                                `      ⏳ ${statusResult.message} (waiting ${statusResult.waitTime || 500}ms)`
                            )
                            results.zeroResponses.push({
                                attempt,
                                rawResponse: responseData,
                                reason: "Device still measuring (status 0x02)",
                                statusCode: measurementStatus
                            })
                            await new Promise((resolve) =>
                                setTimeout(resolve, statusResult.waitTime || 500)
                            )
                            continue
                        } else if (statusResult.decision.shouldRetry) {
                            // Status 0x04: ERROR_RANGER or 0x05: ERROR_REPEAT
                            console.log(`⚠️ ${statusResult.message}`)

                            results.errorResponses.push({
                                attempt,
                                error: statusResult.message,
                                statusCode: measurementStatus,
                                canRetry: statusResult.canRetry,
                                maxRetries: statusResult.maxRetries
                            })

                            if (!statusResult.decision.maxRetriesReached) {
                                const retryResult =
                                    await ImprovedImpedanceStatusHandler.handleRetry(
                                        measurementStatus,
                                        attempt,
                                        50
                                    )

                                if (retryResult.shouldRetry) {
                                    console.log(
                                        `🔄 Retrying (attempt ${retryResult.nextAttempt})...`
                                    )
                                    continue
                                }
                            } else {
                                console.log(`❌ Max retries reached (${statusResult.maxRetries})`)
                            }
                        } else if (statusResult.decision.isCritical) {
                            // Status 0x01: CHECK_ELECTRODE
                            console.log(`\n❌ CRITICAL: ${statusResult.message}`)

                            results.errorResponses.push({
                                attempt,
                                error: statusResult.message,
                                statusCode: measurementStatus,
                                isCritical: true
                            })

                            if (statusResult.userMessage) {
                                console.log(`\n⚠️ ${statusResult.userMessage}`)
                            }

                            if (statusResult.solutions) {
                                console.log("\nRecommended Actions:")
                                statusResult.solutions.forEach((solution) => {
                                    console.log(`   • ${solution}`)
                                })
                            }

                            console.log("\n⛔ CRITICAL ERROR - Stopping leg measurement")
                            break
                        } else if (statusResult.decision.shouldAbort) {
                            // Status 0x06: USER_EXIT
                            console.log(`      ⏹️  ${statusResult.message}`)

                            results.zeroResponses.push({
                                attempt,
                                rawResponse: responseData,
                                reason: statusResult.message,
                                statusCode: measurementStatus
                            })
                            break
                        } else {
                            // Unknown/unhandled status
                            console.log(
                                `❓ Unhandled status: 0x${measurementStatus.toString(16).toUpperCase()}`
                            )
                            results.zeroResponses.push({
                                attempt,
                                rawResponse: responseData,
                                reason: `Unknown status: 0x${measurementStatus.toString(16)}`,
                                statusCode: measurementStatus
                            })
                        }
                    } else {
                        console.warn("⚠️ Invalid response format")
                        results.zeroResponses.push({
                            attempt,
                            rawResponse: responseData,
                            reason: "Invalid response format"
                        })
                    }
                } else if (responseData) {
                    console.warn(`⚠️ Unexpected response length: ${responseData.length} bytes`)
                    results.zeroResponses.push({
                        attempt,
                        rawResponse: responseData,
                        reason: "Unexpected response length"
                    })
                }

                // Delay between attempts
                await new Promise((resolve) => setTimeout(resolve, 500))
            } catch (queryError) {
                console.error(`      ❌ Attempt ${attempt} failed: ${queryError.message}`)
                results.errorResponses.push({
                    attempt,
                    error: queryError.message,
                    exception: true
                })
            }
        }

        // Display results
        console.log("\n" + "=".repeat(70))
        console.log("📊 LEG IMPEDANCE MEASUREMENT RESULTS (50 kHz)")
        console.log("=".repeat(70))
        console.log(`Total Attempts: ${results.attempts}`)
        console.log(`Successful Readings: ${results.meaningfulResponses.length}`)
        console.log(`Measuring/Waiting: ${results.zeroResponses.length}`)
        console.log(`Errors: ${results.errorResponses.length}`)

        if (results.meaningfulResponses.length > 0) {
            const finalReading = results.meaningfulResponses[results.meaningfulResponses.length - 1]
            console.log("\n✅ Final Leg Reading:")
            console.log(`   Phase Angle: ${finalReading.phaseAngle.value.toFixed(1)}°`)
            console.log(`   Impedance: ${finalReading.impedance.value}Ω`)

            return {
                success: true,
                measurement: finalReading,
                attempts: results.attempts,
                allReadings: results.meaningfulResponses
            }
        } else {
            console.log("\n❌ No successful leg readings received!")
            return {
                success: false,
                error: "No successful readings",
                attempts: results.attempts,
                errorDetails: results.errorResponses
            }
        }
    } catch (error) {
        console.error("❌ Leg impedance query failed:", error)
        return {
            success: false,
            error: error.message
        }
    }
}

// ============================================================================
// CASE 40B: ARM IMPEDANCE AT 50 kHz (4-Electrode)
// ============================================================================
async function case40b_ArmImpedance50kHz() {
    try {
        console.log("\n📡 Measuring Arm Impedance: 50 kHz (4-Electrode)")

        // Stability check function
        const isStableResponse = (responses) => {
            if (responses.length < 5) return false

            const lastFive = responses.slice(-5)
            const phaseAngles = lastFive.map((r) => r.phaseAngle.value)
            const impedanceValues = lastFive.map((r) => r.impedance.value)

            const phaseAngleVariation = Math.max(...phaseAngles) - Math.min(...phaseAngles)
            const impedanceVariation = Math.max(...impedanceValues) - Math.min(...impedanceValues)

            const isStablePhaseAngle = phaseAngleVariation < 1.0
            const isStableImpedance = impedanceVariation < 10.0

            return isStablePhaseAngle && isStableImpedance
        }

        // Step 1: Stop current test
        console.log("   Stopping previous measurement...")
        await sendBiaCommand([0x55, 0x06, 0xb0, 0x00, 0x00, 0xf5])
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Step 2: Set impedance mode for 4-electrode arms at 50 kHz
        console.log("   Setting 4-Electrode Arms mode at 50 kHz...")
        await sendBiaCommand([0x55, 0x06, 0xb0, 0x03, 0x05, 0xed])
        await new Promise((resolve) => setTimeout(resolve, 800))

        //verify mode
        const verifyModeCommand = [0x55, 0x05, 0xb1, 0x01, 0xf4]
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Query command
        const queryCommand = [0x55, 0x05, 0xb1, 0x01, 0xf4]

        // Track results
        const results = {
            attempts: 0,
            meaningfulResponses: [],
            zeroResponses: [],
            errorResponses: [],
            statusCodes: {}
        }

        console.log("   Starting measurement attempts...\n")

        // Collect up to 50 attempts until stable
        for (let attempt = 1; attempt <= 50; attempt++) {
            results.attempts = attempt

            try {
                console.log(`   Attempt ${attempt}`)

                const responseData = await sendBiaCommand(queryCommand, {
                    timeout: 5000,
                    verbose: false
                })
                for (let j = 0; j < responseData.length; j++) {
                    console.log(
                        `Response Data ${j} 0x${responseData[j].toString(16).padStart(2, "0")}`,
                        responseData[j]
                    )
                }
                console.log(responseData.length)
                console.log("Response Data:", responseData)
                console.log("Response Data: 4 ", responseData[4])

                // // Handle variable response lengths (at least 13 bytes)
                if (responseData && responseData.length >= 13) {
                    // Check if response is valid 4-electrode response
                    if (responseData[0] === 0xaa && responseData[2] === 0xb1) {
                        // Extract measurement status (byte 4)
                        const measurementStatus = responseData[4]

                        // Track status codes
                        if (!results.statusCodes[measurementStatus]) {
                            results.statusCodes[measurementStatus] = 0
                        }
                        results.statusCodes[measurementStatus]++
                        console.log("result object", results.statusCodes, measurementStatus)
                        // Use ImprovedImpedanceStatusHandler
                        const statusResult = ImprovedImpedanceStatusHandler.handleImpedanceStatus(
                            measurementStatus,
                            attempt
                        )
                        console.log("result", statusResult)

                        if (statusResult.decision.shouldAccept) {
                            console.log(
                                `      ✅ ${statusResult.message} should accept this measurement`
                            )
                            //Status 0x03: SUCCESS
                            const parsedResult = parse4Electrode50kHzImpedance(responseData)
                            if (parsedResult && parsedResult.impedance.value > 0) {
                                results.meaningfulResponses.push(parsedResult)
                                console.log(`${statusResult.message}`)
                                console.log(
                                    `         Phase Angle: ${parsedResult.phaseAngle.value.toFixed(1)}°, Impedance: ${parsedResult.impedance.value}Ω`
                                )

                                // Check for stable responses
                                if (isStableResponse(results.meaningfulResponses)) {
                                    console.log(
                                        `\n✅ Stable measurements detected after ${attempt} attempts!`
                                    )
                                    break
                                }
                            } else {
                                console.log("⚠️ Status success but impedance is 0")
                                results.zeroResponses.push({
                                    attempt,
                                    rawResponse: responseData,
                                    reason: "Status success but impedance is 0",
                                    statusCode: measurementStatus
                                })
                            }
                        } else if (statusResult.decision.shouldWait) {
                            // Status 0x02: MEASURE
                            console.log(
                                `      ⏳ ${statusResult.message} (waiting ${statusResult.waitTime || 500}ms)`
                            )
                            results.zeroResponses.push({
                                attempt,
                                rawResponse: responseData,
                                reason: "Device still measuring (status 0x02)",
                                statusCode: measurementStatus
                            })
                            await new Promise((resolve) =>
                                setTimeout(resolve, statusResult.waitTime || 500)
                            )
                            continue
                        } else if (statusResult.decision.shouldRetry) {
                            // Status 0x04: ERROR_RANGER or 0x05: ERROR_REPEAT
                            console.log(`⚠️ ${statusResult.message}`)

                            results.errorResponses.push({
                                attempt,
                                error: statusResult.message,
                                statusCode: measurementStatus,
                                canRetry: statusResult.canRetry,
                                maxRetries: statusResult.maxRetries
                            })

                            if (!statusResult.decision.maxRetriesReached) {
                                const retryResult =
                                    await ImprovedImpedanceStatusHandler.handleRetry(
                                        measurementStatus,
                                        attempt,
                                        50
                                    )

                                if (retryResult.shouldRetry) {
                                    console.log(
                                        `🔄 Retrying (attempt ${retryResult.nextAttempt})...`
                                    )
                                    continue
                                }
                            } else {
                                console.log(`❌ Max retries reached (${statusResult.maxRetries})`)
                            }
                        } else if (statusResult.decision.isCritical) {
                            // Status 0x01: CHECK_ELECTRODE
                            console.log(`\n❌ CRITICAL: ${statusResult.message}`)

                            results.errorResponses.push({
                                attempt,
                                error: statusResult.message,
                                statusCode: measurementStatus,
                                isCritical: true
                            })

                            if (statusResult.userMessage) {
                                console.log(`\n⚠️ ${statusResult.userMessage}`)
                            }

                            if (statusResult.solutions) {
                                console.log("\nRecommended Actions:")
                                statusResult.solutions.forEach((solution) => {
                                    console.log(`   • ${solution}`)
                                })
                            }

                            console.log("\n⛔ CRITICAL ERROR - Stopping arm measurement")
                            break
                        } else if (statusResult.decision.shouldAbort) {
                            // Status 0x06: USER_EXIT
                            console.log(`      ⏹️  ${statusResult.message}`)

                            results.zeroResponses.push({
                                attempt,
                                rawResponse: responseData,
                                reason: statusResult.message,
                                statusCode: measurementStatus
                            })
                            break
                        } else {
                            // Unknown/unhandled status
                            console.log(
                                `❓ Unhandled status: 0x${measurementStatus.toString(16).toUpperCase()}`
                            )
                            results.zeroResponses.push({
                                attempt,
                                rawResponse: responseData,
                                reason: `Unknown status: 0x${measurementStatus.toString(16)}`,
                                statusCode: measurementStatus
                            })
                        }
                    } else {
                        console.warn("⚠️ Invalid response format")
                        results.zeroResponses.push({
                            attempt,
                            rawResponse: responseData,
                            reason: "Invalid response format"
                        })
                    }
                } else if (responseData) {
                    console.warn(`⚠️ Unexpected response length: ${responseData.length} bytes`)
                    results.zeroResponses.push({
                        attempt,
                        rawResponse: responseData,
                        reason: "Unexpected response length"
                    })
                }
                // const parsedResult = parse4Electrode50kHzImpedance(responseData);
                //     if (parsedResult && parsedResult.impedance.value > 0) {
                //       results.meaningfulResponses.push(parsedResult);
                //       console.log(`${statusResult.message}`);
                //       console.log(
                //         `         Phase Angle: ${parsedResult.phaseAngle.value.toFixed(1)}°, Impedance: ${parsedResult.impedance.value}Ω`,
                //       );

                //       // Check for stable responses
                //       if (isStableResponse(results.meaningfulResponses)) {
                //         console.log(
                //           `\n✅ Stable measurements detected after ${attempt} attempts!`,
                //         );
                //         break;
                //       }
                //     } else {
                //       console.log("⚠️ Status success but impedance is 0");
                //       results.zeroResponses.push({
                //         attempt,
                //         rawResponse: responseData,
                //         reason: "Status success but impedance is 0",
                //         // statusCode: measurementStatus,
                //       });
                //     }
                // Delay between attempts
                await new Promise((resolve) => setTimeout(resolve, 500))
            } catch (queryError) {
                console.error(`      ❌ Attempt ${attempt} failed: ${queryError.message}`)
                results.errorResponses.push({
                    attempt,
                    error: queryError.message,
                    exception: true
                })
            }
        }

        // Display results
        console.log("\n" + "=".repeat(70))
        console.log("📊 ARM IMPEDANCE MEASUREMENT RESULTS (50 kHz)")
        console.log("=".repeat(70))
        console.log(`Total Attempts: ${results.attempts}`)
        console.log(`Successful Readings: ${results.meaningfulResponses.length}`)
        console.log(`Measuring/Waiting: ${results.zeroResponses.length}`)
        console.log(`Errors: ${results.errorResponses.length}`)

        if (results.meaningfulResponses.length > 0) {
            const finalReading = results.meaningfulResponses[results.meaningfulResponses.length - 1]
            console.log("\n✅ Final Arm Reading:")
            console.log(`   Phase Angle: ${finalReading.phaseAngle.value.toFixed(1)}°`)
            console.log(`   Impedance: ${finalReading.impedance.value}Ω`)

            return {
                success: true,
                measurement: finalReading,
                attempts: results.attempts,
                allReadings: results.meaningfulResponses
            }
        } else {
            console.log("\n❌ No successful arm readings received!")
            return {
                success: false,
                error: "No successful readings",
                attempts: results.attempts,
                errorDetails: results.errorResponses
            }
        }
    } catch (error) {
        console.error("❌ Arm impedance query failed:", error)
        return {
            success: false,
            error: error.message
        }
    }
}

// Specific parsing function for 50 kHz 4-electrode response

function parse4Electrode50kHzImpedance(data) {
    // Validate response header
    if (data[0] !== 0xaa || data[2] !== 0xb1) {
        return null
    }

    // Verify response length
    if (data.length < 13) {
        return null
    }

    try {
        // Parse Byte 3: Frequency Code
        const frequencyCode = (data[3] >> 4) & 0x0f
        const responseTypeCode = data[3] & 0x0f

        // Parse Byte 4: Measurement Status
        const measurementStatus = data[4]

        // Parse Byte 5: Data Type
        const dataType = data[5]

        // ✅ Parse Bytes 6-7: Phase Angle (SIGNED 16-bit, little-endian)
        // Resolution: 0.1° (magnified 10 times)
        let phaseAngleRaw = (data[6] & 0xff) | ((data[7] & 0xff) << 8)

        // Convert to signed if necessary
        if (phaseAngleRaw > 32767) {
            phaseAngleRaw = phaseAngleRaw - 65536
        }
        const phaseAngle = phaseAngleRaw / 10

        // ✅ Parse Bytes 8-11: Impedance (UNSIGNED 32-bit, little-endian)
        // Resolution: 1Ω (NOT 0.1Ω)
        const impedanceRaw =
            (data[8] & 0xff) |
            ((data[9] & 0xff) << 8) |
            ((data[10] & 0xff) << 16) |
            ((data[11] & 0xff) << 24)
        const impedance = impedanceRaw // Resolution: 1Ω

        // Parse Byte 12: Checksum
        const checksum = data[12]

        // Return parsed result
        return {
            measurementType: "4-Electrode 50 kHz",
            frequency: getFrequencyName(frequencyCode),
            responseType: getResponseTypeName(responseTypeCode),
            measurementStatus: {
                code: measurementStatus,
                description: interpretMeasurementStatus(measurementStatus)
            },
            phaseAngle: {
                value: phaseAngle,
                unit: "°",
                rawBytes: [data[6], data[7]],
                rawValue: phaseAngleRaw,
                resolution: 0.1
            },
            impedance: {
                value: impedance,
                unit: "Ω",
                rawBytes: [data[8], data[9], data[10], data[11]],
                rawValue: impedanceRaw,
                resolution: 1 // ✅ Resolution is 1Ω
            },
            rawData: {
                fullResponse: Array.from(data)
            }
        }
    } catch (error) {
        console.error(`Error parsing response: ${error.message}`)
        return null
    }
}

// Helper function to interpret measurement status
function interpretMeasurementStatus(statusByte) {
    const statusDescriptions = {
        0x00: "Normal measurement",
        0x01: "Working mode error",
        0x02: "Frequency error",
        0x03: "Impedance measurement error",
        0x04: "Over range",
        0x05: "Under range"
    }

    return statusDescriptions[statusByte] || "Unknown status"
}

//weight case
export async function case41_WeightMeasurement() {

    try {

        // ====================================================================

        // PORT CHECK

        // ====================================================================
 
        if (!biaPort || !biaPort.isOpen) {

            emitWeightStatus(0x09) // PORT_ERROR

            console.log("❌ BIA port not connected")

            if (!IS_ELECTRON) showMenu()

            return

        }
 
        // ====================================================================

        // CALIBRATION FORMAT GUARD

        // ====================================================================

        // The pipeline now works on raw ADC counts, not the module's kg field.

        // An old calibration.json (kg-based, factor ~1.53) would silently

        // produce nonsense, so refuse to run against it.
 
        if (

            !Number.isFinite(weightCalibration?.zeroAdc) ||

            !Number.isFinite(weightCalibration?.factor)

        ) {

            emitWeightStatus(0x06) // CALIBRATION_ERROR

            console.log("❌ calibration.json missing zeroAdc / factor — run ADC calibration first")

            if (!IS_ELECTRON) showMenu()

            return

        }
 
        if (Math.abs(weightCalibration.factor) > 0.1) {

            emitWeightStatus(0x06) // CALIBRATION_ERROR

            console.log("❌ calibration.json looks like the OLD kg-based format")

            console.log(`   factor = ${weightCalibration.factor} (expected ~0.0018 kg/count)`)

            console.log("   The factor is now kg PER ADC COUNT and must keep its sign.")

            if (!IS_ELECTRON) showMenu()

            return

        }
 
        const ZERO_ADC = weightCalibration.zeroAdc // ADC counts at no load (any sign)

        const CALIBRATION_FACTOR = weightCalibration.factor // kg per count, SIGNED
 
        console.log(

            `⚖️  zero=${ZERO_ADC.toFixed(1)} factor=${CALIBRATION_FACTOR.toExponential(6)} kg/count ` +

                `(ADC ${CALIBRATION_FACTOR > 0 ? "rises" : "falls"} with load)`

        )
 
        // ====================================================================

        // RESULTS STORAGE

        // ====================================================================
 
        const weightResults = {

            attempts: 0,

            measurements: [],

            stabilityChecks: [],

            errors: []

        }

        let finalweight = 0
 
        // ====================================================================

        // STABILITY CHECK FUNCTION

        // ====================================================================
 
        const isStableWeight = (measurements) => {

            if (measurements.length < WEIGHT_STABILITY_COUNT) return false
 
            const window = measurements

                .slice(-WEIGHT_STABILITY_COUNT)

                .map((m) => m.calibratedWeight)
 
            // every sample in the window must be a real load

            if (window.some((w) => w < WEIGHT_MIN_VALID)) return false
 
            const n = window.length

            const mean = window.reduce((a, b) => a + b, 0) / n

            const variance = window.reduce((a, w) => a + (w - mean) ** 2, 0) / n

            const sd = Math.sqrt(variance)

            const cv = sd / mean
 
            console.log("Weight Stability Check:")

            console.log(`   Window: [${window.map((w) => w.toFixed(2)).join(", ")}] kg`)

            console.log(

                `   Mean: ${mean.toFixed(3)} kg | SD: ${sd.toFixed(4)} kg | CV: ${(cv * 100).toFixed(3)}%`

            )
 
            return cv <= WEIGHT_CV_THRESHOLD && sd <= WEIGHT_SD_CEILING

        }
 
        // ====================================================================

        // SETUP COMMANDS

        // ====================================================================
 
        const setWeightModeCommand = [0x55, 0x05, 0xa0, 0x01, 0x05]

        const weightQueryCommand = [0x55, 0x05, 0xa1, 0x00, 0x05]
 
        // Stop current test

        try {

            await sendBiaCommand([0x55, 0x06, 0xb0, 0x00, 0x00, 0xf5])

            await new Promise((resolve) => setTimeout(resolve, 500))

        } catch (error) {

            console.log("⚠️ Warning: Could not stop current test")

        }
 
        // Set weight mode

        try {

            await sendBiaCommand(setWeightModeCommand)

            await new Promise((resolve) => setTimeout(resolve, 500))

        } catch (error) {

            emitWeightStatus(0x08) // TIMEOUT

            console.log("❌ Failed to set weight mode")

            if (!IS_ELECTRON) showMenu()

            return

        }
 
        // Maximum attempts

        const MAX_ATTEMPTS = 20
 
        // ====================================================================

        // MEASUREMENT LOOP

        // ====================================================================
 
        while (weightResults.attempts < MAX_ATTEMPTS) {

            try {

                weightResults.attempts++

                console.log(`\n Weight Measurement Attempt ${weightResults.attempts}`)
 
                // ══════════════════════════════════════════════════════════

                // SEND QUERY COMMAND

                // ══════════════════════════════════════════════════════════
 
                let responseData

                try {

                    responseData = await sendBiaCommand(weightQueryCommand, {

                        timeout: 5000,

                        verbose: false

                    })

                } catch (error) {

                    emitWeightStatus(0x08) // TIMEOUT

                    console.log(` Attempt ${weightResults.attempts}: No response`)

                    weightResults.errors.push({

                        attempt: weightResults.attempts,

                        error: "Timeout"

                    })
 
                    if (weightResults.attempts >= MAX_ATTEMPTS) {

                        console.log(" Max attempts reached with no response")

                        break

                    }
 
                    await new Promise((resolve) => setTimeout(resolve, 500))

                    continue

                }
 
                // ══════════════════════════════════════════════════════════

                // VALIDATE RESPONSE FORMAT

                // ══════════════════════════════════════════════════════════
 
                if (!responseData || responseData.length < 14) {

                    emitWeightStatus(0x0a) // INVALID_RESPONSE

                    console.log(` Attempt ${weightResults.attempts}: Invalid response format`)

                    weightResults.errors.push({

                        attempt: weightResults.attempts,

                        error: "Invalid response format"

                    })

                    await new Promise((resolve) => setTimeout(resolve, 500))

                    continue

                }
 
                if (responseData[0] !== 0xaa || responseData[2] !== 0xa1) {

                    emitWeightStatus(0x0a) // INVALID_RESPONSE

                    console.log(` Attempt ${weightResults.attempts}: Invalid response header`)

                    weightResults.errors.push({

                        attempt: weightResults.attempts,

                        error: "Invalid response header"

                    })

                    await new Promise((resolve) => setTimeout(resolve, 500))

                    continue

                }
 
                // Checksum — we are trusting raw ADC now, so verify the frame

                const expectedChecksum = frameChecksum(Array.from(responseData).slice(0, 13))

                if (expectedChecksum !== responseData[13]) {

                    emitWeightStatus(0x0a) // INVALID_RESPONSE

                    console.log(

                        ` Attempt ${weightResults.attempts}: Checksum mismatch ` +

                            `(got 0x${responseData[13].toString(16)}, expected 0x${expectedChecksum.toString(16)})`

                    )

                    weightResults.errors.push({

                        attempt: weightResults.attempts,

                        error: "Checksum mismatch"

                    })

                    await new Promise((resolve) => setTimeout(resolve, 500))

                    continue

                }
 
                // ══════════════════════════════════════════════════════════

                // PARSE RAW ADC (bytes 9-12, int32 little-endian, SIGNED)

                // ══════════════════════════════════════════════════════════

                // Bytes 5-8 (the module's own stable / real-time weight) are

                // NOT used: they come from the module's internal calibration,

                // which is invalid on this harness. Byte 3 status is kept for

                // diagnostics only, for the same reason.
 
                const statusByte = responseData[3]

                const adc = readInt32LE(responseData, 9)
 
                if (!Number.isFinite(adc)) {

                    emitWeightStatus(0x0a) // INVALID_RESPONSE

                    console.log(` Attempt ${weightResults.attempts}: Invalid ADC value`)

                    weightResults.errors.push({

                        attempt: weightResults.attempts,

                        error: "Invalid ADC value"

                    })

                    await new Promise((resolve) => setTimeout(resolve, 500))

                    continue

                }
 
                // ══════════════════════════════════════════════════════════

                // APPLY CALIBRATION

                // ══════════════════════════════════════════════════════════

                // Both terms carry their sign, so a falling ADC (negative net)

                // times a negative factor yields a positive weight. No polarity

                // flag, no conditional, no abs().
 
                const netAdc = adc - ZERO_ADC

                let calibratedWeight = netAdc * CALIBRATION_FACTOR
 
                // Inside the zero-noise band, report exactly 0

                if (Math.abs(calibratedWeight) < WEIGHT_DEADBAND_KG) {

                    calibratedWeight = 0

                }
 
                if (!Number.isFinite(calibratedWeight) || calibratedWeight < WEIGHT_MIN_SANE_KG) {

                    emitWeightStatus(0x06) // CALIBRATION_ERROR

                    console.log(

                        ` Attempt ${weightResults.attempts}: Calibration error ` +

                            `(adc=${adc}, net=${netAdc.toFixed(0)}, kg=${calibratedWeight})`

                    )

                    weightResults.errors.push({

                        attempt: weightResults.attempts,

                        error: "Calibration error"

                    })
 
                    if (weightResults.attempts >= MAX_ATTEMPTS) {

                        break

                    }

                    await new Promise((resolve) => setTimeout(resolve, 500))

                    continue

                }
 
                // ══════════════════════════════════════════════════════════

                // DETERMINE ERROR CODE & CHECK VALIDITY

                // ══════════════════════════════════════════════════════════
 
                let isStable = false

                let isZero = false

                let isOverload = false

                let isUnderload = false
 
                let statusCode = 0x03 // Default STABLE
 
                // Check for zero weight

                if (calibratedWeight === 0) {

                    isZero = true

                    statusCode = 0x01 // ZERO_POINT

                }

                // Check for overload — our own limit; the module's OVERLOAD

                // status is unusable while its calibration is invalid

                else if (calibratedWeight > 150) {

                    isOverload = true

                    statusCode = 0x04 // OVERLOAD

                    emitWeightStatus(statusCode, calibratedWeight)

                    console.log(" Scale overloaded - measurement aborted")

                    weightResults.errors.push({

                        attempt: weightResults.attempts,

                        statusCode: statusCode,

                        weight: calibratedWeight,

                        error: "Scale overloaded"

                    })

                    break // Stop on overload

                }

                // Check for underload - user standing but weight very low

                else if (calibratedWeight < 1.0) {

                    isUnderload = true

                    statusCode = 0x05 // UNDERLOAD

                    emitWeightStatus(statusCode, calibratedWeight)

                    console.log(`  Weight too low: ${calibratedWeight.toFixed(2)} kg`)

                    weightResults.errors.push({

                        attempt: weightResults.attempts,

                        statusCode: statusCode,

                        weight: calibratedWeight,

                        error: "Weight too low"

                    })

                    await new Promise((resolve) => setTimeout(resolve, 500))

                    continue

                }

                // Valid stable weight

                else if (calibratedWeight > 20 && calibratedWeight <= 150) {

                    isStable = true

                    statusCode = 0x03 // STABLE

                }
 
                // ══════════════════════════════════════════════════════════

                // HANDLE STATUS

                // ══════════════════════════════════════════════════════════
 
                emitWeightStatus(statusCode, calibratedWeight)
 
                console.log(`   ADC: ${adc}  |  Net: ${netAdc.toFixed(0)} counts`)

                console.log(`   Calibrated Weight: ${calibratedWeight.toFixed(2)} kg`)

                console.log(`   Status: ${statusCode === 0x03 ? "✅ Stable" : "⏳ Unstable"}`)
 
                // ══════════════════════════════════════════════════════════

                // STORE MEASUREMENT

                // ══════════════════════════════════════════════════════════
 
                const measurementDetails = {

                    attempt: weightResults.attempts,

                    adc: adc,

                    netAdc: netAdc,

                    calibratedWeight: calibratedWeight,

                    statusByte: statusByte, // diagnostics only

                    statusCode: statusCode,

                    isStable: isStable,

                    isOverload: isOverload,

                    isUnderload: isUnderload,

                    isZero: isZero

                }
 
                weightResults.measurements.push(measurementDetails)
 
                // ══════════════════════════════════════════════════════════

                // CHECK FOR STABILITY

                // ══════════════════════════════════════════════════════════
 
                if (calibratedWeight >= WEIGHT_MIN_VALID) {

                    if (isStableWeight(weightResults.measurements)) {

                        console.log("\n Stable weight measurement detected!")

                        break

                    }

                }
 
                // Delay between attempts

                await new Promise((resolve) => setTimeout(resolve, 500))

            } catch (queryError) {

                emitWeightStatus(0x07) // SENSOR_ERROR

                console.error(` Attempt ${weightResults.attempts} error: ${queryError.message}`)

                weightResults.errors.push({

                    attempt: weightResults.attempts,

                    error: queryError.message

                })
 
                if (weightResults.attempts >= MAX_ATTEMPTS) {

                    break

                }

            }

        }
 
        // ====================================================================

        // DISPLAY RESULTS

        // ====================================================================
 
        console.log("\n" + "=".repeat(70))

        console.log("⚖️  WEIGHT MEASUREMENT RESULTS")

        console.log("=".repeat(70))
 
        console.log(`\nTotal Attempts: ${weightResults.attempts}`)

        console.log(`Valid Measurements: ${weightResults.measurements.length}`)

        console.log(`Errors: ${weightResults.errors.length}`)
 
        if (weightResults.measurements.length > 0) {

            console.log("\nWEIGHT MEASUREMENTS:")
 
            weightResults.measurements.forEach((m) => {

                const statusName =

                    {

                        0x01: "ZERO",

                        0x02: "UNSTABLE",

                        0x03: "STABLE",

                        0x04: "OVERLOAD",

                        0x05: "UNDERLOAD"

                    }[m.statusCode] || "UNKNOWN"
 
                console.log(

                    `   Attempt ${m.attempt}: ${m.calibratedWeight.toFixed(2)} kg ` +

                        `(${statusName})  [adc ${m.adc}]`

                )

            })
 
            const validMeasurements = weightResults.measurements.filter(

                (m) => m.statusCode === 0x03

            )
 
            if (validMeasurements.length >= WEIGHT_STABILITY_COUNT) {

                const stableWindow = validMeasurements

                    .slice(-WEIGHT_STABILITY_COUNT)

                    .map((m) => m.calibratedWeight)
 
                finalweight = stableWindow.reduce((a, b) => a + b, 0) / stableWindow.length
 
                console.log(`\n FINAL WEIGHT: ${finalweight.toFixed(2)} kg`)

            } else {

                console.log("\n No valid stable measurements collected")

            }

        } else {

            console.log("\n No measurements collected")

        }
 
        if (weightResults.errors.length > 0) {

            console.log("\n ERRORS ENCOUNTERED:")

            weightResults.errors.forEach((e) => {

                console.log(`   Attempt ${e.attempt}: ${e.error || e.statusCode}`)

            })

        }
 
        console.log("=".repeat(70) + "\n")
 
        if (!IS_ELECTRON) showMenu()
 
        const finalResult = {

            success: finalweight > 0,

            weight: finalweight

        }

        console.log(`\n📤 Sending Final Result to UI:`, finalResult)
 
        return finalResult

    } catch (error) {

        emitWeightStatus(0x07) // SENSOR_ERROR

        console.error(" Weight measurement failed:", error.message)

        console.error(error)

        if (!IS_ELECTRON) showMenu()

    }

}

// Show menu
function showMenu() {
    console.log("1. List available ports")
    console.log("2. Connect Height Sensor (9600 baud)")
    console.log("3. Connect BIA Scale (38400 baud)")
    console.log("4. Disconnect Height")
    console.log("5. Disconnect BIA")
    console.log("6. Start Height Measurement")
    //  console.log('7.  Switch to Normal Weighing Mode (0xA0)');
    // console.log('8. Read Weight Status (0xA1)');
    console.log("7. Measure Weight")
    console.log("9. Calculate Impedance 20khz")
    console.log("10. Calculate Impedance 100khz")
    console.log("11. Calculate Full Body Composition")
    console.log("12. Phase Angle Calculation")
    console.log("20. Leg 50khz Calculation")
    console.log("21. Arms 50khz Calculation")
    console.log("13. Send Custom Command")
    console.log("14. Calibrate the machine")
    console.log("15. Tare the machine")
    console.log("0. Exit")
    console.log("=".repeat(60))
    rl.question("\nSelect option: ", handleMenuChoice)
}

// Handle menu choice
async function handleMenuChoice(choice) {
    try {
        switch (choice.trim()) {
            case "1":
                await getPorts()
                showMenu()
                break

            case "2":
                rl.question(
                    "Enter HEIGHT sensor port path (e.g., /dev/tty.usbserial-XXXX or COM3): ",
                    async (portPath) => {
                        try {
                            await connectHeightPort(portPath, 9600)
                            showMenu()
                        } catch (error) {
                            console.error("Failed:", error.message)
                            showMenu()
                        }
                    }
                )
                break

            case "3":
                rl.question(
                    "Enter BIA scale port path (e.g., /dev/tty.usbserial-YYYY or COM6): ",
                    async (portPath) => {
                        try {
                            await connectBiaPort(portPath, 38400)
                            showMenu()
                        } catch (error) {
                            console.error("Failed:", error.message)
                            showMenu()
                        }
                    }
                )
                break

            case "4":
                if (heightPort && heightPort.isOpen) {
                    await new Promise((resolve) => heightPort.close(resolve))
                    heightPort = null
                    console.log("✅ Height disconnected")
                } else {
                    console.log("⚠️  Height not connected")
                }
                showMenu()
                break

            case "5":
                if (biaPort && biaPort.isOpen) {
                    await new Promise((resolve) => biaPort.close(resolve))
                    biaPort = null
                    console.log("✅ BIA disconnected")
                } else {
                    console.log("⚠️  BIA not connected")
                }
                showMenu()
                break

            case "6":
                if (!heightPort || !heightPort.isOpen) {
                    handleHeightStatus(0x08) // PORT_ERROR
                    console.log("❌ Height sensor not connected")
                    showMenu()
                    return
                }

                console.log("\n" + "=".repeat(60))
                console.log("📏 STARTING HEIGHT MEASUREMENT")
                console.log("=".repeat(60))
                console.log("Please stand still and prepare for measurement.")
                console.log("=".repeat(60))

                rl.question("Press ENTER to start measuring: ", async () => {
                    try {
                        isMeasurementStopped = false
                        stableReadings = []
                        let attemptCount = 0
                        const maxAttempts = 60 // ~12 seconds at 200ms interval

                        const interval = setInterval(() => {
                            attemptCount++

                            // Check max attempts
                            if (attemptCount > maxAttempts) {
                                clearInterval(interval)
                                if (stableReadings.length === 0) {
                                    handleHeightStatus(0x07) // TIMEOUT error
                                    console.log("\n❌ No height readings collected")
                                    isMeasurementStopped = true
                                    heightPort.close()
                                    showMenu()
                                }
                                return
                            }

                            // Check port still open
                            if (!heightPort || !heightPort.isOpen) {
                                clearInterval(interval)
                                handleHeightStatus(0x08) // PORT_ERROR
                                isMeasurementStopped = true
                                showMenu()
                                return
                            }

                            // Send command
                            if (!isMeasurementStopped) {
                                try {
                                    heightPort.write(READ_CMD)
                                } catch (error) {
                                    console.error(`❌ Write error: ${error.message}`)
                                    clearInterval(interval)
                                    isMeasurementStopped = true
                                    heightPort.close()
                                    showMenu()
                                }
                            } else {
                                clearInterval(interval)
                            }
                        }, 200)
                    } catch (error) {
                        console.error("❌ Measurement error:", error.message)
                        isMeasurementStopped = true
                        if (heightPort && heightPort.isOpen) {
                            heightPort.close()
                        }
                        showMenu()
                    }
                })
                break

            case "7":
                await case41_WeightMeasurement()

                break

            case "8":
                try {
                    if (!biaPort || !biaPort.isOpen) {
                        console.log(" BIA not connected")
                        showMenu()
                        return
                    }
                    const cmd = createCommand(0xa1, [0x00])
                    await sendBiaCommand(cmd, true)
                } catch (error) {
                    console.error("Failed:", error.message)
                    showMenu()
                }
                break

            case "9":
                console.log("\n 20 kHz Impedance Query with Controlled Delay")
                rl.question(
                    'Press ENTER to start 20 kHz impedance measurement, or "q" to quit: ',
                    async (input) => {
                        if (input.toLowerCase() === "q") {
                            showMenu()
                            return
                        }

                        try {
                            // Call the 20 kHz impedance query function
                            await case38_20kHzImpedanceQuery()
                        } catch (error) {
                            console.error("Error in 20 kHz impedance query:", error)
                        } finally {
                            showMenu()
                        }
                    }
                )
                break

            case "10":
                console.log("\n 100 kHz Impedance Query with Stability Check")
                rl.question(
                    'Press ENTER to start 100 kHz impedance measurement, or "q" to quit: ',
                    async (input) => {
                        if (input.toLowerCase() === "q") {
                            showMenu()
                            return
                        }

                        try {
                            // Call the 100 kHz impedance query function
                            await case39_100kHzImpedanceQuery()
                        } catch (error) {
                            console.error("Error in 100 kHz impedance query:", error)
                        } finally {
                            showMenu()
                        }
                    }
                )
                break

            case "11":
                try {
                    if (!biaPort || !biaPort.isOpen) {
                        console.log("❌ BIA not connected")
                        showMenu()
                        return
                    }

                    // Check if impedance results are available
                    if (!impedance20kHzResults || !impedance100kHzResults) {
                        console.log("❌ Please run 20 kHz and 100 kHz impedance queries first")
                        showMenu()
                        return
                    }

                    //  console.log(' Automatically using impedance and height/weight values from previous measurements');

                    // Use finalheight and finalweight directly
                    const height = finalheight
                    const weight = finalweight

                    // Prompt for gender and age
                    rl.question("Gender (0=Female, 1=Male): ", (gender) => {
                        rl.question("Age (years): ", async (age) => {
                            try {
                                const cmd = create8ElectrodeBodyCompositionCommand(
                                    parseInt(gender),
                                    parseInt(height),
                                    parseInt(age),
                                    parseFloat("61.5"),
                                    // 20 kHz impedance values
                                    impedance20kHzResults.segments.rightHand,
                                    impedance20kHzResults.segments.leftHand,
                                    impedance20kHzResults.segments.trunk,
                                    impedance20kHzResults.segments.rightFoot,
                                    impedance20kHzResults.segments.leftFoot,
                                    // 100 kHz impedance values
                                    impedance100kHzResults.segments.rightHand,
                                    impedance100kHzResults.segments.leftHand,
                                    impedance100kHzResults.segments.trunk,
                                    impedance100kHzResults.segments.rightFoot,
                                    impedance100kHzResults.segments.leftFoot
                                )

                                console.log("\nBody Composition Command Details:")
                                console.log(`Gender: ${gender === "1" ? "Male" : "Female"}`)
                                console.log(`Height: ${height} cm`)
                                console.log(`Age: ${age} years`)
                                console.log(`Weight: ${weight} kg`)

                                await sendBiaCommand(cmd, true)
                            } catch (error) {
                                console.error(
                                    "Failed to create body composition command:",
                                    error.message
                                )
                                showMenu()
                            }
                        })
                    })
                } catch (error) {
                    console.error("Failed:", error.message)
                    showMenu()
                }
                break
            case "12":
                await case40_PhaseAngleDetailedQuery()
                break
            case "20":
                await case40a_LegImpedance50kHz()
                break
            case "21":
                await case40b_ArmImpedance50kHz()
                break
            case "13": // Custom command
                rl.question("Enter hex command (e.g., 55 05 A1 00 05): ", async (cmd) => {
                    try {
                        // Parse the hex string input into an array of bytes
                        const hexArray = cmd
                            .trim()
                            .split(/\s+/)
                            .map((byte) => {
                                const parsed = parseInt(byte, 16)
                                if (isNaN(parsed) || parsed < 0 || parsed > 255) {
                                    throw new Error(`Invalid hex value: ${byte}`)
                                }
                                return parsed
                            })

                        if (hexArray.length === 0) {
                            throw new Error("No command bytes provided")
                        }

                        // Convert array to Buffer and send
                        const commandBuffer = Buffer.from(hexArray)

                        await sendBiaCommand(commandBuffer, {
                            waitForResponse: true,
                            timeout: 10000,
                            verbose: true,
                            responseHandler: (data) => {
                                console.log(`\n${"=".repeat(60)}`)
                                console.log(` RECEIVED BIA RESPONSE`)
                                console.log(`${"=".repeat(60)}`)
                                console.log(` Hex: ${data.toString("hex").toUpperCase()}`)
                                console.log(` Length: ${data.length} bytes`)
                                console.log(` Raw: [${Array.from(data).join(", ")}]`)
                                console.log(`${"=".repeat(60)}\n`)
                            }
                        })

                        showMenu()
                    } catch (error) {
                        console.error(" Failed to send command:", error.message)
                        console.error(
                            " Please enter hex values separated by spaces (e.g., 55 05 A1 00 05)"
                        )
                        showMenu()
                    }
                })
                break

            case "14": // Single-Point Weight Calibration - NO LOOP
                ;(async () => {
                    try {
                        console.log("\n" + "=".repeat(70))
                        console.log("⚖️  SINGLE-POINT WEIGHT CALIBRATION")
                        console.log("=".repeat(70))
                        console.log("\nCalibrate ONE point at a time.\n")
                        console.log("Options:")
                        console.log("  1. Calibrate 0 kg (Empty Scale)")
                        console.log("  2. Calibrate 50 kg (Known Weight)")
                        console.log("  3. Calibrate 100 kg (Known Weight)")
                        console.log("  0. Cancel\n")

                        // ================================================================
                        // HELPER FUNCTION: Ask question
                        // ================================================================

                        const askQuestion = (prompt) => {
                            return new Promise((resolve) => {
                                process.stdout.write(prompt)

                                const lineHandler = (answer) => {
                                    rl.removeListener("line", lineHandler)
                                    resolve(answer)
                                }

                                rl.on("line", lineHandler)
                            })
                        }

                        // ================================================================
                        // GET USER SELECTION
                        // ================================================================

                        const selection = await askQuestion(
                            "Select calibration point (1-3 or 0 to cancel): "
                        )

                        let calibrationWeight = null
                        let calibrationInstruction = null
                        let pointName = null

                        if (selection === "1") {
                            calibrationWeight = 0
                            calibrationInstruction = "🔴 Remove ALL weight from the scale"
                            pointName = "POINT 0 (0 kg - Empty Scale)"
                        } else if (selection === "2") {
                            calibrationWeight = 50
                            calibrationInstruction = "🟡 Place 50 kg calibration weight on scale"
                            pointName = "POINT 1 (50 kg - Known Weight)"
                        } else if (selection === "3") {
                            calibrationWeight = 100
                            calibrationInstruction = "🟢 Place 100 kg calibration weight on scale"
                            pointName = "POINT 2 (100 kg - Known Weight)"
                        } else if (selection === "0") {
                            console.log("\n❌ Calibration cancelled\n")
                            showMenu()
                            return
                        } else {
                            console.log("\n❌ Invalid option\n")
                            showMenu()
                            return
                        }

                        // ================================================================
                        // SINGLE CALIBRATION POINT
                        // ================================================================

                        console.log(`\n${"=".repeat(70)}`)
                        console.log(`📍 CALIBRATION: ${pointName}`)
                        console.log(`   Expected Weight: ${calibrationWeight} kg`)
                        console.log(`${"=".repeat(70)}\n`)

                        // ================================================================
                        // PHASE 1: USER PREPARATION
                        // ================================================================

                        console.log(`${calibrationInstruction}\n`)
                        console.log("Make sure the scale is stable before proceeding.\n")

                        const userReady = await askQuestion(
                            '✓ Press ENTER when ready (or type "cancel"): '
                        )

                        if (userReady.toLowerCase() === "cancel") {
                            console.log("\n❌ Calibration cancelled by user\n")
                            showMenu()
                            return
                        }

                        console.log(`\n🔄 Starting calibration for ${calibrationWeight} kg...\n`)

                        // ================================================================
                        // PHASE 2: ENTER CALIBRATION MODE
                        // ================================================================

                        console.log("📡 Step 1: Entering calibration mode...")

                        try {
                            await sendBiaCommand([0x55, 0x06, 0xb0, 0x00, 0x00, 0xf5])
                            await new Promise((resolve) => setTimeout(resolve, 500))
                        } catch (error) {
                            console.log("⚠️ Warning: Could not stop current test")
                        }
                        try {
                            const modeResponse = await sendBiaCommand(
                                [0x55, 0x05, 0xa0, 0x03, 0x03],
                                {
                                    waitForResponse: true,
                                    timeout: 5000,
                                    verbose: false
                                }
                            )
                            console.log("   ✅ Calibration mode activated\n")
                        } catch (error) {
                            console.log("   ⚠️  Calibration mode timeout (continuing anyway)...\n")
                        }

                        await new Promise((resolve) => setTimeout(resolve, 1500))

                        // ================================================================
                        // PHASE 2b: SET WEIGHT MEASUREMENT MODE
                        // ================================================================

                        console.log("📡 Step 1b: Setting weight measurement mode...")
                        try {
                            const weightModeResponse = await sendBiaCommand(
                                [0x55, 0x05, 0xa0, 0x01, 0x05],
                                {
                                    waitForResponse: true,
                                    timeout: 3000,
                                    verbose: false
                                }
                            )
                            console.log("   ✅ Weight measurement mode activated\n")
                        } catch (error) {
                            console.log("   ⚠️  Weight mode timeout (continuing anyway)...\n")
                        }

                        await new Promise((resolve) => setTimeout(resolve, 800))

                        // ================================================================
                        // PHASE 3: COLLECT READINGS - NO LOOP, JUST COLLECT
                        // ================================================================

                        console.log("📡 Step 2: Collecting weight readings...\n")

                        const readings = []
                        let successfulReadings = 0
                        const maxAttempts = 10
                        const stabilityThreshold = 1.0
                        let stableAchieved = false

                        for (let attempt = 0; attempt < maxAttempts; attempt++) {
                            try {
                                const response = await sendBiaCommand(
                                    [0x55, 0x05, 0xa1, 0x00, 0x05],
                                    {
                                        waitForResponse: true,
                                        timeout: 3000,
                                        verbose: false
                                    }
                                )

                                if (response && response.length >= 14) {
                                    if (response[0] === 0xaa && response[2] === 0xa1) {
                                        // Extract weight from bytes 5-6
                                        const lowByte = response[5]
                                        const highByte = response[6]
                                        const rawValue = (highByte << 8) | lowByte
                                        const weightKg = rawValue / 10.0

                                        readings.push(weightKg)
                                        successfulReadings++

                                        console.log(
                                            `   Reading ${successfulReadings}/${maxAttempts}: ${weightKg.toFixed(2)} kg`
                                        )
                                        console.log(
                                            `      (raw bytes: 0x${lowByte.toString(16).padStart(2, "0").toUpperCase()} 0x${highByte.toString(16).padStart(2, "0").toUpperCase()} = ${rawValue})`
                                        )

                                        // ================================================================
                                        // CHECK FOR STABILITY
                                        // ================================================================

                                        if (readings.length >= 3) {
                                            const lastThree = readings.slice(-3)
                                            const maxReading = Math.max(...lastThree)
                                            const minReading = Math.min(...lastThree)
                                            const variation = maxReading - minReading

                                            console.log(
                                                `      (variation: ${variation.toFixed(2)} kg)`
                                            )

                                            if (variation < stabilityThreshold) {
                                                console.log(
                                                    `   ✅ Readings are stable! (variation < ${stabilityThreshold} kg)\n`
                                                )
                                                stableAchieved = true
                                                break
                                            }
                                        }

                                        // ================================================================
                                        // DEBUG: Show if reading is 0
                                        // ================================================================

                                        if (weightKg === 0 && attempt < 2) {
                                            console.log(
                                                `   ⚠️  DEBUG: Weight is 0, checking response...\n`
                                            )
                                            console.log(
                                                `      Full response hex: ${response.toString("hex").toUpperCase()}`
                                            )
                                            console.log(
                                                `      Byte 0 (header): 0x${response[0].toString(16).toUpperCase()}`
                                            )
                                            console.log(
                                                `      Byte 2 (type): 0x${response[2].toString(16).toUpperCase()}`
                                            )
                                            console.log(
                                                `      Byte 3 (status): 0x${response[3].toString(16).toUpperCase()}`
                                            )
                                            console.log(
                                                `      Byte 5 (low): 0x${response[5].toString(16).padStart(2, "0").toUpperCase()}`
                                            )
                                            console.log(
                                                `      Byte 6 (high): 0x${response[6].toString(16).padStart(2, "0").toUpperCase()}\n`
                                            )
                                        }
                                    } else {
                                        console.log(
                                            `   ⚠️  Reading ${attempt + 1}: Invalid response header`
                                        )
                                        console.log(
                                            `      Expected: 0xAA...0xA1, Got: 0x${response[0].toString(16).toUpperCase()}...0x${response[2].toString(16).toUpperCase()}`
                                        )
                                    }
                                } else {
                                    console.log(
                                        `   ⚠️  Reading ${attempt + 1}: Response too short (${response ? response.length : 0} bytes)`
                                    )
                                }
                            } catch (error) {
                                console.log(`   ⚠️  Reading ${attempt + 1}: Timeout`)
                            }

                            if (attempt < maxAttempts - 1) {
                                await new Promise((resolve) => setTimeout(resolve, 300))
                            }
                        }

                        // ================================================================
                        // PHASE 4: PROCESS RESULTS
                        // ================================================================

                        console.log(`\n${"=".repeat(70)}`)
                        console.log("📋 CALIBRATION RESULTS")
                        console.log(`${"=".repeat(70)}\n`)

                        if (readings.length > 0) {
                            const averageWeight =
                                readings.reduce((a, b) => a + b, 0) / readings.length
                            const minWeight = Math.min(...readings)
                            const maxWeight = Math.max(...readings)
                            const variation = maxWeight - minWeight

                            console.log(`Point: ${pointName}`)
                            console.log(`Expected: ${calibrationWeight} kg`)
                            console.log(`Average: ${averageWeight.toFixed(2)} kg`)
                            console.log(`Min: ${minWeight.toFixed(2)} kg`)
                            console.log(`Max: ${maxWeight.toFixed(2)} kg`)
                            console.log(`Variation: ${variation.toFixed(2)} kg`)
                            console.log(`Total Readings: ${readings.length}\n`)

                            if (stableAchieved) {
                                console.log("✅ STABLE READINGS ACHIEVED\n")
                            }

                            // ================================================================
                            // VALIDATION WARNING
                            // ================================================================

                            if (averageWeight === 0 && calibrationWeight > 0) {
                                console.log(
                                    `\n⚠️  WARNING: Got 0 kg readings for expected ${calibrationWeight} kg\n`
                                )
                                console.log(`Possible causes:`)
                                console.log(`  1. Scale not in proper weight measurement mode`)
                                console.log(`  2. Weight data not in bytes 5-6 of response`)
                                console.log(`  3. Incorrect weight was placed on scale`)
                                console.log(`  4. Scale calibration issue\n`)
                                console.log(
                                    `Check the debug hex dump above to find correct byte positions.\n`
                                )
                            } else if (Math.abs(averageWeight - calibrationWeight) > 10) {
                                console.log(
                                    `\n⚠️  WARNING: Measured weight differs from expected by more than 10 kg\n`
                                )
                                console.log(`  Expected: ${calibrationWeight} kg`)
                                console.log(`  Measured: ${averageWeight.toFixed(2)} kg`)
                                console.log(
                                    `  Difference: ${Math.abs(averageWeight - calibrationWeight).toFixed(2)} kg\n`
                                )
                                console.log(
                                    `Please verify the correct weight was placed on the scale.\n`
                                )
                            } else {
                                console.log(`✅ READINGS LOOK GOOD\n`)
                            }

                            // ================================================================
                            // SAVE RESULTS
                            // ================================================================

                            const calibrationData = {
                                timestamp: new Date().toISOString(),
                                calibrationPoint: calibrationWeight,
                                expectedWeight: calibrationWeight,
                                averageReading: averageWeight,
                                minReading: minWeight,
                                maxReading: maxWeight,
                                variation: variation,
                                totalReadings: readings.length,
                                readings: readings,
                                stable: stableAchieved
                            }

                            const filename = `calibration-point-${calibrationWeight}kg-${Date.now()}.json`
                            fs.writeFileSync(filename, JSON.stringify(calibrationData, null, 2))
                            console.log(`✅ Results saved to: ${filename}\n`)
                        } else {
                            console.log("❌ NO READINGS COLLECTED\n")
                        }

                        // ================================================================
                        // NEXT STEPS
                        // ================================================================

                        console.log("═" + "═".repeat(68))
                        console.log("📋 NEXT STEPS")
                        console.log("═" + "═".repeat(68) + "\n")

                        console.log("To complete calibration, run Case 14 again and select:")
                        console.log("  1. Other calibration points (0, 50, or 100 kg)")
                        console.log("  2. Repeat this point if readings are 0 kg\n")

                        console.log("After all 3 points (0, 50, 100 kg), you can calculate:")
                        console.log("  - Zero offset")
                        console.log("  - Calibration factor")
                        console.log("  - Accuracy\n")

                        console.log("═" + "═".repeat(68) + "\n")

                        showMenu()
                    } catch (error) {
                        console.error("\n❌ Calibration Error:", error.message)
                        console.log("=".repeat(70) + "\n")
                        showMenu()
                    }
                })()
                break

            case "16": // Calibration Status Check
                console.log("\n" + "=".repeat(60))
                console.log(" CALIBRATION STATUS CHECK")
                console.log("=".repeat(60) + "\n")

                rl.question("Place scale on flat surface and press Enter: ", async () => {
                    try {
                        await sendBiaCommand([0x55, 0x05, 0xa1, 0x00, 0x05], {
                            waitForResponse: true,
                            timeout: 5000,
                            verbose: true,
                            responseHandler: (data) => {
                                if (data.length >= 14) {
                                    const weightStatus = (data[3] >> 4) & 0x0f
                                    const calibStatus = data[3] & 0x0f
                                    const stableWeightRaw = data.readInt16LE(5)
                                    const realtimeWeightRaw = data.readInt16LE(7)
                                    const adcValue = data.readInt32LE(9)

                                    console.log("\n" + "=".repeat(60))
                                    console.log(" DETAILED CALIBRATION STATUS")
                                    console.log("=".repeat(60))
                                    console.log(
                                        ` Weight Status (High nibble): 0x${weightStatus.toString(16).toUpperCase()}`
                                    )
                                    console.log(
                                        ` Calibration Status (Low nibble): 0x${calibStatus.toString(16).toUpperCase()}`
                                    )
                                    console.log(
                                        ` Stable Weight: ${(stableWeightRaw / 10).toFixed(1)} kg`
                                    )
                                    console.log(
                                        ` Real-time Weight: ${(realtimeWeightRaw / 10).toFixed(1)} kg`
                                    )
                                    console.log(` ADC Value: ${adcValue} (for debugging)`)

                                    const calibStatusMap = {
                                        0: "🔄 Calibrating zero point",
                                        1: "🔄 Calibrating point 1 (50kg)",
                                        2: "🔄 Calibrating point 2 (100kg)",
                                        3: "🔄 Calibrating point 3",
                                        4: "🔍 Calibration judgment",
                                        5: "✅ Calibration successful",
                                        6: "❌ Calibration failed"
                                    }

                                    console.log(
                                        ` Status: ${calibStatusMap[calibStatus] || "Unknown"}`
                                    )
                                    console.log("=".repeat(60) + "\n")
                                }
                            }
                        })

                        showMenu()
                    } catch (error) {
                        console.error("❌ Error:", error.message)
                        showMenu()
                    }
                })
                break

            case "15":
                ;(async () => {
                    try {
                        // ================================================================
                        // PORT CHECK
                        // ================================================================

                        if (!biaPort || !biaPort.isOpen) {
                            handleWeightStatus(0x09) // PORT_ERROR
                            console.log("❌ BIA port not connected")
                            showMenu()
                            return
                        }

                        console.log("\n" + "=".repeat(70))
                        console.log(" WEIGHT SCALE TARE (ZERO)")
                        console.log("=".repeat(70))
                        console.log("\nThis will zero the scale to remove any offset.\n")

                        // ================================================================
                        // USER CONFIRMATION
                        // ================================================================

                        console.log("IMPORTANT:")
                        console.log("  1. Remove ALL weight from the scale")
                        console.log("  2. Ensure scale is on level surface")
                        console.log("  3. Scale must be empty\n")

                        await new Promise((resolve) => {
                            rl.question(
                                '✓ Press ENTER to proceed with TARE (or type "cancel"): ',
                                (answer) => {
                                    if (answer.toLowerCase() === "cancel") {
                                        console.log("\n  TARE cancelled\n")
                                        resolve("cancel")
                                    } else {
                                        resolve("proceed")
                                    }
                                }
                            )
                        }).then(async (result) => {
                            if (result === "cancel") {
                                showMenu()
                                return
                            }

                            // ============================================================
                            // EXECUTE TARE SEQUENCE
                            // ============================================================

                            try {
                                console.log("\n Executing TARE command...\n")

                                // ════════════════════════════════════════════════════════
                                // STEP 1: STOP CURRENT MEASUREMENT
                                // ════════════════════════════════════════════════════════

                                try {
                                    console.log("Step 1: Stopping current measurement...")
                                    await sendBiaCommand([0x55, 0x06, 0xb0, 0x00, 0x00, 0xf5], {
                                        waitForResponse: false,
                                        timeout: 2000
                                    })
                                    await new Promise((r) => setTimeout(r, 500))
                                    console.log(" Measurement stopped\n")
                                } catch (error) {
                                    console.log(" Note: Could not stop measurement\n")
                                }

                                // ════════════════════════════════════════════════════════
                                // STEP 2: SEND TARE COMMAND
                                // ════════════════════════════════════════════════════════

                                console.log("Step 2: Sending TARE command to scale...")
                                const tareCommand = [0x55, 0x05, 0xa0, 0x04, 0x01]

                                try {
                                    const tareResponse = await sendBiaCommand(tareCommand, {
                                        waitForResponse: true,
                                        timeout: 3000,
                                        verbose: false
                                    })

                                    console.log("TARE command sent successfully\n")

                                    // Show response info
                                    if (tareResponse && tareResponse.length >= 5) {
                                        console.log(
                                            `Response: [${Array.from(tareResponse)
                                                .map((b) => "0x" + b.toString(16).toUpperCase())
                                                .join(", ")}]`
                                        )
                                    }
                                } catch (error) {
                                    console.error(` TARE command failed: ${error.message}`)
                                    console.log("\n Scale may not have responded")
                                    console.log("Continuing verification...\n")
                                }

                                // Wait for scale to process
                                await new Promise((r) => setTimeout(r, 1000))

                                // ════════════════════════════════════════════════════════
                                // STEP 3: SET NORMAL WEIGHT MODE
                                // ════════════════════════════════════════════════════════

                                console.log("Step 3: Setting scale to normal mode...")
                                try {
                                    await sendBiaCommand([0x55, 0x05, 0xa0, 0x01, 0x05], {
                                        waitForResponse: true,
                                        timeout: 2000,
                                        verbose: false
                                    })
                                    console.log("Normal mode set\n")
                                } catch (error) {
                                    console.log("⚠️  Could not set normal mode\n")
                                }

                                await new Promise((r) => setTimeout(r, 500))

                                // ════════════════════════════════════════════════════════
                                // STEP 4: VERIFY TARE WITH READING
                                // ════════════════════════════════════════════════════════

                                console.log("Step 4: Verifying TARE by reading weight...\n")

                                const verifyResults = {
                                    readings: [],
                                    attempts: 0,
                                    maxAttempts: 5
                                }

                                while (verifyResults.attempts < verifyResults.maxAttempts) {
                                    try {
                                        verifyResults.attempts++

                                        const verifyResponse = await sendBiaCommand(
                                            [0x55, 0x05, 0xa1, 0x00, 0x05],
                                            {
                                                waitForResponse: true,
                                                timeout: 3000,
                                                verbose: false
                                            }
                                        )

                                        if (verifyResponse && verifyResponse.length >= 14) {
                                            const rawWeight =
                                                ((verifyResponse[6] << 8) | verifyResponse[5]) /
                                                10.0
                                            const WEIGHT_ZERO_OFFSET = 0.0
                                            const CALIBRATION_FACTOR = 1.0
                                            const weight =
                                                (rawWeight - WEIGHT_ZERO_OFFSET) *
                                                CALIBRATION_FACTOR

                                            verifyResults.readings.push(weight)

                                            console.log(
                                                `   Reading ${verifyResults.attempts}: ${weight.toFixed(2)} kg`
                                            )

                                            // Check if zeroed
                                            if (Math.abs(weight) < 0.5) {
                                                // Within 0.5 kg of zero
                                                console.log(`  Scale zeroed successfully!\n`)
                                                break
                                            }
                                        }

                                        await new Promise((r) => setTimeout(r, 300))
                                    } catch (error) {
                                        console.log(
                                            `   Reading ${verifyResults.attempts}: No response`
                                        )
                                        await new Promise((r) => setTimeout(r, 500))
                                    }
                                }

                                // ════════════════════════════════════════════════════════
                                // STEP 5: DISPLAY RESULTS
                                // ════════════════════════════════════════════════════════

                                console.log("\n" + "=".repeat(70))
                                console.log(" TARE VERIFICATION RESULTS")
                                console.log("=".repeat(70))

                                if (verifyResults.readings.length > 0) {
                                    const avgWeight =
                                        verifyResults.readings.reduce((a, b) => a + b, 0) /
                                        verifyResults.readings.length
                                    const minWeight = Math.min(...verifyResults.readings)
                                    const maxWeight = Math.max(...verifyResults.readings)

                                    console.log(
                                        `\nReadings collected: ${verifyResults.readings.length}`
                                    )
                                    console.log(`Average weight: ${avgWeight.toFixed(2)} kg`)
                                    console.log(
                                        `Range: ${minWeight.toFixed(2)} - ${maxWeight.toFixed(2)} kg`
                                    )

                                    if (Math.abs(avgWeight) < 0.5) {
                                        console.log("\nTARE SUCCESSFUL!")
                                        console.log("   Scale is now zeroed.")
                                        console.log("   Ready for weight measurement.")
                                        handleWeightStatus(0x03, avgWeight) // Show success
                                    } else {
                                        console.log("\n TARE MAY NOT BE COMPLETE")
                                        console.log(
                                            `   Scale still reading: ${avgWeight.toFixed(2)} kg`
                                        )
                                        console.log("   Possible causes:")
                                        console.log("   1. Weight still on scale")
                                        console.log("   2. Scale hardware issue")
                                        console.log("   3. Scale needs recalibration")
                                        console.log("\nTry again or check scale.")
                                    }
                                } else {
                                    console.log("\n Could not verify TARE")
                                    console.log("Scale did not respond to weight query.")
                                }

                                console.log("=".repeat(70) + "\n")

                                showMenu()
                            } catch (error) {
                                console.error(" TARE sequence failed:", error.message)
                                showMenu()
                            }
                        })
                    } catch (error) {
                        console.error(" TARE error:", error.message)
                        showMenu()
                    }
                })()
                break

            case "0":
                console.log("\n Shutting down...")
                if (heightPort && heightPort.isOpen) {
                    await new Promise((resolve) => heightPort.close(resolve))
                }
                if (biaPort && biaPort.isOpen) {
                    await new Promise((resolve) => biaPort.close(resolve))
                }
                rl.close()
                process.exit(0)
                break

            default:
                console.log(" Invalid option")
                showMenu()
        }
    } catch (error) {
        console.error("Error:", error.message)
        showMenu()
    }
}

// Main startup
showMenu()

// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("\n Shutting down...")
    errorStats.print()
    if (heightPort && heightPort.isOpen) {
        await new Promise((resolve) => heightPort.close(resolve))
    }
    if (biaPort && biaPort.isOpen) {
        await new Promise((resolve) => biaPort.close(resolve))
    }
    process.exit(0)
})