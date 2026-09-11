// perilousPathApi.js
//
// Frontend client for the Perilous Path backend (see the integration guide).
// Every gameplay decision — board generation, timing, tap validation,
// hazard/backtrack/motor-slip detection, scoring, and the 5 construct
// scores — lives on the server. This module's job is just to call the
// right endpoint with the right payload and hand back the right shape.
//
// DUMMY_FLAG: when true, every call below is served by an in-memory local
// simulator instead of hitting the network, so the whole game (all 6
// levels + final scoring) can be played end-to-end with no backend running.
// Flip it to false (or pass `dummyFlag: false` per-call) to hit the real API.
// The dummy simulator's scoring math is a rough local approximation for
// testing UI flow only — it is NOT the real scoring formula. Real points
// only ever come from the server when dummyFlag is false.

import { API_BASE_URL } from "../../../utils/config"

export const DUMMY_FLAG = false

const BASE_URL = "/perilous-path"

const GRID_ROWS = 4
const GRID_COLS = 4
const CENTER_TILES = [6, 7, 10, 11] // never start / destination / hazard
const ALL_TILES = Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => i + 1)
const EDGE_TILES = ALL_TILES.filter((t) => !CENTER_TILES.includes(t))

// ── Tile <-> row/col helpers (server is 1-indexed row-major, top-left = 1) ─
export function tileToRowCol(tileNumber) {
    const idx = tileNumber - 1
    return { row: Math.floor(idx / GRID_COLS), col: idx % GRID_COLS }
}

export function rowColToTile(row, col) {
    return row * GRID_COLS + col + 1
}

export function generateUuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
    // Fallback for environments without crypto.randomUUID
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === "x" ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}

export class ApiError extends Error {
    constructor(status, message, body = null) {
        super(message)
        this.name = "ApiError"
        this.status = status
        this.body = body
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Static level config — mirrors GET /levels. Used as the dummy simulator's
// source of truth. Only level 0 (demo) and level 1 shapes were shown in the
// integration doc's example; hazard_count/pause_delay_seconds for levels
// 2-5 below are MY PLACEHOLDER GUESSES (a gentle difficulty ramp) purely so
// local testing has something to loop through — when dummyFlag is false
// this whole object is unused and the real seeded values apply instead.
// ─────────────────────────────────────────────────────────────────────────
const LEVELS_CONFIG = [
    { level_id: 0, level_number: 0, level_code: "DEMO", level_name: "Demo", hazard_count: 1, probe_seconds: 5, pause_delay_seconds: 2, response_window_seconds: 20, is_practice: true, is_scored: false },
    { level_id: 1, level_number: 1, level_code: "L1", level_name: "Level 1", hazard_count: 2, probe_seconds: 5, pause_delay_seconds: 2, response_window_seconds: 20, is_practice: false, is_scored: true },
    { level_id: 2, level_number: 2, level_code: "L2", level_name: "Level 2", hazard_count: 3, probe_seconds: 5, pause_delay_seconds: 3, response_window_seconds: 20, is_practice: false, is_scored: true },
    { level_id: 3, level_number: 3, level_code: "L3", level_name: "Level 3", hazard_count: 4, probe_seconds: 5, pause_delay_seconds: 4, response_window_seconds: 20, is_practice: false, is_scored: true },
    { level_id: 4, level_number: 4, level_code: "L4", level_name: "Level 4", hazard_count: 5, probe_seconds: 4, pause_delay_seconds: 4, response_window_seconds: 20, is_practice: false, is_scored: true },
    { level_id: 5, level_number: 5, level_code: "L5", level_name: "Level 5", hazard_count: 6, probe_seconds: 4, pause_delay_seconds: 4, response_window_seconds: 20, is_practice: false, is_scored: true },
]
const TOTAL_SCORED_LEVELS = 5
const MAX_POINTS = 600
const POINTS_FOR_SAFE_CROSSING = 100
const POINTS_FOR_SHORTEST_ROUTE = 20

function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

function neighborsOf(tileNumber) {
    const { row, col } = tileToRowCol(tileNumber)
    const deltas = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
    ]
    return deltas
        .map(([dr, dc]) => [row + dr, col + dc])
        .filter(([r, c]) => r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS)
        .map(([r, c]) => rowColToTile(r, c))
}

/**
 * BFS shortest hop-count between two tiles, treating `blockedSet` tiles as
 * walls (destination itself is never treated as blocked, even if present).
 * Orthogonal moves only (no diagonals) — an assumption for the dummy
 * simulator's local efficiency/shortest-route approximation.
 */
function shortestHopCount(startTile, destTile, blockedSet) {
    if (startTile === destTile) return 0
    const visited = new Set([startTile])
    let frontier = [startTile]
    let hops = 0
    while (frontier.length) {
        hops += 1
        const next = []
        for (const t of frontier) {
            for (const n of neighborsOf(t)) {
                if (visited.has(n) || (blockedSet.has(n) && n !== destTile)) continue
                if (n === destTile) return hops
                visited.add(n)
                next.push(n)
            }
        }
        frontier = next
        if (hops > GRID_ROWS * GRID_COLS) break // safety net, shouldn't happen on an open 4x4
    }
    return null // unreachable — guarded against in generateBoard below
}

function generateBoard(levelConfig) {
    for (let attempt = 0; attempt < 25; attempt++) {
        const pool = shuffle(EDGE_TILES)
        const start = pool[0]
        const destination = pool[1]
        const hazards = pool.slice(2, 2 + levelConfig.hazard_count)
        const blocked = new Set(hazards)
        if (shortestHopCount(start, destination, blocked) != null) {
            return {
                start: { tile: start, ...tileToRowCol(start) },
                destination: { tile: destination, ...tileToRowCol(destination) },
                hazards: hazards.map((t) => ({ tile: t, ...tileToRowCol(t) })),
                hazard_tiles: hazards,
                hazard_count: hazards.length,
            }
        }
    }
    // Fallback: no hazards, guaranteed reachable.
    const [start, destination] = shuffle(EDGE_TILES)
    return {
        start: { tile: start, ...tileToRowCol(start) },
        destination: { tile: destination, ...tileToRowCol(destination) },
        hazards: [],
        hazard_tiles: [],
        hazard_count: 0,
    }
}

// ─────────────────────────────────────────────────────────────────────────
// In-memory dummy "backend" — one session per user_id, resolved with the
// same shapes the real API returns. Not persisted across a page reload.
// ─────────────────────────────────────────────────────────────────────────
const dummySessionsByUser = new Map()
const dummySessionsById = new Map()

function getOrCreateDummySession(userId, sessionId) {
    let session = dummySessionsByUser.get(userId)
    if (!session) {
        session = {
            game_session_id: generateUuid(),
            user_id: userId,
            session_id: sessionId ?? null,
            trials: [], // { trial_id, levelConfig, board, status, response_started_at, result }
            currentIndex: 0,
            total_points: 0,
            total_neuro_arcs: 0,
            current_streak: 0,
            best_streak: 0,
            status: "IN_PROGRESS",
            started_at: new Date().toISOString(),
            ended_at: null,
            final_result: null,
        }
        dummySessionsByUser.set(userId, session)
        dummySessionsById.set(session.game_session_id, session)
    }
    return session
}

function findDummyTrial(trialId) {
    for (const session of dummySessionsByUser.values()) {
        const trial = session.trials.find((t) => t.trial_id === trialId)
        if (trial) return { session, trial }
    }
    return { session: null, trial: null }
}

function buildNextGridResponse(session, trial, isReplay) {
    const { levelConfig, board } = trial
    const resolvedScored = session.trials.filter((t) => t.levelConfig.is_scored && t.status !== "SERVED").length
    return {
        game_session_id: session.game_session_id,
        trial_id: trial.trial_id,
        layout_id: trial.layout_id,
        is_replay: isReplay,
        level: {
            level_id: levelConfig.level_id,
            level_number: levelConfig.level_number,
            level_code: levelConfig.level_code,
            level_name: levelConfig.level_name,
            is_practice: levelConfig.is_practice,
            is_scored: levelConfig.is_scored,
        },
        timing: {
            probe_seconds: levelConfig.probe_seconds,
            pause_delay_seconds: levelConfig.pause_delay_seconds,
            response_window_seconds: levelConfig.response_window_seconds,
        },
        grid: { rows: GRID_ROWS, cols: GRID_COLS, total_tiles: GRID_ROWS * GRID_COLS },
        board,
        progress: {
            current_level_number: levelConfig.level_number,
            completed_scored_levels: resolvedScored,
            total_scored_levels: TOTAL_SCORED_LEVELS,
            is_demo: levelConfig.level_number === 0,
            total_points: session.total_points,
            total_neuro_arcs: session.total_neuro_arcs,
            max_points: MAX_POINTS,
        },
        scoring: {
            points_for_safe_crossing: POINTS_FOR_SAFE_CROSSING,
            points_for_shortest_route: POINTS_FOR_SHORTEST_ROUTE,
        },
    }
}

function dummyNextGrid({ user_id, session_id, kiosk_id }) {
    const session = getOrCreateDummySession(user_id, session_id)

    const pending = session.trials.find((t) => t.status === "SERVED")
    if (pending) return buildNextGridResponse(session, pending, true)

    if (session.currentIndex >= LEVELS_CONFIG.length) {
        throw new ApiError(409, "All levels resolved for this user/session.")
    }

    const levelConfig = LEVELS_CONFIG[session.currentIndex]
    const trial = {
        trial_id: generateUuid(),
        layout_id: Math.floor(100000 + Math.random() * 900000),
        levelConfig,
        board: generateBoard(levelConfig),
        status: "SERVED",
        response_started_at: null,
        result: null,
    }
    session.trials.push(trial)
    return buildNextGridResponse(session, trial, false)
}

function areAdjacent(tileA, tileB) {
    const a = tileToRowCol(tileA)
    const b = tileToRowCol(tileB)

    const rowDiff = Math.abs(a.row - b.row)
    const colDiff = Math.abs(a.col - b.col)

    // Only up / down / left / right.
    // Diagonal movement is not allowed.
    return rowDiff + colDiff === 1
}

function isContinuousRoute(startTile, taps) {
    let previousTile = startTile

    for (const tap of taps) {
        if (!areAdjacent(previousTile, tap.tile_number)) {
            return false
        }

        previousTile = tap.tile_number
    }

    return true
}

function scoreTrial(trial, { response_started_at, taps, forcedFail }) {
    const { board, levelConfig } = trial

    const hazardSet = new Set(board.hazard_tiles)
    const startedAtMs = response_started_at
        ? new Date(response_started_at).getTime()
        : null

    const visited = new Set()

    let prevTapMs = startedAtMs

    const mappedTaps = taps.map((tap, i) => {
        const { row, col } = tileToRowCol(tap.tile_number)

        const tapMs = new Date(tap.tapped_at).getTime()

        const latency_ms =
            prevTapMs != null && !Number.isNaN(tapMs)
                ? Math.max(0, tapMs - prevTapMs)
                : null

        prevTapMs = tapMs

        const hazard_hit = hazardSet.has(tap.tile_number)
        const backtrack = visited.has(tap.tile_number)

        visited.add(tap.tile_number)

        const z_tap =
            latency_ms != null
                ? Number(((latency_ms - 800) / 250).toFixed(2))
                : null

        return {
            tap_order: i + 1,
            tile_number: tap.tile_number,
            row,
            col,

            session_elapsed_s:
                startedAtMs != null && !Number.isNaN(tapMs)
                    ? Number(((tapMs - startedAtMs) / 1000).toFixed(1))
                    : null,

            latency_ms,
            hazard_hit,

            // Real motor-slip detection remains server-side.
            motor_slip: false,

            backtrack,
            z_tap,
        }
    })

    const hazardHits = mappedTaps.filter(
        (tap) => tap.hazard_hit
    ).length

    const backtrackCount = mappedTaps.filter(
        (tap) => tap.backtrack
    ).length

    const lastTap = mappedTaps[mappedTaps.length - 1]

    const destinationReached =
        !!lastTap &&
        lastTap.tile_number === board.destination.tile

    // ---------------------------------------------------------
    // NEW: Validate that the entire route is continuous.
    // START is the first point even though it is not included
    // in the submitted taps.
    // ---------------------------------------------------------
    const routeIsContinuous = isContinuousRoute(
        board.start.tile,
        taps
    )

    const routeIsValid =
        !forcedFail &&
        destinationReached &&
        routeIsContinuous

    let invalidReason = null

    if (forcedFail) {
        invalidReason = "response_window_timed_out"
    } else if (!destinationReached) {
        invalidReason = "destination_not_reached"
    } else if (!routeIsContinuous) {
        invalidReason = "non_adjacent_move"
    }

    // ---------------------------------------------------------
    // Shortest route
    // ---------------------------------------------------------
    const shortestPathLength = shortestHopCount(
        board.start.tile,
        board.destination.tile,
        hazardSet
    )

    // Number of submitted taps = number of hops because START
    // is not included in taps.
    const actualPathLength = mappedTaps.length

    const efficiency =
        routeIsValid &&
        shortestPathLength != null &&
        actualPathLength > 0
            ? Number(
                  (
                      shortestPathLength / actualPathLength
                  ).toFixed(2)
              )
            : null

    // ---------------------------------------------------------
    // Hazard recall
    // ---------------------------------------------------------
    const recall =
        hazardSet.size > 0
            ? Number(
                  (
                      1 -
                      hazardHits / hazardSet.size
                  ).toFixed(2)
              )
            : mappedTaps.length
              ? 1.0
              : null

    // ---------------------------------------------------------
    // Latency
    // ---------------------------------------------------------
    const latencies = mappedTaps
        .map((tap) => tap.latency_ms)
        .filter((value) => value != null)

    const meanLatency = latencies.length
        ? latencies.reduce((a, b) => a + b, 0) /
          latencies.length
        : null

    const sdLatency = latencies.length
        ? Math.sqrt(
              latencies.reduce(
                  (sum, value) =>
                      sum +
                      (value - meanLatency) ** 2,
                  0
              ) / latencies.length
          )
        : null

    // ---------------------------------------------------------
    // Local placeholder scoring
    // ---------------------------------------------------------
    let pointsAwarded = 0
    let shortestRouteBonus = false

    if (routeIsValid) {
        pointsAwarded = Math.max(
            0,
            POINTS_FOR_SAFE_CROSSING -
                hazardHits * 20
        )

        if (
            hazardHits === 0 &&
            efficiency != null &&
            efficiency >= 1
        ) {
            pointsAwarded += POINTS_FOR_SHORTEST_ROUTE
            shortestRouteBonus = true
        }
    }

    const neuroArcsAwarded = Math.round(
        pointsAwarded / 4
    )

    return {
        trial_id: trial.trial_id,
        level_number: levelConfig.level_number,

        route_is_valid: routeIsValid,
        invalid_reason: invalidReason,

        taps: mappedTaps,

        aggregates: {
            hazard_count: hazardSet.size,
            hazard_hits: hazardHits,

            recall,

            destination_reached: destinationReached,

            shortest_path_length: shortestPathLength,
            actual_path_length: actualPathLength,
            efficiency,

            backtrack_count: backtrackCount,

            valid_tap_count: mappedTaps.length,
            total_tap_count: mappedTaps.length,

            motor_slip_count: 0,

            mean_latency_ms:
                meanLatency != null
                    ? Number(meanLatency.toFixed(1))
                    : null,

            sd_latency_ms:
                sdLatency != null
                    ? Number(sdLatency.toFixed(1))
                    : null,

            // Useful for debugging the dummy backend.
            route_is_continuous: routeIsContinuous,
        },

        scoring: {
            points_awarded: pointsAwarded,
            neuro_arcs_awarded: neuroArcsAwarded,
            shortest_route_bonus: shortestRouteBonus,
        },
    }
}

function resolveDummyTrial(trialId, { response_started_at, taps }, forcedFail) {
    const { session, trial } = findDummyTrial(trialId)
    if (!trial) throw new ApiError(404, "Unknown trial_id")
    if (trial.status !== "SERVED") throw new ApiError(409, "This trial was already submitted.")

    const scored = scoreTrial(trial, { response_started_at, taps: taps ?? [], forcedFail })
    trial.status = forcedFail ? "TIMED_OUT" : "COMPLETED"
    trial.response_started_at = response_started_at
    trial.result = scored

    session.total_points += scored.scoring.points_awarded
    session.total_neuro_arcs += scored.scoring.neuro_arcs_awarded
    if (scored.scoring.points_awarded > 0) {
        session.current_streak += 1
        session.best_streak = Math.max(session.best_streak, session.current_streak)
    } else {
        session.current_streak = 0
    }
    session.currentIndex += 1

    return {
        ...scored,
        game_totals: {
            total_points: session.total_points,
            total_neuro_arcs: session.total_neuro_arcs,
            current_streak: session.current_streak,
            best_streak: session.best_streak,
        },
    }
}

function bandFor(score01) {
    if (score01 >= 0.7) return "Strong"
    if (score01 >= 0.4) return "Age Appropriate"
    return "Developing"
}
const clamp01 = (v) => Math.max(0, Math.min(1, v))

function dummyGameComplete({ game_session_id }) {
    const session = dummySessionsById.get(game_session_id)
    if (!session) throw new ApiError(404, "Unknown game_session_id")
    if (session.final_result) return session.final_result

    const scoredTrials = session.trials.filter(
        (t) => t.levelConfig.is_scored && (t.status === "COMPLETED" || t.status === "TIMED_OUT")
    )
    if (scoredTrials.length < TOTAL_SCORED_LEVELS) {
        throw new ApiError(409, `${scoredTrials.length}/${TOTAL_SCORED_LEVELS} resolved`)
    }

    const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0)
    const recallVals = scoredTrials.map((t) => t.result.aggregates.recall ?? 0)
    const efficiencyVals = scoredTrials.map((t) => t.result.aggregates.efficiency).filter((v) => v != null)
    const latencyVals = scoredTrials.map((t) => t.result.aggregates.mean_latency_ms).filter((v) => v != null)
    const backtrackVals = scoredTrials.map((t) => t.result.aggregates.backtrack_count ?? 0)
    const timeoutRate = scoredTrials.filter((t) => t.status === "TIMED_OUT").length / scoredTrials.length

    const recallScore = clamp01(avg(recallVals))
    const workingMemoryScore = clamp01(1 - avg(backtrackVals) / 5)
    const spatialScore = clamp01(avg(efficiencyVals.length ? efficiencyVals : [0]))
    const speedScore = clamp01(1 - (avg(latencyVals.length ? latencyVals : [1200]) - 400) / 2000)
    const attentionScore = clamp01(1 - timeoutRate)

    const makeConstruct = (raw, score01) => ({
        raw: Number(raw.toFixed(3)),
        z: null, // no population norms available locally — real API fills this in
        score_0_1: Number(score01.toFixed(2)),
        band: bandFor(score01),
    })

    const result = {
        game_session_id,
        status: "COMPLETED",
        scored_trials_used: scoredTrials.length,
        constants_version: "dummy_local_v1",
        recall: makeConstruct(avg(recallVals), recallScore),
        working_memory: makeConstruct(avg(backtrackVals), workingMemoryScore),
        spatial_sequencing: makeConstruct(avg(efficiencyVals.length ? efficiencyVals : [0]), spatialScore),
        processing_speed: makeConstruct(avg(latencyVals.length ? latencyVals : [1200]), speedScore),
        sustained_attention: makeConstruct(timeoutRate, attentionScore),
        total_points: session.total_points,
        total_neuro_arcs: session.total_neuro_arcs,
        best_streak: session.best_streak,
        screening: {
            next_stage: { stage_key: "visual_acuity" },
        },
    }

    session.final_result = result
    session.status = "COMPLETED"
    session.ended_at = new Date().toISOString()
    return result
}

function dummyGetGameStatus(gameSessionId) {
    const session = dummySessionsById.get(gameSessionId)
    if (!session) throw new ApiError(404, "Unknown game_session_id")
    return {
        game_session_id: session.game_session_id,
        status: session.status,
        current_level_number:
            session.currentIndex < LEVELS_CONFIG.length ? LEVELS_CONFIG[session.currentIndex].level_number : null,
        completed_levels: session.trials.filter((t) => t.status !== "SERVED").length,
        total_points: session.total_points,
        total_neuro_arcs: session.total_neuro_arcs,
        best_streak: session.best_streak,
        current_streak: session.current_streak,
        started_at: session.started_at,
        ended_at: session.ended_at,
        trials: session.trials.map((t) => ({
            level_number: t.levelConfig.level_number,
            status: t.status,
            points_awarded: t.result?.scoring?.points_awarded ?? 0,
            destination_reached: t.result?.aggregates?.destination_reached ?? false,
            recall: t.result?.aggregates?.recall ?? null,
            efficiency: t.result?.aggregates?.efficiency ?? null,
        })),
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Real network calls (used whenever dummyFlag is false)
// ─────────────────────────────────────────────────────────────────────────
async function request(path, { method = "POST", body } = {}) {
    let response
    try {
        response = await fetch(`${API_BASE_URL}${BASE_URL}${path}`, {
            method,
            headers: body ? { "Content-Type": "application/json" } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        })
    } catch (err) {
        throw new ApiError(0, `Network error calling ${path}: ${err.message}`)
    }

    let data = null
    try {
        data = await response.json()
    } catch {
        // no/invalid JSON body — fine for some error responses
    }

    if (!response.ok) {
        throw new ApiError(
            response.status,
            data?.message || data?.detail || `Request to ${path} failed (${response.status})`,
            data
        )
    }
    return data
}

// ─────────────────────────────────────────────────────────────────────────
// Public API — every method accepts an optional `dummyFlag` override so a
// single call can be tested locally even with DUMMY_FLAG=false at the top,
// or vice versa.
// ─────────────────────────────────────────────────────────────────────────
export const perilousPathApi = {
    DUMMY_FLAG,

    async getLevels({ dummyFlag = DUMMY_FLAG } = {}) {
        if (dummyFlag) return { levels: LEVELS_CONFIG }
        return request("/levels", { method: "GET" })
    },

    async nextGrid({ user_id, session_id = null, kiosk_id = null, dummyFlag = DUMMY_FLAG }) {
        if (dummyFlag) return dummyNextGrid({ user_id, session_id, kiosk_id })
        return request("/next-grid", { body: { user_id, session_id, kiosk_id } })
    },

    async trialComplete({ trial_id, response_started_at, taps, dummyFlag = DUMMY_FLAG }) {
        if (dummyFlag) return resolveDummyTrial(trial_id, { response_started_at, taps }, false)
        return request("/trial/complete", { body: { trial_id, response_started_at, taps } })
    },

    async trialTimeout({ trial_id, response_started_at, taps, dummyFlag = DUMMY_FLAG }) {
        if (dummyFlag) return resolveDummyTrial(trial_id, { response_started_at, taps }, true)
        return request("/trial/timeout", { body: { trial_id, response_started_at, taps } })
    },

    async gameComplete({ game_session_id, dummyFlag = DUMMY_FLAG }) {
        if (dummyFlag) return dummyGameComplete({ game_session_id })
        return request("/game/complete", { body: { game_session_id } })
    },

    async getGameStatus(gameSessionId, { dummyFlag = DUMMY_FLAG } = {}) {
        if (dummyFlag) return dummyGetGameStatus(gameSessionId)
        return request(`/game/${gameSessionId}`, { method: "GET" })
    },
}
