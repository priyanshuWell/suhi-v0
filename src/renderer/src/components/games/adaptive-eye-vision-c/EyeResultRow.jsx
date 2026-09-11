/* ------------------------------------------------------------------ */
/*  One eye's result row inside the completed modal                    */
/* ------------------------------------------------------------------ */
export default function EyeResultRow({ label, result }) {
  if (!result) return null;
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-left">
      <span className="text-[#8BC3E5] font-anta" style={{ fontSize: 'clamp(0.9rem, 2vw, 1.25rem)' }}>
        {label}
      </span>
      <span className="text-right">
        <span
          className={`block font-anta tracking-wide ${result.referral ? 'text-rose-400' : 'text-white'}`}
          style={{ fontSize: 'clamp(1rem, 2.2vw, 1.4rem)' }}
        >
          {result.snellen}
        </span>
        {!result.referral && (
          <span className="block text-white/40 font-anta" style={{ fontSize: 'clamp(0.7rem, 1.5vw, 0.9rem)' }}>
            logMAR {result.logMAR}
          </span>
        )}
      </span>
    </div>
  );
}
