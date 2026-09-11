import HeightWeightDisplay from "./HeightWeightDisplay"
import textbgframe from "../../assets/bia/biatextbgframe.svg"
export default function HeightWeightComplete({
    heightValue,
    weightValue,
    onNextClick,
    isAudioPlaying
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="relative top-[30rem]"
                style={{ filter: "drop-shadow(0px 0px 40px rgba(139, 195, 229, 0.4))" }}
            >
                {/* ── textbgframe background ── */}
                <img src={textbgframe} alt="" className="w-full h-full block" draggable={false} />
            </div>
            <HeightWeightDisplay
                heightCm={heightValue}
                weightKg={weightValue}
                onNextClick={onNextClick}
                isAudioPlaying={isAudioPlaying}
            />
        </div>
    )
}
