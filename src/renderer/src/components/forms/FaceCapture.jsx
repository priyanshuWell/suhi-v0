import React, { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router"
import { useDispatch, useSelector } from "react-redux"

import bg1 from "../../assets/lightbg.png"
import bg3 from "../../assets/facecapture-bg.svg"
import cameraRing from "../../assets/camera-ring.png"

import { getCameraSession, openCamerasInBackground } from "../../utils/cameraSession"
import { realtimeCapture } from "../../utils/api"
import { setUser, setLoginScreening } from "../../features/common/commonSlice"
import { getNextRoute } from "../../utils/stageRouter"

import ErrorAlert from "../ErrorAlert"

function FaceCapture() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const screening = useSelector((state) => state.common.screening)

    const videoRef = useRef(null)
    const captureStarted = useRef(false)

    const [status, setStatus] = useState("Initializing...")
    const [showError, setShowError] = useState(false)
    const [errorDetails, setErrorDetails] = useState("")

    useEffect(() => {
        const initCamera = async () => {
            try {
                let sessions

                try {
                    sessions = getCameraSession()
                } catch (e) {
                    console.log("Cameras not initialized, opening now...", e)
                    sessions = await openCamerasInBackground()
                }

                const centerCam = sessions.find((s) => s.role === "CENTER")
                console.log("centerCam", centerCam)

                if (centerCam && videoRef.current) {
                    videoRef.current.srcObject = centerCam.stream

                    await videoRef.current.play().catch((e) => console.error("Play error:", e))
                }
            } catch (error) {
                console.error("Failed to get camera session:", error)
                setStatus(`Camera error: ${error.message}`)
            }
        }
        initCamera()
    }, [])

    // useEffect(() => {
    //   setTimeout(() => {
    //     startRealtimeCapture()
    //   }, 2000)
    // }, [])

    console.log("Rendering FaceCapture component")

    const startRealtimeCapture = async () => {
        // if (captureStarted.current) return;

        // captureStarted.current = true;

        try {
            setStatus("Scanning face...")

            const response = await realtimeCapture()

            if (!response.success) {
                throw new Error(response.error || "Realtime capture failed")
            }

            if (response.student_status === "NOT_REGISTERED") {
                throw new Error("User not registered")
            }

            if (response.student_status === "REGISTERED") {
                dispatch(setUser(response))
                // FaceCapture calls realtime/capture — this IS the login step.
                //    Was previously missing entirely, leaving Redux screening stale/null
                //    and breaking the nextStage check immediately below.
                dispatch(setLoginScreening(response.screening || null))

                // If this is a resumed session, skip the RegisterCard and go straight to next stage
                //  Read directly from the fresh API response rather than Redux —
                //    avoids any risk of using a stale value before the dispatch above
                //    has been applied to the store.
                if (response.screening?.is_resumed && response.screening?.next_stage) {
                    const nextRoute = getNextRoute(response.screening.next_stage, "/bia/leg50")
                    console.log(
                        "[FaceCapture] Resumed session: navigating to next stage:",
                        nextRoute
                    )
                    navigate(nextRoute)
                } else {
                    navigate("/verified")
                }
                return
            }

            throw new Error("Face not recognized")
        } catch (error) {
            console.error("Realtime capture failed:", error)

            setErrorDetails(error.message)
            setShowError(true)
        }
    }

    const handleErrorClose = () => {
        setShowError(false)
        navigate("/facecapture")
    }

    return (
        <>
            <div className="fixed inset-0 w-screen min-h-screen overflow-hidden font-anta">
                {/* Background */}
                <div
                    className="absolute inset-0 bg-no-repeat bg-cover bg-center z-0"
                    style={{ backgroundImage: `url(${bg1})` }}
                />

                {/* Frame section */}
                {/* Frame section */}
                <div className="absolute top-13 left-1/2 -translate-x-1/2 z-20">
                    <div className="relative inline-block bg-black">
                        {/* Camera preview — z-10 (neeche) */}
                        {/* <div
              className="
        absolute top-[13%] left-1/2 -translate-x-1/2
        w-[83%] h-[81%]
        rounded-xl overflow-hidden bg-black
        z-10
      "
            >
               <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              /> 
          </div> */}

                        {/* SVG Frame — z-20 (upar, camera ko overlap karega) */}
                        <img
                            src={bg3}
                            alt="face capture frame"
                            className="w-[1010px] max-w-none h-auto relative z-20"
                        />
                    </div>
                </div>

                {/* Error popup */}
                {/* <ErrorAlert
          title={
            errorDetails === "User not registered"
              ? "User Not Registered"
              : "Verification Failed"
          }
          description={
            errorDetails === "User not registered"
              ? "User is not registered in the system. Redirecting to manual login..."
              : "Face not recognized. Redirecting to manual login..."
          }
          visible={showError}
          onClose={handleErrorClose}
          onRetry={handleErrorClose}
          autoRetryDelay={3000}
        /> */}
            </div>

            {/* Camera Ring + Preview — ek saath */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                <div className="relative inline-block">
                    {/* Camera preview — oval ke andar clip */}
                    <div
                        style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: "95%",
                            height: "95%",
                            overflow: "hidden",
                            borderRadius: "50%" // oval crop
                        }}
                    >
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover scale-x-[-1] "
                        />
                    </div>

                    {/* Camera ring SVG — upar */}
                    <img
                        src={cameraRing}
                        alt="camera ring"
                        className="relative z-20 w-[650px] max-w-none h-auto"
                    />
                </div>
            </div>
        </>
    )
}

export default FaceCapture
