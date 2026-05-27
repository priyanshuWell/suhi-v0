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

import Interpersonal360 from "../../assets/voice/intrapersonal_360.png";
import Kinesthetic360 from "../../assets/voice/kinestic_360.png";
import Logical360 from "../../assets/voice/logical_360.png";
import Musical360 from "../../assets/voice/musical_360.png";
import Verbal360 from "../../assets/voice/verbal_360.png";
import Nature360 from "../../assets/voice/nature_360.png";

import View360Viewer from "./View360Viewer";
import bg1 from "../../assets/lightbg.png";

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
const AUTO_SCROLL_MS = 2200;
const AUTO_SCROLL_RESUME = 1800;
const SCROLL_SENSITIVITY = 2.2;
const SNAP_DISTANCE = 80;   // lowered slightly so snapping is easier to trigger
const FRICTION = 0.88; // momentum decay per frame (0 = instant stop, 1 = no decay)
const VELOCITY_THRESHOLD = 0.5; // px/frame below which momentum stops

function drumTransform(offset) {
  const R = 960;
  const theta = 0.42;
  const dist = Math.abs(offset);
  return {
    angle: offset * theta * (180 / Math.PI),
    ty: Math.sin(offset * theta) * R,
    tz: (Math.cos(offset * theta) - 1) * R,
    opacity: Math.max(0, 1 - dist * 0.22),
    scale: Math.max(0.72, 1 - dist * 0.12),
  };
}

export default function VoiceAnalysis() {
  const user = useSelector((state) => state.common.user);
  const screeningState = useSelector((state) => state.common.screening);

  const [phase, setPhase] = useState("picking");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const [confirmedImage, setConfirmedImage] = useState(null);
  const [voiceBars, setVoiceBars] = useState(Array(9).fill(0));
  const [status, setStatus] = useState("idle");
  const [isComplete, setIsComplete] = useState(false);

  const navigate = useNavigate();

  // ── Drag / momentum refs ─────────────────────────────────────────────────
  const dragStartY = useRef(null);
  const dragCurrent = useRef(0);       // accumulated pixel offset during drag
  const velocityRef = useRef(0);       // px per frame
  const lastY = useRef(null);    // previous pointer Y (for velocity calc)
  const lastTimeRef = useRef(null);    // timestamp of last pointermove
  const momentumRAF = useRef(null);    // requestAnimationFrame id for momentum loop
  const userTouching = useRef(false);

  // ── Auto-scroll refs ─────────────────────────────────────────────────────
  const autoScrollRef = useRef(null);
  const resumeTimer = useRef(null);

  // ── Misc refs ────────────────────────────────────────────────────────────
  const animFrameRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioContextRef = useRef(null);

  const isRecording = status === "recording";

  // ── selectedIndex ref (needed inside momentum RAF closure) ───────────────
  // We keep a ref in sync so the momentum loop can read the latest value
  // without being stale.
  const selectedIndexRef = useRef(selectedIndex);
  useEffect(() => { selectedIndexRef.current = selectedIndex; }, [selectedIndex]);

  // ────────────────────────────────────────────────────────────────────────
  // Snap helper — resolves accumulated pixel offset → nearest index
  // ────────────────────────────────────────────────────────────────────────
  const snapToNearest = useCallback((currentOffset) => {
    const steps = Math.round(currentOffset / ITEM_HEIGHT);
    // sign is flipped: drag DOWN (positive offset) → previous item (lower index)
    // drag UP (negative offset) → next item (higher index)
    const newIndex = Math.max(
      0,
      Math.min(IMAGES.length - 1, selectedIndexRef.current - steps)
    );

    setIsSnapping(true);
    setSelectedIndex(newIndex);
    selectedIndexRef.current = newIndex;

    dragCurrent.current = 0;
    requestAnimationFrame(() => setDragOffset(0));
    setTimeout(() => setIsSnapping(false), 280);

    return newIndex;
  }, []);

  // ────────────────────────────────────────────────────────────────────────
  // Auto-scroll
  // ────────────────────────────────────────────────────────────────────────
  const scheduleAutoScroll = useCallback(() => {
    clearInterval(autoScrollRef.current);
    autoScrollRef.current = setInterval(() => {
      if (userTouching.current) return;
      setSelectedIndex((prev) => {
        const next = (prev + 1) % IMAGES.length;
        selectedIndexRef.current = next;
        setIsSnapping(true);
        setDragOffset(0);
        dragCurrent.current = 0;
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

  // ────────────────────────────────────────────────────────────────────────
  // Momentum loop — runs after pointer up until velocity dies
  // ────────────────────────────────────────────────────────────────────────
  const launchMomentum = useCallback(() => {
    cancelAnimationFrame(momentumRAF.current);

    const tick = () => {
      velocityRef.current *= FRICTION;

      if (Math.abs(velocityRef.current) < VELOCITY_THRESHOLD) {
        // Velocity died — snap to nearest
        snapToNearest(dragCurrent.current);
        // Resume auto-scroll after user interaction settles
        resumeTimer.current = setTimeout(scheduleAutoScroll, AUTO_SCROLL_RESUME);
        return;
      }

      dragCurrent.current += velocityRef.current;

      // Clamp so it can't fly past first/last item by more than one card
      const maxOffset = (IMAGES.length - 1 - selectedIndexRef.current) * ITEM_HEIGHT;
      const minOffset = -selectedIndexRef.current * ITEM_HEIGHT;
      dragCurrent.current = Math.max(minOffset, Math.min(maxOffset, dragCurrent.current));

      setDragOffset(dragCurrent.current);
      momentumRAF.current = requestAnimationFrame(tick);
    };

    momentumRAF.current = requestAnimationFrame(tick);
  }, [snapToNearest, scheduleAutoScroll]);

  // ────────────────────────────────────────────────────────────────────────
  // Pointer handlers
  // ────────────────────────────────────────────────────────────────────────
  const onPointerDown = (e) => {
    // Kill any in-flight momentum
    cancelAnimationFrame(momentumRAF.current);
    clearInterval(autoScrollRef.current);
    clearTimeout(resumeTimer.current);

    userTouching.current = true;
    dragStartY.current = e.clientY;
    lastY.current = e.clientY;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;
    // dragCurrent is NOT reset here — it carries over from any previous momentum
    // so the card starts moving from wherever it currently is.

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (dragStartY.current === null) return;

    const now = performance.now();
    const dt = Math.max(1, now - lastTimeRef.current); // avoid divide-by-zero

    // SIGN: (currentY - lastY) → positive when dragging DOWN → content moves DOWN ✓
    const dy = e.clientY - lastY.current;
    velocityRef.current = (dy / dt) * 16 * SCROLL_SENSITIVITY;

    lastY.current = e.clientY;
    lastTimeRef.current = now;

    // SIGN: (currentY - startY) → positive when dragging DOWN → content moves DOWN ✓
    const totalDelta = (e.clientY - dragStartY.current) * SCROLL_SENSITIVITY;
    dragCurrent.current = totalDelta;

    requestAnimationFrame(() => setDragOffset(totalDelta));
  };

  const onPointerUp = () => {
    if (dragStartY.current === null) return;

    userTouching.current = false;
    dragStartY.current = null;

    const delta = dragCurrent.current;

    // If the fling was strong enough → launch momentum
    if (Math.abs(velocityRef.current) > VELOCITY_THRESHOLD) {
      launchMomentum();
      return;
    }

    // Weak or no velocity — fall back to threshold snap
    let step = 0;
    if (delta > SNAP_DISTANCE) step = -1;   // drag DOWN → previous
    else if (delta < -SNAP_DISTANCE) step = 1;   // drag UP   → next

    const next = Math.max(0, Math.min(IMAGES.length - 1, selectedIndexRef.current + step));

    setIsSnapping(true);
    setSelectedIndex(next);
    selectedIndexRef.current = next;
    dragCurrent.current = 0;
    requestAnimationFrame(() => setDragOffset(0));
    setTimeout(() => setIsSnapping(false), 180);

    resumeTimer.current = setTimeout(scheduleAutoScroll, AUTO_SCROLL_RESUME);
  };

  // ────────────────────────────────────────────────────────────────────────
  // Dot nav
  // ────────────────────────────────────────────────────────────────────────
  const goToIndex = (i) => {
    cancelAnimationFrame(momentumRAF.current);
    clearInterval(autoScrollRef.current);
    clearTimeout(resumeTimer.current);

    setIsSnapping(true);
    setDragOffset(0);
    dragCurrent.current = 0;
    setSelectedIndex(i);
    selectedIndexRef.current = i;
    setTimeout(() => setIsSnapping(false), 320);

    resumeTimer.current = setTimeout(scheduleAutoScroll, AUTO_SCROLL_RESUME);
  };

  // ────────────────────────────────────────────────────────────────────────
  // Recording helpers (unchanged from original)
  // ────────────────────────────────────────────────────────────────────────
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

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;

      animFrameRef.current = requestAnimationFrame(visualizeVoice);

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
    cancelAnimationFrame(animFrameRef.current);
    setVoiceBars(Array(9).fill(0));

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    recorder.onstop = async () => {
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();

      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const arrayBuffer = await blob.arrayBuffer();

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
        if (storeResult.success) {
          const runPayload = {
            shm_path: storeResult.shm_path,
            kiosk_id: kioskId,
            user_id: userId,
            session_id: sessionId,
            screening_session_id: screeningSessionId,
          };
          const runResult = await runVoice(runPayload);
          setStatus(runResult.success ? "success" : "error");
          if (!runResult.success) console.error("[Voice] run failed:", runResult.error);
        } else {
          console.error("[Voice] store failed:", storeResult.error);
          setStatus("error");
        }
      } catch (err) {
        console.error("[Voice] API error:", err);
        setStatus("error");
      }

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
    cancelAnimationFrame(momentumRAF.current);
    clearInterval(autoScrollRef.current);
    clearTimeout(resumeTimer.current);
    setConfirmedImage(IMAGES[selectedIndex]);
    setPhase("viewing");
  };

  const onFirstInteract = useCallback(() => {
    setPhase("recording");
    startRecording();
  }, [startRecording]);

  const onTimerEnd = useCallback(() => {
    setPhase("processing");
    setTimeout(() => setIsComplete(true), 800);
    stopRecordingAndSubmit();
  }, [stopRecordingAndSubmit]);

  useEffect(() => {
    if (!isRecording) cancelAnimationFrame(animFrameRef.current);
  }, [isRecording]);

  const effectiveSlotOffset = (i) =>
    i - selectedIndex + dragOffset / ITEM_HEIGHT;

  // ─── Processing phase ────────────────────────────────────────────────────
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

  // ─── Viewing / recording phase ───────────────────────────────────────────
  if ((phase === "viewing" || phase === "recording") && confirmedImage) {
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
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

  // ─── Picking phase — drum wheel ──────────────────────────────────────────
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
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
            style={{
              transformStyle: "preserve-3d",
              touchAction: "none",
              userSelect: "none",
              willChange: "transform",
              backfaceVisibility: "hidden",
            }}
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
                      ? "transform 180ms ease-out, opacity 180ms ease-out"
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