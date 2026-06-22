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
  divide_attention: '/space-convoy-main',
  voice_analysis: '/voice',
  color_blindness: '/colorblindness',
  result: '/bia/result',
  login: '/welcome'
};

/** Backend `buffer_type` values sent to /video/buffer-collection */
export const STAGE_BUFFER_TYPE = {
  bia: 'BIA',
  divide_attention: 'DIVIDE_ATTENTION',
  voice_analysis: 'VOICE_ANALYSIS',
  color_blindness: 'COLOR_BLINDNESS',
  result: 'RESULT',
  login: 'LOGIN',
};

/**
 * Longest-prefix-first mapping from pathname → stage_key.
 * Sub-routes (e.g. /colorblindness/quiz) share the parent stage key.
 */
const STAGE_ROUTE_PREFIXES = [
  { prefix: '/bia/result', stageKey: 'result' },
  { prefix: '/bia/', stageKey: 'bia', selfManaged: true },
  { prefix: '/space-convoy-complete', stageKey: 'divide_attention' },
  { prefix: '/divide-attention', stageKey: 'divide_attention' },
  { prefix: '/space-convoy-main', stageKey: 'divide_attention' },
  { prefix: '/colorblindness/quiz', stageKey: 'color_blindness' },
  { prefix: '/colorblindness', stageKey: 'color_blindness' },
  { prefix: '/voice', stageKey: 'voice_analysis' },
  { prefix: '/welcome', stageKey: 'login' },
].sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * @param {string} pathname
 * @returns {string|null} stage_key or null when not on a screening stage route
 */
export function getStageKeyFromPath(pathname) {
  for (const { prefix, stageKey } of STAGE_ROUTE_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix)) {
      return stageKey;
    }
  }
  return null;
}

/** Stages that manage their own recording lifecycle (e.g. BIA partial saves). */
export function isSelfManagedStage(stageKey) {
  const entry = STAGE_ROUTE_PREFIXES.find((r) => r.stageKey === stageKey);
  return Boolean(entry?.selfManaged);
}

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
