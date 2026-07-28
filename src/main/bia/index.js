/**
 * bia/index.js  — Public API for the BIA hardware layer
 *
 * This barrel file re-exports the new modular sub-modules so callers
 * (index.js, tests, etc.) can import from a single location.
 *
 * The main bia-scriptv1.js still houses all the *implementation* code.
 * As Phase 2 progresses, those implementations will be migrated here and
 * bia-scriptv1.js will be replaced by this index.
 */

// ── New standalone modules ─────────────────────────────────────────
export * from './constants.js'
export { ImprovedImpedanceStatusHandler } from './statusHandler.js'
export { runImpedanceMeasurementLoop }    from './impedanceLoop.js'
