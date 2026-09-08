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
    // ── Screening 1 stages ─────────────────────────────────────
    bia: "/bia/leg50",
    divide_attention: "/smoothie-slash",
    smoothie_slash: "/smoothie-slash",
    voice_analysis: "/voice",
    color_blindness: "/colorblindness",
    result: "/bia/result",
    login: "/welcome",

    // ── Screening 2 stages ─────────────────────────────────────
    // height_weight is the BMI Scan — reuses the existing BIACalculate flow
    height_weight: "/bia/leg50",
    perilous_path: "/",
    visual_acuity: "/visual-acuity",
    // beat_drop: TBD — will be added when the screen is implemented
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
export function getNextRoute(nextStage, fallback = "/welcome") {
    const key = typeof nextStage === "string" ? nextStage : nextStage?.stage_key

    if (!key) {
        console.warn("[stageRouter] next_stage is null/undefined — using fallback route:", fallback)
        return fallback
    }

    const route = STAGE_ROUTE_MAP[key]
    if (!route) {
        console.warn(`[stageRouter] Unknown stage_key "${key}" — using fallback route:`, fallback)
        return fallback
    }

    console.log(`[stageRouter] stage_key="${key}" → "${route}"`)
    return route
}

/**
 * Central decision helper — call this after every stage-complete API response.
 *
 * Returns the route to navigate to based on the updated screening object:
 *  - If `next_stage` is null AND `pending_stages` is empty → always go to the
 *    result page ("/bia/result"), regardless of screening_order. This covers:
 *      • Screening 1 fully done (is_pending_transition: true)
 *      • Screening 2 fully done
 *  - Otherwise → resolve the next stage via getNextRoute.
 *
 * @param {object} screening  The `screening` object from the API response
 *                            (snake_case, straight from the API — not the Redux shape).
 * @param {string} [fallback] Fallback route if next_stage is unrecognized.
 * @returns {string} React Router path to navigate to.
 *
 * @example
 *   const route = resolvePostStageRoute(apiResponse?.screening)
 *   navigate(route)
 */
export function resolvePostStageRoute(screening, fallback = "/bia/result") {
    const nextStage = screening?.next_stage ?? null
    const pendingStages = screening?.pending_stages ?? []

    if (nextStage === null && pendingStages.length === 0) {
        console.log("[stageRouter] No next_stage and no pending_stages — routing to result page")
        return "/bia/result"
    }

    return getNextRoute(nextStage, fallback)
}
