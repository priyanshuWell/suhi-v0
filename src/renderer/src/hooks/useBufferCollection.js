import { useEffect, useRef, useState, useCallback } from "react"
import { sendVideoToBackend, bufferCollection } from "../utils/api"
import { getRgbCameraConstraints } from "../utils/getRgbCamera"
import { getKioskId } from "../utils/config"
import { rotateStream90 } from "../components/dmit/NewDmit"

/**
 * usePageBufferCollection
 *
 * Captures video buffer for a PAGE GROUP (e.g. BIA, Voice, ColorBlindness, SpaceConvoy).
 * Each page group captures at most 1 minute of video across all its sub-routes.
 *
 * Uses screening.sessionId (from /realtime/capture API) as the session_id
 * for the /buffer-collection API call.
 *
 * Flow:
 *  1. Start camera recording when component mounts (or startCollection called)
 *  2. After maxDuration (default 60s), stop recording
 *  3. Send buffer to /video/store → get shm_path
 *  4. Call /buffer-collection with { shm_video_path, user_id, session_id, buffer_type, kiosk_id }
 *
 * @param {string} screeningSessionId - The session_id from screening (from /realtime/capture)
 * @param {string} userId - The user_id
 * @param {string} bufferType - Buffer type identifier (BIA, VOICE, COLOR_BLINDNESS, SPACE_CONVOY)
 * @param {boolean} isEnabled - Whether collection is enabled
 * @param {number} maxDuration - Max recording duration in ms (default 60000 = 1 min)
 */
export const usePageBufferCollection = ({
    screeningSessionId,
    userId,
    bufferType = "GENERAL",
    isEnabled = true,
    maxDuration = 60000
}) => {
    const [isCollecting, setIsCollecting] = useState(false)
    const [collectionStatus, setCollectionStatus] = useState("idle")
    const [lastCollectionTime, setLastCollectionTime] = useState(null)
    const [error, setError] = useState(null)

    const mediaRecorderRef = useRef(null)
    const chunksRef = useRef([])
    const streamRef = useRef(null)
    const rawStreamRef = useRef(null)
    const timeoutRef = useRef(null)
    const hasCollectedRef = useRef(false)
    const isCollectingRef = useRef(false)
    const startTimeRef = useRef(null)

    const kioskId = getKioskId()

    // ─── Cleanup camera/recorder ─────────────────────────────────────────────
    const _cleanup = useCallback(() => {
        if (typeof streamRef.current?.stop === "function") {
            streamRef.current.stop()
        }
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        rawStreamRef.current?.getTracks().forEach((t) => t.stop())
        rawStreamRef.current = null
        mediaRecorderRef.current = null
        chunksRef.current = []
        console.log("[BUFFER COLLECTION] Camera and recorder cleaned up")
    }, [])

    const stopTimers = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }
    }, [])

    // ─── Process and send buffer ──────────────────────────────────────────────
    const _processAndSendBuffer = useCallback(
        async (reason = "duration") => {
            if (hasCollectedRef.current) return
            if (!screeningSessionId || !userId || !kioskId) {
                console.warn(
                    "[BUFFER COLLECTION] Missing required params — screeningSessionId:",
                    screeningSessionId,
                    "userId:",
                    userId,
                    "kioskId:",
                    kioskId
                )
                return
            }

            hasCollectedRef.current = true
            stopTimers()

            const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0
            console.log(`[BUFFER COLLECTION] ── Buffer collection END (reason: ${reason}) ──`)
            console.log(
                `[BUFFER COLLECTION] Duration recorded: ${(elapsed / 1000).toFixed(1)}s, bufferType: ${bufferType}`
            )

            try {
                setCollectionStatus("processing")
                setError(null)

                // Stop the recorder and wait for final chunk
                const recorder = mediaRecorderRef.current
                if (recorder && recorder.state !== "inactive") {
                    await new Promise((resolve) => {
                        recorder.onstop = resolve
                        recorder.stop()
                    })
                }

                const blob = new Blob(chunksRef.current, { type: "video/webm" })
                console.log(
                    `[BUFFER COLLECTION] Buffer size: ${(blob.size / 1024).toFixed(1)}KB, chunks: ${chunksRef.current.length}`
                )

                if (blob.size === 0) {
                    console.warn("[BUFFER COLLECTION] Empty buffer — skipping API calls")
                    setCollectionStatus("completed")
                    _cleanup()
                    return
                }

                // Step 1: Send to /video/store
                console.log("[BUFFER COLLECTION] Step 1: Sending buffer to /video/store API...")
                const buffer = await blob.arrayBuffer()
                const storeResponse = await sendVideoToBackend({
                    buffer: new Uint8Array(buffer),
                    role: bufferType.toLowerCase(),
                    deviceId: kioskId
                })

                console.log("[BUFFER COLLECTION] /video/store response:", storeResponse)

                if (!storeResponse.success) {
                    throw new Error(`/video/store failed: ${storeResponse.error}`)
                }

                const shmPath = storeResponse?.shm_path || storeResponse?.data?.shm_path
                if (!shmPath) {
                    throw new Error("/video/store did not return shm_path")
                }

                console.log("[BUFFER COLLECTION] shm_path received:", shmPath)

                // Step 2: Call /buffer-collection with correct screening session_id
                console.log("[BUFFER COLLECTION] Step 2: Calling /buffer-collection API...")
                console.log("[BUFFER COLLECTION] Payload:", {
                    shm_video_path: shmPath,
                    user_id: userId,
                    session_id: screeningSessionId,
                    buffer_type: bufferType,
                    kiosk_id: kioskId
                })

                const collectionResponse = await bufferCollection(
                    shmPath,
                    userId,
                    screeningSessionId, // Correct session_id from /realtime/capture → screening.sessionId
                    bufferType,
                    kioskId
                )

                console.log("[BUFFER COLLECTION] /buffer-collection response:", collectionResponse)

                if (!collectionResponse.success) {
                    throw new Error(`/buffer-collection failed: ${collectionResponse.error}`)
                }

                setCollectionStatus("completed")
                setLastCollectionTime(Date.now())
                console.log("[BUFFER COLLECTION] ✅ Buffer collection completed successfully")
            } catch (collectionError) {
                console.error(
                    "[BUFFER COLLECTION] ❌ Error during buffer collection:",
                    collectionError.message
                )
                setError(collectionError.message)
                setCollectionStatus("error")
            } finally {
                _cleanup()
                setIsCollecting(false)
                isCollectingRef.current = false
            }
        },
        [screeningSessionId, userId, kioskId, bufferType, stopTimers, _cleanup]
    )

    // ─── Start collection ─────────────────────────────────────────────────────
    const startCollection = useCallback(async () => {
        if (!isEnabled || isCollectingRef.current) return
        if (!screeningSessionId || !userId || !kioskId) {
            console.warn("[BUFFER COLLECTION] Cannot start — missing params:", {
                screeningSessionId: !!screeningSessionId,
                userId: !!userId,
                kioskId: !!kioskId
            })
            return
        }

        console.log("[BUFFER COLLECTION] ── Buffer collection START ──")
        console.log("[BUFFER COLLECTION] Config:", {
            screeningSessionId,
            userId,
            kioskId,
            bufferType,
            maxDuration: `${maxDuration / 1000}s`
        })

        hasCollectedRef.current = false
        isCollectingRef.current = true
        startTimeRef.current = Date.now()
        setIsCollecting(true)
        setCollectionStatus("collecting")
        setError(null)

        try {
            // Start camera recording
            const videoConstraints = await getRgbCameraConstraints({
                width: 640,
                height: 480,
                frameRate: 15
            })

            const rawStream = await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
                audio: false
            })

            rawStreamRef.current = rawStream
            const stream = await rotateStream90(rawStream)
            streamRef.current = stream
            chunksRef.current = []

            const recorder = new MediaRecorder(stream, {
                mimeType: "video/webm;codecs=vp8"
            })

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data)
                }
            }

            recorder.start(1000) // 1s timeslices
            mediaRecorderRef.current = recorder

            console.log(
                "[BUFFER COLLECTION] Recording started — will collect for max",
                maxDuration / 1000,
                "seconds"
            )

            // Set timeout to stop after maxDuration
            timeoutRef.current = setTimeout(() => {
                _processAndSendBuffer("duration_reached")
            }, maxDuration)
        } catch (err) {
            console.error("[BUFFER COLLECTION] ❌ Failed to start recording:", err.message)
            setError(err.message)
            setCollectionStatus("error")
            isCollectingRef.current = false
            setIsCollecting(false)
        }
    }, [
        isEnabled,
        screeningSessionId,
        userId,
        kioskId,
        bufferType,
        maxDuration,
        _processAndSendBuffer
    ])

    // ─── Stop collection early ────────────────────────────────────────────────
    const stopCollection = useCallback(
        (reason = "page_exit") => {
            stopTimers()

            if (isCollectingRef.current && !hasCollectedRef.current) {
                console.log(
                    `[BUFFER COLLECTION] Stopping early (reason: ${reason}) — sending collected buffer`
                )
                _processAndSendBuffer(reason)
                return
            }

            _cleanup()
            setIsCollecting(false)
            isCollectingRef.current = false
            setCollectionStatus("stopped")
        },
        [stopTimers, _processAndSendBuffer, _cleanup]
    )

    // ─── Auto-start on mount, auto-stop on unmount ────────────────────────────
    useEffect(() => {
        if (isEnabled && screeningSessionId && userId && kioskId) {
            startCollection()
        }

        return () => {
            if (isCollectingRef.current && !hasCollectedRef.current) {
                _processAndSendBuffer("unmount")
            } else {
                stopTimers()
                _cleanup()
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEnabled, screeningSessionId, userId])

    return {
        isCollecting,
        collectionStatus,
        lastCollectionTime,
        error,
        startCollection,
        stopCollection
    }
}

// Backward-compatible alias for existing imports
export const useBufferCollection = usePageBufferCollection
