import { motion } from "framer-motion"
import bg from "../../../assets/beat-drop/playArea/play_area_bg_card.png"
import resultText from "../../../assets/beat-drop/result/result_text.png"
import scoreCard from "../../../assets/beat-drop/result/score_star_card.png"
import neuroCard from "../../../assets/beat-drop/result/neuro_arc_card_blank.png"
import neuroIcon from "../../../assets/beat-drop/result/neuro_arc_icon.png"
import fireCard from "../../../assets/beat-drop/result/fire_card.png"
import PillButton from "./PillButton"
import { anton, cqw, pct } from "./frame"

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
                    pointerEvents: "none",
                    filter: "brightness(0.85)"
                }}
            />

            {/* Soft spotlight wash */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background:
                        "radial-gradient(ellipse at 50% 42%, rgba(255,220,120,0.18) 0%, transparent 55%)",
                    pointerEvents: "none"
                }}
            />

            <motion.img
                src={resultText}
                alt="Results"
                draggable={false}
                initial={{ y: -30, opacity: 0, scale: 0.92 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 18 }}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: pct(280),
                    width: pct(980, "x"),
                    transform: "translateX(-50%)",
                    objectFit: "contain",
                    pointerEvents: "none",
                    filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.55))"
                }}
            />

            <div
                style={{
                    position: "absolute",
                    left: pct(90, "x"),
                    right: pct(90, "x"),
                    top: pct(1180),
                    height: pct(520),
                    display: "flex",
                    justifyContent: "space-between",
                    gap: pct(36, "x")
                }}
            >
                {cards.map((card, i) => (
                    <motion.div
                        key={card.key}
                        initial={{ opacity: 0, y: 40, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 200 }}
                        style={{
                            position: "relative",
                            flex: 1,
                            height: "100%"
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
                                pointerEvents: "none"
                            }}
                        />
                        {card.icon && (
                            <img
                                src={card.icon}
                                alt=""
                                draggable={false}
                                style={{
                                    position: "absolute",
                                    top: "14%",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    width: "34%",
                                    objectFit: "contain",
                                    pointerEvents: "none",
                                    zIndex: 2
                                }}
                            />
                        )}
                        <div
                            style={{
                                position: "absolute",
                                left: 0,
                                right: 0,
                                bottom: "12%",
                                textAlign: "center",
                                zIndex: 2
                            }}
                        >
                            <div
                                style={{
                                    ...anton,
                                    fontSize: cqw(26),
                                    color: "#B8E9FF",
                                    marginBottom: 6
                                }}
                            >
                                {card.label}
                            </div>
                            <div
                                style={{
                                    ...anton,
                                    fontSize: cqw(56),
                                    color: "#FFFFFF",
                                    textShadow: "0 0 16px rgba(242,241,79,0.4)"
                                }}
                            >
                                {card.value}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            >
                <PillButton
                    variant="next"
                    label="Next"
                    textColor="#390500"
                    fontSize={64}
                    onClick={onNext}
                    left={362}
                    top={2050}
                    width={750}
                    style={{ pointerEvents: "auto" }}
                />
            </motion.div>
        </div>
    )
}
