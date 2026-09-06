import clsx from "clsx"

export default function BlueGradientButton({
    onClick,
    children,
    className = "",
    disabled = false,
    width,
    height
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={clsx(
                width ?? "w-[clamp(16rem,40vw,31.25rem)]",
                height ?? "h-[clamp(4rem,8vh,6.25rem)]",
                "flex items-center justify-center",
                "text-center",
                "rounded-[20px]",
                "border-2 border-white/50",
                "bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)]",
                "shadow-[0px_0px_30px_rgba(0,179,255,0.5),inset_0px_0px_20px_rgba(255,255,255,0.3)]",
                "text-white",
                "text-[clamp(2rem,4vw,6rem)]",
                "tracking-wide",
                "active:scale-[0.98]",
                "transition-all duration-300 ease-in-out",
                "hover:border-white",
                disabled && "opacity-50 cursor-not-allowed",
                className
            )}
        >
            {children}
        </button>
    )
}
