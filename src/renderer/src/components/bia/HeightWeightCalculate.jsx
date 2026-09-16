import { useEffect, useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "react-i18next"
import { setHeight, setWeight } from "../../features/common/commonSlice"
import { PORT_PATHS } from "../../utils/portConfig"
import { BIAComponent } from "./BIAComponents"
import bmiWH_male from "../../assets/bia/bia-hwmeasuring_male.mp4"
import bmiWH_female from "../../assets/bia/bia-hwmeasuring_female.mp4"

/**
 * HeightWeightCalculate
 *
 * Self-contained component that measures height and weight, rendering
 * the BIAComponent UI (avatar video, measuring instructions, scanning animations)
 * while measuring, and showing the final completed values with the Next button.
 *
 * Props:
 *   onComplete({ height, weight }) — called when user clicks "Next"
 *                                    after both measurements succeed.
 */
export default function HeightWeightCalculate({ onComplete }) {
    const { t } = useTranslation()
    const dispatch = useDispatch()
    const storeUser = useSelector((state) => state.common.user)

    // ── State ──────────────────────────────────────────────────────────────
    const [screenType, setScreenType] = useState("wh") // "wh" during measurement, "whcomplete" when finished
    const [isComplete, setIsComplete] = useState(false)
    const [displayValues, setDisplayValues] = useState({ height: null, weight: null })

    // ── Screen Config ──────────────────────────────────────────────────────
    const screenConfig = {
        leg50: {
            title: t("measurement.basic_body_scan"),
            description: t("measurement.let_measure"),
            video: {
                female: bmiWH_female,
                male: bmiWH_male
            }
        },
        wh: {
            title: t("measurement.basic_body_scan"),
            description: t("measurement.weight_height_measurement"),
            video: {
                female: bmiWH_female,
                male: bmiWH_male
            }
        },
        whcomplete: {
            title: t("measurement.scan_done"),
            description: t("measurement.weight_height_completed"),
            video: {
                female: bmiWH_female,
                male: bmiWH_male
            }
        }
    }

    // ── Refs ───────────────────────────────────────────────────────────────
    /** Raw measurement results — passed to onComplete */
    const resultsRef = useRef({ weight: null, height: null })
    /** Guard so the measurement loop only starts once */
    const isRunningRef = useRef(false)

    // ── Constants ──────────────────────────────────────────────────────────
    const HEIGHT_SENSOR_TIMEOUT_MS = 10000

    // ── Utilities ──────────────────────────────────────────────────────────
    const withTimeout = (promise, timeoutMs, errorMessage) =>
        Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
            )
        ])

    // ── Measurement helpers ────────────────────────────────────────────────
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
            console.warn("[HW] Height error/timeout — disconnecting port before retry:", err.message)
            await window.api.disconnectHeightPort().catch(() => { })
            throw err
        }
    }

    // ── Main measurement loop ──────────────────────────────────────────────
    const runMeasurement = async () => {
        if (isRunningRef.current) return
        isRunningRef.current = true

        console.log("[HW] ========== START Height + Weight measurement ==========")

        try {
            console.log("[HW] Connecting to BIA/weight port:", PORT_PATHS.BIA)
            await window.api.connectBiaPort(PORT_PATHS.BIA)
        } catch (err) {
            console.warn("[HW] Error connecting to BIA port:", err.message)
        }

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
        const finalHeight = resultsRef.current.height?.value ?? null
        const finalWeight = resultsRef.current.weight?.value ?? null

        setDisplayValues({
            height: finalHeight,
            weight: finalWeight
        })
        setScreenType("whcomplete")
        setIsComplete(true)
    }

    // ── Handlers ───────────────────────────────────────────────────────────
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

        return () => {
            console.log("[HW] Cleanup — disconnecting height & BIA ports")
            window.api.disconnectHeightPort().catch(() => { })
            window.api.disconnectBiaPort().catch(() => { })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <BIAComponent
            screenConfig={screenConfig}
            screenType={screenType}
            isComplete={isComplete}
            heightValue={displayValues.height}
            weightValue={displayValues.weight}
            onNextClick={handleNextClick}
            user={storeUser}
        />
    )
}
