import React, { useEffect, useState } from "react";
import bg1 from "../../assets/lightbg.png";
import voiceImage from "../../assets/voice_image.png";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

const VoiceCapture = () => {
    const { t } = useTranslation();
    const [timeLeft, setTimeLeft] = useState(50);
    const [isActive, setIsActive] = useState(false);
    const [status, setStatus] = useState("idle"); // idle, recording, processing, success, error
    const mediaRecorderRef = React.useRef(null);
    const chunksRef = React.useRef([]);
    const navigate = useNavigate();

    useEffect(() => {
        let interval = null;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && isActive) {
            clearInterval(interval);
            setIsActive(false);
            stopRecording();
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("stream", stream);
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };
            console.log("mediaRecorder", mediaRecorder, chunksRef.current);
            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const arrayBuffer = await blob.arrayBuffer();
                const sessionId = "38e075c8-1a49-450a-8bbb-ccd1bd6483faaa";
                const userId = "38e075c8-1a49-450a-8bbb-ccd1bd6483fa"
                setStatus("processing");
                const request = {
                    kiosk_id: "test-kiosk-01",
                    user_id: userId,
                    session_id: sessionId,
                    arrayBuffer: arrayBuffer
                };

                try {
                    const result = await window.api.saveVoiceBuffer(request);
                    console.log("result", result);
                    if (result.success) {
                        setStatus("success");
                        console.log("Voice analysis success:", result);
                        // navigate("/bia/result");

                    } else {
                        setStatus("error");
                        console.error("Voice analysis failed:", result.error);
                    }
                } catch (err) {
                    setStatus("error");
                    console.error("IPC error:", err);
                }

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsActive(true);
            setStatus("recording");
        } catch (err) {
            console.error("Microphone permission denied or error:", err);
            setStatus("error");
        }
    };

    const handleStart = () => {
        if (status === "recording" || status === "processing") return;
        setTimeLeft(50);
        startRecording();
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black flex flex-col items-center justify-center">
            {/* Background */}
            <div
                className="absolute inset-0 bg-center bg-cover z-0 opacity-50"
                style={{ backgroundImage: `url(${bg1})` }}
            />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center justify-around mb-20 w-full max-w-4xl h-full gap-8 p-4">

                {/* Header Text */}
                <h1 className="text-white/90 text-center text-xl portrait:text-4xl font-mono leading-relaxed max-w-2xl">
                    Look at the image, notice what it makes you feel or think, then click Start and speak freely for 50 seconds.
                </h1>

                {/* Image Container */}
                <div className="relative w-full max-w-[1200px] aspect-video shadow-[0px_10px_50px_0px_#9AD9FF] rounded-[74px] overflow-hidden border border-[#9AD9FF]/30">
                    <img
                        src={voiceImage}
                        alt="voice-image"
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Timer Section */}
                <div className="relative flex flex-col items-center justify-center">
                    <div className="relative w-[250px] h-[250px] flex items-center justify-center">
                        {/* Timer SVG */}
                        <svg
                            width="250"
                            height="250"
                            viewBox="0 0 404 404"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <defs>
                                {/* <radialGradient id="paint0_radial_7767_5563" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(62.5 -140) rotate(37.3605) scale(268.61)">
                                    <stop stopColor="white" />
                                    <stop offset="1" stopColor="#094EC6" />
                                </radialGradient> */}
                            </defs>

                            {/* Static Track Background */}
                            <path
                                d="M404 202C404 313.561 313.561 404 202 404C90.4385 404 0 313.561 0 202C0 90.4385 90.4385 0 202 0C313.561 0 404 90.4385 404 202ZM32.32 202C32.32 295.712 108.288 371.68 202 371.68C295.712 371.68 371.68 295.712 371.68 202C371.68 108.288 295.712 32.32 202 32.32C108.288 32.32 32.32 108.288 32.32 202Z"
                                fill="#DDF5FF"
                            />

                            {/* Animated Progress Circle matching the track dimensions */}
                            {/* Inner R ~170, Outer R ~202, Thickness ~32, Center 202 */}
                            <circle
                                cx="202"
                                cy="202"
                                r="186"
                                stroke="#094EC6"
                                strokeWidth="32"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 186}
                                strokeDashoffset={(2 * Math.PI * 186) * (1 - timeLeft / 50)}
                                transform="rotate(-90 202 202)"
                                style={{ transition: 'stroke-dashoffset 1s linear' }}
                            />

                            {/* Rotating Knob */}
                            <g
                                transform={`rotate(${(timeLeft / 5) * 360} 202 202)`}
                                style={{ transition: 'transform 1s linear' }}
                            >
                                <path
                                    d="M202 16.16C202 7.2351 209.246 -0.0671478 218.143 0.646078C219.372 0.744589 220.6 0.85436 221.826 0.975363C230.708 1.85137 236.545 10.3231 234.962 19.1065L234.779 20.1224C233.297 28.3448 225.429 33.7378 217.108 32.9939C208.786 32.2501 202 25.5471 202 17.1923L202 16.16Z"
                                    fill="url(#paint0_radial_7767_5563)"
                                />
                            </g>
                        </svg>
                        <span className="absolute text-2xl font-mono text-white tracking-widest">
                            {formatTime(timeLeft)}
                        </span>
                    </div>
                </div>
                <button
                    onClick={handleStart}
                    // onClick={() => navigate(skipBIA ? '/voice' : '/verified')}
                    className="
              w-[clamp(16rem,40vw,31.25rem)]
              h-[clamp(4rem,8vh,6.25rem)]
              flex items-center justify-center
              text-center
              rounded-[30px]
              border-2 border-white/50
              bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)]
              shadow-[0px_0px_30px_rgba(0,179,255,0.5),inset_0px_0px_20px_rgba(255,255,255,0.3)]
              text-white
              text-[clamp(1.5rem,3vw,3rem)]
              tracking-wide
              active:scale-[0.98]
              transition-all duration-300 ease-in-out
              hover:border-white
            "
                >
                    {isActive ? 'Recording...' : status === 'processing' ? 'Processing...' : 'Start'}
                </button>

            </div>
        </div>
    );
};

export default VoiceCapture;