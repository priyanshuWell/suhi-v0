// import React, { useEffect, useState } from "react";
// import bg1 from "../../assets/lightbg.png";
// import voiceImage from "../../assets/voice_image.png";
// import { useNavigate } from "react-router";
// import { useTranslation } from "react-i18next";
// import { useSelector } from "react-redux";
// import { getKioskId } from "../../utils/config";
// import { sendVoiceToBackend, runVoice } from "../../utils/api";
// import audioBufferToWav from "audiobuffer-to-wav";


// const VoiceCapture = () => {
//     const { t } = useTranslation();
//     const navigate = useNavigate();

//     // Get data from Redux store
//     const user = useSelector((state) => state.common.user);
//     const sessionId = useSelector((state) => state.common.sessionId);

//     const [timeLeft, setTimeLeft] = useState(30);
//     const [isActive, setIsActive] = useState(false);
//     const [status, setStatus] = useState("idle"); // idle, recording, processing, success, error
//     const [isAudioPlaying, setIsAudioPlaying] = useState(false);
//     const [voiceBars, setVoiceBars] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0]); // Heights for 9 bars
//     const mediaRecorderRef = React.useRef(null);
//     const audioRef = React.useRef(null);
//     const chunksRef = React.useRef([]);
//     const analyserRef = React.useRef(null);
//     const dataArrayRef = React.useRef(null);
//     const animationFrameRef = React.useRef(null);
//     const [processingAngle, setProcessingAngle] = useState(0);
//     const instructionAudio = "/src/assets/audio/voice.mp3";

//     useEffect(() => {
//         // Play audio when component mounts
//         playAudio();
//     }, []);

//     useEffect(() => {
//         let interval;

//         if (status === "processing") {
//             interval = setInterval(() => {
//                 setProcessingAngle(prev => (prev + 6) % 360); // smooth rotation
//             }, 16); // ~60fps
//         }

//         return () => clearInterval(interval);
//     }, [status]);

//     useEffect(() => {
//         let interval = null;
//         if (isActive && timeLeft > 0) {
//             interval = setInterval(() => {
//                 setTimeLeft((prev) => prev - 1);
//             }, 1000);
//         } else if (timeLeft === 0 && isActive) {
//             clearInterval(interval);
//             setIsActive(false);
//             stopRecording();
//         }
//         return () => clearInterval(interval);
//     }, [isActive, timeLeft]);

//     const playAudio = () => {
//         if (audioRef.current) {
//             setIsAudioPlaying(true);
//             audioRef.current.play().catch((err) => {
//                 console.log("Audio playback failed:", err);
//             });
//         }
//     };

//     const stopAudio = () => {
//         if (audioRef.current) {
//             audioRef.current.pause();
//             audioRef.current.currentTime = 0;
//             setIsAudioPlaying(false);
//         }
//     };

//     const handleAudioEnd = () => {
//         setIsAudioPlaying(false);
//     };

//     // Visualize voice using Web Audio API
//     const visualizeVoice = () => {
//         if (!analyserRef.current || !dataArrayRef.current) return;

//         const analyser = analyserRef.current;
//         const dataArray = dataArrayRef.current;

//         analyser.getByteFrequencyData(dataArray);

//         // Map frequency data to 9 bars
//         const barCount = 9;
//         const bufferLength = dataArray.length;
//         const barWidth = Math.floor(bufferLength / barCount);

//         const newBars = [];
//         for (let i = 0; i < barCount; i++) {
//             let sum = 0;
//             const start = i * barWidth;
//             const end = start + barWidth;

//             for (let j = start; j < end; j++) {
//                 sum += dataArray[j];
//             }

//             const average = sum / barWidth;
//             // Normalize to 0-1 range and smooth it out
//             const normalized = Math.min(1, average / 255);
//             newBars.push(normalized);
//         }

//         setVoiceBars(newBars);
//         animationFrameRef.current = requestAnimationFrame(visualizeVoice);
//     };

//     // Cleanup animation on unmount
//     useEffect(() => {
//         return () => {
//             if (animationFrameRef.current) {
//                 cancelAnimationFrame(animationFrameRef.current);
//             }
//         };
//     }, []);
//     const startRecording = async () => {
//         try {
//             const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//             console.log("stream", stream);

//             // Set up Web Audio API for visualization
//             const audioContext = new AudioContext({ sampleRate: 16000 });
//             // const audioContext = new (window.AudioContext || window.webkitAudioContext)();
//             const source = audioContext.createMediaStreamSource(stream);
//             const analyser = audioContext.createAnalyser();

//             analyser.fftSize = 256;
//             const bufferLength = analyser.frequencyBinCount;
//             const dataArray = new Uint8Array(bufferLength);

//             source.connect(analyser);
//             analyserRef.current = analyser;
//             dataArrayRef.current = dataArray;

//             // Start visualization
//             visualizeVoice();

//             const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
//             mediaRecorderRef.current = mediaRecorder;
//             chunksRef.current = [];

//             mediaRecorder.ondataavailable = (e) => {
//                 if (e.data.size > 0) {
//                     chunksRef.current.push(e.data);
//                 }
//             };
//             console.log("mediaRecorder", mediaRecorder, chunksRef.current);
//             mediaRecorder.onstop = async () => {
//                 // Stop visualization
//                 if (animationFrameRef.current) {
//                     cancelAnimationFrame(animationFrameRef.current);
//                 }
//                 // Reset bars
//                 setVoiceBars([0, 0, 0, 0, 0, 0, 0, 0, 0]);

//                 const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
//                 const arrayBuffer = await blob.arrayBuffer();

//                 // Convert to WAV 16kHz
//                 const audioContext = new AudioContext({ sampleRate: 16000 });
//                 const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
//                 const wavArrayBuffer = audioBufferToWav(audioBuffer);

//                 // Get data from Redux store and config
//                 const kioskId = getKioskId();
//                 const userId = user?.data?.user_id || "38e075c8-1a49-450a-8bbb-ccd1bd6483fa"; // Corrected property path
//                 const sessionId = user?.data?.buffer_id;
//                 setStatus("processing");
//                 const request = {
//                     kiosk_id: kioskId,
//                     user_id: userId,
//                     session_id: sessionId,
//                     arrayBuffer: wavArrayBuffer
//                 };


//                 console.log("[Voice] Sending voice request with:", { kioskId, userId, sessionId });

//                 try {
//                     const voiceData = {
//                         role: "VOICE",
//                         timestamp: Date.now(),
//                         buffer: new Uint8Array(wavArrayBuffer)
//                     };


//                     const storeResult = await sendVoiceToBackend(voiceData);
//                     console.log("Store result voice:", storeResult);

//                     if (storeResult.success) {
//                         const runPayload = {
//                             shm_path: storeResult.shm_path,
//                             kiosk_id: kioskId,
//                             user_id: userId,
//                             session_id: sessionId
//                         };
//                         navigate("/colorblindness");
//                         const runResult = await runVoice(runPayload);
//                         console.log("Run result:", runResult);

//                         if (runResult.success) {
//                             setStatus("success");
//                             stopAudio();
//                             await new Promise((r) => setTimeout(r, 500));
//                             // navigate("/colorblindness");
//                         } else {
//                             setStatus("error");
//                             console.error("Voice run failed:", runResult.error);
//                             navigate("/colorblindness");
//                         }
//                     } else {
//                         setStatus("error");
//                         console.error("Voice storage failed:", storeResult.error);
//                         navigate("/colorblindness");
//                     }
//                 } catch (err) {
//                     setStatus("error");
//                     console.error("API error:", err);
//                     navigate("/colorblindness");
//                 }

//                 // Stop all tracks
//                 stream.getTracks().forEach(track => track.stop());
//                 // Close audio context
//                 audioContext.close();
//             };

//             mediaRecorder.start();
//             setIsActive(true);
//             setStatus("recording");
//         } catch (err) {
//             console.error("Microphone permission denied or error:", err);
//             setStatus("error");
//         }
//     };

//     const handleStart = () => {
//         if (status === "recording" || status === "processing") return;
//         setTimeLeft(30);
//         startRecording();
//     };

//     const stopRecording = () => {
//         if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
//             mediaRecorderRef.current.stop();
//         }
//     };

//     const formatTime = (seconds) => {
//         const mins = Math.floor(seconds / 60);
//         const secs = seconds % 60;
//         return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
//     };

//     return (
//         <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black flex flex-col items-center justify-center">
//             <audio
//                 ref={audioRef}
//                 onEnded={handleAudioEnd}
//                 onPlay={() => setIsAudioPlaying(true)}
//             >
//                 <source src={instructionAudio} type="audio/mpeg" />
//                 Your browser does not support the audio element.
//             </audio>
//             {/* Background */}
//             <div
//                 className="absolute inset-0 bg-center bg-cover z-0 opacity-50"
//                 style={{ backgroundImage: `url(${bg1})` }}
//             />

//             {/* Content Container */}
//             <div className="relative z-10 flex flex-col items-center justify-around mb-20 w-full max-w-4xl h-full gap-8 p-4">

//                 {/* Header Text */}
//                 <h1 className="text-white/90 text-center text-xl portrait:text-4xl font-mono leading-relaxed max-w-2xl">
//                     {t('voice.instruction')}
//                 </h1>

//                 {/* Image Container */}
//                 {/* <div className="relative w-full max-w-[1200px] aspect-video shadow-[0px_10px_50px_0px_#9AD9FF] rounded-[74px] overflow-hidden border border-[#9AD9FF]/30">
//                     <img
//                         src={voiceImage}
//                         alt="voice-image"
//                         className="w-full h-full object-cover"
//                     />
//                 </div> */}

//                 {/* Timer Section */}
//                 <div className="relative flex flex-col items-center justify-center gap-6">
//                     <div className="relative w-[250px] h-[250px] flex items-center justify-center">
//                         <svg
//                             width="250"
//                             height="250"
//                             viewBox="0 0 404 404"
//                             fill="none"
//                             xmlns="http://www.w3.org/2000/svg"
//                         >
//                             <defs>
//                                 {/* <radialGradient id="paint0_radial_7767_5563" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(62.5 -140) rotate(37.3605) scale(268.61)">
//                                     <stop stopColor="white" />
//                                     <stop offset="1" stopColor="#094EC6" />
//                                 </radialGradient> */}
//                             </defs>

//                             {/* Static Track Background */}
//                             {/* <path
//                                 d="M404 202C404 313.561 313.561 404 202 404C90.4385 404 0 313.561 0 202C0 90.4385 90.4385 0 202 0C313.561 0 404 90.4385 404 202ZM32.32 202C32.32 295.712 108.288 371.68 202 371.68C295.712 371.68 371.68 295.712 371.68 202C371.68 108.288 295.712 32.32 202 32.32C108.288 32.32 32.32 108.288 32.32 202Z"
//                                 fill="#DDF5FF"
//                             />

//                             <circle
//                                 cx="202"
//                                 cy="202"
//                                 r="186"
//                                 stroke="#094EC6"
//                                 strokeWidth="32"
//                                 fill="none"
//                                 strokeLinecap="round"
//                                 strokeDasharray={2 * Math.PI * 186}
//                                 strokeDashoffset={
//                                     status === "processing"
//                                         ? (2 * Math.PI * 186) * 0.75  // fixed arc size while spinning
//                                         : (2 * Math.PI * 186) * (1 - timeLeft / 30)
//                                 }
//                                 transform={
//                                     status === "processing"
//                                         ? `rotate(${processingAngle - 90} 202 202)`
//                                         : "rotate(-90 202 202)"
//                                 }
//                                 style={{
//                                     transition: status === "processing"
//                                         ? "none"
//                                         : "stroke-dashoffset 1s linear"
//                                 }}
//                             />

//                             {/* Rotating Knob */}
//                             <g
//                                 transform={`rotate(${(timeLeft / 5) * 360} 202 202)`}
//                                 style={{ transition: 'transform 1s linear' }}
//                             >
//                                 <path
//                                     d="M202 16.16C202 7.2351 209.246 -0.0671478 218.143 0.646078C219.372 0.744589 220.6 0.85436 221.826 0.975363C230.708 1.85137 236.545 10.3231 234.962 19.1065L234.779 20.1224C233.297 28.3448 225.429 33.7378 217.108 32.9939C208.786 32.2501 202 25.5471 202 17.1923L202 16.16Z"
//                                     fill="url(#paint0_radial_7767_5563)"
//                                 />
//                             </g>
//                         </svg>
//                         <span className="absolute text-4xl font-mono text-white tracking-widest">
//                             {formatTime(timeLeft)}
//                         </span> */}
//                     </div>




//                 </div>

//                 {/* Start Button - Hide when recording or processing, Disable when audio playing */}
//                 {status !== 'recording' && status !== 'processing' && (
//                     <button
//                         onClick={handleStart}
//                         disabled={isAudioPlaying}
//                         className={`
//                   w-[clamp(16rem,40vw,31.25rem)]
//                   h-[clamp(4rem,8vh,6.25rem)]
//                   flex items-center justify-center
//                   text-center
//                   rounded-[30px]
//                   border-2 border-white/50
//                   bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)]
//                   shadow-[0px_0px_30px_rgba(0,179,255,0.5),inset_0px_0px_20px_rgba(255,255,255,0.3)]
//                   text-white
//                   text-[clamp(1.5rem,3vw,3rem)]
//                   tracking-wide
//                   active:scale-[0.98]
//                   transition-all duration-300 ease-in-out
//                   hover:border-white
//                   ${isAudioPlaying ? 'opacity-50 cursor-not-allowed' : 'opacity-100 cursor-pointer'}
//                 `}
//                     >
//                         {t('voice.start')}
//                     </button>
//                 )}

//             </div>
//         </div>
//     );
// };

// export default VoiceCapture;




import React, { useEffect, useState } from "react";
import bg1 from "../../assets/lightbg.png";

import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { getKioskId } from "../../utils/config";
import { sendVoiceToBackend, runVoice } from "../../utils/api";
import audioBufferToWav from "audiobuffer-to-wav";
import VoiceTextScreen from "./VoiceTextScreen";
import VoiceImageScreen from "./VoiceImageScreen";


const VoiceCapture = () => {
    const navigate = useNavigate();
    const location = useLocation();
    console.log(location)
    // Get data from Redux store
    const user = useSelector((state) => state.common.user);
    const sessionId = useSelector((state) => state.common.sessionId);
    const [timeLeft, setTimeLeft] = useState(30);
    const [isActive, setIsActive] = useState(false);
    const [tab, setTab] = useState("start");
    const [status, setStatus] = useState("idle"); // idle, recording, processing, success, error
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [voiceBars, setVoiceBars] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0]); // Heights for 9 bars
    const mediaRecorderRef = React.useRef(null);
    const audioRef = React.useRef(null);
    const chunksRef = React.useRef([]);
    const analyserRef = React.useRef(null);
    const dataArrayRef = React.useRef(null);
    const animationFrameRef = React.useRef(null);
    const [processingAngle, setProcessingAngle] = useState(0);
    const instructionAudio = "/src/assets/audio/voice.mp3";
    const { t } = useTranslation();

    useEffect(() => {
        // Play audio when component mounts
        playAudio();
    }, []);

    useEffect(() => {
        let interval;

        if (status === "processing") {
            interval = setInterval(() => {
                setProcessingAngle(prev => (prev + 6) % 360); // smooth rotation
            }, 16); // ~60fps
        }

        return () => clearInterval(interval);
    }, [status]);

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

    const playAudio = () => {
        if (audioRef.current) {
            setIsAudioPlaying(true);
            audioRef.current.play().catch((err) => {
                console.log("Audio playback failed:", err);
            });
        }
    };

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsAudioPlaying(false);
        }
    };

    const handleAudioEnd = () => {
        setIsAudioPlaying(false);
    };

    // Visualize voice using Web Audio API
    const visualizeVoice = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;

        const analyser = analyserRef.current;
        const dataArray = dataArrayRef.current;

        analyser.getByteFrequencyData(dataArray);

        // Map frequency data to 9 bars
        const barCount = 9;
        const bufferLength = dataArray.length;
        const barWidth = Math.floor(bufferLength / barCount);

        const newBars = [];
        for (let i = 0; i < barCount; i++) {
            let sum = 0;
            const start = i * barWidth;
            const end = start + barWidth;

            for (let j = start; j < end; j++) {
                sum += dataArray[j];
            }

            const average = sum / barWidth;
            // Normalize to 0-1 range and smooth it out
            const normalized = Math.min(1, average / 255);
            newBars.push(normalized);
        }

        setVoiceBars(newBars);
        animationFrameRef.current = requestAnimationFrame(visualizeVoice);
    };

    // Cleanup animation on unmount
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);
    const startRecording = async () => {
        setTab("voice")
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("stream", stream);

            // Set up Web Audio API for visualization
            const audioContext = new AudioContext({ sampleRate: 16000 });
            // const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();

            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            source.connect(analyser);
            analyserRef.current = analyser;
            dataArrayRef.current = dataArray;

            // Start visualization
            visualizeVoice();

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
                // Stop visualization
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
                // Reset bars
                setVoiceBars([0, 0, 0, 0, 0, 0, 0, 0, 0]);

                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const arrayBuffer = await blob.arrayBuffer();

                // Convert to WAV 16kHz
                const audioContext = new AudioContext({ sampleRate: 16000 });
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                const wavArrayBuffer = audioBufferToWav(audioBuffer);

                // Get data from Redux store and config
                const kioskId = getKioskId();
                const userId = user?.data?.user_id || "38e075c8-1a49-450a-8bbb-ccd1bd6483fa"; // Corrected property path
                const sessionId = user?.data?.buffer_id;
                setStatus("processing");
                const request = {
                    kiosk_id: kioskId,
                    user_id: userId,
                    session_id: sessionId,
                    arrayBuffer: wavArrayBuffer
                };


                console.log("[Voice] Sending voice request with:", { kioskId, userId, sessionId });

                try {
                    const voiceData = {
                        role: "VOICE",
                        timestamp: Date.now(),
                        buffer: new Uint8Array(wavArrayBuffer)
                    };


                    const storeResult = await sendVoiceToBackend(voiceData);
                    console.log("Store result voice:", storeResult);

                    if (storeResult.success) {
                        const runPayload = {
                            shm_path: storeResult.shm_path,
                            kiosk_id: kioskId,
                            user_id: userId,
                            session_id: sessionId
                        };
                        navigate("/space-convoy-main");
                        const runResult = await runVoice(runPayload);
                        console.log("Run result:", runResult);

                        if (runResult.success) {
                            setStatus("success");
                            stopAudio();
                            await new Promise((r) => setTimeout(r, 500));
                            // navigate("/space-convoy-main");
                        } else {
                            setStatus("error");
                            console.error("Voice run failed:", runResult.error);
                            navigate("/space-convoy-main");
                        }
                    } else {
                        setStatus("error");
                        console.error("Voice storage failed:", storeResult.error);
                        navigate("/space-convoy-main");
                    }
                } catch (err) {
                    setStatus("error");
                    console.error("API error:", err);
                    navigate("/space-convoy-main");
                }

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
                // Close audio context
                audioContext.close();
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
        setTab("voice")
        if (status === "recording" || status === "processing") return;
        setTimeLeft(30);
        startRecording();
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
    };

    return (
        <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black flex flex-col items-center justify-center">
            <audio
                ref={audioRef}
                onEnded={handleAudioEnd}
                onPlay={() => setIsAudioPlaying(true)}
            >
                <source src={instructionAudio} type="audio/mpeg" />
                Your browser does not support the audio element.
            </audio>
            {/* Background */}
            <div
                className="absolute inset-0 bg-center bg-cover z-0 opacity-50"
                style={{ backgroundImage: `url(${bg1})` }}
            />

            {/* Content Container */}
            {
                tab === "start" ? (
                    <VoiceTextScreen t={t} handleStart={handleStart} audioRef={audioRef} handleAudioEnd={handleAudioEnd} isAudioPlaying={isAudioPlaying} status={status} instructionAudio={instructionAudio} />
                ) : (
                    <VoiceImageScreen timeLeft={timeLeft} status={status} />
                )
            }
        </div>
    );
};

export default VoiceCapture;