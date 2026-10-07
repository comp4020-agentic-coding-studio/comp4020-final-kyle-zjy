// Nothing in a run has a time limit, so a table can stall on someone who has
// stepped away from the screen. After 30 s of waiting on the same thing, the
// host (and only the host) gets one button that moves it along a single step:
// the waiting decision takes its default, the scene ends, or the turn passes.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { PlayerView } from "../../shared/game/state.ts";
import { useT, type TFunction } from "../i18n/index.ts";
import { sendLobby, useMe } from "../store.ts";

const PATIENCE_MS = 30_000;

/** What the table is waiting on, if it's someone other than the viewer. */
function waitingOn(g: PlayerView, t: TFunction): { key: string; who: string[]; label: string } | null {
  const name = (id: string) => g.players[id]?.nickname ?? t("common.someone");
  const others = (ids: string[]) => ids.filter((id) => id !== g.viewerId && !g.players[id]?.away);
  const w = g.pending.at(-1);
  if (w) {
    const who = others(w.addressees.filter((id) => !w.answeredBy.includes(id)));
    return who.length ? { key: `w:${w.id}:${who.join()}`, who, label: t("host.default", { names: who.map(name).join(t("common.listSep")) }) } : null;
  }
  if (g.sequence) {
    const who = others(g.turnOrder.filter((id) => !g.sequence!.acks.includes(id)));
    return who.length ? { key: `s:${g.sequence.kind}`, who, label: t("host.endScene") } : null;
  }
  const active = g.step === "PLAYER_TURNS" ? g.turnOrder[g.activeIndex] : undefined;
  if (active && others([active]).length) return { key: `t:${g.round}:${g.activeIndex}`, who: [active], label: t("host.skipTurn", { name: name(active) }) };
  return null;
}

export function HostSkip({ g }: { g: PlayerView }) {
  const me = useMe();
  const t = useT();
  const wait = me?.isHost ? waitingOn(g, t) : null;
  const [since, setSince] = useState<{ key: string; at: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!wait) return setSince(null);
    if (since?.key !== wait.key) setSince({ key: wait.key, at: Date.now() });
  }, [wait?.key]);
  useEffect(() => {
    if (!wait) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [wait?.key]);
  const show = !!wait && !!since && since.key === wait.key && now - since.at >= PATIENCE_MS;
  const names = wait?.who.map((id) => g.players[id]?.nickname ?? t("common.someone")).join(t("common.listSep"));
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="host-skip"
          className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-[65] flex justify-center px-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
        >
          <div className="flex max-w-md min-w-0 items-center gap-3 rounded-full border border-gold/40 bg-night py-1.5 pr-1.5 pl-4 shadow-[var(--shadow-card)]" role="status">
            <span className="min-w-0 truncate text-sm text-mist">{t("host.stillWaiting", { names: names ?? "" })}</span>
            <button className="btn btn-ghost min-h-12 shrink-0 px-4 text-sm" onClick={() => void sendLobby({ type: "SKIP_WAITING" })}>
              {wait!.label}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
