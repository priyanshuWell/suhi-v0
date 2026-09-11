import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import axios from "axios"
import Result from "./Result"
import { API_BASE_URL } from "../../utils/config"
import bgTexture from "../../assets/lightbg.png"

const BiaReportRouter = () => {
    const storeUser = useSelector((s) => s.common.user)
    const screening = useSelector((s) => s.common.screening)

    const [rawReport, setRawReport] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    const screeningOrder = screening?.screeningOrder
    const sessionId = screening?.sessionId
    const userId = storeUser?.data?.user_id

    useEffect(() => {
        const fetchReport = async () => {
            try {
                setLoading(true)
                setError(false)

                let res

                console.log(
                    "[BiaReportRouter] screeningOrder:",
                    screeningOrder
                )

                // ─────────────────────────────────────
                // SCREENING ORDER 1
                // ─────────────────────────────────────
                if (screeningOrder === 1 || screeningOrder === "1") {
                    res = await axios.post(`${API_BASE_URL}/report/`, {
                        user_id: userId,
                        session_id: sessionId,
                        screening_session_id: sessionId
                    })
                }

                // ─────────────────────────────────────
                // SCREENING ORDER 2
                // ─────────────────────────────────────
                else if (
                    screeningOrder === 2 ||
                    screeningOrder === "2"
                ) {
                    res = await axios.get(
                        `${API_BASE_URL}/report/session-2/${userId}`
                    )
                }

                // ─────────────────────────────────────
                // UNKNOWN SCREENING ORDER
                // ─────────────────────────────────────
                else {
                    console.error(
                        "[BiaReportRouter] Unknown screeningOrder:",
                        screeningOrder
                    )

                    setError(true)
                    return
                }

                console.log(
                    "[BiaReportRouter] Report response:",
                    res?.data
                )

                if (res?.data?.success) {
                    setRawReport(res.data)
                } else {
                    console.error(
                        "[BiaReportRouter] API returned success:false",
                        res?.data
                    )

                    setError(true)
                }
            } catch (err) {
                console.error(
                    "[BiaReportRouter] Report fetch failed:",
                    err
                )

                setError(true)
            } finally {
                setLoading(false)
            }
        }

        if (!userId || !screeningOrder) {
            return
        }

        fetchReport()
    }, [userId, sessionId, screeningOrder])

    if (loading) {
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

                <style>
                    {`
                        @keyframes spin {
                            to {
                                transform: rotate(360deg);
                            }
                        }
                    `}
                </style>
            </div>
        )
    }

    return (
        <Result
            apiReportRaw={rawReport}
            reportError={error}
            screeningOrder={screeningOrder}

        />
    )
}

export default BiaReportRouter