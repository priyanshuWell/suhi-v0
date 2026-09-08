import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
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
import { anton, cqw, FRAME_H, FRAME_W, NEON_GLOW, pct } from "./frame"

const LANE_COUNT = 5
const NOTE_IMGS = [yellow, green, pink, blue, purple]
const DECOY_IMGS = [decoySquare, decoyTriangle, decoyStar]

/**
 * Unified play-field geometry (design px on 1513×2678).
 * Vertical dividers, hit line, note lanes and piano keys all share this grid
 * so every edge lines up exactly like Figma.
 */
const FIELD_MARGIN = 72
const FIELD_LEFT = FIELD_MARGIN
const FIELD_WIDTH = FRAME_W - FIELD_MARGIN * 2
const LANE_W = FIELD_WIDTH / LANE_COUNT

/**
 * The keybed spec is authored in 1:1 CSS pixels for the 1080 × 1920 window;
 * this play field is FRAME_W wide. Piano.jsx owns the internal key grid — here
 * we only place its chassis rect on the field.
 */
const SPEC_WINDOW_W = 1080
const cssToDesign = (v) => (v * FRAME_W) / SPEC_WINDOW_W

const PIANO_BOTTOM = 36
const PIANO_WIDTH = cssToDesign(PIANO_SPEC.frameW)
const PIANO_HEIGHT = cssToDesign(PIANO_SPEC.frameH)
const PIANO_LEFT = (FRAME_W - PIANO_WIDTH) / 2
const PIANO_TOP = FRAME_H - PIANO_BOTTOM - PIANO_HEIGHT

/** Hit line sits just above the piano frame (Figma). */
const HIT_LINE_THICKNESS = 8
const HIT_LINE_TOP = PIANO_TOP - 18

/** Vertical neon rails: below HUD → hit line */
const DIVIDER_TOP = 340
const DIVIDER_HEIGHT = HIT_LINE_TOP - DIVIDER_TOP
const DIVIDER_WIDTH = 3

function laneEdge(i) {
    return FIELD_LEFT + i * LANE_W
}

function laneCenter(i) {
    return FIELD_LEFT + (i + 0.5) * LANE_W
}

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

function NeonHitLine() {
    return (
        <div
            style={{
                position: "absolute",
                left: pct(FIELD_LEFT, "x"),
                top: pct(HIT_LINE_TOP),
                width: pct(FIELD_WIDTH, "x"),
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

function useDemoNotes(active, speedMul = 1) {
    const [notes, setNotes] = useState([])

    useEffect(() => {
        if (!active) {
            setNotes([])
            return undefined
        }

        let id = 0
        const spawn = () => {
            const lane = Math.floor(Math.random() * LANE_COUNT)
            const isDecoy = Math.random() < 0.18
            const img = isDecoy
                ? DECOY_IMGS[Math.floor(Math.random() * DECOY_IMGS.length)]
                : NOTE_IMGS[lane]
            const duration = (2.6 + Math.random() * 1.1) / speedMul
            const note = { id: ++id, lane, img, isDecoy, duration }
            setNotes((prev) => [...prev.slice(-18), note])
            window.setTimeout(() => {
                setNotes((prev) => prev.filter((n) => n.id !== note.id))
            }, duration * 1000)
        }

        spawn()
        const timer = window.setInterval(spawn, 700 / speedMul)
        return () => window.clearInterval(timer)
    }, [active, speedMul])

    return notes
}

export default function PlayArea({
    active,
    secondsLeft = 45,
    score = 0,
    speedMul = 1,
    onKeyPress,
    onNoteOn,
    onNoteOff
}) {
    const notes = useDemoNotes(active, speedMul)

    /* The keybed owns its own pressed visuals; the game only needs the events.
       Black keys carry no lane, so lane-based scoring ignores them. */
    const handleNoteOn = (note, info) => {
        onNoteOn?.(note, info)
        if (info.lane != null) onKeyPress?.(info.lane, note, info)
    }
    const handleNoteOff = (note, info) => onNoteOff?.(note, info)

    const noteWidth = LANE_W * 0.55

    return (
        <div style={{ position: "absolute", inset: 0 }}>
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
                    <span style={{ ...anton, fontSize: cqw(26), color: "#D8F0FF" }}>Time</span>
                    <span
                        style={{
                            ...anton,
                            fontSize: cqw(48),
                            color: "#FFFFFF",
                            marginTop: 2,
                            textShadow: "0 0 14px rgba(0,210,255,0.55)"
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
                    <span style={{ ...anton, fontSize: cqw(26), color: "#FFE7A0" }}>Score</span>
                    <span
                        style={{
                            ...anton,
                            fontSize: cqw(48),
                            color: "#FFFFFF",
                            marginTop: 2,
                            textShadow: "0 0 14px rgba(255,183,3,0.45)"
                        }}
                    >
                        {score}
                    </span>
                </div>
            </div>

            {/* 4 vertical neon rails → 5 equal lanes */}
            {Array.from({ length: LANE_COUNT - 1 }, (_, i) => (
                <NeonDivider key={i} x={laneEdge(i + 1)} />
            ))}

            <NeonHitLine />

            {/* Falling notes centered on lane centers */}
            <AnimatePresence>
                {notes.map((note) => {
                    const left = laneCenter(note.lane) - noteWidth / 2
                    return (
                        <motion.img
                            key={note.id}
                            src={note.img}
                            alt=""
                            draggable={false}
                            initial={{ top: pct(DIVIDER_TOP), opacity: 0.25 }}
                            animate={{ top: pct(HIT_LINE_TOP - 40), opacity: 1 }}
                            exit={{ opacity: 0, scale: 0.55 }}
                            transition={{ duration: note.duration, ease: "linear" }}
                            style={{
                                position: "absolute",
                                left: pct(left, "x"),
                                width: pct(noteWidth, "x"),
                                height: "auto",
                                zIndex: 5,
                                pointerEvents: "none",
                                filter: note.isDecoy
                                    ? "drop-shadow(0 0 10px rgba(255,0,120,0.55))"
                                    : "drop-shadow(0 0 14px rgba(0,210,255,0.45))"
                            }}
                        />
                    )
                })}
            </AnimatePresence>

            <div
                style={{
                    position: "absolute",
                    left: pct(PIANO_LEFT, "x"),
                    top: pct(PIANO_TOP),
                    width: pct(PIANO_WIDTH, "x"),
                    zIndex: 7
                }}
            >
                <Piano onNoteOn={handleNoteOn} onNoteOff={handleNoteOff} />
            </div>
        </div>
    )
}
