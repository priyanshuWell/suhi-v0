import { useEffect, useRef, useState, useCallback } from "react"
import bg from "../../../assets/beat-drop/playArea/play_area_bg_card.png"
import timeBox from "../../../assets/beat-drop/playArea/time_box_blank.png"
import scoreBox from "../../../assets/beat-drop/playArea/score_blank.png"
import yellow from "../../../assets/beat-drop/playArea/yellow_element.png"
import green from "../../../assets/beat-drop/playArea/green_element.png"
import pink from "../../../assets/beat-drop/playArea/pink_element.png"
import blue from "../../../assets/beat-drop/playArea/blue_element.png"
import purple from "../../../assets/beat-drop/playArea/purple_element.png"
import decoySquare from "../../../assets/beat-drop/playArea/decoy_square.png"
import decoyTriangle from "../../../assets/beat-drop/playArea/decoy_triangle.png"
import decoyStar from "../../../assets/beat-drop/playArea/decoy_star.png"
import Piano from "../../Piano"
import { PIANO_SPEC } from "../../pianoSpec"
import { anton, cqw, FRAME_H, FRAME_W, NEON_GLOW, oswald, pct } from "./frame"
import { createBeatDropEngine } from "./beatDropEngine"
import { getFirstNodePerLevel } from "./sessionChart"

const LANE_COUNT = 5
const NOTE_BY_LANE = [yellow, green, pink, blue, purple]
const DECOY_BY_SIM = { 1: decoyStar, 2: decoyTriangle, 3: decoySquare }

const NOTE_NATIVE = new Map([
    [yellow, { w: 724, h: 2172, headW: 527 }],
    [green, { w: 778, h: 2022, headW: 535 }],
    [pink, { w: 1029, h: 1528, headW: 419 }],
    [blue, { w: 940, h: 1672, headW: 402 }],
    [purple, { w: 768, h: 2046, headW: 513 }],
    [decoySquare, { w: 1024, h: 1536, headW: 636 }],
    [decoyTriangle, { w: 1087, h: 1447, headW: 766 }],
    [decoyStar, { w: 1024, h: 1536, headW: 559 }]
])

function noteDisplayWidth(img, headTarget) {
    const native = NOTE_NATIVE.get(img)
    if (!native) return headTarget
    return headTarget * (native.w / native.headW)
}

/** Full on-screen height of PNG (box + trail). */
function noteDisplayFullH(img, headTarget) {
    const native = NOTE_NATIVE.get(img)
    if (!native) return headTarget
    return headTarget * (native.h / native.headW)
}

function imgForEvent(event) {
    if (event.event_type === "decoy_note") {
        return DECOY_BY_SIM[event.similarity_level] || decoySquare
    }
    return NOTE_BY_LANE[event.lane_intended - 1] || yellow
}

const FIELD_MARGIN = 72
const FIELD_LEFT = FIELD_MARGIN
const FIELD_WIDTH = FRAME_W - FIELD_MARGIN * 2
const PIANO_FIELD_INSET = 58
const PIANO_WIDTH = FIELD_WIDTH - PIANO_FIELD_INSET * 2
const PIANO_LEFT = FIELD_LEFT + PIANO_FIELD_INSET
const PIANO_BOTTOM = 220
const PIANO_SCALE = PIANO_WIDTH / PIANO_SPEC.frameW
const PIANO_HEIGHT = PIANO_SPEC.frameH * PIANO_SCALE
const PIANO_TOP = FRAME_H - PIANO_BOTTOM - PIANO_HEIGHT
const HIT_LINE_THICKNESS = 15
const HIT_LINE_TOP = PIANO_TOP - 22

const bedX = (xInKeys) => PIANO_LEFT + (PIANO_SPEC.padX + xInKeys) * PIANO_SCALE
const BLACK_CENTERS = Array.from({ length: 4 }, (_, i) => {
    const leftInKeys = PIANO_SPEC.pitch * (i + 1) - PIANO_SPEC.blackOffset
    return bedX(leftInKeys + PIANO_SPEC.blackW / 2)
})
const WHITE_CENTERS = Array.from({ length: LANE_COUNT }, (_, i) =>
    bedX(PIANO_SPEC.pitch * i + PIANO_SPEC.whiteW / 2)
)
const LANE_W =
    WHITE_CENTERS.length > 1 ? WHITE_CENTERS[1] - WHITE_CENTERS[0] : FIELD_WIDTH / LANE_COUNT

const DIVIDER_TOP = 0
const DIVIDER_HEIGHT = HIT_LINE_TOP - DIVIDER_TOP
const DIVIDER_WIDTH = 3

const HEAD_TARGET = LANE_W * 0.38

function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec))
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
}

function NeonDivider({ x }) {
    return (
        <div
            style={{
                position: "absolute",
                left: pct(x - DIVIDER_WIDTH / 2, "x"),
                top: pct(DIVIDER_TOP),
                width: pct(DIVIDER_WIDTH, "x"),
                height: pct(DIVIDER_HEIGHT),
                background: "#FFFFFF",
                boxShadow: NEON_GLOW,
                pointerEvents: "none",
                zIndex: 3
            }}
        />
    )
}

function NeonHitLine({ lineRef }) {
    return (
        <div
            ref={lineRef}
            style={{
                position: "absolute",
                left: 0,
                top: pct(HIT_LINE_TOP),
                width: "100%",
                height: pct(HIT_LINE_THICKNESS),
                background: "#FFFFFF",
                boxShadow: NEON_GLOW,
                borderRadius: 999,
                pointerEvents: "none",
                zIndex: 4
            }}
        />
    )
}

/**
 * Live probe: first note of each level, appear → box center crosses hit-line mid.
 * Uses getBoundingClientRect so it tracks real on-screen size/height.
 */
function probeFirstNodeFallTimes({
    sessionT,
    hitLineEl,
    fieldEl,
    firstByLevel,
    stateRef
}) {
    if (!hitLineEl || !fieldEl || !firstByLevel) return
    const line = hitLineEl.getBoundingClientRect()
    if (line.height < 1) return
    const lineMidY = line.top + line.height / 2

    for (const [level, event] of firstByLevel) {
        if (stateRef.done.has(level)) continue
        if (sessionT < event.t_spawn) continue

        if (!stateRef.appeared.has(level)) {
            stateRef.appeared.set(level, sessionT)
        }

        const el = fieldEl.querySelector(`[data-fall-probe="${level}"]`)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.height < 1) continue

        const headRatio = Number(el.dataset.headRatio) || 0.25
        // PNG = trail above + box at bottom; box center from image bottom
        const boxCenterY = rect.bottom - (rect.height * headRatio) / 2

        if (boxCenterY < lineMidY) continue

        const appearT = stateRef.appeared.get(level)
        const measuredMs = Math.round(sessionT - appearT)
        const chartedMs = event.t_expected - event.t_spawn

        console.log("[BeatDrop] LIVE first-node fall (appear → hit-line mid)", {
            level,
            row_num: event.row_num,
            event_type: event.event_type,
            lane_intended: event.lane_intended,
            measured_ms: measuredMs,
            charted_ms: chartedMs,
            delta_ms: measuredMs - chartedMs,
            session_t: Math.round(sessionT),
            t_spawn: event.t_spawn,
            t_expected: event.t_expected,
            screen: {
                boxCenterY: Math.round(boxCenterY),
                hitLineMidY: Math.round(lineMidY),
                noteH: Math.round(rect.height),
                hitLineH: Math.round(line.height)
            }
        })
        stateRef.done.add(level)
    }
}

/**
 * Play field driven by Beat Drop chart + engine.
 */
export default function PlayArea({
    active,
    paused = false,
    secondsLeft = 100,
    score = 0,
    onScore,
    onSessionEnd,
    onSpeedPopup,
    onChordPopup,
    onAvoidPopup,
    speedAtMs = 20000,
    chordAtMs = 37918,
    avoidAtMs = 53000,
    engineRef
}) {
    const [notes, setNotes] = useState([])
    const engine = useRef(null)
    const raf = useRef(0)
    const fieldRef = useRef(null)
    const hitLineRef = useRef(null)
    const fallProbeRef = useRef({
        firstByLevel: null,
        appeared: new Map(),
        done: new Set()
    })
    const speedPopupSent = useRef(false)
    const chordPopupSent = useRef(false)
    const avoidPopupSent = useRef(false)
    const startedRef = useRef(false)
    const endedGuard = useRef(false)

    useEffect(() => {
        engine.current = createBeatDropEngine({
            hitLineTop: HIT_LINE_TOP,
            hitLineThickness: HIT_LINE_THICKNESS,
            headH: HEAD_TARGET,
            getSpriteFullH: (event) =>
                noteDisplayFullH(imgForEvent(event), HEAD_TARGET)
        })
        if (engineRef) engineRef.current = engine.current
        return () => {
            engine.current?.stop()
            if (engineRef) engineRef.current = null
        }
    }, [engineRef])

    useEffect(() => {
        if (!engine.current) return
        if (paused) engine.current.pause()
        else if (startedRef.current) engine.current.resume()
    }, [paused])

    useEffect(() => {
        if (!active || !engine.current) {
            cancelAnimationFrame(raf.current)
            if (!active) {
                startedRef.current = false
                setNotes([])
            }
            return undefined
        }

        if (!startedRef.current) {
            speedPopupSent.current = false
            chordPopupSent.current = false
            avoidPopupSent.current = false
            endedGuard.current = false
            fallProbeRef.current = {
                firstByLevel: getFirstNodePerLevel(),
                appeared: new Map(),
                done: new Set()
            }
            engine.current.start()
            startedRef.current = true
        }

        const tick = () => {
            if (!engine.current) return
            const snap = engine.current.getSnapshot()
            setNotes(snap.notes)
            onScore?.(snap.score)

            if (!speedPopupSent.current && snap.t >= speedAtMs) {
                speedPopupSent.current = true
                onSpeedPopup?.()
            }
            if (!chordPopupSent.current && snap.t >= chordAtMs) {
                chordPopupSent.current = true
                onChordPopup?.()
            }
            if (!avoidPopupSent.current && snap.t >= avoidAtMs) {
                avoidPopupSent.current = true
                onAvoidPopup?.()
            }

            if (snap.done && !endedGuard.current) {
                endedGuard.current = true
                engine.current.stop()
                startedRef.current = false
                onSessionEnd?.(engine.current.getLog(), {
                    score: engine.current.getScore(),
                    streak: engine.current.getBestStreak()
                })
                return
            }
            raf.current = requestAnimationFrame(tick)
        }
        raf.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf.current)
    }, [
        active,
        onScore,
        onSessionEnd,
        onSpeedPopup,
        onChordPopup,
        onAvoidPopup,
        speedAtMs,
        chordAtMs,
        avoidAtMs
    ])

    // After notes paint: measure real on-screen box-center vs hit-line mid
    useEffect(() => {
        if (!active || !engine.current || paused) return undefined
        const id = requestAnimationFrame(() => {
            probeFirstNodeFallTimes({
                sessionT: engine.current.sessionNow(),
                hitLineEl: hitLineRef.current,
                fieldEl: fieldRef.current,
                firstByLevel: fallProbeRef.current.firstByLevel,
                stateRef: fallProbeRef.current
            })
        })
        return () => cancelAnimationFrame(id)
    }, [active, paused, notes])

    const handleNoteOn = useCallback(
        (_note, info) => {
            if (paused || info.lane == null || !engine.current) return
            // Engine logs x_tap/y_tap in chart space (x: 100..500, y: 500)
            engine.current.handleLaneTap(info.lane)
            const snap = engine.current.getSnapshot()
            onScore?.(snap.score)
            setNotes(snap.notes)
        },
        [onScore, paused]
    )

    return (
        <div ref={fieldRef} style={{ position: "absolute", inset: 0 }}>
            <img
                src={bg}
                alt=""
                draggable={false}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    pointerEvents: "none"
                }}
            />

            {/* Time HUD */}
            <div
                style={{
                    position: "absolute",
                    left: pct(36, "x"),
                    top: pct(56),
                    width: pct(260, "x"),
                    height: pct(260, "y"),
                    zIndex: 8
                }}
            >
                <img
                    src={timeBox}
                    alt=""
                    draggable={false}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        pointerEvents: "none"
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingTop: "6%"
                    }}
                >
                    <span
                        style={{
                            ...oswald,
                            fontSize: cqw(48),
                            color: "#FFFFFF",
                            lineHeight: "100%",
                            letterSpacing: "0%"
                        }}
                    >
                        Time
                    </span>
                    <span
                        style={{
                            ...anton,
                            fontSize: cqw(48),
                            color: "#FFFFFF",
                            lineHeight: cqw(32),
                            letterSpacing: "1.2px",
                            marginTop: cqw(18)
                        }}
                    >
                        {formatTime(secondsLeft)}
                    </span>
                </div>
            </div>

            {/* Score HUD */}
            <div
                style={{
                    position: "absolute",
                    right: pct(36, "x"),
                    top: pct(56),
                    width: pct(260, "x"),
                    height: pct(260, "y"),
                    zIndex: 8
                }}
            >
                <img
                    src={scoreBox}
                    alt=""
                    draggable={false}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        pointerEvents: "none"
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingTop: "6%"
                    }}
                >
                    <span
                        style={{
                            ...oswald,
                            fontSize: cqw(48),
                            color: "#FFB703",
                            lineHeight: "100%",
                            letterSpacing: "0%"
                        }}
                    >
                        Score
                    </span>
                    <span
                        style={{
                            ...anton,
                            fontSize: cqw(48),
                            color: "#FFFFFF",
                            lineHeight: "100%",
                            letterSpacing: "0%",
                            marginTop: cqw(18)
                        }}
                    >
                        {score}
                    </span>
                </div>
            </div>

            {BLACK_CENTERS.map((x, i) => (
                <NeonDivider key={i} x={x} />
            ))}
            <NeonHitLine lineRef={hitLineRef} />

            {notes.map((n) => {
                const img = imgForEvent(n.event)
                const native = NOTE_NATIVE.get(img) ?? { w: 1, h: 1 }
                const width = noteDisplayWidth(img, HEAD_TARGET)
                const fullH = noteDisplayFullH(img, HEAD_TARGET)
                const left = WHITE_CENTERS[n.laneIndex] - width / 2
                const probe = fallProbeRef.current.firstByLevel?.get(n.event.block_id)
                const isFallProbe = probe && probe.row_num === n.event.row_num
                return (
                    <img
                        key={n.key}
                        src={img}
                        alt=""
                        draggable={false}
                        data-fall-probe={isFallProbe ? n.event.block_id : undefined}
                        data-head-ratio={isFallProbe ? HEAD_TARGET / fullH : undefined}
                        style={{
                            position: "absolute",
                            left: pct(left, "x"),
                            top: "auto",
                            bottom: pct(n.cssBottom),
                            width: pct(width, "x"),
                            height: "auto",
                            aspectRatio: `${native.w} / ${native.h}`,
                            objectFit: "contain",
                            objectPosition: "center bottom",
                            zIndex: 5,
                            pointerEvents: "none",
                            opacity: n.event.tapped ? 0.35 : 1,
                            filter: n.event.event_type === "decoy_note"
                                ? "drop-shadow(0 0 18px rgba(255,40,140,0.9)) brightness(1.1)"
                                : "drop-shadow(0 0 20px rgba(255,210,80,0.7)) brightness(1.12)"
                        }}
                    />
                )
            })}

            <div
                style={{
                    position: "absolute",
                    left: pct(PIANO_LEFT, "x"),
                    top: pct(PIANO_TOP),
                    width: pct(PIANO_WIDTH, "x"),
                    zIndex: 7
                }}
            >
                <Piano onNoteOn={handleNoteOn} />
            </div>
        </div>
    )
}
