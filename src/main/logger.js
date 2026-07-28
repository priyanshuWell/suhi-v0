/**
 * Structured logger for the Electron main process.
 *
 * Usage:
 *   import { logger } from './logger'
 *   logger.info('BIA', 'Port connected', { path: '/dev/ttyUSB0' })
 *   logger.warn('Weight', 'Underload detected', { value: 0.3 })
 *   logger.error('Height', 'Sensor timeout')
 *
 * Log level is controlled via the LOG_LEVEL environment variable:
 *   LOG_LEVEL=debug | info | warn | error
 * Defaults to 'warn' in production and 'debug' in development.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }

const activeLevel =
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === 'production' ? 'warn' : 'debug')

/**
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} module   Short module tag, e.g. 'BIA', 'Height', 'Weight'
 * @param {string} msg      Human-readable message
 * @param {*}      [data]   Optional structured data to log alongside
 */
function log(level, module, msg, data) {
  if ((LEVELS[level] ?? 0) < (LEVELS[activeLevel] ?? 0)) return

  const prefix = `[${level.toUpperCase()}][${module}]`

  if (level === 'error') {
    data !== undefined ? console.error(prefix, msg, data) : console.error(prefix, msg)
  } else if (level === 'warn') {
    data !== undefined ? console.warn(prefix, msg, data) : console.warn(prefix, msg)
  } else {
    data !== undefined ? console.log(prefix, msg, data) : console.log(prefix, msg)
  }
}

export const logger = {
  debug: (module, msg, data) => log('debug', module, msg, data),
  info:  (module, msg, data) => log('info',  module, msg, data),
  warn:  (module, msg, data) => log('warn',  module, msg, data),
  error: (module, msg, data) => log('error', module, msg, data),
}
