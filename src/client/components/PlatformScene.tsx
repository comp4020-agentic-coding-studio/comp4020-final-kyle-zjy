// Landing backdrop: an empty metro platform at 00:17, rails running into the
// dark and a headlight slowly growing out of the tunnel.
import { motion, useReducedMotion } from "motion/react";

const SLEEPERS = Array.from({ length: 14 }, (_, i) => i);
const LIGHTS = Array.from({ length: 7 }, (_, i) => i);

export function PlatformScene() {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg viewBox="0 0 400 700" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="ps-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b1026" />
            <stop offset="1" stopColor="#141a36" />
          </linearGradient>
          <linearGradient id="ps-track" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#05060d" />
            <stop offset="1" stopColor="#0a0d1d" />
          </linearGradient>
          <radialGradient id="ps-head" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff6dd" stopOpacity="1" />
            <stop offset="0.25" stopColor="#ffe3a3" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffe3a3" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ps-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe9b8" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffe9b8" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* tunnel mouth */}
        <rect x="150" y="300" width="100" height="70" rx="40" fill="#020308" />
        {/* ceiling lights receding */}
        {LIGHTS.map((i) => {
          const t = i / LIGHTS.length;
          const y = 300 - 280 * (1 - t) ** 1.6;
          const w = 8 + 120 * (1 - t) ** 1.8;
          return (
            <motion.rect
              key={i}
              x={200 - w / 2}
              y={y}
              width={w}
              height={2 + 4 * (1 - t)}
              rx="2"
              fill="#cfe8ff"
              initial={{ opacity: 0.5 }}
              animate={reduce ? { opacity: 0.55 } : { opacity: i === 2 ? [0.55, 0.15, 0.6, 0.55] : 0.55 }}
              transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 4 }}
              style={{ filter: "drop-shadow(0 0 6px #9fd0ff)" }}
            />
          );
        })}

        {/* track bed */}
        <path d="M185 370 L215 370 L330 700 L70 700 Z" fill="url(#ps-track)" />
        {SLEEPERS.map((i) => {
          const t = (i / SLEEPERS.length) ** 1.9;
          const y = 372 + t * 328;
          const half = 16 + t * 128;
          return <line key={i} x1={200 - half} y1={y} x2={200 + half} y2={y} stroke="#1a2040" strokeWidth={1 + t * 5} />;
        })}
        <path d="M193 370 L120 700" stroke="#59607f" strokeWidth="2.5" />
        <path d="M207 370 L280 700" stroke="#59607f" strokeWidth="2.5" />

        {/* platforms */}
        <path d="M0 360 L185 370 L70 700 L0 700 Z" fill="url(#ps-floor)" />
        <path d="M400 360 L215 370 L330 700 L400 700 Z" fill="url(#ps-floor)" />
        {/* yellow edge lines */}
        <path d="M181 371 L62 700" stroke="#c9a55a" strokeOpacity="0.7" strokeWidth="3" strokeDasharray="10 6" />
        <path d="M219 371 L338 700" stroke="#c9a55a" strokeOpacity="0.7" strokeWidth="3" strokeDasharray="10 6" />

        {/* headlight */}
        <motion.g
          initial={{ scale: 0.4, opacity: 0 }}
          animate={reduce ? { scale: 1, opacity: 0.9 } : { scale: [0.4, 1.05, 1], opacity: [0, 0.95, 0.85] }}
          transition={{ duration: 6, ease: "easeOut" }}
          style={{ transformOrigin: "200px 340px" }}
        >
          <path d="M188 340 L212 340 L300 700 L100 700 Z" fill="url(#ps-beam)" />
          <circle cx="200" cy="340" r="40" fill="url(#ps-head)" />
          <circle cx="200" cy="340" r="5" fill="#fffaf0" />
        </motion.g>
      </svg>
    </div>
  );
}
