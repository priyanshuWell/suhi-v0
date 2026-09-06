import React, { useEffect } from "react"
import { useNavigate } from "react-router"
import splashVideo from "../assets/splashVideo.mp4"
// move the video into src/assets for proper bundling

const SplashScreen = () => {
    const navigate = useNavigate()

    useEffect(() => {
        const redirectTimeout = setTimeout(() => {
            navigate("/welcome")
        }, 7000) // match video length if needed

        return () => clearTimeout(redirectTimeout)
    }, [navigate])

    return (
        <div
            className="
      bg-[#F5F5F5]
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
                className="
                
                object-cover
                
                will-change-transform
              "
            />
        </div>
    )
}

export default SplashScreen
