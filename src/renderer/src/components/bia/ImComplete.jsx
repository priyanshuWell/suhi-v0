
import bodyMassSvg from "../../assets/bia/bodyMass.svg";
import fatMassSvg from "../../assets/bia/fatMass.svg";
import waterPercentageSvg from "../../assets/bia/waterPercentage.svg";
import muscleMassSvg from "../../assets/bia/muscleMass.svg";
import BlueGradientButton from "../ui/BlueGradientButton";

export default function ImComplete({ onNextClick, arms50k }) {
    return (
        <div className="absolute inset-0 flex flex-col items-center z-10 gap-8 mt-80">
            {/* Height SVG frame with value */}
            <div className="relative w-[45%]">
                <img
                    src={fatMassSvg}
                    alt="height-frame"
                    className="w-full h-auto"
                />
                <span
                    className="absolute inset-0 flex items-center justify-center text-white font-mono tracking-widest"
                    style={{ fontSize: "2rem" }}
                >
                    {parseFloat(arms50k?.fatPercentage ?? 18.4).toFixed(2)}%
                </span>
            </div>

            {/* Weight SVG frame with value */}
            <div className="relative w-[45%]">
                <img
                    src={bodyMassSvg}
                    alt="weight-frame"
                    className="w-full h-auto"
                />
                <span
                    className="absolute inset-0 flex items-center justify-center text-white font-mono tracking-widest"
                    style={{ fontSize: "2rem" }}
                >
                    {(parseFloat(arms50k?.boneMassKg ?? 1.2).toFixed(2))}kg
                </span>
            </div>

            <div className="relative  w-[45%]">
                <img
                    src={waterPercentageSvg}
                    alt="height-frame"
                    className="w-full h-auto"
                />
                <span
                    className="absolute inset-0 flex items-center justify-center text-white font-mono tracking-widest"
                    style={{ fontSize: "2rem" }}
                >
                    {parseFloat(arms50k?.waterPercentage ?? 56.8).toFixed(2)}%
                </span>
            </div>

            {/* Weight SVG frame with value */}
            <div className="relative  w-[45%]">
                <img
                    src={muscleMassSvg}
                    alt="weight-frame"
                    className="w-full h-auto"
                />
                <span
                    className="absolute inset-0 flex items-center justify-center text-white font-mono tracking-widest"
                    style={{ fontSize: "2rem" }}
                >
                    {(parseFloat(arms50k?.muscleMassKg ?? 3.5).toFixed(2))}kg
                </span>
            </div>
            <BlueGradientButton onClick={onNextClick}>
                Next
            </BlueGradientButton>
        </div>
    )
}