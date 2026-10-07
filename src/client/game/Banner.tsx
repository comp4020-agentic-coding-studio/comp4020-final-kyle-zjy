// Layer one: what is happening right now, in one line, big.
import { AnimatePresence, motion } from "motion/react";
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import type { PlayerView } from "../../shared/game/state.ts";
import { Avatar } from "../components/Avatar.tsx";
import { useFormat, useT, type TFunction } from "../i18n/index.ts";
import { useCountdown } from "./useCountdown.ts";

function headline(g: PlayerView, t: TFunction, fmt: ReturnType<typeof useFormat>): { key: string; text: string; tone: "you" | "other" | "table" } {
  const top = g.pending.at(-1);
  if (top && top.kind !== "FATE_SPEND") return { key: `w-${top.id}`, text: top.kind === "VOTE" ? t("banner.vote", { title: fmt(top.title) }) : fmt(top.title), tone: "table" };
  if (g.roll && !g.roll.done) return { key: `r-${g.roll.id}`, text: t("banner.rolling", { name: g.players[g.roll.playerId]?.nickname ?? t("common.Someone") }), tone: "table" };
  if (g.step === "INSPECTOR") return { key: "insp", text: t("banner.inspector"), tone: "table" };
  if (g.step === "ROUND_EVENT") return { key: "ev", text: t("banner.event"), tone: "table" };
  const active = g.step === "PLAYER_TURNS" ? g.turnOrder[g.activeIndex] : null;
  if (active === g.viewerId) return { key: `t-${g.round}-${active}`, text: t("banner.yourTurn"), tone: "you" };
  if (active) return { key: `t-${g.round}-${active}`, text: t("banner.theirTurn", { name: g.players[active].nickname }), tone: "other" };
  return { key: "between", text: t("banner.between"), tone: "table" };
}

export function Banner({ g }: { g: PlayerView }) {
  const t = useT();
  const fmt = useFormat();
  const h = headline(g, t, fmt);
  const active = g.step === "PLAYER_TURNS" ? g.players[g.turnOrder[g.activeIndex]] : null;
  const left = useCountdown(h.tone !== "table" ? g.turnDeadline : null);
  const ch = active ? getCharacterById(active.characterId) : null;
  return (
    <div className="relative z-10 px-3 pt-2 sm:px-4" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.div
          key={h.key}
          initial={{ opacity: 0, y: -8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 6 }}
          className={`mx-auto flex max-w-6xl items-center gap-3 rounded-xl border px-3 py-2 ${
            h.tone === "you" ? "border-signal/60 bg-signal/10 shadow-[var(--glow-signal)]" : "border-gold/20 bg-[#0a0f22]/70"
          }`}
        >
          {ch && h.tone !== "table" && <Avatar zodiac={ch.zodiac} mbti={ch.mbti} size={34} />}
          <p className={`min-w-0 flex-1 truncate font-display text-xl font-semibold sm:text-2xl ${h.tone === "you" ? "text-signal" : "text-moon"}`}>{h.text}</p>
          {h.tone === "you" && active && <span className="shrink-0 font-mono text-sm whitespace-nowrap text-gold-bright">{t("banner.ap", { n: active.ap })}</span>}
          {/* only an away player's turn has a clock: the grace before it passes */}
          {left !== null && active?.away && <span className="shrink-0 font-mono text-sm whitespace-nowrap text-ember">{t("banner.away", { n: left })}</span>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
