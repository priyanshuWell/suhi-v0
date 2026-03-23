import React, { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import bg1 from "../../assets/lightbg.png";
import BlackGradientButton from "../ui/BlackGradientButton";
import CARD_1 from '../../assets/color_blindness/Card_10.png'
import OptionButton from "./OptionButton";
import { CircularTimer } from "./CircularTimer";
// Figma asset URLs (valid 7 days from generation)
const imgBackground =
    "https://www.figma.com/api/mcp/asset/250f15ee-dcc6-44de-9aef-eaa0852ec6e9";
const imgTimerRing =
    "https://www.figma.com/api/mcp/asset/a5151c52-d7c0-4075-910c-740998e92cab";
const imgTimerProgress =
    "https://www.figma.com/api/mcp/asset/4b7dde56-bea7-4bdb-8281-8038d2311081";

// ─── Liquid Glass Button ──────────────────────────────────────────────────────
// Matches Figma's "Liquid Glass Button - Dark":
//   bg #e6e6e6 @ ~10% opacity layered with blur lenses, white border, blue glow
const LiquidGlassButton = ({ label, onClick, wide = false }) => (
    <button
        onClick={onClick}
        className="relative overflow-hidden border border-white rounded-3xl cursor-pointer flex items-center justify-center"
        style={{
            width: wide ? "clamp(280px, 66vw, 639px)" : "clamp(130px, 32vw, 639px)",
            height: "clamp(56px, 9vw, 145px)",
            background: "rgba(230,230,230,0.13)",
            boxShadow: "0px 3.6px 28.6px 0px #9ad9ff",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
        }}
    >
        {/* Layered lens blur overlays */}
        <div className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{ filter: "blur(2.86px)" }}>
            {[
                { blur: 35.77, inset: "0px" },
                { blur: 17.89, inset: "2px" },
                { blur: 8.94, inset: "6px" },
                { blur: 3.58, inset: "13px" },
                { blur: 0.72, inset: "27px" },
            ].map(({ blur, inset }, i) => (
                <div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        inset,
                        backdropFilter: `blur(${blur}px)`,
                        WebkitBackdropFilter: `blur(${blur}px)`,
                        background: "rgba(255,255,255,0.01)",
                    }}
                />
            ))}
        </div>

        <span
            className="relative font-mono text-white whitespace-nowrap tracking-tight"
            style={{ fontSize: "clamp(1rem, 3.8vw, 3.75rem)", letterSpacing: "-0.06em" }}
        >
            {label}
        </span>
    </button>
);


// ─── Progress Bar ─────────────────────────────────────────────────────────────
const ProgressBar = ({ current, total }) => {
    const pct = Math.min((current / total) * 100, 100);
    return (
        <div className="flex flex-col items-start gap-1 w-full">
            <span
                className="text-white text-center"
                style={{ fontFamily: "'Noto Sans', sans-serif", fontSize: "clamp(0.7rem, 2vw, 2rem)" }}
            >
                Image {current} of {total}
            </span>
            <div
                className="w-full overflow-hidden"
                style={{
                    height: "clamp(6px, 1.3vw, 21px)",
                    background: "#e0e0e0",
                    borderRadius: "169.6px",
                }}
            >
                <div
                    style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: "#0d4aca",
                        borderRadius: "169.6px",
                        transition: "width 0.4s ease",
                    }}
                />
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
/**
 * ColorBlindnessTestScreen
 *
 * Props:
 *   plateImage   – src for the current ishihara plate
 *   options      – array of { id, label } answer choices (2–5 items; last should be "Cannot read plate")
 *   currentPlate – 1-based index of the current plate (e.g. 13)
 *   totalPlates  – total number of plates (e.g. 14)
 *   timerSeconds – countdown start value (default 10)
 *   onAnswer     – (optionId: string) => void  called when user picks an option or timer expires
 */
export const ColorBlindQuiz = ({
    plateImage,
    options = [
        { id: "95", label: "95" },
        { id: "twoLines", label: "Two Lines" },
        { id: "purpleLine", label: "Purple Line" },
        { id: "redLine", label: "Red Line" },
        { id: "cannotRead", label: "Cannot read plate" },
    ],
    currentPlate = 13,
    totalPlates = 14,
    timerSeconds: initialTimer = 5,
    onAnswer,
}) => {
    const { t } = useTranslation();
    const [timeLeft, setTimeLeft] = useState(initialTimer);
    const timerRef = useRef(null);

    // Reset timer whenever the plate changes
    useEffect(() => {
        setTimeLeft(initialTimer);
    }, [currentPlate, initialTimer]);

    // Tick
    useEffect(() => {
        if (timeLeft <= 0) {
            onAnswer?.("timeout");
            return;
        }
        timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
        return () => clearTimeout(timerRef.current);
    }, [timeLeft, onAnswer]);

    const handleAnswer = useCallback(
        (id) => {
            clearTimeout(timerRef.current);
            onAnswer?.(id);
        },
        [onAnswer]
    );

    // Split options: last one (Cannot read plate) is centred alone; rest go in 2-col grid
    const gridOptions = options.slice(0, -1);
    const lastOption = options[options.length - 1];

    return (
        <div className="flex flex-col gap-36 inset-0 w-screen h-screen overflow-hidden bg-black p-10">
            {/* ── Background layers ── */}
            <div
                className="absolute inset-0 bg-center bg-cover z-0 opacity-50"
                style={{ backgroundImage: `url(${bg1})` }}
            />

            {/* ══════════════ CONTENT ══════════════ */}
            <div className="absolute inset-0 z-10 flex flex-col items-center  overflow-y-auto py-4 px-4 gap-18">

                {/* ── Progress bar + label ── */}
                <div className="w-full max-w-[665px] mt-10">
                    <ProgressBar current={currentPlate} total={totalPlates} />
                </div>

                {/* ── Question text ── */}
                <p
                    className="text-white text-center font-mono w-full max-w-[1149px]"
                    style={{ fontSize: "clamp(1rem, 4vw, 4rem)" }}
                >
                    {t(
                        "colorBlindness.question",
                        "What number/shape do you see in the image?"
                    )}
                </p>

                {/* ── Timer ── */}
                <CircularTimer timerSeconds={timeLeft} onExpire={() => handleAnswer("timeout")} currentPlate={currentPlate} />

                {/* ── Plate card (white rounded box) ── */}
                <div className="bg-white rounded-3xl p-6 w-[70%] max-w-[1018px] flex items-center justify-center shadow-2xl">
                    <img
                        src={CARD_1}
                        alt={t("colorBlindness.plateAlt", "Example color blindness plate")}
                        className="w-full h-auto object-cover rounded-2xl"
                    />
                </div>

                {/* ── Answer buttons (2-col grid + centred last button) ── */}
                <div className="flex flex-col items-center gap-5 w-full max-w-[1510px]">
                    {/* Paired options */}
                    <div className="flex flex-wrap justify-center gap-6">
                        {gridOptions.map((opt) => (
                            <OptionButton
                                key={opt.id}
                                label={opt.label}
                                onClick={() => handleAnswer(opt.id)}
                            />
                        ))}
                    </div>

                    {/* "Cannot read plate" – centred, wider */}
                    {lastOption && (
                        <OptionButton
                            key={lastOption.id}
                            label={lastOption.label}
                            onClick={() => handleAnswer(lastOption.id)}
                            wide
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ColorBlindQuiz;