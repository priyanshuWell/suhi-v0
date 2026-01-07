import React from 'react'
import bg1 from '../../assets/lightbg.png'
import bg2 from '../../assets/dmt-bg.svg'

const DMITScreen = () => {
  return (
    <div className="fixed inset-0 w-screen min-h-screen overflow-hidden bg-cover bg-center bg-black">
      <div
        className="
          absolute inset-0
          bg-no-repeat bg-cover bg-center
          z-0
        "
        style={{ backgroundImage: `url(${bg1})` }}
      />

      <div
        className="absolute landscape:top-[1vh] portrait:top-[6vh]
          left-1/2 -translate-x-1/2
          z-30  portrait:w-[80%] landscape:w-[40%]"
      >
        <p className="xl:text-5xl landscape:text-3xl text-center font-light leading-snug text-white tracking-wider ">
          Drop the rods and fit front side of your right hand inside the frame on the screen, and
          keep it still until the scan finishes.
        </p>
      </div>

      <div
        className="
          absolute landscape:bottom-[1vh] portrait:bottom-[4vh]
          left-1/2 -translate-x-1/2
          z-20
        "
      >
        <p
          className="xl:text-3xl landscape:text-xl text-center font-light leading-snug text-white tracking-wider   absolute  bottom-1/2
          left-1/2 -translate-x-1/2"
        >
          Camera view and hand outline animation
        </p>
        <img
          src={bg2}
          alt="dmt background"
          className="xl:w-[750px] landscape:w-[550px]  max-w-none h-auto"
        />
      </div>
    </div>
  )
}

export default DMITScreen
