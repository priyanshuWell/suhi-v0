import React from "react"

const VoiceProgressBar = ({ timeLeft, totalTime = 30, status }) => {
    const progress = ((totalTime - timeLeft) / totalTime) * 100

    const getMessage = ({ timeLeft, status }) => {
        if (status === "idle") return ""
        if (status === "processing") return "Processing..."
        if (timeLeft <= 0) return "Done!"
        return `Speak for ${timeLeft} more second${timeLeft !== 1 ? "s" : ""}...`
    }

    // if (status === "idle") return null;

    return (
        <div className="flex flex-col gap-[10px] items-start w-full max-w-[965px] mt-10">
            {/* Label */}
            <p className="font-sans font-normal text-[32px] text-white whitespace-nowrap leading-normal">
                {getMessage({ timeLeft })}
            </p>

            {/* Progress Bar Track */}
            <div className="bg-[#e0e0e0] flex h-[21px] items-center overflow-hidden relative rounded-full w-full">
                {/* Progress Fill */}
                <div
                    className="bg-[#0d4aca] h-full rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    )
}

export default VoiceProgressBar
