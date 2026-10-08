// The Skill Resolver: how any of the 192 abilities is used. A skill is data
// (trigger + target rule + effects); this module burns the use, checks the
// skill's precondition, applies its effects through the shared handlers, and
// decides whose ability a game event wakes. No character has its own code.
//
// Waking works the same way everywhere (docs/skill-mapping-notes.md): the
// holders an event wakes are taken in turn order; a PASSIVE ability fires on
// its own, a REACTION asks its holder (one "Use it on X" option per legal
// target when it needs one). The asked list lives with whatever is waiting:
// a queued trigger, a parked effect, a revealed event, or a roll.
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import type { CharacterId, Skill, TargetRule, TriggerKind } from "../../shared/characters/types.ts";
import { walkEffects } from "../../shared/characters/validate.ts";
import type { PendingEffect, PlayerId, Roll, WindowOption } from "../../shared/game/state.ts";
import { cue, log, newId, type Ctx } from "./context.ts";
import { setRollReactions } from "./dice.ts";
import { applyEffects, hasHandler, setExtraConditions, type Scope } from "./effects.ts";
import { present } from "./players.ts";
import { pick, shuffle } from "./rng.ts";
import { playersWokenBy, triggerMatches, type TriggerEvent } from "./skills.ts";
import { queueTrigger } from "./trigger-queue.ts";
import { onResume, openWindow, setBeforeClose, settleIfAnswered } from "./windows.ts";
import { list, m, ref } from "../../shared/i18n/msg.ts";
import type { Msg } from "../../shared/i18n/types.ts";
import { characterSkill } from "../../shared/game/skills.ts";

/** Every effect in the skill has a handler. */
export function resolvable(skill: Skill): boolean {
  let ok = true;
  walkEffects(skill.effects, (e) => (ok &&= hasHandler(e.kind)));
  return ok;
}

/** Whose ability a player holds right now (a borrowed one counts as the lender's character). */
export const skillCharacter = (ctx: Ctx, id: PlayerId): CharacterId => {
  const p = ctx.s.players[id];
  return p.skill.borrowed ?? p.characterId;
};

export const skillOf = (ctx: Ctx, id: PlayerId): Skill => {
  const p = ctx.s.players[id];
  return characterSkill(p.skill.borrowed ?? p.characterId, ctx.s.scenarioId);
};

const scopeOf = (ownerId: PlayerId, targets: PlayerId[], label: Msg, trigger?: TriggerEvent): Scope => ({
  ownerId,
  targets,
  triggerSource: trigger?.sourceId,
  triggerSubject: trigger?.subjectId,
  trigger,
  label,
});

// ---- preconditions -----------------------------------------------------------

const TAKES = new Set(["LOSE_FATE", "LOSE_SANITY", "TRANSFER_FATE", "STEAL_ITEM"]);
const MOVES = new Set(["TRANSFER_FATE", "STEAL_ITEM", "SWAP_STATE", "BALANCE_FATE"]);
const pendingAbilityHas = (pe: PendingEffect | null, kinds: Set<string>) => {
  if (!pe || pe.kind !== "ABILITY") return false;
  let found = false;
  walkEffects(pe.effects, (e) => (found ||= kinds.has(e.kind)));
  return found;
};

/** Preconditions named by skills' `requires` and by CONDITIONAL effects. */
export function requirement(ctx: Ctx, id: string, scope: Scope): boolean {
  const s = ctx.s;
  const self = scope.self ?? (scope.ownerId === "SYSTEM" ? undefined : scope.ownerId);
  const target = scope.targets[0];
  const subject = scope.triggerSubject;
  const rr = s.roundRecord;
  const alive = present(ctx);
  switch (id) {
    case "SUBJECT_HAS_LOWEST_FATE":
      return !!subject && s.players[subject].fate === Math.min(...alive.map((p) => p.fate));
    case "TARGETS_HAVE_RESOURCE":
      return scope.targets.length > 0 && scope.targets.every((t) => s.players[t].fate >= 1);
    case "OWN_BUFF_EXPIRING":
    case "EXPIRING_STATUS_IS_OWN_BUFF":
      return scope.trigger?.status?.polarity === "POSITIVE";
    case "NOT_TARGETED_THIS_ROUND":
      return !!self && !rr.targeted.includes(self);
    case "TARGET_HELPED_BY_ANOTHER_THIS_ROUND":
      return !!target && rr.helps.some(([helper, helped]) => helped === target && helper !== self);
    case "TARGET_ATTACKED_TWICE_THIS_ROUND":
      return !!target && rr.attacks.filter(([source]) => source === target).length >= 2;
    case "TARGET_HAS_MOST_PLAYER_ATTACKS": {
      const most = Math.max(...alive.map((p) => p.counters.playerAttacks ?? 0));
      return !!target && most > 0 && (s.players[target].counters.playerAttacks ?? 0) === most;
    }
    case "RAW_ROLL_1_OR_6":
      return !!s.roll && (s.roll.raw === 1 || s.roll.raw === 6);
    case "TARGET_ABILITY_BURNED":
      return !!target && s.players[target].skill.usesLeft <= 0;
    case "SOMEONE_SUCCEEDED_THIS_ROUND":
      return rr.lastSuccess !== null;
    case "ABILITY_TARGETS_SELF":
      return !!self && s.pendingEffect?.kind === "ABILITY" && s.pendingEffect.targets.includes(self);
    case "PENDING_ABILITY_MOVES_RESOURCES":
      return pendingAbilityHas(s.pendingEffect, MOVES);
    case "PENDING_ABILITY_TAKES":
      return pendingAbilityHas(s.pendingEffect, TAKES);
    case "REWARD_IS_ITEM":
      return !!scope.trigger?.item;
    case "HAS_OTHER_TEMP_STATUS":
      return !!self && s.players[self].statuses.some((st) => st.ordinary && st.polarity === "POSITIVE");
    default:
      return false;
  }
}
setExtraConditions(requirement);

/** May this owner's ability fire for this event right now (ready, resolvable, precondition holds)? */
function canFire(ctx: Ctx, ownerId: PlayerId, trigger?: TriggerEvent, targets: PlayerId[] = []): boolean {
  const skill = skillOf(ctx, ownerId);
  if (!resolvable(skill)) return false;
  return !skill.requires || requirement(ctx, skill.requires, scopeOf(ownerId, targets, ref.skill(skillCharacter(ctx, ownerId), ctx.s.scenarioId), trigger));
}

/** For USE_SKILL: does an active ability's precondition hold for these targets? */
export const activeRequirementHolds = (ctx: Ctx, ownerId: PlayerId, targets: PlayerId[]): boolean => canFire(ctx, ownerId, undefined, targets);

// ---- using an ability ----------------------------------------------------------

const CHOSEN: TargetRule[] = ["ANY_PLAYER", "OTHER_PLAYER", "SAME_CARRIAGE", "TWO_PLAYERS", "UP_TO_THREE_PLAYERS"];

/** Everything an ability can change, to tell whether it did anything at all. */
const fingerprint = (ctx: Ctx): string => {
  const { log: _log, logSeq: _seq, version: _v, flags: _f, triggerQueue: _q, lastSkill: _l, roundRecord: _r, ...rest } = ctx.s;
  return JSON.stringify(rest);
};

export type UseContext = { trigger?: TriggerEvent };

/** Uses `ownerId`'s ability. Callers have already checked that it may be used. */
export function useSkill(ctx: Ctx, ownerId: PlayerId, chosen: PlayerId[], use: UseContext = {}): void {
  const s = ctx.s;
  const p = s.players[ownerId];
  const character = getCharacterById(p.skill.borrowed ?? p.characterId);
  const skill = characterSkill(character.id, s.scenarioId);
  p.skill.usesLeft--;
  if (p.skill.usesLeft <= 0) p.skill.state = "BURNED";
  p.stats.skillUsedRound = s.round;
  let targets = chosen;
  if (skill.target === "RANDOM_PLAYERS" && !targets.length) {
    targets = shuffle(s, present(ctx).map((x) => x.playerId)).slice(0, skill.count ?? 2);
  }
  if (skill.type === "ACTIVE") {
    s.roundRecord.usedActive.push(ownerId);
    p.statuses = p.statuses.filter((st) => st.kind !== "FORBIDDEN_TARGET"); // Dominate lasts one ability
  }
  for (const t of targets) if (t !== ownerId && !s.roundRecord.targeted.includes(t)) s.roundRecord.targeted.push(t);
  const named = targets.length > 0 && CHOSEN.includes(skill.target);
  log(ctx, named ? m`${p.nickname} uses ${ref.skill(character.id, ctx.s.scenarioId)} on ${list(targets.map((t) => s.players[t].nickname))}.` : m`${p.nickname} uses ${ref.skill(character.id, ctx.s.scenarioId)}.`, "SKILL", ownerId);
  cue(ctx, "SKILL", { playerId: ownerId, characterId: character.id, burned: p.skill.usesLeft <= 0 });
  twinNight(ctx, ownerId);

  // a targeted active ability can be answered before it applies
  const declared: TriggerEvent = { kind: "TARGETED_ABILITY_DECLARED", sourceId: ownerId, subjectId: targets.find((t) => t !== ownerId) };
  if (skill.type === "ACTIVE" && CHOSEN.includes(skill.target) && declared.subjectId && !s.pendingEffect) {
    const pe: PendingEffect = {
      id: newId(ctx, "pe"),
      kind: "ABILITY",
      sourceId: ownerId,
      targetId: declared.subjectId,
      targets,
      label: ref.skill(character.id, ctx.s.scenarioId),
      effects: skill.effects,
      single: false,
      reduced: 0,
      cancelled: false,
      asked: [],
      copyBack: [],
      attack: false,
      theft: false,
    };
    s.pendingEffect = pe;
    if (wokenBy(ctx, [declared], []).length) return; // the flow loop asks, then lands it
    s.pendingEffect = null;
  }
  runEffects(ctx, ownerId, skill, targets, use.trigger, character.id);
}

/** Applies an ability's effects and reports it to the table's other abilities. */
export function runEffects(ctx: Ctx, ownerId: PlayerId, skill: Skill, targets: PlayerId[], trigger?: TriggerEvent, characterId?: CharacterId): void {
  const before = fingerprint(ctx);
  const label = characterId ? ref.skill(characterId, ctx.s.scenarioId) : m`an ability`;
  applyEffects(ctx, skill.effects, scopeOf(ownerId, targets, label, trigger));
  const fizzled = fingerprint(ctx) === before;
  // recorded after it ran, so a copy made in answer still sees the ability before it
  if (characterId) ctx.s.lastSkill = { ownerId, characterId, targets, round: ctx.s.round };
  if (fizzled) log(ctx, m`${label} finds nothing to act on.`, "SKILL", ownerId);
  queueTrigger(ctx, { kind: "SKILL_USED_BY_OTHER", sourceId: ownerId, condition: fizzled ? "FIZZLED" : undefined });
}

function twinNight(ctx: Ctx, ownerId: PlayerId): void {
  const s = ctx.s;
  if (s.nightRule !== "TWIN_NIGHT" || s.flags.twinEcho) return;
  s.flags.twinEcho = 1;
  const others = present(ctx).filter((x) => x.playerId !== ownerId);
  if (!others.length) return;
  const twin = pick(s, others);
  twin.fate += 1;
  log(ctx, m`Twin Night: the first ability of the night echoes. ${twin.nickname} gains 1 Fate.`, "RULE", twin.playerId);
}

// ---- waking holders ------------------------------------------------------------

type Woken = { id: PlayerId; event: TriggerEvent; skill: Skill };

/** Holders these events wake, in turn order, skipping those already asked. */
export function wokenBy(ctx: Ctx, events: TriggerEvent[], asked: PlayerId[]): Woken[] {
  const out: Woken[] = [];
  for (const id of ctx.s.turnOrder) {
    if (asked.includes(id)) continue;
    const p = ctx.s.players[id];
    if (!p || p.away || p.skill.usesLeft <= 0 || p.skill.state !== "READY") continue;
    const skill = skillOf(ctx, id);
    if (skill.type === "ACTIVE") continue;
    const event = events.find((e) => triggerMatches(skill.trigger, id, e));
    if (event && canFire(ctx, id, event)) out.push({ id, event, skill });
  }
  return out;
}

/** "Use it now", or one "Use it on X" per legal target, plus "Save it". */
export function useOptions(ctx: Ctx, ownerId: PlayerId): WindowOption[] {
  const skill = skillOf(ctx, ownerId);
  const me = ctx.s.players[ownerId];
  const pickOne: Partial<Record<TargetRule, (id: PlayerId) => boolean>> = {
    ANY_PLAYER: () => true,
    OTHER_PLAYER: (id) => id !== ownerId,
    SAME_CARRIAGE: (id) => id !== ownerId && ctx.s.players[id].carriageIndex === me.carriageIndex,
  };
  const legal = pickOne[skill.target];
  const use: WindowOption[] = legal
    ? present(ctx)
        .filter((p) => legal(p.playerId))
        .map((p) => ({ id: `USE:${p.playerId}`, label: p.playerId === ownerId ? m`Use it on yourself` : m`Use it on ${p.nickname}` }))
    : [{ id: "USE", label: m`Use it now` }];
  return [...use, { id: "SKIP", label: m`Save it` }];
}

const targetsOf = (answer: string): PlayerId[] => (answer.startsWith("USE:") ? [answer.slice(4)] : []);

/**
 * Asks the next holder these events wake. Passives fire on the spot. Returns
 * true when it did something (fired or opened a window), false once nobody
 * is left to ask.
 */
export function askNext(ctx: Ctx, events: TriggerEvent[], asked: PlayerId[], why: Msg): boolean {
  const next = wokenBy(ctx, events, asked)[0];
  if (!next) return false;
  asked.push(next.id);
  if (next.skill.type === "PASSIVE") {
    log(ctx, m`${ctx.s.players[next.id].nickname}'s ${ref.skill(skillCharacter(ctx, next.id), ctx.s.scenarioId)} takes effect.`, "SKILL", next.id);
    useSkill(ctx, next.id, [], { trigger: next.event });
    return true;
  }
  openWindow(ctx, {
    kind: "REACTION",
    title: ref.skill(skillCharacter(ctx, next.id), ctx.s.scenarioId),
    prompt: m`${why} ${ref.skillDescription(skillCharacter(ctx, next.id), ctx.s.scenarioId)} It's once per run.`,
    addressees: [next.id],
    options: useOptions(ctx, next.id),
    defaultOptionId: "SKIP",
    resume: { kind: "SKILL_ASK", payload: { event: JSON.stringify(next.event) } },
    blocksTable: true,
    ownerId: next.id,
  });
  return true;
}

onResume("SKILL_ASK", (ctx, w, answers) => {
  const owner = w.addressees[0];
  const answer = answers[owner] ?? "SKIP";
  if (answer === "SKIP") return;
  const event = JSON.parse(String(w.resume.payload?.event)) as TriggerEvent;
  if (!canFire(ctx, owner, event)) return log(ctx, m`${ref.skill(skillCharacter(ctx, owner), ctx.s.scenarioId)}'s moment has passed.`, "SKILL", owner);
  useSkill(ctx, owner, targetsOf(answer), { trigger: event });
});

// ---- after-the-fact triggers ---------------------------------------------------

const describe: Partial<Record<TriggerKind, Msg>> = {
  PLAYER_GAINS_FATE: m`Someone just gained Fate.`,
  PLAYER_GAINS_BUFF: m`Someone just gained a buff.`,
  PLAYER_GAINS_REWARDS: m`Someone just gained a reward.`,
  SELF_GAINS_REWARD: m`You just gained a reward.`,
  SKILL_USED_BY_OTHER: m`Someone just used an ability.`,
  HELPED_BY_PLAYER: m`Someone just helped you.`,
  OWN_ROLL_RESOLVED: m`Your roll is in.`,
  ANY_ROLL_RESOLVED: m`A roll is in.`,
};

/** Asks the holders of queued triggers, one at a time. False when the queue is empty. */
export function processTriggers(ctx: Ctx): boolean {
  checkConditions(ctx);
  const q = ctx.s.triggerQueue;
  while (q.length) {
    const head = q[0];
    if (askNext(ctx, [head], head.asked, describe[head.kind] ?? m`Your moment.`)) return true;
    q.shift();
  }
  return false;
}

/** Round-start / round-end abilities fire now, while the round is still the one they look at. */
export function roundTriggers(ctx: Ctx, kind: Extract<TriggerKind, "ROUND_START" | "ROUND_END">): void {
  const asked: PlayerId[] = [];
  for (let guard = 0; guard < 20 && askNext(ctx, [{ kind }], asked, kind === "ROUND_END" ? m`The round is ending.` : m`A new round begins.`); guard++);
}

/** A status about to run out wakes its holder's ability (Can't Let Go, Something to Show). */
export function statusesExpiring(ctx: Ctx): void {
  const s = ctx.s;
  for (const p of present(ctx)) {
    for (const st of p.statuses.filter((x) => x.expiresAtRound !== null && x.expiresAtRound <= s.round)) {
      const asked: PlayerId[] = [];
      for (let guard = 0; guard < 5 && askNext(ctx, [{ kind: "STATUS_EXPIRING", subjectId: p.playerId, status: st }], asked, m`One of your statuses is about to end.`); guard++);
    }
  }
}

// ---- conditions met (PASSIVE, tracked) -----------------------------------------

const bits = (n: number) => n.toString(2).replace(/0/g, "").length;

function conditionMet(ctx: Ctx, id: PlayerId, condition: string): boolean {
  const s = ctx.s;
  const p = s.players[id];
  const c = p.counters;
  switch (condition) {
    case "FIRST_SUCCESS_THIS_ROUND":
      return s.roundRecord.succeeded[0] === id;
    case "NO_NEGATIVE_EFFECT_2_ROUNDS":
      return (c.calmRounds ?? 0) >= 2;
    case "NO_ATTACK_2_ROUNDS":
      return (c.peacefulRounds ?? 0) >= 2;
    case "NO_ACTIVE_ABILITY_2_ROUNDS":
      return (c.restRounds ?? 0) >= 2;
    case "SOLE_GAINER_OF_PUBLIC_EVENT":
      return c.soleGainerRound === s.round;
    case "SUCCEEDED_TWO_ROUNDS_RUNNING":
      return (c.successRoundsRunning ?? 0) >= 2;
    case "THIRD_SUCCESS_THIS_RUN":
      return p.stats.successes >= 3;
    case "TWO_PLAIN_SUCCESSES_IN_A_ROW":
      return (c.plainStreak ?? 0) >= 2;
    case "HELPED_FIRST_ATTACKER":
      return c.helpedFirstAttacker === 1;
    case "THREE_ROLL_KINDS":
      return bits(c.successKinds ?? 0) >= 3;
    case "TWO_CONSECUTIVE_SUCCESSES":
      return (c.successStreak ?? 0) >= 2;
    case "THREE_PLAYERS_SUCCEEDED_THIS_ROUND":
      return s.roundRecord.succeeded.length >= 3;
    case "FIRST_OWN_SUCCESS":
      return p.stats.successes >= 1;
    default:
      return false;
  }
}

/** Queues CONDITION_MET for every passive whose condition now holds. */
function checkConditions(ctx: Ctx): void {
  for (const p of present(ctx)) {
    if (p.skill.usesLeft <= 0 || p.skill.state !== "READY") continue;
    const skill = skillOf(ctx, p.playerId);
    const condition = skill.trigger.on === "CONDITION_MET" ? skill.trigger.condition : undefined;
    if (!condition || ctx.s.triggerQueue.some((t) => t.kind === "CONDITION_MET" && t.subjectId === p.playerId)) continue;
    if (conditionMet(ctx, p.playerId, condition)) queueTrigger(ctx, { kind: "CONDITION_MET", subjectId: p.playerId, condition });
  }
}

// ---- changing your answer before a vote or choice settles ----------------------

setBeforeClose((ctx, w) => {
  if (w.kind !== "VOTE" && w.kind !== "EVENT_CHOICE") return false;
  const asked = ((w.resume.payload ??= {}).revised ??= []) as PlayerId[];
  const holder = w.addressees.find((id) => !asked.includes(id) && wokenBy(ctx, [{ kind: "OWN_CHOICE_MADE", subjectId: id }], []).some((x) => x.id === id));
  if (!holder) return false;
  asked.push(holder);
  const skill = skillOf(ctx, holder);
  const mine = w.answers[holder];
  openWindow(ctx, {
    kind: "REACTION",
    title: ref.skill(skillCharacter(ctx, holder), ctx.s.scenarioId),
    prompt: m`Everyone has answered "${w.title}". ${ref.skillDescription(skillCharacter(ctx, holder), ctx.s.scenarioId)} It's once per run.`,
    addressees: [holder],
    options: [{ id: "KEEP", label: m`Keep my answer` }, ...w.options.filter((o) => o.id !== mine).map((o) => ({ id: o.id, label: m`Change to: ${o.label}` }))],
    defaultOptionId: "KEEP",
    resume: { kind: "REVISE", payload: { under: w.id } },
    blocksTable: true,
    ownerId: holder,
  });
  return true;
});

onResume("REVISE", (ctx, w, answers) => {
  const owner = w.addressees[0];
  const answer = answers[owner];
  const under = ctx.s.pending.find((x) => x.id === w.resume.payload?.under);
  if (!under) return;
  if (answer && answer !== "KEEP") useSkill(ctx, owner, [], { trigger: { kind: "OWN_CHOICE_MADE", subjectId: owner, condition: `${under.id}:${answer}` } });
  settleIfAnswered(ctx, under);
});

// ---- rolls ---------------------------------------------------------------------

setRollReactions({
  woken: (ctx, roll: Roll, asked) => {
    const base = { subjectId: roll.playerId, sourceId: roll.playerId, tier: roll.tier };
    return wokenBy(ctx, [{ kind: "OWN_ROLL_RESOLVED", ...base }, { kind: "ANY_ROLL_RESOLVED", ...base }], asked).map((w) => w.id);
  },
  options: (ctx, ownerId) => useOptions(ctx, ownerId),
  use: (ctx, ownerId, roll, answer) => {
    const base = { subjectId: roll.playerId, sourceId: roll.playerId, tier: roll.tier };
    const kind = skillOf(ctx, ownerId).trigger.on === "OWN_ROLL_RESOLVED" ? "OWN_ROLL_RESOLVED" : "ANY_ROLL_RESOLVED";
    useSkill(ctx, ownerId, targetsOf(answer), { trigger: { kind, ...base } });
  },
  passive: (ctx, ownerId) => skillOf(ctx, ownerId).type === "PASSIVE",
});

export { playersWokenBy };
