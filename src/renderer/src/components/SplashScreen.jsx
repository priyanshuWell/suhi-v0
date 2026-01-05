import React, { useEffect, useState } from "react";
import logo from "../assets/suhi-logo.png"; // replace with actual path
import { useNavigate } from "react-router";

const SplashScreen = () => {
  const [animate, setAnimate] = useState(false);
 const navigate = useNavigate();
 
  useEffect(() => {
    const timeout = setTimeout(() => setAnimate(true), 100); // delay for smoother effect
    const redirectTimeout = setTimeout(() => navigate("/welcome"), 3000);
    return () => {
      clearTimeout(timeout);
      clearTimeout(redirectTimeout);
    };
  }, [navigate]);

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-white">
      <img
        src={logo}
        alt="Suhi Logo"
        className={`transition-all duration-1000 ease-out ${
          animate ? "opacity-100 scale-100" : "opacity-0 scale-75"
        } w-[100px] md:w-[200px] xl:w-[300px]`}
        draggable={false}
      />
    </div>
  );
};

export default SplashScreen;
