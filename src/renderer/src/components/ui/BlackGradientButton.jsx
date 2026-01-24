import clsx from "clsx";

export default function GradientButton({ onClick, children, className = "", disabled = false, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundBlendMode: "plus-darker",
        boxShadow: "0px 3.57697px 28.6158px #9AD9FF",
        ...style
      }}
      className={clsx(
        "relative",
        "mt-8",
        "mb-56",
        "flex items-center justify-center",
        "text-center",
        "rounded-[30px]",
        "px-20",
        "py-8",
        "text-white",
        "text-4xl",
        "tracking-wide",
        // More transparent bg
        "bg-[#0b0f14]/70",
        "mix-blend-plus-darker",
        "drop-shadow-[0_0_25px_rgba(6,182,212,0.6)]",
        "shadow-[0_0_40px_rgba(0,200,255,0.45)]",
        "shadow-[inset_0_0_12px_rgba(255,255,255,0.08)]",
        "border border-white/10",
        // Gradient overlay via before pseudo
        "before:content-['']",
        "before:absolute",
        "before:inset-0",
        "before:rounded-[20px]",
        "before:bg-linear-to-b",
        "before:from-white/12",
        "before:via-white/4",
        "before:to-transparent",
        "before:pointer-events-none",
        "active:scale-[0.98]",
        "transition-transform duration-300 ease-in-out",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {children}
    </button>
  );
}