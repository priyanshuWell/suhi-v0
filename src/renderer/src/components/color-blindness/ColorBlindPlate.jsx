import React, { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import bg1 from "../../assets/lightbg.png";
import textframe from "../../assets/textFrame.png";
import InitialColorBlindImage from "../../assets/inital_colorB_image.png";
import BlueGradientButton from "../ui/BlueGradientButton";
import { getColorBlindessPlates, colorBlindessStart } from "../../utils/api";
import { useSelector } from "react-redux";
import { getKioskId } from "../../utils/config";
import instructionAudio from "../../assets/audio/colorblindness_instruction_en.mp3";


export const ColorBlindPlate = () => {
    const user = useSelector((state) => state.common.user);
    const screening = useSelector((state) => state.common.screening);
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);  // seeding + starting
    const [sessionId, setSessionId] = useState(null);
    const [error, setError] = useState(null);
    const kioskId = getKioskId();
    const userId = user?.data?.user_id || "bdabcfad-558f-4d36-9cfd-5deaedfdd629";

    // ── Instruction audio ─────────────────────────────────────────────────────
    const audioRef = useRef(null);
    const [audioDone, setAudioDone] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        const audio = new Audio(instructionAudio);
        audioRef.current = audio;

        const handleEnded = () => { setAudioDone(true); setIsPlaying(false); };
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        audio.addEventListener("ended", handleEnded);
        audio.addEventListener("play", handlePlay);
        audio.addEventListener("pause", handlePause);

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch((err) => {
                console.warn("[ColorBlindPlate] Autoplay prevented:", err.message);
                setIsPlaying(false);
            });
        }

        return () => {
            audio.removeEventListener("ended", handleEnded);
            audio.removeEventListener("play", handlePlay);
            audio.removeEventListener("pause", handlePause);
            audio.pause();
            audio.src = "";
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleReplay = () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = 0;
        audio.play().catch((err) => console.warn("[ColorBlindPlate] Replay failed:", err.message));
    };

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                await getColorBlindessPlates();
                const res = await colorBlindessStart(userId, kioskId, screening?.sessionId);
                console.log("res start colorblindess", res)
                if (!res.success) throw new Error(res.error ?? "Start failed");

                if (!cancelled) setSessionId(res.session_id);
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Navigate to quiz, passing sessionId via router state ─────────────────
    const onNext = () => {
        // if (!sessionId) return; // still loading or errored
        navigate("/colorblindness/quiz", { state: { sessionId } });
    };

    return (
        <div className="flex flex-col gap-36 inset-0 w-screen h-screen overflow-hidden bg-black  ">

            {/* Background */}
            <div
                className="absolute inset-0 bg-center bg-cover z-0 opacity-50"
                style={{ backgroundImage: `url(${bg1})` }}
            />

            {/* Content */}
            <div className="absolute inset-0 z-10 flex flex-col items-center overflow-y-auto pt-20 gap-10">

                {/* Title badge */}
                <div className="mt-12 z-10 w-[60%]">
                    <div className="relative text-center flex flex-col items-center gap-20">
                        <img src={textframe} alt="text-frame" className="absolute top-0" />
                        <p
                            className="text-white text-center tracking-wider my-5 font-anta"
                            style={{ fontSize: "clamp(1rem, 4vw, 4rem)" }}
                        >
                            {t("colorBlindness.title", "Color Blindness Test")}
                        </p>
                        <img src={textframe} alt="text-frame" className="absolute top-[4.5rem] rotate-180" />
                    </div>
                </div>

                {/* Instructions */}
                <p
                    className="text-white text-center font-anta w-[90%] max-w-[1149px]"
                    style={{ fontSize: "clamp(1rem, 4vw, 4rem)" }}
                >
                    {/* {t("colorBlindness.instructions_line1", "You have to click the number/shape for each image.")}
                    <br />
                    {t("colorBlindness.instructions_line2", "If you don't see anything just click on Cannot read plate.")}
                    <br /><br />
                    {t("colorBlindness.instructions_example", "Example: This Number is 6. Click on next button to start!")} */}

                    {t("colorBlindness.instruction")}
                    <br /><br />
                    {t("colorBlindness.instructions_example", "Example: This Number is 6. Click on next button to start!")}
                </p>

                {/* Audio replay button */}
                <button
                    onClick={handleReplay}
                    className="flex items-center gap-3 px-6 py-3 rounded-full border border-white/30 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all duration-300"
                >
                    <Volume2 size={24} className={isPlaying ? "animate-pulse text-blue-300" : ""} />
                    <span className="text-lg tracking-wide">
                        {isPlaying ? t('audio.playing', 'Playing…') : t('audio.replay', 'Replay Instructions')}
                    </span>
                </button>

                {/* Example plate */}
                <div className="relative overflow-hidden rounded-3xl w-[70%] max-w-[1018px] flex items-center justify-center p-6">
                    <img
                        src={InitialColorBlindImage}
                        alt={t("colorBlindness.plateAlt", "Example color blindness plate")}
                        className="relative w-full h-auto object-cover rounded-2xl"
                    />
                </div>

                {/* Next button — locked until instruction audio completes */}
                <div className="flex flex-col items-center gap-2">
                    <BlueGradientButton onClick={onNext} disabled={!audioDone}>
                        {t("colorBlindness.next", "Next")}
                    </BlueGradientButton>
                    {!audioDone && (
                        <p className="text-white/50 text-sm tracking-wide mt-1">
                            {t('audio.listenFirst', 'Please listen to the instructions first')}
                        </p>
                    )}
                </div>

            </div>
        </div>
    );
};

export default ColorBlindPlate;