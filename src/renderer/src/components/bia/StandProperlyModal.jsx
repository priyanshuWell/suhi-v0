
import React from "react";
export const StandProperlyModal = ({ countdown }) => {
    const urgent = countdown <= 3;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)' }}>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '32px',
                animation: 'standProperlyFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>

                {/* Animated silhouette figure */}
                <div style={{ position: 'relative', width: '180px', height: '260px' }}>
                    {/* Glow ring behind figure — breathes slowly, like a calm cue rather than urgency */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(139,195,229,0.2) 0%, transparent 70%)',
                        animation: 'standGlowPulse 3.2s cubic-bezier(0.45, 0, 0.55, 1) infinite',
                    }} />

                    {/* Concentric alignment rings that slowly contract inward, reinforcing "settle into position" */}
                    <svg viewBox="0 0 120 200" width="180" height="260" style={{ position: 'absolute', inset: 0 }}>
                        <ellipse cx="60" cy="130" rx="46" ry="60" fill="none" stroke="rgba(139,195,229,0.12)" strokeWidth="1.5"
                            style={{ animation: 'ringSettle 3.2s cubic-bezier(0.45, 0, 0.55, 1) infinite' }} />
                    </svg>

                    {/* SVG standing figure — smoother human silhouette, breathes gently in place */}
                    <svg viewBox="0 0 120 200" width="180" height="260" xmlns="http://www.w3.org/2000/svg"
                        style={{
                            filter: 'drop-shadow(0 0 18px rgba(139,195,229,0.7))',
                            animation: 'standBreathe 3.2s cubic-bezier(0.45, 0, 0.55, 1) infinite',
                            transformOrigin: '60px 160px',
                        }}>
                        <defs>
                            <linearGradient id="bodyGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8BC3E5" stopOpacity="0.95" />
                                <stop offset="100%" stopColor="#4d97c4" stopOpacity="0.9" />
                            </linearGradient>
                        </defs>

                        {/* Head — slightly egg-shaped rather than a perfect circle */}
                        <path d="M60,6 C69,6 75,13 75,23 C75,33 69,41 60,41 C51,41 45,33 45,23 C45,13 51,6 60,6 Z"
                            fill="url(#bodyGradient)" />
                        {/* Neck */}
                        <path d="M53,38 C53,38 53,46 53,48 L67,48 C67,46 67,38 67,38 Z" fill="#7ab5dd" opacity="0.9" />

                        {/* Torso — tapered: broader shoulders, narrower waist, slight hip flare */}
                        <path d="
                            M40,58
                            C40,50 48,47 60,47
                            C72,47 80,50 80,58
                            L78,96
                            C78,104 70,110 60,110
                            C50,110 42,104 42,96
                            Z"
                            fill="url(#bodyGradient)" />

                        {/* Left arm — resting at side, tapered shoulder-to-wrist, subtle settle motion */}
                        <path d="
                            M41,54
                            C34,55 29,62 28,72
                            C27,82 27,92 29,101
                            C29.5,103 33,103.5 33.5,101
                            C34,92 34,82 35,73
                            C35.7,65 38,58 43,56
                            Z"
                            fill="#7ab5dd" opacity="0.9"
                            style={{ transformOrigin: '38px 56px', animation: 'armSettleLeft 3.2s cubic-bezier(0.45, 0, 0.55, 1) infinite' }} />

                        {/* Right arm — mirrored */}
                        <path d="
                            M79,54
                            C86,55 91,62 92,72
                            C93,82 93,92 91,101
                            C90.5,103 87,103.5 86.5,101
                            C86,92 86,82 85,73
                            C84.3,65 82,58 77,56
                            Z"
                            fill="#7ab5dd" opacity="0.9"
                            style={{ transformOrigin: '82px 56px', animation: 'armSettleRight 3.2s cubic-bezier(0.45, 0, 0.55, 1) infinite' }} />

                        {/* Left leg — tapered thigh to ankle */}
                        <path d="
                            M44,103
                            C43,120 42,140 43,158
                            C43.2,161 51,161 51,158
                            C51.5,140 52,120 53,104
                            Z"
                            fill="url(#bodyGradient)" />

                        {/* Right leg — mirrored */}
                        <path d="
                            M76,103
                            C77,120 78,140 77,158
                            C76.8,161 69,161 69,158
                            C68.5,140 68,120 67,104
                            Z"
                            fill="url(#bodyGradient)" />

                        {/* Left foot */}
                        <path d="M38,159 C38,156 47,155 51,157 C54,158.5 54,162 51,163 L40,163 C37.5,163 37,161 38,159 Z"
                            fill="#4d97c4" opacity="0.95" />
                        {/* Right foot */}
                        <path d="M82,159 C82,156 73,155 69,157 C66,158.5 66,162 69,163 L80,163 C82.5,163 83,161 82,159 Z"
                            fill="#4d97c4" opacity="0.95" />

                        {/* Posture alignment arrows — pointing up on each side, softer stagger */}
                        <g style={{ animation: 'arrowPulse 2.4s cubic-bezier(0.45, 0, 0.55, 1) infinite' }}>
                            <polygon points="10,90 16,110 4,110" fill="#FFD700" opacity="0.85" />
                            <rect x="11" y="110" width="6" height="30" rx="3" fill="#FFD700" opacity="0.75" />
                        </g>
                        <g style={{ animation: 'arrowPulse 2.4s cubic-bezier(0.45, 0, 0.55, 1) infinite 0.6s' }}>
                            <polygon points="110,90 116,110 104,110" fill="#FFD700" opacity="0.85" />
                            <rect x="105" y="110" width="6" height="30" rx="3" fill="#FFD700" opacity="0.75" />
                        </g>
                    </svg>
                </div>

                {/* Instruction text */}
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{
                        color: '#8BC3E5',
                        fontSize: '2.4rem',
                        fontFamily: 'Anta, sans-serif',
                        margin: 0,
                        letterSpacing: '0.02em',
                        textShadow: '0 0 20px rgba(139,195,229,0.6)',
                    }}>
                        Stand Straight &amp; Still
                    </h2>
                    <p style={{
                        color: 'rgba(255,255,255,0.7)',
                        fontFamily: 'Anta, sans-serif',
                        fontSize: '1.2rem',
                        marginTop: '8px',
                    }}>
                        Keep your arms at your sides and look forward
                    </p>
                </div>

                {/* Countdown ring — shifts to a warmer color as time runs low, for a gentle urgency cue */}
                <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                    <svg viewBox="0 0 80 80" width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(139,195,229,0.15)" strokeWidth="6" />
                        <circle
                            cx="40" cy="40" r="34"
                            fill="none"
                            stroke={urgent ? '#FFD700' : '#8BC3E5'}
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 34}`}
                            strokeDashoffset={`${2 * Math.PI * 34 * (countdown / 10)}`}
                            style={{
                                transition: 'stroke-dashoffset 0.9s cubic-bezier(0.45, 0, 0.55, 1), stroke 0.4s ease',
                                filter: urgent ? 'drop-shadow(0 0 10px #FFD700)' : 'drop-shadow(0 0 8px #8BC3E5)',
                            }}
                        />
                    </svg>
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: urgent ? '#FFD700' : '#8BC3E5',
                        fontSize: '1.6rem',
                        fontFamily: 'Anta, sans-serif',
                        fontWeight: 'bold',
                        transition: 'color 0.4s ease',
                        animation: urgent ? 'countdownTick 1s ease-in-out infinite' : 'none',
                    }}>
                        {countdown}
                    </div>
                </div>

                <p style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Anta, sans-serif', fontSize: '1rem', margin: 0 }}>
                    Retrying in {countdown}s…
                </p>
            </div>

            {/* Keyframe animations injected via a style tag */}
            <style>{`
        @keyframes standProperlyFadeIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes standGlowPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.1); }
        }
        @keyframes ringSettle {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%       { opacity: 0.9; transform: scale(0.96); }
        }
        @keyframes standBreathe {
          0%, 100% { transform: scaleY(1) scaleX(1); }
          50%       { transform: scaleY(1.015) scaleX(0.995); }
        }
        @keyframes armSettleLeft {
          0%, 100% { transform: rotate(0deg); }
          50%       { transform: rotate(-1.5deg); }
        }
        @keyframes armSettleRight {
          0%, 100% { transform: rotate(0deg); }
          50%       { transform: rotate(1.5deg); }
        }
        @keyframes arrowPulse {
          0%, 100% { opacity: 0.5; transform: translateY(0px); }
          50%       { opacity: 1;   transform: translateY(-6px); }
        }
        @keyframes countdownTick {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.12); }
        }
      `}</style>
        </div>
    );
};