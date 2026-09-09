/** Design frame from Figma (matches avoid-notes overlay: 1513 × 2678). */
export const FRAME_W = 1513
export const FRAME_H = 2678

export const pct = (px, axis = "y") =>
    `${(px / (axis === "x" ? FRAME_W : FRAME_H)) * 100}%`

export const cqw = (px) => `${(px / FRAME_W) * 100}cqw`

/** Neon glow shared by lane dividers + hit line */
export const NEON_GLOW = [
    "0px 0px 35px 0px #0066FFB2",
    "0px 0px 22px 0px #0077FF",
    "0px 0px 10px 0px #00D2FF",
    "0px 0px 4px 0px #C2F5FF"
].join(", ")

export const anton = {
    fontFamily: "'Anton', sans-serif",
    fontWeight: 400,
    lineHeight: 1,
    letterSpacing: 0
}

export const oswald = {
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: 0
}
