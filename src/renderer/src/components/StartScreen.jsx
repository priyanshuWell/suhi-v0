import React, {useState, useEffect } from "react";
import bg from "../assets/background.png";
import video1 from "../assets/avatar.mp4";
import { useNavigate } from "react-router";
import { openCamerasInBackground } from "../utils/cameraSession";

export const StartScreen = () => {
    const [isCameraReady,setIsCameraReady] = React.useState(false);
    const [error, setError] = useState(false);
    const navigate = useNavigate();

    useEffect(()=>{
       const openCameras= async ()=>{
        return await  openCamerasInBackground();
       }
      try {
         openCameras();
       setIsCameraReady(true);
       
      } catch (error) {
        console.log(error)
      }
    },[])
  return (
    <div
      className="
        fixed inset-0
        w-screen h-screen
        overflow-hidden
        bg-black
      "
    >
      {/* Background */}
      <div
        className="
          absolute inset-0
          bg-center bg-cover
          z-0
        "
        style={{ backgroundImage: `url(${bg})` }}
      />

      {/* Video */}
      <div
        className="
          absolute inset-0
          flex items-center justify-center
          z-10
          pointer-events-none
        "
      >
        <video
          src={video1}
          autoPlay
          muted
          loop
          playsInline
          className="
          rounded-2xl
            w-full h-full
            object-contain
            max-w-[90vw]
            max-h-[90vh]
            will-change-transform
          "
        />
      </div>
      {/* Start Button */}
      <div
        className="
          absolute bottom-[4vh]
          left-1/2 -translate-x-1/2
          z-20
        "
      >
        <button
  onClick={() => navigate("/capture")}
  style={{
    borderImageSource:
      "radial-gradient(50% 50% at 50% 50%, #FFFFFF 0%, rgba(255,255,255,0) 100%)",
    borderImageSlice: 1,
  }}
  className="
    w-40 h-14 xl:w-[350px] xl:h-[80px]
     flex items-center justify-center px-32
    text-center
    rounded-2xl
    border-[4.19px]

    bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)]

    shadow-[ 
      inset_0px_33.5px_50px_-67px_rgba(255,255,255,0.24),
      inset_0px_-100.5px_134px_0px_rgba(255,255,255,0.24),
      inset_0px_0px_50.25px_0px_rgba(255,255,255,1)
    ]

    text-white text-xl xl:text-2xl font-semibold
    active:scale-[0.98]
    transition-transform
  "
>
  Start
</button>


        <div
          className="
            mt-4
            text-center
            text-[1rem]
            xl:text-2xl
            text-[#E6E6E6]
          "
        >
          New user? Register here
        </div>
      </div>
    </div>
  );
};
 







