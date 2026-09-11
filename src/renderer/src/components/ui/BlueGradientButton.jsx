import clsx from "clsx"
import { motion } from "framer-motion"

export default function BlueGradientButton({
    onClick,
    children,
    className = "",
    disabled = false,
    width,
    height
}) {
    return (
        <motion.button
            onClick={onClick}
            disabled={disabled}
            whileHover={disabled ? {} : { scale: 1.025, filter: "brightness(1.12)" }}
            whileTap={disabled ? {} : { scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 20 }}
            className={clsx(
                width ?? "w-[clamp(16rem,40vw,31.25rem)]",
                height ?? "h-[clamp(4rem,8vh,6.25rem)]",
                "relative overflow-hidden",
                "flex items-center justify-center",
                "text-center",
                "rounded-[20px]",
                "border-2 border-white/50",
                "bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)]",
                "shadow-[0px_0px_30px_rgba(0,179,255,0.5),inset_0px_0px_20px_rgba(255,255,255,0.3)]",
                "text-white",
                "text-[clamp(2rem,4vw,6rem)]",
                "tracking-wide",
                "cursor-pointer select-none",
                disabled && "opacity-50 cursor-not-allowed",
                className
            )}
        >
            {/* Ambient shimmer sweep */}
            {!disabled && (
                <motion.span
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-25deg] pointer-events-none"
                    animate={{ translateX: ["-100%", "200%"] }}
                    transition={{ repeat: Infinity, repeatDelay: 3, duration: 1.4, ease: "easeInOut" }}
                />
            )}
            <span className="relative z-10">{children}</span>
        </motion.button>
    )
}

