import React, { useEffect, useState } from "react";
import bg1 from "../../assets/lightbg.png";
import measureWH from "../../assets/videos/measureHeightWeight.mp4";
import { useParams } from "react-router";
import ErrorAlert from "../ErrorAlert";

export const BIAComponent = ({ texts }) => {
  const { screenType } = useParams();
  const currentText = texts[screenType];
  const [error, setError] = useState(null);
  /* =======================
     PROGRESS (IM ONLY)
  ======================= */
  const [progress, setProgress] = useState(0);

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
            <div className={`${screenType === "wh" ? "":"block"} landscape:w-1/3 portrait:w-1/2 mt-6`}>
              <div className="w-full h-3 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-100 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video */}
      <div className="absolute inset-0 flex justify-center items-end mb-22 xl:items-center xl:justify-center z-10 pointer-events-none xl:mt-72">
        <video
          src={measureWH}
          autoPlay
          muted
          loop
          playsInline
          className="rounded-4xl object-contain w-1/2 xl:max-w-[70vw] xl:max-h-[70vh]"
        />
      </div>
      <ErrorAlert visible={false} title={"Weight is not measured! Try Again"}/>
    </div>
  );
};
