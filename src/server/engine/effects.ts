// Effect handlers: one per Effect kind, shared by abilities, items and events.
// A skill, an item or an event card is just a list of effects; this module is
// the only place their meaning lives.
import { FRAGMENTS, isKeyItem, KEY_FOR_ANCHOR, LOCK_FOR_KEY, MAX_SANITY } from "../../shared/game/scenario01/content.ts";
import type { Effect, EffectKind, EffectSubject } from "../../shared/game/effects.ts";
import { statusLong as statusName } from "../../shared/game/scenario01/statuses.ts";
import type { Anchor, FragmentType, ItemId, PlayerId } from "../../shared/game/state.ts";
import { cue, log, newId, type Ctx } from "./context.ts";
import { rulesFor } from "./scenario.ts";
import type { TriggerEvent } from "./skills.ts";
import { clampDie, setRollValue, tierOf } from "./dice.ts";
import { int, pick, shuffle } from "./rng.ts";
import { list, m, ref } from "../../shared/i18n/msg.ts";
import type { Msg } from "../../shared/i18n/types.ts";
import {
  absorbs,
  addStatus,
  gainFate,
  gainSanity,
  loseFate,
  loseSanity,
  present,
  removeStatus,
  spendFate,
  visit,
} from "./players.ts";

export type Scope = {
  ownerId: PlayerId | "SYSTEM";
  /** Who SELF means (per-player event contexts); defaults to the owner. */
  self?: PlayerId;
  targets: PlayerId[];
  triggerSource?: PlayerId | "SYSTEM";
  triggerSubject?: PlayerId;
  label: Msg;
  /** A group effect hitting most players (some immunities only answer these). */
  group?: boolean;
  /** The event that woke the ability being resolved. */
  trigger?: TriggerEvent;
  /** Restricts ALL / OTHERS / RANDOM / LOWEST / HIGHEST to these players (extra events). */
  pool?: PlayerId[];
  /** Applying a parked effect: don't park it again. */
  landing?: boolean;
};

export function subjects(ctx: Ctx, scope: Scope, who: EffectSubject): PlayerId[] {
  const s = ctx.s;
  const alive = present(ctx).map((p) => p.playerId).filter((id) => !scope.pool || scope.pool.includes(id));
  const selfId = scope.self ?? (scope.ownerId === "SYSTEM" ? undefined : scope.ownerId);
  const pickBy = (score: (id: PlayerId) => number, best: "min" | "max") => {
    if (alive.length === 0) return [];
    const scores = alive.map(score);
    const target = best === "min" ? Math.min(...scores) : Math.max(...scores);
    const tied = alive.filter((_, i) => scores[i] === target);
    return [tied.length === 1 ? tied[0] : pick(s, tied)];
  };
  switch (who) {
    case "SELF":
      return selfId ? [selfId] : [];
    case "TARGET":
      return scope.targets.slice(0, 1);
    case "TARGETS":
      return scope.targets;
    case "SECOND_TARGET":
      return scope.targets.slice(1, 2);
    case "TRIGGER_SOURCE":
      return scope.triggerSource && scope.triggerSource !== "SYSTEM" ? [scope.triggerSource] : [];
    case "TRIGGER_SUBJECT":
      return scope.triggerSubject ? [scope.triggerSubject] : [];
    case "ALL":
      return alive;
    case "OTHERS":
      return alive.filter((id) => id !== selfId);
    case "RANDOM_PLAYER":
      return alive.length ? [pick(s, alive)] : [];
    case "LOWEST_FATE":
      return pickBy((id) => s.players[id].fate, "min");
    case "HIGHEST_FATE":
      return pickBy((id) => s.players[id].fate, "max");
    case "TWO_LOWEST_FATE":
      return shuffle(s, alive).sort((a, b) => s.players[a].fate - s.players[b].fate).slice(0, 2);
    case "LAST_SUCCESS":
      return s.roundRecord.lastSuccess && alive.includes(s.roundRecord.lastSuccess) ? [s.roundRecord.lastSuccess] : [];
  }
}

/** Does a negative effect from this scope land on `targetId`? (shields, immunities) */
function lands(ctx: Ctx, scope: Scope, targetId: PlayerId): boolean {
  const p = ctx.s.players[targetId];
  if (!p) return false;
  if (absorbs(ctx, p, scope.label, scope.group)) return false;
  noteHarm(ctx, scope, targetId);
  return true;
}

/** Records a negative effect landing: who was hurt, and who attacked whom (round record, counters). */
function noteHarm(ctx: Ctx, scope: Scope, targetId: PlayerId): void {
  const rr = ctx.s.roundRecord;
  if (!rr.hurt.includes(targetId)) rr.hurt.push(targetId);
  const source = scope.ownerId;
  if (source === "SYSTEM" || source === targetId) return;
  rr.attacks.push([source, targetId]);
  if (!rr.attackers.includes(source)) rr.attackers.push(source);
  const attacker = ctx.s.players[source];
  attacker.counters.playerAttacks = (attacker.counters.playerAttacks ?? 0) + 1;
  const victim = ctx.s.players[targetId];
  victim.counters.firstAttackerSeat ??= attacker.seat + 1;
}

/** Parks a single-target negative effect for reactions (intercept.ts). True if parked. */
type Interceptor = (ctx: Ctx, e: Effect, scope: Scope, targetId: PlayerId, recipient?: PlayerId) => boolean;
let intercept: Interceptor = () => false;
export const setInterceptor = (fn: Interceptor) => (intercept = fn);

/** The subjects of a negative effect, minus the one parked for reactions (at most one at a time). */
function negativeSubjects(ctx: Ctx, e: Effect, scope: Scope, who: EffectSubject, recipient?: PlayerId): PlayerId[] {
  const ids = subjects(ctx, scope, who);
  const parked = ids.find((id) => intercept(ctx, e, scope, id, recipient));
  return parked ? ids.filter((id) => id !== parked) : ids;
}

export function grantItem(ctx: Ctx, playerId: PlayerId, pool: "ANY" | "CONSUMABLE" | "BUFF", why: Msg): ItemId {
  const pools = rulesFor(ctx.s).itemPools;
  const item = pick(ctx.s, pool === "BUFF" ? pools.buff : pools.any);
  const p = ctx.s.players[playerId];
  p.items.push(item);
  log(ctx, m`${p.nickname} gains an item (${why}).`, "ITEM", playerId);
  cue(ctx, "ITEM", { playerId, item });
  return item;
}

export function grantFragment(ctx: Ctx, fragment: FragmentType, by?: PlayerId): boolean {
  if (ctx.s.fragments.includes(fragment)) return false;
  ctx.s.fragments.push(fragment);
  if (by) ctx.s.players[by].stats.fragmentsFound++;
  log(ctx, m`Memory fragment recovered: ${ref.fragment(fragment)}. "${ref.fragmentText(fragment)}"`, "FRAGMENT", by);
  cue(ctx, "FRAGMENT", { fragment, by });
  return true;
}

type Handler<K extends EffectKind> = (ctx: Ctx, e: Extract<Effect, { kind: K }>, scope: Scope) => void;
type Registry = { [K in EffectKind]?: Handler<K> };

const H: Registry = {
  GAIN_FATE: (ctx, e, scope) => {
    for (const id of subjects(ctx, scope, e.who)) gainFate(ctx, ctx.s.players[id], e.amount, scope.label);
  },
  LOSE_FATE: (ctx, e, scope) => {
    for (const id of negativeSubjects(ctx, e, scope, e.who)) if (lands(ctx, scope, id)) loseFate(ctx, ctx.s.players[id], e.amount, scope.label);
  },
  TRANSFER_FATE: (ctx, e, scope) => {
    const to = subjects(ctx, scope, e.to)[0];
    for (const from of negativeSubjects(ctx, e, scope, e.from, to)) {
      if (!to || from === to || !lands(ctx, scope, from)) continue;
      const moved = loseFate(ctx, ctx.s.players[from], e.amount);
      if (moved) {
        gainFate(ctx, ctx.s.players[to], moved);
        log(ctx, m`${ctx.s.players[from].nickname} passes ${moved} Fate to ${ctx.s.players[to].nickname} (${scope.label}).`, "FATE", to);
      }
    }
  },
  BALANCE_FATE: (ctx, e, scope) => {
    const [a] = subjects(ctx, scope, e.between[0]);
    const [b] = subjects(ctx, scope, e.between[1]);
    if (!a || !b || a === b) return;
    const pa = ctx.s.players[a];
    const pb = ctx.s.players[b];
    const [hi, lo] = pa.fate >= pb.fate ? [pa, pb] : [pb, pa];
    const step = Math.min(e.maxStep, Math.floor((hi.fate - lo.fate) / 2));
    if (step <= 0) return;
    spendFate(ctx, hi, step);
    lo.fate += step;
    log(ctx, m`${scope.label}: ${hi.nickname} → ${lo.nickname}, ${step} Fate.`, "FATE");
  },
  LOCK_FATE: (ctx, e, scope) => {
    for (const id of subjects(ctx, scope, e.who)) {
      addStatus(ctx, ctx.s.players[id], { kind: "FATE_LOCKED", polarity: "POSITIVE", sourceId: scope.ownerId, expiresAtRound: ctx.s.round + e.rounds - 1, hidden: false, ordinary: true });
      log(ctx, m`${ctx.s.players[id].nickname}'s Fate is locked this round.`, "STATUS", id);
    }
  },
  GAIN_SANITY: (ctx, e, scope) => {
    for (const id of subjects(ctx, scope, e.who)) gainSanity(ctx, ctx.s.players[id], e.amount, scope.label);
  },
  LOSE_SANITY: (ctx, e, scope) => {
    for (const id of negativeSubjects(ctx, e, scope, e.who)) if (lands(ctx, scope, id)) loseSanity(ctx, ctx.s.players[id], e.amount, scope.label);
  },
  GAIN_AP: (ctx, e, scope) => {
    for (const id of subjects(ctx, scope, e.who)) {
      const p = ctx.s.players[id];
      p.ap = Math.max(0, p.ap + e.amount);
      log(ctx, e.amount > 1 ? m`${p.nickname} gains ${e.amount} action points (${scope.label}).` : e.amount === 1 ? m`${p.nickname} gains 1 action point (${scope.label}).` : m`${p.nickname} gives up their remaining actions (${scope.label}).`, "AP", id);
    }
  },
  CHANGE_COLLAPSE: (ctx, e, scope) => changeCollapse(ctx, e.delta, scope.label),
  GRANT_ITEM: (ctx, e, scope) => {
    for (const id of subjects(ctx, scope, e.who)) for (let i = 0; i < e.count; i++) grantItem(ctx, id, e.pool, scope.label);
  },
  STEAL_ITEM: (ctx, e, scope) => {
    const thief = scope.self ?? scope.ownerId;
    if (thief === "SYSTEM") return;
    for (const id of negativeSubjects(ctx, e, scope, e.from)) {
      const victim = ctx.s.players[id];
      // key items only ever move by a trade
      const takeable = victim.items.map((it, i) => [it, i] as const).filter(([it]) => !isKeyItem(it));
      if (!takeable.length || id === thief || !lands(ctx, scope, id)) continue;
      // Snatch takes the very item the reward gave; otherwise one at random
      const wanted = scope.trigger?.item ? takeable.filter(([it]) => it === scope.trigger!.item).at(-1) : undefined;
      const at = (wanted ?? takeable[int(ctx.s, takeable.length)])[1];
      const item = victim.items.splice(at, 1)[0];
      ctx.s.players[thief].items.push(item);
      log(ctx, m`${ctx.s.players[thief].nickname} takes an item from ${victim.nickname} (${scope.label}).`, "ITEM", thief);
      return;
    }
  },
  ADD_STATUS: (ctx, e, scope) => {
    const polarity = e.polarity ?? "POSITIVE";
    for (const id of polarity === "NEGATIVE" ? negativeSubjects(ctx, e, scope, e.who) : subjects(ctx, scope, e.who)) {
      if (polarity === "NEGATIVE" && !lands(ctx, scope, id)) continue;
      addStatus(ctx, ctx.s.players[id], {
        kind: e.status,
        polarity,
        sourceId: scope.ownerId,
        expiresAtRound: e.rounds >= 99 ? null : ctx.s.round + e.rounds - 1,
        hidden: !!e.hidden,
        ordinary: true,
        value: e.value,
      });
      if (!e.hidden) log(ctx, polarity === "NEGATIVE" ? m`${ctx.s.players[id].nickname} is afflicted with ${ref.status(e.status)} (${scope.label}).` : m`${ctx.s.players[id].nickname} gains ${ref.status(e.status)} (${scope.label}).`, "STATUS", id);
    }
  },
  REMOVE_STATUS: (ctx, e, scope) => {
    for (const id of subjects(ctx, scope, e.who)) {
      const p = ctx.s.players[id];
      const matches = p.statuses.filter((st) => (e.polarity === "ANY" || st.polarity === e.polarity) && (!e.ordinaryOnly || st.ordinary));
      const take = e.count === "ALL" ? matches : matches.slice(0, e.count);
      for (const st of take) removeStatus(p, st.id);
      if (take.length) log(ctx, m`${scope.label}: ${p.nickname} is cleared of ${list(take.map((st) => ref.status(st.kind)))}.`, "STATUS", id);
    }
  },
  EXTEND_STATUS: (ctx, e, scope) => {
    // a buff that was just used up comes back for one more round (Can't Let Go)
    const used = scope.trigger?.condition === "USED" ? scope.trigger.status : undefined;
    if (used && scope.trigger?.subjectId) {
      const p = ctx.s.players[scope.trigger.subjectId];
      addStatus(ctx, p, { ...used, expiresAtRound: ctx.s.round + e.rounds });
      return log(ctx, m`${scope.label}: ${p.nickname}'s ${ref.status(used.kind)} lasts one more round.`, "STATUS", p.playerId);
    }
    for (const id of subjects(ctx, scope, e.who)) {
      for (const st of ctx.s.players[id].statuses) if (st.polarity === e.polarity && st.expiresAtRound !== null) st.expiresAtRound += e.rounds;
    }
  },
  SHIELD: (ctx, e, scope) => {
    for (const id of subjects(ctx, scope, e.who)) {
      const p = ctx.s.players[id];
      if (e.fromRound === "NEXT") {
        addStatus(ctx, p, { kind: "SHIELD_NEXT_ROUND", polarity: "POSITIVE", sourceId: scope.ownerId, expiresAtRound: null, hidden: false, ordinary: false, value: e.charges });
        log(ctx, m`${p.nickname} prepares a shield for next round (${scope.label}).`, "DEFENCE", id);
      } else {
        p.shields += e.charges;
        log(ctx, m`${p.nickname} gains ${e.charges} shield (${scope.label}).`, "DEFENCE", id);
      }
      cue(ctx, "SHIELD_UP", { playerId: id });
    }
  },
  IMMUNITY: (ctx, e, scope) => {
    const kind = e.scope === "NEGATIVE" ? "IMMUNE_NEGATIVE" : e.scope === "GROUP_NEGATIVE" ? "IMMUNE_GROUP" : e.scope === "DIRECT_ABILITY" ? "IMMUNE_ABILITY" : "UNTARGETABLE";
    for (const id of subjects(ctx, scope, e.who)) {
      addStatus(ctx, ctx.s.players[id], { kind, polarity: "POSITIVE", sourceId: scope.ownerId, expiresAtRound: ctx.s.round + Math.max(1, e.rounds) - 1, hidden: false, ordinary: false, value: e.charges ?? 1 });
      log(ctx, m`${ctx.s.players[id].nickname} is protected: ${ref.status(kind)} (${scope.label}).`, "DEFENCE", id);
    }
  },
  GRANT_FRAGMENT: (ctx, e, scope) => {
    const by = scope.self ?? (scope.ownerId === "SYSTEM" ? undefined : scope.ownerId);
    if (e.fragment !== "RANDOM_MISSING") return void grantFragment(ctx, e.fragment, by);
    const missing = (Object.keys(FRAGMENTS) as FragmentType[]).filter((f) => !ctx.s.fragments.includes(f));
    if (missing.length) grantFragment(ctx, pick(ctx.s, missing), by);
  },
  GRANT_CORE_MEMORY: (ctx, e, scope) => {
    ctx.s.coreMemories += e.amount;
    log(ctx, m`A core memory surfaces (${scope.label}). Core memories: ${ctx.s.coreMemories}.`, "CORE", scope.self);
    cue(ctx, "CORE_MEMORY", { total: ctx.s.coreMemories });
  },
  SPAWN_ENTITY: (ctx, e, scope) => {
    const self = scope.self ? ctx.s.players[scope.self] : undefined;
    const middle = ctx.s.carriages.filter((c) => c.identity !== "START" && !c.locked).map((c) => c.index);
    const where = e.where === "SUBJECT_CARRIAGE" && self ? self.carriageIndex : pick(ctx.s, middle);
    ctx.s.entities.push({ id: newId(ctx, "ent"), kind: e.entity, carriageIndex: where, hp: 2, targetId: null });
    log(ctx, e.entity === "SHADOW" ? m`A shadow passenger takes a seat that wasn't there before.` : m`An echo of a passenger starts walking the train.`, "ENTITY");
    cue(ctx, "ENTITY_SPAWN", { kind: e.entity, carriageIndex: where });
  },
  REPAIR_ANCHOR: (ctx, e, scope) => {
    const open = Object.values(ctx.s.anchors).filter((a) => !a.repaired);
    if (!open.length) return;
    const weakest = open.sort((a, b) => a.progress / a.required - b.progress / b.required)[0];
    weakest.progress = Math.min(weakest.required, weakest.progress + e.amount);
    log(ctx, m`${scope.label}: the ${ref.anchor(weakest.id)} steadies (${weakest.progress}/${weakest.required}).`, "ANCHOR");
    cue(ctx, "ANCHOR", { anchor: weakest.id, progress: weakest.progress, required: weakest.required });
    if (weakest.progress >= weakest.required) restoreAnchor(ctx, weakest, scope.self ?? (scope.ownerId === "SYSTEM" ? undefined : scope.ownerId));
  },
  MOVE_PLAYER: (ctx, e, scope) => {
    const place = rulesFor(ctx.s).movePlayer;
    if (place) {
      for (const id of subjects(ctx, scope, e.who)) place(ctx, id, e.to, scope.ownerId === "SYSTEM" ? null : scope.ownerId, scope.label);
      return;
    }
    for (const id of subjects(ctx, scope, e.who)) {
      const p = ctx.s.players[id];
      const options = [p.carriageIndex - 1, p.carriageIndex + 1].filter((i) => i >= 0 && i < ctx.s.carriages.length && !ctx.s.carriages[i].locked);
      if (!options.length) continue;
      const from = p.carriageIndex;
      const owner = scope.ownerId === "SYSTEM" ? undefined : ctx.s.players[scope.ownerId];
      if (e.to === "TOWARD_SELF") {
        if (!owner || owner.carriageIndex === from) continue;
        const step = from + Math.sign(owner.carriageIndex - from);
        if (ctx.s.carriages[step]?.locked) continue;
        p.carriageIndex = step;
      } else p.carriageIndex = e.to === "RANDOM" ? pick(ctx.s, ctx.s.carriages.filter((c) => !c.locked).map((c) => c.index)) : pick(ctx.s, options);
      visit(ctx, p);
      cue(ctx, "MOVE", { playerId: id, from, to: p.carriageIndex });
      log(ctx, e.to === "TOWARD_SELF" ? m`${p.nickname} moves one carriage closer (${scope.label}).` : m`${p.nickname} is thrown into another carriage (${scope.label}).`, "MOVE", id);
    }
  },
  MODIFY_RESULT: (ctx, e, scope) => {
    const roll = ctx.s.roll;
    if (!roll || roll.done) return;
    let value = roll.final;
    if (e.toward === "MIDDLE") value = value <= 2 ? value + 1 : value >= 5 ? value - 1 : value;
    else if (e.tiers) value = nextTierValue(value, e.tiers);
    else if (e.pips) value += e.pips;
    setRollValue(ctx, roll, value, scope.label);
  },
  SET_TIER: (ctx, e, scope) => {
    const roll = ctx.s.roll;
    if (!roll || roll.done || !e.from.includes(roll.tier)) return;
    setRollValue(ctx, roll, e.to === "SUCCESS" ? 4 : e.to === "PERFECT" ? 6 : e.to === "FAIL" ? 2 : 1, scope.label);
  },
  REROLL: (ctx, e, scope) => {
    if (e.scope === "ALL") return void rerollGroup(ctx, scope.label);
    const roll = ctx.s.roll;
    if (!roll || roll.done) return;
    const before = roll.final;
    const fresh = clampDie(1 + int(ctx.s, 6) + roll.modifiers.reduce((sum, m) => sum + m.delta, 0) + roll.fateSpent);
    const value = e.keep === "BEST" ? Math.max(before, fresh) : e.keep === "AVERAGE" ? Math.ceil((before + fresh) / 2) : fresh;
    roll.raw = fresh;
    setRollValue(ctx, roll, value, m`${scope.label} (rerolled ${fresh})`);
    // Mercury Retrograde: each player's first reroll has a 1 in 3 chance of costing 1 Sanity
    const roller = ctx.s.players[roll.playerId];
    if (ctx.s.nightRule === "MERCURY_RETROGRADE" && !roller.counters.mercuryReroll) {
      roller.counters.mercuryReroll = 1;
      if (int(ctx.s, 3) === 0) loseSanity(ctx, roller, 1, m`Mercury Retrograde`);
    }
  },
  CONDITIONAL: (ctx, e, scope) => {
    applyEffects(ctx, condition(ctx, e.condition, scope) ? e.then : (e.otherwise ?? []), scope);
  },
  COUNTER: (ctx, e, scope) => {
    const id = scope.self ?? (scope.ownerId === "SYSTEM" ? undefined : scope.ownerId);
    if (!id) return;
    const p = ctx.s.players[id];
    p.counters[e.name] = (p.counters[e.name] ?? 0) + e.increment;
  },
};

/** Named conditions used by CONDITIONAL effects (and skill `requires`). */
export function condition(ctx: Ctx, id: string, scope: Scope): boolean {
  switch (id) {
    case "ANCHOR_UNREPAIRED":
      return Object.values(ctx.s.anchors).some((a) => !a.repaired);
    case "SELF_BELOW_MAX_SANITY": {
      const selfId = scope.self ?? (scope.ownerId === "SYSTEM" ? undefined : scope.ownerId);
      return !!selfId && ctx.s.players[selfId].sanity < MAX_SANITY;
    }
    default:
      return extraConditions(ctx, id, scope);
  }
}

/** Objection's group reroll (round-events.ts registers it). */
let rerollGroup: (ctx: Ctx, label: Msg) => boolean = () => false;
export const setGroupReroll = (fn: typeof rerollGroup) => (rerollGroup = fn);

let extraConditions: (ctx: Ctx, id: string, scope: Scope) => boolean = () => false;
/** The Skill Resolver adds the conditions skills refer to. */
export const setExtraConditions = (fn: typeof extraConditions) => (extraConditions = fn);

export function applyEffects(ctx: Ctx, effects: Effect[], scope: Scope): void {
  for (const e of effects) {
    const handler = H[e.kind] as Handler<typeof e.kind> | undefined;
    if (!handler) throw new Error(`no handler for effect ${e.kind}`);
    handler(ctx, e as never, scope);
  }
}

export const hasHandler = (kind: EffectKind): boolean => kind in H;

/** Lets later modules (inspector, skills) register the handlers they own. */
export function registerHandler<K extends EffectKind>(kind: K, fn: Handler<K>): void {
  (H as Record<string, unknown>)[kind] = fn;
}


/** An anchor reaching its required repairs: it holds, and Collapse eases by 1. */
/**
 * The anchor holds, and its key appears in the hands of whoever made the last
 * repair (or, if an ability finished it, its user; else the first passenger
 * present). Each key is made once per run.
 */
export function restoreAnchor(ctx: Ctx, a: Anchor, by?: PlayerId): void {
  if (a.repaired) return;
  a.repaired = true;
  log(ctx, m`The ${ref.anchor(a.id)} is restored. Reality holds a little tighter.`, "ANCHOR_DONE", a.lastRepairedBy ?? undefined);
  cue(ctx, "ANCHOR_DONE", { anchor: a.id });
  changeCollapse(ctx, -1, m`the ${ref.anchor(a.id)} holding`);
  const key = KEY_FOR_ANCHOR[a.id];
  const made = Object.values(ctx.s.players).some((p) => p.items.includes(key));
  if (made || ctx.s.flags[`key_${key}`]) return;
  const holder = [a.lastRepairedBy, by].map((id) => (id ? ctx.s.players[id] : undefined)).find((p) => p && !p.away) ?? present(ctx)[0] ?? Object.values(ctx.s.players)[0];
  if (!holder) return;
  ctx.s.flags[`key_${key}`] = 1;
  holder.items.push(key);
  log(ctx, m`${holder.nickname} picks up the ${ref.item(key)}. It opens the ${ref.lock(LOCK_FOR_KEY[key])} in act 3.`, "KEY", holder.playerId);
  cue(ctx, "KEY", { playerId: holder.playerId, item: key });
}

export function changeCollapse(ctx: Ctx, delta: number, why: Msg): void {
  if (!delta) return;
  const before = ctx.s.collapse;
  ctx.s.collapse = Math.max(0, Math.min(ctx.s.collapseMax, ctx.s.collapse + delta));
  if (ctx.s.collapse === before) return;
  log(ctx, delta > 0 ? m`Collapse rises to ${ctx.s.collapse} / ${ctx.s.collapseMax} (${why}).` : m`Collapse falls to ${ctx.s.collapse} / ${ctx.s.collapseMax} (${why}).`, delta > 0 ? "COLLAPSE_UP" : "COLLAPSE_DOWN");
  cue(ctx, "COLLAPSE", { from: before, to: ctx.s.collapse });
  rulesFor(ctx.s).collapseChanged?.(ctx, before);
}

/** The value at the next tier boundary in the favourable direction. */
function nextTierValue(value: number, tiers: number): number {
  const steps = [1, 2, 4, 6];
  let tierIndex = ["DISASTER", "FAIL", "SUCCESS", "PERFECT"].indexOf(tierOf(value));
  tierIndex = Math.max(0, Math.min(3, tierIndex + tiers));
  return Math.max(value, steps[tierIndex]);
}


export { statusName };
