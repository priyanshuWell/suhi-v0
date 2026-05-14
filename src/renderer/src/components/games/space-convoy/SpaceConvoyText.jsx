import textframe from "../../../assets/textFrame.png"
import BlueGradientButton from '../../ui/BlueGradientButton'
import { useTranslation } from "react-i18next"

export function SpaceConvoyText({ onStartDemo }) {
    const { t } = useTranslation()

    return (
        <div className="relative z-10 flex flex-col gap-14 items-center justify-center w-full h-full">
            <div className="relative flex flex-col items-center justify-center h-16 w-full text-center">
                <img src={textframe} alt="text-frame" className="absolute top-0 w-1/2" />
                <p className="text-white portrait:text-[32px] tracking-wider z-10">
                    {t('spaceConvoy.title')}
                </p>
                <img src={textframe} alt="text-frame" className="absolute bottom-0 rotate-180 w-1/2" />
            </div>

            <h1 className="text-white/90 text-center text-lg leading-tight portrait:text-4xl font-mono max-w-lg">
                {t('spaceConvoy.instruction')}
            </h1>

            <BlueGradientButton className="text-2xl" onClick={onStartDemo}>
                {t('spaceConvoy.start')}
            </BlueGradientButton>
        </div>
    )
}