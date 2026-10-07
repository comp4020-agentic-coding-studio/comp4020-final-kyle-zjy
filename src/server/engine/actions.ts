// Player actions. Each action has one check (used both to reject a request
// and to explain a greyed-out button) and one apply. Nothing a client sends is
// trusted: shapes, turn, action points, targets and resources are all checked
// here against the live state.
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import type { ActionAvailability, GameAction, GameActionType, RejectCode, TradeOffer } from "../../shared/game/actions.ts";
import { AP_COST } from "../../shared/game/actions.ts";
import { CARRIAGES, ITEMS, MAX_HELP_BONUS, MAX_SANITY } from "../../shared/game/scenario01/content.ts";
import type { GameState, PlayerGameState, PlayerId } from "../../shared/game/state.ts";
import { neighboursOf } from "./beats.ts";
import { activePlayerId, cue, log, RuleError, type Ctx } from "./context.ts";
import { startRoll } from "./dice.ts";
import { applyEffects, statusName } from "./effects.ts";
import { endTurn } from "./flow.ts";
import { anchorName, LOCK_NAMES, repairTarget } from "./outcomes.ts";
import { gainFate, gainSanity, identityAt, removeStatus, spendFate, visit } from "./players.ts";
import { queueTrigger } from "./trigger-queue.ts";
import { activeRequirementHolds, resolvable, useSkill } from "./resolver.ts";
import { canUseSkill } from "./skills.ts";
import { answerWindow, onResume, openWindow } from "./windows.ts";

type Fail = { code: RejectCode; reason: string };
const fail = (code: RejectCode, reason: string): Fail => ({ code, reason });

const IN_RUN = new Set(["ACT_1", "ACT_2", "ACT_3"]);

/** Shared gate for anything done on your own turn. */
function turnGate(s: GameState, actorId: PlayerId, cost: number): Fail | null {
  if (s.phase === "ENDING" || s.phase === "RESULTS") return fail("GAME_OVER", "The run is over.");
  if (!IN_RUN.has(s.phase)) return fail("WRONG_PHASE", "The run hasn't started yet.");
  if (s.sequence) return fail("WRONG_PHASE", "Wait for the scene to finish.");
  if (s.pending.some((w) => w.blocksTable) || (s.roll && !s.roll.done)) return fail("WINDOW_OPEN", "Wait for the current decision to finish.");
  const active = activePlayerId(s);
  if (active !== actorId) return fail("NOT_YOUR_TURN", active ? `It's ${s.players[active].nickname}'s turn.` : "Nobody is acting right now.");
  if (s.players[actorId].ap < cost) return fail("NO_AP", cost === 2 ? "Needs 2 action points." : "No action points left.");
  return null;
}

const others = (s: GameState, p: PlayerGameState) => Object.values(s.players).filter((o) => o.playerId !== p.playerId && !o.away);
const sameCarriage = (s: GameState, p: PlayerGameState) => others(s, p).filter((o) => o.carriageIndex === p.carriageIndex);
const ctxOf = (s: GameState): Ctx => ({ s, now: 0, events: [] });

function adjacent(s: GameState, p: PlayerGameState): number[] {
  return [p.carriageIndex - 1, p.carriageIndex + 1].filter((i) => i >= 0 && i < s.carriages.length && !s.carriages[i].locked);
}

type Spec<A extends GameAction = GameAction> = {
  check: (s: GameState, p: PlayerGameState, a?: A) => Fail | null;
  apply: (ctx: Ctx, p: PlayerGameState, a: A) => void;
  targets?: (s: GameState, p: PlayerGameState) => (string | number)[];
  hint?: (s: GameState, p: PlayerGameState) => string | undefined;
};

const MOVE: Spec<Extract<GameAction, { type: "MOVE" }>> = {
  targets: (s, p) => adjacent(s, p),
  check: (s, p, a) => {
    if (!adjacent(s, p).length) return fail("ILLEGAL_TARGET", "No open carriage next to you.");
    if (!a) return null;
    if (!Number.isInteger(a.toCarriage)) return fail("INVALID", "Choose a carriage.");
    const c = s.carriages[a.toCarriage];
    if (!c || Math.abs(a.toCarriage - p.carriageIndex) !== 1) return fail("ILLEGAL_TARGET", "You can only move to the next carriage.");
    if (c.locked) return fail("ILLEGAL_TARGET", "The driver's cab is locked until round 8.");
    return null;
  },
  apply: (ctx, p, a) => {
    const from = p.carriageIndex;
    p.carriageIndex = a.toCarriage;
    if (from === 0) p.counters.leftStart = 1;
    visit(ctx, p);
    const identity = identityAt(ctx, a.toCarriage);
    log(ctx, `${p.nickname} moves into the ${CARRIAGES[identity].name}.`, "MOVE", p.playerId);
    cue(ctx, "MOVE", { playerId: p.playerId, from, to: a.toCarriage });
    if (identity === "START" && p.counters.leftStart && !p.counters.returnedStart) {
      p.counters.returnedStart = 1;
      gainSanity(ctx, p, 1, "the safety of the boarding car");
    }
  },
};

const rollAction = (purpose: "INVESTIGATE" | "SEARCH", label: string): Spec => ({
  check: () => null,
  hint: (s, p) => (purpose === "INVESTIGATE" ? CARRIAGES[identityAt(ctxOf(s), p.carriageIndex)].investigateHint : CARRIAGES[identityAt(ctxOf(s), p.carriageIndex)].searchHint),
  apply: (ctx, p) => {
    startRoll(ctx, p, purpose, label, { kind: purpose, carriageIndex: p.carriageIndex });
  },
});

const REPAIR: Spec = {
  check: (s, p) => {
    const ctx = ctxOf(s);
    if (s.act === 1) return fail("ILLEGAL_TARGET", "Nothing here can be repaired until the anchors appear in round 4.");
    const t = repairTarget(ctx, p.carriageIndex);
    if (!t) return fail("ILLEGAL_TARGET", s.act === 2 ? "No reality anchor in this carriage." : "No anchor or escape lock in this carriage.");
    if (t.kind === "ANCHOR") {
      const a = s.anchors[t.anchor];
      const workers = Object.values(s.players).filter((x) => !x.away).length;
      if (a.lastRepairedBy === p.playerId && workers > 1) return fail("ILLEGAL_TARGET", `Someone else must make the next repair on the ${anchorName(a.id)}.`);
      return null;
    }
    if (s.escape.round === s.round && s.escape[t.lock]) return fail("ILLEGAL_TARGET", `The ${LOCK_NAMES[t.lock]} is already engaged this round.`);
    if (t.lock === "route" && s.fragments.length < 3) return fail("ILLEGAL_TARGET", `The Route Lock needs 3 memory fragment types (you have ${s.fragments.length}).`);
    return null;
  },
  hint: (s, p) => {
    const t = repairTarget(ctxOf(s), p.carriageIndex);
    if (!t) return undefined;
    return t.kind === "ANCHOR" ? `Repair the ${anchorName(t.anchor)} (${s.anchors[t.anchor].progress}/${s.anchors[t.anchor].required}).` : `Engage the ${LOCK_NAMES[t.lock]}.`;
  },
  apply: (ctx, p) => {
    const t = repairTarget(ctx, p.carriageIndex)!;
    startRoll(ctx, p, "REPAIR", t.kind === "ANCHOR" ? `repair of the ${anchorName(t.anchor)}` : `${LOCK_NAMES[t.lock]}`, { kind: "REPAIR", carriageIndex: p.carriageIndex });
  },
};

const HELP: Spec<Extract<GameAction, { type: "HELP" }>> = {
  targets: (s, p) => sameCarriage(s, p).filter((o) => o.helpBonus < MAX_HELP_BONUS).map((o) => o.playerId),
  check: (s, p, a) => {
    if (!sameCarriage(s, p).length) return fail("ILLEGAL_TARGET", "Nobody else is in your carriage.");
    if (!a) return null;
    const t = s.players[a.targetId];
    if (!t || t.away || t.playerId === p.playerId) return fail("ILLEGAL_TARGET", "Choose another passenger.");
    if (t.carriageIndex !== p.carriageIndex) return fail("ILLEGAL_TARGET", "They need to be in your carriage.");
    if (t.helpBonus >= MAX_HELP_BONUS) return fail("ILLEGAL_TARGET", `${t.nickname} already has the most help they can use (+${MAX_HELP_BONUS}).`);
    return null;
  },
  hint: () => "+1 to their next roll (+2 for a seat neighbour), up to +2.",
  apply: (ctx, p, a) => {
    const t = ctx.s.players[a.targetId];
    const neighbour = neighboursOf(ctx, p.playerId).includes(t.playerId);
    const before = t.helpBonus;
    t.helpBonus = Math.min(MAX_HELP_BONUS, t.helpBonus + (neighbour ? 2 : 1));
    t.helpFrom.push(p.playerId);
    p.stats.helpsGiven++;
    t.stats.helpsReceived++;
    if (neighbour) p.counters.helpedNeighbour = (p.counters.helpedNeighbour ?? 0) + 1;
    log(ctx, `${p.nickname} helps ${t.nickname}${neighbour ? " (seat neighbour)" : ""}: +${t.helpBonus - before} to their next roll.`, "HELP", p.playerId);
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

const describeOffer = (o: TradeOffer) =>
  [...o.items.map((i) => ITEMS[i].name), ...(o.fate ? [`${o.fate} Fate`] : [])].join(" + ") || "nothing";

const TRADE: Spec<Extract<GameAction, { type: "TRADE" }>> = {
  targets: (s, p) => sameCarriage(s, p).map((o) => o.playerId),
  check: (s, p, a) => {
    if (!sameCarriage(s, p).length) return fail("ILLEGAL_TARGET", "Nobody else is in your carriage to trade with.");
    if (!a) return null;
    const t = s.players[a.targetId];
    if (!t || t.away || t.playerId === p.playerId || t.carriageIndex !== p.carriageIndex) return fail("ILLEGAL_TARGET", "You can only trade with someone in your carriage.");
    if (!validOffer(p, a.give)) return fail("INVALID", "You don't have everything you're offering.");
    if (!validOffer(t, a.want)) return fail("INVALID", `${t.nickname} doesn't have what you're asking for.`);
    if (!a.give.items.length && !a.give.fate && !a.want.items.length && !a.want.fate) return fail("INVALID", "Offer or ask for something.");
    return null;
  },
  hint: () => "Swap items or Fate with someone in your carriage. They can refuse.",
  apply: (ctx, p, a) => {
    const t = ctx.s.players[a.targetId];
    log(ctx, `${p.nickname} offers ${t.nickname} a trade.`, "TRADE", p.playerId);
    openWindow(ctx, {
      kind: "TRADE_OFFER",
      title: `${p.nickname} offers a trade`,
      prompt: `You get: ${describeOffer(a.give)}. You give: ${describeOffer(a.want)}.`,
      addressees: [t.playerId],
      options: [
        { id: "ACCEPT", label: "Accept" },
        { id: "DECLINE", label: "Decline" },
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
  if (answers[to.playerId] !== "ACCEPT") return log(ctx, `${to.nickname} declines the trade.`, "TRADE", to.playerId);
  // both sides re-checked: anything may have changed while the offer was open
  if (!validOffer(from, give) || !validOffer(to, want) || from.carriageIndex !== to.carriageIndex) {
    return log(ctx, "The trade falls through: something changed hands in the meantime.", "TRADE");
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
  log(ctx, `${from.nickname} and ${to.nickname} trade: ${describeOffer(give)} for ${describeOffer(want)}.`, "TRADE", from.playerId);
  cue(ctx, "TRADE", { from: from.playerId, to: to.playerId });
});

const STABILIZE: Spec<Extract<GameAction, { type: "STABILIZE" }>> = {
  check: (s, p, a) => {
    const canSanity = p.sanity < MAX_SANITY || p.lost;
    const negatives = p.statuses.filter((st) => st.polarity === "NEGATIVE" && st.ordinary);
    if (!canSanity && !negatives.length) return fail("ILLEGAL_TARGET", "You're already steady: full Sanity and no ordinary negative status.");
    if (!a) return null;
    if (a.mode === "SANITY" && !canSanity) return fail("ILLEGAL_TARGET", "Your Sanity is already full.");
    if (a.mode === "CLEANSE" && !negatives.some((st) => !a.statusId || st.id === a.statusId)) return fail("ILLEGAL_TARGET", "No ordinary negative status to clear.");
    if (a.mode !== "SANITY" && a.mode !== "CLEANSE") return fail("INVALID", "Choose what to steady.");
    return null;
  },
  hint: () => "Recover 1 Sanity, or clear one ordinary negative status.",
  apply: (ctx, p, a) => {
    if (a.mode === "SANITY") return void gainSanity(ctx, p, 1, "steadying themselves");
    const st = p.statuses.find((x) => x.polarity === "NEGATIVE" && x.ordinary && (!a.statusId || x.id === a.statusId))!;
    removeStatus(p, st.id);
    log(ctx, `${p.nickname} shakes off ${statusName(st.kind)}.`, "STATUS", p.playerId);
  },
};

const CONFRONT: Spec<Extract<GameAction, { type: "CONFRONT" }>> = {
  targets: (s, p) => [
    ...(s.inspector.active && s.inspector.banishedUntilRound === null && s.inspector.carriageIndex === p.carriageIndex ? ["INSPECTOR"] : []),
    ...s.entities.filter((e) => e.carriageIndex === p.carriageIndex).map((e) => e.id),
  ],
  check: (s, p, a) => {
    if (p.lost) return fail("ILLEGAL_TARGET", "Lost passengers can't confront anything. Steady yourself first.");
    const targets = CONFRONT.targets!(s, p);
    if (!targets.length) return fail("ILLEGAL_TARGET", "Nothing in this carriage to confront.");
    if (!a) return null;
    const id = a.target === "INSPECTOR" ? "INSPECTOR" : a.entityId;
    if (!id || !targets.includes(id)) return fail("ILLEGAL_TARGET", "That isn't here.");
    return null;
  },
  hint: () => "Success: 1 mark (Perfect: 2). Three marks banish the Inspector for a round.",
  apply: (ctx, p, a) => {
    const target = a.target === "INSPECTOR" ? "INSPECTOR" : a.entityId!;
    p.stats.attacksMade++;
    startRoll(ctx, p, "CONFRONT", target === "INSPECTOR" ? "confrontation with the Inspector" : "confrontation", { kind: "CONFRONT", carriageIndex: p.carriageIndex, target });
  },
};

const USE_SKILL: Spec<Extract<GameAction, { type: "USE_SKILL" }>> = {
  targets: (s, p) => others(s, p).map((o) => o.playerId).concat(p.playerId),
  check: (s, p, a) => {
    const skill = getCharacterById(p.skill.borrowed ?? p.characterId).skill;
    if (skill.type !== "ACTIVE") {
      if (p.skill.usesLeft <= 0) return fail("SKILL_ALREADY_USED", "Your ability is already burned.");
      return fail("NOT_YOUR_WINDOW", skill.type === "REACTION" ? "This ability answers something that happens. You'll be asked when it can fire." : "This ability is offered automatically when its condition comes true.");
    }
    if (!resolvable(skill)) return fail("SKILL_LOCKED", "This ability can't be resolved yet.");
    const targets = a?.targets ?? [];
    if (a && (!Array.isArray(targets) || targets.some((t) => typeof t !== "string"))) return fail("INVALID", "Invalid targets.");
    const check = canUseSkill(s, p.playerId, a ? targets : defaultTargets(s, p));
    if (!check.ok) return fail(check.code, check.reason);
    if (a && !activeRequirementHolds(ctxOf(s), p.playerId, targets)) return fail("ILLEGAL_TARGET", `${skill.name} has nothing to act on right now.`);
    return null;
  },
  hint: (_s, p) => getCharacterById(p.skill.borrowed ?? p.characterId).skill.description,
  apply: (ctx, p, a) => useSkill(ctx, p.playerId, a.targets ?? []),
};

/** For availability only: a legal target set, if one exists, so "can I use it?" is answerable. */
function defaultTargets(s: GameState, p: PlayerGameState): PlayerId[] {
  const rule = getCharacterById(p.skill.borrowed ?? p.characterId).skill.target;
  const pool = others(s, p);
  if (rule === "ANY_PLAYER" || rule === "OTHER_PLAYER") return pool.slice(0, 1).map((o) => o.playerId);
  if (rule === "SAME_CARRIAGE") return sameCarriage(s, p).slice(0, 1).map((o) => o.playerId);
  if (rule === "TWO_PLAYERS") return [p, ...pool].slice(0, 2).map((o) => o.playerId);
  if (rule === "UP_TO_THREE_PLAYERS") return [p.playerId];
  return [];
}

const USE_ITEM: Spec<Extract<GameAction, { type: "USE_ITEM" }>> = {
  targets: (s, p) => [...new Set(p.items)],
  check: (s, p, a) => {
    if (!p.items.length) return fail("ILLEGAL_TARGET", "You aren't carrying any items.");
    if (!a) return null;
    if (!(a.item in ITEMS) || !p.items.includes(a.item)) return fail("ILLEGAL_TARGET", "You don't have that item.");
    if (a.item === "POCKET_WATCH" && s.collapse === 0) return fail("ILLEGAL_TARGET", "Collapse is already at 0.");
    if (ITEMS[a.item].needsTarget && a.targetId && a.targetId !== p.playerId) {
      const t = s.players[a.targetId];
      if (!t || t.away || t.carriageIndex !== p.carriageIndex) return fail("ILLEGAL_TARGET", "They need to be in your carriage.");
    }
    return null;
  },
  hint: () => "Items cost no action points.",
  apply: (ctx, p, a) => {
    p.items.splice(p.items.indexOf(a.item), 1);
    const target = a.targetId ?? p.playerId;
    log(ctx, `${p.nickname} uses the ${ITEMS[a.item].name}.`, "ITEM", p.playerId);
    cue(ctx, "ITEM_USED", { playerId: p.playerId, item: a.item, targetId: target });
    applyEffects(ctx, ITEMS[a.item].effects, { ownerId: p.playerId, targets: [target], label: ITEMS[a.item].name });
  },
};

const END_TURN: Spec = {
  check: () => null,
  apply: (ctx, p) => {
    log(ctx, `${p.nickname} ends their turn.`, "TURN", p.playerId);
    endTurn(ctx);
  },
};

const SPECS: Partial<Record<GameActionType, Spec<never>>> = {
  MOVE,
  INVESTIGATE: rollAction("INVESTIGATE", "investigation"),
  SEARCH: rollAction("SEARCH", "search"),
  REPAIR,
  HELP,
  TRADE,
  STABILIZE,
  CONFRONT,
  USE_SKILL,
  USE_ITEM,
  END_TURN,
};

export const TURN_ACTIONS: GameActionType[] = ["MOVE", "INVESTIGATE", "SEARCH", "REPAIR", "HELP", "TRADE", "STABILIZE", "CONFRONT", "USE_SKILL", "USE_ITEM", "END_TURN"];

/** Validates and applies one player action. Throws RuleError on rejection. */
export function applyAction(ctx: Ctx, actorId: PlayerId, action: GameAction): void {
  const s = ctx.s;
  const p = s.players[actorId];
  if (!p) throw new RuleError("NOT_IN_ROOM", "You're not in this run.");
  if (!action || typeof action !== "object" || typeof action.type !== "string") throw new RuleError("INVALID", "Unknown action.");
  if (action.type === "RESPOND") {
    if (s.phase === "RESULTS") throw new RuleError("GAME_OVER", "The run is over.");
    if (typeof action.windowId !== "string" || typeof action.optionId !== "string") throw new RuleError("INVALID", "Invalid answer.");
    return answerWindow(ctx, actorId, action.windowId, action.optionId);
  }
  if (action.type === "ACK_SEQUENCE") {
    if (s.sequence && !s.sequence.acks.includes(actorId)) s.sequence.acks.push(actorId);
    return;
  }
  const spec = SPECS[action.type] as Spec<GameAction> | undefined;
  if (!spec) throw new RuleError("INVALID", "Unknown action.");
  const cost = AP_COST[action.type] ?? 0;
  const gate = turnGate(s, actorId, cost) ?? spec.check(s, p, action);
  if (gate) throw new RuleError(gate.code, gate.reason);
  p.ap -= cost;
  spec.apply(ctx, p, action);
}

/** What the viewer can do right now, with a reason for everything they can't. */
export function availableActions(s: GameState, viewerId: PlayerId): ActionAvailability[] {
  const p = s.players[viewerId];
  if (!p) return [];
  return TURN_ACTIONS.map((type) => {
    const spec = SPECS[type] as Spec<GameAction>;
    const apCost = AP_COST[type] ?? 0;
    const gate = turnGate(s, viewerId, apCost) ?? spec.check(s, p);
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
function helped(ctx: Ctx, helperId: PlayerId, helpedId: PlayerId): void {
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
    for (const id of [helperId, helpedId]) gainFate(ctx, s.players[id], b.onMutualHelp, "helping each other");
  }
  queueTrigger(ctx, { kind: "HELPED_BY_PLAYER", subjectId: helpedId, sourceId: helperId });
}
