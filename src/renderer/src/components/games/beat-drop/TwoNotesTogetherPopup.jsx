import chordArt from "../../../assets/beat-drop/popup/two_nodes_together.png"
import InstructionPopup from "./InstructionPopup"

/** Level C — Two Notes Together! */
export default function TwoNotesTogetherPopup({ onGotIt }) {
    return (
        <InstructionPopup
            title="Two Notes Together!"
            body={
                <>
                    Now two notes will fall together.
                    <br />
                    You have to press both the keys!
                </>
            }
            illustration={chordArt}
            onGotIt={onGotIt}
        />
    )
}
