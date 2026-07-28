/**
 * bia/portRecovery.js  — Phase 3: Serial port auto-reconnect
 *
 * Provides a withPortRecovery() wrapper that adds exponential-backoff
 * reconnection logic to any port-open function.
 *
 * Usage inside connectBiaPort / connectHeightPort:
 *
 *   biaPort.on('error', (err) => {
 *     portRecovery.onPortError(err, 'BIA', () => connectBiaPort(portPath, baudRate))
 *   })
 *   biaPort.on('close', () => {
 *     portRecovery.onPortClose('BIA', () => connectBiaPort(portPath, baudRate))
 *   })
 */

import { eventBus, EVENTS } from '../eventbus'
import { logger } from '../logger'

const MOD = 'PortRecovery'

const MAX_RETRIES   = 5
const BASE_DELAY_MS = 1000   // first retry after 1 s
const MAX_DELAY_MS  = 30000  // cap at 30 s

/** Exponential backoff delay (capped). */
function backoffDelay(attempt) {
  const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS)
  // Add ±10% jitter to spread retries
  return delay + Math.random() * delay * 0.1
}

/**
 * Shared reconnect state per port name ('BIA' | 'HEIGHT').
 * Prevents overlapping retry loops if multiple error events fire quickly.
 */
const recovering = new Map()

/**
 * Called when a port emits 'error' or 'close' unexpectedly.
 *
 * @param {string}   portName   Display name for logging ('BIA' | 'HEIGHT')
 * @param {function} reconnect  Async function that opens the port again
 * @param {Error}    [err]      Original error (optional, for logging)
 */
export async function schedulePortRecovery(portName, reconnect, err = null) {
  if (recovering.get(portName)) {
    logger.debug(MOD, `${portName}: reconnect already in progress, skipping duplicate`)
    return
  }

  recovering.set(portName, true)

  if (err) {
    logger.error(MOD, `${portName} port error — starting reconnect loop`, err.message)
  } else {
    logger.warn(MOD, `${portName} port closed unexpectedly — starting reconnect loop`)
  }

  // Notify the UI that the port is recovering
  eventBus.emit(EVENTS.HARDWARE_ERROR ?? 'hardware:error', {
    source: portName,
    message: `${portName} port disconnected. Reconnecting…`,
    recovering: true,
  })

  let lastError = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const delay = backoffDelay(attempt)
    logger.info(MOD, `${portName}: reconnect attempt ${attempt}/${MAX_RETRIES} in ${Math.round(delay)}ms`)

    await new Promise((r) => setTimeout(r, delay))

    try {
      await reconnect()
      logger.info(MOD, `${portName}: reconnected successfully after ${attempt} attempt(s)`)

      eventBus.emit(EVENTS.HARDWARE_ERROR ?? 'hardware:error', {
        source: portName,
        message: `${portName} port reconnected`,
        recovering: false,
      })

      recovering.set(portName, false)
      return
    } catch (connectErr) {
      lastError = connectErr
      logger.warn(MOD, `${portName}: reconnect attempt ${attempt} failed`, connectErr.message)
    }
  }

  // All retries exhausted
  logger.error(MOD, `${portName}: all ${MAX_RETRIES} reconnect attempts failed`, lastError?.message)

  eventBus.emit(EVENTS.HARDWARE_ERROR ?? 'hardware:error', {
    source: portName,
    message: `${portName} port could not be reconnected after ${MAX_RETRIES} attempts. Please check the hardware.`,
    recovering: false,
    fatal: true,
  })

  recovering.set(portName, false)
}

/**
 * Call this in your port 'error' handler:
 *   biaPort.on('error', (err) => onPortError(err, 'BIA', reconnectFn))
 */
export function onPortError(err, portName, reconnectFn) {
  // Ignore benign resource-released errors that occur during intentional close
  if (err?.message?.includes('Port is not open')) return
  schedulePortRecovery(portName, reconnectFn, err)
}

/**
 * Call this in your port 'close' handler to trigger recovery on unexpected close:
 *   biaPort.on('close', () => onPortClose('BIA', reconnectFn, intentionalClose))
 */
export function onPortClose(portName, reconnectFn, intentional = false) {
  if (intentional) return
  schedulePortRecovery(portName, reconnectFn)
}
