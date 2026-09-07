// Shared design tokens for Perilous Path screens.
// Colors were sampled directly from the Figma exports so every screen stays
// visually consistent. Import from here instead of re-hardcoding hex values.

export const COLORS = {
    cyan: "#29e1f5", // headings, "Start", primary CTA text
    magenta: "#fb55fb", // "End", "win!", secondary accents
    danger: "#ea4064", // "dangerous", hazard states
    white: "#ffffff"
}

// Stage aspect ratio every Perilous Path screen is designed against.
// Keep every screen on this ratio so they can be swapped/stacked without
// layout shifts.
export const STAGE_ASPECT = { width: 1080, height: 1920 }

// Style object for the root stage wrapper: locks a 9:16 frame, letterboxes
// on other viewport ratios, and enables cqw/cqh container-query units so
// every descendant measurement (font sizes, gaps) scales with the stage
// instead of the browser viewport.
export const stageStyle = {
    width: "min(100vw, calc(100vh * 9 / 16))",
    height: "min(100vh, calc(100vw * 16 / 9))",
    containerType: "size"
}
