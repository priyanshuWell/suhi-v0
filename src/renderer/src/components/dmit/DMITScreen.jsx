// import React from 'react'
// import bg1 from '../../assets/lightbg.png'
// import bg2 from '../../assets/dmt-bg.svg'

// const DMITScreen = () => {
//   return (
//     <div className="fixed inset-0 w-screen min-h-screen overflow-hidden bg-cover bg-center bg-black">
//       <div
//         className="
//           absolute inset-0
//           bg-no-repeat bg-cover bg-center
//           z-0
//         "
//         style={{ backgroundImage: `url(${bg1})` }}
//       />

//       <div
//         className="absolute landscape:top-[1vh] portrait:top-[6vh]
//           left-1/2 -translate-x-1/2
//           z-30  portrait:w-[80%] landscape:w-[40%]"
//       >
//         <p className="xl:text-5xl landscape:text-3xl text-center font-light leading-snug text-white tracking-wider ">
//           Drop the rods and fit front side of your right hand inside the frame on the screen, and
//           keep it still until the scan finishes
//           .
//         </p>
//       </div>

//       <div
//         className="
//           absolute landscape:bottom-[1vh] portrait:bottom-[4vh]
//           left-1/2 -translate-x-1/2
//           z-20
//         "
//       >
//         <p
//           className="xl:text-3xl landscape:text-xl text-center font-light leading-snug text-white tracking-wider   absolute  bottom-1/2
//           left-1/2 -translate-x-1/2"
//         >
//           Camera view and hand outline animation
//         </p>
//         <img
//           src={bg2}
//           alt="dmt background"
//           className="xl:w-[750px] landscape:w-[550px]  max-w-none h-auto"
//         />
//       </div>
//     </div>
//   )
// }

// export default DMITScreen
































// import React from 'react'
// import bg1 from '../../assets/lightbg.png'
// import bg2 from '../../assets/dmt-bg.svg'
// import handImg from '../../assets/Frame 1410084780.svg'   // ✅ hand outline image

// const DMITScreen = () => {
//   return (
//     <div className="fixed inset-0 w-screen min-h-screen overflow-hidden bg-cover bg-center bg-black">
//       <div
//         className="absolute inset-0 bg-no-repeat bg-cover bg-center z-0"
//         style={{ backgroundImage: `url(${bg1})` }}
//       />

//       {/* Top instruction text */}
//       <div
//         className="absolute landscape:top-[1vh] portrait:top-[6vh]
//           left-1/2 -translate-x-1/2
//           z-30  portrait:w-[80%] landscape:w-[40%]"
//       >
//         <p className="xl:text-5xl landscape:text-3xl text-center font-light leading-snug text-white tracking-wider">
//           Align the front of your right hand fully inside the box and keep it still until the scan
//           finishes.
//         </p>
//       </div>

//       {/* Frame + Hand */}
//       <div
//         className="absolute landscape:bottom-[1vh] portrait:bottom-[4vh]
//           left-1/2 -translate-x-1/2 z-20"
//       >
//         <p
//           className="xl:text-3xl landscape:text-xl text-center font-light leading-snug text-white tracking-wider
//           absolute bottom-1/2 left-1/2 -translate-x-1/2"
//         >
//           Camera view
//         </p>

//         {/* ✅ Make this relative so hand can be absolute */}
//         <div className="relative inline-block">
//           {/* Frame */}
//           <img
//             src={bg2}
//             alt="dmt background"
//             className="xl:w-[750px] landscape:w-[550px] max-w-none h-auto"
//           />

//           {/* ✅ Hand centered inside frame */}
//           <img
//             src={handImg}
//             alt="hand outline"
//             className="
//               absolute top-1/2 left-1/2
//               -translate-x-1/2 -translate-y-1/2
//               xl:w-[280px] landscape:w-[220px]
//               opacity-90
//             "
//           />
//         </div>
//       </div>
//     </div>
//   )
// }

// export default DMITScreen








































import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

import bg1 from "../../assets/lightbg.png";
import bg2 from "../../assets/dmt-bg.svg";

import rightFront from "../../assets/hands/left-front.svg";
import rightBack from "../../assets/hands/left-back.svg";

import leftFront from "../../assets/hands/right-front.svg";
import leftBack from "../../assets/hands/right-back.svg";

const API_BASE_URL = "http://127.0.0.1:8000";

// ✅ You can change this mapping any time
const mapCameras = (cams) => {
  // cams = video input devices list
  return [
    { role: "LEFT", cam: cams[2] },
    { role: "CENTER", cam: cams[0] },
    { role: "RIGHT", cam: cams[1] },
  ];
};

// ✅ Your 4 steps
const CAPTURE_FLOW = [
  { key: "LEFT_FRONT", label: "Left Hand - Front", role: "LEFT", overlay: leftFront },
  { key: "LEFT_BACK", label: "Left Hand - Back", role: "LEFT", overlay: leftBack },
  { key: "RIGHT_FRONT", label: "Right Hand - Front", role: "RIGHT", overlay: rightFront },
  { key: "RIGHT_BACK", label: "Right Hand - Back", role: "RIGHT", overlay: rightBack },
];

const DMITScreen = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  const [devices, setDevices] = useState([]);
  const [mapped, setMapped] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);

  const [status, setStatus] = useState("Preparing camera...");
  const [isRecording, setIsRecording] = useState(false);

  const currentStep = CAPTURE_FLOW[stepIndex];

  // ✅ Load cameras list
  useEffect(() => {
    const loadDevices = async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = all.filter((d) => d.kind === "videoinput");

        setDevices(videoInputs);

        const mappedCams = mapCameras(videoInputs);
        setMapped(mappedCams);
      } catch (err) {
        console.error("enumerateDevices error:", err);
        setStatus("Camera devices not accessible");
      }
    };

    loadDevices();
  }, []);

  // ✅ Get camera deviceId by role
  const getCameraForRole = (role) => {
    const camObj = mapped.find((m) => m.role === role);
    return camObj?.cam?.deviceId;
  };

  // ✅ Start camera in the box
  const startCamera = async (role) => {
    try {
      setStatus("Opening camera...");
      const deviceId = getCameraForRole(role);

      if (!deviceId) {
        throw new Error(`Camera not found for role: ${role}`);
      }

      // stop previous
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: 1280, height: 720 },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus(`Camera ready: ${currentStep.label}`);
    } catch (err) {
      console.error("startCamera error:", err);
      setStatus("Failed to open camera");
    }
  };

  // ✅ Record buffer for 5 seconds
  const record5SecBuffer = async () => {
    return new Promise((resolve, reject) => {
      try {
        const stream = streamRef.current;
        if (!stream) return reject(new Error("No stream found"));

        const chunks = [];
        const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });

        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          resolve(blob);
        };

        recorder.onerror = (e) => reject(e);

        recorder.start();
        setIsRecording(true);
        setStatus(`Recording 5 seconds... (${currentStep.label})`);

        setTimeout(() => {
          recorder.stop();
          setIsRecording(false);
        }, 5000);
      } catch (err) {
        reject(err);
      }
    });
  };

  // ✅ Upload buffer to API
  const uploadBuffer = async (blob) => {
    setStatus("Uploading buffer...");
    const file = new File([blob], `${currentStep.key}.webm`, { type: "video/webm" });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("handType", currentStep.key); // you can rename
    formData.append("role", currentStep.role);

    const res = await axios.post(`${API_BASE_URL}/sync/cloud-to-local`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return res.data;
  };

  // ✅ Main step runner
  const runStep = async () => {
    if (!currentStep) return;

    try {
      // 1. Open correct camera based on step role
      await startCamera(currentStep.role);

      // 2. wait 500ms for stable stream
      await new Promise((r) => setTimeout(r, 500));

      // 3. record 5 sec
      const buffer = await record5SecBuffer();

      // 4. upload
      const result = await uploadBuffer(buffer);

      // 5. success -> next
      setStatus("Success ✅ moving next...");

      await new Promise((r) => setTimeout(r, 800));

      if (stepIndex < CAPTURE_FLOW.length - 1) {
        setStepIndex((prev) => prev + 1);
      } else {
        setStatus("All 4 buffers captured successfully ✅");
        // optionally navigate next page here
      }
    } catch (err) {
      console.error("runStep error:", err);
      setStatus("Error occurred. Retrying...");
      setTimeout(() => runStep(), 1500);
    }
  };

  // ✅ Run every time step changes
  useEffect(() => {
    if (!mapped.length) return; // wait until mapping is ready
    runStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, mapped]);

  // ✅ Cleanup
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 w-screen min-h-screen overflow-hidden bg-black">
      {/* background */}
      <div
        className="absolute inset-0 bg-no-repeat bg-cover bg-center z-0"
        style={{ backgroundImage: `url(${bg1})` }}
      />

      {/* top text */}
      <div
        className="absolute landscape:top-[1vh] portrait:top-[6vh]
        left-1/2 -translate-x-1/2 z-30
        portrait:w-[80%] landscape:w-[40%]"
      >
        <p className="xl:text-5xl landscape:text-3xl text-center font-light leading-snug text-white tracking-wider">
          Align the front of your right hand fully inside the box and keep it still until the scan
          finishes.
        </p>
      </div>

      {/* frame section */}
      <div
        className="absolute landscape:bottom-[1vh] portrait:bottom-[4vh]
        left-1/2 -translate-x-1/2 z-20"
      >
        {/* status */}
        <p
          className="xl:text-3xl landscape:text-xl text-center font-light leading-snug text-white tracking-wider
          absolute bottom-1/2 left-1/2 -translate-x-1/2"
        >
          {status}
        </p>

        <div className="relative inline-block">
          {/* outer frame */}
          <img
            src={bg2}
            alt="dmit frame"
            className="xl:w-[750px] landscape:w-[550px] max-w-none h-auto"
          />

          {/* ✅ CAMERA INSIDE THE RECTANGLE ONLY */}
          <div
            className="
              absolute top-[14%] left-1/2 -translate-x-1/2
              w-[72%] h-[66%]
              rounded-xl overflow-hidden
              bg-black
            "
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>

          {/* ✅ Hand overlay centered inside camera box */}
          <img
            src={currentStep?.overlay}
            alt="hand overlay"
            className="
              absolute top-[47%] left-1/2
              -translate-x-1/2 -translate-y-1/2
              xl:w-[280px] landscape:w-[220px]
              opacity-90 pointer-events-none
            "
          />

          {/* small label */}
          <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2">
            <p className="text-white text-lg tracking-wide font-light">
              {currentStep?.label} {isRecording ? "●" : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DMITScreen;
