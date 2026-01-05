import { getCameraSession } from "./cameraSession";

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

  recorders.forEach(r => r.recorder.start());
  await Promise.all(startBarrier);

  await new Promise(r => setTimeout(r, durationMs));

  await Promise.all(
    recorders.map(
      r =>
        new Promise(res => {
          r.recorder.onstop = res;
          r.recorder.stop();
        })
    )
  );

  return Promise.all(
    recorders.map(async r => {
      const blob = new Blob(r.chunks, { type: "video/webm" });
      return {
        role: r.role,
        deviceId: r.cam.deviceId,
        buffer: new Uint8Array(await blob.arrayBuffer())
      };
    })
  );
}
