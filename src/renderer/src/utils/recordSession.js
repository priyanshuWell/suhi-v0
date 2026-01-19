// import { getCameraSession } from "./cameraSession";

// export async function recordFromOpenCameras(durationMs = 5000) {
//   const sessions = getCameraSession();

//   const recorders = [];
//   const startBarrier = [];

//   for (const s of sessions) {
//     const recorder = new MediaRecorder(s.stream, {
//       mimeType: "video/webm;codecs=vp8",
//       videoBitsPerSecond: 1_600_000
//     });

//     const chunks = [];
//     recorder.ondataavailable = e => e.data.size && chunks.push(e.data);

//     recorders.push({ ...s, recorder, chunks });
//     startBarrier.push(new Promise(r => (recorder.onstart = r)));
//   }

//   recorders.forEach(r => r.recorder.start());
//   await Promise.all(startBarrier);

//   await new Promise(r => setTimeout(r, durationMs));

//   await Promise.all(
//     recorders.map(
//       r =>
//         new Promise(res => {
//           r.recorder.onstop = res;
//           r.recorder.stop();
//         })
//     )
//   );

//   return Promise.all(
//     recorders.map(async r => {
//       const blob = new Blob(r.chunks, { type: "video/webm" });
//       return {
//         role: r.role,
//         deviceId: r.cam.deviceId,
//         buffer: new Uint8Array(await blob.arrayBuffer())
//       };
//     })
//   );
// }





































import { getCameraSession } from "./cameraSession";

/**
 * Record video from all open cameras
 * @param {number} durationMs - Recording duration in milliseconds (default: 5000ms = 5 seconds)
 * @returns {Promise<Array>} Array of recordings with role, deviceId, and buffer
 */
export async function recordFromOpenCameras(durationMs = 5000) {
  const sessions = getCameraSession();

  const recorders = [];
  const startBarrier = [];

  for (const s of sessions) {
    const recorder = new MediaRecorder(s.stream, {
      mimeType: "video/webm;codecs=vp8",
      videoBitsPerSecond: 1_600_000
    });

    const chunks = [];
    recorder.ondataavailable = e => e.data.size && chunks.push(e.data);

    recorders.push({ ...s, recorder, chunks });
    startBarrier.push(new Promise(r => (recorder.onstart = r)));
  }

  // Start all recorders
  recorders.forEach(r => r.recorder.start());
  await Promise.all(startBarrier);

  console.log(`Recording for ${durationMs}ms (${durationMs / 1000} seconds)...`);

  // Record for the specified duration
  await new Promise(r => setTimeout(r, durationMs));

  // Stop all recorders
  await Promise.all(
    recorders.map(
      r =>
        new Promise(res => {
          r.recorder.onstop = res;
          r.recorder.stop();
        })
    )
  );

  // Convert chunks to Uint8Array buffers
  return Promise.all(
    recorders.map(async r => {
      const blob = new Blob(r.chunks, { type: "video/webm" });
      const buffer = new Uint8Array(await blob.arrayBuffer());
      
      console.log(`Recorded ${buffer.length} bytes from ${r.role} camera`);
      
      return {
        role: r.role,
        deviceId: r.cam.deviceId,
        buffer: buffer
      };
    })
  );
}
