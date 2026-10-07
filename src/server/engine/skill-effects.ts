// Effect handlers that answer other things (cancel, weaken, redirect, copy),
// move state between players (swap, bond, borrow), and manage abilities and
// rules. One handler per Effect kind; every ability that uses the kind goes
// through it (docs/skill-mapping-notes.md has what each word means here).
import { ROSTER } from "../../shared/characters/roster/index.ts";
import type { TargetRule } from "../../shared/characters/types.ts";
import type { PlayerId, Status } from "../../shared/game/state.ts";
import { statusLong } from "../../shared/game/scenario01/statuses.ts";
import { log, newId, type Ctx } from "./context.ts";
import { d6 } from "./rng.ts";
import { setRollValue } from "./dice.ts";
import { applyEffects, registerHandler, subjects, type Scope } from "./effects.ts";
import { addStatus, gainFate, loseFate, present, removeStatus } from "./players.ts";
import { pick, shuffle } from "./rng.ts";
import { resolvable, runEffects, skillOf } from "./resolver.ts";

const selfOf = (scope: Scope): PlayerId | undefined => scope.self ?? (scope.ownerId === "SYSTEM" ? undefined : scope.ownerId);
const nick = (ctx: Ctx, id: PlayerId) => ctx.s.players[id]?.nickname ?? "Someone";
const peek = (ctx: Ctx, id: PlayerId, text: string) => ctx.s.secrets[id]?.peeks.push({ id: newId(ctx, "peek"), text, round: ctx.s.round });

// ---- answering a parked effect or ability (intercept.ts) -------------------------

registerHandler("CANCEL_EFFECT", (ctx, e, scope) => {
  const s = ctx.s;
  switch (e.which) {
    case "INCOMING":
    case "PENDING_TRANSFER":
    case "FATE_THEFT":
    case "CONFLICTING_ABILITIES":
      if (s.pendingEffect) s.pendingEffect.cancelled = true;
      return;
    case "LAST_SPECIAL_RULE":
      // Debug: the public event being revealed is cancelled
      if (s.currentEvent?.revealing) s.currentEvent.cancelled = true;
      return;
    case "GLOBAL_EFFECT":
      if (s.ruleMods.length) log(ctx, `${scope.label}: every rule change in play ends.`, "RULE");
      s.ruleMods = [];
      for (const p of present(ctx)) clearOneNegative(ctx, p.playerId, scope.label);
      return;
    case "OPPOSITION_STATE":
      for (const id of scope.targets) clearOneNegative(ctx, id, scope.label);
      return;
  }
});

function clearOneNegative(ctx: Ctx, id: PlayerId, label: string): void {
  const p = ctx.s.players[id];
  const st = p.statuses.find((x) => x.polarity === "NEGATIVE" && x.ordinary);
  if (!st) return;
  removeStatus(p, st.id);
  log(ctx, `${label}: ${p.nickname} is cleared of ${statusLong(st.kind)}.`, "STATUS", id);
}

registerHandler("REDUCE_EFFECT", (ctx, e) => {
  if (ctx.s.pendingEffect) ctx.s.pendingEffect.reduced += e.levels;
});

registerHandler("REDIRECT", (ctx, e, scope) => {
  const pe = ctx.s.pendingEffect;
  if (!pe || pe.kind !== "EFFECT") return;
  const self = selfOf(scope);
  let to: PlayerId | undefined;
  if (e.to === "SELF") to = self;
  else if (e.to === "SOURCE") to = pe.sourceId === "SYSTEM" ? undefined : pe.sourceId;
  else {
    const legal = present(ctx).map((p) => p.playerId).filter((id) => id !== pe.targetId && id !== pe.sourceId);
    to = legal.length ? pick(ctx.s, legal) : undefined;
  }
  if (!to || to === pe.targetId) return;
  if (e.to === "SELF" && self) ctx.s.players[self].stats.damageTakenForOthers++;
  log(ctx, `${scope.label}: ${pe.label} turns toward ${nick(ctx, to)}.`, "DEFENCE", to);
  pe.targetId = to;
  pe.targets[0] = to;
});

registerHandler("DICTATE_TARGET", (ctx, _e, scope) => {
  // Technicality: a declared ability must pick a different legal target
  const pe = ctx.s.pendingEffect;
  if (!pe || pe.kind !== "ABILITY") return;
  const source = pe.sourceId as PlayerId;
  const legal = present(ctx).map((p) => p.playerId).filter((id) => id !== source && !pe.targets.includes(id));
  if (!legal.length) return void (pe.cancelled = true);
  const old = pe.targetId;
  const fresh = pick(ctx.s, legal);
  pe.targets = pe.targets.map((t) => (t === old ? fresh : t));
  pe.targetId = fresh;
  log(ctx, `${scope.label}: ${nick(ctx, source)}'s ${pe.label} has to find another target: ${nick(ctx, fresh)}.`, "SKILL");
});

// ---- copies ----------------------------------------------------------------------

const AUTO_TARGET: TargetRule[] = ["SELF", "NONE", "ALL_PLAYERS", "LOWEST_FATE", "HIGHEST_FATE", "RANDOM_PLAYERS"];

/** Skills a random draw may produce: copyable, active, runnable now without a chosen target. */
const copyPool = (ctx: Ctx, owner: PlayerId, otherZodiacOnly: boolean) => {
  const mine = ROSTER.find((c) => c.id === ctx.s.players[owner].characterId)!;
  return ROSTER.filter(
    (c) =>
      c.skill.copyable &&
      c.skill.type === "ACTIVE" &&
      AUTO_TARGET.includes(c.skill.target) &&
      !c.skill.requires &&
      resolvable(c.skill) &&
      !c.skill.effects.some((x) => x.kind === "COPY_EFFECT") &&
      (!otherZodiacOnly || c.zodiac !== mine.zodiac),
  );
};

function copyStatus(ctx: Ctx, st: Status, to: PlayerId, weaken: boolean, rounds: number | undefined, label: string): void {
  const value = st.value !== undefined && weaken ? Math.max(1, st.value - 1) : st.value;
  const until = rounds !== undefined ? ctx.s.round + rounds - 1 : weaken ? ctx.s.round : st.expiresAtRound;
  addStatus(ctx, ctx.s.players[to], { kind: st.kind, polarity: st.polarity, sourceId: "SYSTEM", expiresAtRound: until, hidden: false, ordinary: true, value });
  log(ctx, `${label}: ${nick(ctx, to)} gains ${weaken ? "a weaker " : ""}${statusLong(st.kind)}.`, "STATUS", to);
}

registerHandler("COPY_EFFECT", (ctx, e, scope) => {
  const s = ctx.s;
  const self = selfOf(scope);
  if (!self) return;
  switch (e.source) {
    case "INCOMING": {
      // the parked effect also goes back to whoever sent it (whole, or weaker)
      if (s.pendingEffect?.kind === "EFFECT") s.pendingEffect.copyBack.push({ weaken: !!e.weaken });
      return;
    }
    case "LAST_SKILL": {
      const last = s.lastSkill;
      if (!last || last.ownerId === self) return;
      const skill = ROSTER.find((c) => c.id === last.characterId)!.skill;
      if (!skill.copyable || skill.type !== "ACTIVE" || !resolvable(skill)) return log(ctx, `${scope.label}: ${skill.name} can't be copied.`, "SKILL", self);
      log(ctx, `${nick(ctx, self)} copies ${skill.name}.`, "SKILL", self);
      return runEffects(ctx, self, skill, last.targets.filter((t) => s.players[t]));
    }
    case "TARGET_BUFF":
    case "TARGET_ZODIAC_BUFF": {
      // a buff just gained (Spread the Word) or one a chosen player holds (Become You)
      const from = scope.trigger?.status ?? subjects(ctx, scope, "TARGET").map((id) => s.players[id].statuses.find((st) => st.polarity === "POSITIVE" && st.ordinary)).find(Boolean);
      const to = e.to ? subjects(ctx, scope, e.to)[0] : self;
      if (!from || !to) return;
      return copyStatus(ctx, from, to, !!e.weaken, e.rounds, scope.label);
    }
    case "TARGET_REWARD": {
      const to = e.to ? subjects(ctx, scope, e.to)[0] : self;
      const t = scope.trigger;
      if (!to || !t) return;
      if (t.item) {
        s.players[to].items.push(t.item);
        return log(ctx, `${scope.label}: ${nick(ctx, to)} gets the same item.`, "ITEM", to);
      }
      if (t.amount) gainFate(ctx, s.players[to], Math.min(2, t.amount), scope.label);
      return;
    }
    case "RANDOM_ROSTER":
    case "RANDOM_OTHER_ZODIAC": {
      const pool = copyPool(ctx, self, e.source === "RANDOM_OTHER_ZODIAC");
      if (!pool.length) return;
      const drawn = pick(s, pool);
      log(ctx, `${scope.label}: ${nick(ctx, self)} draws ${drawn.skill.name} (${drawn.nickname}) and uses it at once.`, "SKILL", self);
      const targets = drawn.skill.target === "RANDOM_PLAYERS" ? shuffle(s, present(ctx).map((p) => p.playerId)).slice(0, drawn.skill.count ?? 2) : [];
      return runEffects(ctx, self, drawn.skill, targets);
    }
  }
});

// ---- swaps, bonds, borrowed abilities --------------------------------------------

const tempStatus = (ctx: Ctx, id: PlayerId, hidden: boolean) => ctx.s.players[id]?.statuses.find((st) => st.ordinary && st.hidden === hidden && st.expiresAtRound !== null);

registerHandler("SWAP_STATE", (ctx, e, scope) => {
  const s = ctx.s;
  if (e.what === "ROLL_RESULT") {
    // Switcheroo: the roll about to resolve takes the best result anyone rolled this round
    const roll = s.roll;
    if (roll && !roll.done && s.roundRecord.bestRoll > roll.final) setRollValue(ctx, roll, s.roundRecord.bestRoll, scope.label);
    return;
  }
  if (e.what === "STATUS_FOR_STATUS") {
    // Swap Shells: trade away one of your other temporary statuses to cancel the incoming one
    const self = selfOf(scope);
    const pe = s.pendingEffect;
    const give = self ? s.players[self].statuses.find((st) => st.ordinary && st.polarity === "POSITIVE") : undefined;
    if (!pe || !give || !self) return;
    removeStatus(s.players[self], give.id);
    pe.cancelled = true;
    return log(ctx, `${scope.label}: ${nick(ctx, self)} gives up ${statusLong(give.kind)} to shrug it off.`, "DEFENCE", self);
  }
  const random = e.between.every((b) => b === "RANDOM_PLAYER");
  const ids = random ? shuffle(s, present(ctx).map((p) => p.playerId)).slice(0, 2) : e.between.map((b) => subjects(ctx, scope, b)[0]);
  const [a, b] = ids;
  if (!a || !b || a === b) return;
  if (e.what === "BOND") {
    for (const bond of s.bonds) bond.members = bond.members.map((m) => (m === a ? b : m === b ? a : m));
    return log(ctx, `${scope.label}: ${nick(ctx, a)} and ${nick(ctx, b)} trade places in every bond.`, "BOND");
  }
  const hidden = e.what === "HIDDEN_STATUS";
  const sa = tempStatus(ctx, a, hidden);
  const sb = tempStatus(ctx, b, hidden);
  if (!sa && !sb) return;
  const pa = s.players[a];
  const pb = s.players[b];
  if (sa) pa.statuses = pa.statuses.filter((x) => x.id !== sa.id);
  if (sb) pb.statuses = pb.statuses.filter((x) => x.id !== sb.id);
  if (sa) pb.statuses.push(sa);
  if (sb) pa.statuses.push(sb);
  log(ctx, `${scope.label}: ${nick(ctx, a)} and ${nick(ctx, b)} swap ${hidden ? "something hidden" : "a status"}.`, "STATUS");
});

registerHandler("BOND", (ctx, e, scope) => {
  const s = ctx.s;
  const members = [...new Set(e.between.flatMap((b) => subjects(ctx, scope, b)))];
  const groups = e.pairs ? Array.from({ length: Math.floor(members.length / 2) }, (_, i) => members.slice(i * 2, i * 2 + 2)) : [members];
  for (const g of groups) {
    if (g.length < 2) continue;
    s.bonds.push({
      id: newId(ctx, "bond"),
      members: g,
      untilRound: s.round + e.rounds - 1,
      onGainFate: e.onGainFate,
      onFirstSuccess: e.onFirstSuccess,
      onFirstReward: e.onFirstReward,
      onMutualHelp: e.onMutualHelp,
      oneWay: e.oneWay,
      secret: !!e.secret,
      ownerId: selfOf(scope) ?? g[0],
      fired: [],
    });
    if (!e.secret) log(ctx, `${scope.label}: ${g.map((id) => nick(ctx, id)).join(", ")} are bonded${e.rounds > 1 ? ` for ${e.rounds} rounds` : " this round"}.`, "BOND");
  }
  if (e.secret) log(ctx, `${scope.label}: a secret bond is tied.`, "BOND");
});

registerHandler("SHUFFLE_SKILLS", (ctx, e, scope) => {
  const s = ctx.s;
  const holders = present(ctx).filter((p) => p.skill.state === "READY" && p.skill.usesLeft > 0 && !p.skill.borrowed && skillOf(ctx, p.playerId).type === "ACTIVE");
  if (holders.length < 2) return;
  const ids = holders.map((p) => p.characterId);
  // rotate a shuffled order so nobody keeps their own
  const order = shuffle(s, holders.map((_, i) => i));
  order.forEach((from, k) => (holders[from].skill.borrowed = ids[order[(k + 1) % order.length]]));
  s.flags.skillsReturnRound = s.round + e.rounds;
  log(ctx, `${scope.label}: ${holders.length} unused abilities change hands until next round.`, "SKILL");
});

registerHandler("RESTORE_SKILL", (ctx, e, scope) => {
  const self = selfOf(scope);
  for (const id of subjects(ctx, scope, e.who)) {
    const p = ctx.s.players[id];
    if (p.skill.usesLeft > 0) continue;
    if (e.cost && self) {
      const payer = ctx.s.players[self];
      if (payer.fate < e.cost.fate) return log(ctx, `${scope.label}: not enough Fate.`, "SKILL", self);
      loseFate(ctx, payer, e.cost.fate, scope.label);
    }
    p.skill.usesLeft = 1;
    p.skill.state = "READY";
    log(ctx, `${scope.label}: ${p.nickname}'s ability is ready again.`, "SKILL", id);
  }
});

registerHandler("FORBID_TARGETING", (ctx, e, scope) => {
  const protects = subjects(ctx, scope, e.protects)[0];
  for (const id of subjects(ctx, scope, e.who)) {
    if (!protects || id === protects) continue;
    addStatus(ctx, ctx.s.players[id], { kind: "FORBIDDEN_TARGET", polarity: "NEGATIVE", sourceId: protects, expiresAtRound: null, hidden: false, ordinary: false, value: e.uses });
    log(ctx, `${scope.label}: ${nick(ctx, id)}'s next ability can't touch ${nick(ctx, protects)}.`, "STATUS", id);
  }
});

// ---- statuses, rules, stored values -------------------------------------------------

registerHandler("CONVERT_STATUS", (ctx, e, scope) => {
  for (const id of subjects(ctx, scope, e.who)) gainFate(ctx, ctx.s.players[id], e.amount, scope.label);
});

registerHandler("ROLLBACK_STATE", (ctx, e, scope) => {
  for (const id of subjects(ctx, scope, e.who)) {
    const p = ctx.s.players[id];
    const kept = p.statuses.filter((st) => !st.ordinary);
    p.statuses = [...kept, ...(p.lastRoundStatuses ?? []).map((st) => ({ ...st }))];
    log(ctx, `${scope.label}: ${p.nickname}'s statuses roll back to the end of last round.`, "STATUS", id);
  }
});

registerHandler("STORE_RESULT", (ctx, e, scope) => {
  const roll = ctx.s.roll;
  for (const id of subjects(ctx, scope, e.who)) {
    if (!roll || roll.playerId !== id) continue;
    ctx.s.players[id].storedResult = roll.final;
    log(ctx, `${scope.label}: ${nick(ctx, id)} records a ${roll.final} to use later.`, "SKILL", id);
  }
});

registerHandler("PREVIEW_ROLL", (ctx, e, scope) => {
  for (const id of subjects(ctx, scope, e.who)) {
    const p = ctx.s.players[id];
    p.nextRaw = d6(ctx.s);
    peek(ctx, id, `${scope.label}: your next roll will show ${p.nextRaw} before any modifiers.`);
    log(ctx, `${scope.label}: ${p.nickname} sees their next roll coming.`, "SKILL", id);
  }
});

registerHandler("DELAY_EFFECT", (ctx, e, scope) => {
  ctx.s.delayed.push({ dueRound: ctx.s.round + e.rounds, ownerId: selfOf(scope) ?? ctx.s.turnOrder[0], targets: scope.targets, effects: e.effects, label: scope.label });
  log(ctx, `${scope.label}: something is set aside for round ${ctx.s.round + e.rounds}.`, "SKILL", selfOf(scope));
});

registerHandler("SETTLE_DELAYED", (ctx, e, scope) => {
  const s = ctx.s;
  for (const id of subjects(ctx, scope, e.who)) {
    const mine = s.delayed.filter((d) => d.ownerId === id || d.targets.includes(id));
    s.delayed = s.delayed.filter((d) => !mine.includes(d));
    for (const d of mine) applyEffects(ctx, d.effects, { ownerId: d.ownerId, targets: d.targets, label: d.label });
    const p = s.players[id];
    const prepared = p.statuses.find((st) => st.kind === "SHIELD_NEXT_ROUND");
    if (prepared) {
      removeStatus(p, prepared.id);
      p.shields += prepared.value ?? 1;
    }
    log(ctx, mine.length || prepared ? `${scope.label}: what was waiting for ${p.nickname} arrives now.` : `${scope.label}: nothing was waiting for ${p.nickname}.`, "SKILL", id);
  }
});

/** Rule changes for this round (Rewrite the Rules, System Update). */
export const RULES: Record<string, string> = {
  ROLL_BONUS: "+1 to every roll this round",
  EXTRA_AP: "+1 action point for everyone",
  FATE_LIMIT: "Fate can add up to 3 to a roll this round",
};

export function addRule(ctx: Ctx, rule: string, rounds: number, label: string): void {
  const s = ctx.s;
  if (rule === "EXTRA_AP") {
    for (const p of present(ctx)) p.ap += 1;
  } else {
    s.ruleMods.push({ rule, delta: 1, untilRound: s.round + rounds - 1 });
  }
  log(ctx, `${label}: ${RULES[rule]}.`, "RULE");
}

registerHandler("CHANGE_TURN_ORDER", (ctx, e, scope) => {
  const s = ctx.s;
  if (e.scope === "NEXT_ROUND") {
    s.delayed.push({ dueRound: s.round + 1, ownerId: selfOf(scope) ?? s.turnOrder[0], targets: scope.targets, effects: [{ kind: "CHANGE_TURN_ORDER", scope: "FRONT_NOW" }], label: scope.label });
    return log(ctx, `${scope.label}: next round, ${scope.targets.map((id) => nick(ctx, id)).join(", ")} act first.`, "SKILL");
  }
  if (e.scope === "FRONT_NOW") {
    s.turnOrder = [...scope.targets.filter((id) => s.turnOrder.includes(id)), ...s.turnOrder.filter((id) => !scope.targets.includes(id))];
    return;
  }
  // the rest of this round: least Fate first
  const done = s.turnOrder.slice(0, s.activeIndex + 1);
  const rest = s.turnOrder.slice(s.activeIndex + 1).sort((a, b) => s.players[a].fate - s.players[b].fate);
  s.turnOrder = [...done, ...rest];
  log(ctx, `${scope.label}: the rest of the round goes ${rest.map((id) => nick(ctx, id)).join(", ")}.`, "SKILL");
});
