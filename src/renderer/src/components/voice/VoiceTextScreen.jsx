import React from 'react'

const VoiceTextScreen = ({ t, handleStart, audioRef, handleAudioEnd, isAudioPlaying, status, instructionAudio }) => {
    return (
        <div className="relative z-10 flex flex-col items-center justify-center mb-24 w-full max-w-4xl h-full gap-8 p-4">

            {/* Header Text */}
            <h1 className="text-white/90 text-center text-xl portrait:text-4xl font-mono leading-relaxed max-w-2xl mb-20">
                {t('voice.instruction')}
            </h1>

            {/* Image Container */}




            {/* Start Button - Hide when recording or processing, Disable when audio playing */}
            {status !== 'recording' && status !== 'processing' && (
                <button
                    onClick={handleStart}
                    // disabled={isAudioPlaying}
                    className={`
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
                  ${isAudioPlaying ? 'opacity-50 cursor-not-allowed' : 'opacity-100 cursor-pointer'}
                `}
                >
                    {t('voice.start')}
                </button>
            )}

        </div>
    )
}

export default VoiceTextScreen  