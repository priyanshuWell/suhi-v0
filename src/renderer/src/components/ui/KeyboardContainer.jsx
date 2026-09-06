import React, { useState } from "react"

/* ─────────────── theme ─────────────── */
const CYAN = "#46a8cb"
const GREY = "#6b7280"
const KEY_BG = "#1e1e1e"
const MOD_BG = "#111"
const GLOW = "0 2px 6px rgba(68,171,190,0.25)"
const GLOW_ACT = "0 0 14px 2px rgba(0,230,255,0.35), 0 2px 6px rgba(68,171,190,0.4)"

/* ─────────────── key layout data ─────────────── */
// Each entry: [normal, shifted]
const ROW0 = [
    ["`", "~"],
    ["1", "!"],
    ["2", "@"],
    ["3", "#"],
    ["4", "$"],
    ["5", "%"],
    ["6", "^"],
    ["7", "&"],
    ["8", "*"],
    ["9", "("],
    ["0", ")"],
    ["-", "_"],
    ["=", "+"]
]
const ROW1 = [
    ["q", "Q"],
    ["w", "W"],
    ["e", "E"],
    ["r", "R"],
    ["t", "T"],
    ["y", "Y"],
    ["u", "U"],
    ["i", "I"],
    ["o", "O"],
    ["p", "P"],
    ["[", "{"],
    ["]", "}"],
    ["\\", "|"]
]
const ROW2 = [
    ["a", "A"],
    ["s", "S"],
    ["d", "D"],
    ["f", "F"],
    ["g", "G"],
    ["h", "H"],
    ["j", "J"],
    ["k", "K"],
    ["l", "L"],
    [";", ":"],
    ["'", '"']
]
const ROW3 = [
    ["z", "Z"],
    ["x", "X"],
    ["c", "C"],
    ["v", "V"],
    ["b", "B"],
    ["n", "N"],
    ["m", "M"],
    [",", "<"],
    [".", ">"],
    ["/", "?"]
]

/* ─────────────── icons ─────────────── */
const BackspaceIcon = () => (
    <svg width="24" height="18" viewBox="0 0 36 26" fill="none">
        <path
            d="M11 2h20a2 2 0 012 2v18a2 2 0 01-2 2H11L1 13 11 2z"
            stroke={CYAN}
            strokeWidth="1.8"
            fill="none"
            strokeLinejoin="round"
        />
        <path d="M17 9l8 8M25 9l-8 8" stroke={CYAN} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
)
const EnterIcon = () => (
    <svg width="22" height="16" viewBox="0 0 28 20" fill="none">
        <path
            d="M22 3v8a3 3 0 01-3 3H5"
            stroke={CYAN}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M9 10l-4 4 4 4"
            stroke={CYAN}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
)
const ShiftIcon = ({ active }) => (
    <svg
        width="18"
        height="18"
        viewBox="0 0 22 22"
        fill="none"
        style={{ opacity: active ? 1 : 0.7 }}
    >
        <path
            d="M11 2L2 13h5v7h8v-7h5L11 2z"
            stroke={CYAN}
            strokeWidth="1.8"
            fill={active ? "rgba(70,168,203,0.18)" : "none"}
            strokeLinejoin="round"
        />
    </svg>
)
const CapsIcon = ({ active }) => (
    <svg
        width="18"
        height="18"
        viewBox="0 0 22 22"
        fill="none"
        style={{ opacity: active ? 1 : 0.7 }}
    >
        <path
            d="M11 2L2 11h5v2h8v-2h5L11 2z"
            stroke={CYAN}
            strokeWidth="1.8"
            fill={active ? "rgba(70,168,203,0.18)" : "none"}
            strokeLinejoin="round"
        />
        <rect
            x="6"
            y="15"
            width="10"
            height="3"
            rx="1"
            stroke={CYAN}
            strokeWidth="1.5"
            fill={active ? "rgba(70,168,203,0.18)" : "none"}
        />
    </svg>
)
const CloseIcon = () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <path d="M15 5L5 15M5 5l10 10" stroke={CYAN} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
)

/* ─────────────── base Key button ─────────────── */
function Key({ id, active, onPress, onRelease, children, style = {}, title }) {
    const isDown = active === id
    return (
        <button
            title={title}
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 1,
                borderRadius: 8,
                border: isDown
                    ? "1px solid rgba(70,168,203,0.4)"
                    : "1px solid rgba(255,255,255,0.04)",
                outline: "none",
                cursor: "pointer",
                background: isDown ? "#2a2a2a" : KEY_BG,
                boxShadow: isDown ? GLOW_ACT : GLOW,
                transform: isDown ? "scale(0.93) translateY(1px)" : "scale(1)",
                transition: "all 0.07s ease",
                WebkitTapHighlightColor: "transparent",
                padding: 0,
                minWidth: 0,
                ...style
            }}
            onPointerDown={() => onPress(id)}
            onPointerUp={onRelease}
            onPointerLeave={onRelease}
        >
            {children}
        </button>
    )
}

/* ─────────────── character Key (normal + shifted label) ─────────────── */
function CharKey({ pair, active, onPress, onRelease, shifted, height = 52 }) {
    const [normal, shift] = pair
    const display = shifted ? shift : normal
    const id = `k-${normal}`
    return (
        <Key
            id={id}
            active={active}
            onPress={(i) => {
                onPress(i)
            }}
            onRelease={onRelease}
            style={{ height, flex: 1, minWidth: 0 }}
        >
            {shifted !== undefined && (
                <span
                    style={{
                        color: "#4a5568",
                        fontSize: 10,
                        lineHeight: 1,
                        marginTop: 4,
                        alignSelf: "flex-start",
                        paddingLeft: 6
                    }}
                >
                    {shift}
                </span>
            )}
            <span
                style={{
                    color: CYAN,
                    fontSize: 18,
                    fontWeight: 400,
                    lineHeight: 1,
                    marginBottom: 4
                }}
            >
                {display}
            </span>
        </Key>
    )
}

/* ═══════════════ FULL KEYBOARD ═══════════════ */
function FullKeyboard({ onKeyPress, onBackspace, onSubmit, onClose }) {
    const [active, setActive] = useState(null)
    const [caps, setCaps] = useState(false)
    const [shift, setShift] = useState(false)

    const press = (id) => setActive(id)
    const release = () => setActive(null)

    // effective uppercase = caps XOR shift
    const upper = caps !== shift

    const emit = (pair) => {
        const ch = upper ? pair[1] : pair[0]
        onKeyPress(ch)
        if (shift) setShift(false) // one-shot shift
    }

    const h = 52 // row height

    const row = (pairs, extra = {}) =>
        pairs.map((pair) => (
            <Key
                key={pair[0]}
                id={`k-${pair[0]}`}
                active={active}
                onPress={(id) => {
                    press(id)
                    emit(pair)
                }}
                onRelease={release}
                style={{ height: h, flex: 1, minWidth: 0, ...extra }}
            >
                <span
                    style={{
                        color: "#4a5568",
                        fontSize: 9.5,
                        lineHeight: 1,
                        marginTop: 3,
                        alignSelf: "flex-start",
                        paddingLeft: 5
                    }}
                >
                    {pair[1]}
                </span>
                <span
                    style={{
                        color: CYAN,
                        fontSize: 17,
                        fontWeight: 400,
                        lineHeight: 1,
                        marginBottom: 3
                    }}
                >
                    {upper ? pair[1] : pair[0]}
                </span>
            </Key>
        ))

    const modStyle = {
        background: MOD_BG,
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "none"
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {/* ── Row 0: number row ── */}
            <div style={{ display: "flex", gap: 5 }}>
                {row(ROW0)}
                {/* Backspace */}
                <Key
                    id="bksp"
                    active={active}
                    onPress={(id) => {
                        press(id)
                        onBackspace()
                    }}
                    onRelease={release}
                    style={{ height: h, flex: 2, ...modStyle }}
                >
                    <BackspaceIcon />
                </Key>
            </div>

            {/* ── Row 1: QWERTY ── */}
            <div style={{ display: "flex", gap: 5 }}>
                {/* Tab */}
                <Key
                    id="tab"
                    active={active}
                    onPress={(id) => {
                        press(id)
                        onKeyPress("\t")
                    }}
                    onRelease={release}
                    style={{ height: h, flex: 1.5, ...modStyle }}
                >
                    <span style={{ color: GREY, fontSize: 12 }}>Tab</span>
                </Key>
                {row(ROW1)}
            </div>

            {/* ── Row 2: ASDF ── */}
            <div style={{ display: "flex", gap: 5 }}>
                {/* Caps Lock */}
                <Key
                    id="caps"
                    active={active}
                    onPress={() => {
                        press("caps")
                        setCaps((c) => !c)
                    }}
                    onRelease={release}
                    style={{
                        height: h,
                        flex: 1.8,
                        background: caps ? "rgba(70,168,203,0.1)" : MOD_BG,
                        border: caps
                            ? "1px solid rgba(70,168,203,0.3)"
                            : "1px solid rgba(255,255,255,0.06)",
                        boxShadow: caps ? "0 0 8px rgba(70,168,203,0.25)" : "none"
                    }}
                >
                    <CapsIcon active={caps} />
                    <span style={{ color: caps ? CYAN : GREY, fontSize: 9, marginTop: 1 }}>
                        CAPS
                    </span>
                </Key>
                {row(ROW2)}
                {/* Enter */}
                <Key
                    id="enter"
                    active={active}
                    onPress={(id) => {
                        press(id)
                        onSubmit()
                    }}
                    onRelease={release}
                    style={{ height: h, flex: 2.2, ...modStyle }}
                >
                    <EnterIcon />
                    <span style={{ color: GREY, fontSize: 9, marginTop: 1 }}>Enter</span>
                </Key>
            </div>

            {/* ── Row 3: ZXCV ── */}
            <div style={{ display: "flex", gap: 5 }}>
                {/* Left Shift */}
                <Key
                    id="shiftL"
                    active={active}
                    onPress={() => {
                        press("shiftL")
                        setShift((s) => !s)
                    }}
                    onRelease={release}
                    style={{
                        height: h,
                        flex: 2.4,
                        background: shift ? "rgba(70,168,203,0.1)" : MOD_BG,
                        border: shift
                            ? "1px solid rgba(70,168,203,0.3)"
                            : "1px solid rgba(255,255,255,0.06)",
                        boxShadow: shift ? "0 0 8px rgba(70,168,203,0.25)" : "none"
                    }}
                >
                    <ShiftIcon active={shift} />
                    <span style={{ color: shift ? CYAN : GREY, fontSize: 9, marginTop: 1 }}>
                        Shift
                    </span>
                </Key>
                {row(ROW3)}
                {/* Right Shift */}
                <Key
                    id="shiftR"
                    active={active}
                    onPress={() => {
                        press("shiftR")
                        setShift((s) => !s)
                    }}
                    onRelease={release}
                    style={{
                        height: h,
                        flex: 2.8,
                        background: shift ? "rgba(70,168,203,0.1)" : MOD_BG,
                        border: shift
                            ? "1px solid rgba(70,168,203,0.3)"
                            : "1px solid rgba(255,255,255,0.06)",
                        boxShadow: shift ? "0 0 8px rgba(70,168,203,0.25)" : "none"
                    }}
                >
                    <ShiftIcon active={shift} />
                    <span style={{ color: shift ? CYAN : GREY, fontSize: 9, marginTop: 1 }}>
                        Shift
                    </span>
                </Key>
            </div>

            {/* ── Row 4: bottom row ── */}
            <div style={{ display: "flex", gap: 5 }}>
                {/* Ctrl */}
                <Key
                    id="ctrl"
                    active={active}
                    onPress={press}
                    onRelease={release}
                    style={{ height: h, flex: 1.2, ...modStyle }}
                >
                    <span style={{ color: GREY, fontSize: 11 }}>Ctrl</span>
                </Key>
                {/* Alt */}
                <Key
                    id="altL"
                    active={active}
                    onPress={press}
                    onRelease={release}
                    style={{ height: h, flex: 1, ...modStyle }}
                >
                    <span style={{ color: GREY, fontSize: 11 }}>Alt</span>
                </Key>
                {/* Space */}
                <Key
                    id="space"
                    active={active}
                    onPress={(id) => {
                        press(id)
                        onKeyPress(" ")
                    }}
                    onRelease={release}
                    style={{ height: h, flex: 6 }}
                >
                    <div />
                </Key>
                {/* Alt Gr */}
                <Key
                    id="altR"
                    active={active}
                    onPress={press}
                    onRelease={release}
                    style={{ height: h, flex: 1, ...modStyle }}
                >
                    <span style={{ color: GREY, fontSize: 10 }}>AltGr</span>
                </Key>
                {/* Ctrl */}
                <Key
                    id="ctrlR"
                    active={active}
                    onPress={press}
                    onRelease={release}
                    style={{ height: h, flex: 1.2, ...modStyle }}
                >
                    <span style={{ color: GREY, fontSize: 11 }}>Ctrl</span>
                </Key>
            </div>
        </div>
    )
}

/* ═══════════════ KEYBOARD CONTAINER ═══════════════ */
export default function KeyboardContainer({ onKeyPress, onBackspace, onSubmit, onClose }) {
    return (
        <div
            onTouchStart={(e) => e.preventDefault()}
            style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 50,
                background: "linear-gradient(180deg, #0d0d0d 0%, #000 100%)",
                borderTop: "1px solid #1c1c1c",
                padding: "6px 10px 14px",
                boxSizing: "border-box",
                fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif",
                animation: "slideUp 0.22s ease-out",
                touchAction: "none",
                userSelect: "none"
            }}
        >
            <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

            {/* drag handle + close */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    marginBottom: 5
                }}
            >
                <div style={{ width: 36, height: 3, borderRadius: 2, background: "#2a2a2a" }} />
                <button
                    onClick={onClose}
                    style={{
                        position: "absolute",
                        right: 2,
                        top: -2,
                        background: "none",
                        border: "none",
                        outline: "none",
                        cursor: "pointer",
                        padding: 4,
                        WebkitTapHighlightColor: "transparent"
                    }}
                >
                    <CloseIcon />
                </button>
            </div>

            <FullKeyboard
                onKeyPress={onKeyPress}
                onBackspace={onBackspace}
                onSubmit={onSubmit}
                onClose={onClose}
            />
        </div>
    )
}
