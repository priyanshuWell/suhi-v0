import howToDoBg from "../../../assets/smoothie/how_to_do.png";
import { useTranslation } from 'react-i18next';


const FRAME_W = 1072;
const FRAME_H = 1467;
const pct = (px, total) => `${(px / total) * 100}%`;
const cqw = (px) => `${(px / FRAME_W) * 100}cqw`;

export default function HowToDoNew() {
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

            {/* Background art (banner, blender, kiwi-slice, mango x2, ✓, ✕ all baked in) */}
            <img
                src={howToDoBg}
                alt="How to do"
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    pointerEvents: "none",
                }}
            />

            {/* Row 1 — right of the kiwi slice:
          "See a fruit on the / Recipe Card?" / "Slice it!" */}
            <div
                style={{
                    position: "absolute",
                    left: pct(471, 1146),
                    top: pct(521, 1575),
                    width: pct(491, 1146),
                    textAlign: "left",
                }}
            >
                <p style={{ margin: 0, color: "#FFFFFF", fontSize: cqw(38), lineHeight: 1.3, letterSpacing: "0.35px" }}>
                    {t('smoothieSlash.howToDo.row1_line1')}
                </p>
                <p style={{ margin: 0, color: "#FFFFFF", fontSize: cqw(38), lineHeight: 1.3, letterSpacing: "0.35px" }}>
                    {t('smoothieSlash.howToDo.row1_line2')}
                </p>
                <p style={{ margin: "4px 0 0", color: "#CAE808", fontSize: cqw(54), letterSpacing: "0.35px" }}>
                    {t('smoothieSlash.howToDo.row1_cta')}
                </p>
            </div>

            {/* Row 2 — left of the ✕ badge:
          "Fruit NOT on the" / "Recipe Card?" */}
            <div
                style={{
                    position: "absolute",
                    left: pct(511, 1146),
                    top: pct(923, 1575),
                    width: pct(368, 1146),
                    textAlign: "left",
                }}
            >
                <p style={{ margin: 0, color: "#FFFFFF", fontSize: cqw(38), lineHeight: 1.35, letterSpacing: "0.35px" }}>
                    {t('smoothieSlash.howToDo.row2_line1_prefix')} <span style={{ color: "#F98FD1" }}>{t('smoothieSlash.howToDo.row2_line1_not')}</span> {t('smoothieSlash.howToDo.row2_line1_suffix')}
                </p>
                <p style={{ margin: 0, color: "#F5E600", fontSize: cqw(38), lineHeight: 1.35, letterSpacing: "0.35px" }}>
                    {t('smoothieSlash.howToDo.row2_line2')}
                </p>
            </div>

            {/* Row 3 — left of the flying mango:
          "Don't touch it" / "Let it fly past!" */}
            <div
                style={{
                    position: "absolute",
                    left: pct(175, 1146),
                    top: pct(1250, 1575),
                    width: pct(330, 1146),
                    textAlign: "left",
                }}
            >
                <p style={{ margin: 0, color: "#F98FD1", fontSize: cqw(38), lineHeight: 1.35, letterSpacing: "0.35px" }}>
                    {t('smoothieSlash.howToDo.row3_line1')}
                </p>
                <p style={{ margin: 0, color: "#FFFFFF", fontSize: cqw(38), lineHeight: 1.35, letterSpacing: "0.35px" }}>
                    {t('smoothieSlash.howToDo.row3_line2')}
                </p>
            </div>
        </div>
    );
}