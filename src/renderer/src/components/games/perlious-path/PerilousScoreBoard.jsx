import { COLORS } from "./theme"

import statsPanelFrame from "../../../assets/perilous_path/perilous_result_board.png"
import titleBarFrame from "../../../assets/perilous_path/perilous_result_title.png"
import PerilousButton from "./PerilousButton"

const LAYOUT = {
    title: { left: 11, top: 11, width: 78 },
    panel: { left: 13, top: 29, width: 74, height: 42 },
}

// Three evenly-spaced row centers inside the panel (top 24%, mid 51%, bot 78%)
const ROW_CENTERS = [24, 51, 78]

const ICON_BOX = { left: 13, width: 20 }
const LABEL_BOX = { left: 39, width: 54 }

function StatRow({ icon, label, value, centerPercent }) {
    return (
        <div className="absolute left-0 w-full -translate-y-1/2 text-white" style={{ top: `${centerPercent}%` }}>
            <div className="relative flex items-center">
                <div
                    className="relative aspect-square shrink-0"
                    style={{ marginLeft: `${ICON_BOX.left}%`, width: `${ICON_BOX.width}%` }}
                >
                    <span className="absolute inset-0 flex items-center justify-center text-2xl">{icon}</span>
                </div>

                <div
                    style={{
                        marginLeft: `${LABEL_BOX.left - ICON_BOX.left - ICON_BOX.width}%`,
                        width: `${LABEL_BOX.width}%`,
                    }}
                >
                    <div className="font-bold text-[#FFB703] text-xs line-clamp-1" style={{ lineHeight: 1.2 }}>
                        {label}
                    </div>
                    <div className="font-extrabold text-white" style={{ fontSize: "3.6cqw", lineHeight: 1.2 }}>
                        {value}
                    </div>
                </div>
            </div>
        </div>
    )
}

/**
 * PerilousScoreBoard
 * Final results screen — shown once after POST /game/complete resolves.
 * Displays total_points, total_neuro_arcs (NeuroCoins), and best_streak
 * from the game/complete response.
 *
 * Props:
 *  - result: the POST /game/complete response.
 *  - onNext: called when the button is tapped (restarts the run).
 */
export default function PerilousScoreBoard({ result, onNext }) {
    const handleNext = onNext ?? (() => console.log("Play Again tapped — no onNext handler wired up"))

    const stats = [
        {
            key: "points",
            icon: "⭐",
            label: "Total Points",
            value: result ? result.total_points : "—",
        },
        {
            key: "neurocoins",
            icon: "🪙",
            label: "NeuroCoins",
            value: result ? result.total_neuro_arcs : "—",
        },
        {
            key: "streak",
            icon: "🔥",
            label: "Best Streak",
            value: result ? result.best_streak : "—",
        },
    ]

    return (
        <div className="absolute inset-0">
            {/* Title */}
            <div
                className="absolute"
                style={{ left: `${LAYOUT.title.left}%`, top: `${LAYOUT.title.top}%`, width: `${LAYOUT.title.width}%` }}
            >
                <img src={titleBarFrame} alt="" className="w-full" draggable={false} />
                <div className="absolute inset-0 flex items-center justify-center">
                    <span
                        className="font-extrabold uppercase tracking-wide text-white"
                        style={{ fontSize: "5cqw", textShadow: `0 0 18px ${COLORS.danger}, 0 0 36px ${COLORS.magenta}` }}
                    >
                        Results
                    </span>
                </div>
            </div>

            {/* Stats panel */}
            <div
                className="absolute"
                style={{
                    left: `${LAYOUT.panel.left}%`,
                    top: `${LAYOUT.panel.top}%`,
                    width: `${LAYOUT.panel.width}%`,
                    height: `${LAYOUT.panel.height}%`,
                }}
            >
                <img
                    src={statsPanelFrame}
                    alt=""
                    className="absolute inset-0 h-full w-full"
                    style={{ objectFit: "fill" }}
                    draggable={false}
                />
                {stats.map((stat, i) => (
                    <StatRow key={stat.key} {...stat} centerPercent={ROW_CENTERS[i]} />
                ))}
            </div>

            <PerilousButton
                title="Next"
                className="absolute left-[23%] top-[80%] w-[54%] text-white"
                onClick={handleNext}
            />
        </div>
    )
}
