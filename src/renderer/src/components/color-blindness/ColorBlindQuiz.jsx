import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import bg1 from "../../assets/lightbg.png";
import { CircularTimer } from "./CircularTimer";
import OptionButton from "./OptionButton";
import { colorBlindessSubmit, colorBlindessComplete } from "../../utils/api";

// ─── Static plate imports ─────────────────────────────────────────────────────
import CARD_1 from "../../assets/color_blindness/Card_1.png";
import CARD_2 from "../../assets/color_blindness/Card_2.png";
import CARD_3 from "../../assets/color_blindness/Card_3.png";
import CARD_4 from "../../assets/color_blindness/Card_4.png";
import CARD_5 from "../../assets/color_blindness/Card_5.png";
import CARD_6 from "../../assets/color_blindness/Card_6.png";
import CARD_7 from "../../assets/color_blindness/Card_7.png";
import CARD_8 from "../../assets/color_blindness/Card_8.png";
import CARD_9 from "../../assets/color_blindness/Card_9.png";
import CARD_10 from "../../assets/color_blindness/Card_10.png";
import CARD_11 from "../../assets/color_blindness/Card_11.png";
import CARD_12 from "../../assets/color_blindness/Card_12.png";
import CARD_13 from "../../assets/color_blindness/Card_13.png";
import CARD_14 from "../../assets/color_blindness/Card_14.png";
import { useSelector } from "react-redux";

const PLATES = [
    {
        plate_id: 1, image: CARD_1, correctAnswer: "12",
        options: ["12", "93", "96", "89", "No number"]
    },

    {
        plate_id: 2, image: CARD_2, correctAnswer: "8",
        options: ["8", "3", "15", "23", "No number"]
    },

    {
        plate_id: 3, image: CARD_3, correctAnswer: "5",
        options: ["5", "2", "99", "69", "No number"]
    },

    {
        plate_id: 4, image: CARD_4, correctAnswer: "29",
        options: ["29", "70", "3", "83", "No number"]
    },
    {
        plate_id: 5, image: CARD_5, correctAnswer: "74",
        options: ["74", "21", "99", "12", "No number"]
    },

    {
        plate_id: 6, image: CARD_6, correctAnswer: "7",
        options: ["7", "61", "5", "93", "No number"]
    },
    {
        plate_id: 7, image: CARD_7, correctAnswer: "45",
        options: ["45", "94", "19", "27", "No number"]
    },

    {
        plate_id: 8, image: CARD_8, correctAnswer: "2",
        options: ["2", "56", "13", "69", "No number"]
    },

    {
        plate_id: 9, image: CARD_9, correctAnswer: "2",
        options: ["92", "2", "90", "73", "No number"]
    },
    {
        plate_id: 10, image: CARD_10, correctAnswer: "16",
        options: ["16", "72", "48", "21", "No number"]
    },

    {
        plate_id: 11, image: CARD_11, correctAnswer: "Line",
        options: ["Line", "70", "11", "13", "No number"]
    },
    {
        plate_id: 12, image: CARD_12, correctAnswer: "35",
        options: ["35", "5", "3", "36", "No number"]
    },
    {
        plate_id: 13, image: CARD_13, correctAnswer: "96",
        options: ["96", "6", "9", "35", "No number"]
    },

    {
        plate_id: 14, image: CARD_14, correctAnswer: "Two Lines",
        options: ["Two Lines", "Purple Line", "Red Line", "Three lines", "No lines"]
    },
];

// ─── Progress Bar ─────────────────────────────────────────────────────────────
const ProgressBar = ({ current, total }) => {
    const pct = Math.min((current / total) * 100, 100);
    return (
        <div className="flex flex-col items-start gap-1 w-full">
            <span
                className="text-white"
                style={{ fontFamily: "'Noto Sans', sans-serif", fontSize: "clamp(0.7rem, 2vw, 2rem)" }}
            >
                Image {current} of {total}
            </span>
            <div className="w-full overflow-hidden"
                style={{ height: "clamp(6px, 1.3vw, 21px)", background: "#e0e0e0", borderRadius: "169.6px" }}
            >
                <div style={{
                    width: `${pct}%`, height: "100%",
                    background: "#0d4aca", borderRadius: "169.6px",
                    transition: "width 0.4s ease",
                }} />
            </div>
        </div>
    );
};
const initialTimer = 8;
export const ColorBlindQuiz = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
     const storeUser = useSelector((state) => state.common.user);
    const screeningSessionId = useSelector((state) => state.common.screening?.sessionId);
    const [sessionId, setSessionId] = useState(location.state?.sessionId);
    console.log("sessionId in quiz", sessionId, "screeningSessionId in quiz", screeningSessionId)
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(initialTimer);

    const timerRef = useRef(null);
    const plateStartMs = useRef(Date.now());
    const submittingRef = useRef(false);

    const totalPlates = PLATES.length;         // 14
    const currentPlate = PLATES[currentIndex];  // always valid

    useEffect(() => {
        setTimeLeft(initialTimer);
        plateStartMs.current = Date.now();
        submittingRef.current = false;
    }, [currentIndex]);

    // ── 3. Countdown tick ─────────────────────────────────────────────────────
    useEffect(() => {
       // if (!sessionId) return;
        if (timeLeft <= 0) { handleAnswer(null, true); return; }
        timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
        return () => clearTimeout(timerRef.current);
    }, [timeLeft, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── 4. Submit answer ───────────────────────────────────────────────────────
    const handleAnswer = useCallback(


        async (selectedAnswer, isTimeout = false) => {
           //if (!sessionId || submittingRef.current) return;
            submittingRef.current = true;
            clearTimeout(timerRef.current);

            const responseTimeMs = Date.now() - plateStartMs.current;
            const noResponse = isTimeout ? 1 : 0;
            const answerToSend = isTimeout ? null : selectedAnswer;
            try {
                await colorBlindessSubmit(
                    sessionId,
                    currentPlate.plate_id,
                    answerToSend,
                    noResponse,
                    responseTimeMs
                );
            } catch (err) {
                console.error("colorBlindessSubmit error:", err);
                navigate("/bia/result");
                return;
            }

            const nextIndex = currentIndex + 1;

            if (nextIndex >= totalPlates) {
                try {
                    const result = await colorBlindessComplete(sessionId, screeningSessionId);
                    console.log("result colorBlindess", result)
                    if (result.success) {
                        navigate("/bia/result");
                    }
                } catch (err) {
                    console.log(err);
                   // navigate("/bia/result");
                } finally {
                    navigate("/bia/result");
                }
            } else {
                setCurrentIndex(nextIndex);
            }
        },
        [sessionId, currentPlate, currentIndex, totalPlates, navigate]
    );
    const { image, options } = currentPlate;
    const shuffledOptions = useMemo(() => {
        const arr = [...options];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

    const gridOptions = shuffledOptions.slice(0, -1);
    const lastOption = shuffledOptions[shuffledOptions.length - 1];
    return (
        <div className="flex flex-col gap-36 inset-0 w-screen h-screen overflow-hidden bg-black p-10">

            {/* Background */}
            <div
                className="absolute inset-0 bg-center bg-cover z-0 opacity-50"
                style={{ backgroundImage: `url(${bg1})` }}
            />

            {/* Content */}
            <div className="absolute inset-0 z-10 flex flex-col items-center overflow-y-auto py-4 px-4 gap-18">

                {/* Progress bar */}
                <div className="w-full max-w-[665px] mt-10">
                    <ProgressBar current={currentIndex + 1} total={totalPlates} />
                </div>

                {/* Question */}
                <p
                    className="text-white text-center font-mono w-full max-w-[1149px]"
                    style={{ fontSize: "clamp(1rem, 4vw, 4rem)" }}
                >
                    {t("colorBlindness.question", "Select what you see")}
                </p>

                {/* Timer */}
                <CircularTimer
                    timerSeconds={initialTimer}
                    onExpire={() => handleAnswer(null, true)}
                    currentPlate={currentIndex + 1}
                />

                {/* Plate image */}
                <div className="bg-transparent rounded-3xl p-6 w-[70%] max-w-[1018px] flex items-center justify-center shadow-2xl">
                    <img
                        src={image}
                        alt={t("colorBlindness.plateAlt", "Color blindness plate")}
                        className="w-full h-auto object-cover rounded-2xl"
                    />
                </div>

                {/* Answer buttons */}
                <div className="flex flex-col items-center gap-5 w-full max-w-[1510px]">

                    {/* Options A–D in a row */}
                    <div className="flex flex-wrap justify-center gap-6">
                        {gridOptions.map((label) => (
                            <OptionButton
                                key={label}
                                label={label}
                                onClick={() => handleAnswer(label)}
                            />
                        ))}
                    </div>

                    {/* Option E — wide centred (No number / No lines) */}
                    <OptionButton
                        key={lastOption}
                        label={lastOption}
                        onClick={() => handleAnswer(lastOption)}
                        wide
                    />
                </div>

            </div>
        </div>
    );
};

export default ColorBlindQuiz;