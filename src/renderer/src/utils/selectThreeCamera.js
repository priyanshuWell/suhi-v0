import { getRgbCamera } from "./getRgbCamera";

export async function selectThreeCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter((d) => d.kind === "videoinput");
  console.log("[CAMERA] All video devices:", cams.map((c) => c.label));

  // Prefer RGB camera as CENTER; fall back to first available
  const rgbDeviceId = await getRgbCamera();
  const centerCam = cams.find((c) => c.deviceId === rgbDeviceId) ?? cams[0];

  console.log("[CAMERA] selectThreeCameras → CENTER:", centerCam?.label);

  return [
    { role: "CENTER", cam: centerCam },
  ];
}
