import BlackGradientButton from "../ui/BlackGradientButton";

export default function OptionButton({ label, onClick, wide = false }) {
    return (
        <BlackGradientButton
            onClick={onClick}
            style={{
                width: wide ? "clamp(280px, 66vw, 639px)" : "clamp(130px, 32vw, 639px)",
                height: "clamp(56px, 9vw, 145px)",
            }}
        >
            <span
                className="font-mono text-white whitespace-nowrap tracking-tight"
                style={{
                    fontSize: "clamp(1rem, 3.8vw, 3.75rem)",
                    // letterSpacing: "-0.06em",
                }}
            >
                {label}
            </span>
        </BlackGradientButton>
    )
}   