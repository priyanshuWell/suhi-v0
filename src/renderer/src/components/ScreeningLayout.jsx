import { Outlet } from "react-router"
import ProgressStage from "./ProgessStage"

/**
 * Wraps all screening routes with the top progress bar.
 * ProgressStage now reads completedStages + screeningOrder from Redux directly,
 * so no route-to-step mapping is needed here anymore.
 */
export default function ScreeningLayout() {
    return (
        <>
            <ProgressStage />
            <Outlet />
        </>
    )
}
