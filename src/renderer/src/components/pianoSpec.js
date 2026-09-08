/**
 * Piano keybed geometry — the single source of truth, in 1:1 CSS pixels for a
 * 1080-wide window. Piano.css mirrors these as custom properties; anything that
 * needs to place or measure the bed reads them from here.
 */
export const PIANO_SPEC = {
    pitch: 192,
    whiteW: 166,
    whiteH: 313,
    blackW: 81,
    blackH: 184,
    padX: 52,
    padT: 36,
    padB: 60,
    get keysW() {
        return this.pitch * 4 + this.whiteW
    },
    get frameW() {
        return this.keysW + this.padX * 2
    },
    get frameH() {
        return this.whiteH + this.padT + this.padB
    },
    get gap() {
        return this.pitch - this.whiteW
    },
    /** black key left = pitch·(n+1) − blackOffset */
    get blackOffset() {
        return (this.pitch - this.whiteW + this.blackW) / 2
    }
}
