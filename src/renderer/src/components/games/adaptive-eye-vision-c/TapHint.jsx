import { Hand } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Small "tap here" hint shown over one button on the instruction      */
/*  screen's disabled preview pad (see reference screenshot)           */
/* ------------------------------------------------------------------ */
export default function TapHint() {
  return (
    <span className="absolute -bottom-2 -left-2 pointer-events-none">
      <span className="absolute inset-0 rounded-full bg-amber-300/40 animate-ping" />
      <Hand
        className="relative w-6 h-6 text-amber-300 drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]"
        style={{ transform: 'rotate(-35deg)' }}
        strokeWidth={2}
        fill="currentColor"
        fillOpacity={0.25}
      />
    </span>
  );
}
