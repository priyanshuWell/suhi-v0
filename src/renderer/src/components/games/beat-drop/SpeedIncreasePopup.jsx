import { motion } from "framer-motion"
import speedCard from "../../../assets/beat-drop/popup/speed_increase_blank_card.png"
import PillButton, { absBox } from "./PillButton"
import { anton, cqw } from "./frame"

/**
 * speed_increase_blank_card.png already bakes in the header pill, sparkles,
 * music notes, the 4 note-lane previews and the speed-up chevrons — this
 * component only needs to lay the two text blocks over it.
 */
export default function SpeedIncreasePopup({ onGotIt }) {
    return (
        <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0 }}
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

                <p
                    style={{
                        position: "absolute",
                        top: "5.5%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        margin: 0,
                        width: "90%",
                        textAlign: "center",
                        ...anton,
                        fontSize: cqw(56),
                        color: "#F2F14F",
                        whiteSpace: "nowrap",
                        zIndex: 2
                    }}
                >
                    Notes Speed will Increase!
                </p>

                <p
                    style={{
                        position: "absolute",
                        top: "19%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        margin: 0,
                        width: "80%",
                        textAlign: "center",
                        ...anton,
                        fontSize: cqw(40),
                        letterSpacing: "0.35px",
                        lineHeight: 1.15,
                        color: "#FFFFFF",
                        zIndex: 2
                    }}
                >
                    <span style={{ display: "block" }}>Get Ready!</span>
                    <span style={{ display: "block" }}>
                        The notes will <span style={{ color: "#F2F14F" }}>come faster</span> now!
                    </span>
                </p>

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
        </motion.div>
    )
}
