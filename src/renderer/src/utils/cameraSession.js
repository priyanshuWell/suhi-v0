// import { selectThreeCameras } from "./selectThreeCamera";

// let cameraSession = null;
// export async function openCamerasInBackground() {
//   const selected = await selectThreeCameras();
//   const sessions = [];

//   for (const { role, cam } of selected) {
//     const stream = await navigator.mediaDevices.getUserMedia({
//       video: {
//         deviceId: { exact: cam.deviceId },
//         width: 640,
//         height: 480,
//         frameRate: 30
//       }
//     });

//     sessions.push({ role, cam, stream });
//   }
//   console.log("Session",sessions)
//   cameraSession = sessions;
//   return cameraSession;
// }

// export function getCameraSession() {
//   if (!cameraSession) {
//     throw new Error("CAMERAS_NOT_INITIALIZED");
//   }
//   return cameraSession;
// }

// export function closeAllCameras() {
//   cameraSession?.forEach(s =>
//     s.stream.getTracks().forEach(t => t.stop())
//   );
//   cameraSession = null;
// }

import { selectThreeCameras } from "./selectThreeCamera"

let cameraSession = null

export async function openCamerasInBackground() {
    const selected = await selectThreeCameras()
    const sessions = []

    for (const { role, cam } of selected) {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: { exact: cam.deviceId },
                width: 640,
                height: 480,
                frameRate: 30
            },
            audio: false
        })

        // :white_check_mark: Fix only CENTER stream (rotate to vertical)
        const fixedStream = role === "CENTER" ? await rotateStream90(stream) : stream
        // const fixedStream = stream;

        sessions.push({ role, cam, stream: fixedStream })
    }

    console.log("Session", sessions)
    cameraSession = sessions
    return cameraSession
}

export function getCameraSession() {
    if (!cameraSession) throw new Error("CAMERAS_NOT_INITIALIZED")
    return cameraSession
}

export function closeAllCameras() {
    cameraSession?.forEach((s) => s.stream.getTracks().forEach((t) => t.stop()))
    cameraSession = null
}

/**
 * :white_check_mark: Rotates stream 90° left and outputs corrected stream
 */
async function rotateStream90(stream) {
    const video = document.createElement("video")
    video.srcObject = stream
    video.muted = true
    video.playsInline = true

    await video.play()

    // swap width/height because rotation
    const w = video.videoWidth
    const h = video.videoHeight

    const canvas = document.createElement("canvas")
    canvas.width = h // swapped
    canvas.height = w // swapped

    const ctx = canvas.getContext("2d")

    function draw() {
        ctx.save()
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // // :white_check_mark: rotate 90 degrees to make vertical
        // ctx.translate(canvas.width / 2, canvas.height / 2);
        // ctx.rotate(Math.PI / 2);

        // ctx.drawImage(video, -w / 2, -h / 2, w, h);
        // ctx.restore();
        ctx.translate(canvas.width / 2, canvas.height / 2)

        // rotate 80 degrees
        ctx.rotate((-180 * Math.PI) / 180)

        // draw video centered
        ctx.drawImage(video, -w / 2, -h / 2, w, h)
        ctx.restore()

        requestAnimationFrame(draw)
    }

    draw()

    // record from canvas stream
    const canvasStream = canvas.captureStream(30)

    // :white_check_mark: keep original audio if ever needed (not in your case)
    // const audioTracks = stream.getAudioTracks();
    // audioTracks.forEach(t => canvasStream.addTrack(t));

    return canvasStream
}
