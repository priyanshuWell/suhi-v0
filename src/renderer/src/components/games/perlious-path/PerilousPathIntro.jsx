import PropTypes from "prop-types"
import { useState } from "react"
import { motion } from "framer-motion"
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

export default function PerilousPathIntro({ onStart }) {
    const [starting, setStarting] = useState(false)

    const handleStart = () => {
        if (starting) return
        setStarting(true)
        onStart?.()
    }

    return (
        <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
        >
            {/* Logo with smooth spring entrance */}
            <motion.img
                src={logo}
                alt="Perilous Path"
                className="absolute left-[29.8%] top-[2.6%] w-[40.4%] select-none"
                draggable={false}
                initial={{ y: -30, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 350, damping: 20 }}
            />

            {/* Instruction container panel */}
            <motion.div
                className="absolute left-[6%] top-[18.9%] h-[64.2%] w-[88%]"
                initial={{ y: 25, opacity: 0, scale: 0.96 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.1 }}
            >
                <img
                    src={titleBarFrame}
                    alt=""
                    className="absolute inset-0 h-full w-full"
                    style={{ objectFit: "fill" }}
                    draggable={false}
                />

                {/* How to Play Header */}
                <div className="absolute left-[5.7%] top-[-3%] w-[90.5%]">
                    <img src={howToPlayFrame} alt="" className="w-full" draggable={false} />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-anton text-[4.6cqw] leading-none text-white tracking-wide">
                            How to Play?
                        </span>
                    </div>
                </div>

                {STEPS.map((step, idx) => (
                    <motion.div
                        key={step.number}
                        className="absolute inset-x-0"
                        style={{ top: `${step.top}%` }}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.2 + idx * 0.12, ease: "easeOut" }}
                    >
                        {/* Board preview illustration */}
                        <motion.img
                            src={step.board}
                            alt=""
                            className="absolute left-[12.8%] top-0 w-[32.6%]"
                            draggable={false}
                            whileHover={{ scale: 1.05 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        />

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
                    </motion.div>
                ))}
            </motion.div>

            {/* Start Button */}
            <motion.div
                className="absolute left-[23.2%] top-[83.8%] w-[55%]"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.45, duration: 0.3 }}
            >
                <PerilousButton
                    title={starting ? "Starting…" : "Start Game"}
                    onClick={handleStart}
                    disabled={starting}
                    titleColor={COLORS.cyan}
                    className="w-full"
                />
            </motion.div>

            <style>{`
                .step-copy em { color: ${COLORS.cyan}; font-style: normal; }
                .step-copy strong { color: ${COLORS.magenta}; }
                .step-copy mark { color: ${COLORS.danger}; background: none; }
            `}</style>
        </motion.div>
    )
}

PerilousPathIntro.propTypes = {
    onStart: PropTypes.func,
}
