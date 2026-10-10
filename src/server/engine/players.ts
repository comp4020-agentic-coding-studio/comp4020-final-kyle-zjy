// Player resources. Every change to Fate, Sanity, statuses or shields goes
// through here, so floors, caps and the "lost" state are enforced in one place.
import { MAX_SANITY } from "../../shared/game/scenario01/content.ts";
import type { CarriageIdentity, PlayerGameState, PlayerId, Status } from "../../shared/game/state.ts";
import { cue, log, name, newId, type Ctx } from "./context.ts";
import { queueTrigger } from "./trigger-queue.ts";
import type { Msg } from "../../shared/i18n/types.ts";
import { m, ref } from "../../shared/i18n/msg.ts";

export const present = (ctx: Ctx): PlayerGameState[] => ctx.s.turnOrder.map((id) => ctx.s.players[id]).filter((p) => p && !p.away);
export const everyone = (ctx: Ctx): PlayerGameState[] => ctx.s.turnOrder.map((id) => ctx.s.players[id]).filter(Boolean);

export const identityAt = (ctx: Ctx, index: number): CarriageIdentity => ctx.s.carriages[index]?.identity ?? "START";
export const carriageOf = (ctx: Ctx, p: PlayerGameState): CarriageIdentity => identityAt(ctx, p.carriageIndex);
export const sameCarriage = (a: PlayerGameState, b: PlayerGameState): boolean => a.carriageIndex === b.carriageIndex;

export const hasStatus = (p: PlayerGameState, kind: string): boolean => p.statuses.some((s) => s.kind === kind);
export const statusOf = (p: PlayerGameState, kind: string): Status | undefined => p.statuses.find((s) => s.kind === kind);

export function addStatus(ctx: Ctx, p: PlayerGameState, st: Omit<Status, "id">): Status {
  const status: Status = { ...st, id: newId(ctx, "st") };
  p.statuses.push(status);
  if (status.polarity === "POSITIVE" && status.ordinary) queueTrigger(ctx, { kind: "PLAYER_GAINS_BUFF", subjectId: p.playerId, sourceId: status.sourceId, status });
  return status;
}

export function removeStatus(p: PlayerGameState, idOrKind: string): Status | null {
  const i = p.statuses.findIndex((s) => s.id === idOrKind || s.kind === idOrKind);
  if (i < 0) return null;
  return p.statuses.splice(i, 1)[0];
}

/** Takes a one-shot status (e.g. INVESTIGATE_BONUS) as it is used, and returns its value, or 0. */
export function consumeStatus(ctx: Ctx, p: PlayerGameState, kind: string): number {
  const st = useUpStatus(ctx, p, kind);
  return st ? (st.value ?? 1) : 0;
}

/** A buff used up ends like one running out: abilities that answer a buff ending hear about it. */
export function useUpStatus(ctx: Ctx, p: PlayerGameState, idOrKind: string): Status | null {
  const st = removeStatus(p, idOrKind);
  if (st && st.polarity === "POSITIVE" && st.ordinary) queueTrigger(ctx, { kind: "STATUS_EXPIRING", subjectId: p.playerId, status: st, condition: "USED" });
  return st;
}

export function gainFate(ctx: Ctx, p: PlayerGameState, amount: number, why?: Msg): number {
  if (amount <= 0) return 0;
  p.fate += amount;
  cue(ctx, "FATE", { playerId: p.playerId, delta: amount });
  if (why) log(ctx, m`${p.nickname} gains ${amount} Fate (${why}).`, "FATE", p.playerId);
  queueTrigger(ctx, { kind: "PLAYER_GAINS_FATE", subjectId: p.playerId, amount });
  payBonds(ctx, p.playerId, "onGainFate");
  return amount;
}

/**
 * Pays a bond's other members when one member does the thing the bond is
 * about. `onGainFate` pays every time; the "first" kinds pay once per bond.
 * Payouts go straight to Fate, so a bond never sets itself off again.
 */
export function payBonds(ctx: Ctx, memberId: PlayerId, on: "onGainFate" | "onFirstSuccess" | "onFirstReward"): void {
  for (const b of ctx.s.bonds) {
    const n = b[on];
    if (!n || !b.members.includes(memberId) || (b.oneWay && b.members[0] !== memberId)) continue;
    if (on !== "onGainFate") {
      if (b.fired.includes(on)) continue;
      b.fired.push(on);
    }
    for (const other of b.members.filter((m) => m !== memberId)) {
      const o = ctx.s.players[other];
      if (!o || o.away) continue;
      o.fate += n;
      cue(ctx, "FATE", { playerId: other, delta: n });
      log(ctx, b.secret ? m`${o.nickname} gains ${n} Fate through a bond.` : m`${o.nickname} gains ${n} Fate through a bond with ${ctx.s.players[memberId].nickname}.`, "BOND", other);
    }
  }
}

/**
 * Fate a player hands over or spends by choice (the Fate window, a trade, a
 * balancing ability). Not a negative effect, but dropping to 0 still counts.
 */
export function spendFate(ctx: Ctx, p: PlayerGameState, amount: number): number {
  const spent = Math.min(p.fate, Math.max(0, amount));
  if (!spent) return 0;
  p.fate -= spent;
  if (p.fate === 0) queueTrigger(ctx, { kind: "FATE_REACHES_ZERO", subjectId: p.playerId });
  return spent;
}

export function loseFate(ctx: Ctx, p: PlayerGameState, amount: number, why?: Msg): number {
  if (hasStatus(p, "FATE_LOCKED")) {
    log(ctx, m`${p.nickname}'s Fate is locked and can't be reduced.`, "FATE", p.playerId);
    return 0;
  }
  const lost = Math.min(p.fate, Math.max(0, amount));
  if (lost === 0) return 0;
  p.fate -= lost;
  cue(ctx, "FATE", { playerId: p.playerId, delta: -lost });
  if (why) log(ctx, m`${p.nickname} loses ${lost} Fate (${why}).`, "FATE", p.playerId);
  if (p.fate === 0) queueTrigger(ctx, { kind: "FATE_REACHES_ZERO", subjectId: p.playerId });
  return lost;
}

export function gainSanity(ctx: Ctx, p: PlayerGameState, amount: number, why?: Msg): number {
  const before = p.sanity;
  p.sanity = Math.min(MAX_SANITY, p.sanity + Math.max(0, amount));
  const gained = p.sanity - before;
  if (gained > 0) {
    cue(ctx, "SANITY", { playerId: p.playerId, delta: gained });
    if (why) log(ctx, m`${p.nickname} recovers ${gained} Sanity (${why}).`, "SANITY", p.playerId);
  }
  if (p.lost && p.sanity > 0) {
    p.lost = false;
    log(ctx, m`${p.nickname} finds their way back. No longer lost.`, "SANITY", p.playerId);
    cue(ctx, "FOUND", { playerId: p.playerId });
  }
  return gained;
}

export function loseSanity(ctx: Ctx, p: PlayerGameState, amount: number, why?: Msg): number {
  if (ctx.s.scenarioId === "S04_UNDERGROUND_AUCTION" && ctx.s.auction?.players[p.playerId]?.sanityWard) return 0;
  const lost = Math.min(p.sanity, Math.max(0, amount));
  if (lost === 0) return 0;
  p.sanity -= lost;
  cue(ctx, "SANITY", { playerId: p.playerId, delta: -lost });
  if (why) log(ctx, m`${p.nickname} loses ${lost} Sanity (${why}).`, "SANITY", p.playerId);
  if (p.sanity === 0 && !p.lost) {
    p.lost = true;
    p.stats.timesLost++;
    log(ctx, m`${p.nickname} is LOST. Next round they act with 1 action point until they recover.`, "LOST", p.playerId);
    cue(ctx, "LOST", { playerId: p.playerId });
  }
  return lost;
}

/**
 * A negative effect is about to land on p. Shields absorb it first; an
 * immunity status cancels it. Returns true if it still lands.
 */
export function absorbs(ctx: Ctx, p: PlayerGameState, label: Msg, group = false): boolean {
  const groupImmune = group ? statusOf(p, "IMMUNE_GROUP") : undefined;
  if (groupImmune) {
    if ((groupImmune.value ?? 1) <= 1) removeStatus(p, groupImmune.id);
    else groupImmune.value = (groupImmune.value ?? 1) - 1;
    log(ctx, m`${p.nickname} is untouched by ${label}.`, "DEFENCE", p.playerId);
    return true;
  }
  const immune = statusOf(p, "IMMUNE_NEGATIVE");
  if (immune) {
    if ((immune.value ?? 1) <= 1) removeStatus(p, immune.id);
    else immune.value = (immune.value ?? 1) - 1;
    log(ctx, m`${p.nickname} is immune to ${label}.`, "DEFENCE", p.playerId);
    cue(ctx, "SHIELD", { playerId: p.playerId });
    return true;
  }
  if (p.shields > 0) {
    p.shields--;
    log(ctx, m`${p.nickname}'s shield blocks ${label}.`, "DEFENCE", p.playerId);
    cue(ctx, "SHIELD", { playerId: p.playerId });
    return true;
  }
  return false;
}

export function visit(ctx: Ctx, p: PlayerGameState): void {
  const identity = carriageOf(ctx, p);
  if (!p.stats.carriagesVisited.includes(identity)) p.stats.carriagesVisited.push(identity);
}

export const nameOf = (ctx: Ctx, id: PlayerId) => name(ctx, id);
