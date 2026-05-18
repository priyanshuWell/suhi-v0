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

// export default VoiceCapture

import { useState, useEffect, useRef, useCallback, React } from "react";
import Interpersonal from "../../assets/voice/intrapersonal.jpeg";
import Kinesthetic from "../../assets/voice/kinesthic.jpeg";
import Logical from "../../assets/voice/logical.jpeg";
import Musical from "../../assets/voice/musical.jpeg";
import Verbal from "../../assets/voice/verbal.jpeg";
import Nature from "../../assets/voice/nature.jpeg";
import VoiceProgressBar from "./VoiceProgressBar";
import BlueGradientButton from "../ui/BlueGradientButton";
import voiceComplete from "../../assets/voice/voiceComplete.svg";
import { useNavigate } from "react-router";
import bg1 from "../../assets/lightbg.png"
// ─── Images ─────────────────────────────
const IMAGES = [
  { src: Interpersonal, label: "Interpersonal" },
  { src: Kinesthetic, label: "Kinesthetic" },
  { src: Logical, label: "Logical" },
  { src: Musical, label: "Musical" },
  { src: Verbal, label: "Verbal" },
  { src: Nature, label: "Nature" },
];

// ─── Waveform config ─────────────────────────────────────────────────────────
const BAR_WIDTH = 12.1111;
const BAR_RADIUS = 6.05556;
const CENTER_Y = 100;
const IDLE_HEIGHT = 10;
const MAX_EXTRA_HEIGHT = 140;

const barPositions = [
  { x: 0, scale: 0.30 },
  { x: 30.2773, scale: 0.90 },
  { x: 60.5547, scale: 0.25 },
  { x: 90.832, scale: 1.10 },
  { x: 121.109, scale: 0.60 },
  { x: 151.391, scale: 0.40 },
  { x: 181.668, scale: 0.70 },
  { x: 211.945, scale: 0.25 },
  { x: 242.223, scale: 0.90 },
];

// ─── Drum geometry ───────────────────────────────────────────────────────────
const ITEM_HEIGHT = 380;
const DRAG_DAMPING = 0.6;
const AUTO_SCROLL_INTERVAL = 2200; // ms between auto-advances
const AUTO_SCROLL_RESUME_DELAY = 1800; // ms after user lifts finger

/**
 * Map a slot's offset from center onto the curved drum surface.
 * R = drum radius; each slot occupies atan2(ITEM_HEIGHT, R) radians.
 */
function drumTransform(offsetFromCenter) {
  const R = 900;

  const theta = 0.42;

  const angle = offsetFromCenter * theta * (180 / Math.PI);

  const ty = Math.sin(offsetFromCenter * theta) * R;

  const tz =
    (Math.cos(offsetFromCenter * theta) - 1) * R;

  const dist = Math.abs(offsetFromCenter);

  const opacity = Math.max(0, 1 - dist * 0.22);

  const scale = Math.max(0.72, 1 - dist * 0.12);

  const blur = Math.min(dist * 2.8, 8);

  const brightness = Math.max(0.45, 1 - dist * 0.18);

  return {
    angle,
    ty,
    tz,
    opacity,
    scale,
    blur,
    brightness,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function VoiceAnalysis({
  showCompleteAlert,
  handleNext,
  timeLeft,
  status,
}) {
  const [phase, setPhase] = useState("picking");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const [confirmedImage, setConfirmedImage] = useState(null);
  const [voiceBars, setVoiceBars] = useState(Array(9).fill(0));

  const dragStartY = useRef(null);
  const dragStartOff = useRef(0);
  const velocityRef = useRef(0);
  const lastY = useRef(null);
  const momentumRAF = useRef(null);
  const animFrameRef = useRef(null);
  const autoScrollRef = useRef(null);
  const resumeTimer = useRef(null);
  const userTouching = useRef(false);
  // const audioRef = React.useRef(null)

  const navigate = useNavigate();
  const isActive = status === "recording";

  // ── Switch to recording when status flips ───────────────────────────────
  useEffect(() => {
    if (status === "recording" && phase === "picking") {
      setConfirmedImage(IMAGES[selectedIndex]);
      setPhase("recording");
    }
  }, [status, phase, selectedIndex]);

  // ── Snap helper ──────────────────────────────────────────────────────────
  const snapToNearest = useCallback((currentOffset, fromIndex) => {
    const shifted = currentOffset / ITEM_HEIGHT;
    const snapped = Math.round(shifted);
    const newIndex = Math.max(0, Math.min(IMAGES.length - 1, fromIndex - snapped));
    setIsSnapping(true);
    setDragOffset(0);
    setSelectedIndex(newIndex);
    setTimeout(() => setIsSnapping(false), 320);
    return newIndex;
  }, []);

  // ── Momentum scroll ──────────────────────────────────────────────────────
  const startMomentum = useCallback((velocity, currentDragOffset, currentIndex) => {
    cancelAnimationFrame(momentumRAF.current);
    let vel = velocity;
    let off = currentDragOffset;

    const tick = () => {
      vel *= 0.92;
      off += vel;
      const maxOff = currentIndex * ITEM_HEIGHT;
      const minOff = -(IMAGES.length - 1 - currentIndex) * ITEM_HEIGHT;
      off = Math.max(minOff, Math.min(maxOff, off));
      setDragOffset(off);
      if (Math.abs(vel) > 1) {
        momentumRAF.current = requestAnimationFrame(tick);
      } else {
        snapToNearest(off, currentIndex);
      }
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
    }, AUTO_SCROLL_INTERVAL);
  }, []);

  useEffect(() => {
    if (phase === "picking") {
      scheduleAutoScroll();
    }
    return () => {
      clearInterval(autoScrollRef.current);
      clearTimeout(resumeTimer.current);
    };
  }, [phase, scheduleAutoScroll]);

  // ── Pointer events ───────────────────────────────────────────────────────
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
    if (Math.abs(vel) > 3) {
      startMomentum(vel, dragOffset, selectedIndex);
    } else {
      snapToNearest(dragOffset, selectedIndex);
    }
    // Resume auto-scroll after a delay
    resumeTimer.current = setTimeout(scheduleAutoScroll, AUTO_SCROLL_RESUME_DELAY);
  };

  // ── Dot click ────────────────────────────────────────────────────────────
  const goToIndex = (i) => {
    clearInterval(autoScrollRef.current);
    clearTimeout(resumeTimer.current);
    cancelAnimationFrame(momentumRAF.current);
    setIsSnapping(true);
    setDragOffset(0);
    setSelectedIndex(i);
    setTimeout(() => setIsSnapping(false), 320);
    resumeTimer.current = setTimeout(scheduleAutoScroll, AUTO_SCROLL_RESUME_DELAY);
  };

  // ── Center card tap → navigate ───────────────────────────────────────────
  const onCenterCardClick = () => {
    // Only fires if drag distance is negligible (pure tap, not drag)
    navigate("/space-convoy-main");
  };

  // ── Waveform animation ───────────────────────────────────────────────────
  useEffect(() => {
    if (isActive && phase === "recording") {
      const phases = barPositions.map(() => Math.random() * Math.PI * 2);
      const speeds = barPositions.map(() => 0.8 + Math.random() * 2.5);
      let startTime = null;
      const animate = (ts) => {
        if (!startTime) startTime = ts;
        const elapsed = (ts - startTime) / 1000;
        setVoiceBars(
          barPositions.map((_, i) => {
            const wave =
              0.4 * Math.sin(elapsed * speeds[i] + phases[i]) +
              0.3 * Math.sin(elapsed * speeds[i] * 1.7 + phases[i] + 1) +
              0.3 * Math.random();
            return Math.max(0, Math.min(1, (wave + 0.5) / 1.3));
          })
        );
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(animFrameRef.current);
      setVoiceBars(Array(9).fill(0));
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isActive, phase]);

  // ── Effective slot offset (center = 0) ───────────────────────────────────
  const effectiveSlotOffset = (i) => {
    const dragSlots = dragOffset / ITEM_HEIGHT;
    return i - selectedIndex - dragSlots;
  };



  // ─────────────────────────────────────────────────────────────────────────
  // RECORDING PHASE
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      return (
      <>
        <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
          {/* Background */}
          <div
            className="absolute inset-0 bg-center bg-cover opacity-50"
            style={{ backgroundImage: `url(${bg1})` }}
          />

          {/* Main Layout */}
          <div className="relative z-10 w-full h-full flex flex-col items-center">

            {/* Header */}
            <div className="w-full flex flex-col items-center gap-3 pt-8 px-4 shrink-0">
              <div className="flex items-center gap-3 w-full max-w-2xl">
                <div
                  className="flex-1 h-px"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(154,217,255,0.7))",
                  }}
                />

                <span
                  className="text-white text-base md:text-lg font-semibold tracking-[0.3em] whitespace-nowrap"
                  style={{
                    fontFamily: "'Exo 2', sans-serif",
                    textShadow: "0 0 20px rgba(154,217,255,0.6)",
                  }}
                >
                  WHAT DO YOU THINK?
                </span>

                <div
                  className="flex-1 h-px"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(154,217,255,0.7), transparent)",
                  }}
                />
              </div>

              <p
                className="text-white text-center text-xl md:text-3xl font-bold leading-snug"
                style={{
                  textShadow: "0 0 30px rgba(154,217,255,0.5)",
                }}
              >
                Select a 360° image and describe
                <br />
                what's happening as you explore it.
              </p>
            </div>

            {/* Drum Wheel Area */}
            <div
              className="relative flex-1 w-full overflow-hidden flex items-center justify-center"
              style={{
                perspective: "1400px",
              }}
            >
              {/* Glow Center Band */}
              <div
                className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-20"
                style={{
                  top: "50%",
                  width: "100%",
                  maxWidth: "900px",
                  height: ITEM_HEIGHT,
                  transform: "translate(-50%, -50%)",
                  background:
                    "linear-gradient(180deg, rgba(154,217,255,0.05) 0%, rgba(154,217,255,0.15) 50%, rgba(154,217,255,0.05) 100%)",
                  borderTop: "1px solid rgba(154,217,255,0.5)",
                  borderBottom: "1px solid rgba(154,217,255,0.5)",
                  boxShadow: "0 0 80px rgba(154,217,255,0.08)",
                }}
              />

              {/* Fade Mask */}
              <div
                className="absolute inset-0 z-10 pointer-events-none"
                style={{
                  background: `
                linear-gradient(
                  180deg,
                  rgba(0,0,0,0.95) 0%,
                  rgba(0,0,0,0.5) 15%,
                  transparent 35%,
                  transparent 65%,
                  rgba(0,0,0,0.5) 85%,
                  rgba(0,0,0,0.95) 100%
                )
              `,
                }}
              />

              {/* Drum Track */}
              <div
                className="relative w-full h-full"
                style={{
                  transformStyle: "preserve-3d",
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {IMAGES.map((img, i) => {
                  const off = effectiveSlotOffset(i);

                  const { angle, ty, tz, opacity, scale } =
                    drumTransform(off);

                  const isCentered =
                    Math.abs(dragOffset) < 10 &&
                    i === selectedIndex;

                  return (
                    <div
                      key={i}
                      className="absolute left-0 right-0 flex items-center justify-center"
                      style={{
                        top: "50%",
                        height: ITEM_HEIGHT,
                        marginTop: -ITEM_HEIGHT / 2,

                        transformOrigin: "center center",

                        transform: `
                      translateY(${ty}px)
                      translateZ(${tz}px)
                      rotateX(${-angle}deg)
                      scale(${scale})
                    `,

                        opacity,

                        transition: isSnapping
                          ? "transform 0.32s cubic-bezier(0.23,1,0.32,1), opacity 0.32s ease"
                          : "none",

                        zIndex: Math.round(
                          (1 - Math.abs(off)) * 10
                        ),

                        cursor: isCentered
                          ? "pointer"
                          : "grab",

                        pointerEvents:
                          Math.abs(off) > 2.2
                            ? "none"
                            : "auto",
                      }}
                      onClick={
                        isCentered
                          ? onCenterCardClick
                          : undefined
                      }
                    >
                      <div
                        className="
                     relative overflow-hidden w-[600px] h-[950px]
                    "
                        style={{
                          height: ITEM_HEIGHT - 16,
                          borderRadius: 24,

                          border: isCentered
                            ? "2px solid rgba(154,217,255,0.9)"
                            : "2px solid rgba(154,217,255,0.15)",

                          boxShadow: isCentered
                            ? `
                          0 0 60px rgba(154,217,255,0.25),
                          inset 0 0 20px rgba(154,217,255,0.08)
                        `
                            : "none",

                          transition: isSnapping
                            ? "all 0.32s ease"
                            : "none",
                        }}
                      >
                        {/* Image */}
                        <img
                          src={img.src}
                          alt={img.label}
                          draggable={false}
                          className="w-full h-full object-cover"
                          style={{
                            userSelect: "none",
                            pointerEvents: "none",
                          }}
                        />

                        {/* Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                        {/* 360 Badge */}
                        <div
                          className="
                        absolute
                        top-1/2
                        left-1/2
                        -translate-x-1/2
                        -translate-y-1/2
                        flex
                        flex-col
                        items-center
                        gap-1
                      "
                        >
                          <span
                            className="text-white font-black"
                            style={{
                              fontSize: 26,
                              textShadow:
                                "0 2px 10px rgba(0,0,0,0.9)",
                            }}
                          >
                            360°
                          </span>

                          <svg
                            width="36"
                            height="16"
                            viewBox="0 0 32 14"
                            fill="none"
                          >
                            <path
                              d="M2 7 Q16 1 30 7 Q16 13 2 7 Z"
                              stroke="white"
                              strokeWidth="1.5"
                              fill="none"
                            />

                            <path
                              d="M25 4.5 L30 7 L25 9.5"
                              stroke="white"
                              strokeWidth="1.5"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>

                        {/* Label */}
                        <div
                          className="
                        absolute
                        bottom-4
                        left-1/2
                        -translate-x-1/2
                        px-5
                        py-2
                        rounded-full
                        text-white
                        text-sm
                        md:text-base
                        font-semibold
                        whitespace-nowrap
                      "
                          style={{
                            background: "rgba(0,0,0,0.55)",
                            backdropFilter: "blur(8px)",
                            border:
                              "1px solid rgba(255,255,255,0.12)",
                          }}
                        >
                          {img.label}
                        </div>

                        {/* Tap Hint
                        {isCentered && (
                          <div
                            className="
                          absolute
                          inset-0
                          flex
                          items-end
                          justify-center
                          pb-14
                          pointer-events-none
                        "
                          >
                            <span
                              className="
                            text-[#9AD9FF]
                            text-xs
                            md:text-sm
                            tracking-[0.3em]
                            uppercase
                            opacity-80
                          "
                              style={{
                                textShadow:
                                  "0 1px 4px rgba(0,0,0,0.9)",
                              }}
                            >
                              Tap To Continue
                            </span>
                          </div>
                        )} */}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="w-full flex flex-col items-center gap-4 pb-6 shrink-0">
              {/* Indicators */}
              <div className="flex gap-2 items-center">
                {IMAGES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToIndex(i)}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: i === selectedIndex ? 30 : 8,
                      height: 8,
                      background:
                        i === selectedIndex
                          ? "rgba(154,217,255,1)"
                          : "rgba(154,217,255,0.3)",
                    }}
                  />
                ))}
              </div>

              {/* Hint */}
              <p className="text-[#9AD9FF]/40 text-xs md:text-sm tracking-[0.3em] uppercase">
                Auto-scrolling · drag to explore
              </p>
            </div>
          </div>
        </div>
      </>
      );
    </>
  )
}