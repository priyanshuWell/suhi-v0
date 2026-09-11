import blankCard from "../../../assets/beat-drop/popup/popup_complete_blank.png"
import PillButton from "./PillButton"
import { anton, cqw, FRAME_W, pct } from "./frame"

/** Native blank popup frame — same size as speed card. */
const CARD_ART_W = 1149
const CARD_ART_H = 1368
const CARD_W = 1080
const CARD_H = (CARD_W * CARD_ART_H) / CARD_ART_W
const CARD_LEFT = (FRAME_W - CARD_W) / 2
const CARD_TOP = 560

/**
 * Shared Beat Drop instruction popup:
 * blank neon frame + title + body + swappable illustration + Got it.
 */
export default function InstructionPopup({
    title,
    body,
    illustration,
    onGotIt,
    titleColor = "#FFFFFF",
    illustrationFit = "contain"
}) {
    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                zIndex: 40,
                background: "#000000CC"
            }}
        >
            <div
                style={{
                    position: "absolute",
                    left: pct(CARD_LEFT, "x"),
                    top: pct(CARD_TOP),
                    width: pct(CARD_W, "x"),
                    height: pct(CARD_H),
                    zIndex: 1
                }}
            >
                <img
                    src={blankCard}
                    alt=""
                    draggable={false}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "fill",
                        pointerEvents: "none"
                    }}
                />

                {/* Title — purple header pill */}
                <div
                    style={{
                        position: "absolute",
                        top: "5.5%",
                        left: "8%",
                        right: "8%",
                        height: "9%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 2,
                        pointerEvents: "none"
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            textAlign: "center",
                            ...anton,
                            fontSize: cqw(56),
                            lineHeight: 1,
                            letterSpacing: "0%",
                            color: titleColor,
                            whiteSpace: "nowrap"
                        }}
                    >
                        {title}
                    </p>
                </div>

                {/* Body copy under header */}
                <div
                    style={{
                        position: "absolute",
                        top: "17.5%",
                        left: "9%",
                        right: "9%",
                        zIndex: 2,
                        pointerEvents: "none"
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            textAlign: "center",
                            ...anton,
                            fontSize: cqw(36),
                            lineHeight: 1.25,
                            letterSpacing: "0.35px",
                            color: "#FFFFFF"
                        }}
                    >
                        {body}
                    </p>
                </div>

                {/* Illustration inside purple content frame */}
                <div
                    style={{
                        position: "absolute",
                        left: "12%",
                        right: "12%",
                        top: "32%",
                        bottom: "28%",
                        zIndex: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                        overflow: "hidden"
                    }}
                >
                    <img
                        src={illustration}
                        alt=""
                        draggable={false}
                        style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            width: "auto",
                            height: "auto",
                            objectFit: illustrationFit,
                            objectPosition: "center"
                        }}
                    />
                </div>

                <PillButton
                    variant="gotIt"
                    label="Got it!"
                    textColor="#390500"
                    fontSize={64}
                    onClick={onGotIt}
                    style={{
                        position: "absolute",
                        left: "18%",
                        bottom: "7.5%",
                        width: "64%",
                        aspectRatio: "2170 / 725",
                        height: "auto",
                        zIndex: 3
                    }}
                />
            </div>
        </div>
    )
}
