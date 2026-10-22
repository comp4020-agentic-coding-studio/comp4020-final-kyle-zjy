import type { Poker, Seat, ToolAction, Street } from "../../shared/toolbox/types.ts";
import { T } from "../../shared/toolbox/text.ts";
export function demand(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v <= 10_000_000;
export function emptyPoker(): Poker { return { seats: [], dealer: null, actor: null, street: "preflop", stage: "waiting", small: 5, big: 10, buyIn: 1000, price: 0, raise: 10, allowRebuy: false, rebuys: {}, raised: [], pending: [], pots: [], hand: 0, log: [] }; }
const live = (p: Poker) => p.seats.filter(s => !s.folded);
function clockwise(p: Poker, after: string, allowed: string[]): string | null {
  const at = p.seats.findIndex(s => s.id === after);
  for (let n = 1; n <= p.seats.length; n++) { const s = p.seats[(at + n) % p.seats.length]; if (allowed.includes(s.id)) return s.id; }
  return null;
}
function pay(s: Seat, amount: number) { const paid = Math.min(s.stack, amount); s.stack -= paid; s.bet += paid; s.total += paid; }
function settle(p: Poker) {
  p.actor = null; p.pending = []; p.stage = "settlement";
  // Return the unmatched portion, including an uncalled all-in.
  const sorted = [...p.seats].sort((a, b) => b.total - a.total);
  const excess = sorted[0].total - sorted[1].total;
  if (excess > 0) { sorted[0].stack += excess; sorted[0].total -= excess; sorted[0].bet = Math.max(0, sorted[0].bet - excess); }
  const levels = [...new Set(p.seats.map(s => s.total).filter(Boolean))].sort((a, b) => a - b);
  let previous = 0;
  p.pots = levels.map(level => {
    const contributors = p.seats.filter(s => s.total >= level);
    const eligible = contributors.filter(s => !s.folded).map(s => s.id);
    const amount = (level - previous) * contributors.length; previous = level;
    return { amount, eligible: eligible.length ? eligible : live(p).map(s => s.id), winners: [] };
  });
  for (const pot of p.pots) if (pot.eligible.length === 1) { pot.winners = [...pot.eligible]; p.seats.find(s => s.id === pot.winners[0])!.stack += pot.amount; }
  if (p.pots.every(pot => pot.winners.length)) p.stage = "waiting";
}
function advance(p: Poker, after: string) {
  if (live(p).length <= 1) { settle(p); return; }
  p.pending = p.pending.filter(id => p.seats.some(s => s.id === id && !s.folded && s.stack > 0));
  const active = live(p).filter(s => s.stack > 0);
  if (active.length <= 1 && active.every(s => s.bet >= Math.min(p.price, ...live(p).filter(x => x.id !== s.id).map(x => x.bet)))) { settle(p); return; }
  p.actor = clockwise(p, after, p.pending);
  if (!p.actor) { if (p.street === "river") settle(p); else p.stage = "between"; }
}
export function actPoker(p: Poker, id: string, a: ToolAction, host: boolean, memberIds: string[]) {
  if (["CONFIG", "START", "NEXT", "AWARD", "SET_REBUY"].includes(a.type)) demand(host, T.host);
  if (a.type === "CONFIG") {
    demand(integer(a.buyIn) && a.buyIn <= 1_000_000 && integer(a.small) && integer(a.big) && a.small <= a.big && a.big <= a.buyIn && Array.isArray(a.ids) && a.ids.length >= 2 && a.ids.length <= 10 && new Set(a.ids).size === a.ids.length && a.ids.every(x => memberIds.includes(x)) && a.ids.includes(a.dealer), T.badConfig);
    Object.assign(p, emptyPoker(), { buyIn: a.buyIn, small: a.small, big: a.big, dealer: a.dealer, seats: a.ids.map(id => ({ id, stack: a.buyIn, bet: 0, total: 0, folded: false, actedAt: null })) }); return;
  }
  if (a.type === "SET_REBUY") {
    demand(typeof a.allowed === "boolean", T.invalid);
    p.allowRebuy = a.allowed; return;
  }
  if (a.type === "REBUY") {
    demand(p.allowRebuy, T.rebuyClosed);
    demand(p.stage === "waiting", T.rebuyBetween);
    const seat = p.seats.find(s => s.id === id);
    demand(seat && seat.stack + p.buyIn <= 10_000_000, T.rebuyLimit);
    seat.stack += p.buyIn;
    const history = p.rebuys ??= {};
    history[id] = (history[id] ?? 0) + p.buyIn;
    return;
  }
  if (a.type === "START") {
    demand(p.stage === "waiting" && p.seats.filter(s => s.stack > 0).length >= 2, T.stage);
    const eligible = p.seats.filter(s => s.stack > 0).map(s => s.id);
    p.dealer = p.hand === 0 && eligible.includes(p.dealer!) ? p.dealer : clockwise(p, p.dealer!, eligible);
    for (const s of p.seats) Object.assign(s, { bet: 0, total: 0, folded: s.stack === 0, actedAt: null });
    p.hand++; p.raised = []; p.pots = []; p.log = []; p.street = "preflop"; p.stage = "betting"; p.price = p.big; p.raise = p.big;
    const smallId = eligible.length === 2 ? p.dealer! : clockwise(p, p.dealer!, eligible)!;
    const bigId = clockwise(p, smallId, eligible)!;
    pay(p.seats.find(s => s.id === smallId)!, p.small); pay(p.seats.find(s => s.id === bigId)!, p.big);
    p.pending = eligible.filter(id => p.seats.find(s => s.id === id)!.stack > 0);
    advance(p, bigId); return;
  }
  if (a.type === "NEXT") {
    demand(p.stage === "between", T.stage);
    p.street = ({ preflop: "flop", flop: "turn", turn: "river" } as Partial<Record<Street, Street>>)[p.street]!;
    for (const s of p.seats) { s.bet = 0; s.actedAt = null; }
    p.raised = []; p.price = 0; p.raise = p.big; p.stage = "betting"; p.pending = live(p).filter(s => s.stack > 0).map(s => s.id); advance(p, p.dealer!); return;
  }
  if (a.type === "AWARD") {
    demand(p.stage === "settlement", T.stage);
    const pot = p.pots[a.pot];
    demand(pot && !pot.winners.length && Array.isArray(a.winners) && a.winners.length && new Set(a.winners).size === a.winners.length && a.winners.every(id => pot.eligible.includes(id)), T.potError);
    const ordered: string[] = []; let at = p.dealer!;
    for (let n = 0; n < a.winners.length; n++) { at = clockwise(p, at, a.winners.filter(id => !ordered.includes(id)))!; ordered.push(at); }
    ordered.forEach((id, i) => { p.seats.find(s => s.id === id)!.stack += Math.floor(pot.amount / ordered.length) + (i < pot.amount % ordered.length ? 1 : 0); });
    pot.winners = ordered; if (p.pots.every(x => x.winners.length)) p.stage = "waiting"; return;
  }
  demand(p.stage === "betting", T.stage); demand(p.actor === id, T.turn);
  const s = p.seats.find(s => s.id === id)!; const oldPrice = p.price;
  if (a.type === "FOLD") s.folded = true;
  else if (a.type === "CHECK") demand(s.bet >= p.price, T.checkError);
  else if (a.type === "CALL") pay(s, Math.max(0, p.price - s.bet));
  else if (a.type === "RAISE" || a.type === "ALL_IN") {
    const to = a.type === "ALL_IN" ? s.bet + s.stack : a.to;
    demand(integer(to) && to > s.bet && to <= s.bet + s.stack, T.insufficient);
    if (to > p.price) {
      demand(!p.raised?.includes(id), T.raiseUsed);
      demand(s.actedAt === null || p.price - s.actedAt >= p.raise, T.raiseError);
      const increase = to - p.price;
      demand(increase >= p.raise || to === s.bet + s.stack, T.raiseError);
      if (increase >= p.raise) p.raise = increase;
      p.price = to;
      (p.raised ??= []).push(id);
    }
    pay(s, to - s.bet);
  } else demand(false, T.invalid);
  s.actedAt = p.price;
  p.pending = p.pending.filter(x => x !== id);
  if (p.price > oldPrice) for (const other of live(p)) if (other.id !== id && other.stack > 0 && other.bet < p.price && !p.pending.includes(other.id)) p.pending.push(other.id);
  p.log.push(`${id}|${a.type}|${s.bet}`); p.log = p.log.slice(-40);
  advance(p, id);
}
