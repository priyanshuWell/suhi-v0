import beAwareBg from "../../../assets/smoothie/be_aware_with_text.png"
import { useTranslation } from "react-i18next"

const FRAME_W = 1167
const FRAME_H = 1588
const pctTop = (px) => `${(px / FRAME_H) * 100}%`
const cqw = (px) => `${(px / FRAME_W) * 100}cqw`

export default function BeAware() {
    const { t } = useTranslation()
    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                margin: "0 auto",
                aspectRatio: `${FRAME_W} / ${FRAME_H}`,
                containerType: "inline-size",
                fontFamily: "'Anton', sans-serif"
            }}
        >
            <link
                rel="stylesheet"
                href="https://fonts.googleapis.com/css2?family=Anton&display=swap"
            />

            {/* Background art (banner, timer, fruit board, mango/✕, -2 all baked in) */}
            <img
                src={beAwareBg}
                alt="Be aware"
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    pointerEvents: "none"
                }}
            />

            {/* BE AWARE (banner title overlay, matches the baked-in ribbon text) */}
            {/* <p
                style={{
                    position: "absolute",
                    left: "50%",
                    top: pctTop(150),
                    transform: "translate(-50%, -50%) rotate(-1.5deg)",
                    margin: 0,
                    width: "78%",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    color: "#FFFFFF",
                    fontSize: cqw(58),
                    letterSpacing: "1px",
                    textShadow: [
                        "-2px -2px 0 #3B1E63", "2px -2px 0 #3B1E63",
                        "-2px 2px 0 #3B1E63", "2px 2px 0 #3B1E63",
                        "0 -2.5px 0 #3B1E63", "0 2.5px 0 #3B1E63",
                        "-2.5px 0 0 #3B1E63", "2.5px 0 0 #3B1E63",
                        "0 4px 0 #2A1548",
                        "0 8px 10px rgba(0,0,0,0.45)",
                    ].join(", "),
                }}
            >
                BE AWARE
            </p> */}

            {/* "20s" — centered inside the stopwatch dial face */}
            <p
                style={{
                    position: "absolute",
                    left: `${(291 / FRAME_W) * 100}%`,
                    top: pctTop(700),
                    transform: "translate(-50%, -50%)",
                    margin: 0,
                    whiteSpace: "nowrap",
                    color: "#F98FD1",
                    fontSize: cqw(100),
                    letterSpacing: "0.5px",
                    textShadow: "0 0 18px rgba(249,143,209,0.65)"
                }}
            >
                {t("smoothieSlash.beAware.timer")}
            </p>

            {/* Top-right block — left-aligned, right of the stopwatch:
          "Recipe changes every" / "20 seconds!" */}
            <div
                style={{
                    position: "absolute",
                    left: `${(497 / FRAME_W) * 100}%`,
                    top: pctTop(599),
                    margin: 0,
                    width: `${((1005 - 497) / FRAME_W) * 100}%`,
                    textAlign: "left"
                }}
            >
                <p
                    style={{
                        margin: 0,
                        color: "#FFFFFF",
                        fontSize: cqw(42),
                        lineHeight: 1.35,
                        letterSpacing: "0.35px"
                    }}
                >
                    {t("smoothieSlash.beAware.recipe_changes_every")}
                </p>
                <p
                    style={{
                        margin: 0,
                        color: "#F5E600",
                        fontSize: cqw(46),
                        lineHeight: 1.35,
                        letterSpacing: "0.35px"
                    }}
                >
                    {t("smoothieSlash.beAware.twenty_seconds")}
                </p>
            </div>

            {/* Bottom-left block — left-aligned, above/left of the mango icon:
          "Cutting the wrong" / "fruits cost points" */}
            <div
                style={{
                    position: "absolute",
                    left: `${(443 / FRAME_W) * 100}%`,
                    top: pctTop(1086),
                    margin: 0,
                    width: `${((963 - 443) / FRAME_W) * 100}%`,
                    textAlign: "left"
                }}
            >
                <p
                    style={{
                        margin: 0,
                        color: "#FFFFFF",
                        fontSize: cqw(42),
                        lineHeight: 1.35,
                        letterSpacing: "0.35px"
                    }}
                >
                    {t("smoothieSlash.beAware.cutting_wrong")}
                </p>
                <p
                    style={{
                        margin: 0,
                        color: "#FFFFFF",
                        fontSize: cqw(42),
                        lineHeight: 1.35,
                        letterSpacing: "0.35px"
                    }}
                >
                    {t("smoothieSlash.beAware.fruits_cost")}{" "}
                    <span style={{ color: "#F98787" }}>
                        {t("smoothieSlash.beAware.cost_points")}
                    </span>
                </p>
            </div>
        </div>
    )
}
