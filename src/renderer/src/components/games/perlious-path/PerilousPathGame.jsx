import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { COLORS } from "./theme"
import { perilousPathApi, rowColToTile, tileToRowCol } from "./perilouspathapi"

// ── Assets (exported straight from Figma) ──────────────────────────────────
import boardFrame from "../../../assets/perilous_path/perilous_board.png"
import timeFrame from "../../../assets/perilous_path/perilous_timer.png"
import scoreFrame from "../../../assets/perilous_path/perilous_score.png"
import endBadge from "../../../assets/perilous_path/perilous_end.png"
import startBadge from "../../../assets/perilous_path/perilous_start.png"
import tile from "../../../assets/perilous_path/perilous_block.svg"
import monsterIcon from "../../../assets/perilous_path/perilous_hazard.svg"
import connectorNode from "../../../assets/perilous_path/connector_node.png"
import levelPillFrame from "../../../assets/perilous_path/level_bar.png"
import objectiveBarFrame from "../../../assets/perilous_path/game_description.png"
import horizontalLine from "../../../assets/perilous_path/horizontal_line.svg"
import verticalLine from "../../../assets/perilous_path/vertical_line.svg"

const LAYOUT = {
    timeBadge: { left: 2, top: 4, width: 15 },
    scoreBadge: { left: 76, top: 4, width: 16 },
    levelPill: { left: 35, top: 17.5, width: 30 },
    objectiveBar: { left: 16, top: 25, width: 68 },
    board: { left: 12, top: 37.5, width: 76 },
    boardInset: { left: 9, right: 9, top: 9.5, bottom: 8 },
}

const PHASE = {
    PROBE: "probe", // hazards visible
    DELAY: "delay", // hazards hidden, response window not open yet
    RESPONSE: "response", // countdown running, taps accepted
    SUBMITTING: "submitting", // trial result in flight
}

const OBJECTIVE_TEXT = {
    [PHASE.PROBE]: "Memorize the danger tiles!",
    [PHASE.DELAY]: "Get ready…",
    [PHASE.RESPONSE]: "Trace the safe path!",
    [PHASE.SUBMITTING]: "Submitting…",
}

// How long the "+N Safe crossing" / fail banner stays up (in the objective
// bar) once a trial's result comes back, before the parent is told to load
// the next board. Mirrors RoundManager.Succeed/Fail showing a result before
// DelayedNextRound/ShowLevelCompleteAfterDelay kicks in on the CS side —
// without it, PerilousPath.jsx swaps this component out the instant the
// fetch resolves and the player never sees what they scored.
const RESULT_HOLD_MS = 900

function cellKey(row, col) {
    return `${row}-${col}`
}

function formatSeconds(total) {
    const s = Math.max(0, Math.floor(total))
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

// Orthogonal-neighbor check for the current grid: a tile can only be added
// to the trace if it sits directly up/down/left/right of wherever the path
// currently ends. This is the client-side mirror of
// GridManager.AreAdjacent(..., allowDiagonal: false) on the CS side, which
// is what PathInputController.TryAddTile gates every step on.
function areAdjacent(tileA, tileB) {
    const a = tileToRowCol(tileA)
    const b = tileToRowCol(tileB)
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
}

// Neon glow tuning for the path beam / connector nodes below. A flat line
// asset or icon reads as thin no matter how big its bounding box is — the
// reference look is built from a blurred color wash layered behind the
// real art (the standard "neon tube" trick: bloom sells the thickness,
// the crisp asset on top sells the edge). Reuses the same cyan already
// used for the Trace-phase objective text so it stays on-brand instead of
// introducing a new color no one signed off on.
const PATH_GLOW_COLOR = COLORS.cyan

// ── Path-beam geometry ───────────────────────────────────────────────────
// Must stay in sync with the grid's `gap-[3%]` class below — this lets us
// compute exact tile-center percentages without measuring the DOM.
const GRID_GAP_PCT = 0.1
const BEAM_THICKNESS_RATIO = 0.45 // fraction of a cell's own span used as beam thickness

// Percentage (0-100) span of a single cell along an axis with `count` cells.
function cellSpanPct(count) {
    return (100 - GRID_GAP_PCT * (count - 1)) / count
}

// Percentage (0-100) center position of the cell at `index` along an axis with `count` cells.
function cellCenterPct(index, count) {
    const span = cellSpanPct(count)
    return index * (span + GRID_GAP_PCT) + span / 2
}

/**
 * Builds the glowing connector beams that trace the player's path across the
 * board: one segment per adjacent hop in `pathSequence` (tile numbers, start
 * tile first). Non-adjacent hops (shouldn't normally happen now that
 * handleTileClick gates every tap on adjacency, but kept as a guard) are
 * skipped since there's no straight beam asset for them.
 *
 * Each segment always anchors its bright glow end at the *earlier* tile in
 * the hop (already-visited) and grows toward the newly-tapped tile, which is
 * what actually sells the "tracing a live path" feel.
 */
function buildPathSegments(pathSequence, rows, cols) {
    const segments = []
    for (let i = 1; i < pathSequence.length; i++) {
        const fromTile = pathSequence[i - 1]
        const toTile = pathSequence[i]
        const from = tileToRowCol(fromTile)
        const to = tileToRowCol(toTile)
        const dRow = to.row - from.row
        const dCol = to.col - from.col
        const key = `${fromTile}-${toTile}-${i}`

        if (dRow === 0 && Math.abs(dCol) === 1) {
            const flip = dCol === -1 // moving left: the already-visited tile sits on the right
            const colFrom = Math.min(from.col, to.col)
            const colTo = Math.max(from.col, to.col)
            const xFrom = cellCenterPct(colFrom, cols)
            const xTo = cellCenterPct(colTo, cols)
            const thickness = cellSpanPct(rows) * BEAM_THICKNESS_RATIO
            segments.push({
                key,
                orientation: "horizontal",
                flip,
                style: {
                    left: `${xFrom}%`,
                    top: `${cellCenterPct(from.row, rows)}%`,
                    width: `${xTo - xFrom}%`,
                    height: `${thickness}%`,
                    transform: "translateY(-50%)",
                },
            })
        } else if (dCol === 0 && Math.abs(dRow) === 1) {
            const flip = dRow === -1 // moving up: the already-visited tile sits at the bottom
            const rowFrom = Math.min(from.row, to.row)
            const rowTo = Math.max(from.row, to.row)
            const yFrom = cellCenterPct(rowFrom, rows)
            const yTo = cellCenterPct(rowTo, rows)
            const thickness = cellSpanPct(cols) * BEAM_THICKNESS_RATIO
            segments.push({
                key,
                orientation: "vertical",
                flip,
                style: {
                    left: `${cellCenterPct(from.col, cols)}%`,
                    top: `${yFrom}%`,
                    width: `${thickness}%`,
                    height: `${yTo - yFrom}%`,
                    transform: "translateX(-50%)",
                },
            })
        }
        // else: non-adjacent hop, nothing straight to draw — skip silently.
    }
    return segments
}

/**
 * One animated glowing beam connecting two adjacent tile centers.
 *
 * Built as a small stack rather than a single image, matching the reference
 * art's "energy tube" look:
 *   1. a wide, heavily-blurred wash — the soft outer bloom
 *   2. a tighter, brighter blurred core — the visible "glass" of the tube
 *   3. the original line asset on top — a crisp, defined edge
 *   4. a thin near-white filament through the center — the hot core
 * All four live inside the same scaling wrapper so the whole bundle grows
 * and retracts together. The outer motion.div owns the exit fade (so
 * AnimatePresence has something to hold onto while it plays), and the inner
 * motion.div does the grow-in / shrink-back-out via scaleX/scaleY from the
 * anchored end — this is what makes an undone step visually "unwind"
 * instead of just vanishing.
 */
function PathSegment({ orientation, flip, style }) {
    const isHorizontal = orientation === "horizontal"
    const asset = isHorizontal ? horizontalLine : verticalLine
    const transformOrigin = isHorizontal
        ? flip
            ? "right center"
            : "left center"
        : flip
            ? "center bottom"
            : "center top"

    return (
        <motion.div className="absolute" style={style} exit={{ opacity: 0 }} transition={{ duration: 0.14, ease: "easeIn" }}>
            <motion.div
                className="relative h-full w-full"
                style={{ transformOrigin }}
                initial={isHorizontal ? { scaleX: 0 } : { scaleY: 0 }}
                animate={isHorizontal ? { scaleX: 1 } : { scaleY: 1 }}
                exit={isHorizontal ? { scaleX: 0 } : { scaleY: 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
            >
                {/* Outer bloom: wide + soft */}
                <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ background: PATH_GLOW_COLOR, filter: "blur(9px)" }}
                    animate={{ opacity: [0.35, 0.6, 0.35] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
                {/* Inner bloom: brighter + tighter */}
                <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ background: PATH_GLOW_COLOR, filter: "blur(3px)" }}
                    animate={{ opacity: [0.6, 0.95, 0.6] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
                {/* Original line art on top, brightened, for a crisp defined edge */}
                <motion.img
                    src={asset}
                    alt=""
                    className="absolute inset-0 h-full w-full"
                    style={{
                        transform: flip ? (isHorizontal ? "scaleX(-1)" : "scaleY(-1)") : "none",
                        filter: "brightness(1.4) saturate(1.3)",
                    }}
                    draggable={false}
                    animate={{ opacity: [0.85, 1, 0.85] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
                {/* Hot white filament through the center */}
                <div
                    className={`absolute rounded-full bg-white/90 ${isHorizontal ? "left-0 right-0 top-1/2 h-[22%] -translate-y-1/2" : "top-0 bottom-0 left-1/2 w-[22%] -translate-x-1/2"
                        }`}
                    style={{ filter: "blur(1.5px)" }}
                />
            </motion.div>
        </motion.div>
    )
}

/** Base interactive tile button — sits at Layer 1 (behind the path line). */
function TileButton({ row, col, isHazardTapped, onClick }) {
    return (
        <motion.button
            type="button"
            data-tile={`${row}-${col}`}
            onClick={() => onClick?.(row, col)}
            whileTap={{ scale: 0.9 }}
            className={`relative aspect-square w-full select-none ${isHazardTapped ? "ring-2 ring-red-500 rounded-full" : ""}`}
        >
            <img src={tile} alt="" className="h-full w-full" draggable={false} />
        </motion.button>
    )
}

/** Overlay icons/badges (Start, End, hazards, connector nodes) — sits at Layer 3 (on top of the path line). */
function TileOverlay({ isStart, isEnd, isDanger, isOnPath, isHazardTapped }) {
    // One-shot "you stepped on a hazard" flash
    const [justHit, setJustHit] = useState(false)
    useEffect(() => {
        if (!isHazardTapped) return undefined
        setJustHit(true)
        const t = setTimeout(() => setJustHit(false), 450)
        return () => clearTimeout(t)
    }, [isHazardTapped])

    return (
        <div className="pointer-events-none relative aspect-square w-full select-none">
            {isStart && (
                <motion.img
                    src={startBadge}
                    alt="Start"
                    className="absolute left-1/2 top-1/2 w-[85%] -translate-x-1/2 -translate-y-1/2"
                    draggable={false}
                    animate={{ scale: [1, 1.06, 1] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                />
            )}
            {isEnd && (
                <motion.img
                    src={endBadge}
                    alt="End"
                    className="absolute left-1/2 top-1/2 w-[85%] -translate-x-1/2 -translate-y-1/2"
                    draggable={false}
                    animate={{ scale: [1, 1.06, 1] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut", delay: 0.5 }}
                />
            )}
            <AnimatePresence>
                {isDanger && (
                    <motion.img
                        key="hazard"
                        src={monsterIcon}
                        alt="Danger"
                        className="absolute left-1/2 top-1/2 w-[78%] -translate-x-1/2 -translate-y-1/2"
                        initial={{ opacity: 0, scale: 0.3, rotate: -10 }}
                        animate={{
                            opacity: 1,
                            scale: [0.95, 1.06, 0.95],
                            y: [-2, 2, -2],
                            rotate: [0, 3, -3, 0],
                        }}
                        exit={{ opacity: 0, scale: 0.4 }}
                        transition={{
                            scale: { repeat: Infinity, duration: 1.8, ease: "easeInOut" },
                            y: { repeat: Infinity, duration: 1.8, ease: "easeInOut" },
                            rotate: { repeat: Infinity, duration: 2.4, ease: "easeInOut" },
                            opacity: { duration: 0.3 },
                        }}
                        draggable={false}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {isOnPath &&
                    !isStart &&
                    !isEnd && [
                        // Glow halo
                        <motion.div
                            key="connector-glow"
                            className="pointer-events-none absolute left-1/2 top-1/2 w-[50%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                            style={{ background: PATH_GLOW_COLOR, filter: "blur(6px)", zIndex: 0 }}
                            initial={{ opacity: 0, scale: 0.2 }}
                            animate={{ opacity: [0.3, 0.5, 0.3], scale: 1 }}
                            exit={{ opacity: 0, scale: 0.2 }}
                            transition={{
                                scale: { type: "spring", stiffness: 500, damping: 18 },
                                opacity: { duration: 1.4, repeat: Infinity, ease: "easeInOut" },
                            }}
                        />,
                        // Node art
                        <motion.img
                            key="connector"
                            src={connectorNode}
                            alt=""
                            className="absolute left-1/2 top-1/2 w-[45%] -translate-x-1/2 -translate-y-1/2"
                            style={{
                                filter: `brightness(1.35) saturate(1.3) drop-shadow(0 0 4px ${PATH_GLOW_COLOR})`,
                                zIndex: 1,
                            }}
                            initial={{ opacity: 0, scale: 0.2 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.2 }}
                            transition={{ type: "spring", stiffness: 500, damping: 18 }}
                            draggable={false}
                        />,
                    ]}
            </AnimatePresence>
            <AnimatePresence>
                {justHit && (
                    <motion.span
                        className="pointer-events-none absolute inset-0 rounded-full bg-red-500/50"
                        initial={{ scale: 0.6, opacity: 0.9 }}
                        animate={{ scale: 1.7, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

/**
 * Time / Score display: a Figma frame with a small label over a larger value.
 * When `animateChanges` is set, the value pops in with a little spring bump
 * whenever it changes — used for the score badge to sell "you just earned
 * points" without needing any new art. Left off for the timer so it keeps
 * ticking cleanly instead of bouncing every second.
 */
function StatBadge({ frame, label, value, labelColor, style, animateChanges = false }) {
    return (
        <div className="absolute" style={style}>
            <img src={frame} alt="" className="w-full" draggable={false} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-[0.6cqh]">
                <span className="font-bold leading-none" style={{ fontSize: "2.2cqw", color: labelColor }}>
                    {label}
                </span>
                {animateChanges ? (
                    <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                            key={value}
                            className="font-extrabold leading-none text-white"
                            style={{ fontSize: "2.8cqw" }}
                            initial={{ opacity: 0, y: -8, scale: 1.4 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.7 }}
                            transition={{ duration: 0.28, ease: "easeOut" }}
                        >
                            {value}
                        </motion.span>
                    </AnimatePresence>
                ) : (
                    <span className="font-extrabold leading-none text-white" style={{ fontSize: "2.8cqw" }}>
                        {value}
                    </span>
                )}
            </div>
        </div>
    )
}

/**
 * PerilousPathGame
 * Plays exactly one level (one trial) end to end:
 *   probe (hazards shown) -> delay (hidden, waiting) -> response (countdown,
 *   taps captured) -> submit (POST /trial/complete or /trial/timeout).
 *
 * All board data, timing, and scoring come from the `level` prop (a
 * POST /next-grid response) — this component never decides correctness or
 * points itself, it only captures raw taps with real timestamps and
 * displays whatever the server told it to show. The one exception is the
 * result banner below: once the server responds, we hold on screen for
 * RESULT_HOLD_MS so the player actually sees what happened, mirroring
 * RoundManager.Succeed/Fail on the CS side — the server's numbers are still
 * the only ones that count, we just don't hide them from the player.
 *
 * IMPORTANT ASSUMPTION: this component expects to be fully unmounted and
 * remounted by its parent between levels (see PerilousPath.jsx, which shows
 * a loading state while fetching the next board instead of reusing this
 * instance). That's what lets all per-trial state below be initialized
 * fresh via plain useState/useRef, with no separate "new level" reset
 * effect. If you ever reuse one mounted instance across levels instead,
 * you'll need to add a reset keyed off `level.trial_id`.
 *
 * Props:
 *  - level: the POST /next-grid response for this trial (required).
 *  - onFinish(trialResult): called once submission succeeds, with the
 *    /trial/complete or /trial/timeout response. The parent is
 *    responsible for loading the next level (or finalizing the game).
 *  - dummyFlag: optional override for local-mode testing.
 */
export default function PerilousPathGame({ level, onFinish, dummyFlag }) {
    const { board, timing, grid, level: levelMeta, progress } = level

    const [phase, setPhase] = useState(PHASE.PROBE)
    const [secondsLeft, setSecondsLeft] = useState(timing.probe_seconds)
    const [tappedTiles, setTappedTiles] = useState([]) // ordered tile_numbers, for rendering only
    const [hazardHitTiles, setHazardHitTiles] = useState(() => new Set())
    const [submitError, setSubmitError] = useState(null)
    const [resultBanner, setResultBanner] = useState(null) // { tone: 'success' | 'fail', text }
    const [displayedScore, setDisplayedScore] = useState(progress.total_points)
    // Whether a tile the player stepped on that happened to be a hazard is
    // allowed to show its red indicator yet. Hazard hits are tracked the
    // whole time (hazardHitTiles below), but must stay invisible during
    // RESPONSE — showing red the instant you touch one turns "memorize the
    // danger tiles" into "just tap around and watch for red", which defeats
    // the whole point of the recall task. It only flips true once the trial
    // result is in, same moment the CS side's RevealAllHazards runs.
    const [revealHazards, setRevealHazards] = useState(false)

    const tapsRef = useRef([]) // ordered { tile_number, tapped_at } — the real API payload
    const responseStartedAtRef = useRef(null)
    const hasSubmittedRef = useRef(false)
    const lastTimedOutRef = useRef(false)

    const submitTrial = useCallback(
        async (timedOut) => {
            if (hasSubmittedRef.current) return
            hasSubmittedRef.current = true
            lastTimedOutRef.current = timedOut
            setSubmitError(null)
            setResultBanner(null)
            setRevealHazards(false)
            setPhase(PHASE.SUBMITTING)

            const payload = {
                trial_id: level.trial_id,
                response_started_at: responseStartedAtRef.current ?? new Date().toISOString(),
                taps: tapsRef.current,
                dummyFlag,
            }

            try {
                const result = timedOut
                    ? await perilousPathApi.trialTimeout(payload)
                    : await perilousPathApi.trialComplete(payload)
                console.log("TRIAL RESULT", result)

                // Mirror RoundManager.Succeed/Fail: show what happened and bump the
                // score badge for a beat before the parent swaps in the next board.
                const earned = result?.scoring?.points_awarded ?? 0
                const routeValid = result?.route_is_valid ?? false
                setResultBanner(
                    routeValid
                        ? { tone: "success", text: earned > 0 ? `+${earned} Safe crossing` : "Crossed — no points" }
                        : { tone: "fail", text: timedOut ? "Time ran out" : "Path not completed" }
                )
                if (result?.game_totals?.total_points != null) {
                    setDisplayedScore(result.game_totals.total_points)
                }
                setRevealHazards(true)
                await new Promise((resolve) => setTimeout(resolve, RESULT_HOLD_MS))

                console.log("CALLING PARENT onFinish")
                await onFinish?.(result)
                console.log("PARENT onFinish COMPLETE")
            } catch (err) {
                hasSubmittedRef.current = false
                setResultBanner(null)
                setRevealHazards(false)
                setSubmitError(err.message || "Couldn't submit your run.")
            }
        },
        [level.trial_id, dummyFlag, onFinish]
    )

    const advancePhase = useCallback(() => {
        if (phase === PHASE.PROBE) {
            setSecondsLeft(timing.pause_delay_seconds)
            setPhase(PHASE.DELAY)
        } else if (phase === PHASE.DELAY) {
            responseStartedAtRef.current = new Date().toISOString()
            setSecondsLeft(timing.response_window_seconds)
            setPhase(PHASE.RESPONSE)
        } else if (phase === PHASE.RESPONSE) {
            submitTrial(true)
        }
    }, [phase, timing, submitTrial])

    // Drives probe -> delay -> response -> (timeout) purely off `timing`
    // from the server. Re-arms a 1s tick whenever phase/secondsLeft change;
    // hitting 0 triggers the next phase (or a timeout submission).
    useEffect(() => {
        if (phase === PHASE.SUBMITTING) return undefined
        if (secondsLeft <= 0) {
            advancePhase()
            return undefined
        }
        const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
        return () => clearTimeout(id)
    }, [phase, secondsLeft, advancePhase])

    // ── Tap handling ─────────────────────────────────────────────────────
    // Mirrors PathInputController.TryAddTile: a tap only ever does one of
    // three things — is ignored, undoes the last step (backtrack), or
    // extends the path by exactly one adjacent tile. `taps` excludes the
    // start tile (per the API spec), but the start tile is still the
    // implicit first point of the route, so it has to be treated as a
    // legal backtrack target once exactly one tile has been tapped —
    // that's why the backtrack check runs *before* the "ignore start tile"
    // guard below, not after.
    const handleTileClick = useCallback(
        (row, col) => {
            if (phase !== PHASE.RESPONSE) return
            if (hasSubmittedRef.current) return // trial already submitted (or submitting) — ignore trailing taps from an in-flight drag

            const tileNumber = rowColToTile(row, col)
            const taps = tapsRef.current
            const lastTile = taps.length ? taps[taps.length - 1].tile_number : board.start.tile
            const secondLastTile =
                taps.length >= 2 ? taps[taps.length - 2].tile_number : taps.length === 1 ? board.start.tile : null

            if (tileNumber === lastTile) return // dragging/lingering over the same tile shouldn't spam taps

            // Backward step: tapping (or dragging back onto) the tile the player
            // was just on before their current one retraces the path by one hop
            // — same as CS's backtrack-to-undo. This can legally land back on
            // the start tile itself. The beam segment for that hop and the
            // tile's connector marker both animate away via their own exit
            // effects, so the line visibly retracts.
            if (secondLastTile !== null && tileNumber === secondLastTile) {
                tapsRef.current = taps.slice(0, -1)
                setTappedTiles((prev) => prev.slice(0, -1))
                setHazardHitTiles((prev) => {
                    if (!prev.has(lastTile)) return prev
                    const next = new Set(prev)
                    next.delete(lastTile)
                    return next
                })
                return
            }

            if (tileNumber === board.start.tile) return // spec: never include the start tile in taps (and it's not a valid forward step once you've left it)

            // A tile already used earlier in the route (not the immediate
            // backtrack case above) is a no-op — no shortcuts or loops.
            if (taps.some((t) => t.tile_number === tileNumber)) return

            // Only a neighbor of wherever the trace currently ends can be added
            // next — mirrors GridManager.AreAdjacent gating every step in
            // PathInputController.TryAddTile.
            if (!areAdjacent(lastTile, tileNumber)) return

            tapsRef.current = [...taps, { tile_number: tileNumber, tapped_at: new Date().toISOString() }]
            setTappedTiles((prev) => [...prev, tileNumber])

            if (board.hazard_tiles.includes(tileNumber)) {
                setHazardHitTiles((prev) => new Set(prev).add(tileNumber))
            }

            if (tileNumber === board.destination.tile) {
                submitTrial(false)
            }
        },
        [phase, board, submitTrial]
    )

    // ── Drag-to-trace support ───────────────────────────────────────────────
    // Lets players press on a tile and drag across the board to trace their
    // path (in addition to plain tapping, still handled by Tile's onClick).
    // We resolve the tile under the pointer via elementFromPoint instead of
    // per-tile pointerenter listeners so touch's implicit pointer capture
    // (which would otherwise pin every event to the tile first pressed)
    // can't break drag tracking.
    const isDraggingRef = useRef(false)
    const lastPointRef = useRef(null) // last {x, y} we sampled, for interpolating fast drags

    useEffect(() => {
        const stopDragging = () => {
            isDraggingRef.current = false
            lastPointRef.current = null
        }
        window.addEventListener("pointerup", stopDragging)
        window.addEventListener("pointercancel", stopDragging)
        return () => {
            window.removeEventListener("pointerup", stopDragging)
            window.removeEventListener("pointercancel", stopDragging)
        }
    }, [])

    const processPointerPosition = useCallback(
        (clientX, clientY) => {
            const el = document.elementFromPoint(clientX, clientY)
            const tileEl = el?.closest("[data-tile]")
            if (!tileEl) return
            const [rowStr, colStr] = tileEl.dataset.tile.split("-")
            handleTileClick(Number(rowStr), Number(colStr))
        },
        [handleTileClick]
    )

    // Walks from the last sampled point to the current one in small steps so
    // a fast swipe can't jump over an intermediate tile between two
    // pointermove events (which would otherwise register as a bogus
    // non-adjacent hop, or silently drop a tile from the traced path).
    const SAMPLE_STEP_PX = 20
    const processPointerPath = useCallback(
        (clientX, clientY) => {
            const prev = lastPointRef.current
            lastPointRef.current = { x: clientX, y: clientY }

            if (!prev) {
                processPointerPosition(clientX, clientY)
                return
            }

            const distance = Math.hypot(clientX - prev.x, clientY - prev.y)
            const steps = Math.max(1, Math.ceil(distance / SAMPLE_STEP_PX))
            for (let i = 1; i <= steps; i++) {
                const t = i / steps
                processPointerPosition(prev.x + (clientX - prev.x) * t, prev.y + (clientY - prev.y) * t)
            }
        },
        [processPointerPosition]
    )

    const handleBoardPointerDown = (e) => {
        isDraggingRef.current = true
        lastPointRef.current = null
        processPointerPath(e.clientX, e.clientY)
    }

    const handleBoardPointerMove = (e) => {
        if (!isDraggingRef.current) return
        processPointerPath(e.clientX, e.clientY)
    }

    const showHazards = phase === PHASE.PROBE
    const dangerSet = new Set(
        showHazards
            ? board.hazard_tiles.map((t) => {
                const { row, col } = tileToRowCol(t)
                return cellKey(row, col)
            })
            : []
    )
    const pathSet = new Set(
        tappedTiles.map((t) => {
            const { row, col } = tileToRowCol(t)
            return cellKey(row, col)
        })
    )
    const hazardTapSet = new Set(
        [...hazardHitTiles].map((t) => {
            const { row, col } = tileToRowCol(t)
            return cellKey(row, col)
        })
    )

    // Beam path: start tile -> every tapped tile, in order.
    const pathSegments = useMemo(
        () => buildPathSegments([board.start.tile, ...tappedTiles], grid.rows, grid.cols),
        [board.start.tile, tappedTiles, grid.rows, grid.cols]
    )

    return (
        <div className="absolute inset-0 text-white">
            {/* Header: time · score */}
            <StatBadge
                frame={timeFrame}
                label="Time"
                value={formatSeconds(secondsLeft)}
                labelColor={COLORS.white}
                style={{
                    left: `${LAYOUT.timeBadge.left}%`,
                    top: `${LAYOUT.timeBadge.top}%`,
                    width: `${LAYOUT.timeBadge.width}%`,
                }}
            />

            <StatBadge
                frame={scoreFrame}
                label="Score"
                value={displayedScore}
                labelColor={COLORS.gold}
                animateChanges
                style={{
                    left: `${LAYOUT.scoreBadge.left}%`,
                    top: `${LAYOUT.scoreBadge.top}%`,
                    width: `${LAYOUT.scoreBadge.width}%`,
                }}
            />

            {/* Level pill */}
            <div
                className="absolute"
                style={{
                    left: `${LAYOUT.levelPill.left}%`,
                    top: `${LAYOUT.levelPill.top}%`,
                    width: `${LAYOUT.levelPill.width}%`,
                }}
            >
                <img src={levelPillFrame} alt="" className="w-full" draggable={false} />
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-extrabold tracking-wide" style={{ fontSize: "2.6cqw", color: COLORS.gold }}>
                        {levelMeta.level_name}
                    </span>
                </div>
            </div>

            {/* Objective bar — reflects the current phase, or the trial result once it's in */}
            <div
                className="absolute"
                style={{
                    left: `${LAYOUT.objectiveBar.left}%`,
                    top: `${LAYOUT.objectiveBar.top}%`,
                    width: `${LAYOUT.objectiveBar.width}%`,
                }}
            >
                <img src={objectiveBarFrame} alt="" className="w-full" draggable={false} />
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={resultBanner ? `result-${resultBanner.text}` : phase}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0, scale: resultBanner ? [1, 1.08, 1] : 1 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.22 }}
                            className="font-extrabold tracking-wide"
                            style={{
                                fontSize: "3cqw",
                                color: resultBanner
                                    ? resultBanner.tone === "success"
                                        ? COLORS.gold
                                        : "#ff6b6b"
                                    : COLORS.cyan,
                            }}
                        >
                            {resultBanner ? resultBanner.text : OBJECTIVE_TEXT[phase]}
                        </motion.span>
                    </AnimatePresence>
                </div>
            </div>

            {/* Board */}
            <div
                className="absolute"
                style={{
                    left: `${LAYOUT.board.left}%`,
                    top: `${LAYOUT.board.top}%`,
                    width: `${LAYOUT.board.width}%`,
                }}
            >
                <img src={boardFrame} alt="" className="w-full" draggable={false} />

                {/* Layer 1: Base tile buttons */}
                <div
                    className="absolute grid grid-cols-4 touch-none select-none z-0"
                    style={{
                        left: `${LAYOUT.boardInset.left}%`,
                        top: `${LAYOUT.boardInset.top}%`,
                        right: `${LAYOUT.boardInset.right}%`,
                        bottom: `${LAYOUT.boardInset.bottom}%`,
                        gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
                    }}
                    onPointerDown={handleBoardPointerDown}
                    onPointerMove={handleBoardPointerMove}
                >
                    {Array.from({ length: grid.rows * grid.cols }).map((_, i) => {
                        const row = Math.floor(i / grid.cols)
                        const col = i % grid.cols
                        const key = cellKey(row, col)
                        return (
                            <TileButton
                                key={key}
                                row={row}
                                col={col}
                                isHazardTapped={revealHazards && hazardTapSet.has(key)}
                                onClick={handleTileClick}
                            />
                        )
                    })}
                </div>

                {/* Layer 2: Glowing beams tracing the player's path (behind Start/End badges) */}
                <div
                    className="pointer-events-none absolute z-10"
                    style={{
                        left: `${LAYOUT.boardInset.left}%`,
                        top: `${LAYOUT.boardInset.top}%`,
                        right: `${LAYOUT.boardInset.right}%`,
                        bottom: `${LAYOUT.boardInset.bottom}%`,
                    }}
                >
                    <AnimatePresence>
                        {pathSegments.map((segment) => (
                            <PathSegment key={segment.key} {...segment} />
                        ))}
                    </AnimatePresence>
                </div>

                {/* Layer 3: Start/End badges, hazards, and connector nodes (on top of path line) */}
                <div
                    className="pointer-events-none absolute grid grid-cols-4 touch-none select-none z-20"
                    style={{
                        left: `${LAYOUT.boardInset.left}%`,
                        top: `${LAYOUT.boardInset.top}%`,
                        right: `${LAYOUT.boardInset.right}%`,
                        bottom: `${LAYOUT.boardInset.bottom}%`,
                        gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
                    }}
                >
                    {Array.from({ length: grid.rows * grid.cols }).map((_, i) => {
                        const row = Math.floor(i / grid.cols)
                        const col = i % grid.cols
                        const isStart = row === board.start.row && col === board.start.col
                        const isEnd = row === board.destination.row && col === board.destination.col
                        const key = cellKey(row, col)
                        return (
                            <TileOverlay
                                key={key}
                                isStart={isStart}
                                isEnd={isEnd}
                                isDanger={dangerSet.has(key)}
                                isOnPath={pathSet.has(key)}
                                isHazardTapped={revealHazards && hazardTapSet.has(key)}
                            />
                        )
                    })}
                </div>
            </div>

            {submitError && (
                <div className="absolute inset-x-[10%] top-[45%] z-10 rounded-xl bg-black/80 p-4 text-center">
                    <p className="mb-2 text-sm">{submitError}</p>
                    <button
                        type="button"
                        className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-bold text-black"
                        onClick={() => submitTrial(lastTimedOutRef.current)}
                    >
                        Retry
                    </button>
                </div>
            )}
        </div>
    )
}
