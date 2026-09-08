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
import { anton, cqw, FRAME_H, FRAME_W, NEON_GLOW, oswald, pct } from "./frame"

const LANE_COUNT = 5
const NOTE_IMGS = [yellow, green, pink, blue, purple]
const DECOY_IMGS = [decoySquare, decoyTriangle, decoyStar]

/**
 * Native canvas size + measured note-head width (opaque square/shape at bottom).
 * Pink/blue exports have huge side padding, so we scale by headW — not canvas W —
 * so every lane shows the same on-screen head size.
 */
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

/** Display width of the full PNG so its measured head equals `headTarget`. */
function noteDisplayWidth(img, headTarget) {
    const native = NOTE_NATIVE.get(img)
    if (!native) return headTarget
    return headTarget * (native.w / native.headW)
}

/**
 * Unified play-field geometry (design px on 1513×2678).
 * Vertical rails sit on black-key centers and run from the top of the stage
 * down to the hit line; white-key centers define note lanes.
 */
const FIELD_MARGIN = 72
const FIELD_LEFT = FIELD_MARGIN
const FIELD_WIDTH = FRAME_W - FIELD_MARGIN * 2

/** Piano box slightly narrower than the field, centered. */
const PIANO_FIELD_INSET = 58
const PIANO_WIDTH = FIELD_WIDTH - PIANO_FIELD_INSET * 2
const PIANO_LEFT = FIELD_LEFT + PIANO_FIELD_INSET
const PIANO_BOTTOM = 220
const PIANO_SCALE = PIANO_WIDTH / PIANO_SPEC.frameW
const PIANO_HEIGHT = PIANO_SPEC.frameH * PIANO_SCALE
const PIANO_TOP = FRAME_H - PIANO_BOTTOM - PIANO_HEIGHT

/** Hit line sits just above the piano frame — same width as the piano. */
const HIT_LINE_THICKNESS = 15
const HIT_LINE_TOP = PIANO_TOP - 22

/**
 * Map a keybed X (unscaled frame px) into design-frame X.
 * Keys live at left: padX inside the chassis.
 */
const bedX = (xInKeys) => PIANO_LEFT + (PIANO_SPEC.padX + xInKeys) * PIANO_SCALE

/** 4 black-key centers → vertical neon rails */
const BLACK_CENTERS = Array.from({ length: 4 }, (_, i) => {
    const leftInKeys = PIANO_SPEC.pitch * (i + 1) - PIANO_SPEC.blackOffset
    return bedX(leftInKeys + PIANO_SPEC.blackW / 2)
})

/** 5 white-key centers → falling-note lanes */
const WHITE_CENTERS = Array.from({ length: LANE_COUNT }, (_, i) =>
    bedX(PIANO_SPEC.pitch * i + PIANO_SPEC.whiteW / 2)
)

const LANE_W =
    WHITE_CENTERS.length > 1 ? WHITE_CENTERS[1] - WHITE_CENTERS[0] : FIELD_WIDTH / LANE_COUNT

/** Rails: full stage top → hit line */
const DIVIDER_TOP = 0
const DIVIDER_HEIGHT = HIT_LINE_TOP - DIVIDER_TOP
const DIVIDER_WIDTH = 3

function laneCenter(i) {
    return WHITE_CENTERS[i]
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
            // Color is independent of lane — any note can fall in any column.
            const img = isDecoy
                ? DECOY_IMGS[Math.floor(Math.random() * DECOY_IMGS.length)]
                : NOTE_IMGS[Math.floor(Math.random() * NOTE_IMGS.length)]
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
    secondsLeft = 4,
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

    /* Same on-screen head size for every color.
       Sized so the most padded export (pink) still fits in a lane. */
    const headTarget = LANE_W * 0.38

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

            {/* 4 neon rails on black-key centers, top → hit line */}
            {BLACK_CENTERS.map((x, i) => (
                <NeonDivider key={i} x={x} />
            ))}

            <NeonHitLine />

            {/* Falling notes — equal head size; any color in any lane. */}
            <AnimatePresence>
                {notes.map((note) => {
                    const native = NOTE_NATIVE.get(note.img) ?? { w: 1, h: 1, headW: 1 }
                    const width = noteDisplayWidth(note.img, headTarget)
                    const left = laneCenter(note.lane) - width / 2
                    const endBottom = FRAME_H - HIT_LINE_TOP
                    return (
                        <motion.img
                            key={note.id}
                            src={note.img}
                            alt=""
                            draggable={false}
                            initial={{ bottom: pct(FRAME_H + 500) }}
                            animate={{ bottom: pct(endBottom) }}
                            exit={{ opacity: 0 }}
                            transition={{
                                bottom: { duration: note.duration, ease: "linear" },
                                opacity: { duration: 0.1 }
                            }}
                            style={{
                                position: "absolute",
                                left: pct(left, "x"),
                                top: "auto",
                                width: pct(width, "x"),
                                height: "auto",
                                aspectRatio: `${native.w} / ${native.h}`,
                                objectFit: "contain",
                                objectPosition: "center bottom",
                                zIndex: 5,
                                pointerEvents: "none",
                                opacity: 1,
                                filter: note.isDecoy
                                    ? "drop-shadow(0 0 18px rgba(255,40,140,0.9)) brightness(1.1)"
                                    : "drop-shadow(0 0 20px rgba(255,210,80,0.7)) brightness(1.12)"
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
