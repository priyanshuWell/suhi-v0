import React, { useEffect, useRef, useState } from "react";

// const RADIUS = 100;
// const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const SIZE = 139;
const CENTER = 69.5;
const RADIUS = 58.38; // (69.5 - 11.12 from your SVG path)
const STROKE = 18; // approx visual thickness
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const CircularTimer = ({ timerSeconds = 10, onExpire, currentPlate }) => {
    const [progress, setProgress] = useState(0);
    const requestRef = useRef();
    const startTimeRef = useRef();

    useEffect(() => {
        startTimeRef.current = null;
        setProgress(0);
    }, [currentPlate, timerSeconds]);

    useEffect(() => {
        const duration = timerSeconds * 1000;

        const animate = (timestamp) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp;
            const elapsed = timestamp - startTimeRef.current;
            const progressValue = Math.min(elapsed / duration, 1);
            setProgress(progressValue);

            if (progressValue < 1) {
                requestRef.current = requestAnimationFrame(animate);
            } else {
                onExpire?.();
            }
        };

        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [timerSeconds, currentPlate, onExpire]);

    const dashOffset = CIRCUMFERENCE * (1 - progress);
    const knobAngle = progress * 360;
    const timeLeft = Math.ceil(timerSeconds * (1 - progress));
    const formatTime = (s) => String(s).padStart(2, "0");

    return (
        <div className="relative flex flex-col items-center justify-center gap-6">
            <div className="relative w-[150px] h-[150px] flex items-center justify-center">
                {/* <svg width="150" height="150" viewBox="0 0 404 404">

                    <circle
                        cx="202"
                        cy="202"
                        r={RADIUS}
                        stroke="#DDF5FF"
                        strokeWidth="32"
                        fill="none"
                    />

                    <circle
                        cx="202"
                        cy="202"
                        r={RADIUS}
                        stroke="#094EC6"
                        strokeWidth="32"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={dashOffset}
                        transform="rotate(-90 202 202)"
                    />

                    {progress > 0 && (
                        <g transform={`rotate(${knobAngle - 90} 202 202)`}>
                            <circle cx="202" cy="16" r="10" fill="#094EC6" />
                        </g>
                    )}

                </svg> */}
                <svg width="139" height="139" viewBox="0 0 139 139">

                    {/* Track */}
                    <circle
                        cx={CENTER}
                        cy={CENTER}
                        r={RADIUS}
                        stroke="#DDF5FF"
                        strokeWidth={STROKE}
                        fill="none"
                    />

                    {/* Progress arc */}
                    <circle
                        cx={CENTER}
                        cy={CENTER}
                        r={RADIUS}
                        stroke="#094EC6"
                        strokeWidth={STROKE}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={dashOffset}
                        transform={`rotate(-90 ${CENTER} ${CENTER})`}
                    />

                    {/* Knob */}
                    {progress > 0 && (
                        <g transform={`rotate(${knobAngle - 90} ${CENTER} ${CENTER})`}>
                            <circle cx={CENTER} cy={CENTER - RADIUS} r="6" fill="#094EC6" />
                        </g>
                    )}

                </svg>

                {/* Countdown number */}
                <span className="absolute text-4xl font-mono text-white">
                    {formatTime(timeLeft)}
                </span>
            </div>
        </div>
    );
};

export default CircularTimer;