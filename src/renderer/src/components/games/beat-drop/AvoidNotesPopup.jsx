import avoidCard from "../../../assets/beat-drop/popup/avoid_notes_card.png"
import PillButton, { absBox } from "./PillButton"
import { anton, cqw } from "./frame"

/**
 * Avoid These Notes popup.
 * Got it is centered with left/right math (no translateX) so it cannot slide on press.
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
                    ...absBox({ left: 192, top: 715, width: 1125, height: 1248 })
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

                <p
                    style={{
                        position: "absolute",
                        top: "5.2%",
                        left: 0,
                        right: 0,
                        margin: 0,
                        textAlign: "center",
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: cqw(48),
                        lineHeight: 1,
                        color: "#FFB703",
                        zIndex: 2
                    }}
                >
                    Avoid These Notes!
                </p>

                <p
                    style={{
                        position: "absolute",
                        top: "15.5%",
                        left: "8%",
                        right: "8%",
                        margin: 0,
                        textAlign: "center",
                        ...anton,
                        fontSize: cqw(36),
                        letterSpacing: "0.35px",
                        lineHeight: 1.2,
                        color: "#FFFFFF",
                        zIndex: 2
                    }}
                >
                    These are decoy notes.{" "}
                    <span style={{ color: "#FFB703" }}>Do not press</span> the piano key
                    <br />
                    when you see these notes.
                </p>

                {/* Centered without transform — width 62%, left (100-62)/2 = 19% */}
                <PillButton
                    variant="gotIt"
                    label="Got it!"
                    textColor="#390500"
                    fontSize={64}
                    onClick={onGotIt}
                    style={{
                        position: "absolute",
                        left: "19%",
                        bottom: "4.5%",
                        width: "62%",
                        aspectRatio: "2170 / 725",
                        height: "auto",
                        zIndex: 3
                    }}
                />
            </div>
        </div>
    )
}
