import avoidCard from "../../../assets/beat-drop/popup/avoid_notes_card.png"
import PillButton from "./PillButton"
import { anton, cqw, FRAME_W, pct } from "./frame"

/** Native avoid-notes card art size — keep this aspect so text locks to the PNG. */
const CARD_ART_W = 1199
const CARD_ART_H = 1312
const CARD_W = 1080
const CARD_H = (CARD_W * CARD_ART_H) / CARD_ART_W
const CARD_LEFT = (FRAME_W - CARD_W) / 2
/** Sit a bit above vertical center so the piano stays visible underneath. */
const CARD_TOP = 560

/**
 * Avoid These Notes — card art + overlays locked to the PNG aspect.
 * Title / body / button use % of the card box (same box the image fills).
 */
export default function AvoidNotesPopup({ onGotIt }) {
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
                    src={avoidCard}
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

                {/* Title — spaced down from top of card, centered in purple pill */}
                <div
                    style={{
                        position: "absolute",
                        top: "5.5%",
                        left: "10%",
                        right: "10%",
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
                        Avoid These Notes!
                    </p>
                </div>

                {/* Body — Figma line breaks */}
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
                        These are decoy notes.{" "}
                        <span style={{ color: "#F2F14F" }}>Do not press</span>
                        <br />
                        the piano key when you see these
                        <br />
                        notes.
                    </p>
                </div>

                {/* Got it — bottom of card, centered */}
                <PillButton
                    variant="gotIt"
                    label="Got it!"
                    textColor="#390500"
                    fontSize={64}
                    onClick={onGotIt}
                    style={{
                        position: "absolute",
                        left: "18%",
                        bottom: "4%",
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
