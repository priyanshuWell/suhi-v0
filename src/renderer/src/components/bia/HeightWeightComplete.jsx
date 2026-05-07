import heightResSvg from "../../assets/bia/height_res.svg";
import weightResSvg from "../../assets/bia/weight_res.svg";
import BlueGradientButton from "../ui/BlueGradientButton";

export default function HeightWeightComplete({ heightValue, weightValue, onNextClick }) {
    return (
        <div className="absolute inset-0 flex flex-col items-center gap-48 z-10 mt-120">
            {/* Height SVG frame with value */}
            <div className="relative w-2/3">
                <img
                    src={heightResSvg}
                    alt="height-frame"
                    className="w-full h-auto"
                />
                <span
                    className="absolute inset-0 flex items-center justify-center text-white font-mono tracking-widest"
                    style={{ fontSize: "clamp(1.4rem, 4vw, 3rem)" }}
                >
                    {parseFloat(heightValue).toFixed(1)} cm
                </span>
            </div>

            {/* Weight SVG frame with value */}
            <div className="relative w-2/3">
                <img
                    src={weightResSvg}
                    alt="weight-frame"
                    className="w-full h-auto"
                />
                <span
                    className="absolute inset-0 flex items-center justify-center text-white font-mono tracking-widest"
                    style={{ fontSize: "clamp(1.4rem, 4vw, 3rem)" }}
                >
                    {(parseFloat(weightValue).toFixed(2))} kg
                </span>
            </div>
            <BlueGradientButton onClick={onNextClick}>
                Next
            </BlueGradientButton>
        </div>
    )
}