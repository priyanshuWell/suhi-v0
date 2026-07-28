import textbgframe from "../../assets/textbgframe.svg";
import React from "react";
export const ContinueWithShoesModal = ({ onYes, onNo, t }) => {
    const [remaining, setRemaining] = React.useState(10);
    const firedRef = React.useRef(false);
    const intervalRef = React.useRef(null);

    const fireNo = () => {
        if (firedRef.current) return;
        firedRef.current = true;
        clearInterval(intervalRef.current);
        onNo?.();
    };
    const fireYes = () => {
        if (firedRef.current) return;
        firedRef.current = true;
        clearInterval(intervalRef.current);
        onYes?.();
    };

    React.useEffect(() => {
        intervalRef.current = setInterval(() => {
            setRemaining((p) => {
                if (p <= 1) { clearInterval(intervalRef.current); setTimeout(fireNo, 0); return 0; }
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
                        Do you want to continue with shoes?
                    </h2>
                    <p className="text-white/60 font-anta text-2xl">Auto-continuing in {remaining}s…</p>
                    <div className="flex gap-10">
                        <button onClick={fireNo}
                            className="w-[220px] h-[90px] rounded-[30px] border-2 border-white/30 bg-white/5 backdrop-blur-sm text-white text-2xl font-anta hover:bg-white/10 active:scale-[0.98] transition-all duration-200">
                            🦶 No
                        </button>
                        <button onClick={fireYes}
                            className="w-[220px] h-[90px] rounded-[30px] border-2 border-white/50 bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)] shadow-[0px_0px_30px_rgba(0,179,255,0.5)] text-white text-2xl font-anta hover:border-white active:scale-[0.98] transition-all duration-200">
                            👟 Yes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
