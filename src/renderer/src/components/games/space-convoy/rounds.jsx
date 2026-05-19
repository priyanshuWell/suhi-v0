// rounds.js — Improved progression with better game feel
// Key changes:
//  • Smoother velocity curve (no sudden jumps between rounds)
//  • Preparation time increases with difficulty (more time to memorize harder rounds)
//  • Freeze time scales down slightly at high rounds (adds pressure)
//  • Game time ramps more gradually
//  • Radius bottoms out at 32 so particles remain tappable on mobile

export const ROUNDS = {
    round1: {
        name: "Round 1",
        particles: 8, targets: 3, radius: 58,
        velocity: { min: 0.8, max: 1.1 },
        time: { preparation: 2000, game: 4000, freeze: 9000 },
        // Feel hint used by SpaceConvoy to drive visual feedback intensity
        difficultyTier: 1,
    },
    round2: {
        name: "Round 2",
        particles: 10, targets: 4, radius: 56,
        velocity: { min: 1.0, max: 1.4 },
        time: { preparation: 2000, game: 4500, freeze: 8500 },
        difficultyTier: 1,
    },
    round3: {
        name: "Round 3",
        particles: 12, targets: 5, radius: 54,
        velocity: { min: 1.3, max: 1.7 },
        time: { preparation: 1800, game: 5000, freeze: 8500 },
        difficultyTier: 2,
    },
    round4: {
        name: "Round 4",
        particles: 13, targets: 6, radius: 52,
        velocity: { min: 1.6, max: 2.0 },
        time: { preparation: 1800, game: 5000, freeze: 8000 },
        difficultyTier: 2,
    },
    round5: {
        name: "Round 5",
        particles: 15, targets: 7, radius: 50,
        velocity: { min: 1.9, max: 2.4 },
        time: { preparation: 1800, game: 5500, freeze: 8000 },
        difficultyTier: 2,
    },
    round6: {
        name: "Round 6",
        particles: 17, targets: 8, radius: 46,
        velocity: { min: 2.2, max: 2.7 },
        time: { preparation: 1600, game: 5500, freeze: 7500 },
        difficultyTier: 3,
    },
    FINAL: {
        name: "Final Round",
        particles: 19, targets: 9, radius: 42,
        velocity: { min: 2.5, max: 3.1 },
        time: { preparation: 1600, game: 6000, freeze: 7500 },
        difficultyTier: 3,
    },
    // round8: {
    //     name: "Round 8",
    //     particles: 21, targets: 10, radius: 38,
    //     velocity: { min: 2.8, max: 3.4 },
    //     time: { preparation: 1500, game: 6500, freeze: 7000 },
    //     difficultyTier: 3,
    // },
    // round9: {
    //     name: "Round 9",
    //     particles: 23, targets: 11, radius: 35,
    //     velocity: { min: 3.0, max: 3.6 },
    //     time: { preparation: 1500, game: 6500, freeze: 7000 },
    //     difficultyTier: 4,
    // },
    // round10: {
    //     name: "Round 10",
    //     particles: 25, targets: 12, radius: 32,
    //     velocity: { min: 3.2, max: 3.8 },
    //     time: { preparation: 1500, game: 7000, freeze: 6500 },
    //     difficultyTier: 4,
    // },
};