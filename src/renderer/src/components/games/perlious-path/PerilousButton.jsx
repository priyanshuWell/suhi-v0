import { motion } from "framer-motion"
import panelFrame from "../../../assets/perilous_path/perilous_start_game_frame.png"

const PerilousButton = ({
    title,
    onClick,
    className = "",
    disabled = false,
    titleColor,
}) => {
    return (
        <motion.button
            type="button"
            onClick={onClick}
            disabled={disabled}
            whileHover={!disabled ? { scale: 1.03, filter: "brightness(1.1)" } : {}}
            whileTap={!disabled ? { scale: 0.95 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className={`select-none disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        >
            <div className="relative">
                {/* Subtle outer glow on hover / idle */}
                <motion.div
                    className="absolute -inset-1 rounded-2xl bg-cyan-400/20 blur-md pointer-events-none"
                    animate={{ opacity: [0.3, 0.65, 0.3] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                />

                <img
                    src={panelFrame}
                    alt=""
                    className="w-full relative"
                    draggable={false}
                />

                <div className="absolute inset-0 flex items-center justify-center">
                    <span
                        className="font-anton text-[5.8cqw] pt-[3cqw] tracking-wide"
                        style={{ color: titleColor }}
                    >
                        {title}
                    </span>
                </div>
            </div>
        </motion.button>
    );
};

export default PerilousButton;
