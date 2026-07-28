
import textbgframe from "../../assets/textbgframe.svg";
import React from "react";
export const PressStartModal = ({ timeoutSecs = 30, onStart }) => {
    const [remaining, setRemaining] = React.useState(timeoutSecs);
    const firedRef = React.useRef(false);
    const intervalRef = React.useRef(null);

    const fireStart = () => {
        if (firedRef.current) return;
        firedRef.current = true;
        clearInterval(intervalRef.current);
        onStart?.();
    };

    React.useEffect(() => {
        intervalRef.current = setInterval(() => {
            setRemaining((p) => {
                if (p <= 1) { clearInterval(intervalRef.current); return 0; }
                return p - 1;
            });
        }, 1000);
        return () => clearInterval(intervalRef.current);
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="relative w-screen" style={{ filter: 'drop-shadow(0px 0px 40px rgba(139,195,229,0.4))' }}>
                <img src={textbgframe} alt="" className="w-full h-full block" draggable={false} />
                <div className="absolute flex flex-col items-center justify-center gap-8"
                    style={{ top: '14%', bottom: '20%', left: '14%', right: '14%' }}>
                    <h2 className="text-[#8BC3E5] text-[40px] font-anta text-center m-0">
                        Remove your socks and shoes,<br />then press Start.
                    </h2>
                    <p className="text-white/60 font-anta text-2xl">{remaining}s remaining</p>
                    <button onClick={fireStart}
                        className="w-[clamp(18rem,30vw,28rem)] h-[clamp(4rem,8vh,6rem)] rounded-[30px] border-2 border-white/50 bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)] shadow-[0px_0px_30px_rgba(0,179,255,0.5)] text-white text-3xl font-anta hover:border-white active:scale-[0.98] transition-all duration-200">
                        Start
                    </button>
                </div>
            </div>
        </div>
    );
};