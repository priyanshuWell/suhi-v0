import React, { useEffect } from "react";
import { useNavigate } from "react-router";
import splashVideo from "../assets/suhi animation puzz.mp4"; 
// move the video into src/assets for proper bundling

const SplashScreen = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const redirectTimeout = setTimeout(() => {
      navigate("/welcome");
    }, 5000); // match video length if needed

    return () => clearTimeout(redirectTimeout);
  }, [navigate]);

  return (
    <div
            className="
              absolute inset-0
              flex items-center justify-center
              pointer-events-none
            "
          >
            <video
              src={splashVideo}
              autoPlay
              muted
              loop
              playsInline
              // onEnded={()=>navigate('/welcome')}
              className="
                w-full h-full
                object-cover
                max-w-[100vw]
                max-h-[100vh]
                will-change-transform
              "
            />
          </div>
  );
};

export default SplashScreen;
