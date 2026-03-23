import voiceImage from "../../assets/voice_image.png";
import VoiceProgressBar from "./VoiceProgressBar";

export default function VoiceImageScreen({ timeLeft, status }) {
    return (
        <div className="relative z-10 w-full h-full flex flex-col gap-80 p-16">
            <VoiceProgressBar timeLeft={timeLeft} status={status} />
            <div className="relative w-full max-w-5xl h-[50vh] shadow-[0px_10px_50px_0px_#9AD9FF] rounded-[74px] overflow-hidden border border-[#9AD9FF]/30">
                <img
                    src={voiceImage}
                    alt="voice-image"
                    className="w-full h-full object-cover"
                />
            </div>
        </div>
    )
}