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
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { getRgbCamera } from "../../utils/getRgbCamera";

import bg1 from "../../assets/lightbg.png";
import bg2 from "../../assets/dmt-bg.svg";

import rightFront from "../../assets/hands/left-front.svg";
import rightBack from "../../assets/hands/left-back.svg";

import leftFront from "../../assets/hands/right-front.svg";
import leftBack from "../../assets/hands/right-back.svg";
import lpAudio from "../../assets/audio/lp.mp3";
import lbAudio from "../../assets/audio/lb.mp3";
import rpAudio from "../../assets/audio/rp.mp3";
import rbAudio from "../../assets/audio/rb.mp3";

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
  { key: "LEFT_FRONT", labelKey: "dmit.hand_labels.left_front", role: "LEFT", overlay: leftFront, audio: lpAudio },
  { key: "LEFT_BACK", labelKey: "dmit.hand_labels.left_back", role: "LEFT", overlay: leftBack, audio: lbAudio },
  { key: "RIGHT_FRONT", labelKey: "dmit.hand_labels.right_front", role: "RIGHT", overlay: rightFront, audio: rpAudio },
  { key: "RIGHT_BACK", labelKey: "dmit.hand_labels.right_back", role: "RIGHT", overlay: rightBack, audio: rbAudio },
];

const DMITScreen = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);

  const [devices, setDevices] = useState([]);
  const [mapped, setMapped] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);

  const [status, setStatus] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const currentStep = CAPTURE_FLOW[stepIndex];


  // ✅ Load cameras list
  useEffect(() => {
    const loadDevices = async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = all.filter((d) => d.kind === "videoinput");
        console.log("[CAMERA] DMITScreen devices:", videoInputs.map((d) => d.label));

        // Use RGB camera as CENTER; keep LEFT/RIGHT from index mapping if needed
        const rgbDeviceId = await getRgbCamera();
        const rgbCam = videoInputs.find((d) => d.deviceId === rgbDeviceId) ?? videoInputs[0];

        setDevices(videoInputs);
        setMapped([
          { role: "LEFT", cam: rgbCam },
          { role: "CENTER", cam: rgbCam },
          { role: "RIGHT", cam: rgbCam },
        ]);

        console.log("[CAMERA] DMITScreen → using camera:", rgbCam?.label, "for all roles");
      } catch (err) {
        console.error("enumerateDevices error:", err);
        setStatus(t('dmit.status.failed_camera'));
      }
    };

    loadDevices();
  }, []);
  useEffect(() => {
    if (currentStep) {
      playAudio(currentStep.audio);
    }
  }, [stepIndex]);

  const playAudio = (audioPath) => {
    if (audioRef.current) {
      audioRef.current.src = audioPath;
      setIsAudioPlaying(true);
      audioRef.current.play().catch((err) => {
        console.log("Audio playback failed:", err);
      });
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAudioPlaying(false);
    }
  };

  const handleAudioEnd = () => {
    setIsAudioPlaying(false);
  };

  // ✅ Get camera deviceId by role
  const getCameraForRole = (role) => {
    const camObj = mapped.find((m) => m.role === role);
    return camObj?.cam?.deviceId;
  };

  // ✅ Start camera in the box
  const startCamera = async (role) => {
    try {
      setStatus(t('dmit.status.opening'));
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

      setStatus(`${t('dmit.status.ready')}: ${t(currentStep.labelKey)}`);
    } catch (err) {
      console.error("startCamera error:", err);
      setStatus(t('dmit.status.failed_camera'));
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
        setStatus(`${t('dmit.status.recording')} (${t(currentStep.labelKey)})`);

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
    setStatus(t('dmit.status.uploading'));
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
      setStatus(t('dmit.status.success'));

      await new Promise((r) => setTimeout(r, 800));

      if (stepIndex < CAPTURE_FLOW.length - 1) {
        setStepIndex((prev) => prev + 1);
      } else {
        setStatus(t('dmit.status.all_captured'));
        // Navigate to voice analysis
        await new Promise((r) => setTimeout(r, 1000));
        navigate("/voice");
      }
    } catch (err) {
      console.error("runStep error:", err);
      setStatus(t('dmit.status.error'));
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
      stopAudio();
    };
  }, []);

  return (
    <div className="fixed inset-0 w-screen min-h-screen overflow-hidden bg-black">
      <audio
        ref={audioRef}
        onEnded={handleAudioEnd}
        onPlay={() => setIsAudioPlaying(true)}
      >
        <source src={currentStep?.audio} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
      {/* background */}
      <div
        className="absolute inset-0 bg-no-repeat bg-cover bg-center z-0"
        style={{ backgroundImage: `url(${bg1})` }}
      />

      {/* top text */}
      <div
        className="absolute top-[20px]
        left-1/2 -translate-x-1/2 z-30
        w-[600px]"
      >
        <p className="text-5xl text-center font-light leading-snug text-white tracking-wider">
          {t('dmit.instruction')}
        </p>
      </div>

      {/* frame section */}
      <div
        className="absolute bottom-[20px]
        left-1/2 -translate-x-1/2 z-20"
      >
        {/* status */}
        <p
          className="text-3xl text-center font-light leading-snug text-white tracking-wider
          absolute bottom-1/2 left-1/2 -translate-x-1/2"
        >
          {status}
        </p>

        <div className="relative inline-block">
          {/* outer frame */}
          <img
            src={bg2}
            alt="dmit frame"
            className="w-[750px] max-w-none h-auto"
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
              //muted
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
              w-[280px]
              opacity-90 pointer-events-none
            "
          />

          {/* small label */}
          <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2">
            <p className="text-white text-lg tracking-wide font-light">
              {t(currentStep?.labelKey)} {isRecording ? "●" : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DMITScreen;
