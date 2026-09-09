
export const DIRECTIONS = [
  {
    id: 'up',
    label: 'Up',
    angle: 0,
    rot: 90,
    shape: 'square',
  },
  {
    id: 'up-right',
    label: 'Up-Right',
    angle: 45,
    rot: 135,
    shape: 'diamond',
  },
  {
    id: 'right',
    label: 'Right',
    angle: 90,
    rot: 180,
    shape: 'square',
  },
  {
    id: 'down-right',
    label: 'Down-Right',
    angle: 135,
    rot: 225,
    shape: 'diamond',
  },
  {
    id: 'down',
    label: 'Down',
    angle: 180,
    rot: 270,
    shape: 'square',
  },
  {
    id: 'down-left',
    label: 'Down-Left',
    angle: 225,
    rot: 315,
    shape: 'diamond',
  },
  {
    id: 'left',
    label: 'Left',
    angle: 270,
    rot: 0,
    shape: 'square',
  },
  {
    id: 'up-left',
    label: 'Up-Left',
    angle: 315,
    rot: 45,
    shape: 'diamond',
  },
];

export function pickRandomDirection(excludeId) {
  const pool = excludeId ? DIRECTIONS.filter((d) => d.id !== excludeId) : DIRECTIONS;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

export const EYE_INFO = {
  right: { label: 'Right Eye', cover: 'left' },
  left: { label: 'Left Eye', cover: 'right' },
};

// eye state ('right'/'left') -> payload `type` value
export const EYE_TYPE = {
  right: 'right-eye',
  left: 'left-eye',
};

/* ------------------------------------------------------------------ */
/*  Size Levels — derived from "SuHi_Landolt_C_Adaptive_Game_Logic.xlsx"*/
/*  ('Size Levels' tab). Update KIOSK_CONFIG if the real hardware       */
/*  changes (matches the sheet's own "Update B5:B7 if..." note) —      */
/*  every px size below is recomputed from these four numbers, never   */
/*  hardcoded, so it can't silently drift from the spec.               */
/*                                                                      */
/*  Geometry, matching the sheet exactly:                              */
/*    arcmin        = D / 6                                            */
/*    gapWidth (mm)  = viewingDistanceMm * arcmin * (PI / (180 * 60))   */
/*    ringDiameter   = gapWidth * 5   (Landolt C convention)            */
/*    ringDiameterPx = ringDiameter(mm) / 25.4 * PPI                    */
/*    PPI            = sqrt(widthPx^2 + heightPx^2) / diagonalInches    */
/*                                                                      */
/*  NOTE: at Level 8-9 the ring is only a few CSS px (matching a real   */
/*  6/5–6/4 optotype at 2.5 ft) — that's the correct clinical behavior,*/
/*  not a bug, but it only reads as intended on the kiosk's actual      */
/*  panel at 100% zoom. On a normal dev monitor it will look almost     */
/*  invisible at high levels — verify on real hardware.                 */
/* ------------------------------------------------------------------ */
export const KIOSK_CONFIG = {
  viewingDistanceMm: 762, // 2.5 ft
  screenWidthPx: 1080,
  screenHeightPx: 2678,
  screenDiagonalIn: 12,
};

export const LEVEL_DENOMINATORS = [60, 36, 24, 18, 12, 9, 6, 5, 4]; // Level 1..9 -> Snellen 6/D

export function buildSizeLevels(config) {
  const ppi =
    Math.sqrt(config.screenWidthPx ** 2 + config.screenHeightPx ** 2) / config.screenDiagonalIn;

  return LEVEL_DENOMINATORS.map((d, i) => {
    const arcmin = d / 6;
    const gapWidthMm = config.viewingDistanceMm * arcmin * (Math.PI / (180 * 60));
    const ringDiameterMm = gapWidthMm * 5;
    const ringDiameterPx = (ringDiameterMm / 25.4) * ppi;
    return {
      level: i + 1,
      denominator: d,
      snellen: `6/${d}`,
      decimal: Math.round((6 / d) * 100) / 100,
      logMAR: Math.round(Math.log10(d / 6) * 100) / 100,
      pxSize: ringDiameterPx,
    };
  });
}

export const SIZE_LEVELS = buildSizeLevels(KIOSK_CONFIG);

/* ------------------------------------------------------------------ */
/*  Turns "last size level correctly identified" into the reportable   */
/*  result for one eye — including the below-chart / referral case.    */
/* ------------------------------------------------------------------ */
export function computeEyeResult(lastPassedLevel) {
  if (lastPassedLevel <= 0) {
    return {
      lastPassedLevel: 0,
      snellen: 'Below 6/60',
      decimal: null,
      logMAR: null,
      referral: true,
    };
  }
  const row = SIZE_LEVELS[lastPassedLevel - 1];
  return {
    lastPassedLevel,
    snellen: row.snellen,
    decimal: row.decimal,
    logMAR: row.logMAR,
    referral: false,
  };
}

/* ------------------------------------------------------------------ */
/*  Direction pad, center holds the Landolt C ring.                    */
/*  Buttons are positioned on a circle via trig (angle -> x/y %)       */
/*  rather than a 3x3 CSS grid — a plain grid puts the diagonal        */
/*  (corner) buttons noticeably farther from center than the cardinal  */
/*  (edge) buttons, which doesn't match the reference design, where    */
/*  all 8 buttons sit at roughly the same radius.                      */
/*  PAD_RADIUS_PERCENT is the one knob to tune spacing on real         */
/*  hardware — it's a % of the pad's half-width/half-height.           */
/* ------------------------------------------------------------------ */
export const PAD_RADIUS_PERCENT = 38;
