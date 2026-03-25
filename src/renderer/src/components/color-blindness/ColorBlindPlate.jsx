import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import bg1 from "../../assets/lightbg.png";
import textframe from "../../assets/textFrame.png";
import InitialColorBlindImage from "../../assets/inital_colorB_image.png";
import BlueGradientButton from "../ui/BlueGradientButton";
import { getColorBlindessPlates, colorBlindessStart } from "../../utils/api";
import { useSelector } from "react-redux";
import { getKioskId } from "../../utils/config";


export const ColorBlindPlate = () => {
    const user = useSelector((state) => state.common.user);
    const { t } = useTranslation();
    const navigate = useNavigate();
    const audioRef = useRef(null);

    const [audioPlaying, setAudioPlaying] = useState(false);
    const [loading, setLoading] = useState(true);  // seeding + starting
    const [sessionId, setSessionId] = useState(null);
    const [error, setError] = useState(null);
    const kioskId = getKioskId();
    const userId = user?.data?.user_id || "bdabcfad-558f-4d36-9cfd-5deaedfdd629";
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                await getColorBlindessPlates();
                const res = await colorBlindessStart(userId, kioskId);
                console.log("res start colorblindess", res)
                if (!res.success) throw new Error(res.error ?? "Start failed");

                if (!cancelled) setSessionId(res.session_id);
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        // Auto-play instruction audio
        audioRef.current?.play().catch((err) =>
            console.warn("Audio playback failed:", err)
        );

        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Navigate to quiz, passing sessionId via router state ─────────────────
    const onNext = () => {
        if (!sessionId) return; // still loading or errored
        navigate("/colorblindness/quiz", { state: { sessionId } });
    };

    return (
        <div className="flex flex-col gap-36 inset-0 w-screen h-screen overflow-hidden bg-black p-10">

            {/* Hidden audio */}
            <audio
                ref={audioRef}
                onPlay={() => setAudioPlaying(true)}
                onEnded={() => setAudioPlaying(false)}
            >
                <source src="/src/assets/audio/colorblindness_intro.mp3" type="audio/mpeg" />
                {t("common.audio_not_supported")}
            </audio>

            {/* Background */}
            <div
                className="absolute inset-0 bg-center bg-cover z-0 opacity-50"
                style={{ backgroundImage: `url(${bg1})` }}
            />

            {/* Content */}
            <div className="absolute inset-0 z-10 flex flex-col items-center overflow-y-auto py-4 px-4 gap-18">

                {/* Title badge */}
                <div className="mt-10 z-10 w-[60%]">
                    <div className="relative text-center flex flex-col items-center gap-20">
                        <img src={textframe} alt="text-frame" className="absolute top-0" />
                        <p
                            className="text-white text-center tracking-wider my-6 font-mono"
                            style={{ fontSize: "clamp(1rem, 4vw, 4rem)" }}
                        >
                            {t("colorBlindness.title", "Color Blindness Test")}
                        </p>
                        <img src={textframe} alt="text-frame" className="absolute top-[4.5rem] rotate-180" />
                    </div>
                </div>

                {/* Instructions */}
                <p
                    className="text-white text-center font-mono w-[90%] max-w-[1149px]"
                    style={{ fontSize: "clamp(1rem, 4vw, 4rem)" }}
                >
                    {t("colorBlindness.instructions_line1", "You have to click the number/shape for each image.")}
                    <br />
                    {t("colorBlindness.instructions_line2", "If you don't see anything just click on Cannot read plate.")}
                    <br />
                    {t("colorBlindness.instructions_line3", "There will be 14 plates.")}
                    <br /><br />
                    {t("colorBlindness.instructions_example", "Example: This Number is 6. Click on next button to start!")}
                </p>

                {/* Example plate */}
                <div className="relative overflow-hidden rounded-3xl w-[70%] max-w-[1018px] flex items-center justify-center p-6">
                    <img
                        src={InitialColorBlindImage}
                        alt={t("colorBlindness.plateAlt", "Example color blindness plate")}
                        className="relative w-full h-auto object-cover rounded-2xl"
                    />
                </div>

                {/* Next button — disabled while session is still being created */}
                <BlueGradientButton onClick={onNext} disabled={loading || error}>
                    {t("colorBlindness.next", "Next")}
                </BlueGradientButton>

            </div>
        </div>
    );
};

export default ColorBlindPlate;