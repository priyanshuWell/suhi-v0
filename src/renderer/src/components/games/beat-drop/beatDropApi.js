/**
 * Beat Drop backend API — session start / complete.
 */
import { API_BASE_URL } from "../../../utils/config"
import { DEVICE_LATENCY_MS, SESSION_CHART } from "./sessionChart"

const str = (v) => (v == null || v === "" ? null : String(v))

/**
 * Map engine log rows → API raw_events shape.
 * Chart chord_pair_id is always sent for chord_L / chord_R (API contract).
 */
export function toRawEvents(log) {
    const byRow = new Map(SESSION_CHART.map((e) => [e.row_num, e]))
    return log.map((row) => {
        const chart = byRow.get(row.row_num)
        const isChord =
            row.event_type === "chord_L" || row.event_type === "chord_R"
        const chordPairId = isChord
            ? (chart?.chord_pair_id ?? row.chord_pair_id ?? null)
            : null

        return {
            row_num: row.row_num,
            block_id: row.block_id,
            trial_idx: row.trial_index,
            event_type: row.event_type,
            similarity_level: row.similarity_level,
            chord_pair_id: chordPairId,
            lane_intended: row.lane_intended,
            hand_zone: row.hand_zone,
            t_expected_ms: str(row.t_expected),
            tempo_bpm: row.tempo_bpm,
            t_tap_raw_ms: str(row.t_tap),
            lane_tapped: row.lane_tapped,
            x_tap: str(row.x_tap),
            y_tap: str(row.y_tap),
            x_center: str(row.x_center),
            y_center: str(row.y_center),
            device_latency_ms: str(
                row.device_latency_offset ?? DEVICE_LATENCY_MS
            ),
            hit_classification: row.hit_classification
        }
    })
}

export async function startBeatDropSession({
    userId,
    screeningSessionId,
    kioskId,
    deviceLatencyMs = DEVICE_LATENCY_MS,
    clientAppVersion = "1.0.3"
}) {
    const res = await fetch(`${API_BASE_URL}/beat-drop/session/start`, {
        method: "POST",
        headers: {
            accept: "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            user_id: userId,
            screening_session_id: screeningSessionId,
            kiosk_id: kioskId,
            device_latency_ms: deviceLatencyMs,
            client_app_version: clientAppVersion
        })
    })
    if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(`beat-drop/session/start ${res.status}: ${text}`)
    }
    return res.json()
}

export async function completeBeatDropSession({
    sessionId,
    rawEvents,
    score,
    longestStreak
}) {
    const res = await fetch(`${API_BASE_URL}/beat-drop/session/complete`, {
        method: "POST",
        headers: {
            accept: "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            session_id: sessionId,
            score,
            longest_streak: longestStreak,
            raw_events: rawEvents
        })
    })
    if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(`beat-drop/session/complete ${res.status}: ${text}`)
    }
    return res.json()
}

/**
 * Results HUD from complete response.report:
 *   { score, neuro_arcs, longest_streak }
 */
export function resultsFromComplete(data, fallback) {
    if (!data || typeof data !== "object") return fallback
    const report = data.report ?? {}
    return {
        score: Number(report.score ?? fallback.score) || 0,
        coins: Number(report.neuro_arcs ?? fallback.coins) || 0,
        streak: Number(report.longest_streak ?? fallback.streak) || 0
    }
}
