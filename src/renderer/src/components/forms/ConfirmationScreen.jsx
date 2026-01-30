import React, { useEffect, useState } from 'react'
import lightbg from '../../assets/lightbg.png'
import projector from '../../assets/projector.png'
import frame1 from '../../assets/verfied-frame.svg'
import profilepic2 from '../../assets/User2.png'
import { useSelector } from 'react-redux'
import StartButton from '../ui/BlueGradientButton'
import GradientButton from '../ui/BlackGradientButton'

export default function ConfirmationScreen() {
  const user = useSelector((state) => state.common.user)

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center">
      {/* Card Wrapper */}
      <div
        className="relative w-[1800px] h-[1400px] bg-cover bg-center"
        style={{ backgroundImage: `url(${lightbg})` }}
      >
        <div className="inset-0 fixed top-0 left-0 w-full min-h-screen z-10 bg-black/50">

        </div>
        <div
          className="
          absolute top-15
          left-1/2 -translate-x-1/2
          z-20
          
        "
        >
          <img src={frame1} alt="dmt background" className="w-[830px] max-w-none h-auto" />
        </div>

        <div
          className="flex flex-col items-center gap-18 absolute top-[160px]
          left-1/2 -translate-x-1/2
          z-30 "
        >
          <img
            src={profilepic2}
            onError={(e) => {
              e.currentTarget.src = profilepic
            }}
            alt="profile pic"
            className="w-full portrait:max-w-98 h-auto object-cover rounded-3xl"
          />

          {/* text */}
          <div className="text flex flex-col items-center ">
            <p className="text-white text-3xl tracking-wide leading-relaxed">Name: Lorem ipsum</p>
            <p className="text-white text-3xl tracking-wide leading-relaxed">Class: 8th A</p>
            <p className="text-white text-3xl tracking-wide leading-relaxed">Age: 20</p>
            <p className="text-white text-3xl tracking-wide leading-relaxed">
              Contact Number: 987654321
            </p>
          </div>

          <div className="buttons flex flex-col gap-y-10">
            <StartButton width="w-[clamp(16rem,32vw,31.25rem)]">Register User</StartButton>
            <GradientButton width="w-[clamp(16rem,32vw,31.25rem)]"> Go Back</GradientButton>
          </div>
        </div>
      </div>
      <div className="absolute bottom-[4rem] w-[750px] left-1/2  -translate-x-1/2">
        <img
          src={projector}
          alt="projector"
          className=" drop-shadow-[0_0_40px_rgba(0,200,255,0.8)]"
        />
      </div>
    </div>
  )
}
