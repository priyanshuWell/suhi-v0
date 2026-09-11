import FatArrowIcon from './FatArrowIcon';

/* ------------------------------------------------------------------ */
/*  One direction button (square or 45°-rotated diamond).              */
/*  Matches the reference design: deep navy->azure gradient, a soft    */
/*  white radial glow behind the icon, a faint edge stroke, and a      */
/*  single shared corner-radius fraction for both square and diamond   */
/*  (the design uses the same rx for both — the diamond just looks     */
/*  more rounded because it's rotated 45°, not because rx differs).    */
/* ------------------------------------------------------------------ */
export default function DirectionButton({
  dir,
  disabled = false,
  feedback = null,
  onClick,
}) {
  const isDiamond = dir.shape === 'diamond';

  const feedbackBackground =
    feedback === 'correct'
      ? 'linear-gradient(135deg, #34D399 0%, #059669 100%)'
      : feedback === 'incorrect'
        ? 'linear-gradient(135deg, #FB7185 0%, #E11D48 100%)'
        : 'linear-gradient(135deg, #0097D6 0%, #002EB9 100%)';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={dir.label}
      className="
        relative
        flex
        items-center
        justify-center
        w-14
        h-14
        sm:w-24
        sm:h-24
        rounded-[28px]
        border
        border-white/20
        shadow-[0px_8px_20px_rgba(0,0,0,0.25)]
        transition-transform
        duration-150
        active:scale-95
        disabled:cursor-not-allowed
        overflow-hidden
      "
      style={{
        transform: isDiamond ? 'rotate(45deg)' : 'rotate(0deg)',
        background: feedbackBackground,
      }}
    >
      {/* Inner glow */}
      <span
        className="
          absolute
          inset-0
          pointer-events-none
          rounded-[inherit]
        "
        style={{
          background:
            'radial-gradient(43.11% 181.04% at 50% 50%, #003FFD 0%, #00B3FF 100%)',
          boxShadow:
            '0px 0px 30px rgba(0,179,255,0.5), inset 0px 0px 20px rgba(255,255,255,0.3)',
        }}
      />

      {/* Fat arrow */}
      <span
        className="relative flex items-center justify-center"
        style={{
          transform: isDiamond ? 'rotate(-45deg)' : undefined,
        }}
      >
        <FatArrowIcon
          className="w-7 h-7 sm:w-11 sm:h-11 text-white"
          style={{ transform: `rotate(${dir.angle}deg)` }}
        />
      </span>
    </button>
  );
}
