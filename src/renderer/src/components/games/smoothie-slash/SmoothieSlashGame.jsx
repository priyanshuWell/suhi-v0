import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { motion, motionValue, AnimatePresence } from "framer-motion";
import scoreFrame from '../../../assets/smoothie/score-frame.png';
import scoreboardFrame from '../../../assets/smoothie/score-board.png';
import timeFrame from '../../../assets/smoothie/time-frame.png';
import bg from '../../../assets/smoothie/bg2.png';
import blenderImage from '../../../assets/smoothie/blenderImage.svg';
import ProgressStage from '../../ProgessStage';
import cutSlice1 from '../../../assets/audio/smoothie/cutSlice.wav';
import cutSlice2 from '../../../assets/audio/smoothie/cutSlice2.wav';
import beAwareImg from '../../../assets/smoothie/intro/intro_step1.png';
import howToDoImg from '../../../assets/smoothie/intro/intro_step2.png';
import howToPlayImg from '../../../assets/smoothie/intro/intro_step3.png';
import bgMusic from '../../../assets/audio/smoothie/background2.wav';
import banana from '../../../assets/smoothie/fruits/banana.png';
import blueberry from '../../../assets/smoothie/fruits/blueberry.png';
import coconut from '../../../assets/smoothie/fruits/coconut.png';
import kiwi from '../../../assets/smoothie/fruits/kivi.png';
import mango from '../../../assets/smoothie/fruits/mango.png';
import orange from '../../../assets/smoothie/fruits/orange.png';
import pineapple from '../../../assets/smoothie/fruits/pineapple.png';
import strawberry from '../../../assets/smoothie/fruits/strawberry.png';
import blueberryCut from '../../../assets/smoothie/fruits/blueberry_cut.png';
import bananaCut from '../../../assets/smoothie/fruits/banana_cut.png';
import coconutCut from '../../../assets/smoothie/fruits/coconut_cut.png';
import kiwiCut from '../../../assets/smoothie/fruits/kivi_cut.png';
import mangoCut from '../../../assets/smoothie/fruits/mango_cut.png';
import orangeCut from '../../../assets/smoothie/fruits/orange_cut.png';
import pineappleCut from '../../../assets/smoothie/fruits/pineapple_cut.png';
import strawberryCut from '../../../assets/smoothie/fruits/strawberry_cut.png';
import splashDrop1 from '../../../assets/smoothie/splash1.svg';
import splashDrop2 from '../../../assets/smoothie/splash2.svg';
// jarFilled import removed — liquid fill handles the full-jar visual
import { getNextRoute } from '../../../utils/stageRouter';
import scrollFrame from '../../../assets/smoothie/scroll-frame.png';

const API = "http://127.0.0.1:8000";

/* POST `/smoothie/start → { game_session_id, stage: { stage_id, target_fruits, … } } */
const apiStart = async (userId, screeningSessionId, kioskId = "KIOSK_001") => {
  const r = await fetch(`${API}/smoothie/start`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, screening_session_id: screeningSessionId, kiosk_id: kioskId })
  });
  if (!r.ok) throw new Error(`start ${r.status}`);
  return r.json();   // { game_session_id, current_stage, total_stages, stage:{…} }
};

/* POST /smoothie/stage/complete → { completed_stage, game_completed, next_stage:{…}|null } */
const apiStageComplete = async (gameSessionId, stageId, startedAt, completedAt, slashes) => {
  const r = await fetch(`${API}/smoothie/stage/complete`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_session_id: gameSessionId,
      stage_id: stageId,
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: new Date(completedAt) - new Date(startedAt),
      slashes,
    })
  });
  if (!r.ok) throw new Error(`stage/complete ${r.status}`);
  return r.json();   // { completed_stage, game_completed, next_stage }
};

/* POST /smoothie/game/complete → full metrics object */
const apiGameComplete = async (gameSessionId) => {
  const r = await fetch(`${API}/smoothie/game/complete`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game_session_id: gameSessionId })
  });
  if (!r.ok) throw new Error(`game/complete ${r.status}`);
  return r.json();
};

function Star({ filled }) {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.35))" }}>
      <path
        d="M12 2.5l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7-5.4-4.7 7.1-.6z"
        fill={filled ? "#F5C842" : "#9C97B0"}
        stroke={filled ? "#C98A00" : "#6E6884"}
        strokeWidth="0.6"
      />
    </svg>
  );
}
const FRUITS = {
  ST: { img: strawberry, cutImg: strawberryCut, name: "Strawberry" },
  BA: { img: banana, cutImg: bananaCut, name: "Banana" },
  BL: { img: blueberry, cutImg: blueberryCut, name: "Blueberry" },
  OR: { img: orange, cutImg: orangeCut, name: "Orange" },
  MA: { img: mango, cutImg: mangoCut, name: "Mango" },
  KI: { img: kiwi, cutImg: kiwiCut, name: "Kiwi" },
  CO: { img: coconut, cutImg: coconutCut, name: "Coconut" },
  PI: { img: pineapple, cutImg: pineappleCut, name: "Pineapple" },
};
const ALL_CODES = Object.keys(FRUITS);

const STAGES = [
  { stageId: 1, stageCode: "BERRY_BLAST", stageName: "Berry Blast", targets: ["ST", "BA", "BL"], juice: "#E86A8A" },
  { stageId: 2, stageCode: "SUNRISE_CITRUS", stageName: "Sunrise Citrus", targets: ["OR", "MA", "KI"], juice: "#F5A94B" },
  { stageId: 3, stageCode: "COCO_LOCO", stageName: "Coco Loco", targets: ["CO", "BA", "PI"], juice: "#EFE7D6" },
  { stageId: 4, stageCode: "ISLAND_GOLD", stageName: "Island Gold", targets: ["PI", "MA", "OR"], juice: "#F2B34C" },
  { stageId: 5, stageCode: "GREEN_MACHINE", stageName: "Green Machine", targets: ["KI", "BA", "ST"], juice: "#9CC95A" },
  { stageId: 6, stageCode: "BLUE_LAGOON", stageName: "Blue Lagoon", targets: ["BL", "KI", "CO"], juice: "#7E9BD0" },
];
function bannerYOffset(playRef, state) {
  const h = playRef.current?.getBoundingClientRect().height || 800;
  const targetPct = state === "settle" ? 22 : 45;   // mirrors old bannerAnim states
  return (targetPct - 50) / 100 * h;
}

const SESSION_SEC = 120;
const BLOCK_SEC = 20;
const SPAWN_MS = 650;
const MAX_ALIVE = 7;
const FRUIT_R_BASE = 0.045;   // fraction of playfield height — tune with fontSize below
const BANNER_MS = 1300;
const GRAVITY = 380;
const INTER_PAUSE = 2500;    // ms pause between blocks
const BANNER_CLEAR_MS = 1500;   // ms pause between blocks
const BANNER_SETTLE_HOLD_MS = 900;  // how long it sits still at "settle" before clearing
const PTS = { CS: 15, IS: -2, COMBO_BONUS: 20, COMBO_EVERY: 5 };
const SCREENS = { INSTRUCTION: "INSTRUCTION", COUNTDOWN: "COUNTDOWN", GAME: "GAME", REPORT: "REPORT" };

/* ── jar liquid geometry ─────────────────────────────────────────────
   These MUST match the inset values on the liquid <div> in the JSX.
   They are the single source of truth for where the juice surface is,
   so physics (landing tests) and rendering (splash, ripples, sinking
   halves) all agree.                                                  */
const LIQ_TOP = 0.25;      // liquid area starts 24% down the jar
const LIQ_BOTTOM = 0.20;   // …and ends 12% up from the bottom
const LIQ_INSET_X = 0.22;  // left/right inset of the liquid area
const FRUITS_TO_FILL = 10; // correct fruits needed to fill the jar

const uid = () => Math.random().toString(36).slice(2, 9);
const clamp01 = v => (v == null || !isFinite(v) ? null : Math.max(0, Math.min(1, v)));

/* Surface height as a fraction of jar height, for CSS `top` values */
const surfaceTopPct = fill => (LIQ_TOP + (1 - fill) * (1 - LIQ_TOP - LIQ_BOTTOM)) * 100;

/* ── metric engine ──────────────────────────────────────────────────── */
function computeMetrics(events) {
  const blocks = [];
  for (let b = 1; b <= 6; b++) {
    const ev = events.filter(e => e.block_number === b);
    const cs = ev.filter(e => e.outcome === "CS").length;
    const is_ = ev.filter(e => e.outcome === "IS").length;
    const cr = ev.filter(e => e.outcome === "CR").length;
    const ir = ev.filter(e => e.outcome === "IR").length;
    const pe = ev.filter(e => e.is_perseverative).length;
    const n = ev.length;
    const rts = ev.filter(e => e.response_time_ms != null).map(e => e.response_time_ms);
    const rt = rts.length ? rts.reduce((a, c) => a + c, 0) / rts.length : null;
    blocks.push({
      b, cs, is: is_, cr, ir, pe, n, rt,
      acc: n ? (cs + cr) / n : null,
      pRate: is_ + ir ? pe / (is_ + ir) : 0
    });
  }
  const tot = k => blocks.reduce((a, x) => a + x[k], 0);
  const CS = tot("cs"), IS = tot("is"), CR = tot("cr"), IR = tot("ir"), N = tot("n");
  const rtB = blocks.filter(x => x.rt != null).map(x => x.rt);
  const mRt = rtB.length ? rtB.reduce((a, c) => a + c, 0) / rtB.length : null;
  const rtSd = rtB.length > 1 ? Math.sqrt(rtB.reduce((a, c) => a + (c - mRt) ** 2, 0) / (rtB.length - 1)) : 0;
  const rtCv = mRt ? rtSd / mRt : 0;
  const b1 = blocks[0], b6 = blocks[5];
  const late = blocks.slice(1).filter(x => x.n > 0);
  const accLate = late.length ? late.reduce((a, x) => a + (x.acc ?? 0), 0) / late.length : null;
  const rtLate = late.filter(x => x.rt != null);
  const rtLateMean = rtLate.length ? rtLate.reduce((a, x) => a + x.rt, 0) / rtLate.length : null;
  const accSwitch = b1.acc != null && accLate != null ? b1.acc - accLate : null;
  const rtSwitch = b1.rt != null && rtLateMean != null ? rtLateMean - b1.rt : null;
  const accDec = b1.acc && b6.acc != null ? (b1.acc - b6.acc) / b1.acc : null;
  const prLate = late.length ? late.reduce((a, x) => a + x.pRate, 0) / late.length : 0;
  return {
    blocks, constructs: {
      divided_attention: clamp01(N ? (CS + CR) / N : null),
      selective_attention: clamp01(CR + IS ? CR / (CR + IS) : null),
      cognitive_flexibility: clamp01(b1.acc && b1.rt && accSwitch != null && rtSwitch != null
        ? 1 - (0.5 * (accSwitch / b1.acc) + 0.5 * (rtSwitch / b1.rt)) : null),
      working_memory: clamp01(1 - prLate),
      processing_speed: (CS + CR) / SESSION_SEC,
      sustained_attention: clamp01(accDec != null ? 1 - (0.5 * accDec + 0.5 * rtCv) : null),
    }
  };
}
const TRAIL_COLORS = ["#FF6B9D", "#4DD0E1", "#FFD34D", "#B388FF", "#69F0AE", "#FF8A65"];

/* generated once so bubbles don't re-randomise every frame */
const BUBBLES = Array.from({ length: 7 }, (_, i) => ({
  id: i,
  x: 12 + Math.random() * 76,
  s: 4 + Math.random() * 7,
  dur: 1.8 + Math.random() * 1.8,
  delay: Math.random() * 2,
}));

/* ════════════════════════════════════════════════════════════════════════ */
export default function SmoothieSlashGame() {
  const navigate = useNavigate();
  const storeUser = useSelector(s => s.common.user);
  const storeScreening = useSelector(s => s.common.screening);
  const rippleRef = useRef([]);
  const [screen, setScreen] = useState(SCREENS.INSTRUCTION);
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SESSION_SEC);
  const [stageIdx, setStageIdx] = useState(0);
  const [paused, setPaused] = useState(false);   // inter-block pause flag
  const [bannerAnim, setBannerAnim] = useState(null); // null | 'center' | 'settle'
  const [bannerText, setBannerText] = useState("");
  const [bannerFruits, setBannerFruits] = useState([]); // fruit codes shown inside the banner
  const [fill, setFill] = useState(0);
  const [splash, setSplash] = useState(null);
  const [best, setBest] = useState(0);
  const [report, setReport] = useState(null);
  const [, forceTick] = useState(0);
  const [introStep, setIntroStep] = useState(0);
  const playRef = useRef(null);
  const jarRef = useRef(null);
  const fruitsRef = useRef([]);
  const halvesRef = useRef([]);
  const popsRef = useRef([]);
  const trailRef = useRef([]);
  const splashDropsRef = useRef([]);
  const eventsRef = useRef([]);
  const engineRef = useRef({});
  const rafRef = useRef(null);
  const sessionIdRef = useRef(null);
  const nextRouteRef = useRef(null);
  const scoreRef = useRef(0);
  const stageStartedAt = useRef(null);   // ISO string, set on each block start
  const stageIdRef = useRef(1);      // current backend stage_id
  const pausedRef = useRef(false);   // readable inside rAF loop
  const bgMusicRef = useRef(null);   // background music Audio instance
  const fillRef = useRef(0);         // mirror of `fill` — readable inside rAF loop
  const [pulse, setPulse] = useState(0);

  /* ── handleNext — same pattern as VoiceAnalysis ─────────────────────
     Prefers the route cached by endGame (set from the API response).
     Falls back to getNextRoute with the Redux screening state.          */
  const handleNext = useCallback(() => {
    const route = nextRouteRef.current ?? getNextRoute(storeScreening?.nextStage, '/voice');
    console.log('[SmoothieSlash] handleNext — navigating to:', route);
    navigate(route);
  }, [navigate, storeScreening]);

  /* setFill + keep the ref in sync. Always use this, never setFill directly. */
  const applyFill = useCallback((v) => {
    fillRef.current = v;
    setFill(v);
  }, []);

  /* ── animated banner helper ─────────────────────────────────────────
     Phase 1 (0 ms)   : text appears at center  → bannerAnim = 'center'
     Phase 2 (900 ms) : slides to top-left HUD  → bannerAnim = 'settle'
     Phase 3 (1500 ms): banner clears            → bannerAnim = null
  ──────────────────────────────────────────────────────────────────── */
  const showBanner = useCallback((text) => {
    setBannerText(text);
    setBannerAnim("center");
    // setTimeout(() => setBannerAnim("settle"), 900);
    // setTimeout(() => {
    //   setBannerAnim(null);
    //   setBannerFruits([]);   // clear fruits in the same timeout that clears the banner
    // }, BANNER_CLEAR_MS);
  }, []);

  const showStageBanner = useCallback((sIdx) => {
    setBannerFruits(STAGES[sIdx].targets);
    showBanner(`GET READY — ${STAGES[sIdx].stageName.toUpperCase()}`);
  }, [showBanner]);

  /* ── inter-block pause ──────────────────────────────────────────────
     Clears all live fruits, shows the banner animation, resumes after
     INTER_PAUSE ms. Called inside the game loop when block flips.      */
  const doBlockPause = useCallback((newSIdx) => {
    fruitsRef.current = [];
    halvesRef.current = [];
    splashDropsRef.current = [];
    rippleRef.current = [];
    pausedRef.current = true;
    setPaused(true);
    showStageBanner(newSIdx);
    setTimeout(() => {
      pausedRef.current = false;
      setPaused(false);
    }, INTER_PAUSE);
  }, [showStageBanner]);

  /* ── pushStageComplete: send one block's slashes to /smoothie/stage/complete ── */
  const pushStageComplete = useCallback(async (stageId, startedAt, completedAt, slashes) => {
    // NOTE: guard moved below logs so payload is always visible in console
    try {
      // Shape each slash to match the backend contract
      const shaped = slashes.map(e => ({
        fruit_code: e.fruit_code,
        action: e.action,                  // "SLASH" | "NONE"
        response_time_ms: e.response_time_ms ?? null,
        points_awarded: e.points_awarded ?? 0,
        combo_at_event: e.combo_at_event ?? 0,
        is_perseverative: e.is_perseverative ?? false,
        spawned_at: e.spawned_at,
        resolved_at: e.resolved_at,
        slash_path: e.slash_path ?? null,
      }));

      // ── REQUEST log ────────────────────────────────────────────────
      console.groupCollapsed(`🍉 [SmoothieSlash] stage/complete REQUEST — stage_id: ${stageId}`);
      console.log("game_session_id :", sessionIdRef.current ?? "(offline — no session)");
      console.log("stage_id        :", stageId);
      console.log("started_at      :", startedAt);
      console.log("completed_at    :", completedAt);
      console.log("duration_ms     :", new Date(completedAt) - new Date(startedAt));
      console.log("total slashes   :", shaped.length);
      console.table(shaped.map(s => ({
        fruit: s.fruit_code,
        action: s.action,
        rt_ms: s.response_time_ms,
        pts: s.points_awarded,
        combo: s.combo_at_event,
        perseverative: s.is_perseverative,
        spawned_at: s.spawned_at,
        resolved_at: s.resolved_at,
      })));
      console.groupEnd();

      // Skip API call if no session (API offline or /smoothie/start failed)
      if (!sessionIdRef.current) {
        console.warn("[SmoothieSlash] stage/complete skipped — no game_session_id (offline mode)");
        return null;
      }

      const res = await apiStageComplete(sessionIdRef.current, stageId, startedAt, completedAt, shaped);

      // ── RESPONSE log ───────────────────────────────────────────────
      console.groupCollapsed(`✅ [SmoothieSlash] stage/complete RESPONSE — stage_id: ${stageId}`);
      console.log("completed_stage :", res?.completed_stage);
      console.log("game_completed  :", res?.game_completed);
      console.log("next_stage      :", res?.next_stage ?? "—");
      const cs = shaped.filter(s => s.action === "SLASH" && s.points_awarded > 0).length;
      const is_ = shaped.filter(s => s.action === "SLASH" && s.points_awarded < 0).length;
      const cr = shaped.filter(s => s.action === "NONE" && !STAGES.flatMap(st => st.targets).includes(s.fruit_code)).length;
      const ir = shaped.filter(s => s.action === "NONE").length - cr;
      const perv = shaped.filter(s => s.is_perseverative).length;
      console.log("outcomes        :", { CS: cs, IS: is_, CR: cr, IR: ir, perseverative: perv });
      console.log("raw response    :", res);
      console.groupEnd();

      return res;   // { completed_stage, game_completed, next_stage }
    } catch (e) {
      console.warn("[SmoothieSlash] stage/complete failed:", e.message);
      return null;
    }
  }, []);

  /* ── event log — shape matches /smoothie/stage/complete slashes array ── */
  const logEvent = useCallback((f, action, now) => {
    const st = STAGES[f.stageIdx];
    const isTarget = st.targets.includes(f.code);
    const outcome = action === "SLASH" ? (isTarget ? "CS" : "IS") : (isTarget ? "IR" : "CR");
    eventsRef.current.push({
      /* internal */
      block_number: f.stageIdx + 1,
      is_target: isTarget,
      outcome,
      /* backend contract */
      fruit_code: f.code,
      action,
      response_time_ms: action === "SLASH" ? Math.round(now - f.born) : null,
      points_awarded: action === "SLASH" ? (outcome === "CS" ? PTS.CS : PTS.IS) : 0,
      combo_at_event: engineRef.current.combo,
      is_perseverative: outcome === "IS" && f.wasPrevTarget,
      spawned_at: new Date(performance.timeOrigin + f.born).toISOString(),
      resolved_at: new Date(performance.timeOrigin + now).toISOString(),
      slash_path: null,   // gesture trace — can be filled in trySlice if needed
    });
    return outcome;
  }, []);

  /* ── handleStart → POST /smoothie/start ────────────────────────── */
  const handleStart = async () => {
    const userId = storeUser?.data?.user_id
    const screeningSessionId = storeScreening?.sessionId;
    try {
      const data = await apiStart(userId, screeningSessionId);
      sessionIdRef.current = data.game_session_id;
      stageIdRef.current = data.stage?.stage_id ?? 1;
      console.log("[SmoothieSlash] started session:", data.game_session_id, "stage:", data.stage?.stage_id);
    } catch (e) {
      console.warn("[SmoothieSlash] /smoothie/start failed — continuing offline:", e.message);
    }
    setScreen(SCREENS.COUNTDOWN); setCountdown(3);
  };

  useEffect(() => {
    if (screen !== SCREENS.COUNTDOWN) return;
    if (countdown === 0) { startGame(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 800);
    return () => clearTimeout(t);
  }, [screen, countdown]);

  const startGame = useCallback(() => {
    fruitsRef.current = []; halvesRef.current = []; popsRef.current = [];
    trailRef.current = []; eventsRef.current = [];
    splashDropsRef.current = []; rippleRef.current = [];
    pausedRef.current = false;
    engineRef.current = {
      t0: performance.now(), last: performance.now(),
      lastSpawn: 0, combo: 0, maxCombo: 0, stage: 0, cs: 0
    };
    scoreRef.current = 0;
    setScore(0); applyFill(0); setStageIdx(0); setTimeLeft(SESSION_SEC);
    setSplash(null); setPaused(false); setScreen(SCREENS.GAME);
    stageStartedAt.current = new Date().toISOString();
    showStageBanner(0);
  }, [showStageBanner, applyFill]);

  /* ── endGame → stage/complete for block 6, then game/complete ───── */
  const endGame = useCallback(async () => {
    // stop background music
    if (bgMusicRef.current) {
      bgMusicRef.current.pause();
      bgMusicRef.current.currentTime = 0;
      bgMusicRef.current = null;
    }
    const now = performance.now();
    const completedAt = new Date().toISOString();
    fruitsRef.current.filter(f => !f.sliced).forEach(f => logEvent(f, "NONE", now));
    fruitsRef.current = []; halvesRef.current = [];

    // push final block (block 6) slashes — response carries screening.next_stage
    const lastBlock = engineRef.current.stage + 1;
    const lastSlashes = eventsRef.current.filter(e => e.block_number === lastBlock);
    const finalRes = await pushStageComplete(stageIdRef.current, stageStartedAt.current, completedAt, lastSlashes);

    // derive next route from screening.next_stage in the final stage/complete response
    if (finalRes?.screening?.next_stage) {
      nextRouteRef.current = getNextRoute(finalRes.screening.next_stage, '/voice');
      console.log('[SmoothieSlash] next route from screening:', nextRouteRef.current);
    } else {
      console.warn('[SmoothieSlash] no screening.next_stage in final response — using fallback route:', nextRouteRef.current);
    }

    // call /smoothie/game/complete to get full metrics
    let rep = null;
    if (sessionIdRef.current) {
      try {
        rep = await apiGameComplete(sessionIdRef.current);
        console.log("[SmoothieSlash] game/complete →", rep);
      } catch (e) {
        console.warn("[SmoothieSlash] game/complete failed — using local metrics:", e.message);
      }
    }
    // local fallback
    if (!rep) rep = computeMetrics(eventsRef.current);
    setBest(b => Math.max(b, scoreRef.current));
    // Normalise: backend returns flat keys; local fallback returns {constructs:{…}, blocks:[…]}
    const normalised = rep?.divided_attention != null ? {
      constructs: {
        divided_attention: rep.divided_attention,
        selective_attention: rep.selective_attention,
        cognitive_flexibility: rep.cognitive_flexibility,
        working_memory: rep.working_memory,
        processing_speed: rep.processing_speed,
        sustained_attention: rep.sustained_attention,
      },
      blocks: [],   // not returned by game/complete — per-stage bars will show 0
    } : rep;
    setReport(normalised); setScreen(SCREENS.REPORT);
  }, [pushStageComplete, logEvent]);

  /* ── background music: start on mount, stop on unmount ─────────── */
  useEffect(() => {
    const bgm = new Audio(bgMusic);
    bgm.loop = true;
    bgm.volume = 0.4;
    bgm.play().catch(() => { });
    bgMusicRef.current = bgm;
    return () => {
      bgm.pause();
      bgm.currentTime = 0;
      bgMusicRef.current = null;
    };
  }, []);

  /* ── jar geometry ───────────────────────────────────────────────────
     Returns playfield-relative coordinates. `surfaceY` is the y of the
     juice surface and RISES as the jar fills, so halves land on the
     liquid rather than at a fixed point near the rim.                  */
  const jarGeom = useCallback((fillNow = fillRef.current) => {
    const p = playRef.current?.getBoundingClientRect();
    const j = jarRef.current?.getBoundingClientRect();
    if (!p || !j) return null;
    const left = j.left - p.left;
    const top = j.top - p.top;
    const innerTop = top + j.height * LIQ_TOP;
    const innerBottom = top + j.height * (1 - LIQ_BOTTOM);
    const innerH = innerBottom - innerTop;
    return {
      x: left + j.width * 0.5,                    // liquid area is centred
      w: j.width * (1 - LIQ_INSET_X * 2),
      top: innerTop,
      bottom: innerBottom,
      surfaceY: innerBottom - innerH * fillNow,
      counterY: top + j.height * 0.72,
    };
  }, []);

  /* ── game loop ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (screen !== SCREENS.GAME) return;
    // Reset timing on each mount — guards against React StrictMode double-mount
    // causing a spurious block-transition on the very first frame
    engineRef.current.t0 = performance.now();
    engineRef.current.last = performance.now();
    const loop = () => {
      const eng = engineRef.current;
      const now = performance.now();
      const dtRaw = Math.min(0.04, (now - eng.last) / 1000);
      eng.smoothDt = eng.smoothDt ? eng.smoothDt * 0.85 + dtRaw * 0.15 : dtRaw;
      const dt = eng.smoothDt;
      eng.last = now;
      const elapsed = (now - eng.t0) / 1000;
      if (elapsed >= SESSION_SEC) { endGame(); return; }
      setTimeLeft(Math.ceil(SESSION_SEC - elapsed));

      const sIdx = Math.min(5, Math.floor(elapsed / BLOCK_SEC));
      if (sIdx !== eng.stage) {
        const prevStageId = stageIdRef.current;
        const prevStartedAt = stageStartedAt.current;
        const completedAt = new Date().toISOString();
        const prevBlock = eng.stage;
        eng.stage = sIdx; eng.combo = 0; eng.cs = 0;
        setStageIdx(sIdx); applyFill(0);
        doBlockPause(sIdx);
        // send previous block's slashes then update stageId for the new block
        const blockSlashes = eventsRef.current.filter(e => e.block_number === prevBlock + 1);
        pushStageComplete(prevStageId, prevStartedAt, completedAt, blockSlashes).then(res => {
          if (res?.next_stage?.stage_id) stageIdRef.current = res.next_stage.stage_id;
        });
        stageStartedAt.current = completedAt;
      }

      /* skip physics while paused */
      if (!pausedRef.current) {
        const p = playRef.current?.getBoundingClientRect();
        const jar = jarGeom();
        if (p && jar) {
          const W = p.width, H = p.height;
          const alive = fruitsRef.current.filter(f => !f.sliced);
          if (now - eng.lastSpawn > SPAWN_MS && alive.length < MAX_ALIVE) {
            eng.lastSpawn = now;
            const st = STAGES[sIdx];
            const prev = sIdx > 0 ? STAGES[sIdx - 1].targets : [];
            let code;
            if (Math.random() < 0.55) code = st.targets[(Math.random() * 3) | 0];
            else {
              const dPrev = prev.filter(c => !st.targets.includes(c));
              const dRest = ALL_CODES.filter(c => !st.targets.includes(c) && !dPrev.includes(c));
              const pool = Math.random() < 0.5 && dPrev.length ? dPrev : dRest;
              code = pool[(Math.random() * pool.length) | 0];
            }
            const x0 = 50 + Math.random() * (W - 100);
            const peakY = H * (0.12 + Math.random() * 0.28);
            const vy0 = -Math.sqrt(2 * GRAVITY * (H + 20 - peakY));
            const vx0 = ((W / 2 - x0) / W) * 70 + (Math.random() - 0.5) * 60;
            fruitsRef.current.push({
              id: uid(), code, stageIdx: sIdx, wasPrevTarget: prev.includes(code),
              x: x0, y: H + 20, vx: vx0, vy: vy0,
              rot: Math.random() * 360, spin: (Math.random() - 0.5) * 200,
              born: now, sliced: false,
              mx: motionValue(x0), my: motionValue(H + 20), mr: motionValue(0)
            });
          }
          fruitsRef.current.forEach(f => {
            if (f.sliced) return;
            f.vy += GRAVITY * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.spin * dt;
            if (f.x < 28) { f.x = 28; f.vx = Math.abs(f.vx); }
            if (f.x > W - 28) { f.x = W - 28; f.vx = -Math.abs(f.vx); }
            if (f.y > H + 60 && f.vy > 0) { logEvent(f, "NONE", now); f.gone = true; };
            f.mx.set(f.x); f.my.set(f.y); f.mr.set(f.rot);
          });
          fruitsRef.current = fruitsRef.current.filter(f => !f.gone && !f.sliced);

          halvesRef.current.forEach(h => {
            if (h.rest) { if (now - h.rest > 600) h.gone = true; return; }
            if (h.landed) return;   // frozen in the liquid, animated by the renderer
            if (h.mode === "jar") {
              const tx = jar.x + h.jarOff;
              h.vx += (tx - h.x) * 14 * dt; h.vx *= 1 - Math.min(1, 2.5 * dt);
              h.vy += GRAVITY * 1.2 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.spin * dt;
              h.mx.set(h.x); h.my.set(h.y); h.mr.set(h.rot);
              // land on the juice surface, which rises with `fill`
              if (h.y >= jar.surfaceY) {
                h.landed = true;
                h.landT0 = now;
                h.landX = h.x;              // freeze position at point of impact
                h.landY = jar.surfaceY;     // freeze surface height at impact
                eng.cs += 0.5;              // two halves == one fruit
                const newFill = Math.min(1, eng.cs / FRUITS_TO_FILL);
                applyFill(newFill);
                setPulse(p => p + 1);
                setSplash({ t0: now, color: STAGES[eng.stage].juice });
                rippleRef.current.push({ id: uid(), t0: now, x: h.x, y: jar.surfaceY });
                if (newFill >= 0.5) {
                  for (let k = 0; k < 3; k++) {
                    splashDropsRef.current.push({
                      id: uid(), t0: now + k * 40,
                      variant: Math.random() < 0.5 ? splashDrop1 : splashDrop2,
                      dx: (Math.random() - 0.5) * 140,
                      rot: (Math.random() - 0.5) * 40,
                      scale: 0.5 + Math.random() * 0.4,
                    });
                  }
                }
              }
            } else {
              h.vy += GRAVITY * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.spin * dt;
              h.mx.set(h.x); h.my.set(h.y); h.mr.set(h.rot);
              const outside = Math.abs(h.x - jar.x) > jar.w / 2 + 18;
              if (h.y >= jar.counterY && h.vy > 0 && outside) { h.y = jar.counterY; h.rest = now; }
              if (h.y > H + 120) h.gone = true;
            }
          });
          halvesRef.current = halvesRef.current.filter(h => {
            if (h.landed) return now - h.landT0 < 500;      // sink animation duration
            return !h.gone && now - h.spawnT0 < 4000;       // spawnT0 is set in spawnHalves
          });
        }
      }
      popsRef.current = popsRef.current.filter(pp => now - pp.t0 < 900);
      trailRef.current = trailRef.current.filter(pt => now - pt.t < 260);
      splashDropsRef.current = splashDropsRef.current.filter(d => now - d.t0 < 700);
      rippleRef.current = rippleRef.current.filter(r => now - r.t0 < 500);
      const prevCounts = eng.prevCounts ?? {};
      const counts = {
        fruits: fruitsRef.current.length,
        halves: halvesRef.current.length,
        /* pops excluded — they don't affect physics, score flush handles their render */
        trail: trailRef.current.length,
        drops: splashDropsRef.current.length,
        ripples: rippleRef.current.length,
      };
      const changed = Object.keys(counts).some(k => counts[k] !== prevCounts[k]);
      eng.prevCounts = counts;
      /* Always flush score display; batch with forceTick when other counts changed too */
      if (changed || eng.prevScore !== scoreRef.current) {
        eng.prevScore = scoreRef.current;
        setScore(scoreRef.current);
        if (changed) forceTick(v => v + 1);
      }
      rafRef.current = requestAnimationFrame(loop);


    };

    rafRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, endGame, logEvent, pushStageComplete, doBlockPause, jarGeom, applyFill]);

  /* ── slashing ───────────────────────────────────────────────────── */
  const pointerDown = useRef(false);
  const lastPt = useRef(null);
  const strokeRef = useRef(null);
  const trailColorIdx = useRef(0);
  const getPt = e => {
    const r = playRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };
  const spawnHalves = (f, correct, W, now) => {
    const jar = jarGeom();
    /* All halves get motionValues so their x/y/rot updates bypass React's render path */
    const base = {
      code: f.code, y: f.y, rot: f.rot,
      spawnT0: now,
      mode: correct ? "jar" : "out",
    };
    if (correct) {
      halvesRef.current.push(
        {
          ...base, id: uid(), x: f.x - 20, vx: -40, vy: -90, spin: -160, side: "L", jarOff: -12,
          mx: motionValue(f.x - 20), my: motionValue(f.y), mr: motionValue(f.rot)
        },
        {
          ...base, id: uid(), x: f.x + 20, vx: 40, vy: -100, spin: 160, side: "R", jarOff: 12,
          mx: motionValue(f.x + 20), my: motionValue(f.y), mr: motionValue(f.rot)
        },
      );
    } else {
      const away = jar ? (f.x < jar.x ? -1 : 1) : (f.x < W / 2 ? -1 : 1);
      halvesRef.current.push(
        {
          ...base, id: uid(), x: f.x - 20, vx: away * (140 + Math.random() * 60), vy: -130, spin: -260, side: "L",
          mx: motionValue(f.x - 20), my: motionValue(f.y), mr: motionValue(f.rot)
        },
        {
          ...base, id: uid(), x: f.x + 20, vx: away * (180 + Math.random() * 60), vy: -100, spin: 260, side: "R",
          mx: motionValue(f.x + 20), my: motionValue(f.y), mr: motionValue(f.rot)
        },
      );
    }
  };
  /* ── slice sound helper — pre-pool Audio instances to avoid GC spikes ── */
  const POOL_SIZE = 4;
  const sliceSoundPools = useRef(null);
  if (!sliceSoundPools.current) {
    sliceSoundPools.current = [
      Array.from({ length: POOL_SIZE }, () => { const a = new Audio(cutSlice1); a.volume = 0.65; return a; }),
      Array.from({ length: POOL_SIZE }, () => { const a = new Audio(cutSlice2); a.volume = 0.65; return a; }),
    ];
  }
  const poolIdx = useRef([0, 0]);
  const playSliceSound = useCallback(() => {
    const bank = Math.random() < 0.5 ? 0 : 1;
    const pool = sliceSoundPools.current[bank];
    const idx = poolIdx.current[bank];
    const audio = pool[idx];
    audio.currentTime = 0;
    audio.play().catch(() => { });
    poolIdx.current[bank] = (idx + 1) % POOL_SIZE;
  }, []);

  const trySlice = (p1, p2) => {
    if (pausedRef.current) return;
    const eng = engineRef.current; const now = performance.now();
    const W = playRef.current ? playRef.current.getBoundingClientRect().width : 360;
    fruitsRef.current.forEach(f => {
      if (f.sliced) return;
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((f.x - p1.x) * dx + (f.y - p1.y) * dy) / len2));
      const cx = p1.x + t * dx, cy = p1.y + t * dy;
      const fruitR = (playRef.current?.getBoundingClientRect().height || 800) * FRUIT_R_BASE;
      if (Math.hypot(f.x - cx, f.y - cy) > fruitR) return;
      f.sliced = true;
      playSliceSound();
      const outcome = logEvent(f, "SLASH", now);
      const correct = outcome === "CS";
      spawnHalves(f, correct, W, now);
      if (correct) {
        eng.combo += 1; eng.maxCombo = Math.max(eng.maxCombo, eng.combo);
        let pts = PTS.CS;
        if (eng.combo % PTS.COMBO_EVERY === 0) {
          pts += PTS.COMBO_BONUS;
          popsRef.current.push({ id: uid(), x: f.x, y: f.y - 54, t0: now, text: `${eng.combo} COMBO +${PTS.COMBO_BONUS}`, kind: "combo" });
        }
        scoreRef.current += pts;
        /* score display is flushed in the rAF loop — no extra re-render here */
        popsRef.current.push({ id: uid(), x: f.x, y: f.y - 26, t0: now, text: `+${PTS.CS}`, kind: "good" });
      } else {
        eng.combo = 0;
        scoreRef.current = Math.max(0, scoreRef.current + PTS.IS);
        popsRef.current.push({ id: uid(), x: f.x, y: f.y - 26, t0: now, text: "-2  WRONG!", kind: "bad" });
      }
    });
  };
  const onDown = e => {
    if (screen !== SCREENS.GAME) return;
    pointerDown.current = true;
    const color = TRAIL_COLORS[trailColorIdx.current++ % TRAIL_COLORS.length];
    strokeRef.current = { sid: uid(), color };
    const pt = getPt(e);
    lastPt.current = pt;
    // inside onMove, replace: trailRef.current.push(pnt);
    trailRef.current.push({ ...pt, sid: strokeRef.current?.sid, color: strokeRef.current?.color });
  };
  const onMove = e => {
    if (!pointerDown.current || screen !== SCREENS.GAME) return;
    const pnt = getPt(e); trailRef.current.push(pnt);
    if (lastPt.current) trySlice(lastPt.current, pnt);
    lastPt.current = pnt;
  };
  const onUp = () => { pointerDown.current = false; lastPt.current = null; };

  /* ── derived UI ─────────────────────────────────────────────────── */
  const stage = STAGES[stageIdx];
  const mm = String(Math.floor(timeLeft / 60));
  const ss = String(timeLeft % 60).padStart(2, "0");
  const splashLive = splash && performance.now() - splash.t0 < 550;
  const constructs = report?.constructs ?? {};
  const jarSurfaceY = jarGeom()?.surfaceY ?? 0;   // playfield-relative, for ripples/halves
  const surfaceTop = `${surfaceTopPct(fill)}%`;   // jar-relative, for splash art
  // Bug 3 & 4 fix — derive real accuracy from report instead of hard-coded 40 / undefined STAGE_RESULTS
  const overallPct = Math.round((report?.constructs?.divided_attention ?? 0) * 100);
  const stageAccuracy = (report?.blocks ?? []).reduce((acc, b) => {
    acc[b.b] = { accuracyPct: Math.round((b.acc ?? 0) * 100) };
    return acc;
  }, {});
  // Maps overall accuracy % to a 0–3 star rating for the results screen
  const starCount = overallPct >= 90 ? 3 : overallPct >= 60 ? 2 : overallPct >= 30 ? 1 : 0;
  /* Banner CSS — three states:
     'center'  → big, dead-centre of playfield
     'settle'  → small, slides to top-centre below recipe chips
     null      → hidden                                               */
  const bannerStyle = bannerAnim === "center" ? {
    position: "absolute", left: "50%", top: "45%",
    transform: "translate(-50%,-50%) scale(1)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
    fontSize: "2.2vmax", padding: "18px 40px",
    background: "rgba(35,22,10,.88)", color: "#F7EFDF",
    borderRadius: 20, zIndex: 30,
    transition: "all 0.9s cubic-bezier(.4,0,.2,1)",
    pointerEvents: "none",
  } : bannerAnim === "settle" ? {
    position: "absolute", left: "50%", top: "22%",
    transform: "translate(-50%,-50%) scale(0.78)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
    fontSize: "2.2vmax", padding: "18px 40px",
    background: "rgba(35,22,10,.82)", color: "#F7EFDF",
    borderRadius: 20, zIndex: 30,
    transition: "all 0.9s cubic-bezier(.4,0,.2,1)",
    pointerEvents: "none",
  } : { display: "none" };

  const INTRO_SLIDES = [
    { type: "image", src: beAwareImg, alt: "Be aware" },
    { type: "image", src: howToDoImg, alt: "How to do" },
    { type: "image", src: howToPlayImg, alt: "How to play" },
  ];
  const CONSTRUCT_META = [
    ["divided_attention", "Divided Attention"],
    ["selective_attention", "Selective Attention"],
    ["cognitive_flexibility", "Cognitive Flexibility"],
    ["working_memory", "Working Memory"],
    ["processing_speed", "Processing Speed"],
    ["sustained_attention", "Sustained Attention"],
  ];

  return (
    <div className="w-full h-full minfullh flex flex-col" style={{ background: "#101B18", fontFamily: "'Nunito',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@500;700;800;900&display=swap');
        .fullh  { height:100vh; height:100dvh; }
        .minfullh { min-height:100vh; min-height:100dvh; }
        .display { font-family:'Lilita One','Nunito',sans-serif; letter-spacing:.02em; }
        @keyframes popUp { 0%{transform:translate(-50%,-40%) scale(.6);opacity:0} 15%{opacity:1;transform:translate(-50%,-60%) scale(1.08)} 100%{transform:translate(-50%,-140%) scale(1);opacity:0} }
        @keyframes jarSplash { 0%{transform:translateX(-50%) scaleY(.3);opacity:.95} 100%{transform:translateX(-50%) translateY(-26px) scaleY(1.15);opacity:0} }
        @keyframes mouthSplash { 0%{transform:translate(-50%,0) scale(.4);opacity:1} 100%{transform:translate(-50%,-18px) scale(1.5);opacity:0} }
        @keyframes pauseOverlayIn { from{opacity:0} to{opacity:1} }
      `}</style>

      {/* ── INSTRUCTION ──────────────────────────────────────────── */}
      {screen === SCREENS.INSTRUCTION && (
        <>
          <ProgressStage current={3} />
          <div
            className="flex-1 flex flex-col items-center justify-center"
            style={{
              backgroundImage: `url(${bg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              minHeight: "100vh",
              position: "relative",
            }}
          >
            <div className="absolute inset-0" style={{ background: "rgba(8,4,20,.4)", zIndex: 0 }} />

            <div
              className="relative flex flex-col items-center"
              style={{ zIndex: 1, width: "100%", minHeight: "100vh", padding: "48px 24px 56px", gap: 30 }}
            >
              {/* Slide */}
              <div
                className="flex-1 flex items-center justify-center w-full"
                style={{ minHeight: 0 }}
              >
                {INTRO_SLIDES[introStep].type === "image" ? (
                  <img
                    src={INTRO_SLIDES[introStep].src}
                    alt={INTRO_SLIDES[introStep].alt}
                    style={{
                      width: "100%",
                      maxHeight: "72vh",
                      objectFit: "contain",
                      borderRadius: 32,
                      boxShadow: "0 24px 60px rgba(0,0,0,.55)",
                    }}
                  />
                ) : (
                  <div
                    className="rounded-[36px] w-full"
                    style={{
                      background: "linear-gradient(180deg,rgba(46,26,74,.95),rgba(24,14,42,.95))",
                      border: "1px solid rgba(200,160,245,.25)",
                      padding: "34px 30px",
                      boxShadow: "0 24px 60px rgba(0,0,0,.55)",
                    }}
                  >
                    <p
                      className="text-center font-extrabold mb-7"
                      style={{ fontSize: "clamp(20px,1.8vw,28px)", color: "#E8D9F7", letterSpacing: ".22em" }}
                    >
                      TODAY'S RECIPE BOARD
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      {STAGES.map(s => (
                        <div
                          key={s.stageId}
                          className="flex items-center gap-3 rounded-2xl"
                          style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", padding: "14px" }}
                        >
                          <div className="flex gap-1.5">
                            {s.targets.map(c => (
                              <span key={c} className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, background: "rgba(255,255,255,.12)" }}>
                                <img src={FRUITS[c].img} alt={FRUITS[c].name} style={{ width: "72%", height: "72%", objectFit: "contain" }} />
                              </span>
                            ))}
                          </div>
                          <span className="font-bold" style={{ fontSize: "clamp(15px,1.2vw,19px)", color: "#EDE4F5" }}>
                            {s.stageName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Dots */}
              <div className="flex gap-3">
                {INTRO_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIntroStep(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    style={{
                      width: i === introStep ? 30 : 10,
                      height: 10,
                      borderRadius: 99,
                      background: i === introStep ? "#F5C842" : "rgba(255,255,255,.35)",
                      border: "none",
                      cursor: "pointer",
                      transition: "all .25s",
                    }}
                  />
                ))}
              </div>

              {/* Nav */}
              <div className="flex gap-4 w-full">
                {introStep > 0 && (
                  <button
                    onClick={() => setIntroStep(s => s - 1)}
                    className="display active:scale-95 transition-transform"
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,.12)",
                      color: "#F0E6C8",
                      border: "1px solid rgba(255,255,255,.25)",
                      borderRadius: 60,
                      padding: "20px 0",
                      fontSize: "clamp(20px,1.8vw,26px)",
                      fontWeight: 800,
                    }}
                  >
                    BACK
                  </button>
                )}
                {introStep < INTRO_SLIDES.length - 1 ? (
                  <button
                    onClick={() => setIntroStep(s => s + 1)}
                    className="display active:scale-95 transition-transform"
                    style={{
                      flex: 2,
                      background: "linear-gradient(180deg,#F5C842 0%,#E8A800 100%)",
                      color: "#2C1A00",
                      boxShadow: "0 10px 0 #A87400",
                      fontWeight: 900,
                      letterSpacing: ".08em",
                      fontSize: "clamp(24px,2.2vw,32px)",
                      padding: "22px 0",
                      borderRadius: 60,
                    }}
                  >
                    NEXT
                  </button>
                ) : (
                  <button
                    onClick={handleStart}
                    className="display active:scale-95 transition-transform"
                    style={{
                      flex: 2,
                      background: "linear-gradient(180deg,#F5C842 0%,#E8A800 100%)",
                      color: "#2C1A00",
                      boxShadow: "0 10px 0 #A87400",
                      fontWeight: 900,
                      letterSpacing: ".08em",
                      fontSize: "clamp(28px,2.4vw,36px)",
                      padding: "22px 0",
                      borderRadius: 60,
                    }}
                  >
                    START
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── COUNTDOWN ────────────────────────────────────────────── */}
      {
        screen === SCREENS.COUNTDOWN && (
          <div className="flex-1 flex items-center justify-center" style={{ background: "linear-gradient(180deg,#123A34,#0E2B26)" }}>
            <span className="display" style={{ fontSize: 140, color: "#FF9B6A" }}>{countdown === 0 ? "GO!" : countdown}</span>
          </div>
        )
      }

      {/* ── GAME ─────────────────────────────────────────────────── */}
      {
        screen === SCREENS.GAME && (
          <div ref={playRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
            className="relative flex-1 overflow-hidden cursor-crosshair select-none"
            style={{ touchAction: "none", minHeight: 480, backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center bottom" }}>

            {/* HUD */}
            <div className="absolute top-0 inset-x-0 pointer-events-none" style={{ zIndex: 20 }}>

              {/* TIME — fully independent, position anywhere via top/left */}
              <div
                className="absolute flex items-center justify-center"
                style={{
                  top: "40px",
                  left: "18px",
                  width: "min(16vw, 180px)",
                  aspectRatio: "286/304",
                  backgroundImage: `url(${timeFrame})`,
                  backgroundSize: "100% 100%",
                  backgroundRepeat: "no-repeat",
                  paddingTop: "1%",
                  zIndex: 22,
                }}
              >

                <span className="display font-black text-white text-2xl">
                  {mm}:{ss}
                </span>
              </div>

              {/* SCORE — fully independent, position anywhere via top/right */}
              <div
                className="absolute flex flex-col items-center justify-center"
                style={{
                  top: "40px",
                  right: "18px",
                  width: "min(16vw, 180px)",
                  aspectRatio: "256/290",
                  backgroundImage: `url(${scoreFrame})`,
                  backgroundSize: "100% 100%",
                  backgroundRepeat: "no-repeat",
                  paddingTop: "6%",
                  zIndex: 22,
                }}
              >
                <span className="display font-extrabold text-md text-amber-200 leading-none" >SCORE</span>
                <span className="display font-black text-white text-2xl leading-tight">
                  {score}
                </span>
              </div>

              {/* Target-fruit chips + stage name — hidden while banner is animating
                  (the banner itself shows the fruits during the transition) */}
              {!bannerAnim && (
                <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: "90px", zIndex: 21 }}>
                  <div className="flex gap-2.5">
                    {stage.targets.map(c => (
                      <div key={c} className="w-32 h-32 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.3)", backdropFilter: "blur(2px)", boxShadow: "0 4px 10px rgba(0,0,0,.35)" }}>
                        <img src={FRUITS[c].img} alt={FRUITS[c].name} style={{ width: "68%", height: "68%", objectFit: "contain" }} />
                      </div>
                    ))}
                  </div>
                  <p className="display mt-3 tracking-wider" style={{ fontSize: "1.4vmax", color: "#F0E6C8", textShadow: "0 2px 3px rgba(0,0,0,.35)" }}>
                    {stage.stageName.toUpperCase()}
                  </p>
                </div>
              )}
            </div>

            {/* Blender / Jar */}
            <div ref={jarRef} className="absolute left-1/2 -translate-x-1/2" style={{ zIndex: 5, bottom: "13%", width: "min(72%,260px)", aspectRatio: "672/803" }}>

              {/* Jar / blender art — sits at zIndex 1 (behind the liquid layer).
                  The blenderImage is a fully-opaque raster PNG so the liquid must
                  render ON TOP of it with mix-blend-mode: multiply to tint through. */}
              <div key={pulse} className="absolute inset-0" style={{ animation: "jarNudge .28s ease-out", zIndex: 1 }}>
                <img src={blenderImage} className="w-full h-full" alt="Blender" />
              </div>

              {/* Liquid — zIndex 2 (above the jar art), mix-blend-mode: multiply so the
                  juice colour tints the opaque jar image rather than sitting behind it.
                  Inset values here MUST match LIQ_TOP / LIQ_BOTTOM / LIQ_INSET_X above. */}
              <div
                className="absolute overflow-hidden"
                style={{
                  left: `${LIQ_INSET_X * 100}%`, right: `${LIQ_INSET_X * 100}%`,
                  top: `${LIQ_TOP * 100}%`, bottom: `${LIQ_BOTTOM * 100}%`,
                  borderRadius: "0 0 22px 22px",
                  zIndex: 2,
                  mixBlendMode: "multiply",
                }}
              >
                <div
                  className="absolute left-0 right-0 bottom-0"
                  style={{
                    height: `${fill * 100}%`,
                    background: `linear-gradient(180deg, ${stage.juice}BB 0%, ${stage.juice}EE 40%, ${stage.juice} 100%)`,
                    transition: "height .5s cubic-bezier(.34,1.56,.64,1)",
                    boxShadow: "inset 0 6px 10px rgba(255,255,255,.25), inset 0 -4px 14px rgba(0,0,0,.18)",
                  }}
                >
                  {/* two counter-drifting ellipses = sloshing surface */}
                  <div className="absolute" style={{
                    left: "-25%", right: "-25%", top: -9, height: 18, borderRadius: "50%",
                    background: stage.juice, filter: "brightness(1.1)",
                    animation: "slosh 2.6s ease-in-out infinite",
                  }} />
                  <div className="absolute" style={{
                    left: "-25%", right: "-25%", top: -6, height: 13, borderRadius: "50%",
                    background: "rgba(255,255,255,.35)", filter: "blur(1px)",
                    animation: "slosh 2.6s ease-in-out infinite reverse",
                  }} />
                  {BUBBLES.map(b => (
                    <div key={b.id} className="absolute" style={{
                      left: `${b.x}%`, bottom: 0, width: b.s, height: b.s,
                      borderRadius: "50%", background: "rgba(255,255,255,.35)",
                      animation: `rise ${b.dur}s linear ${b.delay}s infinite`,
                    }} />
                  ))}
                </div>
              </div>

              {/* Rim splash pop when a fruit lands — anchored to the juice surface */}
              {splashLive && fill < 1 && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: "50%", top: surfaceTop, width: "36%", height: 28,
                    transform: "translate(-50%,-50%)",
                    background: splash.color, borderRadius: "50%",
                    opacity: 0.9, animation: "jarSplash .55s ease-out forwards",
                    zIndex: 3,
                  }}
                />
              )}

              {/* Outward juice-drop particles once half-full+ */}
              {splashDropsRef.current.map(d => {
                const age = performance.now() - d.t0;
                if (age < 0) return null;
                const p = Math.min(1, age / 650);
                return (
                  <img
                    key={d.id}
                    src={d.variant}
                    alt=""
                    className="absolute pointer-events-none"
                    style={{
                      left: `calc(50% + ${d.dx}px)`,
                      top: surfaceTop,
                      width: 60 * d.scale,
                      transform: `translate(-50%,-60%) translateY(${-40 * p}px) rotate(${d.rot}deg)`,
                      opacity: 1 - p,
                      zIndex: 4,
                    }}
                  />
                );
              })}
              <style>{`@keyframes slosh { 0%,100%{transform:translateX(-6%) rotate(-1.2deg)} 50%{transform:translateX(6%) rotate(1.2deg)} }
@keyframes rise  { 0%{transform:translateY(0) scale(.6);opacity:0} 15%{opacity:.7} 100%{transform:translateY(-100%) scale(1.1);opacity:0} }
@keyframes jarNudge { 0%{transform:translateY(0)} 30%{transform:translateY(3px) scale(1.015,.985)} 100%{transform:translateY(0)} }`}</style>
            </div>

            {/* Animated stage banner — position driven entirely by transform (y), not top,
    so the browser never has to recompute layout mid-spring */}
            <AnimatePresence>
              {bannerAnim && (
                <motion.div
                  key="stage-banner"
                  initial={{ opacity: 0, scale: 0.7, y: bannerYOffset(playRef, "center") }}
                  animate={{
                    opacity: 1,
                    scale: bannerAnim === "settle" ? 0.78 : 1,
                    y: bannerYOffset(playRef, bannerAnim),
                  }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{
                    opacity: { duration: 0.25 },
                    scale: { type: "spring", stiffness: 220, damping: 24 },
                    y: { type: "spring", stiffness: 120, damping: 22 },
                  }}
                  onAnimationComplete={() => {
                    if (bannerAnim === "center") {
                      setBannerAnim("settle");                 // only NOW, once center truly finished
                    } else if (bannerAnim === "settle") {
                      setTimeout(() => {                        // this is a deliberate static hold, not mid-motion
                        setBannerAnim(null);
                        setBannerFruits([]);
                      }, BANNER_SETTLE_HOLD_MS);
                    }
                  }}
                  style={{
                    position: "absolute",
                    top: "32%",              // fixed anchor — never animated, so no layout cost
                    left: "50%",
                    x: "-50%",
                    willChange: "transform", // hints the browser to composite this on the GPU layer
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                    zIndex: 30,
                    pointerEvents: "none",
                  }}
                >
                  {bannerFruits.length > 0 && (
                    <div className="flex gap-2.5">
                      {bannerFruits.map(c => (
                        <div
                          key={c}
                          className="w-32 h-32 rounded-2xl flex items-center justify-center"
                          style={{
                            background: "rgba(255,255,255,.14)",
                            border: "1px solid rgba(255,255,255,.3)",
                            backdropFilter: "blur(2px)",
                            boxShadow: "0 4px 10px rgba(0,0,0,.35)",
                          }}
                        >
                          <img src={FRUITS[c].img} alt={FRUITS[c].name} style={{ width: "68%", height: "68%", objectFit: "contain" }} />
                        </div>
                      ))}
                    </div>
                  )}
                  <p
                    className="display tracking-wider text-center"
                    style={{ fontSize: "1.4vmax", color: "#F0E6C8", textShadow: "0 2px 3px rgba(0,0,0,.35)", whiteSpace: "nowrap" }}
                  >
                    {bannerText}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inter-block pause overlay — dims the scene */}
            {paused && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 25, background: "rgba(10,26,22,.45)", animation: "pauseOverlayIn .3s ease" }}>
              </div>
            )}

            {/* Fruits */}
            {fruitsRef.current.map(f => (
              <motion.div key={f.id} className="absolute pointer-events-none" style={{
                zIndex: 10,
                left: f.mx, top: f.my, rotate: f.mr,
                x: "-50%", y: "-50%",
                filter: "drop-shadow(0 4px 4px rgba(0,0,0,.25))", width: "6vmax", height: "6vmax"
              }}>
                <img src={FRUITS[f.code].img} alt={FRUITS[f.code].name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </motion.div>
            ))}

            {/* Surface ripples — playfield-relative, so they sit on the juice, not offset by the jar */}
            {rippleRef.current.map(r => {
              const p = Math.min(1, (performance.now() - r.t0) / 500);
              return (
                <div key={r.id} className="absolute pointer-events-none" style={{
                  left: r.x, top: r.y ?? jarSurfaceY,
                  transform: `translate(-50%,-50%) scale(${0.3 + p * 1.6})`,
                  width: 70, height: 18, borderRadius: "50%",
                  border: `2px solid ${stage.juice}`,
                  opacity: 0.6 * (1 - p),
                  zIndex: 11,
                }} />
              );
            })}

            {/* Halves */}
            {halvesRef.current.map(h => {
              if (h.landed) {
                const age = performance.now() - h.landT0;
                const p = Math.min(1, age / 500);                    // 0 → 1 over the sink duration
                const squash = 1 - 0.35 * Math.min(1, age / 120);    // quick squash on first ~120ms
                const sinkY = 14 * p;                                // drifts down into the liquid
                const fade = 1 - p;
                return (
                  <motion.div key={h.id} className="absolute pointer-events-none" style={{
                    zIndex: 10,
                    width: "5vmax", height: "5vmax",
                    left: h.mx, top: h.my, rotate: h.mr,
                    x: "-50%", y: "-50%",
                    clipPath: h.side === "L" ? "inset(0 52% 0 0)" : "inset(0 0 0 52%)",
                    opacity: h.rest ? Math.max(0, 1 - (performance.now() - h.rest) / 600) : 1,
                    filter: h.mode === "out" ? "grayscale(.45) brightness(.9)" : "brightness(1.1)",
                  }}>
                    <img src={FRUITS[h.code].cutImg} alt={FRUITS[h.code].name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </motion.div>
                );
              }
              return (
                /* Use motion.div + motionValues so position/rotation updates stay on the
                   GPU compositor path and never trigger a React layout pass              */
                <motion.div key={h.id} className="absolute pointer-events-none" style={{
                  zIndex: 10,
                  width: "5vmax", height: "5vmax",
                  left: h.mx, top: h.my, rotate: h.mr,
                  x: "-50%", y: "-50%",
                  clipPath: h.side === "L" ? "inset(0 52% 0 0)" : "inset(0 0 0 52%)",
                  opacity: h.rest ? Math.max(0, 1 - (performance.now() - h.rest) / 600) : 1,
                  filter: h.mode === "out" ? "grayscale(.45) brightness(.9)" : "brightness(1.1)",
                }}>
                  <img src={FRUITS[h.code].cutImg} alt={FRUITS[h.code].name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </motion.div>
              );
            })}

            {/* Slash trail — per-stroke coloured glow, grouped by stroke id */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
              <defs>
                <filter id="trailGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="5" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              {Object.values(trailRef.current.reduce((acc, pt) => {
                (acc[pt.sid] ??= { sid: pt.sid, color: pt.color, pts: [] }).pts.push(pt);
                return acc;
              }, {})).map(s => s.pts.length > 1 && (
                <g key={s.sid}>
                  <polyline points={s.pts.map(p => `${p.x},${p.y}`).join(" ")}
                    fill="none" stroke={s.color} strokeWidth="9"
                    strokeLinecap="round" strokeLinejoin="round"
                    filter="url(#trailGlow)" opacity="0.9" />
                  <polyline points={s.pts.map(p => `${p.x},${p.y}`).join(" ")}
                    fill="none" stroke="rgba(255,255,255,.95)" strokeWidth="3"
                    strokeLinecap="round" strokeLinejoin="round" />
                </g>
              ))}
            </svg>

            {/* Score pops */}
            {popsRef.current.map(pp => (
              <div key={pp.id} className="absolute display pointer-events-none" style={{
                zIndex: 10,
                left: pp.x, top: pp.y, animation: "popUp .9s ease-out forwards",
                fontSize: pp.kind === "combo" ? 15 : 18,
                color: pp.kind === "bad" ? "#E14B4B" : pp.kind === "combo" ? "#C86BE0" : "#FFD34D",
                textShadow: "0 2px 3px rgba(0,0,0,.4)"
              }}>
                {pp.text}
              </div>
            ))}
          </div>
        )
      }


      {/* ── REPORT ───────────────────────────────────────────────── */}
      {screen === SCREENS.REPORT && (
        <div
          className="flex-1 flex flex-col items-center gap-10 pt-48"
          style={{ backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center", minHeight: "100vh" }}
        >
          {/* Stars */}
          <div className="flex gap-3">
            <Star filled={starCount >= 1} />
            <Star filled={starCount >= 2} />
            <Star filled={starCount >= 3} />
          </div>

          {/* Score board */}
          <div
            className="relative flex flex-col items-center justify-center w-full"
            style={{
              maxWidth: 460,
              aspectRatio: "620/300",
              backgroundImage: `url(${scoreboardFrame})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
            }}
          >
            <span className="display font-black" style={{ fontSize: "clamp(34px,6vw,56px)", color: "#F5C842", textShadow: "0 3px 4px rgba(0,0,0,.5)" }}>
              {score}
            </span>
          </div>

          {/* Scroll */}
          <div
            className="relative w-full"
            style={{
              maxWidth: 980,
              aspectRatio: "1495/1247",
              backgroundImage: `url(${scrollFrame})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="absolute" style={{ left: "17%", right: "12%", top: "12%", bottom: "13%" }}>

              <div className="flex items-center justify-between mb-2">
                <h2 className="font-extrabold text-white" style={{ fontSize: "clamp(20px,2.6vw,32px)" }}>
                  RECIPES MADE CORRECTLY
                </h2>
                <span className="font-extrabold text-white" style={{ fontSize: "clamp(22px,3vw,34px)" }}>
                  {overallPct}%
                </span>
              </div>

              <div className="w-full rounded-full mb-6" style={{ height: 18, background: "rgba(255,255,255,.9)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${overallPct}%`,
                    background: "linear-gradient(90deg,#B77BFF,#8E3FE8)",
                    transition: "width .4s ease-out",
                  }}
                />
              </div>

              <div className="flex flex-col gap-3.5">
                {STAGES.map(s => {
                  const pct = stageAccuracy[s.stageId]?.accuracyPct ?? 0;
                  const barColor = pct >= 80 ? "#5DD62C" : pct >= 50 ? "#F5A623" : "#E8443C";
                  return (
                    <div key={s.stageId} className="flex items-center gap-3">
                      <div className="flex gap-1.5 shrink-0">
                        {s.targets.map(c => (
                          <div key={c} className="flex items-center justify-center rounded-xl" style={{ width: 58, height: 58, background: "rgba(255,255,255,.16)" }}>
                            <img src={FRUITS[c].img} alt={FRUITS[c].name} style={{ width: "78%", height: "78%", objectFit: "contain" }} />
                          </div>
                        ))}
                      </div>
                      <span className="font-bold text-white flex-1" style={{ fontSize: "clamp(15px,1.9vw,22px)" }}>
                        {s.stageName}
                      </span>
                      <div className="flex flex-col items-end shrink-0" style={{ width: 150 }}>
                        <span className="font-extrabold text-white mb-1" style={{ fontSize: "clamp(15px,1.7vw,19px)" }}>{pct}%</span>
                        <div className="w-full rounded-full" style={{ height: 10, background: "rgba(255,255,255,.9)" }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="absolute w-full text-center font-bold text-white" style={{ bottom: "6.5%", left: 0, fontSize: "clamp(14px,1.8vw,20px)" }}>
              Blend smarter, score higher.
            </div>
          </div>

          {/* NEXT */}
          <button
            onClick={handleNext}
            className="display active:scale-95 transition-transform"
            style={{
              background: "linear-gradient(180deg,#F5C842 0%,#E8A800 100%)",
              color: "#2C1A00",
              boxShadow: "0 10px 0 #A87400",
              fontWeight: 900,
              letterSpacing: ".08em",
              fontSize: "clamp(22px,2.2vw,30px)",
              padding: "25px 160px",
              borderRadius: 60,
            }}
          >
            NEXT
          </button>
        </div>
      )}
    </div >
  );
}