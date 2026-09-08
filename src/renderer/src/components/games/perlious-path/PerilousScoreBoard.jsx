import { motion } from "framer-motion"
import { COLORS } from "./theme"

import statsPanelFrame from "../../../assets/perilous_path/perilous_result_board.png"
import titleBarFrame from "../../../assets/perilous_path/perilous_result_title.png"
import trophy from "../../../assets/perilous_path/trophy.png"
import direction from "../../../assets/perilous_path/direction.png"
import coin from "../../../assets/perilous_path/coin.png"
import PerilousButton from "./PerilousButton"

const LAYOUT = {
    title: { left: 11, top: 11, width: 78 },
    panel: { left: 13, top: 29, width: 74, height: 42 },
}

// Three evenly-spaced row centers inside the panel (top 24%, mid 51%, bot 78%)
const ROW_CENTERS = [24, 51, 78]

const ICON_BOX = { left: 13, width: 20 }
const LABEL_BOX = { left: 39, width: 54 }

function StatRow({ icon, label, value, centerPercent, delay = 0 }) {
    return (
        <motion.div
            className="absolute left-0 w-full -translate-y-1/2 text-white"
            style={{ top: `${centerPercent}%` }}
            initial={{ opacity: 0, x: -25, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 350, damping: 22, delay }}
        >
            <div className="relative flex items-center">
                <div
                    className="relative aspect-square shrink-0"
                    style={{ marginLeft: `${ICON_BOX.left}%`, width: `${ICON_BOX.width}%` }}
                >
                    <motion.img
                        src={icon}
                        alt=""
                        className="absolute inset-0 m-auto max-h-[85%] max-w-[85%] object-contain"
                        draggable={false}
                        animate={{ scale: [1, 1.08, 1], rotate: [0, 2, -2, 0] }}
                        transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut", delay }}
                    />
                </div>

                <div
                    style={{
                        marginLeft: `${LABEL_BOX.left - ICON_BOX.left - ICON_BOX.width}%`,
                        width: `${LABEL_BOX.width}%`,
                    }}
                >
                    <div className="font-anton font-bold text-[#FFB703] text-[2.4cqw] line-clamp-1" style={{ lineHeight: 1.2 }}>
                        {label}
                    </div>
                    <motion.div
                        className="font-anton font-extrabold text-white text-[3.8cqw]"
                        style={{ lineHeight: 1.2 }}
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: delay + 0.1, type: "spring", stiffness: 400 }}
                    >
                        {value}
                    </motion.div>
                </div>
            </div>
        </motion.div>
    )
}

/**
 * PerilousScoreBoard
 * Final results screen — shown once after POST /game/complete resolves.
 * Displays total_points, total_neuro_arcs (NeuroCoins), and best_streak
 * from the game/complete response.
 */
export default function PerilousScoreBoard({ result, onNext }) {
    const handleNext = onNext ?? (() => console.log("Next tapped — no onNext handler wired up"))

    const stats = [
        {
            key: "points",
            icon: trophy,
            label: "Total Points",
            value: result ? result.total_points : "—",
        },
        {
            key: "neurocoins",
            icon: coin,
            label: "NeuroCoins",
            value: result ? result.total_neuro_arcs : "—",
        },
        {
            key: "streak",
            icon: direction,
            label: "Best Consecutive Run",
            value: result ? result.best_streak : "—",
        },
    ]

    return (
        <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            {/* Title with spring entrance */}
            <motion.div
                className="absolute"
                style={{ left: `${LAYOUT.title.left}%`, top: `${LAYOUT.title.top}%`, width: `${LAYOUT.title.width}%` }}
                initial={{ y: -35, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 350, damping: 20 }}
            >
                <img src={titleBarFrame} alt="" className="w-full" draggable={false} />
                <div className="absolute inset-0 flex items-center justify-center">
                    <span
                        className="font-anton font-extrabold uppercase tracking-wide text-white text-[5cqw]"
                        style={{ textShadow: `0 0 18px ${COLORS.danger}, 0 0 36px ${COLORS.magenta}` }}
                    >
                        Results
                    </span>
                </div>
            </motion.div>

            {/* Stats panel with smooth pop-in */}
            <motion.div
                className="absolute"
                style={{
                    left: `${LAYOUT.panel.left}%`,
                    top: `${LAYOUT.panel.top}%`,
                    width: `${LAYOUT.panel.width}%`,
                    height: `${LAYOUT.panel.height}%`,
                }}
                initial={{ scale: 0.92, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.1 }}
            >
                <img
                    src={statsPanelFrame}
                    alt=""
                    className="absolute inset-0 h-full w-full"
                    style={{ objectFit: "fill" }}
                    draggable={false}
                />
                {stats.map((stat, i) => (
                    <StatRow
                        key={stat.key}
                        {...stat}
                        centerPercent={ROW_CENTERS[i]}
                        delay={0.25 + i * 0.15}
                    />
                ))}
            </motion.div>

            {/* Next Button with fade-up entrance */}
            <motion.div
                className="absolute left-[23%] top-[80%] w-[54%]"
                initial={{ y: 25, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.65, duration: 0.35 }}
            >
                <PerilousButton
                    title="Next"
                    className="w-full text-white"
                    onClick={handleNext}
                />
            </motion.div>
        </motion.div>
    )
}
