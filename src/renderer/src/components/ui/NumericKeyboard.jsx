import React, { useState } from "react"

const Key = ({ children, onClick, wide }) => (
    <button
        onClick={onClick}
        className={`
      flex items-center justify-center
      h-[130px] ${wide ? "flex-[2]" : "flex-1"}
      rounded-[13px] bg-[#262626]
      shadow-[0_4px_10px_#00e6ff]
      text-[#46a8cb] text-[64px] font-semibold
      active:scale-95 transition-transform
    `}
    >
        {children}
    </button>
)

const SmallKey = ({ children, onClick }) => (
    <button
        onClick={onClick}
        className="flex items-center justify-center h-[60px] w-[60px] rounded-[12px] bg-[#262626] shadow-[0_3px_8px_#00e6ff] text-[#46a8cb] text-[26px] font-semibold active:scale-95 transition-transform flex-shrink-0"
    >
        {children}
    </button>
)

const SPECIAL_CHARS = [
    "_",
    "!",
    "?",
    "@",
    "#",
    "$",
    "%",
    "&",
    "*",
    "(",
    ")",
    "-",
    "+",
    "=",
    "/",
    "\\",
    ":",
    ";",
    '"',
    "'"
]

export default function NumericKeyboard({ onKeyPress, onBackspace, onSubmit, onSwitchToAlpha }) {
    const [showSymbols, setShowSymbols] = useState(false)

    return (
        <div className="w-full bg-black p-4 flex flex-col gap-4">
            {showSymbols ? (
                /* ── Special Characters grid ── */
                <>
                    <div className="flex flex-wrap gap-3">
                        {SPECIAL_CHARS.map((ch) => (
                            <SmallKey key={ch} onClick={() => onKeyPress(ch)}>
                                {ch}
                            </SmallKey>
                        ))}
                    </div>
                    <div className="flex gap-5">
                        <Key onClick={() => setShowSymbols(false)}>123</Key>
                        <Key onClick={onBackspace}>⌫</Key>
                    </div>
                </>
            ) : (
                /* ── Numeric pad ── */
                <>
                    <div className="flex gap-5">
                        <Key onClick={() => onKeyPress("1")}>1</Key>
                        <Key onClick={() => onKeyPress("2")}>2</Key>
                        <Key onClick={() => onKeyPress("3")}>3</Key>
                    </div>

                    <div className="flex gap-5">
                        <Key onClick={() => onKeyPress("4")}>4</Key>
                        <Key onClick={() => onKeyPress("5")}>5</Key>
                        <Key onClick={() => onKeyPress("6")}>6</Key>
                    </div>

                    <div className="flex gap-5">
                        <Key onClick={() => onKeyPress("7")}>7</Key>
                        <Key onClick={() => onKeyPress("8")}>8</Key>
                        <Key onClick={() => onKeyPress("9")}>9</Key>
                    </div>

                    <div className="flex gap-5">
                        <Key onClick={onSwitchToAlpha}>ABC</Key>
                        <Key onClick={() => onKeyPress("0")}>0</Key>
                        <Key onClick={onBackspace}>⌫</Key>
                    </div>

                    {/* Special chars quick-access row */}
                    <div className="overflow-x-auto pb-1">
                        <div className="flex gap-3" style={{ minWidth: "max-content" }}>
                            {SPECIAL_CHARS.map((ch) => (
                                <SmallKey key={ch} onClick={() => onKeyPress(ch)}>
                                    {ch}
                                </SmallKey>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-5">
                        <Key wide onClick={onSubmit}>
                            OK
                        </Key>
                    </div>
                </>
            )}
        </div>
    )
}
