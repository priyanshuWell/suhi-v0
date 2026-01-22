import React, { useEffect, useState } from "react";
import bg1 from "../../assets/lightbg.png";
import measureWH from "../../assets/videos/measureHeightWeight.mp4";
import { useParams } from "react-router";
import progessbg from '../../assets/progress-bg.svg'
import textframe from '../../assets/textFrame.png'
import { useTranslation } from 'react-i18next'
export const BIAComponent = ({ texts, total = 28, percent = 50, attemptCount = 0 }) => {
  const { t } = useTranslation();
  const { screenType } = useParams();
  const currentText = texts[screenType];
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = React.useRef(null);
  const activeCount = Math.round((progress / 100) * total)

  // Map screen types to audio files
  const getAudioPath = (type) => {
    const audioMap = {
      'wh': '/src/assets/audio/standstraight.mp3', // Weight/Height
      'im': '/src/assets/audio/impedance.mp3',     // Impedance
    };
    return audioMap[type] || '/src/assets/audio/standstraight.mp3';
  }
  useEffect(() => {
    if (screenType !== "im") {
      setProgress(0);
      return;
    }

    let value = 0;
    const interval = setInterval(() => {
      value += 1;
      setProgress(value);
      // Reset to 0 when reaching 100 to create a loop
      if (value >= 100) {
        value = 0;
      }
    }, 160); // ~12s per cycle

    return () => clearInterval(interval);
  }, [screenType]);
  useEffect(() => {
    // Play audio when screen type changes
    playAudio();
  }, [screenType]);

  const playAudio = () => {
    if (audioRef.current) {
      const audioPath = getAudioPath(screenType);
      audioRef.current.src = audioPath;
      setIsAudioPlaying(true);
      audioRef.current.play().catch((err) => {
        console.log("Audio playback failed:", err);
      });
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAudioPlaying(false);
    }
  };

  const handleAudioEnd = () => {
    setIsAudioPlaying(false);
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      <audio
        ref={audioRef}
        onEnded={handleAudioEnd}
        onPlay={() => setIsAudioPlaying(true)}
      >
        <source src={getAudioPath(screenType)} type="audio/mpeg" />
        {t('common.audio_not_supported')}
      </audio>
      {/* Background */}
      <div
        className="absolute inset-0 bg-center bg-cover z-0"
        style={{ backgroundImage: `url(${bg1})` }}
      />

      {/* TEXT + PROGRESS */}
      <div className="absolute  landscape:top-15 landscape:left-[20%] portrait:top-30 portrait:left-[20%] z-10 w-[60%]">
        <div className="relative text-center flex flex-col items-center justify-center">
          <img src={textframe} alt="text-frame" className="absolute top-0" />
          <p className=" text-white text-center portrait:text-[32px]   tracking-wider my-6">
            {currentText.title}
          </p>
          <img src={textframe} alt="text-frame" className="absolute top-[4.5rem] rotate-180" />

          <p className="text-white font-medium tracking-tight  landscape:text-4xl portrait:text-[36px] mt-[4rem]">
            {currentText.description}
          </p>

          {/* PROGRESS BAR (ONLY FOR IM) */}
          {screenType === "im" && (
            <div className="relative flex items-center justify-center ">
              {/* Progress bar background image */}
              <div className="absolute w-[456px] h-[320px]">
                <img src={progessbg} alt="progress-bar-frame" className="w-full h-full object-contain" />
              </div>

              {/* Progress bar segments */}
              <div className="flex flex-col h-[280px] w-[32px] -rotate-90 overflow-y-clip relative z-10">
                {Array.from({ length: total }).map((_, i) => {
                  const isActive = i < activeCount
                  return (
                    <div
                      key={i}
                      className={`h-10 w-8 mb-1 skew-y-35 last:mb-0 transition-all duration-300 ${isActive ? 'bg-[#368CC9]' : 'bg-[#0F324D]'
                        }`}
                    />
                  )
                })}
              </div>

              {/* Attempt counter */}
              {attemptCount > 0 && (
                <div className="absolute -bottom-12 text-white/80 text-xl">
                  {t('bia_component.attempt')} {attemptCount}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Video */}
      <div className="absolute inset-0 flex justify-center items-end mb-25 xl:items-center xl:justify-center z-10 pointer-events-none mt-[30rem]">
        <video
          src={measureWH}
          autoPlay
          // muted
          loop
          playsInline
          className="rounded-4xl object-contain w-1/2 xl:max-w-[70vw] xl:max-h-[70vh]"
        />
      </div>
    </div>
  );
};
