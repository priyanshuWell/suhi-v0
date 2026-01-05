import React from "react";
import bg from "../assets/background.png";
import { useNavigate } from "react-router";
import img from '../assets/img.png'
const FaceConfirmationScreen = ({ user }) => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      />

      {/* Overlay glow */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Main Card */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        <div
          className="
            relative
            w-full h-full
            max-w-[92vw] max-h-[92vh]
            rounded-2xl
            border border-cyan-400/40
            bg-cyan-500/10
            backdrop-blur-xl
            shadow-[0_0_60px_rgba(14,165,233,0.35)]
            flex flex-col items-center
            justify-between
            py-12 
          "
        >
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div
              className="
                w-[500px] h-[500px]
                rounded-2xl
                border-4 border-cyan-400/60
                overflow-hidden
                shadow-[0_0_30px_rgba(14,165,233,0.6)]
              "
            >
              <img
                src={img}
                alt="User"
                className="w-full h-full object-cover"
              />
            </div>

            {/* User Details */}
            <div className="landscape:mt-8 portrait:mt-44  portrait:flex portrait:flex-col portrait:justify-center portrait:items-center text-center text-cyan-100 space-y-3 text-lg">
              <p>
                <span className="opacity-70 landscape:text-3xl portrait:text-5xl">Name - Jagrit</span>
                {user?.name}
              </p>
              <p>
                <span className="opacity-70 landscape:text-3xl portrait:text-5xl">Class - XII</span>
                {user?.class}
              </p>
              <p>
                <span className="opacity-70 landscape:text-3xl portrait:text-5xl">Age -25 </span>
                {user?.age}
              </p>
              <p>
                <span className="opacity-70 landscape:text-3xl portrait:text-5xl">Contact Number - 9999900000</span>
                {user?.phone}
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="w-full max-w-xl space-y-6">
            <button
              onClick={() => navigate("/bia/wh")}
              className="
                w-full py-5
                rounded-xl
                text-xl font-medium
                text-white
                bg-gradient-to-b from-cyan-400 to-cyan-600
                shadow-[0_0_25px_rgba(14,165,233,0.8)]
                hover:scale-[1.02]
                active:scale-95
                transition
              "
            >
              Yes, it’s me
            </button>

            <button
              onClick={() => navigate("/retry")}
              className="
                w-full py-5
                rounded-xl
                text-xl
                text-cyan-200
                border border-cyan-400/40
                hover:bg-cyan-400/10
                transition
              "
            >
              Not you?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceConfirmationScreen;
