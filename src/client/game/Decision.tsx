// Every decision the table waits on (except Fate, which lives on the die):
// reactions, passives, votes, event choices, trade offers, the final choice.
// The addressee gets a card with the options and a countdown ring; everyone
// else sees who the table is waiting for.
import { AnimatePresence, motion } from "motion/react";
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import { EVENT_BY_ID } from "../../shared/game/events.ts";
import { auctionIntelText, auctionLotText } from "../../shared/i18n/scenario04.ts";
import type { PlayerView, PublicWindow } from "../../shared/game/state.ts";
import { Avatar } from "../components/Avatar.tsx";
import { useCharacterText, useFormat, useLocale, useT } from "../i18n/index.ts";
import { sendGame } from "../store.ts";
import { EventArt } from "./EventArt.tsx";

export function DecisionLayer({ g }: { g: PlayerView }) {
  const w = g.pending.at(-1);
  if (!w || w.kind === "FATE_SPEND") return null;
  const mine = w.addressees.includes(g.viewerId) && !w.myAnswer;
  return <AnimatePresence>{mine ? <DecisionCard key={w.id} g={g} w={w} /> : <Waiting key={`wait-${w.id}`} g={g} w={w} />}</AnimatePresence>;
}

const blackjackCard = (card: number) => card === 1 ? "A" : card === 11 ? "J" : card === 12 ? "Q" : card === 13 ? "K" : String(card);
function blackjackScore(cards: number[]) {
  let total = cards.reduce((sum, card) => sum + (card === 1 ? 1 : Math.min(card, 10)), 0);
  for (const card of cards) if (card === 1 && total + 10 <= 21) total += 10;
  return total;
}

function DecisionCard({ g, w }: { g: PlayerView; w: PublicWindow }) {
  // an event's vote happens while it is open; a later vote (the boat's departure) is its own decision
  const isEvent = (w.kind === "VOTE" || w.kind === "EVENT_CHOICE") && g.currentEvent && !g.currentEvent.resolved;
  const card = isEvent ? EVENT_BY_ID.get(g.currentEvent!.id) : null;
  const owner = w.ownerId ? g.players[w.ownerId] : null;
  const ownerChar = owner ? getCharacterById(owner.characterId) : null;
  const t = useT();
  const locale = useLocale();
  const fmt = useFormat();
  const charText = useCharacterText();
  const ownerSkill = owner ? charText(owner.skill.borrowed ?? owner.characterId) : null;
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
              <p className="label text-gold">{t(`decision.kind.${w.kind}`)}</p>
              <h2 id={`dlg-${w.id}`} className="mt-1 font-display text-2xl leading-tight font-semibold">
                {fmt(w.title)}
              </h2>
            </div>
          </div>
          {(w.kind === "REACTION" || w.kind === "PASSIVE_CONFIRM") && ownerChar && ownerSkill && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-violet/40 bg-violet/10 p-2">
              <Avatar zodiac={ownerChar.zodiac} mbti={ownerChar.mbti} size={44} />
              <div className="min-w-0">
                <p className="font-display text-lg text-gold-bright">{ownerSkill.skillName}</p>
                <p className="text-xs text-mist">{ownerSkill.skillDescription}</p>
              </div>
            </div>
          )}
          <p className="mt-3 text-sm leading-relaxed text-mist">{fmt(w.prompt)}</p>
          {w.kind === "S4_DEAL" && g.auction?.deal && (() => {
            const deal = g.auction.deal;
            const asset = deal.forPass ? t("s4.decision.pass") : deal.giveIntel ? auctionIntelText(locale, deal.giveIntel) : deal.forIntel ? auctionIntelText(locale, deal.forIntel) : deal.giveItem ? auctionLotText(locale, deal.giveItem).name : deal.forItem ? auctionLotText(locale, deal.forItem).name : "·";
            return <p className="mt-2 rounded-xl border border-gold/30 p-3 text-sm">{t("s4.decision.deal", { from: g.players[deal.from].nickname, to: g.players[deal.to].nickname, pay: deal.chips, receive: deal.receiveChips ?? 0, asset })}</p>;
          })()}
          {(w.kind === "S4_BLACKJACK" || w.kind === "S4_BLACKJACK_RESULT") && g.auction?.challenge && <div className="mt-2 grid gap-1 rounded-xl border border-gold/30 p-3 text-sm">
            {([g.auction.challenge.target, g.auction.challenge.challenger] as const).map((id) => {
              const hand = id === g.auction!.challenge!.target ? g.auction!.challenge!.targetHand : g.auction!.challenge!.challengerHand;
              return <p key={id}>{t("s4.decision.hand", { name: g.players[id].nickname, cards: hand.map(blackjackCard).join(" "), total: blackjackScore(hand) })}</p>;
            })}
          </div>}
          {w.kind === "S4_BLACKJACK_RESULT" && g.auction?.challenge?.bust && <div role="status" aria-live="assertive" className="mt-3 rounded-xl border-2 border-ember bg-ember/15 p-3 text-center">
            <p className="label text-ember">{t("s4.decision.bust")}</p>
            <p className="mt-1 text-sm text-moon">{t("s4.decision.bustCard", { name: g.players[g.auction.challenge.bust.playerId].nickname, card: blackjackCard(g.auction.challenge.bust.card), total: g.auction.challenge.bust.total })}</p>
            <p className="mt-2 font-display text-2xl font-semibold text-gold-bright">{t(g.auction.challenge.bust.playerId === g.viewerId ? "s4.decision.youLost" : "s4.decision.opponentBustWon")}</p>
          </div>}
          <div className="mt-4 grid gap-2">
            {w.options.map((o, i) => (
              <button
                key={o.id}
                className={`btn min-h-14 flex-col items-start gap-0 rounded-xl px-4 py-2 text-left ${i === 0 ? "btn-gold" : "btn-ghost"}`}
                onClick={() => void sendGame({ type: "RESPOND", windowId: w.id, optionId: o.id })}
              >
                <span className="text-base">{fmt(o.label)}</span>
                {o.detail && <span className="text-xs font-normal opacity-80">{fmt(o.detail)}</span>}
              </button>
            ))}
          </div>
          {w.kind === "VOTE" && (
            <p className="mt-2 text-center text-xs text-ash">
              {t("decision.voted", { n: w.answeredBy.length, of: w.addressees.length })}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Waiting({ g, w }: { g: PlayerView; w: PublicWindow }) {
  const t = useT();
  const fmt = useFormat();
  const waitingOn = w.addressees.filter((id) => !w.answeredBy.includes(id)).map((id) => g.players[id]?.nickname ?? t("common.someone"));
  const chosen = w.myAnswer ? w.options.find((o) => o.id === w.myAnswer) : null;
  const answered = chosen ? fmt(chosen.label) : null;
  return (
    <motion.div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+108px)] z-30 flex justify-center px-4" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <div className="glass flex max-w-full min-w-0 items-center gap-2 rounded-full px-4 py-2 text-sm" role="status">
        <span className="h-2 w-2 animate-pulse rounded-full bg-signal" />
        <span className="min-w-0 truncate">
          {answered ? t("decision.youChose", { label: answered }) : ""}
          {w.kind === "VOTE" || w.kind === "EVENT_CHOICE"
            ? t("decision.answered", { title: fmt(w.title), n: w.answeredBy.length, of: w.addressees.length })
            : t("decision.waitingFor", { names: waitingOn.join(t("common.listSep")) })}
        </span>
      </div>
    </motion.div>
  );
}
