import { useState, useEffect, useRef } from "react";
import BusStop from "../../assets/voice/bus_stop.png";
import GroupStudy from "../../assets/voice/group_study.png";
import ParkScene from "../../assets/voice/park_scene.png";
import SpilledWaterBottle from "../../assets/voice/Spilled_water_bottle.png";
import VoiceProgressBar from "./VoiceProgressBar";
import BlueGradientButton from "../ui/BlueGradientButton";
import voiceComplete from "../../assets/voice/voiceComplete.svg";
import { useNavigate } from "react-router";

const IMAGES = [BusStop, GroupStudy, ParkScene, SpilledWaterBottle];

const BAR_WIDTH = 12.1111;
const BAR_RADIUS = 6.05556;
const CENTER_Y = 100;
const IDLE_HEIGHT = 10;
const MAX_EXTRA_HEIGHT = 140;

const barPositions = [
  { x: 0,       scale: 0.3  },
  { x: 30.2773, scale: 0.9  },
  { x: 60.5547, scale: 0.25 },
  { x: 90.832,  scale: 1.1  },
  { x: 121.109, scale: 0.6  },
  { x: 151.391, scale: 0.4  },
  { x: 181.668, scale: 0.7  },
  { x: 211.945, scale: 0.25 },
  { x: 242.223, scale: 0.9  },
];

export default function VoiceImageScreen({ showCompleteAlert, handleNext, timeLeft, status }) {
  const [randomImage] = useState(() => IMAGES[Math.floor(Math.random() * IMAGES.length)]);
  const [voiceBars, setVoiceBars] = useState(Array(9).fill(0));
  const animFrameRef = useRef(null);
  const navigate = useNavigate();

  const isActive = status === "recording";

  useEffect(() => {
    if (isActive) {
      const phases = barPositions.map(() => Math.random() * Math.PI * 2);
      const speeds = barPositions.map(() => 0.8 + Math.random() * 2.5);
      let startTime = null;

      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = (timestamp - startTime) / 1000;

        setVoiceBars(
          barPositions.map((_, i) => {
            const wave =
              0.4 * Math.sin(elapsed * speeds[i] + phases[i]) +
              0.3 * Math.sin(elapsed * speeds[i] * 1.7 + phases[i] + 1) +
              0.3 * Math.random();
            return Math.max(0, Math.min(1, (wave + 0.5) / 1.3));
          })
        );

        animFrameRef.current = requestAnimationFrame(animate);
      };

      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(animFrameRef.current);
      setVoiceBars(Array(9).fill(0));
    }

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isActive]);

  const handleNextClick = () => {
    navigate('/space-convoy-main');
  };

  return (
    <div className="relative z-10 w-full h-full flex flex-col gap-80 p-16">
      <VoiceProgressBar timeLeft={timeLeft} status={status} />

      <div className="flex flex-col items-center gap-4">
        {/* Image */}
        <div className="relative w-full max-w-5xl h-[50vh] shadow-[0px_10px_50px_0px_#9AD9FF] rounded-[74px] overflow-hidden border border-[#9AD9FF]/30">
          <img
            src={randomImage}
            alt="voice-image"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Waveform bars below the image */}
        <div className="flex items-center justify-center gap-2">
          <svg
            width="400"
            height="200"
            viewBox="0 0 255 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
          >
            {voiceBars.map((intensity, index) => {
              const bar = barPositions[index];
              const height = IDLE_HEIGHT + MAX_EXTRA_HEIGHT * bar.scale * intensity;
              const y = CENTER_Y - height / 2;
              return (
                <rect
                  key={index}
                  x={bar.x}
                  y={y}
                  width={BAR_WIDTH}
                  height={height}
                  rx={BAR_RADIUS}
                  fill="white"
                  style={{
                    transition: "height 0.1s ease-out, y 0.1s ease-out",
                  }}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {showCompleteAlert && (
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
      )}
    </div>
  );
}