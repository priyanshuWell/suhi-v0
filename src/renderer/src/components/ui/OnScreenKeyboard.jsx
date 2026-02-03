import React, { useState } from "react";

const Key = ({ children, onClick, wide, extraWide, active }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center justify-center
      h-[95px]
      ${extraWide ? "flex-[3]" : wide ? "flex-[2]" : "flex-1"}
      rounded-[20px]
      bg-[#262626]
      text-[#46a8cb]
      text-[32px] font-semibold
      shadow-[0_6px_12px_#44abbe]
      active:scale-95 transition
      ${active ? "ring-4 ring-cyan-400" : ""}
    `}
  >
    {children}
  </button>
);

export default function OnScreenKeyboard({
  onKeyPress,
  onBackspace,
  onEnter,
  onClose,
  onSwitchToNumeric
}) {
  const [caps, setCaps] = useState(false);

  const letters1 = "qwertyuiop".split("");
  const letters2 = "asdfghjkl".split("");
  const letters3 = "zxcvbnm".split("");

  const press = (k) => onKeyPress(caps ? k.toUpperCase() : k);

  return (
    <div className="w-full bg-black p-6 pt-4 select-none">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-cyan-300 text-xl tracking-wider">Keyboard</span>
        <button
          onClick={onClose}
          className="text-red-400 text-2xl px-4 py-2 rounded-lg bg-[#111] shadow-[0_0_10px_red]"
        >
          ✕
        </button>
      </div>

      <div className="flex gap-4 mb-4">
        {letters1.map((k) => (
          <Key key={k} onClick={() => press(k)}>{caps ? k.toUpperCase() : k}</Key>
        ))}
      </div>

      <div className="flex gap-4 mb-4">
        {letters2.map((k) => (
          <Key key={k} onClick={() => press(k)}>{caps ? k.toUpperCase() : k}</Key>
        ))}
      </div>

      <div className="flex gap-4 mb-4">
        <Key wide active={caps} onClick={() => setCaps(!caps)}>Caps</Key>

        {letters3.map((k) => (
          <Key key={k} onClick={() => press(k)}>{caps ? k.toUpperCase() : k}</Key>
        ))}

        <Key wide onClick={onBackspace}>⌫</Key>
      </div>

      <div className="flex gap-4">
        <Key wide onClick={onSwitchToNumeric}>123</Key>
        <Key extraWide onClick={() => onKeyPress(" ")}>Space</Key>
        <Key wide onClick={onEnter}>Enter</Key>
      </div>
    </div>
  );
}
