/**
 * bia/statusHandler.js
 *
 * ImprovedImpedanceStatusHandler extracted from bia-scriptv1.js.
 * Handles BMH05108 impedance status codes with comprehensive error info.
 */

import { IMPEDANCE_ERROR_CODES } from './constants.js'
import { logger } from '../logger.js'

const MOD = 'StatusHandler'

export class ImprovedImpedanceStatusHandler {
  /**
   * Handle impedance status code with comprehensive error information.
   */
  static handleImpedanceStatus(statusCode, attemptNumber = 1) {
    try {
      if (!IMPEDANCE_ERROR_CODES[statusCode]) {
        return this.handleUnknownStatus(statusCode)
      }

      const errorInfo = IMPEDANCE_ERROR_CODES[statusCode]
      this.displayErrorInfo(errorInfo, attemptNumber)

      return {
        code: statusCode,
        ...errorInfo,
        decision: this.makeDecision(errorInfo, attemptNumber),
      }
    } catch (error) {
      logger.error(MOD, 'Error handling impedance status', error.message)
      return { code: statusCode, error: error.message, action: 'ERROR' }
    }
  }

  /** Display formatted error information to the logger. */
  static displayErrorInfo(errorInfo, attemptNumber) {
    logger.debug(MOD, `=== ${errorInfo.message} ===`)
    if (attemptNumber > 1) logger.debug(MOD, `Attempt: ${attemptNumber}`)
    logger.debug(MOD, errorInfo.description)

    if (
      (errorInfo.severity === 'CRITICAL' || errorInfo.severity === 'ERROR') &&
      errorInfo.solutions?.length
    ) {
      logger.debug(MOD, 'Solutions: ' + errorInfo.solutions.join(' | '))
    }
  }

  /** Handle unknown status code. */
  static handleUnknownStatus(statusCode) {
    logger.warn(MOD, `Unknown impedance status: 0x${statusCode.toString(16).toUpperCase()}`)
    return {
      code: statusCode,
      severity: 'ERROR',
      message: `Unknown impedance status: 0x${statusCode.toString(16).toUpperCase()}`,
      action: 'ERROR',
      canRetry: false,
      decision: { shouldRetry: false, shouldAbort: true, isCritical: true },
    }
  }

  /** Make decision object based on error info. */
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
      attemptNumber,
    }
  }

  /** Handle retry logic with built-in wait. */
  static async handleRetry(statusCode, currentAttempt, maxAttempts) {
    const errorInfo = IMPEDANCE_ERROR_CODES[statusCode]
    if (!errorInfo?.canRetry) return { shouldRetry: false, reason: 'Retry not allowed' }
    if (currentAttempt >= maxAttempts) return { shouldRetry: false, reason: 'Max attempts reached' }

    const waitTime = errorInfo.waitBeforeRetry || 2000
    logger.debug(MOD, `Retrying in ${waitTime}ms (attempt ${currentAttempt + 1}/${maxAttempts})`)
    await new Promise((resolve) => setTimeout(resolve, waitTime))

    return { shouldRetry: true, nextAttempt: currentAttempt + 1, waitTime }
  }

  /** Display error count statistics (used by case40 combined query). */
  static displayErrorStatistics(errorCounts) {
    let totalErrors = 0
    const lines = []
    Object.keys(errorCounts)
      .sort()
      .forEach((code) => {
        const count = errorCounts[code]
        if (count > 0) {
          const errorInfo = IMPEDANCE_ERROR_CODES[code]
          const msg = errorInfo ? errorInfo.code : `Unknown (0x${code})`
          lines.push(`0x${code}: ${msg.padEnd(20)} - ${count} occurrence(s)`)
          totalErrors += count
        }
      })
    logger.info(MOD, `Error Statistics — Total: ${totalErrors}\n` + lines.join('\n'))
  }
}
