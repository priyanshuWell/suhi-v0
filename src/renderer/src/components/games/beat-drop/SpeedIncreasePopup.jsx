import speedCard from "../../../assets/beat-drop/popup/speed_increase_blank_card.png"
import PillButton from "./PillButton"
import { anton, cqw, FRAME_W, pct } from "./frame"

/** Native speed-card art size — lock aspect so text sits on the PNG. */
const CARD_ART_W = 1149
const CARD_ART_H = 1368
const CARD_W = 1080
const CARD_H = (CARD_W * CARD_ART_H) / CARD_ART_W
const CARD_LEFT = (FRAME_W - CARD_W) / 2
const CARD_TOP = 560

/**
 * Notes Speed will Increase — same layout pattern as AvoidNotesPopup.
 * Card art includes header pill, note lanes, chevrons, sparkles.
 */
export default function SpeedIncreasePopup({ onGotIt }) {
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
                    src={speedCard}
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

                {/* Title — Anton 64 / #F2F14F, spaced from top like Avoid popup */}
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
                            fontSize: cqw(64),
                            lineHeight: 1,
                            letterSpacing: "0%",
                            color: "#F2F14F",
                            whiteSpace: "nowrap"
                        }}
                    >
                        Notes Speed will Increase!
                    </p>
                </div>

                {/* Body — Anton 40, “come faster” highlighted */}
                <div
                    style={{
                        position: "absolute",
                        top: "19.5%",
                        left: "8%",
                        right: "8%",
                        zIndex: 2,
                        pointerEvents: "none"
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            textAlign: "center",
                            ...anton,
                            fontSize: cqw(40),
                            lineHeight: 1.2,
                            letterSpacing: "0.35px",
                            color: "#FFFFFF"
                        }}
                    >
                        Get Ready!
                        <br />
                        The notes will <span style={{ color: "#F2F14F" }}>come faster</span> now!
                    </p>
                </div>

                {/* Got it — lift off card bottom so it isn’t flush with the frame */}
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
