
import textframe from "../../../assets/textFrame.png"
import BlueGradientButton from '../../ui/BlueGradientButton'
import { useTranslation } from "react-i18next"
import bg1 from "../../../assets/lightbg.png"
import { useNavigate } from "react-router"
export function SpaceConvoyComplete({ onStartDemo }) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const handleNext = () => {
        navigate('/colorblindness')
    }
    return (
        <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black flex flex-col items-center justify-center">
            <div
                className="absolute inset-0 bg-center bg-cover z-0"
                style={{
                    backgroundImage: `url(${bg1})`,
                    opacity: 1,
                }}
            />
            <div className="relative z-10 flex flex-col gap-14 items-center justify-center w-full h-full">
                <div className="relative flex flex-col items-center justify-center h-16 w-full text-center">
                    <img src={textframe} alt="text-frame" className="absolute top-0 w-1/2" />
                    <p className="text-white portrait:text-[32px] tracking-wider z-10">
                        {t('spaceConvoy.awsomeJob')}
                    </p>
                    <img src={textframe} alt="text-frame" className="absolute bottom-0 rotate-180 w-1/2" />
                </div>

                <h1 className="text-white/90 text-center text-lg leading-tight portrait:text-4xl font-mono max-w-lg">
                    {t('spaceConvoy.complete')}
                </h1>

                <BlueGradientButton className="text-2xl" onClick={handleNext}>
                    {t('common.next')}
                </BlueGradientButton>
            </div>
        </div>
    )
}