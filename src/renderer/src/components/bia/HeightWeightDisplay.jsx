import { useEffect, useRef, useState } from "react";
import BlackGradientButton from "../ui/BlackGradientButton";
import BlueGradientButton from "../ui/BlueGradientButton";

import HeightIcon from '../../assets/bia/scale.svg'
import WeightIcon from '../../assets/bia/bag.svg'

const HeightWeightDisplay = ({
    heightCm = null,
    weightKg = null,
    onNextClick,
    isHideNext = false,
    isRandomHeightWeight = false
}) => {

    const [displayHeight, setDisplayHeight] = useState("---");
    const [displayWeight, setDisplayWeight] = useState("---");

    const intervalRef = useRef(null);

    useEffect(() => {

        // no animation → show actual values directly
        if (!isRandomHeightWeight) {
            setDisplayHeight(heightCm ?? "---");
            setDisplayWeight(weightKg ?? "---");
            return;
        }

        // don't start animation until real values exist
        if (!heightCm || !weightKg) return;

        const targetHeight = parseFloat(heightCm);
        const targetWeight = parseFloat(weightKg);

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // random scanner effect
        intervalRef.current = setInterval(() => {

            const randomHeight =
                targetHeight + (Math.random() * 4 - 2);

            const randomWeight =
                targetWeight + (Math.random() * 4 - 2);

            setDisplayHeight(`${randomHeight.toFixed(1)} cm`);
            setDisplayWeight(`${randomWeight.toFixed(1)} kg`);

        }, 90);

        // settle into final values
        const timeout = setTimeout(() => {

            clearInterval(intervalRef.current);

            setDisplayHeight(`${targetHeight} cm`);
            setDisplayWeight(`${targetWeight} kg`);

        }, 2500);

        return () => {
            clearInterval(intervalRef.current);
            clearTimeout(timeout);
        };

    }, [heightCm, weightKg, isRandomHeightWeight]);

    return (
        <>
            <div
                className="fixed overflow-hidden bottom-60 left-7 z-40 flex items-center gap-10 font-anta"
            >

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
                        <span
                            className="text-[90px] leading-[1.1] tracking-wide font-anta"
                        >
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
                        <span
                            className="text-[90px] leading-[1.1] tracking-wide font-anta"
                        >
                            {displayWeight}
                        </span>
                    </div>
                </div>
            </div>

            {
                !isHideNext && (
                    <div className="absolute bottom-20 left-[31%]">
                        <BlueGradientButton onClick={onNextClick}>
                            Next
                        </BlueGradientButton>
                    </div>
                )
            }
        </>
    );
};

export default HeightWeightDisplay;