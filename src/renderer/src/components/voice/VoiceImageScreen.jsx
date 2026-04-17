import { useState } from "react";
import BusStop from "../../assets/voice/bus_stop.png";
import GroupStudy from "../../assets/voice/group_study.png";
import ParkScene from "../../assets/voice/park_scene.png";
import SpilledWaterBottle from "../../assets/voice/Spilled_water_bottle.png";
import VoiceProgressBar from "./VoiceProgressBar";
import BlueGradientButton from "../ui/BlueGradientButton";
import voiceComplete from "../../assets/voice/voiceComplete.svg";
import { useNavigate } from "react-router";

const IMAGES = [BusStop, GroupStudy, ParkScene, SpilledWaterBottle];

export default function VoiceImageScreen({ showCompleteAlert, handleNext, timeLeft, status }) {
    const [randomImage] = useState(() => IMAGES[Math.floor(Math.random() * IMAGES.length)]);
    const navigate = useNavigate();
    const handleNextClick = () => {
        navigate('/space-convoy-main');
    }
    return (
        <div className="relative z-10 w-full h-full flex flex-col gap-80 p-16">
            <VoiceProgressBar timeLeft={timeLeft} status={status} />
            <div className="relative w-full max-w-5xl h-[50vh] shadow-[0px_10px_50px_0px_#9AD9FF] rounded-[74px] overflow-hidden border border-[#9AD9FF]/30">
                <img
                    src={randomImage}
                    alt="voice-image"
                    className="w-full h-full object-cover"
                />
            </div>
            {
                showCompleteAlert && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                        <div className="relative max-w-4xl flex justify-center">
                            <img
                                src={voiceComplete}
                                alt="voice-complete"
                                className="w-full h-auto"
                            />
                            <div className="absolute bottom-[30%]">
                                <BlueGradientButton onClick={handleNextClick}>
                                    Next
                                </BlueGradientButton>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    )
}