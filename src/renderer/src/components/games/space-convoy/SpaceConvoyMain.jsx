import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import divideAttentionBg from "../../../assets/games/divideAttentionbg.png"
import stimulus_1 from "../../../assets/games/stimulus_1.png"
import stimulus_2 from "../../../assets/games/stimulus_2.png"
import stimulus_3 from "../../../assets/games/stimulus_3.png"
import distractor_1 from "../../../assets/games/distractor_1.svg"
import distractor_2 from "../../../assets/games/distractor_2.svg"
import stimulus_correct_1 from "../../../assets/games/stimulus_correct_1.png"
import stimulus_correct_2 from "../../../assets/games/stimulus_correct_2.png"
import stimulus_correct_3 from "../../../assets/games/stimulus_correct_3.png"
import stimulus_glow_1 from "../../../assets/games/stimulus_glow_1.png"
import stimulus_glow_2 from "../../../assets/games/stimulus_glow_2.png"
import stimulus_glow_3 from "../../../assets/games/stimulus_glow_3.png"
import stimulus_error_1 from "../../../assets/games/stimulus_error_1.png"
import stimulus_error_2 from "../../../assets/games/stimulus_error_2.png"
import stimulus_error_3 from "../../../assets/games/stimulus_error_3.png"
import bg1 from "../../../assets/lightbg.png"
import { SpaceConvoyText } from './SpaceConvoyText'
import SpaceConveyDemo from './SpaceConveyDemo'
import { StartCountDown } from './StartCountDown'
import DivideAttentionGame from './DivideAttentionGame'
import { useNavigate } from 'react-router'
import { DivideAttentionSession } from '../../../utils/api' // adjust path as needed
import { useSelector } from 'react-redux'
import { SpaceConvoyComplete } from './SpaceConveyComplete'
import { store } from '../../../../../store/store'

// ─── Asset loading utilities (shared) ───
// Vite resolves SVG/PNG imports to data: URIs or hashed paths at build time.
// We must NOT fetch() them — CSP blocks fetch() of data: URIs via connect-src.
// Simply set img.src directly; the browser handles data: URIs natively.
async function loadAsset(src) {
    return new Promise((resolve) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => resolve(null);
        i.src = src;
    });
}

const SCREENS = {
    LOADING: "LOADING",
    INSTRUCTION: "INSTRUCTION",
    DEMO: "DEMO",
    COUNTDOWN: "COUNTDOWN",
    GAME: "GAME",
    COMPLETE: "COMPLETE",
}

const SpaceConvoyMain = () => {
    const { t } = useTranslation()
    const [screen, setScreen] = useState(SCREENS.LOADING)
    const [sessionId, setSessionId] = useState(null)
    const assetsRef = useRef(null)
    const navigate = useNavigate();
    const storeUser = useSelector((state) => state.common.user);
    // ─── Preload ALL assets once at mount ───
    useEffect(() => {
        (async () => {
            const [stim, glow, correct, error, distImgs, bg] = await Promise.all([
                // Stimuli — use loadAsset: no fetch(), just Image.src directly
                Promise.all([stimulus_1, stimulus_2, stimulus_3].map(loadAsset)),
                // Glow variants
                Promise.all([stimulus_glow_1, stimulus_glow_2, stimulus_glow_3].map(loadAsset)),
                // Correct variants
                Promise.all([stimulus_correct_1, stimulus_correct_2, stimulus_correct_3].map(loadAsset)),
                // Error variants
                Promise.all([stimulus_error_1, stimulus_error_2, stimulus_error_3].map(loadAsset)),
                // Distractors
                Promise.all([distractor_1, distractor_2].map(loadAsset)),
                // Background
                loadAsset(divideAttentionBg),
            ]);

            assetsRef.current = {
                stim,
                glow,
                correct,
                error,
                distImgs: distImgs.filter(Boolean),
                bg,
                loaded: true,
            };

            // Assets ready → show instruction screen
            setScreen(SCREENS.INSTRUCTION);
        })();
    }, []);

    const handleMoveToComplete = () => {
        setScreen(SCREENS.COMPLETE)
    }
    const handleStartDemo = async () => {
        // TODO: replace with real userId from your auth/Redux store
        const userId = storeUser?.data?.user_id || "bdabcfad-558f-4d36-9cfd-5deaedfdd629";
        const sessionId =  storeUser?.screening?.session_id || "41cee210-5f5a-4bb6-bcb6-a5f772dbd174";
        const result = await DivideAttentionSession(userId,sessionId, "practice")
        if (result.success) {
            setSessionId(result.data.game_session_id ??  null)
            console.log("[SpaceConvoy] Session created:", result.data.game_session_id)
        } else {
            console.warn("[SpaceConvoy] Session create failed, continuing offline")
        }
        setScreen(SCREENS.DEMO)
    }
    const handleDemoComplete = () => setScreen(SCREENS.COUNTDOWN)
    const handleCountdownComplete = () => {
        setScreen(SCREENS.GAME)
        navigate('/divide-attention', { state: { sessionId } })
    }

    // Use lightbg for instruction/countdown, divideAttentionBg for demo/game
    const isGameScreen = screen === SCREENS.DEMO || screen === SCREENS.GAME
    const bgImage = isGameScreen ? divideAttentionBg : bg1

    return (
        <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black flex flex-col items-center justify-center">
            <div
                className="absolute inset-0 bg-center bg-cover z-0"
                style={{
                    backgroundImage: `url(${bgImage})`,
                    opacity: isGameScreen ? 1 : 0.5,
                }}
            />

            {screen === SCREENS.LOADING && (
                <div className="relative z-10 flex items-center justify-center w-full h-full">
                    <p className="text-white text-2xl font-anta animate-pulse">Loading...</p>
                </div>
            )}

            {screen === SCREENS.INSTRUCTION && (
                <SpaceConvoyText onStartDemo={handleStartDemo} />
            )}

            {screen === SCREENS.DEMO && (
                <SpaceConveyDemo handleMoveToComplete={handleMoveToComplete} sessionId={sessionId} onComplete={handleDemoComplete} />
            )}

            {screen === SCREENS.COUNTDOWN && (
                <StartCountDown onComplete={handleCountdownComplete} />
            )}

            {screen === SCREENS.COMPLETE && (
                <SpaceConvoyComplete />
            )}
        </div>
    )
}

export default SpaceConvoyMain