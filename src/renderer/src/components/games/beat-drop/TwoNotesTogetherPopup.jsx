import { useTranslation } from "react-i18next"
import chordArt from "../../../assets/beat-drop/popup/two_nodes_together.png"
import InstructionPopup from "./InstructionPopup"

/** Level C — Two Notes Together! */
export default function TwoNotesTogetherPopup({ onGotIt }) {
    const { t } = useTranslation()
    return (
        <InstructionPopup
            title={t("beatDrop.popups.two_notes_title")}
            body={
                <>
                    {t("beatDrop.popups.two_notes_line1")}
                    <br />
                    {t("beatDrop.popups.two_notes_line2")}
                </>
            }
            illustration={chordArt}
            onGotIt={onGotIt}
        />
    )
}
