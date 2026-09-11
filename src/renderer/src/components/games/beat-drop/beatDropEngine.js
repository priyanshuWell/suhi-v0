/**
 * Beat Drop session engine — chart clock, visual hit windows, raw event log.
 *
 * Geometry (PNG = trail above + box at bottom):
 *  - t_expected = BOX center on hit line (ignore trail)
 *  - Hit accepted while box OR trail overlaps the hit-line band
 *    (from box leading edge until trail tip clears the bottom of the line)
 *
 * Scoring (HUD):
 *  - +5 per successful note hit
 *  - +10 bonus at 5x streak, +20 at 10x, +30 at 20x
 */
import {
    DEVICE_LATENCY_MS,
    LANE_CENTER,
    SESSION_CHART,
    SESSION_DURATION_MS,
    SPEED_POPUP_AT_MS,
    logFirstNodeFallTimesPerLevel
} from "./sessionChart"
import { FRAME_H } from "./frame"

export { SESSION_DURATION_MS, SPEED_POPUP_AT_MS, DEVICE_LATENCY_MS }

const POINTS_PER_HIT = 5
/** Awarded once when combo first reaches each threshold. */
const STREAK_BONUS = {
    5: 10,
    10: 20,
    20: 30
}

/**
 * @param {object} opts
 * @param {number} opts.hitLineTop — design-px Y of hit line (top edge)
 * @param {number} [opts.hitLineThickness=15] — hit line band height
 * @param {number} opts.headH — design-px height of the BOX only (no trail)
 * @param {(event: object) => number} [opts.getSpriteFullH] — full PNG H (box + trail)
 */
export function createBeatDropEngine({
    hitLineTop,
    hitLineThickness = 15,
    headH,
    getSpriteFullH
}) {
    const halfHead = headH / 2
    const lineBottom = hitLineTop + hitLineThickness
    /** image bottom Y when BOX center is on the hit line (= t_expected) */
    const yAtExpected = hitLineTop + halfHead
    /** image bottom Y at spawn */
    const yAtSpawn = -headH
    /** window open: leading edge of BOX touches top of line */
    const yWindowOpen = hitLineTop

    const chart = SESSION_CHART.map((e) => ({
        ...e,
        laneIndex: e.lane_intended - 1,
        tapped: false,
        closed: false,
        log: null,
        /** Full sprite height so trail still counts as valid click zone */
        spriteFullH: getSpriteFullH ? getSpriteFullH(e) : headH * 3
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
        return (paused ? pausedAt : performance.now()) - startedAt - pausedTotal
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
        logFirstNodeFallTimesPerLevel(chart)
        // Live screen-measured fall times are probed in PlayArea each frame.
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

    /**
     * Window closes when trail tip leaves the BOTTOM of the hit line band
     * (yTop = lineBottom → yBottom = lineBottom + spriteFullH).
     */
    function yWindowCloseFor(event) {
        return lineBottom + (event.spriteFullH || headH)
    }

    function windowOpenAt(event) {
        const span = Math.max(1, event.t_expected - event.t_spawn)
        const total = yAtExpected - yAtSpawn
        return event.t_spawn + ((yWindowOpen - yAtSpawn) / total) * span
    }

    function windowCloseAt(event) {
        const span = Math.max(1, event.t_expected - event.t_spawn)
        const total = yAtExpected - yAtSpawn
        return event.t_spawn + ((yWindowCloseFor(event) - yAtSpawn) / total) * span
    }

    /** True while box or trail still overlaps the hit-line band. */
    function overlapsHitLine(event, t) {
        const yb = yBottomAt(event, t)
        const fullH = event.spriteFullH || headH
        const yTop = yb - fullH
        return yb >= hitLineTop && yTop <= lineBottom
    }

    function emptyTapFields() {
        return {
            t_tap: null,
            lane_tapped: null,
            x_tap: null,
            y_tap: null
        }
    }

    function chordPartner(event) {
        // Chart pairing id (always set for chord_L / chord_R). Logged only when both hit.
        if (!event.chord_pair_id) return null
        return chart.find(
            (e) => e.chord_pair_id === event.chord_pair_id && e.row_num !== event.row_num
        )
    }

    /**
     * Logged chord_pair_id is null until BOTH halves of the pair are hits.
     * Chart still uses chord_pair_id internally to find partners.
     */
    function resolveChordPair(event) {
        if (!event.chord_pair_id || !event.log) return
        const partner = chordPartner(event)
        if (!partner?.closed || !partner.log) return

        const bothHit =
            event.log.hit_classification === "hit" &&
            partner.log.hit_classification === "hit"

        if (bothHit) {
            event.log.chord_pair_id = event.chord_pair_id
            partner.log.chord_pair_id = event.chord_pair_id
            event.log.chord_complete = 1
            partner.log.chord_complete = 1
        } else {
            event.log.chord_pair_id = null
            partner.log.chord_pair_id = null
            event.log.chord_complete = 0
            partner.log.chord_complete = 0
        }
    }

    function applyHitScore() {
        combo += 1
        bestStreak = Math.max(bestStreak, combo)
        score += POINTS_PER_HIT
        const bonus = STREAK_BONUS[combo]
        if (bonus) score += bonus
    }

    function finalizeEvent(event) {
        if (event.closed) return
        event.closed = true
        if (event.log) return

        const row = {
            row_num: event.row_num,
            block_id: event.block_id,
            trial_index: event.trial_index,
            event_type: event.event_type,
            similarity_level: event.similarity_level,
            // Only filled later if both L+R of this pair were hit
            chord_pair_id: null,
            lane_intended: event.lane_intended,
            hand_zone: event.hand_zone,
            t_spawn: event.t_spawn,
            t_expected: event.t_expected,
            expected_hit_time_ms: event.expected_hit_time_ms,
            ...emptyTapFields(),
            x_center: event.x_center,
            y_center: event.y_center,
            device_latency_offset: DEVICE_LATENCY_MS,
            tempo_bpm: event.tempo_bpm,
            hit_classification:
                event.event_type === "decoy_note" ? "correct_rejection" : "omission",
            chord_complete: null
        }
        event.log = row
        log.push(row)

        resolveChordPair(event)

        if (event.event_type !== "decoy_note") combo = 0
    }

    function tryCloseExpired(t) {
        for (const e of chart) {
            if (e.closed) continue
            // Strict > so a tap exactly at trail tip still counts
            if (t > windowCloseAt(e)) finalizeEvent(e)
        }
    }

    /**
     * White-key press. laneIndex 0–4.
     * Logs x_tap/y_tap in chart space: x ∈ {100,200,300,400,500}, y = 500.
     */
    function handleLaneTap(laneIndex) {
        if (!running || paused) return { accepted: false, score }
        const t = sessionNow()
        const lane = laneIndex + 1

        // Match against live geometry BEFORE closing expired notes,
        // so the trail tip on the line is still hittable.
        let best = null
        let bestDist = Infinity
        for (const e of chart) {
            if (e.closed || e.tapped) continue
            if (e.lane_intended !== lane) continue
            if (!overlapsHitLine(e, t)) continue
            const dist = Math.abs(t - e.t_expected)
            if (dist < bestDist) {
                bestDist = dist
                best = e
            }
        }

        if (!best) {
            for (const e of chart) {
                if (e.closed || e.tapped) continue
                if (e.event_type !== "decoy_note") continue
                if (e.lane_intended !== lane) continue
                if (!overlapsHitLine(e, t)) continue
                best = e
                break
            }
        }

        if (!best) {
            tryCloseExpired(t)
            return { accepted: false, score }
        }

        best.tapped = true
        best.closed = true

        let classification = "hit"
        if (best.event_type === "decoy_note") {
            classification = "false_alarm"
            combo = 0
        } else {
            classification = "hit"
            applyHitScore()
        }

        const row = {
            row_num: best.row_num,
            block_id: best.block_id,
            trial_index: best.trial_index,
            event_type: best.event_type,
            similarity_level: best.similarity_level,
            // Only filled later if both L+R of this pair were hit
            chord_pair_id: null,
            lane_intended: best.lane_intended,
            hand_zone: best.hand_zone,
            t_spawn: best.t_spawn,
            t_expected: best.t_expected,
            expected_hit_time_ms: best.expected_hit_time_ms,
            t_tap: Math.round(t),
            lane_tapped: lane,
            x_tap: LANE_CENTER[lane].x,
            y_tap: LANE_CENTER[lane].y,
            x_center: best.x_center,
            y_center: best.y_center,
            device_latency_offset: DEVICE_LATENCY_MS,
            tempo_bpm: best.tempo_bpm,
            hit_classification: classification,
            chord_complete: null,
            combo,
            score
        }
        best.log = row
        log.push(row)

        resolveChordPair(best)
        tryCloseExpired(t)

        // Temporary: log tap coordinates whenever x_tap / y_tap are set
        if (row.x_tap != null || row.y_tap != null) {
            console.log("[BeatDrop] tap", {
                x_tap: row.x_tap,
                y_tap: row.y_tap,
                lane_tapped: row.lane_tapped,
                lane_intended: row.lane_intended,
                t_tap: row.t_tap,
                t_expected: row.t_expected,
                event_type: row.event_type,
                chord_pair_id: row.chord_pair_id,
                chord_complete: row.chord_complete,
                hit_classification: row.hit_classification,
                combo: row.combo,
                score: row.score
            })
        }

        return { accepted: true, event: best, score, classification }
    }

    function getVisibleNotes(t) {
        tryCloseExpired(t)
        const visible = []
        for (const e of chart) {
            if (t < e.t_spawn) continue
            if (t > windowCloseAt(e) + 500) continue
            const yb = yBottomAt(e, t)
            visible.push({
                key: e.chord_pair_id
                    ? `${e.chord_pair_id}-${e.event_type}`
                    : `row-${e.row_num}`,
                event: e,
                laneIndex: e.laneIndex,
                cssBottom: cssBottom(yb),
                inWindow: overlapsHitLine(e, t) && !e.tapped
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
