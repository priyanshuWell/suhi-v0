import { motion } from "framer-motion"
import { anton, cqw, pct } from "./frame"

import startBox from "../../../assets/beat-drop/intro/start_button_box.png"
import howToPlayBox from "../../../assets/beat-drop/intro/how_to_play_button_box.png"
import gotItBox from "../../../assets/beat-drop/popup/gotIt_button_box.png"
import nextBox from "../../../assets/beat-drop/result/next_button_box.png"

const BOX = {
    start: startBox,
    howToPlay: howToPlayBox,
    gotIt: gotItBox,
    next: nextBox
}

/** Native pixel size of every pill asset (do not stretch). */
const BOX_NATIVE = {
    start: { w: 2170, h: 725 },
    howToPlay: { w: 2170, h: 725 },
    gotIt: { w: 2170, h: 725 },
    next: { w: 2170, h: 725 }
}

/**
 * Pill button: asset chrome at native aspect ratio + Anton label.
 *
 * Scale animation is applied on an INNER wrapper so CSS `transform`
 * (e.g. translateX(-50%) for centering) on the button is never overwritten
 * by framer-motion — that was causing Got it to slide right on click.
 */
export default function PillButton({
    variant = "start",
    label,
    textColor = "#390500",
    fontSize = 64,
    onClick,
    left,
    top,
    width,
    style,
    labelStyle
}) {
    const native = BOX_NATIVE[variant]
    const height = width != null ? (width * native.h) / native.w : undefined

    const boxStyle =
        left != null && top != null && width != null
            ? {
                  left: pct(left, "x"),
                  top: pct(top, "y"),
                  width: pct(width, "x"),
                  height: pct(height, "y")
              }
            : {}

    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                position: "absolute",
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
                ...boxStyle,
                ...style
            }}
        >
            <motion.span
                whileTap={{ scale: 0.97 }}
                whileHover={{ scale: 1.015 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: "100%"
                }}
            >
                <img
                    src={BOX[variant]}
                    alt=""
                    draggable={false}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        objectPosition: "center",
                        pointerEvents: "none"
                    }}
                />
                <span
                    style={{
                        position: "relative",
                        zIndex: 1,
                        ...anton,
                        fontSize: cqw(fontSize),
                        color: textColor,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        ...labelStyle
                    }}
                >
                    {label}
                </span>
            </motion.span>
        </button>
    )
}

export function absBox({ left, top, width, height }) {
    return {
        left: pct(left, "x"),
        top: pct(top, "y"),
        width: pct(width, "x"),
        height: pct(height, "y")
    }
}

export function pillHeight(variant, width) {
    const native = BOX_NATIVE[variant]
    return (width * native.h) / native.w
}
