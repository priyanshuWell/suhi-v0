
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import axios from 'axios'
import Result from './Result'
import BIAResult from './BIAResult'
import { API_BASE_URL } from '../../utils/config'
export const hasValue = (obj) =>
    !!obj && Object.values(obj).some((v) => v !== null && v !== undefined && v !== '')

export const hasAnyVitals = (d) =>
    hasValue(d?.heart_rate) ||
    hasValue(d?.blood_pressure) ||
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
                    screening_session_id: sessionId,
                })
                if (res?.data?.success) {
                    setRawReport(res.data)
                    setShowFullResult(hasAnyVitals(res.data.data))
                } else {
                    setError(true)
                }
            } catch (err) {
                console.error('[BiaReportRouter] Report fetch failed:', err)
                setError(true)
            } finally {
                setLoading(false)
            }
        }
        const timer = setTimeout(fetchReport, 0)
        return () => clearTimeout(timer)
    }, [])

    if (loading) return null // or a spinner

    return showFullResult
        ? <Result apiReportRaw={rawReport} />
        : <BIAResult apiReportRaw={rawReport} reportError={error} />
}

export default BiaReportRouter