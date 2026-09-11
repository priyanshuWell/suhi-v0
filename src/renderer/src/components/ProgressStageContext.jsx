import { createContext, useContext, useState } from "react"

const ProgressStageContext = createContext({ show: true, setShow: () => {} })

/**
 * Wraps ScreeningLayout children and exposes a `setShow` setter so any
 * descendant game screen can hide/show the ProgressStage top bar.
 *
 * Default is `true` — all non-game routes remain unaffected.
 */
export function ProgressStageProvider({ children }) {
    const [show, setShow] = useState(true)
    return (
        <ProgressStageContext.Provider value={{ show, setShow }}>
            {children}
        </ProgressStageContext.Provider>
    )
}

/** Consume visibility state inside ScreeningLayout. */
export function useProgressStageVisibility() {
    return useContext(ProgressStageContext)
}

/**
 * Convenience hook for game orchestrators.
 * Returns only the `setShow` setter — games don't need to read the value.
 */
export function useSetProgressStage() {
    return useContext(ProgressStageContext).setShow
}
