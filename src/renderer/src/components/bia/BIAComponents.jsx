import React, { useEffect, useState } from "react";
import bg1 from "../../assets/lightbg.png";
import measureWH from "../../assets/videos/measureHeightWeight.mp4";
import { useParams } from "react-router";
import progessbg from '../../assets/progress-bg.svg'

export const BIAComponent = ({ texts, total = 28, percent = 50, attemptCount = 0 }) => {
  const { screenType } = useParams();
  const currentText = texts[screenType];
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const activeCount = Math.round((percent / 100) * total)
  useEffect(() => {
    if (screenType !== "im") {
      setProgress(0);
      return;
    }

    let value = 0;
    const interval = setInterval(() => {
      value += 1;
      setProgress(value);
      if (value >= 100) clearInterval(interval);
    }, 120); // ~12s

    return () => clearInterval(interval);
  }, [screenType]);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      {/* Background */}
      <div
        className="absolute inset-0 bg-center bg-cover z-0"
        style={{ backgroundImage: `url(${bg1})` }}
      />

      {/* TEXT + PROGRESS */}
      <div className="absolute portrait:mt-7 landscape:top-15 landscape:left-[20%] portrait:top-36 portrait:left-[20%] z-10 w-[60%]">
        <div className="text-center flex flex-col portrait:gap-6 items-center justify-center">
          <h1 className="text-white/90 leading-relaxed landscape:text-3xl portrait:text-[33px] xl:mt-6">
            {currentText.title}
          </h1>

          <p className="text-white font-medium  landscape:text-4xl portrait:text-5xl">
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
                  Attempt {attemptCount}
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
          muted
          loop
          playsInline
          className="rounded-4xl object-contain w-1/2 xl:max-w-[70vw] xl:max-h-[70vh]"
        />
      </div>
    </div>
  );
};
