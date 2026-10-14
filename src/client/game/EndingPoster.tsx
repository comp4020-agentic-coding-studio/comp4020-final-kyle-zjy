// The top of every results screen, composed to be screenshotted: the world's
// ending as a title card on the scenario's own backdrop, the run's last round,
// and the whole cast in a row. The words come from each scenario's existing
// ending text; this only frames them.
import { motion } from "motion/react";
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import type { PlayerView, ScenarioId } from "../../shared/game/state.ts";
import { Avatar } from "../components/Avatar.tsx";
import { useT } from "../i18n/index.ts";

const BACKDROP: Record<ScenarioId, { bg: string; line: string; accent: string }> = {
  S01_LAST_TRAIN: { bg: "radial-gradient(ellipse 90% 70% at 50% 0%, #1d2a3c 0%, #070a14 70%)", line: "repeating-linear-gradient(90deg, transparent 0 46px, rgb(188 200 165 / 0.07) 46px 48px)", accent: "#bcc8a5" },
  S02_SUNKEN_CITY: { bg: "linear-gradient(180deg, #0d2233 0%, #061521 55%, #0a2e47 100%)", line: "repeating-linear-gradient(0deg, transparent 0 10px, rgb(120 180 255 / 0.06) 10px 11px)", accent: "#9dbcca" },
  S03_INCIDENT_ZERO: { bg: "linear-gradient(115deg, #1f1708 0%, #0b0f1a 50%, #06202a 100%)", line: "repeating-linear-gradient(0deg, transparent 0 3px, rgb(255 255 255 / 0.03) 3px 4px)", accent: "#e8c97f" },
  S04_UNDERGROUND_AUCTION: { bg: "radial-gradient(ellipse 55% 60% at 50% 35%, #3a1b14 0%, #120707 60%, #050203 100%)", line: "none", accent: "#c3a563" },
};

export function EndingPoster({ g, kicker, title, won }: { g: PlayerView; kicker: string; title: string; won: boolean }) {
  const t = useT();
  const look = BACKDROP[g.scenarioId];
  return (
    <motion.header
      data-ending-poster
      className="relative min-w-0 overflow-hidden rounded-2xl border px-5 pt-8 pb-6 text-center shadow-[var(--shadow-card)]"
      style={{ background: look.bg, borderColor: `${look.accent}55` }}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8 }}
      aria-label={title}
    >
      <span className="pointer-events-none absolute inset-0" style={{ background: look.line }} aria-hidden="true" />
      <span className="pointer-events-none absolute inset-2 rounded-xl border border-white/5" aria-hidden="true" />
      <p className="label relative" style={{ color: won ? look.accent : "#e2563f" }}>{kicker}</p>
      <motion.h1 className="relative mt-3 font-display text-4xl leading-tight font-semibold text-moon sm:text-5xl" initial={{ opacity: 0, letterSpacing: "0.12em" }} animate={{ opacity: 1, letterSpacing: "0em" }} transition={{ delay: 0.3, duration: 1.1 }}>
        {title}
      </motion.h1>
      <p className="relative mt-3 font-mono text-xs tracking-widest text-mist uppercase">{t(`poster.${g.scenarioId}` as "poster.S01_LAST_TRAIN")} · {t("poster.round", { n: Math.max(1, g.round) })}</p>
      <ul className="relative mt-5 flex flex-wrap justify-center gap-2" aria-label={t("poster.cast")}>
        {g.turnOrder.map((id, i) => {
          const p = g.players[id];
          const ch = getCharacterById(p.characterId);
          return (
            <motion.li key={id} className="flex w-16 flex-col items-center gap-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.08 }}>
              <Avatar zodiac={ch.zodiac} mbti={ch.mbti} size={44} dim={p.lost} />
              <span className="w-full truncate text-[10px] text-mist">{p.nickname}</span>
            </motion.li>
          );
        })}
      </ul>
    </motion.header>
  );
}
