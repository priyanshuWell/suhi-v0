import { useEffect, useRef, useState } from "react"
import { useDispatch } from "react-redux"
import { setHeight, setWeight } from "../../features/common/commonSlice"
import { PORT_PATHS } from "../../utils/portConfig"
import HeightWeightComplete from "./HeightWeightComplete"

/**
 * HeightWeightCalculate
 *
 * Self-contained component that measures height and weight, then shows
 * the HeightWeightComplete screen once both values are available.
 *
 * Props:
 *   onComplete({ height, weight }) — called when user clicks "Next"
 *                                    after both measurements succeed.
 *                                    Each value has { value: number, unit: string }.
 */
export default function HeightWeightCalculate({ onComplete }) {
    const dispatch = useDispatch()

    // ── State ──────────────────────────────────────────────────────────────
    const [isComplete, setIsComplete] = useState(false)
    const [displayValues, setDisplayValues] = useState({ height: null, weight: null })

    // ── Refs ───────────────────────────────────────────────────────────────
    /** Raw measurement results — passed to onComplete */
    const resultsRef = useRef({ weight: null, height: null })
    /** Guard so the measurement loop only starts once */
    const isRunningRef = useRef(false)

    // ── Constants ──────────────────────────────────────────────────────────
    const HEIGHT_SENSOR_TIMEOUT_MS = 10000

    // ── Utilities ──────────────────────────────────────────────────────────
    /**
     * Races `promise` against a hard deadline.
     * Rejects with `errorMessage` if the timeout fires first.
     */
    const withTimeout = (promise, timeoutMs, errorMessage) =>
        Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
            )
        ])

    // ── Measurement helpers ────────────────────────────────────────────────
    /**
     * Calls the weight sensor API and stores the result.
     * Throws if no weight data is returned.
     */
    const measureWeight = async () => {
        console.log("[HW] Starting weight measurement...")
        const res = await window.api.startWeightMeasurement()
        console.log("[HW] Weight result:", res)

        if (!res?.weight) {
            console.error("[HW] Weight measurement failed — no weight data")
            throw new Error("Weight failed")
        }

        resultsRef.current.weight = {
            value: Number(res.weight),
            unit: "kg"
        }
        console.log(`[HW] Weight stored: ${res.weight} kg`)
        dispatch(setWeight(resultsRef.current.weight.value))
        return res
    }

    /**
     * Connects the height port, races the sensor against a 10 s deadline,
     * then stores the result. Disconnects the port on any error.
     * Throws if no height data or timeout occurs.
     */
    const measureHeight = async () => {
        console.log("[HW] Starting height measurement (10 s timeout)...")
        console.log("[HW] Connecting to height port:", PORT_PATHS.HEIGHT)
        await window.api.connectHeightPort(PORT_PATHS.HEIGHT)

        try {
            const res = await withTimeout(
                window.api.startHeightMeasurement(),
                HEIGHT_SENSOR_TIMEOUT_MS,
                "Height measurement timeout — user may not be standing properly"
            )
            console.log("[HW] Height result:", res)

            if (!res?.height) {
                console.error("[HW] Height measurement failed — no height data")
                throw new Error("Height failed")
            }

            resultsRef.current.height = {
                value: Number(res.height),
                unit: "cm"
            }
            console.log(`[HW] Height stored: ${res.height} cm`)
            dispatch(setHeight(resultsRef.current.height.value))
            return res
        } catch (err) {
            // Disconnect so a subsequent attempt can reconnect to a clean state
            console.warn("[HW] Height error/timeout — disconnecting port before retry:", err.message)
            await window.api.disconnectHeightPort().catch(() => {})
            throw err
        }
    }

    // ── Main measurement loop ──────────────────────────────────────────────
    /**
     * Runs weight and height in parallel.
     * If either fails it is retried independently on the next iteration.
     * The loop continues until BOTH values are successfully measured.
     */
    const runMeasurement = async () => {
        if (isRunningRef.current) return
        isRunningRef.current = true

        console.log("[HW] ========== START Height + Weight measurement ==========")

        let weightOk = false
        let heightOk = false

        while (!weightOk || !heightOk) {
            const tasks = []

            if (!weightOk) {
                tasks.push(
                    measureWeight()
                        .then(() => {
                            weightOk = true
                        })
                        .catch((err) => {
                            console.warn("[HW] Weight attempt failed, will retry:", err.message)
                        })
                )
            }

            if (!heightOk) {
                tasks.push(
                    measureHeight()
                        .then(() => {
                            heightOk = true
                        })
                        .catch((err) => {
                            console.warn("[HW] Height attempt failed, will retry:", err.message)
                        })
                )
            }

            await Promise.allSettled(tasks)
            console.log(`[HW] Loop result — W:${weightOk} H:${heightOk}`)
        }

        // Both measurements succeeded
        console.log("[HW] ========== H+W both measured successfully ==========")
        setDisplayValues({
            height: resultsRef.current.height?.value ?? null,
            weight: resultsRef.current.weight?.value ?? null
        })
        setIsComplete(true)
    }

    // ── Handlers ───────────────────────────────────────────────────────────
    /**
     * Called when the user clicks "Next" on the HeightWeightComplete screen.
     * Passes the measured values up to the parent via onComplete.
     */
    const handleNextClick = () => {
        console.log("[HW] Next clicked — calling onComplete with results:", resultsRef.current)
        onComplete?.({
            height: resultsRef.current.height,
            weight: resultsRef.current.weight
        })
    }

    // ── Effects ────────────────────────────────────────────────────────────
    useEffect(() => {
        runMeasurement()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Render ─────────────────────────────────────────────────────────────
    // Nothing is shown while measuring — only render once both values are ready
    if (!isComplete) return null

    return (
        <HeightWeightComplete
            heightValue={displayValues.height}
            weightValue={displayValues.weight}
            onNextClick={handleNextClick}
            isAudioPlaying={false}
        />
    )
}
