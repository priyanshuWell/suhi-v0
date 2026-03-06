import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useDispatch } from 'react-redux'
import bg1 from '../../assets/lightbg.png'
import bg3 from '../../assets/facecapture-bg.svg'
import { getCameraSession, openCamerasInBackground } from '../../utils/cameraSession'
import { recordFromOpenCameras } from '../../utils/recordSession'
import { getVideoDuration, getKioskId } from '../../utils/config'
import { runFPT, sendVideoToBackend } from '../../utils/api'
import { setUser } from '../../features/common/commonSlice'
import ErrorAlert from '../ErrorAlert'

function FaceCapture() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const videoRef = useRef(null)
  const [status, setStatus] = useState('Initializing...')
  const [showError, setShowError] = useState(false)
  const [errorDetails, setErrorDetails] = useState('')

  useEffect(() => {
    const initCamera = async () => {
      try {
        let sessions;
        try {
            sessions = getCameraSession()
            
        } catch (e) {
            console.log("Cameras not initialized, opening now...", e);
            sessions = await openCamerasInBackground();
        }

        const centerCam = sessions.find((s) => s.role === 'CENTER')
        
        if (centerCam && videoRef.current) {
          videoRef.current.srcObject = centerCam.stream
          // Ensure video plays
          await videoRef.current.play().catch(e => console.error("Play error:", e));
        }

        // Auto-start verification process after a short delay
        setTimeout(() => startVerification(), 2000)
      } catch (error) {
        console.error('Failed to get camera session:', error)
        setStatus(`Camera error: ${error.message}`)
      }
    }

    initCamera()
  }, [])

  const startVerification = async () => {
    try {
      setStatus('Recording...')
      const videoDuration = getVideoDuration()
      const kioskId = getKioskId()

      const recordings = await recordFromOpenCameras(videoDuration)
      
      if (!recordings || recordings.length === 0) {
        throw new Error('No recordings captured')
      }

      setStatus('Processing...')
      const videoToSend = recordings.find((r) => r.role === 'CENTER') || recordings[0]
      
      const storeResponse = await sendVideoToBackend(videoToSend)
      const shmPath = storeResponse?.data?.shm_path

      if (!storeResponse?.success || !shmPath) {
        throw new Error('Failed to process video')
      }

      const fptResponse = await runFPT(shmPath, kioskId)
      
      // Check if user is not registered
      // if (fptResponse?.data?.student_status === 'NOT_REGISTERED') {
      //   throw new Error('User not registered')
      // }

      const errorStatus = fptResponse?.status || fptResponse?.statusCode
      const isFaceNotRecognized = errorStatus === 502 || errorStatus === 503 || !fptResponse.success

      if (isFaceNotRecognized) {
        throw new Error('Face not recognized')
      }

      // Success
      dispatch(setUser(fptResponse))
      navigate('/verified')

    } catch (error) {
      console.error('Verification failed:', error)
      setErrorDetails(error.message)
      setShowError(true)
    }
  }

  const handleErrorClose = () => {
    setShowError(false)
    // On close/failure, redirect to login-suhi as per requirement
    navigate('/login-suhi')
  }

  return (
    <>
      <div className="fixed inset-0 w-screen min-h-screen overflow-hidden bg-black font-['Share_Tech_Mono']">
        {/* background */}
        <div
          className="absolute inset-0 bg-no-repeat bg-cover bg-center z-0"
          style={{ backgroundImage: `url(${bg1})` }}
        />
     
        {/* frame section - matching NewDmit pattern */}
        <div className="absolute bottom-[20px] left-1/2 -translate-x-1/2 z-20">
          <div className="relative inline-block">
            {/* outer frame */}
            <img src={bg3} alt="face capture frame" className="w-[900px] max-w-none h-auto" />

            {/* camera preview inside frame */}
            <div
              className="
                absolute top-[14%] left-1/2 -translate-x-1/2
                w-[77%] h-[70%]
                rounded-xl overflow-hidden bg-black
              "
            >
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
            </div>

            {/* frame image - ON TOP */}
            {/* <img src={bg3} alt="dmit frame" className="relative z-20 w-full max-w-none h-auto pointer-events-none" /> */}

          </div>
           <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2">
              <p className="text-white text-lg tracking-wide font-light">
                {status}
              </p>
            </div>
        </div>

        <ErrorAlert
            title={errorDetails === 'User not registered' ? 'User Not Registered' : 'Verification Failed'}
            description={
              errorDetails === 'User not registered'
                ? 'User is not registered in the system. Redirecting to manual login...'
                : 'Face not recognized. Redirecting to manual login...'
            }
            visible={showError}
            onClose={handleErrorClose}
            onRetry={handleErrorClose} 
            autoRetryDelay={3000}
        />
      </div>
    </>
  )
}

export default FaceCapture
