import { selectThreeCameras } from "./selectThreeCamera";

let cameraSession = null;
export async function openCamerasInBackground() {
  const selected = await selectThreeCameras();
  const sessions = [];

  for (const { role, cam } of selected) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: cam.deviceId },
        width: 640,
        height: 480,
        frameRate: 30
      }
    });

    sessions.push({ role, cam, stream });
  }
  console.log("Session",sessions)
  cameraSession = sessions;
  return cameraSession;
}

export function getCameraSession() {
  if (!cameraSession) {
    throw new Error("CAMERAS_NOT_INITIALIZED");
  }
  return cameraSession;
}

export function closeAllCameras() {
  cameraSession?.forEach(s =>
    s.stream.getTracks().forEach(t => t.stop())
  );
  cameraSession = null;
}
