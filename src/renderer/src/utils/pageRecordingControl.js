let releaseCameraFn = null

export function registerPageRecordingRelease(fn) {
    releaseCameraFn = fn
}

export function unregisterPageRecordingRelease(fn) {
    if (releaseCameraFn === fn) {
        releaseCameraFn = null
    }
}

export function releasePageRecordingCamera() {
    releaseCameraFn?.()
    releaseCameraFn = null
}
