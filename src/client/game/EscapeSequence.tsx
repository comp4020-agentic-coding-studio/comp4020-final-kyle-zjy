// Act 3's centrepiece: the three escape locks, this round's count, and who
// carries each key. Every client sees the same server state light up; when
// the third lock holds, a short silence, then the door.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import { ESCAPE_LOCKS, KEY_FOR_LOCK } from "../../shared/game/scenario01/content.ts";
import type { EscapeLockId, PlayerView } from "../../shared/game/state.ts";
import { audio } from "../audio/manager.ts";
import { Avatar } from "../components/Avatar.tsx";
import { useT } from "../i18n/index.ts";
import { Icon } from "./Icon.tsx";

const LOOK: Record<EscapeLockId, { color: string; icon: string }> = {
  power: { color: "#e2563f", icon: "OPERATE" },
  identity: { color: "#a3a9c7", icon: "REGISTER" },
  memory: { color: "#9c86ff", icon: "FRAGMENT" },
};

export function EscapeSequence({ g }: { g: PlayerView }) {
  const t = useT();
  const thisRound = g.escape.round === g.round;
  const on = (l: EscapeLockId) => thisRound && g.escape[l];
  const count = ESCAPE_LOCKS.filter(on).length;
  const done = count === 3;
  const was = useRef(done);
  useEffect(() => {
    if (done && !was.current) {
      const timer = setTimeout(() => audio.play("door_unlock"), 650);
      was.current = done;
      return () => clearTimeout(timer);
    }
    was.current = done;
  }, [done]);
  if (g.act < 3) return null;
  return (
    <section aria-label={t("escape.title")} className="mx-auto w-full max-w-6xl px-3 sm:px-4">
      <div className={`rounded-xl border px-3 py-2 ${done ? "border-gold-bright bg-gold/10 shadow-[var(--glow-gold)]" : "border-ember/40 bg-[#1a0d12]/80"}`}>
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <p className="label text-[10px] text-ember">{t("escape.title")}</p>
          <p className="font-mono text-sm text-moon" aria-live="polite">{t("escape.count", { n: count })}</p>
        </div>
        <ol className="mt-2 grid grid-cols-3 gap-2">
          {ESCAPE_LOCKS.map((l, i) => {
            const holder = g.turnOrder.map((id) => g.players[id]).find((p) => p.items.includes(KEY_FOR_LOCK[l]));
            const ch = holder ? getCharacterById(holder.characterId) : null;
            const lit = on(l);
            return (
              <li key={l} className="min-w-0">
                <motion.div
                  className="relative flex min-h-12 flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center"
                  style={{ borderColor: lit ? LOOK[l].color : "#2a2f55", background: lit ? `${LOOK[l].color}22` : "transparent" }}
                  animate={lit ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                  transition={{ duration: 0.5, delay: done ? 0.6 + i * 0.12 : 0 }}
                >
                  <Icon name={lit ? LOOK[l].icon : "LOCK"} size={20} className={lit ? "" : "text-ash"} />
                  <span className="block w-full truncate text-[10px] font-bold tracking-wider" style={{ color: lit ? LOOK[l].color : undefined }}>{t(`train.lock.${l}`)}</span>
                  <span className="text-[10px] text-mist">{lit ? t("escape.on") : t("escape.off")}</span>
                  <span className="flex min-w-0 items-center gap-1 text-[10px] text-ash">
                    {ch ? <Avatar zodiac={ch.zodiac} mbti={ch.mbti} size={16} /> : <Icon name="KEY" size={10} />}
                    <span className="truncate">{holder ? holder.nickname : t("escape.noKey")}</span>
                  </span>
                </motion.div>
              </li>
            );
          })}
        </ol>
        <AnimatePresence mode="wait">
          <motion.p key={done ? "done" : count} className="mt-1.5 text-xs text-mist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {done ? t("escape.done") : t("escape.rule")}
          </motion.p>
        </AnimatePresence>
      </div>
    </section>
  );
}
