import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import bg1 from "../../assets/lightbg.png"; // reuse same bg as BIAComponent
import textframe from "../../assets/textFrame.png";
import CARD_1 from '../../assets/color_blindness/Card_1.png'
import BlueGradientButton from "../ui/BlueGradientButton";
import { useNavigate } from "react-router";
// Figma asset URLs (valid for 7 days from generation)
const imgBackground =
    "https://www.figma.com/api/mcp/asset/fef9b9a0-5139-4459-8da4-cac47ca6dca7";
const imgPlateExample =
    "https://www.figma.com/api/mcp/asset/6815e5ac-eab8-46f7-8b95-ab3dc1f2ec75";
const imgTitleFrameTop =
    "https://www.figma.com/api/mcp/asset/5356320e-23aa-4f7d-94b7-194494bba710";
const imgTitleFrameBottom =
    "https://www.figma.com/api/mcp/asset/647d60d0-86d2-4630-b446-ba6402ae19f2";

/**
 * ColorBlindnessPlateScreen
 *
 * Intro/instruction screen for the Color Blindness test.
 * Matches Figma node 8481-2387 and follows the same conventions as BIAComponent.
 *
 * Props:
 *  onNext        – called when the user taps "Next"
 *  plateImage    – optional override for the example plate image src
 */


/**
 * ColorBlindPlate
 *
 * Intro/instruction screen for the Color Blindness test.
 * Styled to match ColorBlindQuiz (dark bg, glass card, LiquidGlassButton).
 *
 * Props:
 *  onNext        – called when the user taps "Next"
 *  plateImage    – optional override for the example plate image src
 */
export const ColorBlindPlate = ({
    plateImage = imgPlateExample,
}) => {
    const { t } = useTranslation();
    const audioRef = useRef(null);
    const navigate = useNavigate();
    const [audioPlaying, setAudioPlaying] = useState(false);

    // Auto-play instruction audio when the screen mounts
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current
                .play()
                .catch((err) => console.log("Audio playback failed:", err));
        }
    }, []);

    const onNext = () => {
        navigate("/colorblindness/quiz");
    };

    const handleAudioEnd = () => setAudioPlaying(false);

    return (
        <div className="flex flex-col gap-36 inset-0 w-screen h-screen overflow-hidden bg-black p-10">
            {/* Hidden audio */}
            <audio
                ref={audioRef}
                onPlay={() => setAudioPlaying(true)}
                onEnded={handleAudioEnd}
            >
                <source
                    src="/src/assets/audio/colorblindness_intro.mp3"
                    type="audio/mpeg"
                />
                {t("common.audio_not_supported")}
            </audio>

            {/* ── Background layer (same as Quiz) ── */}
            <div
                className="absolute inset-0 bg-center bg-cover z-0 opacity-50"
                style={{ backgroundImage: `url(${bg1})` }}
            />

            {/* ══════════════ CONTENT WRAPPER ══════════════ */}
            <div className="absolute inset-0 z-10 flex flex-col items-center overflow-y-auto py-4 px-4 gap-18">

                {/* ── Title badge ── */}
                <div className="mt-10 z-10 w-[60%]">
                    <div className="relative text-center flex flex-col items-center gap-20">
                        <img src={textframe} alt="text-frame" className="absolute top-0" />
                        <p className="text-white text-center portrait:text-[32px] tracking-wider my-6 font-mono"
                            style={{ fontSize: "clamp(1rem, 4vw, 4rem)" }}>
                            {t("colorBlindness.title", "Color Blindness Test")}
                        </p>
                        <img
                            src={textframe}
                            alt="text-frame"
                            className="absolute top-[4.5rem] rotate-180"
                        />
                    </div>
                </div>

                {/* ── Instruction text ── */}
                <p
                    className="text-white text-center font-mono w-[90%] max-w-[1149px]"
                    style={{ fontSize: "clamp(1rem, 4vw, 4rem)" }}
                >
                    {t("colorBlindness.instructions_line1", "You have to click the number/shape for each image.")}
                    <br />
                    {t("colorBlindness.instructions_line2", "If you don't see anything just click on Cannot read plate.")}
                    <br />
                    {t("colorBlindness.instructions_line3", "There will be 14 plates.")}
                    <br />
                    <br />
                    {t("colorBlindness.instructions_example", "Example: This Number is 6. Click on next button to start!")}
                </p>
                {/* ── Example plate card — glass style matching Quiz ── */}
                <div
                    className="relative overflow-hidden rounded-3xl w-[70%] max-w-[1018px] flex items-center justify-center p-6"
                >

                    <img
                        src={CARD_1}
                        alt={t("colorBlindness.plateAlt", "Example color blindness plate")}
                        className="relative w-full h-auto object-cover rounded-2xl"
                    />
                </div>

                {/* ── Next button — LiquidGlassButton ── */}
                <BlueGradientButton
                    onClick={onNext}
                >
                    {t("colorBlindness.next", "Next")}
                </BlueGradientButton>
            </div>
        </div>
    );
};

export default ColorBlindPlate;