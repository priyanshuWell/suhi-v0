/**
 * getRgbCamera
 *
 * Enumerates all video input devices and returns the deviceId of
 * the first camera whose label includes "rgb" (case-insensitive).
 * Falls back to the first available camera if no RGB camera is found.
 *
 * @returns {Promise<string|null>} deviceId or null if no cameras at all
 */
export async function getRgbCamera() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === "videoinput");

    if (!videoDevices.length) {
      console.warn("[CAMERA] ⚠️ No video devices found");
      return null;
    }

    const rgb = videoDevices.find((d) =>
      d.label.toLowerCase().includes("rgb")
    );

    if (rgb) {
      console.log(`[CAMERA] 📷 RGB camera selected: "${rgb.label}" (${rgb.deviceId})`);
      return rgb.deviceId;
    }

    // Fallback
    console.warn(
      `[CAMERA] ⚠️ No RGB camera found — falling back to: "${videoDevices[0].label}"`
    );
    return videoDevices[0].deviceId;
  } catch (err) {
    console.warn("[CAMERA] ⚠️ enumerateDevices failed:", err.message);
    return null;
  }
}

/**
 * getRgbCameraConstraints
 *
 * Returns a getUserMedia video constraint object that targets the
 * RGB camera (with fallback). Pass directly as `video:` in getUserMedia.
 *
 * @param {Object} extras  Extra constraints to merge (e.g. width, height, frameRate)
 * @returns {Promise<Object>} video constraint object
 */
export async function getRgbCameraConstraints(extras = {}) {
  const deviceId = await getRgbCamera();
  if (deviceId) {
    return { deviceId: { exact: deviceId }, ...extras };
  }
  // No deviceId — let browser pick, still apply extras
  return { ...extras };
}
