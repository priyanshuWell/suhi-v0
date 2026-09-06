import textFrameSvg from "../../../assets/textFrame.svg"
export function StepTextPanel({ msg }) {
    if (!msg) return null

    return (
        <div
            style={{
                position: "absolute",
                top: "6%", // tweak to align with PANEL_TOP on canvas
                left: "50%",
                transform: "translateX(-50%)",
                width: "80%",
                maxWidth: "934px",
                pointerEvents: "none",
                zIndex: 10
            }}
        >
            {/* SVG frame as background image */}
            <img src={textFrameSvg} alt="" style={{ width: "100%", display: "block" }} />

            {/* Text absolutely centered inside the frame */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: "8px",
                    padding: "0 40px"
                }}
            >
                {msg.split("\n").map((line, i) => (
                    <span
                        key={i}
                        style={{
                            fontFamily: "'Courier New', Courier, monospace",
                            fontWeight: "bold",
                            fontSize: "clamp(2rem, 2.5vw, 1.6rem)",
                            color: "#fff",
                            textAlign: "center",
                            lineHeight: 1.4
                        }}
                    >
                        {line}
                    </span>
                ))}
            </div>
        </div>
    )
}
