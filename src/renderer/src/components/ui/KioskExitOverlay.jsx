import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import KeyboardContainer from "./KeyboardContainer"

const MAX_PASSWORD_LENGTH = 128
const CORNER_TAPS_REQUIRED = 8
const CORNER_TAP_WINDOW_MS = 4000

// Mounted once at the app root so the hidden hotkey (main process) can pop
// this regardless of whatever route is currently showing. Accepts input
// from either a physical keyboard (the field below is a real, focused
// <input>) or the in-app on-screen keyboard other screens already use —
// both write into the same `password` state.
export default function KioskExitOverlay() {
    const { t } = useTranslation()
    const [visible, setVisible] = useState(false)
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const inputRef = useRef(null)
    const tapTimesRef = useRef([])

    const openExitDialog = () => {
        setPassword("")
        setError("")
        setSubmitting(false)
        setVisible(true)
    }

    useEffect(() => {
        const unsubscribe = window.api?.kiosk?.onRequestExit?.(() => {
            openExitDialog()
        })
        return () => unsubscribe?.()
    }, [])

    const handleSecretCornerTap = async () => {
        const now = Date.now()
        tapTimesRef.current = tapTimesRef.current.filter((time) => now - time < CORNER_TAP_WINDOW_MS)
        tapTimesRef.current.push(now)
        if (tapTimesRef.current.length < CORNER_TAPS_REQUIRED) return

        tapTimesRef.current = []
        const state = await window.api?.kiosk?.getState?.()
        if (state?.active) openExitDialog()
    }

    useEffect(() => {
        if (!visible) return
        const focusTimer = setTimeout(() => inputRef.current?.focus(), 80)
        return () => clearTimeout(focusTimer)
    }, [visible])

    const appendChar = (ch) => {
        setError("")
        setPassword((prev) => (prev.length < MAX_PASSWORD_LENGTH ? prev + ch : prev))
    }

    const handleBackspace = () => {
        setError("")
        setPassword((prev) => prev.slice(0, -1))
    }

    const handleSubmit = async () => {
        if (!password || submitting) return
        setSubmitting(true)
        try {
            const result = await window.api?.kiosk?.verifyAndExit?.(password)
            if (result?.success) {
                setVisible(false)
                return
            }
            setError(result?.error || "Incorrect password. Please try again.")
            setPassword("")
        } catch (err) {
            setError(err?.message || "Something went wrong. Please try again.")
            setPassword("")
        } finally {
            setSubmitting(false)
            setTimeout(() => inputRef.current?.focus(), 0)
        }
    }

    const handleCancel = async () => {
        setVisible(false)
        await window.api?.kiosk?.cancelExit?.()
    }

    const dotCount = Math.max(password.length, 1)

    return (
        <>
            {!visible && (
                <button
                    type="button"
                    aria-hidden="true"
                    tabIndex={-1}
                    onClick={handleSecretCornerTap}
                    className="fixed bottom-0 right-0 z-[80] h-16 w-16 opacity-0"
                />
            )}

            {visible && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/70" />

                    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6 select-none">
                        <form
                            onSubmit={(event) => {
                                event.preventDefault()
                                handleSubmit()
                            }}
                            className="w-[600px] max-w-full rounded-[24px] border border-white/10 bg-[#0d0d0d] px-10 py-10 shadow-[0_0_60px_rgba(70,168,203,0.25)]"
                        >
                            <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-[#46a8cb]">
                                {t("kiosk.admin_access", "Administrator access")}
                            </p>
                            <h2 className="mt-3 text-center text-2xl font-semibold text-white">
                                {t("kiosk.enter_password", "Enter password to exit kiosk mode")}
                            </h2>
                            <p className="mt-2 text-center text-sm text-gray-400">
                                {t("kiosk.desktop_desc", "This returns the device to a normal desktop for troubleshooting.")}
                            </p>

                            <input
                                ref={inputRef}
                                type="password"
                                value={password}
                                onChange={(event) => {
                                    setError("")
                                    setPassword(event.target.value.slice(0, MAX_PASSWORD_LENGTH))
                                }}
                                autoComplete="current-password"
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                className="sr-only"
                            />

                            <div className="mt-8 flex items-center justify-center gap-3">
                                {Array.from({ length: dotCount }).map((_, index) => (
                                    <span
                                        key={index}
                                        className={`h-4 w-4 rounded-full ${
                                            index < password.length ? "bg-[#46a8cb]" : "bg-white/10"
                                        }`}
                                    />
                                ))}
                            </div>

                            {error && (
                                <p className="mt-4 text-center text-sm font-medium text-red-400">{error}</p>
                            )}

                            <div className="mt-8 flex justify-center gap-4">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    disabled={submitting}
                                    className="h-14 flex-1 rounded-full border border-white/20 text-base font-semibold text-gray-300"
                                >
                                    {t("kiosk.cancel", "Cancel")}
                                </button>
                                <button
                                    type="submit"
                                    disabled={!password || submitting}
                                    className="h-14 flex-1 rounded-full bg-[#46a8cb] text-base font-semibold text-black disabled:opacity-40"
                                >
                                    {submitting ? t("kiosk.checking", "Checking…") : t("kiosk.exit_kiosk", "Exit kiosk mode")}
                                </button>
                            </div>
                        </form>
                    </div>

                    <KeyboardContainer
                        onKeyPress={appendChar}
                        onBackspace={handleBackspace}
                        onSubmit={handleSubmit}
                        onClose={handleCancel}
                    />
                </>
            )}
        </>
    )
}
