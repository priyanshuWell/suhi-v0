import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { useSelector, useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import audioBufferToWav from "audiobuffer-to-wav";
import { sendVoiceToBackend, runVoice } from "../../utils/api";
import { getKioskId } from "../../utils/config";
import { setScreening } from "../../features/common/commonSlice";
import { getNextRoute } from "../../utils/stageRouter";
import { getAudioForCurrentLanguage } from "../../utils/audioUtils";
import ReplayAudio from "../ReplayAudio";
import Interpersonal from "../../assets/voice/intrapersonal.jpeg";
import Kinesthetic from "../../assets/voice/kinesthic.jpeg";
import Logical from "../../assets/voice/logical.jpeg";
import Musical from "../../assets/voice/musical.jpeg";
import Verbal from "../../assets/voice/verbal.jpeg";
import Nature from "../../assets/voice/nature.jpeg";
import textframe from "../../assets/textFrame.png"
import Interpersonal360 from "../../assets/voice/intrapersonal_360.png";
import Kinesthetic360 from "../../assets/voice/kinestic_360.png";
import Logical360 from "../../assets/voice/logical_360.png";
import Musical360 from "../../assets/voice/musical_360.png";
import Verbal360 from "../../assets/voice/verbal_360.png";
import Nature360 from "../../assets/voice/nature_360.png";
import icon360 from "../../assets/voice/360_icon.png"

import View360Viewer from "./View360Viewer";
import bg1 from "../../assets/lightbg.png";

const IMAGES = [
  { src: Interpersonal, labelKey: "voice.labels.interpersonal", src360: Interpersonal360 },
  { src: Kinesthetic, labelKey: "voice.labels.kinesthetic", src360: Kinesthetic360 },
  { src: Logical, labelKey: "voice.labels.logical", src360: Logical360 },
  { src: Musical, labelKey: "voice.labels.musical", src360: Musical360 },
  { src: Verbal, labelKey: "voice.labels.verbal", src360: Verbal360 },
  { src: Nature, labelKey: "voice.labels.nature", src360: Nature360 },
];

// ─── Drum constants ───────────────────────────────────────────────────────────
const ITEM_HEIGHT = 420;
const AUTO_SCROLL_MS = 100000;
const AUTO_SCROLL_RESUME = 1800;
const SCROLL_SENSITIVITY = 2.2;
const SNAP_DISTANCE = 80;
const FRICTION = 0.88;
const VELOCITY_THRESHOLD = 0.5;

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

// FIX (Issue 2): Helper to compute the allowed dragCurrent bounds
// based on current selectedIndex so we never accumulate runaway offsets
// at index 0 or the last index.
function clampDragOffset(offset, selectedIndex) {
  // drag DOWN (positive) moves toward lower indices, capped at selectedIndex items
  const maxOffset = selectedIndex * ITEM_HEIGHT;
  // drag UP (negative) moves toward higher indices, capped at remaining items
  const minOffset = -(IMAGES.length - 1 - selectedIndex) * ITEM_HEIGHT;
  return Math.max(minOffset, Math.min(maxOffset, offset));
}

export default function VoiceAnalysis() {
  const user = useSelector((state) => state.common.user);
  const screeningState = useSelector((state) => state.common.screening);
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const [phase, setPhase] = useState("picking");
  const [selectedIndex, setSelectedIndex] = useState(Math.floor(IMAGES.length / 2));
  const [dragOffset, setDragOffset] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const [confirmedImage, setConfirmedImage] = useState(null);
  const [voiceBars, setVoiceBars] = useState(Array(9).fill(0));
  const [status, setStatus] = useState("idle");
  const [isComplete, setIsComplete] = useState(false);

  const navigate = useNavigate();

  // ── Drag / momentum refs ─────────────────────────────────────────────────
  const dragStartY = useRef(null);
  const dragCurrent = useRef(0);
  const velocityRef = useRef(0);
  const lastY = useRef(null);
  const lastTimeRef = useRef(null);
  const momentumRAF = useRef(null);
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
  const [loading, setLoading] = useState(false);
  const isRecording = status === "recording";

  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const instructionAudioRef = useRef(null);

  const playInstructionAudio = useCallback(async () => {
    if (instructionAudioRef.current) {
      instructionAudioRef.current.pause();
      instructionAudioRef.current.currentTime = 0;
    }
    const audioPath = await getAudioForCurrentLanguage("voice_instruction");
    if (audioPath && instructionAudioRef.current) {
      instructionAudioRef.current.src = audioPath;
      setIsAudioPlaying(true);
      instructionAudioRef.current.play().catch((err) => {
        console.log("Instruction audio playback failed:", err);
        setIsAudioPlaying(false);
      });
    }
  }, []);

  const stopInstructionAudio = useCallback(() => {
    if (instructionAudioRef.current) {
      instructionAudioRef.current.pause();
      instructionAudioRef.current.currentTime = 0;
      setIsAudioPlaying(false);
    }
  }, []);

  const handleInstructionAudioEnd = useCallback(() => {
    setIsAudioPlaying(false);
  }, []);

  useEffect(() => {
    playInstructionAudio();
  }, [playInstructionAudio]);

  const selectedIndexRef = useRef(selectedIndex);
  useEffect(() => { selectedIndexRef.current = selectedIndex; }, [selectedIndex]);

  // ────────────────────────────────────────────────────────────────────────
  // Snap helper
  // ────────────────────────────────────────────────────────────────────────
  const snapToNearest = useCallback((currentOffset) => {
    const steps = Math.round(currentOffset / ITEM_HEIGHT);
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
  // Momentum loop
  // ────────────────────────────────────────────────────────────────────────
  const launchMomentum = useCallback(() => {
    cancelAnimationFrame(momentumRAF.current);

    const tick = () => {
      velocityRef.current *= FRICTION;

      if (Math.abs(velocityRef.current) < VELOCITY_THRESHOLD) {
        snapToNearest(dragCurrent.current);
        resumeTimer.current = setTimeout(scheduleAutoScroll, AUTO_SCROLL_RESUME);
        return;
      }

      dragCurrent.current += velocityRef.current;

      // FIX (Issue 2): use clampDragOffset here too so momentum respects boundaries
      dragCurrent.current = clampDragOffset(dragCurrent.current, selectedIndexRef.current);

      setDragOffset(dragCurrent.current);
      momentumRAF.current = requestAnimationFrame(tick);
    };

    momentumRAF.current = requestAnimationFrame(tick);
  }, [snapToNearest, scheduleAutoScroll]);

  // ────────────────────────────────────────────────────────────────────────
  // Pointer handlers
  // ────────────────────────────────────────────────────────────────────────
  const onPointerDown = (e) => {
    cancelAnimationFrame(momentumRAF.current);
    clearInterval(autoScrollRef.current);
    clearTimeout(resumeTimer.current);

    userTouching.current = true;
    dragStartY.current = e.clientY;
    lastY.current = e.clientY;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (dragStartY.current === null) return;

    const now = performance.now();
    const dt = Math.max(1, now - lastTimeRef.current);

    const dy = e.clientY - lastY.current;
    velocityRef.current = (dy / dt) * 16 * SCROLL_SENSITIVITY;

    lastY.current = e.clientY;
    lastTimeRef.current = now;

    const totalDelta = (e.clientY - dragStartY.current) * SCROLL_SENSITIVITY;

    // FIX (Issue 2): Clamp the drag so it can't accumulate beyond the list bounds.
    // Without this, dragging past index 0 or last index builds up a huge offset
    // that causes the wheel to snap back and feel "stuck" on release.
    const clamped = clampDragOffset(totalDelta, selectedIndexRef.current);
    dragCurrent.current = clamped;

    requestAnimationFrame(() => setDragOffset(clamped));
  };

  const onPointerUp = () => {
    if (dragStartY.current === null) return;

    userTouching.current = false;
    dragStartY.current = null;

    const delta = dragCurrent.current;

    if (Math.abs(velocityRef.current) > VELOCITY_THRESHOLD) {
      launchMomentum();
      return;
    }

    let step = 0;
    if (delta > SNAP_DISTANCE) step = -1;
    else if (delta < -SNAP_DISTANCE) step = 1;

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
  // Dot nav + non-center card nav
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
  // Recording helpers
  // ────────────────────────────────────────────────────────────────────────
  const smoothRef = useRef(
    Array(9).fill(0)
  );

  const visualizeVoice = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;

    // ✅ FIX: getByteTimeDomainData fills frequencyBinCount (=fftSize/2) samples,
    //    NOT fftSize — using fftSize left the second half zeroed, halving the RMS.
    const buffer = new Uint8Array(
      analyser.frequencyBinCount
    );

    analyser.getByteTimeDomainData(
      buffer
    );

    let sumSquares = 0;

    for (let i = 0; i < buffer.length; i++) {
      const sample = (buffer[i] - 128) / 128;

      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(
      sumSquares / buffer.length
    );

    const energy = Math.min(
      rms * 6,
      1
    );

    const nextBars = smoothRef.current.map(
      (_, i) => {
        const distance =
          Math.abs(i - 4);

        const weight =
          1 - distance * 0.12;

        const random =
          0.85 + Math.random() * 0.3;

        return Math.min(
          energy * weight * random,
          1
        );
      }
    );

    const smoothed = nextBars.map(
      (v, i) =>
        smoothRef.current[i] * 0.75 +
        v * 0.25
    );

    smoothRef.current = smoothed;

    setVoiceBars(smoothed);

    animFrameRef.current =
      requestAnimationFrame(
        visualizeVoice
      );
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
      // ✅ FIX: match WaveForm.jsx — larger fftSize gives more samples → richer RMS
      analyser.fftSize = 2048;
      // ✅ FIX: built-in temporal smoothing (same as WaveForm.jsx) prevents jitter
      analyser.smoothingTimeConstant = 0.85;
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
    setLoading(true);

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

          if (runResult.success) {
            if (runResult.screening) {
              dispatch(setScreening(runResult.screening));
            }
            setStatus("success");
            setLoading(false);
          } else {
            console.error("[Voice] run failed:", runResult.error);
            setStatus("error");
            setLoading(false);
          }
        } else {
          console.error("[Voice] store failed:", storeResult.error);
          setStatus("error");
          setLoading(false);
        }
      } catch (err) {
        console.error("[Voice] API error:", err);
        setStatus("error");
        setLoading(false);
      }
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
      if (instructionAudioRef.current) {
        instructionAudioRef.current.pause();
      }
    };
  }, []);

  // ── Card tap handlers ────────────────────────────────────────────────────
  const onCenterCardClick = () => {
    cancelAnimationFrame(momentumRAF.current);
    clearInterval(autoScrollRef.current);
    clearTimeout(resumeTimer.current);
    stopInstructionAudio();
    setConfirmedImage(IMAGES[selectedIndex]);
    setPhase("viewing");
    // ✅ FIX: start mic immediately so voice bars are live from the first frame.
    //    Previously recording only started after the user interacted with the
    //    panorama (onFirstInteract), meaning bars stayed flat until then.
    //    startRecording() has its own guard against double-starts.
    startRecording();
  };

  const onFirstInteract = useCallback(() => {
    setPhase("recording");
    startRecording();
  }, [startRecording]);

  const onTimerEnd = useCallback(() => {
    setIsComplete(true);
    stopRecordingAndSubmit();
  }, [stopRecordingAndSubmit]);

  const onNext = useCallback(() => {
    const nextRoute = getNextRoute(screeningState?.nextStage, '/colorblindness');
    console.log('[VoiceAnalysis] onNext — navigating to:', nextRoute);
    navigate(nextRoute);
  }, [navigate, screeningState]);

  // ✅ FIX: removed the effect that cancelled the RAF whenever isRecording was false.
  //    It fired on every initial render (isRecording starts false) and could race
  //    against a freshly-launched visualizeVoice loop. Cleanup is already handled
  //    correctly in stopRecordingAndSubmit and the unmount effect.

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
          {t("voice.analysing")}
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
          {t(confirmedImage.labelKey)}
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
          onNext={onNext}
          loading={loading}
        />
      </div>
    );
  }

  // ─── Picking phase — drum wheel ──────────────────────────────────────────
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      <audio
        ref={instructionAudioRef}
        onEnded={handleInstructionAudioEnd}
        onPlay={() => setIsAudioPlaying(true)}
      />
      <div
        className="absolute inset-0 bg-center bg-cover opacity-50"
        style={{ backgroundImage: `url(${bg1})` }}
      />

      <div className="relative z-10 w-full h-full flex flex-col items-center">

        {/* Header */}
        <div className="w-full flex flex-col items-center">
          <div className="absolute landscape:top-15 landscape:left-[20%] portrait:top-30 portrait:left-[20%] z-10 w-[60%]">
            <div className="relative flex flex-col items-center">
              <div className="relative flex items-center justify-center">
                <img
                  src={textframe}
                  alt="text-frame"
                  className="w-full"
                />
                <p className="absolute text-white text-center portrait:text-[32px] tracking-wider mt-14">
                  {t("voice.what_you_think")}
                </p>
              </div>
              <img
                src={textframe}
                alt="text-frame"
                className="rotate-180 mt-10"
              />
            </div>
          </div>
        </div>

        <div className="w-[60%] h-[200px] text-4xl text-white z-100 absolute top-[15rem] left-[16rem] flex items-center gap-6">
          <span>{t("voice.select_instruction")}</span>
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
              top: "60%",
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
            className="relative w-full h-full mt-96"
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

              // FIX (Issue 1): Determine if this card is adjacent (visible but not center).
              // We treat cards within ±2 slots as clickable so the partially-visible
              // top/bottom cards respond to taps and scroll the wheel to them.
              const isAdjacent = !isCentered && Math.abs(off) <= 2.2;

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
                    // FIX (Issue 1): adjacent cards get pointer cursor so user knows they're tappable
                    cursor: isCentered ? "pointer" : isAdjacent ? "pointer" : "grab",
                    pointerEvents: Math.abs(off) > 2.2 ? "none" : "auto",
                  }}
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
                      src={img.src} alt={t(img.labelKey)} draggable={false}
                      className="w-full h-full object-cover"
                      style={{ userSelect: "none", pointerEvents: "none" }}
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                    {/* 360° badge — only on center card */}
                    {isCentered && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onCenterCardClick();
                        }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
                      >
                        <img src={icon360} alt="360-icon" className="w-[100px] h-[100px]" />
                      </div>
                    )}

                    {/* FIX (Issue 1): Adjacent card overlay — tapping scrolls wheel to that card */}
                    {isAdjacent && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          goToIndex(i);
                        }}
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ zIndex: 5 }}
                      >
                        {/* Subtle "tap to select" hint — directional arrow */}
                        <div
                          className="px-4 py-2 rounded-full text-white text-xs tracking-widest uppercase"
                          style={{
                            background: "rgba(0,0,0,0.45)",
                            backdropFilter: "blur(6px)",
                            border: "1px solid rgba(154,217,255,0.25)",
                            opacity: 0.85,
                          }}
                        >
                          {off < 0 ? "▼ " : "▲ "}{t("voice.tap_to_explore")}
                        </div>
                      </div>
                    )}

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
                      {t(img.labelKey)}
                    </div>

                    {/* Tap hint on center card */}
                    {isCentered && (
                      <div className="absolute inset-0 flex items-end justify-center pb-14 pointer-events-none">
                        <span
                          className="text-white text-xs md:text-sm tracking-[0.3em] uppercase opacity-80"
                          style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
                        >
                          {t("voice.tap_to_explore")}
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