/**
 * Global Camera Tracker
 *
 * This utility monkey-patches getUserMedia and captureStream to keep track of
 * all active media streams in the application. This ensures that we can
 * forcefully release all camera resources regardless of where they were opened.
 */

const activeStreams = new Set()

/**
 * Initializes the global tracker by monkey-patching MediaDevices and Canvas prototypes.
 */
export function initCameraTracker() {
    if (typeof window === "undefined" || window.__cameraTrackerInitialized) return

    console.log("[CAMERA TRACKER] Initializing global camera tracking...")

    // 1. Patch navigator.mediaDevices.getUserMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const originalGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
        navigator.mediaDevices.getUserMedia = async function (constraints) {
            console.log("[CAMERA TRACKER] Intercepted getUserMedia call")
            const stream = await originalGUM(constraints)
            activeStreams.add(stream)

            // Cleanup set when all tracks in this stream are stopped externally
            stream.getTracks().forEach((track) => {
                track.addEventListener("ended", () => {
                    // We check if all tracks are ended before removing, but it's simpler
                    // to just let stopAllTracks handle it or rely on the set.
                })
            })

            return stream
        }
    }

    // 2. Patch HTMLCanvasElement.prototype.captureStream (used for rotated streams)
    if (typeof HTMLCanvasElement !== "undefined" && HTMLCanvasElement.prototype.captureStream) {
        const originalCaptureStream = HTMLCanvasElement.prototype.captureStream
        HTMLCanvasElement.prototype.captureStream = function (frameRate) {
            console.log("[CAMERA TRACKER] Intercepted captureStream call")
            const stream = originalCaptureStream.call(this, frameRate)
            activeStreams.add(stream)
            return stream
        }
    }

    window.__cameraTrackerInitialized = true
    console.log("[CAMERA TRACKER] Global camera tracking initialized")
}

/**
 * Forcefully stops all tracks in all tracked streams and clears the set.
 */
export function stopAllTracks() {
    console.log(`[CAMERA TRACKER] Stopping ${activeStreams.size} active streams...`)

    activeStreams.forEach((stream) => {
        try {
            // Stop all tracks
            stream.getTracks().forEach((track) => {
                console.log(`[CAMERA TRACKER] Stopping track: ${track.label} (${track.kind})`)
                track.stop()
            })

            // Call custom stop() if it exists (e.g., from our rotated stream implementation)
            if (typeof stream.stop === "function") {
                console.log("[CAMERA TRACKER] Calling custom stream.stop()")
                stream.stop()
            }
        } catch (err) {
            console.error("[CAMERA TRACKER] Error stopping stream:", err)
        }
    })

    activeStreams.clear()
    console.log("[CAMERA TRACKER] All tracked streams processed.")
}
