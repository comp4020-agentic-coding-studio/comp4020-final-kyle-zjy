// The Blackjack table inside the challenge windows. Cards come off the deck one
// at a time (new ones only: a hit does not replay the opening deal), each hand's
// total counts as its cards land, and only after a short silence do the BUST
// verdict and the stake settlement appear. Everything shown is server data;
// the window's buttons stay locked until the reveal has finished or is skipped.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { PlayerView } from "../../../shared/game/state.ts";
import { audio } from "../../audio/manager.ts";
import { useT } from "../../i18n/index.ts";

const SUITS = ["♠", "♥", "♣", "♦"] as const;
const rank = (card: number) => card === 1 ? "A" : card === 11 ? "J" : card === 12 ? "Q" : card === 13 ? "K" : String(card);
const score = (cards: number[]) => {
  let total = cards.reduce((sum, card) => sum + (card === 1 ? 1 : Math.min(card, 10)), 0);
  for (const card of cards) if (card === 1 && total + 10 <= 21) total += 10;
  return total;
};
/** The deck has no suits in the rules; this is a cosmetic mark chosen from the card's position only. */
const suitOf = (card: number, index: number) => SUITS[(card * 3 + index) % 4];

const STEP_MS = 300;
const PAUSE_MS = 650;
/** Cards already shown for a challenge, so a later window animates only what was just drawn. */
const shown = new Map<string, Record<string, number>>();

export function Blackjack04({ g, onDone }: { g: PlayerView; onDone: (done: boolean) => void }) {
  const t = useT();
  const reduce = useReducedMotion();
  const c = g.auction!.challenge!;
  const key = `${c.challenger}:${c.target}:${g.round}:${c.wager}`;
  const ids = [c.target, c.challenger] as const;
  const hands: Record<string, number[]> = { [c.target]: c.targetHand, [c.challenger]: c.challengerHand };
  const before = useRef(shown.get(key) ?? {});
  const steps = useMemo(() => {
    const out: { id: string; index: number }[] = [];
    const max = Math.max(c.targetHand.length, c.challengerHand.length);
    for (let i = 0; i < max; i++) for (const id of ids) if (i < hands[id].length && i >= (before.current[id] ?? 0)) out.push({ id, index: i });
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [count, setCount] = useState(reduce ? steps.length : 0);
  const [verdict, setVerdict] = useState(!!reduce || steps.length === 0);
  const finished = count >= steps.length && verdict;
  useEffect(() => {
    if (count < steps.length) {
      const timer = setTimeout(() => { audio.play("card_flip"); setCount((n) => n + 1); }, count === 0 ? 120 : STEP_MS);
      return () => clearTimeout(timer);
    }
    if (!verdict) {
      const timer = setTimeout(() => setVerdict(true), PAUSE_MS);
      return () => clearTimeout(timer);
    }
  }, [count, steps.length, verdict]);
  useEffect(() => { onDone(finished); }, [finished, onDone]);
  useEffect(() => () => { shown.set(key, Object.fromEntries(ids.map((id) => [id, hands[id].length]))); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const skip = () => { setCount(steps.length); setVerdict(true); };
  const visible = (id: string) => {
    const hand = hands[id];
    let upto = before.current[id] ?? 0;
    for (const step of steps.slice(0, count)) if (step.id === id) upto = Math.max(upto, step.index + 1);
    return hand.slice(0, Math.min(upto, hand.length));
  };
  return <div data-s4-blackjack role="group" aria-label={t("s4.bj.dealing")} onClick={finished ? undefined : skip} className="mt-2 grid gap-2 rounded-xl border border-gold/30 bg-[#0a1a14]/80 p-3 text-sm">
    {ids.map((id) => {
      const cards = visible(id);
      return <div key={id} className="min-w-0">
        <div className="flex min-w-0 items-baseline justify-between gap-2"><p className="min-w-0 truncate font-semibold">{g.players[id].nickname}</p><p className="shrink-0 font-mono text-xs text-gold-bright" aria-live="off">{cards.length ? t("s4.bj.total", { n: score(cards) }) : "—"}</p></div>
        <div className="mt-1 flex min-h-14 flex-wrap gap-1.5">
          {cards.map((card, i) => <motion.span key={i} initial={reduce ? false : { rotateY: 90, opacity: 0, y: -8 }} animate={{ rotateY: 0, opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className={`flex h-14 w-10 flex-col items-center justify-center rounded-lg border border-moon/50 bg-moon font-display text-lg font-bold leading-none text-night shadow ${(suitOf(card, i) === "♥" || suitOf(card, i) === "♦") ? "text-ember" : ""}`}><span>{rank(card)}</span><span className="text-sm">{suitOf(card, i)}</span></motion.span>)}
          {cards.length < hands[id].length && <span role="img" aria-label={t("s4.bj.faceDown")} className="flex h-14 w-10 items-center justify-center rounded-lg border-2 border-gold/50 bg-[#111936] text-gold">?</span>}
        </div>
      </div>;
    })}
    {!finished && <p className="text-center text-[11px] text-ash">{t("s4.bj.skip")}</p>}
    {finished && c.bust && <motion.div initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} role="status" aria-live="assertive" className="rounded-xl border-2 border-ember bg-ember/15 p-3 text-center">
      <p className="label text-ember">{t("s4.decision.bust")}</p>
      <p className="mt-1 text-sm text-moon">{t("s4.decision.bustCard", { name: g.players[c.bust.playerId].nickname, card: rank(c.bust.card), total: c.bust.total })}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-gold-bright">{t(c.bust.playerId === g.viewerId ? "s4.decision.youLost" : "s4.decision.opponentBustWon")}</p>
      <p className="mt-1 text-xs text-mist">{t("s4.bj.settle", { name: g.players[c.bust.winnerId].nickname, pot: c.effectiveWager * 2 })}</p>
    </motion.div>}
  </div>;
}
