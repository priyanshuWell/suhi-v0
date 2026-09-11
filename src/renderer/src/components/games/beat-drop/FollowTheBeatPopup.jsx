import followArt from "../../../assets/beat-drop/popup/follow_the_beat.png"
import InstructionPopup from "./InstructionPopup"

/** Level A — Follow the Beat! */
export default function FollowTheBeatPopup({ onGotIt }) {
    return (
        <InstructionPopup
            title="Follow the Beat!"
            body="Hit each note as it reaches the line at bottom"
            illustration={followArt}
            onGotIt={onGotIt}
        />
    )
}
