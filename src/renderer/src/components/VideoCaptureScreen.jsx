import React, { useEffect, useState } from "react";
import bg from "../assets/background.png";
import video2 from "../assets/avatar2.mp4";
import { useNavigate } from "react-router";
import { recordFromOpenCameras } from "../utils/recordSession";

 const VideoCaptureScreen = () => {
    const navigate = useNavigate()
    const [isVerify,setIsVerify] = useState(false);
     const [phase,setPhase] = useState('');
    useEffect(() => {
  const run = async () => {
    await new Promise(r => setTimeout(r, 1000)); // avatar lead-in

    const recordings = await recordFromOpenCameras(5000);
    console.log("recording",recordings)
    const res = await window.api.sendFaceCapture({
      session_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      cameras: recordings
    });
    console.log("res",res)
    if(res.success){
         await new Promise(r => setTimeout(r, 1000)); 
        navigate('/verified')
    }
  };
  run().catch(() => setPhase("ERROR"));
}, []);

  return (
    <div
      className="
        fixed inset-0
        w-screen h-screen
        overflow-hidden
        bg-black
      "
    >
      <div
        className="
        border-0
        rounded-2xl
          absolute inset-0
          flex items-center justify-center
          z-10
          pointer-events-none
        "
      >
        <video
          src={video2}
          autoPlay
          muted
          loop
          playsInline
          className="
             rounded-2xl
            w-full h-full
            object-contain
            max-w-[97vw]
            max-h-[97vh]
            will-change-transform
          "
        />
      </div>
    </div>
  );
};
 
export default VideoCaptureScreen







