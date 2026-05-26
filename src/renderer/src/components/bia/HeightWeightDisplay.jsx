import { useEffect, useRef, useState } from "react";
import BlueGradientButton from "../ui/BlueGradientButton";
import HeightIcon from '../../assets/bia/scale.svg'
import WeightIcon from '../../assets/bia/bag.svg'
import { useNavigate } from "react-router";

const HeightWeightDisplay = ({
    heightCm = null,     // numeric or null
    weightKg = null,     // numeric or null
    onNextClick,
    isHideNext = false,
    isRandomHeightWeight = false,  // true = scanning animation, false = show settled values
}) => {
    const [displayHeight, setDisplayHeight] = useState("---");
    const [displayWeight, setDisplayWeight] = useState("---");
    const intervalRef = useRef(null);
    const navigate = useNavigate();
    useEffect(() => {
        // Always clear any running interval first
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (isRandomHeightWeight) {
            // Scanning mode — scramble in plausible ranges regardless of whether
            // real values have arrived yet. Real values are only used on whcomplete.
            intervalRef.current = setInterval(() => {
                const h = (Math.random() * 50 + 145).toFixed(2);  // 145.00 – 195.00 cm
                const w = (Math.random() * 60 + 40).toFixed(2);   //  40.00 – 100.00 kg
                setDisplayHeight(`${h} cm`);
                setDisplayWeight(`${w} kg`);
            }, 90);
        } else {
            // Settled mode — show real values with 2 decimal places
            const h = heightCm != null ? `${parseFloat(heightCm).toFixed(2)} cm` : "---";
            const w = weightKg != null ? `${parseFloat(weightKg).toFixed(2)} kg` : "---";
            setDisplayHeight(h);
            setDisplayWeight(w);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [heightCm, weightKg, isRandomHeightWeight]);

    return (
        <>
            <div className="fixed overflow-hidden bottom-60 left-20 z-40 flex items-center gap-10 font-anta">

                {/* Height Card */}
                <div
                    className="
                        flex flex-col items-center justify-center gap-6
                        px-20 py-7
                        rounded-[28px]
                        border border-white
                        bg-[rgba(82,82,82,0.3)]
                        shadow-[0px_4px_28px_0px_#9ad9ff]
                        w-[450px]
                    "
                >
                    <p className="text-white text-[70px] leading-normal m-0 whitespace-nowrap">
                        Height
                    </p>
                    <img
                        src={HeightIcon}
                        alt="Height icon"
                        className="w-16 h-16"
                    />
                    <div className="flex items-baseline gap-6 text-white whitespace-nowrap">
                        <span className="text-[70px] leading-[1.1] tracking-wide font-anta">
                            {displayHeight}
                        </span>
                    </div>
                </div>

                {/* Weight Card */}
                <div
                    className="
                        flex flex-col items-center justify-center gap-6
                        px-20 py-7
                        rounded-[28px]
                        border border-white
                        bg-[rgba(82,82,82,0.3)]
                        shadow-[0px_4px_28px_0px_#9ad9ff]
                        w-[450px]
                        overflow-hidden
                    "
                >
                    <p className="text-white text-[70px] leading-normal m-0 whitespace-nowrap">
                        Weight
                    </p>
                    <img
                        src={WeightIcon}
                        alt="Weight icon"
                        className="w-20 h-20"
                    />
                    <div className="flex items-baseline gap-6 text-white whitespace-nowrap">
                        <span className="text-[70px] leading-[1.1] tracking-wide font-anta">
                            {displayWeight}
                        </span>
                    </div>
                </div>
            </div>

            {!isHideNext && (
                <div className="absolute bottom-20 left-[31%]">
                    <BlueGradientButton onClick={() => navigate('/bia/im')}>
                        Next
                    </BlueGradientButton>
                </div>
            )}
        </>
    );
};

export default HeightWeightDisplay;