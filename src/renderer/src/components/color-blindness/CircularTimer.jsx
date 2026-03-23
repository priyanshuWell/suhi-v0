import React, { useEffect, useRef, useState, useCallback } from "react";

const RADIUS = 186;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const CircularTimer = ({ timerSeconds = 10, onExpire, currentPlate }) => {
    const [timeLeft, setTimeLeft] = useState(timerSeconds);
    const timerRef = useRef(null);

    useEffect(() => {
        setTimeLeft(timerSeconds);
    }, [currentPlate, timerSeconds]);

    useEffect(() => {
        if (timeLeft <= 0) {
            onExpire?.();
            return;
        }
        timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
        return () => clearTimeout(timerRef.current);
    }, [timeLeft, onExpire]);

    const dashOffset = CIRCUMFERENCE * (1 - timeLeft / timerSeconds);

    const knobAngle = ((timerSeconds - timeLeft) / timerSeconds) * 360 - 90;

    const formatTime = (s) => String(s).padStart(2, "0");

    return (
        <div className="relative flex flex-col items-center justify-center gap-6">
            <div className="relative w-[180px] h-[180px] flex items-center justify-center">
                <svg
                    width="180"
                    height="180"
                    viewBox="0 0 404 404"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <radialGradient
                            id="paint0_radial_7767_5563"
                            cx="0"
                            cy="0"
                            r="1"
                            gradientUnits="userSpaceOnUse"
                            gradientTransform="translate(62.5 -140) rotate(37.3605) scale(268.61)"
                        >
                            <stop stopColor="white" />
                            <stop offset="1" stopColor="#094EC6" />
                        </radialGradient>
                    </defs>

                    {/* Static track background ring */}
                    <path
                        d="M404 202C404 313.561 313.561 404 202 404C90.4385 404 0 313.561 0 202C0 90.4385 90.4385 0 202 0C313.561 0 404 90.4385 404 202ZM32.32 202C32.32 295.712 108.288 371.68 202 371.68C295.712 371.68 371.68 295.712 371.68 202C371.68 108.288 295.712 32.32 202 32.32C108.288 32.32 32.32 108.288 32.32 202Z"
                        fill="#DDF5FF"
                    />

                    {/* Animated progress arc */}
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
                        style={{ transition: "stroke-dashoffset 1s linear" }}
                    />

                    {/* Rotating knob dot */}
                    <g
                        transform={`rotate(${knobAngle + 90} 202 202)`}
                        style={{ transition: "transform 1s linear" }}
                    >
                        <path
                            d="M202 16.16C202 7.2351 209.246 -0.0671478 218.143 0.646078C219.372 0.744589 220.6 0.85436 221.826 0.975363C230.708 1.85137 236.545 10.3231 234.962 19.1065L234.779 20.1224C233.297 28.3448 225.429 33.7378 217.108 32.9939C208.786 32.2501 202 25.5471 202 17.1923L202 16.16Z"
                            fill="url(#paint0_radial_7767_5563)"
                        />
                    </g>
                </svg>

                {/* Countdown number */}
                <span className="absolute text-4xl font-mono text-white tracking-widest">
                    {formatTime(timeLeft)}
                </span>
            </div>
        </div>
    );
};

export default CircularTimer;