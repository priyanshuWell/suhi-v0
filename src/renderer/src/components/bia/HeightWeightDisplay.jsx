import BlackGradientButton from "../ui/BlackGradientButton";
import BlueGradientButton from "../ui/BlueGradientButton";
import HeightIcon from '../../assets/bia/scale.svg'
import WeightIcon from '../../assets/bia/bag.svg'

const HeightWeightDisplay = ({ heightCm = null, weightKg = null, onNextClick }) => {
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
                    <img src={HeightIcon} alt="Height icon" className="w-16 h-16" />
                    <div className="flex items-baseline gap-6 text-white whitespace-nowrap">
                        <span
                            className="text-[90px] leading-[1.1] tracking-wide font-anta"
                        >
                            {heightCm !== null ? heightCm : "---"}
                        </span>
                        {/* <span className="text-[66px] leading-[1] tracking-tight">cm</span> */}
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
                    <img src={WeightIcon} alt="Weight icon" className="w-20 h-20" />
                    <div className="flex items-baseline gap-6 text-white whitespace-nowrap">
                        <span
                            className="text-[90px] leading-[1.1] tracking-wide font-anta"
                        >
                            {weightKg !== null ? weightKg : "--"}
                        </span>
                        {/* <span className="text-[66px] leading-[1] tracking-tight">kg</span> */}
                    </div>
                </div>
            </div>
            <div className="absolute bottom-20 left-[31%]">
                <BlueGradientButton onClick={onNextClick}>
                    Next
                </BlueGradientButton>
            </div>
        </>

    );
};

export default HeightWeightDisplay;