// Event card illustrations: one small vector scene per event, on the card's
// night-blue field. Decorative; the card's text carries the meaning.
import type { EventCard } from "../../shared/game/scenario01/events.ts";

const G = "#e8c97f";
const S = "#5ce1e6";
const V = "#9c86ff";
const E = "#e2563f";

const SCENES: Record<EventCard["art"] | "brake_vote", React.ReactNode> = {
  bell: <g><path d="M100 30c-18 0-28 14-28 32v18l-8 10h72l-8-10V62c0-18-10-32-28-32z" fill="none" stroke={G} strokeWidth="2.5" /><circle cx="100" cy="98" r="5" fill={G} /><path d="M60 40l-10-6M140 40l10-6M56 58H44M144 58h12" stroke={G} strokeOpacity=".5" strokeWidth="2" /></g>,
  lights: <g>{[40, 80, 120, 160].map((x, i) => <rect key={x} x={x - 14} y="30" width="28" height="6" rx="2" fill={i === 2 ? "#3a4270" : "#cfe8ff"} opacity={i === 1 ? 0.4 : 1} />)}<path d="M60 110h80" stroke={S} strokeOpacity=".4" /><g fill={V} opacity=".7"><circle cx="70" cy="80" r="7" /><circle cx="100" cy="78" r="7" /><circle cx="130" cy="80" r="7" /><circle cx="150" cy="82" r="6" opacity=".4" /></g></g>,
  speaker: <g><path d="M70 55h18l24-18v66L88 85H70z" fill="none" stroke={G} strokeWidth="2.5" /><path d="M124 52a28 28 0 0 1 0 36M134 42a42 42 0 0 1 0 56" fill="none" stroke={S} strokeWidth="2" /></g>,
  umbrella: <g><path d="M50 70a50 40 0 0 1 100 0z" fill={E} opacity=".85" /><path d="M100 70v34a8 8 0 0 1-16 0" fill="none" stroke={G} strokeWidth="3" /><g stroke={S} strokeOpacity=".5">{[60, 80, 120, 140].map((x) => <path key={x} d={`M${x} 90v10`} />)}</g></g>,
  static: <g><rect x="62" y="28" width="76" height="84" rx="10" fill="none" stroke={S} strokeWidth="2.5" /><path d="M72 70l8-14 8 22 8-30 8 26 8-12 8 8 8-4" fill="none" stroke={V} strokeWidth="2.5" /></g>,
  suitcase: <g><rect x="58" y="48" width="84" height="56" rx="6" fill="none" stroke={G} strokeWidth="2.5" /><path d="M86 48v-8h28v8M58 70h84" stroke={G} strokeWidth="2" /><path d="M128 104l10 10" stroke={S} /><rect x="132" y="108" width="14" height="10" rx="2" fill={S} opacity=".6" /></g>,
  clock: <g><circle cx="100" cy="70" r="36" fill="none" stroke={G} strokeWidth="2.5" /><path d="M100 70V46M100 70l18 10" stroke={S} strokeWidth="3" strokeLinecap="round" /><path d="M100 34v6M100 100v6M64 70h6M130 70h6" stroke={G} /></g>,
  seat: <g><path d="M70 40h40v40H70z M70 80h60v14H70z M70 94v20M126 94v20" fill="none" stroke={G} strokeWidth="2.5" /><circle cx="96" cy="56" r="10" fill={V} opacity=".7" /><path d="M84 80c0-10 6-14 12-14s12 4 12 14" fill={V} opacity=".5" /></g>,
  window: <g><rect x="56" y="30" width="88" height="70" rx="12" fill="#0f1735" stroke={G} strokeWidth="2.5" /><path d="M62 84h76M80 84V64h14v20M110 84V58h16v26" stroke={S} strokeOpacity=".7" /><circle cx="124" cy="46" r="6" fill={G} opacity=".6" /></g>,
  draft: <g fill="none" stroke={V} strokeWidth="2.5" strokeLinecap="round"><path d="M40 50c30-10 50 10 80 0s30-8 40-4" /><path d="M40 72c30-10 50 10 80 0s30-8 40-4" opacity=".7" /><path d="M40 94c30-10 50 10 80 0s30-8 40-4" opacity=".4" /></g>,
  whistle: <g><path d="M60 60h50a20 20 0 1 1-20 20H60z" fill="none" stroke={G} strokeWidth="2.5" /><circle cx="110" cy="80" r="6" fill={G} /><path d="M128 44l10-10M136 56l14-4M118 38l2-14" stroke={E} strokeWidth="2" /></g>,
  music: <g fill={G}><path d="M80 90V40l50-10v50" fill="none" stroke={G} strokeWidth="3" /><ellipse cx="72" cy="92" rx="10" ry="7" /><ellipse cx="122" cy="82" rx="10" ry="7" /></g>,
  moon: <g><circle cx="80" cy="64" r="26" fill={G} opacity=".9" /><circle cx="132" cy="56" r="18" fill={V} opacity=".8" /><circle cx="138" cy="52" r="16" fill="#0c1129" /></g>,
  bolt: <g><path d="M108 24L72 76h24l-8 40 40-56h-26z" fill={E} opacity=".9" /><path d="M50 116h100" stroke={G} strokeOpacity=".4" /></g>,
  ticket: <g>{[[60, 40, -12], [96, 54, 8], [124, 34, 18]].map(([x, y, r], i) => <rect key={i} x={x} y={y} width="36" height="22" rx="3" fill="none" stroke={G} strokeWidth="2" transform={`rotate(${r} ${x + 18} ${y + 11})`} />)}</g>,
  count: <g><text x="100" y="82" textAnchor="middle" fontFamily="monospace" fontSize="40" fill={S}>0?</text><path d="M60 98h80" stroke={E} strokeWidth="2" strokeDasharray="4 4" /></g>,
  footsteps: <g fill={S} opacity=".8">{[[60, 96], [80, 78], [100, 92], [120, 72], [140, 86]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="6" ry="10" transform={`rotate(-20 ${x} ${y})`} opacity={1 - i * 0.15} />)}</g>,
  brake: <g><circle cx="100" cy="70" r="34" fill="none" stroke={E} strokeWidth="3" /><path d="M100 46v28" stroke={E} strokeWidth="4" strokeLinecap="round" /><circle cx="100" cy="90" r="3" fill={E} /></g>,
  voice: <g><path d="M68 48h64v40H96l-14 14V88H68z" fill="none" stroke={G} strokeWidth="2.5" /><path d="M82 64h36M82 74h24" stroke={S} /></g>,
  platform: <g><path d="M30 100h140" stroke={G} strokeWidth="3" /><path d="M30 104h140" stroke={G} strokeDasharray="10 6" strokeOpacity=".6" /><circle cx="130" cy="70" r="8" fill={V} /><path d="M130 78v16M130 82l10-10" stroke={V} strokeWidth="2.5" /></g>,
  brake_vote: <g><circle cx="100" cy="70" r="34" fill="none" stroke={E} strokeWidth="3" /><path d="M100 46v28" stroke={E} strokeWidth="4" strokeLinecap="round" /></g>,
};

export function EventArt({ art }: { art: keyof typeof SCENES }) {
  return (
    <svg viewBox="0 0 200 140" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id={`ev-${art}`} cx="50%" cy="45%" r="70%">
          <stop offset="0" stopColor="#1d2657" />
          <stop offset="1" stopColor="#070a18" />
        </radialGradient>
      </defs>
      <rect width="200" height="140" fill={`url(#ev-${art})`} />
      <g opacity=".25" fill="#fff">
        {Array.from({ length: 18 }, (_, i) => (
          <circle key={i} cx={(i * 47) % 200} cy={(i * 29) % 140} r={i % 3 ? 0.6 : 1} />
        ))}
      </g>
      {SCENES[art]}
    </svg>
  );
}
