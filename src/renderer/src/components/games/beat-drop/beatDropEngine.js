/**
 * Beat Drop session engine — chart clock, visual hit windows, raw event log.
 */
import {
    DEVICE_LATENCY_MS,
    LANE_CENTER,
    SESSION_CHART,
    SESSION_DURATION_MS,
    SPEED_POPUP_AT_MS
} from "./sessionChart"
import { FRAME_H } from "./frame"

export { SESSION_DURATION_MS, SPEED_POPUP_AT_MS, DEVICE_LATENCY_MS }

/**
 * @param {object} opts
 * @param {number} opts.hitLineTop — design-px Y of hit line
 * @param {number} opts.headH — design-px height of note head (square)
 */
export function createBeatDropEngine({ hitLineTop, headH }) {
    const halfHead = headH / 2
    /** image bottom Y when center is on the hit line (= t_expected) */
    const yAtExpected = hitLineTop + halfHead
    /** image bottom Y at spawn (head fully above top) */
    const yAtSpawn = -headH
    /** window open: leading (bottom) edge on line */
    const yWindowOpen = hitLineTop
    /** window close: trailing (top of head) on line */
    const yWindowClose = hitLineTop + headH

    const chart = SESSION_CHART.map((e) => ({
        ...e,
        /** piano / UI lane index 0–4 */
        laneIndex: e.lane_intended - 1,
        tapped: false,
        closed: false,
        log: null
    }))

    const log = []
    let score = 0
    let combo = 0
    let bestStreak = 0
    let startedAt = 0
    let running = false
    let paused = false
    let pausedAt = 0
    let pausedTotal = 0

    function sessionNow() {
        if (!running) return 0
        const base = (paused ? pausedAt : performance.now()) - startedAt - pausedTotal
        return base
    }

    function start() {
        startedAt = performance.now()
        running = true
        paused = false
        pausedAt = 0
        pausedTotal = 0
        score = 0
        combo = 0
        bestStreak = 0
        log.length = 0
        for (const e of chart) {
            e.tapped = false
            e.closed = false
            e.log = null
        }
    }

    function pause() {
        if (!running || paused) return
        paused = true
        pausedAt = performance.now()
    }

    function resume() {
        if (!running || !paused) return
        pausedTotal += performance.now() - pausedAt
        paused = false
        pausedAt = 0
    }

    function stop() {
        running = false
        paused = false
        const t = sessionNow()
        for (const e of chart) {
            if (!e.closed) finalizeEvent(e, t)
        }
    }

    function yBottomAt(event, t) {
        const span = Math.max(1, event.t_expected - event.t_spawn)
        const u = (t - event.t_spawn) / span
        return yAtSpawn + (yAtExpected - yAtSpawn) * u
    }

    function cssBottom(yBottom) {
        return FRAME_H - yBottom
    }

    function windowOpenAt(event) {
        const span = Math.max(1, event.t_expected - event.t_spawn)
        const dist = yWindowOpen - yAtSpawn
        const total = yAtExpected - yAtSpawn
        return event.t_spawn + (dist / total) * span
    }

    function windowCloseAt(event) {
        const span = Math.max(1, event.t_expected - event.t_spawn)
        const dist = yWindowClose - yAtSpawn
        const total = yAtExpected - yAtSpawn
        return event.t_spawn + (dist / total) * span
    }

    function emptyTapFields() {
        return {
            t_tap: null,
            lane_tapped: null,
            x_tap: null,
            y_tap: null
        }
    }

    function finalizeEvent(event, t) {
        if (event.closed) return
        event.closed = true
        if (event.log) return
        // Omission / correct_rejection (no tap)
        const row = {
            row_num: event.row_num,
            block_id: event.block_id,
            trial_index: event.trial_index,
            event_type: event.event_type,
            similarity_level: event.similarity_level,
            chord_pair_id: event.chord_pair_id,
            lane_intended: event.lane_intended,
            hand_zone: event.hand_zone,
            t_spawn: event.t_spawn,
            t_expected: event.t_expected,
            ...emptyTapFields(),
            x_center: event.x_center,
            y_center: event.y_center,
            device_latency_offset: DEVICE_LATENCY_MS,
            tempo_bpm: event.tempo_bpm,
            hit_classification:
                event.event_type === "decoy_note" ? "correct_rejection" : "omission"
        }
        event.log = row
        log.push(row)
        if (event.event_type !== "decoy_note") {
            combo = 0
        }
    }

    function tryCloseExpired(t) {
        for (const e of chart) {
            if (e.closed) continue
            if (t >= windowCloseAt(e)) finalizeEvent(e, t)
        }
    }

    /**
     * White-key press. laneIndex 0–4.
     * @returns {{ accepted: boolean, event?: object, score: number }}
     */
    function handleLaneTap(laneIndex, xTap, yTap) {
        if (!running || paused) return { accepted: false, score }
        const t = sessionNow()
        tryCloseExpired(t)
        const lane = laneIndex + 1

        // Find best open event for this lane inside its visual window
        let best = null
        let bestDist = Infinity
        for (const e of chart) {
            if (e.closed || e.tapped) continue
            if (e.lane_intended !== lane) continue
            const open = windowOpenAt(e)
            const close = windowCloseAt(e)
            if (t < open || t > close) continue
            const dist = Math.abs(t - e.t_expected)
            if (dist < bestDist) {
                bestDist = dist
                best = e
            }
        }

        // Decoy false-alarm: any decoy in window on this lane
        if (!best) {
            for (const e of chart) {
                if (e.closed || e.tapped) continue
                if (e.event_type !== "decoy_note") continue
                if (e.lane_intended !== lane) continue
                const open = windowOpenAt(e)
                const close = windowCloseAt(e)
                if (t < open || t > close) continue
                best = e
                break
            }
        }

        if (!best) return { accepted: false, score }

        best.tapped = true
        best.closed = true
        const te = t - best.t_expected
        const laneErr = Math.abs(lane - best.lane_intended)
        let classification = "hit"
        if (best.event_type === "decoy_note") {
            classification = "false_alarm"
            combo = 0
        } else if (laneErr >= 2) {
            classification = "mis-hit-far"
            combo = 0
        } else if (laneErr === 1) {
            classification = "mis-hit-adjacent"
            combo = 0
        } else if (Math.abs(te) > (windowCloseAt(best) - windowOpenAt(best)) / 2) {
            // Within visual window but far from center — still a hit for HUD;
            // backend may label timing_miss. Keep as hit if correct lane.
            classification = "hit"
            combo += 1
            score += 100
        } else {
            classification = "hit"
            combo += 1
            score += 120
        }

        if (classification === "hit") {
            bestStreak = Math.max(bestStreak, combo)
        } else if (classification === "false_alarm") {
            score = Math.max(0, score - 50)
        }

        const row = {
            row_num: best.row_num,
            block_id: best.block_id,
            trial_index: best.trial_index,
            event_type: best.event_type,
            similarity_level: best.similarity_level,
            chord_pair_id: best.chord_pair_id,
            lane_intended: best.lane_intended,
            hand_zone: best.hand_zone,
            t_spawn: best.t_spawn,
            t_expected: best.t_expected,
            t_tap: Math.round(t),
            lane_tapped: lane,
            x_tap: xTap ?? LANE_CENTER[lane].x,
            y_tap: yTap ?? LANE_CENTER[lane].y,
            x_center: best.x_center,
            y_center: best.y_center,
            device_latency_offset: DEVICE_LATENCY_MS,
            tempo_bpm: best.tempo_bpm,
            hit_classification: classification
        }
        best.log = row
        log.push(row)
        return { accepted: true, event: best, score, classification }
    }

    /** Active notes for rendering at session time t */
    function getVisibleNotes(t) {
        tryCloseExpired(t)
        const visible = []
        for (const e of chart) {
            if (e.closed && t > windowCloseAt(e) + 200) continue
            if (t < e.t_spawn) continue
            if (t > windowCloseAt(e) + 400) continue
            const yb = yBottomAt(e, t)
            visible.push({
                key: e.row_num,
                event: e,
                laneIndex: e.laneIndex,
                cssBottom: cssBottom(yb),
                inWindow: t >= windowOpenAt(e) && t <= windowCloseAt(e) && !e.closed
            })
        }
        return visible
    }

    function getSnapshot() {
        const t = sessionNow()
        tryCloseExpired(t)
        return {
            t,
            score,
            combo,
            bestStreak,
            secondsLeft: Math.max(0, Math.ceil((SESSION_DURATION_MS - t) / 1000)),
            done: t >= SESSION_DURATION_MS,
            notes: getVisibleNotes(t),
            log: log.slice(),
            blockId: currentBlock(t)
        }
    }

    function currentBlock(t) {
        let b = "A"
        for (const e of chart) {
            if (e.t_spawn <= t) b = e.block_id
        }
        return b
    }

    return {
        start,
        stop,
        pause,
        resume,
        sessionNow,
        handleLaneTap,
        getSnapshot,
        getLog: () => log.slice(),
        getScore: () => score,
        getBestStreak: () => bestStreak
    }
}
