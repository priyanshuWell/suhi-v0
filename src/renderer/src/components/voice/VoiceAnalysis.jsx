// import React, { useEffect, useState } from "react"
// import bg1 from "../../assets/lightbg.png"

// import { useLocation, useNavigate } from "react-router"
// import { useTranslation } from "react-i18next"
// import { useSelector } from "react-redux"
// import { getKioskId } from "../../utils/config"
// import { sendVoiceToBackend, runVoice } from "../../utils/api"
// import audioBufferToWav from "audiobuffer-to-wav"
// import VoiceTextScreen from "./VoiceTextScreen"
// import VoiceImageScreen from "./VoiceImageScreen"
// import { getAudioForCurrentLanguage } from "../../utils/audioUtils"

// const VoiceCapture = () => {
//   const navigate = useNavigate()
//   const location = useLocation()
//   // Get data from Redux store
//   const user = useSelector((state) => state.common.user)
//   const sessionId = useSelector((state) => state.common.sessionId)
//   const screeningState = useSelector((state) => state.common.screening)
//   const [timeLeft, setTimeLeft] = useState(30)
//   const [isActive, setIsActive] = useState(false)
//   const [tab, setTab] = useState("start")
//   const [status, setStatus] = useState("idle") // idle, recording, processing, success, error
//   const [isAudioPlaying, setIsAudioPlaying] = useState(false)
//   const [voiceBars, setVoiceBars] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0]) // Heights for 9 bars
//   const mediaRecorderRef = React.useRef(null)
//   const audioRef = React.useRef(null)
//   const chunksRef = React.useRef([])
//   const analyserRef = React.useRef(null)
//   const dataArrayRef = React.useRef(null)
//   const animationFrameRef = React.useRef(null)
//   const [processingAngle, setProcessingAngle] = useState(0)
//   const [showCompleteAlert, setShowCompleteAlert] = useState(false)

//   const { t } = useTranslation()

//   const handleNext = () => {
//     setShowCompleteAlert(true)
//   }

//   useEffect(() => {
//     // Play audio when component mounts
//     playAudio()
//   }, [])

//   useEffect(() => {
//     let interval

//     if (status === "processing") {
//       interval = setInterval(() => {
//         setProcessingAngle((prev) => (prev + 6) % 360) // smooth rotation
//       }, 16) // ~60fps
//     }

//     return () => clearInterval(interval)
//   }, [status])

//   useEffect(() => {
//     let interval = null
//     if (isActive && timeLeft > 0) {
//       interval = setInterval(() => {
//         setTimeLeft((prev) => prev - 1)
//       }, 1000)
//     } else if (timeLeft === 0 && isActive) {
//       clearInterval(interval)
//       setIsActive(false)
//       stopRecording()
//     }
//     return () => clearInterval(interval)
//   }, [isActive, timeLeft])

//   const playAudio = async () => {
//     const audioPath = await getAudioForCurrentLanguage("voice")
//     if (audioPath && audioRef.current) {
//       audioRef.current.src = audioPath
//       setIsAudioPlaying(true)
//       audioRef.current.play().catch((err) => {
//         console.log("Audio playback failed:", err)
//         setIsAudioPlaying(false)
//       })
//     } else if (!audioPath) {
//       console.log("No audio for voice in current language")
//     }
//   }

//   const stopAudio = () => {
//     if (audioRef.current) {
//       audioRef.current.pause()
//       audioRef.current.currentTime = 0
//       setIsAudioPlaying(false)
//     }
//   }

//   const handleAudioEnd = () => {
//     setIsAudioPlaying(false)
//   }

//   // Visualize voice using Web Audio API
//   const visualizeVoice = () => {
//     if (!analyserRef.current || !dataArrayRef.current) return

//     const analyser = analyserRef.current
//     const dataArray = dataArrayRef.current

//     analyser.getByteFrequencyData(dataArray)

//     // Map frequency data to 9 bars
//     const barCount = 9
//     const bufferLength = dataArray.length
//     const barWidth = Math.floor(bufferLength / barCount)

//     const newBars = []
//     for (let i = 0; i < barCount; i++) {
//       let sum = 0
//       const start = i * barWidth
//       const end = start + barWidth

//       for (let j = start; j < end; j++) {
//         sum += dataArray[j]
//       }

//       const average = sum / barWidth
//       // Normalize to 0-1 range and smooth it out
//       const normalized = Math.min(1, average / 255)
//       newBars.push(normalized)
//     }

//     setVoiceBars(newBars)
//     animationFrameRef.current = requestAnimationFrame(visualizeVoice)
//   }

//   // Cleanup animation on unmount
//   useEffect(() => {
//     return () => {
//       if (animationFrameRef.current) {
//         cancelAnimationFrame(animationFrameRef.current)
//       }
//     }
//   }, [])
//   const startRecording = async () => {
//     setTab("voice")
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
//       console.log("stream", stream)

//       // Set up Web Audio API for visualization
//       const audioContext = new AudioContext({ sampleRate: 16000 })
//       // const audioContext = new (window.AudioContext || window.webkitAudioContext)();
//       const source = audioContext.createMediaStreamSource(stream)
//       const analyser = audioContext.createAnalyser()

//       analyser.fftSize = 256
//       const bufferLength = analyser.frequencyBinCount
//       const dataArray = new Uint8Array(bufferLength)

//       source.connect(analyser)
//       analyserRef.current = analyser
//       dataArrayRef.current = dataArray

//       // Start visualization
//       visualizeVoice()

//       const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
//       mediaRecorderRef.current = mediaRecorder
//       chunksRef.current = []

//       mediaRecorder.ondataavailable = (e) => {
//         if (e.data.size > 0) {
//           chunksRef.current.push(e.data)
//         }
//       }
//       console.log("mediaRecorder", mediaRecorder, chunksRef.current)
//       mediaRecorder.onstop = async () => {
//         // Stop visualization
//         if (animationFrameRef.current) {
//           cancelAnimationFrame(animationFrameRef.current)
//         }
//         // Reset bars
//         setVoiceBars([0, 0, 0, 0, 0, 0, 0, 0, 0])

//         const blob = new Blob(chunksRef.current, { type: "audio/webm" })
//         const arrayBuffer = await blob.arrayBuffer()

//         // Convert to WAV 16kHz
//         const audioContext = new AudioContext({ sampleRate: 16000 })
//         const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
//         const wavArrayBuffer = audioBufferToWav(audioBuffer)

//         // Get data from Redux store and config
//         const kioskId = getKioskId()
//         const userId = user?.data?.user_id || "38e075c8-1a49-450a-8bbb-ccd1bd6483fa" // Corrected property path
//         const sessionId = user?.data?.buffer_id
//         setStatus("processing")
//         const request = {
//           kiosk_id: kioskId,
//           user_id: userId,
//           session_id: sessionId,
//           arrayBuffer: wavArrayBuffer
//         }

//         console.log("[Voice] Sending voice request with:", { kioskId, userId, sessionId })

//         try {
//           const voiceData = {
//             role: "VOICE",
//             timestamp: Date.now(),
//             buffer: new Uint8Array(wavArrayBuffer)
//           }

//           const storeResult = await sendVoiceToBackend(voiceData)
//           console.log("Store result voice:", storeResult)

//           if (storeResult.success) {
//             const runPayload = {
//               shm_path: storeResult.shm_path,
//               kiosk_id: kioskId,
//               user_id: userId,
//               session_id: sessionId,
//               screening_session_id: screeningState?.sessionId
//             }
//             handleNext()
//             const runResult = await runVoice(runPayload)
//             console.log("Run result:", runResult)

//             if (runResult.success) {
//               setStatus("success")
//               stopAudio()
//               await new Promise((r) => setTimeout(r, 500))
//               // navigate("/space-convoy-main");
//             } else {
//               setStatus("error")
//               console.error("Voice run failed:", runResult.error)
//               handleNext()
//             }
//           } else {
//             setStatus("error")
//             console.error("Voice storage failed:", storeResult.error)
//             handleNext()
//           }
//         } catch (err) {
//           setStatus("error")
//           console.error("API error:", err)
//           handleNext()
//         }

//         // Stop all tracks
//         stream.getTracks().forEach((track) => track.stop())
//         // Close audio context
//         audioContext.close()
//       }

//       mediaRecorder.start()
//       setIsActive(true)
//       setStatus("recording")
//     } catch (err) {
//       console.error("Microphone permission denied or error:", err)
//       setStatus("error")
//     }
//   }

//   const handleStart = () => {
//     setTab("voice")
//     if (status === "recording" || status === "processing") return
//     setTimeLeft(30)
//     startRecording()
//   }

//   const stopRecording = () => {
//     if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
//       mediaRecorderRef.current.stop()
//     }
//   }

//   return (
//     <>
//       <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black flex flex-col items-center justify-center">
//         <audio ref={audioRef} onEnded={handleAudioEnd} onPlay={() => setIsAudioPlaying(true)}>
//           Your browser does not support the audio element.
//         </audio>
//         {/* Background */}
//         <div
//           className="absolute inset-0 bg-center bg-cover z-0 opacity-50"
//           style={{ backgroundImage: `url(${bg1})` }}
//         />

//         {/* Content Container */}
//         {tab === "start" ? (
//           <VoiceTextScreen
//             t={t}
//             handleStart={handleStart}
//             audioRef={audioRef}
//             handleAudioEnd={handleAudioEnd}
//             isAudioPlaying={isAudioPlaying}
//             status={status}
//           // instructionAudio={instructionAudio}
//           />
//         ) : (
//           <VoiceImageScreen
//             showCompleteAlert={showCompleteAlert}
//             timeLeft={timeLeft}
//             status={status}
//           />
//         )}
//       </div>
//     </>
//   )
// }

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import audioBufferToWav from "audiobuffer-to-wav";
import { sendVoiceToBackend, runVoice } from "../../utils/api";
import { getKioskId } from "../../utils/config";
import Interpersonal from "../../assets/voice/intrapersonal.jpeg";
import Kinesthetic from "../../assets/voice/kinesthic.jpeg";
import Logical from "../../assets/voice/logical.jpeg";
import Musical from "../../assets/voice/musical.jpeg";
import Verbal from "../../assets/voice/verbal.jpeg";
import Nature from "../../assets/voice/nature.jpeg";

// One 360° panorama per image — naming pattern: <label>_360.png
import Interpersonal360 from "../../assets/voice/intrapersonal_360.png";
import Kinesthetic360 from "../../assets/voice/kinestic_360.png";
import Logical360 from "../../assets/voice/logical_360.png";
import Musical360 from "../../assets/voice/musical_360.png";
import Verbal360 from "../../assets/voice/verbal_360.png";
import Nature360 from "../../assets/voice/nature_360.png";

import View360Viewer from "./View360Viewer";
import bg1 from "../../assets/lightbg.png";


// ─── Image catalogue ─────────────────────────────────────────────────────────
const IMAGES = [
  { src: Interpersonal, label: "Interpersonal", src360: Interpersonal360 },
  { src: Kinesthetic, label: "Kinesthetic", src360: Kinesthetic360 },
  { src: Logical, label: "Logical", src360: Logical360 },
  { src: Musical, label: "Musical", src360: Musical360 },
  { src: Verbal, label: "Verbal", src360: Verbal360 },
  { src: Nature, label: "Nature", src360: Nature360 },
];

// ─── Drum constants ───────────────────────────────────────────────────────────
const ITEM_HEIGHT = 400;
const DRAG_DAMPING = 0.6;
const AUTO_SCROLL_MS = 2200;
const AUTO_SCROLL_RESUME = 1800;

function drumTransform(offset) {
  const dist = Math.abs(offset);

  return {
    angle: offset * 6, // very subtle tilt
    ty: offset * 260,  // natural vertical spacing
    tz: -dist * 80,    // tiny depth only
    opacity: Math.max(0.35, 1 - dist * 0.18),
    scale: Math.max(0.9, 1 - dist * 0.04),
  };
}

export default function VoiceAnalysis() {
  // Redux state
  const user = useSelector((state) => state.common.user);
  const screeningState = useSelector((state) => state.common.screening);

  // Phase: "picking" | "viewing" | "recording" | "processing"
  const [phase, setPhase] = useState("picking");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const [confirmedImage, setConfirmedImage] = useState(null);
  const [voiceBars, setVoiceBars] = useState(Array(9).fill(0));
  const [status, setStatus] = useState("idle"); // idle | recording | processing | success | error

  const dragStartY = useRef(null);
  const dragStartOff = useRef(0);
  const velocityRef = useRef(0);
  const lastY = useRef(null);
  const momentumRAF = useRef(null);
  const animFrameRef = useRef(null);
  const autoScrollRef = useRef(null);
  const resumeTimer = useRef(null);
  const userTouching = useRef(false);
  const navigate = useNavigate();

  // Recording refs
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const [isComplete, setIsComplete] = useState(false);
  const isRecording = status === "recording";


  // ── Snap helper ──────────────────────────────────────────────────────────
  const snapToNearest = useCallback((currentOffset, fromIndex) => {
    const snapped = Math.round(currentOffset / ITEM_HEIGHT);

    const newIndex = Math.max(
      0,
      Math.min(IMAGES.length - 1, fromIndex - snapped)
    );

    // Animate remaining offset smoothly
    const finalOffset =
      currentOffset - snapped * ITEM_HEIGHT;

    setIsSnapping(true);

    setSelectedIndex(newIndex);
    setDragOffset(finalOffset);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDragOffset(0);
      });
    });

    setTimeout(() => setIsSnapping(false), 320);

    return newIndex;
  }, []);

  // ── Momentum ─────────────────────────────────────────────────────────────
  const startMomentum = useCallback((velocity, currentDragOffset, currentIndex) => {
    cancelAnimationFrame(momentumRAF.current);
    let vel = velocity;
    let off = currentDragOffset;
    const tick = () => {
      vel *= 0.86;
      off += vel;
      const maxOff = currentIndex * ITEM_HEIGHT;
      const minOff = -(IMAGES.length - 1 - currentIndex) * ITEM_HEIGHT;
      off = Math.max(minOff, Math.min(maxOff, off));
      setDragOffset(off);
      if (Math.abs(vel) > 1) momentumRAF.current = requestAnimationFrame(tick);
      else snapToNearest(off, currentIndex);
    };
    momentumRAF.current = requestAnimationFrame(tick);
  }, [snapToNearest]);

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  const scheduleAutoScroll = useCallback(() => {
    clearInterval(autoScrollRef.current);
    autoScrollRef.current = setInterval(() => {
      if (userTouching.current) return;
      setSelectedIndex(prev => {
        const next = (prev + 1) % IMAGES.length;
        setIsSnapping(true);
        setDragOffset(0);
        setTimeout(() => setIsSnapping(false), 320);
        return next;
      });
    }, AUTO_SCROLL_MS);
  }, []);

  useEffect(() => {
    if (phase === "picking") scheduleAutoScroll();
    return () => {
      clearInterval(autoScrollRef.current);
      clearTimeout(resumeTimer.current);
    };
  }, [phase, scheduleAutoScroll]);

  // ── Pointer events (drum wheel) ──────────────────────────────────────────
  const onPointerDown = (e) => {
    userTouching.current = true;
    clearInterval(autoScrollRef.current);
    clearTimeout(resumeTimer.current);
    cancelAnimationFrame(momentumRAF.current);
    dragStartY.current = e.clientY;
    dragStartOff.current = dragOffset;
    lastY.current = e.clientY;
    velocityRef.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (dragStartY.current === null) return;
    const dy = (e.clientY - dragStartY.current) * DRAG_DAMPING;
    velocityRef.current = e.clientY - (lastY.current ?? e.clientY);
    lastY.current = e.clientY;
    const maxOff = selectedIndex * ITEM_HEIGHT;
    const minOff = -(IMAGES.length - 1 - selectedIndex) * ITEM_HEIGHT;
    setDragOffset(Math.max(minOff, Math.min(maxOff, dragStartOff.current + dy)));
  };
  const onPointerUp = () => {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    userTouching.current = false;
    const vel = velocityRef.current * DRAG_DAMPING;
    if (Math.abs(vel) > 3) startMomentum(vel, dragOffset, selectedIndex);
    else snapToNearest(dragOffset, selectedIndex);
    // resumeTimer.current = setTimeout(scheduleAutoScroll, AUTO_SCROLL_RESUME);
  };

  // ── Dot nav ──────────────────────────────────────────────────────────────
  const goToIndex = (i) => {
    clearInterval(autoScrollRef.current);
    clearTimeout(resumeTimer.current);
    cancelAnimationFrame(momentumRAF.current);
    setIsSnapping(true);
    setDragOffset(0);
    setSelectedIndex(i);
    setTimeout(() => setIsSnapping(false), 320);
    resumeTimer.current = setTimeout(scheduleAutoScroll, AUTO_SCROLL_RESUME);
  };

  // ── Start microphone recording + real waveform visualization ─────────────
  const visualizeVoice = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return;
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    const barCount = 9;
    const barWidth = Math.floor(dataArrayRef.current.length / barCount);
    const newBars = [];
    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = i * barWidth; j < (i + 1) * barWidth; j++) sum += dataArrayRef.current[j];
      newBars.push(Math.min(1, (sum / barWidth) / 255));
    }
    setVoiceBars(newBars);
    animFrameRef.current = requestAnimationFrame(visualizeVoice);
  }, []);

  const startRecording = useCallback(async () => {
    if (status === "recording" || status === "processing") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Web Audio API for real waveform visualization
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;

      // Start visualization
      animFrameRef.current = requestAnimationFrame(visualizeVoice);

      // MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.start();
      setStatus("recording");
    } catch (err) {
      console.error("Microphone permission denied or error:", err);
      setStatus("error");
    }
  }, [status, visualizeVoice]);

  const stopRecordingAndSubmit = useCallback(async () => {
    // Stop visualization
    cancelAnimationFrame(animFrameRef.current);
    setVoiceBars(Array(9).fill(0));
    // setStatus("processing");
    // setPhase("processing");

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      // Nothing recorded yet — just navigate forward
      // navigate("/space-convoy-main");
      return;
    }

    // Wait for onstop to fire
    recorder.onstop = async () => {
      // Stop stream tracks
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();

      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const arrayBuffer = await blob.arrayBuffer();

        // Convert to 16kHz WAV
        const ctx = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        const wavArrayBuffer = audioBufferToWav(audioBuffer);
        ctx.close();

        const kioskId = getKioskId();
        const userId = user?.data?.user_id ?? null;
        const sessionId = user?.data?.buffer_id ?? null;
        const screeningSessionId = screeningState?.sessionId ?? null;

        const voiceData = {
          role: "VOICE",
          timestamp: Date.now(),
          buffer: new Uint8Array(wavArrayBuffer),
        };

        const storeResult = await sendVoiceToBackend(voiceData);
        console.log("[Voice] store result:", storeResult);

        if (storeResult.success) {
          const runPayload = {
            shm_path: storeResult.shm_path,
            kiosk_id: kioskId,
            user_id: userId,
            session_id: sessionId,
            screening_session_id: screeningSessionId,
          };
          const runResult = await runVoice(runPayload);
          console.log("[Voice] run result:", runResult);

          if (runResult.success) {
            setStatus("success");
          } else {
            console.error("[Voice] run failed:", runResult.error);
            setStatus("error");
          }
        } else {
          console.error("[Voice] store failed:", storeResult.error);
          setStatus("error");
        }
      } catch (err) {
        console.error("[Voice] API error:", err);
        setStatus("error");
      }

      // Navigate to next screen regardless of API outcome
      navigate("/space-convoy-main");
    };

    recorder.stop();
  }, [user, screeningState, navigate]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      cancelAnimationFrame(momentumRAF.current);
      clearInterval(autoScrollRef.current);
      clearTimeout(resumeTimer.current);
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
    };
  }, []);

  // ── Card tap → enter viewing phase ──────────────────────────────────────
  const onCenterCardClick = () => {
    clearInterval(autoScrollRef.current);
    clearTimeout(resumeTimer.current);
    setConfirmedImage(IMAGES[selectedIndex]);
    setPhase("viewing");
    // Recording does NOT start here — it starts on first drag inside the viewer
  };

  // ── First drag inside viewer → kick off recording ────────────────────────
  const onFirstInteract = useCallback(() => {
    setPhase("recording");
    startRecording();
  }, [startRecording]);

  // ── Timer hits 0 → stop recording and submit ─────────────────────────────
  const onTimerEnd = useCallback(() => {
    setPhase("processing");

    // move immediately after small UX delay
    setTimeout(() => {
      setIsComplete(true);
    }, 800);

    // continue upload in background
    stopRecordingAndSubmit();
  }, [stopRecordingAndSubmit, navigate]);


  // ── Waveform animation only active when real mic data isn't flowing ───────
  // (real waveform is driven by visualizeVoice via Web Audio API)
  // This effect is kept as a no-op guard.
  useEffect(() => {
    if (!isRecording) {
      cancelAnimationFrame(animFrameRef.current);
    }
  }, [isRecording]);


  const effectiveSlotOffset = (i) => i - selectedIndex - dragOffset / ITEM_HEIGHT;

  // ─────────────────────────────────────────────────────────────────────────
  // PROCESSING phase — simple fullscreen spinner while API runs
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === "processing") {
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black flex flex-col items-center justify-center gap-6">
        <div style={{
          width: 64, height: 64,
          border: "5px solid rgba(154,217,255,0.15)",
          borderTopColor: "rgba(154,217,255,0.9)",
          borderRadius: "50%",
          animation: "spin360 0.8s linear infinite",
        }} />
        <p style={{ color: "rgba(154,217,255,0.7)", fontFamily: "'Exo 2', sans-serif", letterSpacing: "0.2em", fontSize: 14 }}>
          ANALYSING VOICE…
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIEWING / RECORDING phase — fullscreen 360° viewer
  // ─────────────────────────────────────────────────────────────────────────
  if ((phase === "viewing" || phase === "recording") && confirmedImage) {
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
        {/* Label badge */}
        <div
          className="absolute top-6 left-1/2 -translate-x-1/2 z-30 px-6 py-2 rounded-full
                     text-white text-sm font-semibold tracking-widest uppercase"
          style={{
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(154,217,255,0.3)",
            textShadow: "0 0 12px rgba(154,217,255,0.6)",
            pointerEvents: "none",
          }}
        >
          {confirmedImage.label}
        </div>

        <View360Viewer
          src={confirmedImage.src360}
          width="100%"
          height="100vh"
          autoRotate={false}
          showHUD={false}
          timerSeconds={30}
          onTimerEnd={onTimerEnd}
          onFirstInteract={onFirstInteract}
          voiceBars={voiceBars}
          isComplete={isComplete}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PICKING phase — drum wheel
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      {/* Background */}
      <div
        className="absolute inset-0 bg-center bg-cover opacity-50"
        style={{ backgroundImage: `url(${bg1})` }}
      />

      <div className="relative z-10 w-full h-full flex flex-col items-center">

        {/* Header */}
        <div className="w-full flex flex-col items-center gap-3 pt-8 px-4 shrink-0 mt-20">
          <div className="flex items-center gap-3 w-full max-w-2xl">
            <div className="flex-1 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(154,217,255,0.7))" }} />
            <span
              className="text-white text-base md:text-lg font-semibold tracking-[0.3em] whitespace-nowrap"
              style={{ fontFamily: "'Exo 2', sans-serif", textShadow: "0 0 20px rgba(154,217,255,0.6)" }}
            >
              WHAT DO YOU THINK?
            </span>
            <div className="flex-1 h-px"
              style={{ background: "linear-gradient(90deg, rgba(154,217,255,0.7), transparent)" }} />
          </div>

          <p
            className="text-white text-center text-xl md:text-3xl font-bold leading-snug"
            style={{ textShadow: "0 0 30px rgba(154,217,255,0.5)" }}
          >
            Select a 360° image and describe
            <br />
            what's happening as you explore it.
          </p>
        </div>

        {/* Drum wheel */}
        <div
          className="relative flex-1 w-full overflow-hidden flex items-center justify-center"
          style={{ perspective: "1400px" }}
        >
          {/* Center glow band */}
          <div
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-20"
            style={{
              top: "50%",
              width: "100%", maxWidth: "900px",
              height: ITEM_HEIGHT,
              transform: "translate(-50%, -50%)",
              background:
                "linear-gradient(180deg, rgba(154,217,255,0.05) 0%, rgba(154,217,255,0.15) 50%, rgba(154,217,255,0.05) 100%)",
              borderTop: "1px solid rgba(154,217,255,0.5)",
              borderBottom: "1px solid rgba(154,217,255,0.5)",
              boxShadow: "0 0 80px rgba(154,217,255,0.08)",
            }}
          />

          {/* Fade mask */}
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              background: `linear-gradient(180deg,
                rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 15%, transparent 35%,
                transparent 65%, rgba(0,0,0,0.5) 85%, rgba(0,0,0,0.95) 100%)`,
            }}
          />

          {/* Drum track */}
          <div
            className="relative w-full h-full"
            style={{ transformStyle: "preserve-3d" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {IMAGES.map((img, i) => {
              const off = effectiveSlotOffset(i);
              const { angle, ty, tz, opacity, scale } = drumTransform(off);
              const isCentered = Math.abs(dragOffset) < 10 && i === selectedIndex;

              return (
                <div
                  key={i}
                  className="absolute left-0 right-0 flex items-center justify-center"
                  style={{
                    top: "50%",
                    height: ITEM_HEIGHT,
                    marginTop: -ITEM_HEIGHT / 2,
                    transformOrigin: "center center",
                    transform: `translate3d(0, ${ty}px, ${tz}px) rotateX(${-angle}deg) scale(${scale})`,
                    opacity,
                    transition: isSnapping
                      ? "transform 0.32s cubic-bezier(0.23,1,0.32,1), opacity 0.32s ease"
                      : "none",
                    zIndex: Math.round((1 - Math.abs(off)) * 10),
                    cursor: isCentered ? "pointer" : "grab",
                    pointerEvents: Math.abs(off) > 2.2 ? "none" : "auto",
                  }}
                  onClick={isCentered ? onCenterCardClick : undefined}
                >
                  <div
                    className="relative overflow-hidden"
                    style={{
                      width: 600,
                      height: ITEM_HEIGHT - 16,
                      borderRadius: 24,
                      border: isCentered
                        ? "2px solid rgba(154,217,255,0.9)"
                        : "2px solid rgba(154,217,255,0.15)",
                      boxShadow: isCentered
                        ? "0 0 60px rgba(154,217,255,0.25), inset 0 0 20px rgba(154,217,255,0.08)"
                        : "none",
                      transition: isSnapping ? "all 0.32s ease" : "none",
                    }}
                  >
                    <img
                      src={img.src} alt={img.label} draggable={false}
                      className="w-full h-full object-cover"
                      style={{ userSelect: "none", pointerEvents: "none" }}
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                    {/* 360° badge */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                      <span className="text-white font-black"
                        style={{ fontSize: 26, textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}>
                        360°
                      </span>
                      <svg width="36" height="16" viewBox="0 0 32 14" fill="none">
                        <path d="M2 7 Q16 1 30 7 Q16 13 2 7 Z" stroke="white" strokeWidth="1.5" fill="none" />
                        <path d="M25 4.5 L30 7 L25 9.5" stroke="white" strokeWidth="1.5" fill="none"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    {/* Label */}
                    <div
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full
                                 text-white text-sm md:text-base font-semibold whitespace-nowrap"
                      style={{
                        background: "rgba(0,0,0,0.55)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      {img.label}
                    </div>

                    {/* Tap hint */}
                    {isCentered && (
                      <div className="absolute inset-0 flex items-end justify-center pb-14 pointer-events-none">
                        <span
                          className="text-white text-xs md:text-sm tracking-[0.3em] uppercase opacity-80"
                          style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
                        >
                          Tap to explore
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>



      </div>
    </div>
  );
}