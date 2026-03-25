import React, { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import bg1 from "../../assets/lightbg.png";
import OptionButton from "./OptionButton";
import { CircularTimer } from "./CircularTimer";

import {
    colorBlindessStart,
    colorBlindessSubmit,
    colorBlindessComplete,
    getColorBlindessPlates,
} from "../../utils/api";
// ─── Dynamically import all 14 plate images ───────────────────────────────────
// Assumes files are named Card_1.png … Card_14.png in assets/color_blindness/
const PLATE_IMAGES = Array.from({ length: 14 }, (_, i) => {
    return new URL(`../../assets/color_blindness/Card_${i + 1}.png`, import.meta.url).href;
});

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
 * ColorBlindQuiz
 *
 * Props:
 *   userId       – user ID passed to /start
 *   kioskId      – kiosk ID passed to /start
 *   timerSeconds – countdown per plate (default 5)
 *   onComplete   – (completeApiResponse) => void  called when all 14 plates done
 *   onError      – (errorMessage) => void  called on any API error
 */
export const ColorBlindQuiz = ({
    userId,
    kioskId,
    timerSeconds: initialTimer = 5,
    onComplete,
    onError,
}) => {
    const { t } = useTranslation();

    // ── Session & plates state ──────────────────────────────────────────────
    const [sessionId, setSessionId] = useState(null);
    const [plates, setPlates] = useState([]);   // array from /plates API
    const [currentIndex, setCurrentIndex] = useState(0);   // 0-based
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── Timer state ─────────────────────────────────────────────────────────
    const [timeLeft, setTimeLeft] = useState(initialTimer);
    const timerRef = useRef(null);
    const startTimeMs = useRef(null); // records when current plate was shown

    // ── Initialise: fetch plates + start session ────────────────────────────
    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch plate definitions (options per plate, plate IDs, etc.)
                const platesRes = await getColorBlindessPlates();
                if (!platesRes.success) throw new Error("Failed to load plates");

                // Normalise: API may return { plates: [...] } or array directly
                const platesArray = Array.isArray(platesRes.plates)
                    ? platesRes.plates
                    : Array.isArray(platesRes.data)
                        ? platesRes.data
                        : [];

                if (platesArray.length === 0) throw new Error("No plates returned from API");
                setPlates(platesArray);

                // 2. Start session — returns session_id
                const startRes = await colorBlindessStart(userId, kioskId);
                if (!startRes.success) throw new Error("Failed to start session");
                setSessionId(startRes.session_id);
            } catch (err) {
                onError?.(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, []); // run once on mount

    // ── Reset timer + record start time whenever plate changes ─────────────
    useEffect(() => {
        if (isLoading || plates.length === 0) return;
        setTimeLeft(initialTimer);
        startTimeMs.current = Date.now();
    }, [currentIndex, isLoading, initialTimer, plates.length]);

    // ── Countdown tick ──────────────────────────────────────────────────────
    useEffect(() => {
        if (isLoading || !sessionId) return;
        if (timeLeft <= 0) {
            handleAnswer(null, true); // null answer + no_response = 1
            return;
        }
        timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
        return () => clearTimeout(timerRef.current);
    }, [timeLeft, isLoading, sessionId]);

    // ── Handle an answer (or timeout) ──────────────────────────────────────
    const handleAnswer = useCallback(
        async (selectedAnswer, isTimeout = false) => {
            if (isSubmitting || !sessionId) return;
            clearTimeout(timerRef.current);
            setIsSubmitting(true);

            const currentPlate = plates[currentIndex];
            const responseTimeMs = Date.now() - (startTimeMs.current ?? Date.now());

            // Full payload matching the API contract
            const submitPayload = {
                session_id: sessionId,
                plate_id: currentPlate?.id ?? currentIndex + 1,
                selected_answer: isTimeout ? null : selectedAnswer,
                no_response: isTimeout ? 1 : 0,
                response_time_ms: responseTimeMs,
            };

            try {
                const submitRes = await colorBlindessSubmit(submitPayload);
                if (!submitRes.success) throw new Error("Failed to submit answer");

                const nextIndex = currentIndex + 1;

                if (nextIndex >= plates.length) {
                    // All plates answered → call /complete
                    const completeRes = await colorBlindessComplete(sessionId);
                    if (!completeRes.success) throw new Error("Failed to complete session");
                    onComplete?.(completeRes);
                } else {
                    // Move to next plate
                    setCurrentIndex(nextIndex);
                }
            } catch (err) {
                onError?.(err.message);
            } finally {
                setIsSubmitting(false);
            }
        },
        [isSubmitting, sessionId, plates, currentIndex, onComplete, onError]
    );

    // ── Derived values for current plate ───────────────────────────────────
    const currentPlateData = plates[currentIndex];

    // Prefer options from API; fall back to a sensible default shape
    const options = currentPlateData?.options ?? [
        { id: "option_a", label: "A" },
        { id: "option_b", label: "B" },
        { id: "cannot_read", label: "Cannot read plate" },
    ];

    const gridOptions = options.slice(0, -1);     // all but last
    const lastOption = options[options.length - 1]; // "Cannot read plate"

    const plateImage = PLATE_IMAGES[currentIndex];

    // ── Loading screen ──────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
                <p className="text-white text-2xl font-mono animate-pulse">
                    {t("colorBlindness.loading", "Loading test…")}
                </p>
            </div>
        );
    }

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-36 inset-0 w-screen h-screen overflow-hidden bg-black p-10">
            {/* Background */}
            <div
                className="absolute inset-0 bg-center bg-cover z-0 opacity-50"
                style={{ backgroundImage: `url(${bg1})` }}
            />

            <div className="absolute inset-0 z-10 flex flex-col items-center overflow-y-auto py-4 px-4 gap-18">

                {/* Progress bar */}
                <div className="w-full max-w-[665px] mt-10">
                    <ProgressBar current={currentIndex + 1} total={plates.length} />
                </div>

                {/* Question */}
                <p
                    className="text-white text-center font-mono w-full max-w-[1149px]"
                    style={{ fontSize: "clamp(1rem, 4vw, 4rem)" }}
                >
                    {t("colorBlindness.question", "What number/shape do you see in the image?")}
                </p>

                {/* Timer */}
                <CircularTimer
                    timerSeconds={timeLeft}
                    onExpire={() => handleAnswer(null, true)}
                    currentPlate={currentIndex + 1}
                />

                {/* Plate card */}
                <div className="bg-white rounded-3xl p-6 w-[70%] max-w-[1018px] flex items-center justify-center shadow-2xl">
                    <img
                        src={plateImage}
                        alt={t("colorBlindness.plateAlt", `Plate ${currentIndex + 1}`)}
                        className="w-full h-auto object-cover rounded-2xl"
                    />
                </div>

                {/* Answer buttons */}
                <div className="flex flex-col items-center gap-5 w-full max-w-[1510px]">
                    <div className="flex flex-wrap justify-center gap-6">
                        {gridOptions.map((opt) => (
                            <OptionButton
                                key={opt.id}
                                label={opt.label}
                                onClick={() => handleAnswer(opt.id)}
                                disabled={isSubmitting}
                            />
                        ))}
                    </div>

                    {lastOption && (
                        <OptionButton
                            key={lastOption.id}
                            label={lastOption.label}
                            onClick={() => handleAnswer(lastOption.id)}
                            disabled={isSubmitting}
                            wide
                        />
                    )}
                </div>

                {/* Submitting overlay – prevents double-tap */}
                {isSubmitting && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20">
                        <p className="text-white text-xl font-mono animate-pulse">
                            {t("colorBlindness.submitting", "Saving…")}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ColorBlindQuiz;