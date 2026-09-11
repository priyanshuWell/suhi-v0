/**
 * Four screening steps — each captures at most 1 minute of video across all
 * listed routes. Recording continues when navigating between routes in the
 * same step; once 1 minute is captured, no further recording for that step.
 */
export const BUFFER_COLLECTION_MAX_MS = 60000

export const BUFFER_COLLECTION_STEPS = [
    {
        bufferType: "BIA",
        routes: [
            // '/bia/leg50',
            // '/bia/wh',
            "/bia/whcomplete",
            "/bia/im",
            "/bia/imcomplete"
        ]
    },
    {
        bufferType: "VOICE",
        routes: ["/voice"]
    },
    {
        bufferType: "COLOR_BLINDNESS",
        routes: ["/colorblindness", "/colorblindness/quiz"]
    },
    {
        bufferType: "SMOOTH_SLASH",
        routes: ["/smoothie-slash"]
    },
    {
        bufferType: "PERILOUS_PATH",
        routes: ["/perilous-path"]
    },
    {
        bufferType: "BEAT_DROP",
        routes: ["/beat-drop"]
    },
    {
        bufferType: "VISION_ACUITY",
        routes: ["/adaptive-eye"]
    }
]

/**
 * @param {string} pathname
 * @returns {{ bufferType: string, routes: string[] } | null}
 */
export function getStepForPath(pathname) {
    for (const step of BUFFER_COLLECTION_STEPS) {
        if (step.routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
            return step
        }
    }
    return null
}

/** @deprecated Use getStepForPath */
export function getBufferCollectionConfig(pathname) {
    const step = getStepForPath(pathname)
    return step ? { bufferType: step.bufferType } : null
}

export function shouldCollectBufferOnRoute(pathname) {
    return !!getStepForPath(pathname)
}
