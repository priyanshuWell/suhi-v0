import { motion } from "framer-motion"
import bg from "../../../assets/beat-drop/intro/Intro_beat_bg_card.png"
import logo from "../../../assets/beat-drop/intro/beat_drop_logo.png"
import cardFrame from "../../../assets/beat-drop/intro/1st_intro_card.png"
import htp1 from "../../../assets/beat-drop/intro/HTP_illustaration_1.png"
import htp2 from "../../../assets/beat-drop/intro/HTP_illustration_2.png"
import htp3 from "../../../assets/beat-drop/intro/HTP_illustration_3.png"
import PillButton, { absBox } from "./PillButton"
import { anton, cqw, pct } from "./frame"

/** Equal inset / gutter — left = between = right */
const CARD_GUTTER = 39

const HIGHLIGHT = "#FFB703"

/** Exact Figma line breaks + colors (line 1 white, rest #FFB703). */
const CARDS = [
    {
        img: htp1,
        lines: [
            { t: "Press the piano key that", c: "#FFFFFF" },
            { t: "matches", c: HIGHLIGHT },
            { t: "the falling note's", c: HIGHLIGHT },
            { t: "lane", c: HIGHLIGHT }
        ]
    },
    {
        img: htp2,
        lines: [
            { t: "Hit each note as it", c: "#FFFFFF" },
            { t: "reaches", c: HIGHLIGHT },
            { t: "the line at the", c: HIGHLIGHT },
            { t: "bottom", c: HIGHLIGHT }
        ]
    },
    {
        img: htp3,
        lines: [
            { t: "Keep accurate timing", c: "#FFFFFF" },
            { t: "to build combos, score", c: HIGHLIGHT },
            { t: "multipliers", c: HIGHLIGHT },
            { t: "and crowd energy", c: HIGHLIGHT }
        ]
    }
]

/**
 * Figma card layout (percent of card height):
 *  - badge ~ top 2%
 *  - illustration zone 14% → 58%  (keyboards align across cards)
 *  - small gap
 *  - text anchored near bottom with ~8% bottom padding
 */
function IntroCard({ card, index }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 + index * 0.1, duration: 0.5 }}
            style={{
                position: "relative",
                flex: "1 1 0",
                minWidth: 0,
                aspectRatio: "977 / 1609"
            }}
        >
            <img
                src={cardFrame}
                alt=""
                draggable={false}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    objectPosition: "center",
                    pointerEvents: "none",
                    zIndex: 0
                }}
            />

            {/* Step number — Oswald 700 / 48 / #FFB703 */}
            <div
                style={{
                    position: "absolute",
                    top: "1.8%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "20%",
                    aspectRatio: "1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2,
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 700,
                    fontStyle: "normal",
                    fontSize: cqw(48),
                    lineHeight: 1,
                    letterSpacing: "0%",
                    color: HIGHLIGHT
                }}
            >
                {index + 1}
            </div>

            {/* Illustration — fixed upper zone so all 3 pianos align */}
            <div
                style={{
                    position: "absolute",
                    left: "9%",
                    right: "9%",
                    top: "14%",
                    height: "44%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1
                }}
            >
                <img
                    src={card.img}
                    alt=""
                    draggable={false}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        objectPosition: "center",
                        pointerEvents: "none"
                    }}
                />
            </div>

            {/* Caption — exact Figma lines (1 white, rest gold) */}
            <div
                style={{
                    position: "absolute",
                    left: "9%",
                    right: "9%",
                    top: "62%",
                    bottom: "8%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    textAlign: "center",
                    zIndex: 1,
                    ...anton,
                    fontSize: cqw(32),
                    lineHeight: 1.12,
                    letterSpacing: "0.2px",
                    textShadow: "0 2px 8px rgba(0,0,0,0.65)"
                }}
            >
                {card.lines.map((line, i) => (
                    <span
                        key={i}
                        style={{
                            display: "block",
                            color: line.c,
                            width: "100%"
                        }}
                    >
                        {line.t}
                    </span>
                ))}
            </div>
        </motion.div>
    )
}

export default function IntroScreen({ onStart, highlightCards, pulseKey = 0 }) {
    return (
        <div style={{ position: "absolute", inset: 0 }}>
            <motion.img
                src={bg}
                alt=""
                draggable={false}
                initial={{ scale: 1.04, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    pointerEvents: "none"
                }}
            />

            <motion.img
                src={logo}
                alt="Beat Drop"
                draggable={false}
                initial={{ y: -36, opacity: 0, scale: 0.92 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 170, damping: 18 }}
                style={{
                    position: "absolute",
                    ...absBox({ left: 392, top: 90, width: 726, height: 500 }),
                    objectFit: "contain",
                    pointerEvents: "none",
                    filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.5))",
                    zIndex: 2
                }}
            />

            <PillButton
                variant="howToPlay"
                label="How to Play?"
                textColor="#FFFFFF"
                fontSize={64}
                onClick={highlightCards}
                left={309}
                top={780}
                width={892}
                style={{ zIndex: 3 }}
            />

            <motion.div
                key={pulseKey}
                animate={
                    pulseKey > 0 ? { scale: [1, 1.02, 1], y: [0, -6, 0] } : { scale: 1, y: 0 }
                }
                transition={{ duration: 0.5 }}
                style={{
                    position: "absolute",
                    left: pct(CARD_GUTTER, "x"),
                    right: pct(CARD_GUTTER, "x"),
                    top: pct(1120),
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: pct(CARD_GUTTER, "x"),
                    zIndex: 2
                }}
            >
                {CARDS.map((card, i) => (
                    <IntroCard key={i} card={card} index={i} />
                ))}
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.4 }}
                style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}
            >
                <PillButton
                    variant="start"
                    label="Start Game"
                    textColor="#390500"
                    fontSize={64}
                    onClick={onStart}
                    left={362}
                    top={2050}
                    width={750}
                    style={{
                        pointerEvents: "auto",
                        filter: "drop-shadow(0 0 22px rgba(255, 190, 40, 0.45))"
                    }}
                />
            </motion.div>
        </div>
    )
}
