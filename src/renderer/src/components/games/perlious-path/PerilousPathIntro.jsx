import PropTypes from "prop-types"
import { useState } from "react"
import { COLORS } from "./theme"

import howToPlayFrame from "../../../assets/perilous_path/how_to_Play_frame.png"
import dangerBoard from "../../../assets/perilous_path/perilous_intro_hazard.png"
import pathBoard from "../../../assets/perilous_path/perilous_intro_start.png"
import plainBoard from "../../../assets/perilous_path/perilous_intro_plain.png"
import logo from "../../../assets/perilous_path/perilous_logo.png"
import stepBadgeFrame from "../../../assets/perilous_path/perilous_start_button.png"
import titleBarFrame from "../../../assets/perilous_path/perilous_background_frame.png"
import PerilousButton from "./PerilousButton"

const STEPS = [
    {
        number: 1,
        title: "Complete the Path",
        board: plainBoard,
        top: 12,
        description: (
            <>
                Trace the path from
                <br />
                <em>Start</em> to <strong>End</strong>
            </>
        ),
    },
    {
        number: 2,
        title: "Remember Danger",
        board: dangerBoard,
        top: 40.1,
        description: (
            <>
                Some tiles are
                <br />
                <mark>dangerous,</mark>
                <br />
                Memorize their position
            </>
        ),
    },
    {
        number: 3,
        title: "Avoid & Complete",
        board: pathBoard,
        top: 70,
        description: (
            <>
                Avoid the danger tiles
                <br />
                and complete the path
                <br />
                to <strong>win!</strong>
            </>
        ),
    },
]

/**
 * The Perilous Path instructions screen. Its parent owns the shared 9:16
 * stage and background; this component renders only the screen overlays.
 *
 * There is no dedicated "start game" API call — per the integration guide,
 * the first POST /next-grid (made by the parent once it switches to the
 * game screen) is what actually creates the game session. This screen just
 * signals "go"; the `starting` flag below only guards against double-taps
 * while that transition happens.
 */
export default function PerilousPathIntro({ onStart }) {
    const [starting, setStarting] = useState(false)

    const handleStart = () => {
        if (starting) return
        setStarting(true)
        onStart?.()
    }

    return (
        <div className="absolute inset-0">
            <img
                src={logo}
                alt="Perilous Path"
                className="absolute left-[29.8%] top-[2.6%] w-[40.4%] select-none"
                draggable={false}
            />

            <div className="absolute left-[6%] top-[18.9%] h-[64.2%] w-[88%]">
                <img
                    src={titleBarFrame}
                    alt=""
                    className="absolute inset-0 h-full w-full"
                    style={{ objectFit: "fill" }}
                    draggable={false}
                />

                <div className="absolute left-[5.7%] top-[-3%] w-[90.5%]">
                    <img src={howToPlayFrame} alt="" className="w-full" draggable={false} />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-anton text-[4.6cqw] leading-none text-white">How to Play?</span>
                    </div>
                </div>

                {STEPS.map((step) => (
                    <div key={step.number} className="absolute inset-x-0" style={{ top: `${step.top}%` }}>
                        <img src={step.board} alt="" className="absolute left-[12.8%] top-0 w-[32.6%]" draggable={false} />

                        <div className="absolute left-[47.4%] top-[3.2cqh] w-[48%]">
                            <div className="flex items-center gap-[3.5%]">
                                <div className="relative aspect-square w-[13%] shrink-0">
                                    <img src={stepBadgeFrame} alt="" className="h-full w-full" draggable={false} />
                                    <span className="font-anton absolute inset-0 flex items-center justify-center text-[2.7cqw] leading-none text-white">
                                        {step.number}
                                    </span>
                                </div>

                                <h3
                                    className="font-anton whitespace-nowrap text-[3.25cqw] leading-none"
                                    style={{ color: COLORS.cyan }}
                                >
                                    {step.title}
                                </h3>
                            </div>

                            <p className="step-copy font-anton mt-[1.25cqh] ml-8 text-[3.05cqw] leading-[1.28] text-white">
                                {step.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <PerilousButton
                title={starting ? "Starting…" : "Start Game"}
                onClick={handleStart}
                disabled={starting}
                titleColor={COLORS.cyan}
                className="absolute left-[23.2%] top-[83.8%] w-[55%]"
            />

            <style>{`
                .step-copy em { color: ${COLORS.cyan}; font-style: normal; }
                .step-copy strong { color: ${COLORS.magenta}; }
                .step-copy mark { color: ${COLORS.danger}; background: none; }
            `}</style>
        </div>
    )
}

PerilousPathIntro.propTypes = {
    onStart: PropTypes.func,
}
