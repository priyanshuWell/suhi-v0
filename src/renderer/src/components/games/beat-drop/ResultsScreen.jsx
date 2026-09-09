import { motion } from "framer-motion"
import bg from "../../../assets/beat-drop/result/result_card_bg.png"
import resultText from "../../../assets/beat-drop/result/result_text.png"
import scoreCard from "../../../assets/beat-drop/result/score_star_card.png"
import neuroCard from "../../../assets/beat-drop/result/neuro_arc_card_blank.png"
import neuroIcon from "../../../assets/beat-drop/result/neuro_arc_icon.png"
import fireCard from "../../../assets/beat-drop/result/fire_card.png"
import PillButton from "./PillButton"
import { anton, cqw, FRAME_W, oswald, pct } from "./frame"

/** Equal left / between / right gutters. */
const CARD_GUTTER = 44
const CARD_GAP = 32
const CARD_ART_W = 1024
const CARD_ART_H = 1536
/** Previous top 1330 + 50px toward bottom. */
const CARD_TOP = 1380

const TITLE_W = 980
const TITLE_TOP = 200

const NEXT_W = 780
const NEXT_LEFT = (FRAME_W - NEXT_W) / 2
const NEXT_TOP = 2330

/**
 * Icon / text zones from card PNGs (1024×1536):
 *  - circle center ≈ 50% × 28.5% (+8px down for NeuroArc coin)
 *  - bottom inset ≈ 68% → 90%
 */
const ICON_CENTER_Y = "calc(28.5% + 22px)"
const ICON_WIDTH = "56%"
const LABEL_TOP = "52%"
const PANEL_TOP = "69%"
const PANEL_BOTTOM = "8%"

function StatCard({ card, index }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
                delay: 0.18 + index * 0.12,
                type: "spring",
                stiffness: 200,
                damping: 20
            }}
            style={{
                position: "relative",
                flex: "1 1 0",
                minWidth: 0,
                aspectRatio: `${CARD_ART_W} / ${CARD_ART_H}`
            }}
        >
            <img
                src={card.bg}
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

            {/* NeuroArc coin — dead-center of the neon ring (matches star/flame). */}
            {card.icon && (
                <img
                    src={card.icon}
                    alt=""
                    draggable={false}
                    style={{
                        position: "absolute",
                        top: ICON_CENTER_Y,
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: ICON_WIDTH,
                        aspectRatio: "1",
                        objectFit: "contain",
                        pointerEvents: "none",
                        zIndex: 2,
                        filter: "drop-shadow(0 0 22px rgba(180,80,255,0.65))"
                    }}
                />
            )}

            {/* Label — Oswald 700 / 48 / #FFB703 */}
            <div
                style={{
                    position: "absolute",
                    top: LABEL_TOP,
                    left: "6%",
                    right: "6%",
                    zIndex: 2,
                    pointerEvents: "none",
                    textAlign: "center"
                }}
            >
                <span
                    style={{
                        ...oswald,
                        display: "block",
                        fontSize: cqw(48),
                        color: "#FFB703",
                        lineHeight: "100%",
                        letterSpacing: "0%",
                        whiteSpace: "nowrap",
                        textShadow: "0 2px 10px rgba(0,0,0,0.55)"
                    }}
                >
                    {card.label}
                </span>
            </div>

            {/* Value — Anton 400 / 96 / #FFFFFF */}
            <div
                style={{
                    position: "absolute",
                    top: PANEL_TOP,
                    bottom: PANEL_BOTTOM,
                    left: "10%",
                    right: "10%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2,
                    pointerEvents: "none"
                }}
            >
                <span
                    style={{
                        ...anton,
                        fontSize: cqw(96),
                        color: "#FFFFFF",
                        lineHeight: "100%",
                        letterSpacing: "0%",
                        textAlign: "center",
                        textShadow: "0 0 16px rgba(255,255,255,0.28)"
                    }}
                >
                    {card.value}
                </span>
            </div>
        </motion.div>
    )
}

/**
 * Results — Figma: stage bg, crown title, 3 matched neon cards, Next.
 */
export default function ResultsScreen({
    score = 45660,
    coins = 500,
    streak = 10,
    onNext
}) {
    const cards = [
        {
            key: "score",
            bg: scoreCard,
            label: "Score",
            value: String(score),
            icon: null
        },
        {
            key: "coins",
            bg: neuroCard,
            label: "NeuroArc Coins",
            value: `+${coins}`,
            icon: neuroIcon
        },
        {
            key: "streak",
            bg: fireCard,
            label: "Longest Streak",
            value: String(streak),
            icon: null
        }
    ]

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
                    objectPosition: "center",
                    pointerEvents: "none"
                }}
            />

            <motion.img
                src={resultText}
                alt="Results"
                draggable={false}
                initial={{ y: -36, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 18 }}
                style={{
                    position: "absolute",
                    left: pct((FRAME_W - TITLE_W) / 2, "x"),
                    top: pct(TITLE_TOP),
                    width: pct(TITLE_W, "x"),
                    height: "auto",
                    aspectRatio: "1899 / 828",
                    objectFit: "contain",
                    pointerEvents: "none",
                    filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.55))",
                    zIndex: 4
                }}
            />

            <div
                style={{
                    position: "absolute",
                    left: pct(CARD_GUTTER, "x"),
                    right: pct(CARD_GUTTER, "x"),
                    top: pct(CARD_TOP),
                    display: "flex",
                    alignItems: "stretch",
                    gap: pct(CARD_GAP, "x"),
                    zIndex: 5
                }}
            >
                {cards.map((card, i) => (
                    <StatCard key={card.key} card={card} index={i} />
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6 }}
            >
                <PillButton
                    variant="next"
                    label="Next"
                    textColor="#390500"
                    fontSize={64}
                    onClick={onNext}
                    left={NEXT_LEFT}
                    top={NEXT_TOP}
                    width={NEXT_W}
                    style={{ pointerEvents: "auto" }}
                />
            </motion.div>
        </div>
    )
}
