// Player actions. Each action has one check (used both to reject a request
// and to explain a greyed-out button) and one apply. Nothing a client sends is
// trusted: shapes, turn, action points, targets and resources are all checked
// here against the live state.
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import type { ActionAvailability, GameAction, GameActionType, RejectCode, TradeOffer } from "../../shared/game/actions.ts";
import { AP_COST } from "../../shared/game/actions.ts";
import { CARRIAGES, isKeyItem, ITEMS, KEY_FOR_LOCK, MAX_HELP_BONUS, MAX_SANITY } from "../../shared/game/scenario01/content.ts";
import type { GameState, PlayerGameState, PlayerId, S01ItemId } from "../../shared/game/state.ts";
import { neighboursOf } from "./beats.ts";
import { activePlayerId, cue, log, RuleError, type Ctx } from "./context.ts";
import { startRoll } from "./dice.ts";
import { applyEffects, statusName } from "./effects.ts";
import { endTurn } from "./flow.ts";
import { anchorName, repairTarget } from "./outcomes.ts";
import { gainFate, gainSanity, identityAt, removeStatus, spendFate, visit } from "./players.ts";
import { queueTrigger } from "./trigger-queue.ts";
import { activeRequirementHolds, resolvable, useSkill } from "./resolver.ts";
import { canUseSkill } from "./skills.ts";
import { answerWindow, onResume, openWindow } from "./windows.ts";
import { list, m, ref } from "../../shared/i18n/msg.ts";
import type { Msg } from "../../shared/i18n/types.ts";
import { characterSkill } from "../../shared/game/skills.ts";
import { rulesFor, type ActionSet } from "./scenario.ts";

export type Fail = { code: RejectCode; reason: Msg };
export const fail = (code: RejectCode, reason: Msg): Fail => ({ code, reason });

const IN_RUN = new Set(["ACT_1", "ACT_2", "ACT_3", "ACT_4"]);

/** Shared gate for anything done on your own turn. */
function turnGate(s: GameState, actorId: PlayerId, cost: number, type: GameActionType): Fail | null {
  if (s.phase === "ENDING" || s.phase === "RESULTS") return fail("GAME_OVER", m`The run is over.`);
  if (!IN_RUN.has(s.phase)) return fail("WRONG_PHASE", m`The run hasn't started yet.`);
  if (s.sequence) return fail("WRONG_PHASE", m`Wait for the scene to finish.`);
  if (s.pending.some((w) => w.blocksTable) || (s.roll && !s.roll.done)) return fail("WINDOW_OPEN", m`Wait for the current decision to finish.`);
  if (s.scenarioId === "S04_UNDERGROUND_AUCTION" && s.round === 10 && s.auction?.final) {
    const final = s.auction.final;
    const mine = final.players[actorId];
    const allowed = final.stage === "SETTLEMENT" && !mine.ready && ["FINAL_CONVERT", "FINAL_READY", "USE_LOT"].includes(type)
      || final.stage === "AUCTION" && mine.bid === null && type === "FINAL_BID"
      || final.stage === "REVEAL" && !mine.revealReady && type === "FINAL_CONTINUE"
      || final.stage === "SHOWDOWN_PICK" && final.showdown?.participatingPlayerIds.includes(actorId) && !final.showdown.locked[actorId] && type === "FINAL_SHOWDOWN_PICK"
      || final.stage === "SHOWDOWN_REVEAL" && !mine.revealReady && type === "FINAL_CONTINUE";
    return allowed ? null : fail("WRONG_PHASE", m`That action is unavailable in the final auction.`);
  }
  const active = activePlayerId(s);
  if (active !== actorId) return fail("NOT_YOUR_TURN", active ? m`It's ${s.players[active].nickname}'s turn.` : m`Nobody is acting right now.`);
  if (s.players[actorId].ap < cost) return fail("NO_AP", cost === 2 ? m`Needs 2 action points.` : m`No action points left.`);
  return null;
}

const others = (s: GameState, p: PlayerGameState) => Object.values(s.players).filter((o) => o.playerId !== p.playerId && !o.away);
const sameCarriage = (s: GameState, p: PlayerGameState) => others(s, p).filter((o) => o.carriageIndex === p.carriageIndex);
const ctxOf = (s: GameState): Ctx => ({ s, now: 0, events: [] });

function adjacent(s: GameState, p: PlayerGameState): number[] {
  return [p.carriageIndex - 1, p.carriageIndex + 1].filter((i) => i >= 0 && i < s.carriages.length && !s.carriages[i].locked);
}

export type Spec<A extends GameAction = GameAction> = {
  check: (s: GameState, p: PlayerGameState, a?: A) => Fail | null;
  apply: (ctx: Ctx, p: PlayerGameState, a: A) => void;
  targets?: (s: GameState, p: PlayerGameState) => (string | number)[];
  hint?: (s: GameState, p: PlayerGameState) => Msg | undefined;
};

const MOVE: Spec<Extract<GameAction, { type: "MOVE" }>> = {
  targets: (s, p) => adjacent(s, p),
  check: (s, p, a) => {
    if (!adjacent(s, p).length) return fail("ILLEGAL_TARGET", m`No open carriage next to you.`);
    if (!a) return null;
    if (!Number.isInteger(a.toCarriage)) return fail("INVALID", m`Choose a carriage.`);
    const c = s.carriages[a.toCarriage];
    if (!c || Math.abs(a.toCarriage - p.carriageIndex) !== 1) return fail("ILLEGAL_TARGET", m`You can only move to the next carriage.`);
    if (c.locked) return fail("ILLEGAL_TARGET", m`The driver's cab is locked until round 8.`);
    return null;
  },
  apply: (ctx, p, a) => {
    const from = p.carriageIndex;
    p.carriageIndex = a.toCarriage;
    if (from === 0) p.counters.leftStart = 1;
    visit(ctx, p);
    const identity = identityAt(ctx, a.toCarriage);
    log(ctx, m`${p.nickname} moves into the ${ref.carriage(identity)}.`, "MOVE", p.playerId);
    cue(ctx, "MOVE", { playerId: p.playerId, from, to: a.toCarriage });
    if (identity === "START" && p.counters.leftStart && !p.counters.returnedStart) {
      p.counters.returnedStart = 1;
      gainSanity(ctx, p, 1, m`the safety of the boarding car`);
    }
  },
};

const rollAction = (purpose: "INVESTIGATE" | "SEARCH", label: Msg): Spec => ({
  check: () => null,
  hint: (s, p) => (purpose === "INVESTIGATE" ? ref.investigateHint(identityAt(ctxOf(s), p.carriageIndex)) : ref.searchHint(identityAt(ctxOf(s), p.carriageIndex))),
  apply: (ctx, p) => {
    startRoll(ctx, p, purpose, label, { kind: purpose, carriageIndex: p.carriageIndex });
  },
});

const REPAIR: Spec = {
  check: (s, p) => {
    const ctx = ctxOf(s);
    if (s.act === 1) return fail("ILLEGAL_TARGET", m`Nothing here can be repaired until the anchors appear in round 4.`);
    const t = repairTarget(ctx, p.carriageIndex);
    if (!t) return fail("ILLEGAL_TARGET", s.act === 2 ? m`No reality anchor in this carriage.` : m`No anchor or escape lock in this carriage.`);
    if (t.kind === "ANCHOR") {
      const a = s.anchors[t.anchor];
      const workers = Object.values(s.players).filter((x) => !x.away).length;
      if (a.lastRepairedBy === p.playerId && workers > 1) return fail("ILLEGAL_TARGET", m`Someone else must make the next repair on the ${ref.anchor(a.id)}.`);
      return null;
    }
    if (s.escape.round === s.round && s.escape[t.lock]) return fail("ILLEGAL_TARGET", m`The ${ref.lock(t.lock)} is already engaged this round.`);
    const key = KEY_FOR_LOCK[t.lock];
    if (!p.items.includes(key)) return fail("ILLEGAL_TARGET", m`The ${ref.lock(t.lock)} needs the ${ref.item(key)}, and you aren't carrying it.`);
    if (t.lock === "identity" && s.fragments.length < 3) return fail("ILLEGAL_TARGET", m`The ${ref.lock(t.lock)} needs 3 memory fragment types (you have ${s.fragments.length}).`);
    return null;
  },
  hint: (s, p) => {
    const t = repairTarget(ctxOf(s), p.carriageIndex);
    if (!t) return undefined;
    return t.kind === "ANCHOR" ? m`Repair the ${ref.anchor(t.anchor)} (${s.anchors[t.anchor].progress}/${s.anchors[t.anchor].required}).` : m`Engage the ${ref.lock(t.lock)}.`;
  },
  apply: (ctx, p) => {
    const t = repairTarget(ctx, p.carriageIndex)!;
    startRoll(ctx, p, "REPAIR", t.kind === "ANCHOR" ? m`repair of the ${ref.anchor(t.anchor)}` : ref.lock(t.lock), { kind: "REPAIR", carriageIndex: p.carriageIndex });
  },
};

const HELP: Spec<Extract<GameAction, { type: "HELP" }>> = {
  targets: (s, p) => sameCarriage(s, p).filter((o) => o.helpBonus < MAX_HELP_BONUS).map((o) => o.playerId),
  check: (s, p, a) => {
    if (!sameCarriage(s, p).length) return fail("ILLEGAL_TARGET", m`Nobody else is in your carriage.`);
    if (!a) return null;
    const t = s.players[a.targetId];
    if (!t || t.away || t.playerId === p.playerId) return fail("ILLEGAL_TARGET", m`Choose another passenger.`);
    if (t.carriageIndex !== p.carriageIndex) return fail("ILLEGAL_TARGET", m`They need to be in your carriage.`);
    if (t.helpBonus >= MAX_HELP_BONUS) return fail("ILLEGAL_TARGET", m`${t.nickname} already has the most help they can use (+${MAX_HELP_BONUS}).`);
    return null;
  },
  hint: () => m`+1 to their next roll (+2 for a seat neighbour), up to +2.`,
  apply: (ctx, p, a) => {
    const t = ctx.s.players[a.targetId];
    const neighbour = neighboursOf(ctx, p.playerId).includes(t.playerId);
    const before = t.helpBonus;
    t.helpBonus = Math.min(MAX_HELP_BONUS, t.helpBonus + (neighbour ? 2 : 1));
    t.helpFrom.push(p.playerId);
    p.stats.helpsGiven++;
    t.stats.helpsReceived++;
    if (neighbour) p.counters.helpedNeighbour = (p.counters.helpedNeighbour ?? 0) + 1;
    log(ctx, neighbour ? m`${p.nickname} helps ${t.nickname} (seat neighbour): +${t.helpBonus - before} to their next roll.` : m`${p.nickname} helps ${t.nickname}: +${t.helpBonus - before} to their next roll.`, "HELP", p.playerId);
    cue(ctx, "HELP", { from: p.playerId, to: t.playerId, bonus: t.helpBonus });
    helped(ctx, p.playerId, t.playerId);
  },
};

function validOffer(p: PlayerGameState, o: unknown): o is TradeOffer {
  if (!o || typeof o !== "object") return false;
  const offer = o as TradeOffer;
  if (!Array.isArray(offer.items) || !Number.isInteger(offer.fate) || offer.fate < 0) return false;
  const pool = [...p.items];
  for (const item of offer.items) {
    const i = pool.indexOf(item);
    if (i < 0) return false;
    pool.splice(i, 1);
  }
  return offer.fate <= p.fate;
}

const describeOffer = (o: TradeOffer): Msg => {
  const parts = [...o.items.map((i) => ref.item(i)), ...(o.fate ? [m`${o.fate} Fate`] : [])];
  return parts.length ? list(parts) : m`nothing`;
};

const TRADE: Spec<Extract<GameAction, { type: "TRADE" }>> = {
  targets: (s, p) => sameCarriage(s, p).map((o) => o.playerId),
  check: (s, p, a) => {
    if (!sameCarriage(s, p).length) return fail("ILLEGAL_TARGET", m`Nobody else is in your carriage to trade with.`);
    if (!a) return null;
    const t = s.players[a.targetId];
    if (!t || t.away || t.playerId === p.playerId || t.carriageIndex !== p.carriageIndex) return fail("ILLEGAL_TARGET", m`You can only trade with someone in your carriage.`);
    if (!validOffer(p, a.give)) return fail("INVALID", m`You don't have everything you're offering.`);
    if (!validOffer(t, a.want)) return fail("INVALID", m`${t.nickname} doesn't have what you're asking for.`);
    if (!a.give.items.length && !a.give.fate && !a.want.items.length && !a.want.fate) return fail("INVALID", m`Offer or ask for something.`);
    return null;
  },
  hint: () => m`Swap items or Fate with someone in your carriage. They can refuse.`,
  apply: (ctx, p, a) => {
    const t = ctx.s.players[a.targetId];
    log(ctx, m`${p.nickname} offers ${t.nickname} a trade.`, "TRADE", p.playerId);
    openWindow(ctx, {
      kind: "TRADE_OFFER",
      title: m`${p.nickname} offers a trade`,
      prompt: m`You get: ${describeOffer(a.give)}. You give: ${describeOffer(a.want)}.`,
      addressees: [t.playerId],
      options: [
        { id: "ACCEPT", label: m`Accept` },
        { id: "DECLINE", label: m`Decline` },
      ],
      defaultOptionId: "DECLINE",
      resume: { kind: "TRADE", payload: { from: p.playerId, to: t.playerId, give: JSON.stringify(a.give), want: JSON.stringify(a.want) } },
      blocksTable: true,
      ownerId: p.playerId,
    });
  },
};

onResume("TRADE", (ctx, w, answers) => {
  const payload = w.resume.payload as { from: string; to: string; give: string; want: string };
  const from = ctx.s.players[payload.from];
  const to = ctx.s.players[payload.to];
  const give = JSON.parse(payload.give) as TradeOffer;
  const want = JSON.parse(payload.want) as TradeOffer;
  if (answers[to.playerId] !== "ACCEPT") return log(ctx, m`${to.nickname} declines the trade.`, "TRADE", to.playerId);
  // both sides re-checked: anything may have changed while the offer was open
  if (!validOffer(from, give) || !validOffer(to, want) || from.carriageIndex !== to.carriageIndex) {
    return log(ctx, m`The trade falls through: something changed hands in the meantime.`, "TRADE");
  }
  const move = (a: PlayerGameState, b: PlayerGameState, o: TradeOffer) => {
    for (const item of o.items) {
      a.items.splice(a.items.indexOf(item), 1);
      b.items.push(item);
    }
    spendFate(ctx, a, o.fate);
    b.fate += o.fate;
  };
  move(from, to, give);
  move(to, from, want);
  log(ctx, m`${from.nickname} and ${to.nickname} trade: ${describeOffer(give)} for ${describeOffer(want)}.`, "TRADE", from.playerId);
  cue(ctx, "TRADE", { from: from.playerId, to: to.playerId });
});

export const STABILIZE: Spec<Extract<GameAction, { type: "STABILIZE" }>> = {
  check: (s, p, a) => {
    const canSanity = p.sanity < MAX_SANITY || p.lost;
    const negatives = p.statuses.filter((st) => st.polarity === "NEGATIVE" && st.ordinary);
    if (!canSanity && !negatives.length) return fail("ILLEGAL_TARGET", m`You're already steady: full Sanity and no ordinary negative status.`);
    if (!a) return null;
    if (a.mode === "SANITY" && !canSanity) return fail("ILLEGAL_TARGET", m`Your Sanity is already full.`);
    if (a.mode === "CLEANSE" && !negatives.some((st) => !a.statusId || st.id === a.statusId)) return fail("ILLEGAL_TARGET", m`No ordinary negative status to clear.`);
    if (a.mode !== "SANITY" && a.mode !== "CLEANSE") return fail("INVALID", m`Choose what to steady.`);
    return null;
  },
  hint: () => m`Recover 1 Sanity, or clear one ordinary negative status.`,
  apply: (ctx, p, a) => {
    if (a.mode === "SANITY") return void gainSanity(ctx, p, 1, m`steadying themselves`);
    const st = p.statuses.find((x) => x.polarity === "NEGATIVE" && x.ordinary && (!a.statusId || x.id === a.statusId))!;
    removeStatus(p, st.id);
    log(ctx, m`${p.nickname} shakes off ${ref.status(st.kind)}.`, "STATUS", p.playerId);
  },
};

const CONFRONT: Spec<Extract<GameAction, { type: "CONFRONT" }>> = {
  targets: (s, p) => [
    ...(s.inspector.active && s.inspector.banishedUntilRound === null && s.inspector.carriageIndex === p.carriageIndex ? ["INSPECTOR"] : []),
    ...s.entities.filter((e) => e.carriageIndex === p.carriageIndex).map((e) => e.id),
  ],
  check: (s, p, a) => {
    if (p.lost) return fail("ILLEGAL_TARGET", m`Lost passengers can't confront anything. Steady yourself first.`);
    const targets = CONFRONT.targets!(s, p);
    if (!targets.length) return fail("ILLEGAL_TARGET", m`Nothing in this carriage to confront.`);
    if (!a) return null;
    const id = a.target === "INSPECTOR" ? "INSPECTOR" : a.entityId;
    if (!id || !targets.includes(id)) return fail("ILLEGAL_TARGET", m`That isn't here.`);
    return null;
  },
  hint: () => m`Success: 1 mark (Perfect: 2). Three marks banish the Inspector for a round.`,
  apply: (ctx, p, a) => {
    const target = a.target === "INSPECTOR" ? "INSPECTOR" : a.entityId!;
    p.stats.attacksMade++;
    startRoll(ctx, p, "CONFRONT", target === "INSPECTOR" ? m`confrontation with the Inspector` : m`confrontation`, { kind: "CONFRONT", carriageIndex: p.carriageIndex, target });
  },
};

export const USE_SKILL: Spec<Extract<GameAction, { type: "USE_SKILL" }>> = {
  targets: (s, p) => others(s, p).map((o) => o.playerId).concat(p.playerId),
  check: (s, p, a) => {
    const skill = characterSkill(p.skill.borrowed ?? p.characterId, s.scenarioId);
    if (skill.type !== "ACTIVE") {
      if (p.skill.usesLeft <= 0) return fail("SKILL_ALREADY_USED", m`Your ability is already burned.`);
      return fail("NOT_YOUR_WINDOW", skill.type === "REACTION" ? m`This ability answers something that happens. You'll be asked when it can fire.` : m`This ability is offered automatically when its condition comes true.`);
    }
    if (!resolvable(skill)) return fail("SKILL_LOCKED", m`This ability can't be resolved yet.`);
    const targets = a?.targets ?? [];
    if (a && (!Array.isArray(targets) || targets.some((t) => typeof t !== "string"))) return fail("INVALID", m`Invalid targets.`);
    const check = canUseSkill(s, p.playerId, a ? targets : defaultTargets(s, p));
    if (!check.ok) return fail(check.code, check.reason);
    if (a && !activeRequirementHolds(ctxOf(s), p.playerId, targets)) return fail("ILLEGAL_TARGET", m`${ref.skill(p.skill.borrowed ?? p.characterId, s.scenarioId)} has nothing to act on right now.`);
    return null;
  },
  hint: (s, p) => ref.skillDescription(p.skill.borrowed ?? p.characterId, s.scenarioId),
  apply: (ctx, p, a) => useSkill(ctx, p.playerId, a.targets ?? []),
};

/** For availability only: a legal target set, if one exists, so "can I use it?" is answerable. */
function defaultTargets(s: GameState, p: PlayerGameState): PlayerId[] {
  const rule = characterSkill(p.skill.borrowed ?? p.characterId, s.scenarioId).target;
  const pool = others(s, p);
  if (rule === "ANY_PLAYER" || rule === "OTHER_PLAYER") return pool.slice(0, 1).map((o) => o.playerId);
  if (rule === "SAME_CARRIAGE") return sameCarriage(s, p).slice(0, 1).map((o) => o.playerId);
  if (rule === "TWO_PLAYERS") return [p, ...pool].slice(0, 2).map((o) => o.playerId);
  if (rule === "UP_TO_THREE_PLAYERS") return [p.playerId];
  return [];
}

const USE_ITEM: Spec<Extract<GameAction, { type: "USE_ITEM" }>> = {
  targets: (s, p) => [...new Set(p.items.filter((i) => !isKeyItem(i)))],
  check: (s, p, a) => {
    if (!p.items.some((i) => !isKeyItem(i))) return fail("ILLEGAL_TARGET", m`You aren't carrying any items you can use.`);
    if (!a) return null;
    if (!(a.item in ITEMS) || !p.items.includes(a.item)) return fail("ILLEGAL_TARGET", m`You don't have that item.`);
    if (isKeyItem(a.item)) return fail("ILLEGAL_TARGET", m`A key isn't used up: carry it to its escape lock and Repair there.`);
    if (a.item === "POCKET_WATCH" && s.collapse === 0) return fail("ILLEGAL_TARGET", m`Collapse is already at 0.`);
    if (ITEMS[a.item as S01ItemId].needsTarget && a.targetId && a.targetId !== p.playerId) {
      const t = s.players[a.targetId];
      if (!t || t.away || t.carriageIndex !== p.carriageIndex) return fail("ILLEGAL_TARGET", m`They need to be in your carriage.`);
    }
    return null;
  },
  hint: () => m`Items cost no action points.`,
  apply: (ctx, p, a) => {
    p.items.splice(p.items.indexOf(a.item), 1);
    const target = a.targetId ?? p.playerId;
    log(ctx, m`${p.nickname} uses the ${ref.item(a.item)}.`, "ITEM", p.playerId);
    cue(ctx, "ITEM_USED", { playerId: p.playerId, item: a.item, targetId: target });
    applyEffects(ctx, ITEMS[a.item as S01ItemId].effects, { ownerId: p.playerId, targets: [target], label: ref.item(a.item) });
  },
};

export const END_TURN: Spec = {
  check: () => null,
  apply: (ctx, p) => {
    log(ctx, m`${p.nickname} ends their turn.`, "TURN", p.playerId);
    endTurn(ctx);
  },
};

const SPECS01: Partial<Record<GameActionType, Spec<never>>> = {
  MOVE,
  INVESTIGATE: rollAction("INVESTIGATE", m`investigation`),
  SEARCH: rollAction("SEARCH", m`search`),
  REPAIR,
  HELP,
  TRADE,
  STABILIZE,
  CONFRONT,
  USE_SKILL,
  USE_ITEM,
  END_TURN,
};

export const S01_ACTIONS: ActionSet = {
  specs: SPECS01,
  turnActions: ["MOVE", "INVESTIGATE", "SEARCH", "REPAIR", "HELP", "TRADE", "STABILIZE", "CONFRONT", "USE_SKILL", "USE_ITEM", "END_TURN"],
  apCost: AP_COST,
};

/** Validates and applies one player action. Throws RuleError on rejection. */
export function applyAction(ctx: Ctx, actorId: PlayerId, action: GameAction): void {
  const s = ctx.s;
  const p = s.players[actorId];
  if (!p) throw new RuleError("NOT_IN_ROOM", m`You're not in this run.`);
  if (!action || typeof action !== "object" || typeof action.type !== "string") throw new RuleError("INVALID", m`Unknown action.`);
  if (action.type === "RESPOND") {
    if (s.phase === "RESULTS") throw new RuleError("GAME_OVER", m`The run is over.`);
    if (typeof action.windowId !== "string" || typeof action.optionId !== "string") throw new RuleError("INVALID", m`Invalid answer.`);
    if (s.scenarioId === "S04_UNDERGROUND_AUCTION" && s.pending.at(-1)?.id === action.windowId && s.pending.at(-1)?.kind === "S4_DEAL" && action.optionId === "ACCEPT") {
      const deal = s.auction?.deal;
      if (deal?.to === actorId) {
        const recipient = s.auction!.players[actorId];
        if ((deal.receiveChips ?? 0) > recipient.blackChips) throw new RuleError("ILLEGAL_TARGET", m`A deal cannot spend chips its parties do not hold.`);
        if (deal.forIntel && !recipient.privateIntel.includes(deal.forIntel)) throw new RuleError("ILLEGAL_TARGET", m`The seller does not know that certified intel.`);
      }
    }
    return answerWindow(ctx, actorId, action.windowId, action.optionId);
  }
  if (action.type === "ACK_SEQUENCE") {
    if (s.sequence && !s.sequence.acks.includes(actorId)) s.sequence.acks.push(actorId);
    return;
  }
  const set = rulesFor(s).actions;
  const spec = set.specs[action.type] as Spec<GameAction> | undefined;
  if (!spec) throw new RuleError("INVALID", m`Unknown action.`);
  const cost = set.costFor?.(s, p, action.type) ?? set.apCost[action.type] ?? 0;
  const gate = turnGate(s, actorId, cost, action.type) ?? spec.check(s, p, action);
  if (gate) throw new RuleError(gate.code, gate.reason);
  p.ap -= cost;
  spec.apply(ctx, p, action);
}

/** What the viewer can do right now, with a reason for everything they can't. */
export function availableActions(s: GameState, viewerId: PlayerId): ActionAvailability[] {
  const p = s.players[viewerId];
  if (!p) return [];
  const set = rulesFor(s).actions;
  return set.turnActions.map((type) => {
    const spec = set.specs[type] as Spec<GameAction>;
    const apCost = set.costFor?.(s, p, type) ?? set.apCost[type] ?? 0;
    const gate = turnGate(s, viewerId, apCost, type) ?? spec.check(s, p);
    return {
      type,
      apCost,
      enabled: !gate,
      reason: gate?.reason,
      targets: spec.targets?.(s, p),
      hint: spec.hint?.(s, p),
    };
  });
}


/** What a help means beyond the bonus: round record, mutual-help bonds, grudges, abilities. */
export function helped(ctx: Ctx, helperId: PlayerId, helpedId: PlayerId): void {
  const s = ctx.s;
  s.roundRecord.helps.push([helperId, helpedId]);
  const helper = s.players[helperId];
  if (helper.counters.firstAttackerSeat === s.players[helpedId].seat + 1) helper.counters.helpedFirstAttacker = 1;
  for (const b of s.bonds) {
    if (!b.onMutualHelp || b.fired.includes("mutual") || !b.members.includes(helperId) || !b.members.includes(helpedId)) continue;
    const mark = `help:${helperId}>${helpedId}`;
    if (!b.fired.includes(mark)) b.fired.push(mark);
    if (!b.fired.includes(`help:${helpedId}>${helperId}`)) continue;
    b.fired.push("mutual");
    for (const id of [helperId, helpedId]) gainFate(ctx, s.players[id], b.onMutualHelp, m`helping each other`);
  }
  queueTrigger(ctx, { kind: "HELPED_BY_PLAYER", subjectId: helpedId, sourceId: helperId });
}
