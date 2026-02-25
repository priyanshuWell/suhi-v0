import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
// import { useLocation } from "react-router-dom";

const BackgroundCamContext = createContext(null);

const UPLOAD_ROUTES = new Set(["/voice", "/screen1", "/progress", "/welcome"]);
const LOCAL_SAVE_ROUTES = new Set(["/bia/wh", "/bia/whcomplete"]);
const RECORD_ROUTES = new Set([...UPLOAD_ROUTES, ...LOCAL_SAVE_ROUTES]);
const CHUNK_SECONDS = 30;

export function BackgroundCameraProvider({ children }) {
  const location = useLocation();

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);

  const chunkPartsRef = useRef([]);
  const uploadQueueRef = useRef([]);
  const uploadingRef = useRef(false);

  const routeRef = useRef(location.pathname);
  const metadataRef = useRef({});
  const [cameraReady, setCameraReady] = useState(false);

  // ✅ 1) Preload camera immediately on app start
  useEffect(() => {
    routeRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    initCamera(); // opens immediately
    return () => stopEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initCamera() {
    try {
      // If already started, do nothing
      if (streamRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 25, max: 30 },
        },
        audio: false, // usually safe for kiosk recording
      });

      streamRef.current = stream;

      // Attach stream to hidden video element to keep it alive
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => { });
      }

      setCameraReady(true);
      console.log("✅ Background camera ready");

      // If user is already on a record route — start recording immediately
      if (RECORD_ROUTES.has(routeRef.current)) {
        startRecording();
      }
    } catch (err) {
      console.error("❌ Failed to init camera:", err);
      setCameraReady(false);
    }
  }

  // ✅ 2) Listen route changes and start/stop background recording
  useEffect(() => {
    const currentPath = location.pathname;

    if (RECORD_ROUTES.has(currentPath)) {
      // start only if camera is ready
      if (cameraReady) startRecording();
    } else {
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, cameraReady]);

  function startRecording() {
    // already recording => ignore
    if (recorderRef.current && recorderRef.current.state === "recording") return;

    const stream = streamRef.current;
    if (!stream) return;

    const mimeType = getSupportedMimeType();

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    chunkPartsRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunkPartsRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      const parts = chunkPartsRef.current;
      chunkPartsRef.current = [];

      if (!parts.length) {
        // Immediately restart next chunk
        safeRestartIfNeeded();
        return;
      }

      const blob = new Blob(parts, { type: recorder.mimeType || "video/webm" });
      const buffer = await blob.arrayBuffer();

      // ✅ add to upload queue, do not block next recording
      enqueueUpload({
        route: routeRef.current,
        timestamp: Date.now(),
        buffer,
        mimeType: blob.type,
        metadata: { ...metadataRef.current }
      });

      // ✅ start next chunk immediately
      safeRestartIfNeeded();
    };

    // Start recording
    recorder.start();
    console.log(`🎥 Recording started: ${routeRef.current}`);

    // only auto-chunk for non-LOCAL routes (i.e. UPLOAD routes)
    if (UPLOAD_ROUTES.has(routeRef.current)) {
      setTimeout(() => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      }, CHUNK_SECONDS * 1000);
    }
  }

  function safeRestartIfNeeded() {
    const currentRoute = routeRef.current;
    if (RECORD_ROUTES.has(currentRoute)) {
      // restart next chunk
      setTimeout(() => startRecording(), 0);
    }
  }

  function stopRecording() {
    try {
      if (recorderRef.current && recorderRef.current.state === "recording") {
        recorderRef.current.stop();
        console.log("🛑 Recording stopped");
      }
    } catch { }
    recorderRef.current = null;
    chunkPartsRef.current = [];
  }

  function stopEverything() {
    stopRecording();

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch { }
    streamRef.current = null;
    setCameraReady(false);
  }

  // ✅ Upload Queue (async, non-blocking)
  function enqueueUpload(payload) {
    uploadQueueRef.current.push(payload);
    processUploadQueue();
  }

  async function processUploadQueue() {
    if (uploadingRef.current) return;
    uploadingRef.current = true;

    while (uploadQueueRef.current.length > 0) {
      const item = uploadQueueRef.current.shift();
      try {
        if (LOCAL_SAVE_ROUTES.has(item.route)) {
          await saveVideoLocally(item);
        } else {
          // await uploadVideoChunk(item);
        }
      } catch (err) {
        console.error("❌ Processing failed:", err);
      }
    }

    uploadingRef.current = false;
  }

  // ✅ Original placeholder upload call
  // async function uploadVideoChunk({ route, timestamp, buffer, mimeType }) {
  //   console.log("⬆️ Uploading chunk:", route, new Date(timestamp).toISOString());

  //   // create formdata
  //   const blob = new Blob([buffer], { type: mimeType || "video/webm" });
  //   const file = new File([blob], `${route.replace(/\//g, "_")}-${timestamp}.webm`, { type: blob.type });

  //   const form = new FormData();
  //   form.append("route", route);
  //   form.append("timestamp", String(timestamp));
  //   form.append("video", file);

  //   // Replace with your API endpoint if needed, or keep as placeholder
  //   try {
  //     const res = await fetch("YOUR_API_ENDPOINT", {
  //       method: "POST",
  //       body: form,
  //     });

  //     if (!res.ok) {
  //       throw new Error(`Upload error: ${res.status}`);
  //     }
  //   } catch (err) {
  //     console.warn("⚠️ Upload placeholder failed (expected if endpoint missing):", err.message);
  //   }
  // }

  // ✅ Local Save call (used for BIA)
  async function saveVideoLocally({ route, timestamp, buffer, mimeType, metadata }) {
    console.log("💾 Saving chunk:", route, new Date(timestamp).toISOString());

    if (!window.api?.saveRecording) {
      console.warn("⚠️ window.api.saveRecording not found, skipping save");
      return;
    }

    const filename = `background_${route.replace(/\//g, "_")}_${timestamp}.webm`;

    try {
      const result = await window.api.saveRecording({
        arrayBuffer: buffer,
        filename: filename,
        route,
        timestamp,
        metadata
      });

      if (result.success) {
        console.log("✅ Chunk saved successfully:", result.filePath);
      } else {
        console.error("❌ Failed to save chunk:", result.error);
      }
    } catch (err) {
      console.error("❌ Error calling saveRecording:", err);
    }
  }

  function updateMetadata(key, value) {
    if (typeof key === "object") {
      metadataRef.current = { ...metadataRef.current, ...key };
    } else {
      metadataRef.current[key] = value;
    }
    console.log("📝 Metadata updated:", metadataRef.current);
  }

  function clearMetadata() {
    metadataRef.current = {};
  }

  function getSupportedMimeType() {
    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  }

  return (
    <BackgroundCamContext.Provider value={{ cameraReady, updateMetadata, clearMetadata, startRecording, stopRecording }}>
      {/* Hidden video keeps stream alive */}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        style={{
          position: "fixed",
          width: "1px",
          height: "1px",
          opacity: 0,
          left: "-9999px",
          top: "-9999px",
        }}
      />
      {children}
    </BackgroundCamContext.Provider>
  );
}

export function useBackgroundCamera() {
  return useContext(BackgroundCamContext);
}
