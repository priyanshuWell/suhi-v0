import { RotateCcw, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const ReplayAudio = ({ playAudio, className }) => {
    const { t } = useTranslation();
    return (
        <button
            onClick={playAudio}
            className={`${className} flex items-center gap-3 px-6 py-3 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 active:scale-95 transition-all text-white group`}
        >
            <RotateCcw size={40} className="group-hover:scale-110 transition-transform " />
            {/* <span className="text-xl font-mono uppercase tracking-wider">{t('common.replay')}</span> */}
        </button>
    )
}

export default ReplayAudio;