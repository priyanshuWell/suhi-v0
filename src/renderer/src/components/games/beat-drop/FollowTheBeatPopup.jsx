import { useTranslation } from "react-i18next"
import followArt from "../../../assets/beat-drop/popup/follow_the_beat.png"
import InstructionPopup from "./InstructionPopup"

/** Level A — Follow the Beat! */
export default function FollowTheBeatPopup({ onGotIt }) {
    const { t } = useTranslation()
    return (
        <InstructionPopup
            title={t("beatDrop.popups.follow_title")}
            body={t("beatDrop.popups.follow_body")}
            illustration={followArt}
            onGotIt={onGotIt}
        />
    )
}
