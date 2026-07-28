/**
 * bia/impedanceLoop.js
 *
 * Generic impedance measurement loop shared by all 4 case functions
 * (case38_20kHz, case39_100kHz, case40a_LegImpedance50kHz, case40b_ArmImpedance50kHz).
 *
 * Eliminates ~600 lines of copy-pasted code across those functions.
 */

import { ImprovedImpedanceStatusHandler } from './statusHandler.js'
import { logger } from '../logger.js'

const MOD = 'ImpedanceLoop'

/**
 * Stability check: last `windowSize` meaningful responses must have
 * both phase-angle variation < maxPhaseAngleVariation and
 * impedance variation < maxImpedanceVariation.
 */
function isStableResponse(
  responses,
  windowSize = 5,
  maxPhaseAngleVariation = 1.0,
  maxImpedanceVariation = 10.0
) {
  if (responses.length < windowSize) return false
  const last = responses.slice(-windowSize)
  const angles = last.map((r) => r.phaseAngle.value)
  const imps   = last.map((r) => r.impedance.value)
  return (
    Math.max(...angles) - Math.min(...angles) < maxPhaseAngleVariation &&
    Math.max(...imps)   - Math.min(...imps)   < maxImpedanceVariation
  )
}

/**
 * Run a single impedance measurement loop.
 *
 * @param {object}   opts
 * @param {number[]} opts.queryCommand       Raw bytes to send for each query
 * @param {function} opts.sendBiaCommand     The sendBiaCommand function (injected to avoid circular deps)
 * @param {function} opts.parseResponse      Function to parse a raw buffer → result object (or null)
 * @param {string}   opts.label              Human-readable label for logs, e.g. 'Leg 50kHz'
 * @param {number}  [opts.maxAttempts=15]    Maximum query attempts before giving up
 * @param {number}  [opts.queryTimeout=5000] Timeout for each sendBiaCommand call (ms)
 * @param {number}  [opts.delayMs=500]       Delay between attempts (ms)
 * @param {function}[opts.emitStatus]        Optional function to emit UI status events
 * @param {string}  [opts.emitFrequency]     Frequency string passed to emitStatus
 * @param {number}  [opts.stabilityWindow=5] Number of readings for stability check
 *
 * @returns {Promise<{success: boolean, measurement?: object, attempts: number, allReadings?: object[], error?: string, errorDetails?: object[]}>}
 */
export async function runImpedanceMeasurementLoop({
  queryCommand,
  sendBiaCommand,
  parseResponse,
  label = 'Impedance',
  maxAttempts = 15,
  queryTimeout = 5000,
  delayMs = 500,
  emitStatus = null,
  emitFrequency = '',
  stabilityWindow = 5,
}) {
  const results = {
    attempts: 0,
    meaningfulResponses: [],
    zeroResponses: [],
    errorResponses: [],
    statusCodes: {},
  }

  logger.debug(MOD, `Starting ${label} measurement loop (maxAttempts=${maxAttempts})`)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    results.attempts = attempt

    try {
      logger.debug(MOD, `${label} attempt ${attempt}`)

      const responseData = await sendBiaCommand(queryCommand, {
        timeout: queryTimeout,
        verbose: false,
      })

      // ── Validate response format ──────────────────────────────────
      if (!responseData || responseData.length < 13) {
        if (responseData) {
          logger.warn(MOD, `${label}: unexpected response length ${responseData.length}`)
          results.zeroResponses.push({ attempt, reason: 'Unexpected response length' })
        }
        await new Promise((r) => setTimeout(r, delayMs))
        continue
      }

      if (responseData[0] !== 0xaa || responseData[2] !== 0xb1) {
        logger.warn(MOD, `${label}: invalid response header`)
        results.zeroResponses.push({ attempt, reason: 'Invalid response format' })
        await new Promise((r) => setTimeout(r, delayMs))
        continue
      }

      // ── Extract and track status byte ─────────────────────────────
      const measurementStatus = responseData[4]
      results.statusCodes[measurementStatus] = (results.statusCodes[measurementStatus] ?? 0) + 1

      if (emitStatus) emitStatus(measurementStatus, { frequency: emitFrequency, attempt })

      // ── Dispatch on status via handler ────────────────────────────
      const statusResult = ImprovedImpedanceStatusHandler.handleImpedanceStatus(
        measurementStatus,
        attempt
      )

      if (statusResult.decision.shouldAccept) {
        const parsed = parseResponse(responseData)

        if (parsed && parsed.impedance.value > 0) {
          results.meaningfulResponses.push(parsed)
          logger.info(MOD, `${label}: reading ${results.meaningfulResponses.length} — phase ${parsed.phaseAngle.value.toFixed(1)}°, imp ${parsed.impedance.value}Ω`)

          if (isStableResponse(results.meaningfulResponses, stabilityWindow)) {
            logger.info(MOD, `${label}: stable after ${attempt} attempts`)
            break
          }
        } else {
          logger.warn(MOD, `${label}: status=SUCCESS but impedance=0`)
          results.zeroResponses.push({ attempt, reason: 'Status success but impedance is 0', statusCode: measurementStatus })
        }

      } else if (statusResult.decision.shouldWait) {
        logger.debug(MOD, `${label}: device measuring, waiting ${statusResult.waitTime || delayMs}ms`)
        results.zeroResponses.push({ attempt, reason: 'Device still measuring', statusCode: measurementStatus })
        await new Promise((r) => setTimeout(r, statusResult.waitTime || delayMs))
        continue

      } else if (statusResult.decision.shouldRetry) {
        logger.warn(MOD, `${label}: retryable error — ${statusResult.message}`)
        results.errorResponses.push({ attempt, error: statusResult.message, statusCode: measurementStatus, canRetry: statusResult.canRetry })

        if (!statusResult.decision.maxRetriesReached) {
          const retryResult = await ImprovedImpedanceStatusHandler.handleRetry(
            measurementStatus, attempt, maxAttempts
          )
          if (retryResult.shouldRetry) continue
        }

      } else if (statusResult.decision.isCritical) {
        logger.error(MOD, `${label}: CRITICAL — ${statusResult.message}`)
        results.errorResponses.push({ attempt, error: statusResult.message, statusCode: measurementStatus, isCritical: true })
        break

      } else if (statusResult.decision.shouldAbort) {
        logger.info(MOD, `${label}: abort — ${statusResult.message}`)
        results.zeroResponses.push({ attempt, reason: statusResult.message, statusCode: measurementStatus })
        break

      } else {
        logger.warn(MOD, `${label}: unhandled status 0x${measurementStatus.toString(16).toUpperCase()}`)
        results.zeroResponses.push({ attempt, reason: `Unknown status: 0x${measurementStatus.toString(16)}`, statusCode: measurementStatus })
      }

    } catch (queryError) {
      logger.error(MOD, `${label}: attempt ${attempt} threw`, queryError.message)
      results.errorResponses.push({ attempt, error: queryError.message, exception: true })
    }

    await new Promise((r) => setTimeout(r, delayMs))
  }

  // ── Summary ───────────────────────────────────────────────────────
  logger.info(MOD, `${label} done — ${results.meaningfulResponses.length} readings in ${results.attempts} attempts`)

  if (results.meaningfulResponses.length > 0) {
    const finalReading = results.meaningfulResponses[results.meaningfulResponses.length - 1]
    return {
      success: true,
      measurement: finalReading,
      attempts: results.attempts,
      allReadings: results.meaningfulResponses,
    }
  }

  return {
    success: false,
    error: 'No successful readings',
    attempts: results.attempts,
    errorDetails: results.errorResponses,
  }
}
