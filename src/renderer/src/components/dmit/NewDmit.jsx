import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
// import { useNavigate } from "react-router-dom";

import bg1 from "../../assets/lightbg.png";
import bg2 from "../../assets/dmt-bg.svg";

// import rightFront from "../../assets/hands/left-front.svg";
// import rightBack from "../../assets/hands/left-back.svg";

// import leftFront from "../../assets/hands/right-front.svg";
// import leftBack from "../../assets/hands/right-back.svg";


import leftFront from "../../assets/hands/left-front.svg";
import leftBack from "../../assets/hands/left-back.svg";

import rightFront from "../../assets/hands/right-front.svg";
import rightBack from "../../assets/hands/right-back.svg";
import lpAudio from "../../assets/audio/lp.mp3";
import lbAudio from "../../assets/audio/lb.mp3";
import rpAudio from "../../assets/audio/rp.mp3";
import rbAudio from "../../assets/audio/rb.mp3";


import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { getRgbCamera } from "../../utils/getRgbCamera";

const API_BASE_URL = "http://127.0.0.1:8000";

/**
 * :white_check_mark: 4 Steps (single camera only)
 * handPayload will go into /register/hand payload
 */
const CAPTURE_FLOW = [
  {
    key: "LEFT_FRONT",
    label: "Left Hand - Front",
    overlay: leftFront,
    handPayload: "LP",
    audio: lpAudio
  },
  {
    key: "LEFT_BACK",
    label: "Left Hand - Back",
    overlay: leftBack,
    handPayload: "LB",
    audio: lbAudio
  },
  {
    key: "RIGHT_FRONT",
    label: "Right Hand - Front",
    overlay: rightFront,
    handPayload: "RP",
    audio: rpAudio
  },
  {
    key: "RIGHT_BACK",
    label: "Right Hand - Back",
    overlay: rightBack,
    handPayload: "RB",
    audio: rbAudio
  },
];

const NewDmitScreen = () => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.common.user);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rawStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const runLockRef = useRef(false);
  const audioRef = useRef(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const [status, setStatus] = useState("Preparing camera...");
  const [isRecording, setIsRecording] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // :white_check_mark: for status UI
  const [phase, setPhase] = useState("INFO"); // INFO | ERROR
  const [isVerify, setIsVerify] = useState(false);

  const currentStep = CAPTURE_FLOW[stepIndex];

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

  useEffect(() => {
    if (currentStep && currentStep.audio) {
      playAudio(currentStep.audio);
    }
  }, [stepIndex]);

  // :white_check_mark: required payload values (replace with your real values / redux / localstorage)
  const kioskId = "KIOSK_001";
  const userId = user?.data?.user_id;
  const sessionId = "session001";

  /**
   * :white_check_mark: Start ONLY ONE camera: cams[1]
   * :white_check_mark: Rotate stream 90 degree
   */
  const startSingleCamera = async () => {
    try {
      setPhase("INFO");
      setIsVerify(false);
      setStatus("Opening camera...");

      // ✅ Prefer RGB camera; fall back to first available
      const deviceId = await getRgbCamera();
      if (!deviceId) throw new Error("No cameras found");

      // ✅ stop old streams if any
      if (rawStreamRef.current) {
        rawStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (streamRef.current) {
        if (typeof streamRef.current.stop === "function") streamRef.current.stop();
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const rawStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: 640,
          height: 480,
          frameRate: 30,
        },
        audio: false,
      });

      // ✅ rotate 90 degrees
      const rotatedStream = await rotateStream90(rawStream);

      streamRef.current = rotatedStream;

      if (videoRef.current) {
        videoRef.current.srcObject = rotatedStream;
        await videoRef.current.play();
      }

      setIsCameraReady(true);
      setStatus("Camera ready ✅");
    } catch (err) {
      console.error("startSingleCamera error:", err);
      setPhase("ERROR");
      setStatus("Failed to open camera");
      setIsCameraReady(false);
    }
  };

  /**
   * :white_check_mark: Record 5 seconds buffer
   */
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

  /**
   * :white_check_mark: API 1: /hand/store  -> returns shm_path
   */
  const storeHandBuffer = async (blob) => {
    setPhase("INFO");
    setIsVerify(false);
    setStatus("Storing buffer...");

    const file = new File([blob], `${currentStep.key}.webm`, {
      type: "video/webm",
    });

    const formData = new FormData();
    formData.append("file", file);
    // formData.append("handType", currentStep.key);

    const res = await axios.post(`${API_BASE_URL}/hand/store`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const shmPath = res?.data?.shm_path;
    if (!shmPath) throw new Error("shm_path not found in /hand/store response");

    return shmPath;
  };

  /**
   * :white_check_mark: API 2: /register/hand
   * :white_check_mark: Trigger request but DO NOT WAIT for response
   * :white_check_mark: only show status for max 5 seconds, then continue next step anyway
   */
  const fireRegisterHandWith5SecWindow = (shmPath) => {
    setPhase("INFO");
    setIsVerify(false);
    setStatus("Registering hand...");

    const payload = {
      shm_path: shmPath,
      kiosk_id: kioskId,
      user_id: userId,
      session_id: sessionId,
      hand: currentStep.handPayload,
    };

    // :white_check_mark: fire request (do not await)
    axios
      .post(`${API_BASE_URL}/hand/run`, payload, {
        headers: { "Content-Type": "application/json" },
      })
      .then(() => {
        // if response arrives within 5 sec, show green
        setIsVerify(true);
        setPhase("INFO");
        setStatus("Hand registered :white_check_mark:");
      })
      .catch((err) => {
        console.error("/register/hand error:", err);
        setPhase("ERROR");
        setStatus("Register failed :x: (moving next)");
      });

    // :white_check_mark: always continue after 5 sec
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 5000);
    });
  };

  /**
   * :white_check_mark: Main Step Runner
   */
  const runStep = async () => {
    if (!currentStep) return;
    if (!streamRef.current) return;
    if (runLockRef.current) return;

    runLockRef.current = true;

    try {
      // :white_check_mark: small settle time
      await new Promise((r) => setTimeout(r, 400));

      // 1) record 5 sec
      const bufferBlob = await record5SecBuffer();

      // 2) store => shm_path
      const shmPath = await storeHandBuffer(bufferBlob);

      // 3) register and wait max 5 sec only
      await fireRegisterHandWith5SecWindow(shmPath);

      // 4) next
      if (stepIndex < CAPTURE_FLOW.length - 1) {
        setStepIndex((prev) => prev + 1);
      } else {
        setPhase("INFO");
        setIsVerify(true);
        setStatus("All hands completed :white_check_mark: Redirecting...");
        stopAudio();
        setTimeout(() => {
          navigate("/voice");
        }, 700);
      }
    } catch (err) {
      console.error("runStep error:", err);
      setPhase("ERROR");
      setStatus("Error occurred. Retrying...");
      setTimeout(() => {
        runLockRef.current = false;
        runStep();
      }, 1500);
      return;
    }

    runLockRef.current = false;
  };

  /**
   * :white_check_mark: open camera once on mount
   */
  useEffect(() => {
    startSingleCamera();

    return () => {
      // ✅ Release both raw and rotated streams
      if (rawStreamRef.current) {
        rawStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (streamRef.current) {
        if (typeof streamRef.current.stop === "function") streamRef.current.stop();
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * :white_check_mark: run step only when camera is ready and step changes
   */
  useEffect(() => {
    if (!isCameraReady) return;
    runStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, isCameraReady]);

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
      <div className="absolute top-[20px] left-1/2 -translate-x-1/2 z-30 w-[600px]">
        <p className="text-5xl text-center font-light leading-snug text-white tracking-wider">
          Align your hand inside the box and keep it still until the scan finishes.
        </p>
      </div>

      {/* frame section */}
      <div className="absolute bottom-[20px] left-1/2 -translate-x-1/2 z-20">
        <div className="relative inline-block">
          {/* outer frame */}
          <img src={bg2} alt="dmit frame" className="w-[750px] max-w-none h-auto" />

          {/* camera */}
          <div
            className="
              absolute top-[14%] left-1/2 -translate-x-1/2
              w-[72%] h-[66%]
              rounded-xl overflow-hidden bg-black
            "
          >
            <video
              ref={videoRef}
              autoPlay
              //  muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>

          {/* overlay */}
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
              {currentStep?.label} {isRecording ? "●" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* :white_check_mark: Bottom status UI */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center z-20">
        <div className="bg-black bg-opacity-75 px-6 py-3 rounded-lg">
          <p
            className={`text-lg font-medium ${phase === "ERROR"
              ? "text-red-500"
              : isVerify
                ? "text-green-500"
                : "text-white"
              }`}
          >
            {status}
          </p>
        </div>
      </div>
    </div>
  );
};

export default NewDmitScreen;

/**
 * :white_check_mark: Rotates stream 90° left and outputs corrected stream
 */
export async function rotateStream90(stream) {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;

  await video.play();

  const w = video.videoWidth;
  const h = video.videoHeight;

  const canvas = document.createElement("canvas");
  canvas.width = h;
  canvas.height = w;

  const ctx = canvas.getContext("2d");
  let rafId = null;

  function draw() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);

    ctx.drawImage(video, -w / 2, -h / 2, w, h);
    ctx.restore();

    rafId = requestAnimationFrame(draw);
  }

  draw();

  const canvasStream = canvas.captureStream(30);

  // ✅ Expose a stop() so callers can cancel the rAF loop + release the hidden video
  canvasStream.stop = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    video.pause();
    video.srcObject = null;
  };

  return canvasStream;
}