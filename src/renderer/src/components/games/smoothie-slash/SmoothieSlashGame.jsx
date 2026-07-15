import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import bg from '../../../assets/smoothie/bg.jpg';
import blenderImage from '../../../assets/smoothie/blender.png';

/* ── LOCAL TESTING MODE — API calls stubbed out ─────────────────────────
// import { SmoothieSession, SmoothieSlashBatch, SmoothieSessionComplete } from "../../../utils/api";
// import { getNextRoute } from "../../../utils/stageRouter";
   ────────────────────────────────────────────────────────────────────── */
const SmoothieSession = async () => ({ success: false });
const SmoothieSlashBatch = async () => ({ success: false });
const SmoothieSessionComplete = async () => ({ success: false });
const getNextRoute = () => "/";

const FRUITS = {
  ST: { emoji: "🍓", name: "Strawberry" },
  BA: { emoji: "🍌", name: "Banana" },
  BL: { emoji: "🫐", name: "Blueberry" },
  OR: { emoji: "🍊", name: "Orange" },
  MA: { emoji: "🥭", name: "Mango" },
  KI: { emoji: "🥝", name: "Kiwi" },
  CO: { emoji: "🥥", name: "Coconut" },
  PI: { emoji: "🍍", name: "Pineapple" },
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

const SESSION_SEC = 120;
const BLOCK_SEC = 20;
const SPAWN_MS = 650;
const MAX_ALIVE = 7;
const FRUIT_R_BASE = 0.045;   // fraction of playfield height — tune with fontSize below
const BANNER_MS = 1300;
const GRAVITY = 380;
const INTER_PAUSE = 1500;    // ms pause between blocks
const PTS = { CS: 15, IS: -2, COMBO_BONUS: 20, COMBO_EVERY: 5 };
const SCREENS = { INSTRUCTION: "INSTRUCTION", COUNTDOWN: "COUNTDOWN", GAME: "GAME", REPORT: "REPORT" };

const uid = () => Math.random().toString(36).slice(2, 9);
const clamp01 = v => (v == null || !isFinite(v) ? null : Math.max(0, Math.min(1, v)));

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

/* ════════════════════════════════════════════════════════════════════════ */
export default function SmoothieSlashGame() {
  const navigate = useNavigate();
  const storeUser = useSelector(s => s.common.user);

  const [screen, setScreen] = useState(SCREENS.INSTRUCTION);
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SESSION_SEC);
  const [stageIdx, setStageIdx] = useState(0);
  const [paused, setPaused] = useState(false);   // inter-block pause flag
  const [bannerAnim, setBannerAnim] = useState(null); // null | 'center' | 'settle'
  const [bannerText, setBannerText] = useState("");
  const [fill, setFill] = useState(0);
  const [splash, setSplash] = useState(null);
  const [best, setBest] = useState(0);
  const [report, setReport] = useState(null);
  const [, forceTick] = useState(0);

  const playRef = useRef(null);
  const jarRef = useRef(null);
  const fruitsRef = useRef([]);
  const halvesRef = useRef([]);
  const popsRef = useRef([]);
  const trailRef = useRef([]);
  const eventsRef = useRef([]);
  const flushedRef = useRef(0);
  const engineRef = useRef({});
  const rafRef = useRef(null);
  const sessionIdRef = useRef(null);
  const nextRouteRef = useRef("/colorblindness");
  const scoreRef = useRef(0);
  const pausedRef = useRef(false);   // readable inside rAF loop

  /* ── animated banner helper ─────────────────────────────────────────
     Phase 1 (0 ms)   : text appears at center  → bannerAnim = 'center'
     Phase 2 (900 ms) : slides to top-left HUD  → bannerAnim = 'settle'
     Phase 3 (1500 ms): banner clears            → bannerAnim = null
  ──────────────────────────────────────────────────────────────────── */
  const showBanner = useCallback((text) => {
    setBannerText(text);
    setBannerAnim("center");
    setTimeout(() => setBannerAnim("settle"), 900);
    setTimeout(() => setBannerAnim(null), 1500);
  }, []);

  /* ── inter-block pause ──────────────────────────────────────────────
     Clears all live fruits, shows the banner animation, resumes after
     INTER_PAUSE ms. Called inside the game loop when block flips.      */
  const doBlockPause = useCallback((newSIdx) => {
    fruitsRef.current = [];
    halvesRef.current = [];
    pausedRef.current = true;
    setPaused(true);
    showBanner(`GET READY — ${STAGES[newSIdx].stageName.toUpperCase()}`);
    setTimeout(() => {
      pausedRef.current = false;
      setPaused(false);
    }, INTER_PAUSE);
  }, [showBanner]);

  /* ── flush ──────────────────────────────────────────────────────── */
  const flushEvents = useCallback(async () => {
    const pending = eventsRef.current.slice(flushedRef.current);
    if (!pending.length || !sessionIdRef.current) return;
    flushedRef.current = eventsRef.current.length;
    const result = await SmoothieSlashBatch(sessionIdRef.current, pending);
    if (!result?.success) flushedRef.current -= pending.length;
  }, []);

  /* ── event log ──────────────────────────────────────────────────── */
  const logEvent = useCallback((f, action, now) => {
    const st = STAGES[f.stageIdx];
    const isTarget = st.targets.includes(f.code);
    const outcome = action === "SLASH" ? (isTarget ? "CS" : "IS") : (isTarget ? "IR" : "CR");
    eventsRef.current.push({
      slash_id: uid(), stage_id: st.stageId, block_number: f.stageIdx + 1,
      fruit_code: f.code, is_target: isTarget, was_prev_target: f.wasPrevTarget,
      action, outcome, is_perseverative: outcome === "IS" && f.wasPrevTarget,
      response_time_ms: action === "SLASH" ? Math.round(now - f.born) : null,
      points_awarded: action === "SLASH" ? (outcome === "CS" ? PTS.CS : PTS.IS) : 0,
      combo_at_event: engineRef.current.combo,
      spawned_at: new Date(performance.timeOrigin + f.born).toISOString(),
      resolved_at: new Date(performance.timeOrigin + now).toISOString(),
    });
    return outcome;
  }, []);

  /* ── handleStart ────────────────────────────────────────────────── */
  const handleStart = async () => {
    const userId = storeUser?.data?.user_id || "bdabcfad-558f-4d36-9cfd-5deaedfdd629";
    const screeningSessionId = storeUser?.screening?.session_id || "7f1bc0ab-2a7d-4061-9a8d-3b7ec6700e39";
    try {
      const result = await SmoothieSession(userId, screeningSessionId);
      if (result?.success) sessionIdRef.current = result?.data?.game_session_id ?? null;
    } catch (e) { console.warn("[SmoothieSlash] offline:", e?.message); }
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
    trailRef.current = []; eventsRef.current = []; flushedRef.current = 0;
    pausedRef.current = false;
    engineRef.current = {
      t0: performance.now(), last: performance.now(),
      lastSpawn: 0, combo: 0, maxCombo: 0, stage: 0, cs: 0
    };
    scoreRef.current = 0;
    setScore(0); setFill(0); setStageIdx(0); setTimeLeft(SESSION_SEC);
    setSplash(null); setPaused(false); setScreen(SCREENS.GAME);
    showBanner(`GET READY — ${STAGES[0].stageName.toUpperCase()}`);
  }, [showBanner]);

  /* ── endGame ────────────────────────────────────────────────────── */
  const endGame = useCallback(async () => {
    const now = performance.now();
    fruitsRef.current.filter(f => !f.sliced).forEach(f => logEvent(f, "NONE", now));
    fruitsRef.current = []; halvesRef.current = [];
    await flushEvents();
    let rep = null;
    if (sessionIdRef.current) {
      try {
        const r = await SmoothieSessionComplete(sessionIdRef.current, {
          final_score: scoreRef.current, max_combo: engineRef.current.maxCombo,
          ended_at: new Date().toISOString()
        });
        if (r?.success) { rep = r?.data ?? null; nextRouteRef.current = getNextRoute(r.screening?.next_stage, "/colorblindness"); }
      } catch (e) { }
    }
    if (!rep) rep = computeMetrics(eventsRef.current);
    setBest(b => Math.max(b, scoreRef.current));
    setReport(rep); setScreen(SCREENS.REPORT);
  }, [flushEvents, logEvent]);

  /* ── jar geometry ───────────────────────────────────────────────── */
  const jarPos = () => {
    const p = playRef.current?.getBoundingClientRect();
    const j = jarRef.current?.getBoundingClientRect();
    if (!p || !j) return null;
    return {
      x: j.left - p.left + j.width * 0.40,
      y: j.top - p.top + j.height * 0.08,
      w: j.width * 0.66,
      counterY: j.top - p.top + j.height * 0.72,
    };
  };

  /* ── game loop ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (screen !== SCREENS.GAME) return;
    engineRef.current.last = performance.now();
    const loop = () => {
      const eng = engineRef.current;
      const now = performance.now();
      const dt = Math.min(0.04, (now - eng.last) / 1000);
      eng.last = now;
      const elapsed = (now - eng.t0) / 1000;
      if (elapsed >= SESSION_SEC) { endGame(); return; }
      setTimeLeft(Math.ceil(SESSION_SEC - elapsed));

      const sIdx = Math.min(5, Math.floor(elapsed / BLOCK_SEC));
      if (sIdx !== eng.stage) {
        eng.stage = sIdx; eng.combo = 0; eng.cs = 0;
        setStageIdx(sIdx); setFill(0);
        doBlockPause(sIdx);
        flushEvents();
      }

      /* skip physics while paused */
      if (!pausedRef.current) {
        const p = playRef.current?.getBoundingClientRect();
        const jar = jarPos();
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
            });
          }
          fruitsRef.current.forEach(f => {
            if (f.sliced) return;
            f.vy += GRAVITY * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.spin * dt;
            if (f.x < 28) { f.x = 28; f.vx = Math.abs(f.vx); }
            if (f.x > W - 28) { f.x = W - 28; f.vx = -Math.abs(f.vx); }
            if (f.y > H + 60 && f.vy > 0) { logEvent(f, "NONE", now); f.gone = true; }
          });
          fruitsRef.current = fruitsRef.current.filter(f => !f.gone && !f.sliced);

          halvesRef.current.forEach(h => {
            if (h.rest) { if (now - h.rest > 600) h.gone = true; return; }
            if (h.mode === "jar") {
              const tx = jar.x + h.jarOff;
              h.vx += (tx - h.x) * 14 * dt; h.vx *= 1 - Math.min(1, 2.5 * dt);
              h.vy += GRAVITY * 1.2 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.spin * dt;
              if (h.y >= jar.y) {
                h.gone = true; eng.cs += 0.5;
                setFill(Math.min(1, eng.cs / 10));
                setSplash({ t0: now, color: STAGES[eng.stage].juice });
              }
            } else {
              h.vy += GRAVITY * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.spin * dt;
              const outside = Math.abs(h.x - jar.x) > jar.w / 2 + 18;
              if (h.y >= jar.counterY && h.vy > 0 && outside) { h.y = jar.counterY; h.rest = now; }
              if (h.y > H + 120) h.gone = true;
            }
          });
          halvesRef.current = halvesRef.current.filter(h => !h.gone);
        }
      }
      popsRef.current = popsRef.current.filter(pp => now - pp.t0 < 900);
      trailRef.current = trailRef.current.filter(pt => now - pt.t < 260);
      forceTick(v => v + 1);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, endGame, logEvent, flushEvents, doBlockPause]);

  /* ── slashing ───────────────────────────────────────────────────── */
  const pointerDown = useRef(false);
  const lastPt = useRef(null);
  const getPt = e => {
    const r = playRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };
  const spawnHalves = (f, correct, W) => {
    const jar = jarPos();
    const base = { code: f.code, y: f.y, rot: f.rot, mode: correct ? "jar" : "out" };
    if (correct) {
      halvesRef.current.push(
        { ...base, id: uid(), x: f.x - 20, vx: -40, vy: -90, spin: -160, side: "L", jarOff: -12 },
        { ...base, id: uid(), x: f.x + 20, vx: 40, vy: -100, spin: 160, side: "R", jarOff: 12 },
      );
    } else {
      const away = jar ? (f.x < jar.x ? -1 : 1) : (f.x < W / 2 ? -1 : 1);
      halvesRef.current.push(
        { ...base, id: uid(), x: f.x - 20, vx: away * (140 + Math.random() * 60), vy: -130, spin: -260, side: "L" },
        { ...base, id: uid(), x: f.x + 20, vx: away * (180 + Math.random() * 60), vy: -100, spin: 260, side: "R" },
      );
    }
  };
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
      const outcome = logEvent(f, "SLASH", now);
      const correct = outcome === "CS";
      spawnHalves(f, correct, W);
      if (correct) {
        eng.combo += 1; eng.maxCombo = Math.max(eng.maxCombo, eng.combo);
        let pts = PTS.CS;
        if (eng.combo % PTS.COMBO_EVERY === 0) {
          pts += PTS.COMBO_BONUS;
          popsRef.current.push({ id: uid(), x: f.x, y: f.y - 54, t0: now, text: `${eng.combo} COMBO +${PTS.COMBO_BONUS}`, kind: "combo" });
        }
        scoreRef.current += pts; setScore(scoreRef.current);
        popsRef.current.push({ id: uid(), x: f.x, y: f.y - 26, t0: now, text: `+${PTS.CS}`, kind: "good" });
      } else {
        eng.combo = 0;
        scoreRef.current = Math.max(0, scoreRef.current + PTS.IS); setScore(scoreRef.current);
        popsRef.current.push({ id: uid(), x: f.x, y: f.y - 26, t0: now, text: "-2  WRONG!", kind: "bad" });
      }
    });
  };
  const onDown = e => { if (screen !== SCREENS.GAME) return; pointerDown.current = true; lastPt.current = getPt(e); trailRef.current.push(lastPt.current); };
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

  /* Banner CSS — three states:
     'center'  → big, dead-centre of playfield
     'settle'  → small, slides to top-centre below recipe chips
     null      → hidden                                               */
  const bannerStyle = bannerAnim === "center" ? {
    position: "absolute", left: "50%", top: "45%",
    transform: "translate(-50%,-50%) scale(1)",
    fontSize: "2.2vmax", padding: "14px 36px",
    background: "rgba(35,22,10,.88)", color: "#F7EFDF",
    borderRadius: 20, whiteSpace: "nowrap", zIndex: 30,
    transition: "all 0.9s cubic-bezier(.4,0,.2,1)",
    pointerEvents: "none",
  } : bannerAnim === "settle" ? {
    position: "absolute", left: "50%", top: "22%",
    transform: "translate(-50%,-50%) scale(0.78)",
    fontSize: "2.2vmax", padding: "14px 36px",
    background: "rgba(35,22,10,.82)", color: "#F7EFDF",
    borderRadius: 20, whiteSpace: "nowrap", zIndex: 30,
    transition: "all 0.9s cubic-bezier(.4,0,.2,1)",
    pointerEvents: "none",
  } : { display: "none" };

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
        <div className="flex-1 flex flex-col" style={{
          backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center bottom",
          minHeight: "100vh", position: "relative"
        }}>
          {/* dark overlay so text is readable */}
          <div className="absolute inset-0" style={{ background: "rgba(10,24,20,.55)", zIndex: 0 }} />

          <div className="relative flex flex-col flex-1 px-6 pt-10 pb-6" style={{ zIndex: 1 }}>
            {/* header pill */}
            <div className="flex justify-center mb-5">
              <span className="font-extrabold tracking-widest px-7 py-3 rounded-full" style={{ fontSize: 18, background: "rgba(30,20,10,.75)", color: "#E8D9BB", letterSpacing: ".22em" }}>
                FRUIT SLASH KITCHEN
              </span>
            </div>

            {/* title */}
            <h1 className="display text-center leading-none" style={{ fontSize: "clamp(3.8rem,7vw,6rem)", color: "#F2E8CC", textShadow: "0 4px 12px rgba(0,0,0,.6)" }}>
              SMOOTHIE SLASH
            </h1>

            {/* rules card */}
            <div className="mt-6 rounded-3xl p-7" style={{ background: "rgba(25,18,8,.82)", border: "1px solid rgba(255,235,180,.15)" }}>
              <div className="flex gap-4 mb-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold" style={{ background: "#4CAF50", color: "#fff", fontSize: 22 }}>✓</div>
                <p className="font-semibold leading-snug" style={{ fontSize: 20, color: "#EDE4CE" }}>
                  Slash <span style={{ color: "#F2B34C", fontWeight: 900 }}>only the fruits</span> shown in the recipe at the top of the screen.
                </p>
              </div>
              <div className="flex gap-4 mb-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold" style={{ background: "#E53935", color: "#fff", fontSize: 22 }}>✕</div>
                <p className="font-semibold leading-snug" style={{ fontSize: 20, color: "#EDE4CE" }}>
                  Wrong fruit spoils the blend — <span style={{ color: "#E57373", fontWeight: 900 }}>−2 points</span> per miss.
                </p>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold" style={{ background: "#7B61FF", color: "#fff", fontSize: 22 }}>↻</div>
                <p className="font-semibold leading-snug" style={{ fontSize: 20, color: "#EDE4CE" }}>
                  The recipe <span style={{ color: "#C584F5", fontWeight: 900 }}>changes every 20s</span> — adapt fast and chain combos!
                </p>
              </div>
            </div>

            {/* recipe board */}
            <div className="mt-5 rounded-3xl p-6" style={{ background: "rgba(240,228,196,.92)" }}>
              <p className="text-center font-extrabold tracking-widest mb-4" style={{ fontSize: 15, color: "#7A5C28", letterSpacing: ".2em" }}>TODAY'S RECIPE BOARD</p>
              <div className="grid grid-cols-2 gap-3">
                {STAGES.map(s => (
                  <div key={s.stageId} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(255,248,230,.9)" }}>
                    <div className="flex gap-1">
                      {s.targets.map(c => (
                        <span key={c} className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "#EFE3C3", fontSize: 22 }}>
                          {FRUITS[c].emoji}
                        </span>
                      ))}
                    </div>
                    <span className="font-bold leading-tight" style={{ fontSize: 16, color: "#4A3210" }}>{s.stageName}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* clock pill */}
            <div className="flex justify-center mt-5">
              <span className="font-bold px-7 py-3 rounded-full" style={{ fontSize: 18, background: "rgba(30,20,10,.78)", color: "#E8D9BB" }}>
                ⏱ 2:00 on the clock · 6 recipes
              </span>
            </div>

            <div className="flex-1" />

            {/* START button */}
            <button onClick={handleStart} className="display active:scale-95 transition-transform mt-6"
              style={{
                background: "linear-gradient(180deg,#F5C842,#E8A800)", color: "#2C1A00",
                boxShadow: "0 8px 0 #A87400", fontWeight: 900, letterSpacing: ".06em",
                fontSize: 34, padding: "28px 0", borderRadius: 60, width: "100%"
              }}>
              START
            </button>
          </div>
        </div>
      )}

      {/* ── COUNTDOWN ────────────────────────────────────────────── */}
      {screen === SCREENS.COUNTDOWN && (
        <div className="flex-1 flex items-center justify-center" style={{ background: "linear-gradient(180deg,#123A34,#0E2B26)" }}>
          <span className="display" style={{ fontSize: 140, color: "#FF9B6A" }}>{countdown === 0 ? "GO!" : countdown}</span>
        </div>
      )}

      {/* ── GAME ─────────────────────────────────────────────────── */}
      {screen === SCREENS.GAME && (
        <div ref={playRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
          className="relative flex-1 overflow-hidden cursor-crosshair select-none"
          style={{ touchAction: "none", minHeight: 480, backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center bottom" }}>

          {/* HUD */}
          <div className="absolute top-0 inset-x-0 pointer-events-none px-5 pt-5" style={{ zIndex: 20 }}>
            <div className="flex items-start justify-between">
              <span className="display text-3xl" style={{ color: "#F0E6C8", textShadow: "0 2px 3px rgba(0,0,0,.35)" }}>⏱ {mm}:{ss}</span>
              <div className="text-right">
                <p className="display text-base leading-none" style={{ color: "#F0E6C8", textShadow: "0 2px 3px rgba(0,0,0,.35)" }}>SCORE</p>
                <p className="display text-4xl leading-tight" style={{ color: "#F0E6C8", textShadow: "0 2px 3px rgba(0,0,0,.35)" }}>{score}</p>
              </div>
            </div>
            <div className="flex flex-col items-center -mt-9">
              <div className="flex gap-2.5">
                {stage.targets.map(c => (
                  <div key={c} className="w-32 h-32 rounded-xl flex items-center justify-center"
                    style={{ background: "#EFE3C3", boxShadow: "0 2px 5px rgba(0,0,0,.3)", fontSize: "3.5rem" }}>
                    {FRUITS[c].emoji}
                  </div>
                ))}
              </div>
              {/* Stage name — static position in HUD; animation handled by bannerStyle */}
              <p className="display mt-3 tracking-wider" style={{ fontSize: "1.4vmax", color: "#F0E6C8", textShadow: "0 2px 3px rgba(0,0,0,.35)" }}>
                {stage.stageName.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Blender — bigger: 62% wide up to 260px */}
          <div ref={jarRef} className="absolute left-1/2 -translate-x-1/2" style={{ zIndex: 5, bottom: "2%", width: "min(70%,360px)", aspectRatio: "672/803" }}>
            <img src={blenderImage} alt="" draggable={false}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none" />
            <div className="absolute overflow-hidden pointer-events-none"
              style={{ left: "9%", width: "60%", bottom: "32%", height: "54%", borderRadius: "4px 4px 12px 12px" }}>
              <div className="absolute bottom-0 inset-x-0 transition-all duration-300"
                style={{ height: `${fill * 100}%`, background: stage.juice, opacity: 0.85 }} />
              {splashLive && (
                <div className="absolute left-1/2 w-16 h-7 rounded-full"
                  style={{ bottom: `${fill * 100}%`, background: splash.color, opacity: 0.9, animation: "jarSplash .55s ease-out forwards" }} />
              )}
            </div>
            {splashLive && (
              <div className="absolute w-10 h-5 rounded-full pointer-events-none"
                style={{ left: "40%", top: "2%", background: splash.color, animation: "mouthSplash .5s ease-out forwards" }} />
            )}
          </div>

          {/* Animated stage banner */}
          {bannerAnim && <div style={bannerStyle}>{bannerText}</div>}

          {/* Inter-block pause overlay — dims the scene */}
          {paused && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 25, background: "rgba(10,26,22,.45)", animation: "pauseOverlayIn .3s ease" }}>
            </div>
          )}

          {/* Fruits */}
          {fruitsRef.current.map(f => (
            <div key={f.id} className="absolute pointer-events-none" style={{
              zIndex: 10,
              left: f.x, top: f.y, transform: `translate(-50%,-50%) rotate(${f.rot}deg)`,
              filter: "drop-shadow(0 4px 4px rgba(0,0,0,.25))", fontSize: "6vmax"
            }}>
              {FRUITS[f.code].emoji}
            </div>
          ))}

          {/* Halves */}
          {halvesRef.current.map(h => (
            <div key={h.id} className="absolute pointer-events-none" style={{
              zIndex: 10,
              fontSize: "4vmax", left: h.x, top: h.y,
              transform: `translate(-50%,-50%) rotate(${h.rot}deg)`,
              clipPath: h.side === "L" ? "inset(0 52% 0 0)" : "inset(0 0 0 52%)",
              opacity: h.rest ? Math.max(0, 1 - (performance.now() - h.rest) / 600) : 1,
              filter: h.mode === "out" ? "grayscale(.45) brightness(.9)" : "brightness(1.1)"
            }}>
              {FRUITS[h.code].emoji}
            </div>
          ))}

          {/* Slash trail */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
            {trailRef.current.length > 1 && (
              <polyline points={trailRef.current.map(pt => `${pt.x},${pt.y}`).join(" ")}
                fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            )}
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
      )}

      {/* ── REPORT ───────────────────────────────────────────────── */}
      {screen === SCREENS.REPORT && (
        <div className="flex-1 flex flex-col overflow-y-auto" style={{
          backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center bottom",
          minHeight: "100vh", position: "relative"
        }}>
          <div className="absolute inset-0" style={{ background: "rgba(10,24,20,.45)", zIndex: 0 }} />
          <div className="relative flex flex-col flex-1 px-5 pt-8 pb-6" style={{ zIndex: 1 }}>

            {/* TIME'S UP pill */}
            <div className="flex justify-center mb-5">
              <span className="font-extrabold tracking-widest px-7 py-3 rounded-full flex items-center gap-2" style={{ fontSize: 18, background: "rgba(30,20,10,.82)", color: "#E8D9BB", letterSpacing: ".15em" }}>
                ⏱ TIME'S UP!
              </span>
            </div>

            {/* Stars */}
            {(() => {
              const acc = report?.constructs?.divided_attention ?? 0;
              const stars = acc >= 0.85 ? 3 : acc >= 0.65 ? 2 : 1;
              return (
                <div className="flex justify-center gap-3 mb-3">
                  {[1, 2, 3].map(i => (
                    <span key={i} style={{ fontSize: 56, filter: i <= stars ? "drop-shadow(0 3px 6px rgba(255,200,0,.7))" : "grayscale(1) opacity(.35)" }}>⭐</span>
                  ))}
                </div>
              );
            })()}

            {/* Score */}
            <h2 className="display text-center leading-none" style={{ fontSize: "clamp(3.5rem,8vw,5.5rem)", color: "#F2E8CC", textShadow: "0 4px 12px rgba(0,0,0,.6)" }}>
              SCORE {score.toLocaleString()}
            </h2>
            <p className="text-center font-extrabold mt-2" style={{ fontSize: 17, color: "#C9B88A", letterSpacing: ".18em" }}>BEST {best.toLocaleString()}</p>

            {/* Recipe accuracy card */}
            <div className="mt-5 rounded-3xl p-6" style={{ background: "rgba(240,228,196,.92)" }}>
              {(() => {
                const totalAcc = report?.constructs?.divided_attention;
                return (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-extrabold tracking-widest" style={{ fontSize: 14, color: "#7A5C28", letterSpacing: ".15em" }}>RECIPES MADE CORRECTLY</span>
                      <span className="display font-black" style={{ fontSize: 34, color: "#3A2800" }}>{totalAcc != null ? `${Math.round(totalAcc * 100)}%` : "—"}</span>
                    </div>
                    <div className="rounded-full mb-5" style={{ height: 14, background: "#D9C89A" }}>
                      <div className="rounded-full h-full" style={{ width: `${Math.round((totalAcc ?? 0) * 100)}%`, background: "#E8A800", transition: "width .6s" }} />
                    </div>
                  </>
                );
              })()}

              {/* Per-stage rows */}
              {(() => {
                const blocks = report?.blocks ?? [];
                return STAGES.map((s, i) => {
                  const b = blocks[i];
                  const acc = b?.acc ?? null;
                  const pct = acc != null ? Math.round(acc * 100) : null;
                  const color = pct >= 80 ? "#4CAF50" : pct >= 60 ? "#E8A800" : "#E57373";
                  return (
                    <div key={s.stageId} className="flex items-center gap-3 mb-4">
                      <div className="flex gap-1 flex-shrink-0">
                        {s.targets.map(c => (
                          <span key={c} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#EFE3C3", fontSize: 19 }}>{FRUITS[c].emoji}</span>
                        ))}
                      </div>
                      <span className="font-bold flex-shrink-0" style={{ fontSize: 17, color: "#3A2800", minWidth: 120 }}>{s.stageName}</span>
                      <div className="flex-1 rounded-full" style={{ height: 12, background: "#D9C89A" }}>
                        <div className="rounded-full h-full transition-all" style={{ width: `${pct ?? 0}%`, background: color }} />
                      </div>
                      <span className="font-extrabold flex-shrink-0" style={{ fontSize: 17, color: "#3A2800", minWidth: 46, textAlign: "right" }}>{pct != null ? `${pct}%` : "—"}</span>
                    </div>
                  );
                });
              })()}
            </div>

            {/* flavour text */}
            {(() => {
              const acc = report?.constructs?.divided_attention ?? 0;
              const msg = acc >= 0.85 ? "Perfect blend! Clean cuts all round." : acc >= 0.65 ? "Tasty! A few odd fruits snuck into the jug." : "Needs work — watch those distractors!";
              return (
                <div className="flex justify-center mt-4">
                  <span className="font-semibold px-7 py-3 rounded-full text-center" style={{ fontSize: 18, background: "rgba(30,20,10,.78)", color: "#E8D9BB", maxWidth: 500 }}>{msg}</span>
                </div>
              );
            })()}

            <div className="flex-1" />

            {/* PLAY AGAIN */}
            <button onClick={startGame} className="display active:scale-95 transition-transform mt-6"
              style={{
                background: "linear-gradient(180deg,#F5C842,#E8A800)", color: "#2C1A00",
                boxShadow: "0 8px 0 #A87400", fontWeight: 900, letterSpacing: ".06em",
                fontSize: 34, padding: "28px 0", borderRadius: 60, width: "100%"
              }}>
              PLAY AGAIN
            </button>
            <button onClick={() => navigate(nextRouteRef.current)} className="display active:scale-95 transition-transform mt-4"
              style={{
                background: "rgba(30,20,10,.75)", color: "#C9B88A", letterSpacing: ".12em",
                fontWeight: 900, fontSize: 22, padding: "18px 0", borderRadius: 60, width: "100%"
              }}>
              MENU
            </button>
          </div>
        </div>
      )}
    </div>
  );
}