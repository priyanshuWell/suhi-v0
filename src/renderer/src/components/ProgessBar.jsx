import PropTypes from 'prop-types'
import lightbg from '../assets/lightbg.png'
// import textframe from '../assets/text-frame1.png'
import video1 from "../assets/videos/measureHeightWeight.mp4";
import progressBg from '../assets/progress-bg.svg'

const Progressbar = ({ percent = 50, total = 28 }) => {
  const activeCount = Math.round((percent / 100) * total)

  return (
    <div
      className="fixed inset-0
        w-screen h-screen
        overflow-hidden
        bg-black"
    >
      {/* Card Wrapper */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${lightbg})` }}
      />

      {/* head text */}
      {/* <div className="absolute left-1/2 portrait:top-[7vh] landscape:top-[5vh] -translate-x-1/2 portrait:w-[85%] landscape:w-1/2 flex flex-col items-center">
        <img src={textframe} alt="text-frame" />
        <p className="head-txt text-white text-center portrait:text-[40px] xl:text-[35px]  2xl:text-2xl tracking-wider my-6 2xl:my-4">
          Height and Weight and Measurement
        </p>
        <img src={textframe} alt="text-frame" className="rotate-180" />
      </div> */}

      {/* instructions */}
      <p className="absolute portrait:top-[20%] landscape:top-[21%] left-1/2 -translate-x-1/2 text-white portrait:text-[40px] xl:text-[35px]  2xl:text-2xl text-center tracking-wider leading-relaxed w-full">
        Stand straight on the platform, facing forward.
      </p>

      {/* progress bar */}
      <div className="z-10 flex items-center justify-center absolute landscape:left-1/2 portrait:left-[47%] portrait:top-[25%] 2xl:top-[20%] landscape:-translate-7 ">
        <div className="progress-bg  absolute landscape:w-96 portrait:w-114 landscape:top-1/2 portrait:top-[47%]">
          <img src={progressBg} alt="progress-bar-frame" className="max-w-full h-auto" />
        </div>
        <div className="flex flex-col xl:h-80 2xl:h-70 w-20  -rotate-90  overflow-y-clip landscape:mt-1">
          {Array.from({ length: total }).map((_, i) => {
            const isActive = i < activeCount
            return (
              <div
                key={i}
                className={`h-10  w-10 2xl:w-8 mb-1  xl:skew-y-35 2xl:skew-y-35 last:mb-0 transition-all duration-300 ${isActive ? 'bg-[#368CC9] ' : 'bg-[#0F324D]'
                  }`}
              />
            )
          })}
        </div>
      </div>

      {/* video */}
      <div className="absolute left-1/2 -translate-1/2 top-[70%]">
        <video
          src={video1}
          autoPlay
          muted
          loop
          playsInline
          className="
                
                    w-full h-full
                    object-contain
                    max-w-125
                    rounded-4xl
                    max-h-[60vh]
                    will-change-transform
                  "
        ></video>
      </div>
    </div>
  )
}

Progressbar.propTypes = {
  percent: PropTypes.number,
  total: PropTypes.number
}

export default Progressbar