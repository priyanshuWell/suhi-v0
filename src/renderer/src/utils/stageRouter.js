/**
 * stageRouter.js
 *
 * Centralized mapping from backend `stage_key` values (returned in
 * `screening.next_stage.stage_key`) to frontend React Router paths.
 *
 * Backend stage_key values (as of 2026-06):
 *   bia              → BIA measurement start
 *   divide_attention → Divide Attention game (intro)
 *   voice_analysis   → Voice Analysis
 *   congitive        → Color Blindness test  (note: backend typo, kept as-is)
 *   result           → Final result screen
 */

export const STAGE_ROUTE_MAP = {
  bia: '/bia/leg50',
  divide_attention: '/smoothie-slash',
  smoothie_slash: '/smoothie-slash',
  voice_analysis: '/voice',
  color_blindness: '/colorblindness',
  result: '/bia/result',
  login: '/welcome'
};

/**
 * Returns the frontend route for a given `next_stage` object or raw stage_key string.
 *
 * @param {object|string|null|undefined} nextStage
 *   Either the full `next_stage` object `{ stage_key, display_name, stage_order }`
 *   or just the `stage_key` string.
 * @param {string} [fallback='/bia/leg50']
 *   Route to use if `nextStage` is null/undefined or the key is not recognized.
 * @returns {string} A React Router path string.
 *
 * @example
 *   // From a Complete API response:
 *   const route = getNextRoute(apiData?.screening?.next_stage);
 *   navigate(route);
 *
 *   // From Redux store:
 *   const route = getNextRoute(screening?.nextStage);
 *   navigate(route);
 */
export function getNextRoute(nextStage, fallback = '/welcome') {
  const key = typeof nextStage === 'string'
    ? nextStage
    : nextStage?.stage_key;

  if (!key) {
    console.warn('[stageRouter] next_stage is null/undefined — using fallback route:', fallback);
    return fallback;
  }

  const route = STAGE_ROUTE_MAP[key];
  if (!route) {
    console.warn(`[stageRouter] Unknown stage_key "${key}" — using fallback route:`, fallback);
    return fallback;
  }

  console.log(`[stageRouter] stage_key="${key}" → "${route}"`);
  return route;
}
