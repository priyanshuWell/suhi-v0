import React, { useState } from "react";
import OnScreenKeyboard from "./OnScreenKeyboard";
import NumericKeyboard from "./NumericKeyboard";

export default function KeyboardContainer({
  onKeyPress,
  onBackspace,
  onSubmit,
  onClose
}) {
  const [mode, setMode] = useState("alpha"); // alpha | numeric

  return (
    <div className="fixed bottom-0 left-0 w-full z-50">
      {mode === "alpha" ? (
        <OnScreenKeyboard
          onKeyPress={onKeyPress}
          onBackspace={onBackspace}
          onEnter={onSubmit}
          onClose={onClose}
          onSwitchToNumeric={() => setMode("numeric")}
        />
      ) : (
        <NumericKeyboard
          onKeyPress={onKeyPress}
          onBackspace={onBackspace}
          onSubmit={onSubmit}
          onSwitchToAlpha={() => setMode("alpha")}
        />
      )}
    </div>
  );
}
