// The round's public event as a card: it rises when drawn, shows its outcome
// when resolved, then folds into a small chip so it never covers the train.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { EVENT_BY_ID } from "../../shared/game/events.ts";
import type { PlayerView } from "../../shared/game/state.ts";
import { useFormat, useScenarioText, useT } from "../i18n/index.ts";
import { EventArt } from "./EventArt.tsx";
import { ref } from "../../shared/i18n/msg.ts";

const BIAS = { REWARD: "event.bias.REWARD", CRISIS: "event.bias.CRISIS", MIXED: "event.bias.MIXED" } as const;

export function EventPanel({ g }: { g: PlayerView }) {
  const ev = g.currentEvent;
  const t = useT();
  const fmt = useFormat();
  const events = useScenarioText().events;
  const [openKey, setOpenKey] = useState<string | null>(null);
  const key = ev ? `${ev.id}-${ev.round}` : null;

  // a newly drawn card opens big; it folds away a few seconds after resolving
  useEffect(() => {
    if (key && ev && ev.round === g.round) setOpenKey(key);
  }, [key]);
  useEffect(() => {
    if (!ev?.resolved || openKey !== key) return;
    const t = setTimeout(() => setOpenKey(null), 4500);
    return () => clearTimeout(t);
  }, [ev?.resolved, openKey, key]);

  if (!ev) return null;
  const card = EVENT_BY_ID.get(ev.id);
  // the emergency-brake vote isn't a deck card: its copy is the client's own
  const words = card ? (events[ev.id] ?? { title: fmt(ref.event(ev.id)), text: fmt(ref.eventText(ev.id)) }) : undefined;
  const info = card
    ? { title: words?.title ?? card.title, text: words?.text ?? card.text, art: card.art, bias: card.bias }
    : { title: t("event.brake.title"), text: t("event.brake.text"), art: "brake_vote" as const, bias: "MIXED" as const };
  const voting = g.pending.some((w) => w.kind === "VOTE" || w.kind === "EVENT_CHOICE");
  const big = openKey === key && !voting;

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl min-w-0 px-3 sm:px-4">
      <AnimatePresence mode="wait">
        {big ? (
          <motion.article
            key="big"
            className="tarot mx-auto mt-2 max-w-md overflow-hidden"
            initial={{ opacity: 0, rotateY: 80, y: 10 }}
            animate={{ opacity: 1, rotateY: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 22, stiffness: 180 }}
            onClick={() => setOpenKey(null)}
          >
            <div className="h-24 border-b border-gold/20">
              <EventArt art={info.art} />
            </div>
            <div className="p-3">
              <p className="label text-gold">
                {t("event.kicker", { n: ev.round, bias: t(BIAS[info.bias]) })}
              </p>
              <h3 className="mt-0.5 font-display text-xl font-semibold">{info.title}</h3>
              <p className="mt-1 text-sm text-mist">{info.text}</p>
              {ev.resolved && ev.resultText && <p className="mt-2 rounded-lg border border-gold/25 bg-gold/5 px-2 py-1.5 text-sm text-moon">{fmt(ev.resultText)}</p>}
            </div>
          </motion.article>
        ) : (
          <motion.button key="chip" onClick={() => setOpenKey(key)} className="mt-1 flex min-h-12 max-w-full items-center gap-2 rounded-full border border-gold/25 bg-[#0a0f22]/70 py-1 pr-3 pl-1 text-left" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <span className="h-7 w-10 shrink-0 overflow-hidden rounded-full">
              <EventArt art={info.art} />
            </span>
            <span className="min-w-0 truncate text-xs">
              <span className="text-gold">{t("event.chip", { n: ev.round })}</span> {info.title}
              {ev.resolved ? "" : t("event.unfolding")}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
