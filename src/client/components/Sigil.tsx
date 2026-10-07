// A zodiac medallion: astrolabe ring, tick marks and the sign's constellation.
// Stands in for portraits until PHASE 3's 192 avatars; never an emoji.
import { motion } from "motion/react";
import { ZODIAC_INFO } from "../../shared/characters/signs.ts";
import type { Zodiac } from "../../shared/characters/types.ts";

type Props = {
  zodiac: Zodiac | null;
  size?: number;
  /** Animate the constellation drawing itself (reveal moments). */
  draw?: boolean;
  dim?: boolean;
  className?: string;
};

const TICKS = Array.from({ length: 24 }, (_, i) => i);

export function Sigil({ zodiac, size = 64, draw = false, dim = false, className = "" }: Props) {
  const info = zodiac ? ZODIAC_INFO[zodiac] : null;
  const accent = info?.accent ?? "#3a4270";
  const gid = `sg-${zodiac ?? "none"}-${size}`;
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={info ? `${info.name} sigil` : "Empty seat"}
      style={{ opacity: dim ? 0.55 : 1 }}
    >
      <defs>
        <radialGradient id={gid} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor={accent} stopOpacity={info ? 0.35 : 0.08} />
          <stop offset="70%" stopColor="#0a0f22" stopOpacity="1" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="57" fill={`url(#${gid})`} stroke="#c9a55a" strokeOpacity={info ? 0.7 : 0.25} strokeWidth="1.5" />
      <circle cx="60" cy="60" r="49" fill="none" stroke="#c9a55a" strokeOpacity={info ? 0.28 : 0.12} strokeDasharray="2 3" />
      {TICKS.map((i) => {
        const a = (i / TICKS.length) * Math.PI * 2;
        const long = i % 2 === 0;
        const r1 = long ? 52 : 54;
        return (
          <line
            key={i}
            x1={60 + Math.cos(a) * r1}
            y1={60 + Math.sin(a) * r1}
            x2={60 + Math.cos(a) * 57}
            y2={60 + Math.sin(a) * 57}
            stroke="#c9a55a"
            strokeOpacity={info ? 0.5 : 0.15}
            strokeWidth={long ? 1.2 : 0.8}
          />
        );
      })}
      {info ? (
        <g transform="translate(26 26) scale(0.68)">
          {info.constellation.lines.map(([a, b], i) => {
            const [x1, y1] = info.constellation.stars[a];
            const [x2, y2] = info.constellation.stars[b];
            return (
              <motion.line
                key={`${zodiac}-l${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={accent}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeOpacity="0.85"
                initial={draw ? { pathLength: 0, opacity: 0 } : false}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: draw ? 0.2 + i * 0.12 : 0, ease: "easeOut" }}
              />
            );
          })}
          {info.constellation.stars.map(([x, y], i) => (
            <motion.circle
              key={`${zodiac}-s${i}`}
              cx={x}
              cy={y}
              r={i === 0 ? 3.6 : 2.6}
              fill="#f4ecd6"
              style={{ filter: `drop-shadow(0 0 3px ${accent})` }}
              initial={draw ? { scale: 0, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, delay: draw ? i * 0.09 : 0 }}
            />
          ))}
        </g>
      ) : (
        <g stroke="#3a4270" strokeWidth="1.5" fill="none">
          <circle cx="60" cy="50" r="12" />
          <path d="M36 88c4-14 14-20 24-20s20 6 24 20" />
        </g>
      )}
    </svg>
  );
}
