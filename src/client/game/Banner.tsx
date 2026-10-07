// Layer one: what is happening right now, in one line, big.
import { AnimatePresence, motion } from "motion/react";
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import type { PlayerView } from "../../shared/game/state.ts";
import { Avatar } from "../components/Avatar.tsx";
import { useCountdown } from "./useCountdown.ts";

function headline(g: PlayerView): { key: string; text: string; tone: "you" | "other" | "table" } {
  const top = g.pending.at(-1);
  if (top && top.kind !== "FATE_SPEND") return { key: `w-${top.id}`, text: top.kind === "VOTE" ? `Vote: ${top.title}` : top.title, tone: "table" };
  if (g.roll && !g.roll.done) return { key: `r-${g.roll.id}`, text: `${g.players[g.roll.playerId]?.nickname ?? "Someone"} is rolling`, tone: "table" };
  if (g.step === "INSPECTOR") return { key: "insp", text: "The Inspector is moving", tone: "table" };
  if (g.step === "ROUND_EVENT") return { key: "ev", text: "An event is unfolding", tone: "table" };
  const active = g.step === "PLAYER_TURNS" ? g.turnOrder[g.activeIndex] : null;
  if (active === g.viewerId) return { key: `t-${g.round}-${active}`, text: "Your turn", tone: "you" };
  if (active) return { key: `t-${g.round}-${active}`, text: `${g.players[active].nickname}'s turn`, tone: "other" };
  return { key: "between", text: "Between rounds", tone: "table" };
}

export function Banner({ g }: { g: PlayerView }) {
  const h = headline(g);
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
          {h.tone === "you" && active && <span className="font-mono text-sm text-gold-bright">{active.ap} AP</span>}
          {/* only an away player's turn has a clock: the grace before it passes */}
          {left !== null && active?.away && <span className="font-mono text-sm text-ember">away · {left}s</span>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
