import howToPlayBg from "../../../assets/smoothie/how_to_play_with_text.png";
import { useTranslation } from 'react-i18next';



const FRAME_W = 991;
const FRAME_H = 1588;
const pctTop = (px) => `${(px / FRAME_H) * 100}%`;
const cqw = (px) => `${(px / FRAME_W) * 100}cqw`;

export default function HowToPlay() {
    const { t } = useTranslation();
    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                margin: "0 auto",
                aspectRatio: `${FRAME_W} / ${FRAME_H}`,
                containerType: "inline-size",
                fontFamily: "'Anton', sans-serif",
            }}
        >
            <link
                rel="stylesheet"
                href="https://fonts.googleapis.com/css2?family=Anton&display=swap"
            />

            {/* Background art */}
            <img
                src={howToPlayBg}
                alt="How to play"
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    pointerEvents: "none",
                }}
            />

            {/* WHAT TO DO? */}
            <p
                style={{
                    position: "absolute",
                    left: "50%",
                    top: pctTop(524),
                    transform: "translate(-50%, -50%)",
                    margin: 0,
                    width: "100%",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    color: "#F5E600",
                    fontSize: cqw(48),
                    letterSpacing: "0.35px",
                }}
            >
                {t('smoothieSlash.howToPlay.what_to_do')}
            </p>

            {/* Let's Make a Yummy Smoothie! */}
            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: pctTop(694),
                    transform: "translate(-50%, -50%)",
                    margin: 0,
                    width: "100%",
                    textAlign: "center",
                    fontSize: cqw(48),
                    letterSpacing: "0.35px",
                    lineHeight: 1.15,
                }}
            >
                <p style={{ margin: 0 }}>
                    <span style={{ color: "#FFFFFF" }}>{t('smoothieSlash.howToPlay.lets_make_a')} </span>
                    <span style={{ color: "#CAE808" }}>{t('smoothieSlash.howToPlay.yummy')}</span>
                </p>
                <p style={{ margin: 0, color: "#CAE808" }}>{t('smoothieSlash.howToPlay.smoothie')}</p>
            </div>

            {/* RECIPE CARD */}
            <p
                style={{
                    position: "absolute",
                    left: "50%",
                    top: pctTop(895),
                    transform: "translate(-50%, -50%)",
                    margin: 0,
                    width: "100%",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    color: "#FFFFFF",
                    fontSize: cqw(40),
                    letterSpacing: "0.35px",
                }}
            >
                {t('smoothieSlash.howToPlay.recipe_card_label')}
            </p>

            {/* Bottom explainer paragraph */}
            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: pctTop(1394),
                    transform: "translate(-50%, -50%)",
                    margin: 0,
                    width: "100%",
                    textAlign: "center",
                    color: "#FFFFFF",
                    fontSize: cqw(40),
                    letterSpacing: "0.35px",
                    lineHeight: 1.25,
                }}
            >
                <p style={{ margin: 0 }}>
                    {t('smoothieSlash.howToPlay.desc_line1')} <span style={{ color: "#F5E600" }}>{t('smoothieSlash.howToPlay.desc_recipe')}</span> {t('smoothieSlash.howToPlay.desc_line1_suffix')}
                </p>
                <p style={{ margin: 0 }}>
                    {t('smoothieSlash.howToPlay.desc_line2_prefix')} <span style={{ color: "#DC87F9" }}>{t('smoothieSlash.howToPlay.desc_recipe_card')}</span> {t('smoothieSlash.howToPlay.desc_line2_suffix')}
                </p>
                <p style={{ margin: 0 }}>{t('smoothieSlash.howToPlay.desc_line3')}</p>
            </div>
        </div>
    );
}