import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import axios from "axios"
import Result from "./Result"
import BIAResult from "./BIAResult"
import { API_BASE_URL } from "../../utils/config"
import bgTexture from "../../assets/lightbg.png"
export const hasValue = (obj) =>
    !!obj && Object.values(obj).some((v) => v !== null && v !== undefined && v !== "")

export const hasAnyVitals = (d) =>
    hasValue(d?.heart_rate) ||
    // hasValue(d?.blood_pressure) ||
    hasValue(d?.facial_emotion) ||
    hasValue(d?.breathing_rate)
const BiaReportRouter = () => {
    const storeUser = useSelector((s) => s.common.user)
    const screening = useSelector((s) => s.common.screening)

    const [rawReport, setRawReport] = useState(null)
    const [showFullResult, setShowFullResult] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const sessionId = screening?.sessionId
                const userId = storeUser?.data?.user_id
                const res = await axios.post(`${API_BASE_URL}/report/`, {
                    user_id: userId,
                    session_id: sessionId,
                    screening_session_id: sessionId
                })
                console.log("[BiaReportRouter] report api result", res.data)
                if (res?.data?.success) {
                    setRawReport(res.data)
                    setShowFullResult(hasAnyVitals(res.data.data))
                } else {
                    setError(true)
                }
            } catch (err) {
                console.error("[BiaReportRouter] Report fetch failed:", err)
                setError(true)
            } finally {
                setLoading(false)
            }
        }
        const timer = setTimeout(fetchReport, 0)
        return () => clearTimeout(timer)
    }, [])

    if (loading)
        return (
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    background: "#000",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "24px",
                    overflow: "hidden"
                }}
            >
                {/* Same textured background as Result.jsx */}
                <img
                    src={bgTexture}
                    alt=""
                    style={{
                        position: "absolute",
                        top: "-9px",
                        left: "-5px",
                        width: "109%",
                        opacity: 0.5,
                        objectFit: "cover",
                        pointerEvents: "none"
                    }}
                />
                {/* Spinner + label, on top of the background */}
                <div
                    style={{
                        position: "relative",
                        zIndex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "24px"
                    }}
                >
                    <div
                        style={{
                            width: "56px",
                            height: "56px",
                            borderRadius: "50%",
                            border: "4px solid rgba(255,255,255,0.15)",
                            borderTopColor: "#29ABE2",
                            animation: "spin 0.9s linear infinite"
                        }}
                    />
                    <p
                        style={{
                            fontFamily: "'Anta', sans-serif",
                            fontSize: "28px",
                            color: "rgba(255,255,255,0.7)",
                            letterSpacing: "0.05em"
                        }}
                    >
                        Loading your results…
                    </p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )

    return showFullResult ? (
        <Result apiReportRaw={rawReport} reportError={error} />
    ) : (
        <BIAResult apiReportRaw={rawReport} reportError={error} />
    )
}

export default BiaReportRouter
