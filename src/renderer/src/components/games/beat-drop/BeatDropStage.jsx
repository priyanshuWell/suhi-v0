import { FRAME_W, FRAME_H } from "./frame"

/**
 * Scales the 1513×2678 design into the 1080×1920 window.
 */
export default function BeatDropStage({ children, style }) {
    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                overflow: "hidden",
                background: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...style
            }}
        >
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    maxWidth: `calc(100vh * ${FRAME_W / FRAME_H})`,
                    maxHeight: `calc(100vw * ${FRAME_H / FRAME_W})`,
                    aspectRatio: `${FRAME_W} / ${FRAME_H}`,
                    containerType: "inline-size",
                    overflow: "hidden",
                    fontFamily: "'Anton', sans-serif"
                }}
            >
                {children}
            </div>
        </div>
    )
}
