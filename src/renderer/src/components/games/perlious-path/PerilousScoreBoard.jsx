import { COLORS } from "./theme"

import statsPanelFrame from "../../../assets/perilous_path/perilous_result_board.png"
import titleBarFrame from "../../../assets/perilous_path/perilous_result_title.png"
import PerilousButton from "./PerilousButton"

const LAYOUT = {
    title: { left: 11, top: 11, width: 78 },
    panel: { left: 13, top: 29, width: 74, height: 42 },
}

// The original design's 3-row panel used centers at 24/51/78 (top pad 24%,
// bottom pad 22%, evenly spaced in between). Generalized here so the same
// panel art can host any row count — still lands exactly on 24/51/78 when
// count === 3.
function rowCenters(count) {
    if (count <= 1) return [51]
    const top = 24
    const bottom = 78
    return Array.from({ length: count }, (_, i) => top + ((bottom - top) * i) / (count - 1))
}

const ICON_BOX = { left: 13, width: 20 }
const LABEL_BOX = { left: 39, width: 54 }

// Shown only if `result` hasn't arrived yet — shouldn't normally happen,
// since the parent only renders this screen once /game/complete resolves.
const FALLBACK_STATS = [{ key: "loading", icon: "⏳", label: "Results", value: "Calculating…" }]

const CONSTRUCT_ORDER = ["recall", "working_memory", "spatial_sequencing", "processing_speed", "sustained_attention"]

const CONSTRUCT_DISPLAY = {
    recall: { icon: "🧠", label: "Recall" },
    working_memory: { icon: "🧩", label: "Working Memory" },
    spatial_sequencing: { icon: "🧭", label: "Spatial Sequencing" },
    processing_speed: { icon: "⚡", label: "Processing Speed" },
    sustained_attention: { icon: "🎯", label: "Sustained Attention" },
}

function buildStatsFromResult(result) {
    return CONSTRUCT_ORDER.map((key) => {
        const construct = result[key]
        const display = CONSTRUCT_DISPLAY[key]
        return {
            key,
            icon: display.icon,
            label: display.label,
            value: construct ? `${Math.round(construct.score_0_1 * 100)}% · ${construct.band}` : "—",
        }
    })
}

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
 * Final results screen — shown once, after POST /game/complete resolves
 * (NOT between individual levels). `result` is that endpoint's response:
 * the 5 cognitive construct scores plus run totals.
 *
 * NOTE: statsPanelFrame's art was originally designed for a 3-row layout.
 * Rendering all 5 constructs here stretches the same frame over 5 evenly
 * spaced rows — it will likely want a taller/redesigned panel asset from
 * design; flagging this rather than guessing at new artwork.
 *
 * Also renamed the CTA from "Next" to "Play Again", since it calls
 * `onNext` -> the parent's restart handler, which goes all the way back to
 * the intro screen (there's no "next level" concept here anymore — that's
 * driven entirely by the /next-grid loop before this screen is ever
 * shown). Confirm this is the intended end-of-run behavior.
 *
 * Props:
 *  - result: the POST /game/complete response.
 *  - onNext: called when the button is tapped (restarts the run).
 */
export default function PerilousScoreBoard({ result, onNext }) {
    const stats = result ? buildStatsFromResult(result) : FALLBACK_STATS
    const centers = rowCenters(stats.length)
    const handleNext = onNext ?? (() => console.log("Play Again tapped — no onNext handler wired up"))

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
                    <StatRow key={stat.key} {...stat} centerPercent={centers[i]} />
                ))}
            </div>

            {result && (
                <p className="absolute left-0 top-[74%] w-full text-center text-xs text-white/80">
                    {result.total_points} pts · {result.total_neuro_arcs} NeuroArcs · best streak {result.best_streak}
                </p>
            )}

            <PerilousButton
                title="Play Again"
                className="absolute left-[23%] top-[80%] w-[54%] text-white"
                onClick={handleNext}
            />
        </div>
    )
}
