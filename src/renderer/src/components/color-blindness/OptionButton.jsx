import BlackGradientButton from "../ui/BlackGradientButton";
import { useTranslation } from "react-i18next";

const getTranslatedLabel = (lbl, t) => {
    if (!lbl) return "";
    const keyMap = {
        "No number": "colorBlindness.options.no_number",
        "Line": "colorBlindness.options.line",
        "Red Line": "colorBlindness.options.red_line",
        "Two Lines": "colorBlindness.options.two_lines",
        "Purple Line": "colorBlindness.options.purple_line",
        "Red Lines": "colorBlindness.options.red_lines",
        "Three lines": "colorBlindness.options.three_lines",
        "No lines": "colorBlindness.options.no_lines"
    };
    const key = keyMap[lbl];
    return key ? t(key) : lbl;
};

export default function OptionButton({ label, onClick, wide = false, selectedAnswer, correctAnswer, showFeedback }) {
    const { t } = useTranslation();
    const isSelected = selectedAnswer === label;

    // Highlight red only on the button the user wrongly selected
    const showWrong =
        showFeedback &&
        isSelected &&
        selectedAnswer !== correctAnswer;

    // Always highlight the correct answer green when feedback is shown
    const showRight =
        showFeedback &&
        label === correctAnswer;

    const feedbackStyle = showWrong
        ? {
            background: "rgba(255, 0, 0, 0.35)",
            backdropFilter: "blur(10px)",
            border: "4px solid #fff",
            boxShadow: "0 0 18px rgba(251,0,0,0.25)",
        }
        : showRight
            ? {
                background: "rgba(9, 255, 0, 0.16)",
                backdropFilter: "blur(20px)",
                border: "5px solid #fff",
                boxShadow: "0 0 18px rgba(9,255,0,0.25)",
                fill: "rgba(9, 255, 0, 0.15)",
            }
            : {};
    return (
        <BlackGradientButton
            onClick={onClick}
            style={{
                ...feedbackStyle,
                width: wide ? "clamp(280px, 66vw, 639px)" : "clamp(130px, 32vw, 639px)",
                height: "clamp(56px, 9vw, 145px)",
            }}
        >
            <span
                className="font-anta text-white whitespace-nowrap tracking-tight rounded-2xl"
                style={{
                    fontSize: "clamp(1rem, 3.8vw, 3.75rem)",
                    // letterSpacing: "-0.06em",
                }}
            >
                {getTranslatedLabel(label, t)}
            </span>
        </BlackGradientButton>
    )
}


