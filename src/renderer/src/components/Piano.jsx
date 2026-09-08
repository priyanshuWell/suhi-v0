import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import whiteKey from "../assets/piano/white_key_normal.png"
import whiteKeyPressed from "../assets/piano/white_key_pressed.png"
import blackKey from "../assets/piano/black_key.png"
import { PIANO_SPEC } from "./pianoSpec"
import "./Piano.css"

const WHITE_NOTES = ["C4", "D4", "E4", "F4", "G4"]
const BLACK_NOTES = ["C#4", "D#4", "F#4", "G#4"] // one after each of white 0..3

/** Keyboard bindings — one per white key. */
const KEY_BINDINGS = { a: 0, s: 1, d: 2, f: 3, g: 4 }

/**
 * Piano keybed.
 *
 * Renders the bed at exact spec pixels and scales it as a single unit, so a
 * measurement at scale 1 returns the spec numbers with no rounding drift.
 *
 * Only the five white keys are playable. The black keys are decoration and are
 * pointer-transparent, so pressing the strip of a white key that sits under a
 * black key still registers as that white key.
 *
 * @param width   chassis width in CSS px. Omit to fill the parent's width.
 * @param onNoteOn  (note, {type, index, lane, source}) => void
 * @param onNoteOff (note, {type, index, lane, source}) => void
 * @param debug   overlay the measurement guides
 */
export default function Piano({
    width,
    onNoteOn,
    onNoteOff,
    debug = false,
    className = "",
    style
}) {
    const rootRef = useRef(null)
    const keysRef = useRef(null)
    /** Notes currently held, so a key can't retrigger while down. */
    const heldRef = useRef(new Set())
    const [scale, setScale] = useState(width ? width / PIANO_SPEC.frameW : 0)

    /* Scale off the element's own measured width, so the bed fits a fluid stage
       and still reports exact spec pixels when handed a concrete width. The
       outer width never depends on the scale, so there is no feedback loop. */
    useLayoutEffect(() => {
        const el = rootRef.current
        if (!el) return undefined
        const measure = () => {
            const w = el.clientWidth
            if (w > 0) setScale(w / PIANO_SPEC.frameW)
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [width])

    const meta = useCallback(
        (index, source) => ({
            type: "white",
            index,
            /** Beat Drop lanes map 1:1 onto the white keys. */
            lane: index,
            source
        }),
        []
    )

    const press = useCallback(
        (index, source) => {
            const note = WHITE_NOTES[index]
            if (note == null || heldRef.current.has(note)) return
            heldRef.current.add(note)
            keysRef.current?.querySelector(`[data-index="${index}"]`)?.classList.add("is-on")
            onNoteOn?.(note, meta(index, source))
        },
        [meta, onNoteOn]
    )

    const release = useCallback(
        (index, source) => {
            const note = WHITE_NOTES[index]
            if (note == null || !heldRef.current.has(note)) return
            heldRef.current.delete(note)
            keysRef.current?.querySelector(`[data-index="${index}"]`)?.classList.remove("is-on")
            onNoteOff?.(note, meta(index, source))
        },
        [meta, onNoteOff]
    )

    /** Physical keyboard, mirroring the pointer path. */
    useEffect(() => {
        const down = (e) => {
            const lane = KEY_BINDINGS[e.key?.toLowerCase()]
            if (lane != null && !e.repeat) press(lane, "keyboard")
        }
        const up = (e) => {
            const lane = KEY_BINDINGS[e.key?.toLowerCase()]
            if (lane != null) release(lane, "keyboard")
        }
        window.addEventListener("keydown", down)
        window.addEventListener("keyup", up)
        return () => {
            window.removeEventListener("keydown", down)
            window.removeEventListener("keyup", up)
        }
    }, [press, release])

    /** Any note still held when the bed unmounts must be released. */
    useEffect(
        () => () => {
            heldRef.current.clear()
        },
        []
    )

    const keyProps = (index) => ({
        "data-index": index,
        onPointerDown: (e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId)
            press(index, "pointer")
        },
        onPointerUp: () => release(index, "pointer"),
        onPointerCancel: () => release(index, "pointer"),
        onContextMenu: (e) => e.preventDefault()
    })

    return (
        <div
            ref={rootRef}
            className={`piano ${className}`.trim()}
            style={{
                width: width != null ? `${width}px` : "100%",
                height: scale ? `${PIANO_SPEC.frameH * scale}px` : undefined,
                "--piano-scale": scale,
                "--img-white": `url(${whiteKey})`,
                "--img-white-pressed": `url(${whiteKeyPressed})`,
                "--img-black": `url(${blackKey})`,
                ...style
            }}
        >
            <div className="piano__frame">
                {/* whites first so the blacks paint over them; z-index makes it explicit */}
                <div className="piano__keys" ref={keysRef}>
                    {WHITE_NOTES.map((note, i) => (
                        <button
                            key={note}
                            type="button"
                            aria-label={note}
                            className="piano__key piano__key--white"
                            style={{ left: `calc(var(--pitch) * ${i})` }}
                            {...keyProps(i)}
                        >
                            <span className="piano__glow" />
                        </button>
                    ))}

                    {/* Decoration: no handlers, out of the a11y tree, and
                        pointer-transparent via CSS so presses reach the whites. */}
                    {BLACK_NOTES.map((note, i) => (
                        <div
                            key={note}
                            aria-hidden="true"
                            className="piano__key piano__key--black"
                            style={{
                                left: `calc(var(--pitch) * ${i + 1} - var(--bk-offset))`
                            }}
                        />
                    ))}
                </div>

                {debug && (
                    <div className="piano__guides">
                        {WHITE_NOTES.map((note, i) => (
                            <div key={note}>
                                <div
                                    className="piano__guide--white"
                                    style={{ left: `calc(var(--pitch) * ${i})` }}
                                />
                                <div
                                    className="piano__guide--center"
                                    style={{
                                        left: `calc(var(--pitch) * ${i} + var(--wkw) / 2)`
                                    }}
                                />
                                <span
                                    className="piano__guide-label"
                                    style={{
                                        left: `calc(var(--pitch) * ${i} + var(--wkw) / 2)`
                                    }}
                                >
                                    {note}
                                </span>
                            </div>
                        ))}
                        {BLACK_NOTES.map((note, i) => (
                            <div
                                key={note}
                                className="piano__guide--black"
                                style={{
                                    left: `calc(var(--pitch) * ${i + 1} - var(--bk-offset))`
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
