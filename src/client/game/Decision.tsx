// Every decision the table waits on (except Fate, which lives on the die):
// reactions, passives, votes, event choices, trade offers, the final choice.
// The addressee gets a card with the options and a countdown ring; everyone
// else sees who the table is waiting for.
import { AnimatePresence, motion } from "motion/react";
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import { EVENT_BY_ID } from "../../shared/game/scenario01/events.ts";
import type { PlayerView, PublicWindow } from "../../shared/game/state.ts";
import { Avatar } from "../components/Avatar.tsx";
import { sendGame } from "../store.ts";
import { EventArt } from "./EventArt.tsx";
import { useCountdown } from "./useCountdown.ts";

const KIND_LABEL: Record<PublicWindow["kind"], string> = {
  FATE_SPEND: "Fate",
  REACTION: "Your ability can answer",
  PASSIVE_CONFIRM: "Your ability's moment",
  TARGET_CHOICE: "Choose",
  EVENT_CHOICE: "Everyone chooses",
  VOTE: "Vote",
  TRADE_OFFER: "Trade offer",
  ENDING_CHOICE: "The last choice",
  SKILL_CHOICE: "Your ability",
};

export function DecisionLayer({ g }: { g: PlayerView }) {
  const w = g.pending.at(-1);
  if (!w || w.kind === "FATE_SPEND") return null;
  const mine = w.addressees.includes(g.viewerId) && !w.myAnswer;
  return <AnimatePresence>{mine ? <DecisionCard key={w.id} g={g} w={w} /> : <Waiting key={`wait-${w.id}`} g={g} w={w} />}</AnimatePresence>;
}

function Ring({ w }: { w: PublicWindow }) {
  const left = useCountdown(w.deadlineAt) ?? 0;
  const total = Math.max(1, Math.round((w.deadlineAt - (w.deadlineAt - 30_000)) / 1000));
  const pct = Math.min(1, left / total);
  return (
    <span className="relative flex h-11 w-11 items-center justify-center" aria-label={`${left} seconds left`}>
      <svg width="44" height="44" viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r="19" fill="none" stroke="#1d2657" strokeWidth="3" />
        <circle cx="22" cy="22" r="19" fill="none" stroke={left <= 5 ? "#e2563f" : "#5ce1e6"} strokeWidth="3" strokeDasharray={`${pct * 119.4} 119.4`} />
      </svg>
      <span className="font-mono text-sm">{left}</span>
    </span>
  );
}

function DecisionCard({ g, w }: { g: PlayerView; w: PublicWindow }) {
  const isEvent = (w.kind === "VOTE" || w.kind === "EVENT_CHOICE") && g.currentEvent;
  const card = isEvent ? EVENT_BY_ID.get(g.currentEvent!.id) : null;
  const owner = w.ownerId ? g.players[w.ownerId] : null;
  const ownerChar = owner ? getCharacterById(owner.characterId) : null;
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-[2px] sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`dlg-${w.id}`}
        className="tarot safe-bottom w-full max-w-md overflow-hidden"
        initial={{ y: 40, rotateX: 25, opacity: 0 }}
        animate={{ y: 0, rotateX: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 240 }}
      >
        {card && (
          <div className="relative h-28 overflow-hidden border-b border-gold/20">
            <EventArt art={card.art} />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="label text-gold">{KIND_LABEL[w.kind]}</p>
              <h2 id={`dlg-${w.id}`} className="mt-1 font-display text-2xl leading-tight font-semibold">
                {w.title}
              </h2>
            </div>
            <Ring w={w} />
          </div>
          {(w.kind === "REACTION" || w.kind === "PASSIVE_CONFIRM") && ownerChar && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-violet/40 bg-violet/10 p-2">
              <Avatar zodiac={ownerChar.zodiac} mbti={ownerChar.mbti} size={44} />
              <div className="min-w-0">
                <p className="font-display text-lg text-gold-bright">{getCharacterById(owner!.skill.borrowed ?? owner!.characterId).skill.name}</p>
                <p className="text-xs text-mist">{getCharacterById(owner!.skill.borrowed ?? owner!.characterId).skill.description}</p>
              </div>
            </div>
          )}
          <p className="mt-3 text-sm leading-relaxed text-mist">{w.prompt}</p>
          <div className="mt-4 grid gap-2">
            {w.options.map((o, i) => (
              <button
                key={o.id}
                className={`btn min-h-14 flex-col items-start gap-0 rounded-xl px-4 py-2 text-left ${i === 0 ? "btn-gold" : "btn-ghost"}`}
                onClick={() => void sendGame({ type: "RESPOND", windowId: w.id, optionId: o.id })}
              >
                <span className="text-base">{o.label}</span>
                {o.detail && <span className="text-xs font-normal opacity-80">{o.detail}</span>}
              </button>
            ))}
          </div>
          {w.kind === "VOTE" && (
            <p className="mt-2 text-center text-xs text-ash">
              {w.answeredBy.length}/{w.addressees.length} voted · votes stay secret until everyone has chosen
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Waiting({ g, w }: { g: PlayerView; w: PublicWindow }) {
  const left = useCountdown(w.deadlineAt);
  const waitingOn = w.addressees.filter((id) => !w.answeredBy.includes(id)).map((id) => g.players[id]?.nickname ?? "someone");
  const answered = w.myAnswer ? w.options.find((o) => o.id === w.myAnswer)?.label : null;
  return (
    <motion.div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+108px)] z-30 flex justify-center px-4" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <div className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm" role="status">
        <span className="h-2 w-2 animate-pulse rounded-full bg-signal" />
        <span className="truncate">
          {answered ? `You chose "${answered}". ` : ""}
          {w.kind === "VOTE" || w.kind === "EVENT_CHOICE" ? `${w.title}: ${w.answeredBy.length}/${w.addressees.length} answered` : `Waiting for ${waitingOn.join(", ")}`}
        </span>
        <span className="font-mono text-xs text-mist">{left}s</span>
      </div>
    </motion.div>
  );
}
