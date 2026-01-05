import React from "react";
import lightbg from "../assets/lightbg.png";
import lightblub from "../assets/lightblub.png";
import { Settings } from "lucide-react";

export default function RegisterCard() {
  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center">
      {/* Card Wrapper */}
      <div
        className="relative portrait:w-[80%] portrait:h-[80%] bg-cover bg-center"
        style={{ backgroundImage: `url(${lightbg})` }}
      >
        {/* SETTINGS ICON */}
        {/* <div className="absolute top-4 right-4 z-20">
          <Settings className="w-9 h-9 rounded-full bg-black/60 p-2 border border-cyan-400/40" />
        </div> */}

        {/* SVG FRAME */}
        <svg
          viewBox="0 0 1187 1839"
          className="absolute inset-0 w-full h-full z-10"
          fill="none"
        >
          <path
            d="M1062.52 0.427176L1186.46 81.4857L1186.46 774.915L1120.24 818.167L1120.24 1790.98L1047.31 1838.71L74.3987 1838.71L-0.000363946 1790.12L-0.000284238 599.128L106.611 529.497L106.611 38.8739L166.13 -2.91297e-05C166.13 -2.91297e-05 1064.64 1.81553 1062.52 0.427176Z"
            stroke="#00D2FC"
            strokeWidth="6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* LEFT LIGHT BARS */}
        <div className="absolute left-6 top-52 space-y-2 z-10">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-6 bg-cyan-400/80 shadow-[0_0_12px_rgba(0,200,255,0.9)]"
            />
          ))}
        </div>

        {/* RIGHT EDGE LIGHT */}
        <div className="absolute right-3 top-72 w-2 h-24 bg-cyan-400/70 shadow-[0_0_18px_rgba(0,200,255,0.9)] z-10" />

        {/* CONTENT */}
        <div className="relative z-20 h-full px-10 py-14 flex flex-col items-center text-white">

          {/* HUD PANEL */}
          <div className="w-full rounded-2xl bg-black/70 border border-cyan-400/30 p-6 flex flex-col items-center">

            {/* Avatar */}
            <div className="relative">
              <div className="absolute inset-0 rounded-xl blur-md bg-cyan-400/40" />
              <img
                src="https://images.unsplash.com/photo-1544005313-94ddf0286df2"
                alt="User"
                className="relative w-40 h-40 rounded-xl object-cover border border-cyan-300"
              />
            </div>

            {/* INFO BOX */}
            <div className="relative mt-8 w-full border border-cyan-400/60 p-5 space-y-3 text-sm tracking-wide text-center">
              <p className="text-cyan-300">
                Name - <span className="text-white">Lorem ipsum</span>
              </p>
              <p>Class - 8th A</p>
              <p>Age - 13</p>
              <p>Contact Number - 0987654321</p>
            </div>
          </div>

          {/* BUTTONS */}
          <div className="mt-8 w-full space-y-4">
            <button
              className="
                w-full py-4 rounded-xl
                bg-gradient-to-r from-cyan-300 to-blue-500
                text-black font-semibold text-lg
                shadow-[0_0_25px_rgba(0,200,255,0.8)]
                hover:scale-[1.03]
                transition
              "
            >
              Register user
            </button>

            <button
              className="
                w-full py-4 rounded-xl
                bg-black border border-cyan-400/40
                text-white/80
                hover:bg-cyan-400/10
                transition
              "
            >
              Go back
            </button>
          </div>

          {/* BOTTOM HOLOGRAM */}
          <div className="absolute bottom-[-40px] left-1/2 -translate-x-1/2">
            <img
              src={lightblub}
              alt="hologram"
              className="w-[280px] drop-shadow-[0_0_40px_rgba(0,200,255,0.8)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
