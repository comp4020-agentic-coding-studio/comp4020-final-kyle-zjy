// The 1D6 pipeline every roll goes through:
//   raw d6 (server RNG) → help / item / status modifiers → Fate window
//   (spend 0–2, +1 each) → reaction windows (abilities that answer a roll)
//   → final result and tier → the outcome for the roll's purpose.
// Each step is recorded on GameState.roll so the client can show
// raw → Fate → final.
import type { RollTier } from "../../shared/characters/types.ts";
import { MAX_FATE_PER_ROLL } from "../../shared/game/scenario01/content.ts";
import type { ItemId, PlayerGameState, PlayerId, Roll, RollContext, RollPurpose, WindowOption } from "../../shared/game/state.ts";
import { cue, log, newId, type Ctx } from "./context.ts";
import { d6 } from "./rng.ts";
import { measureRewards } from "./rewards.ts";
import { consumeStatus, gainFate, hasStatus, payBonds, removeStatus, spendFate, statusOf, useUpStatus } from "./players.ts";
import { applyEffects } from "./effects.ts";
import { onResume, openWindow } from "./windows.ts";
import { m, ref } from "../../shared/i18n/msg.ts";
import type { Msg } from "../../shared/i18n/types.ts";

export const tierOf = (n: number): RollTier => (n <= 1 ? "DISASTER" : n <= 3 ? "FAIL" : n <= 5 ? "SUCCESS" : "PERFECT");
export const TIER_LABEL: Record<RollTier, Msg> = { DISASTER: m`Disaster`, FAIL: m`Failure`, SUCCESS: m`Success`, PERFECT: m`Perfect` };
export const isSuccess = (t: RollTier) => t === "SUCCESS" || t === "PERFECT";
export const clampDie = (n: number) => Math.max(1, Math.min(6, n));

/** Is a rule change (Rewrite the Rules, System Update) in force this round? */
export const ruleOn = (ctx: Ctx, rule: string) => ctx.s.ruleMods.some((m) => m.rule === rule && m.untilRound >= ctx.s.round);
const fateLimit = (ctx: Ctx) => MAX_FATE_PER_ROLL + (ruleOn(ctx, "FATE_LIMIT") ? 1 : 0);

/** Roll outcomes by purpose, registered by the modules that own them. */
type Outcome = (ctx: Ctx, p: PlayerGameState, roll: Roll, rc: RollContext) => void;
const OUTCOMES = new Map<RollPurpose, Outcome>();
export const onRollOutcome = (purpose: RollPurpose, fn: Outcome) => OUTCOMES.set(purpose, fn);

/** Reaction abilities that may answer a resolved roll (owned by the Skill Resolver). */
type ReactionHooks = {
  woken: (ctx: Ctx, roll: Roll, asked: PlayerId[]) => PlayerId[];
  options: (ctx: Ctx, ownerId: PlayerId) => WindowOption[];
  use: (ctx: Ctx, ownerId: PlayerId, roll: Roll, answer: string) => void;
  passive: (ctx: Ctx, ownerId: PlayerId) => boolean;
};
let reactions: ReactionHooks = { woken: () => [], options: () => [], use: () => {}, passive: () => false };
export const setRollReactions = (hooks: ReactionHooks) => (reactions = hooks);

const BONUS_STATUS: Partial<Record<RollPurpose, string>> = { INVESTIGATE: "INVESTIGATE_BONUS", REPAIR: "REPAIR_BONUS" };

export type RollOptions = {
  /** Fate, help and reactions apply (false for group/event auto-rolls). */
  modifiable?: boolean;
  /** Extra flat modifiers from the caller. */
  extra?: { source: Msg; delta: number }[];
};

export function startRoll(ctx: Ctx, p: PlayerGameState, purpose: RollPurpose, label: Msg, rc: RollContext, opts: RollOptions = {}): Roll {
  const modifiable = opts.modifiable ?? true;
  // a previewed die was fixed in advance (Time Cache, Optimal Route)
  let raw = p.nextRaw ?? d6(ctx.s);
  p.nextRaw = null;
  if (modifiable && hasStatus(p, "ADVANTAGE")) {
    useUpStatus(ctx, p, "ADVANTAGE");
    const second = d6(ctx.s);
    log(ctx, m`${p.nickname} rolls twice (${raw} and ${second}) and keeps the better.`, "ROLL", p.playerId);
    raw = Math.max(raw, second);
  }
  const modifiers: Roll["modifiers"] = [...(opts.extra ?? [])];
  if (modifiable && p.helpBonus > 0) {
    modifiers.push({ source: m`Help`, delta: p.helpBonus });
    p.helpBonus = 0;
    p.helpFrom = [];
  }
  const bonusKind = BONUS_STATUS[purpose];
  if (modifiable && bonusKind && hasStatus(p, bonusKind)) {
    modifiers.push({ source: ref.item(purpose === "REPAIR" ? "OLD_KEY" : "FLASHLIGHT"), delta: consumeStatus(ctx, p, bonusKind) });
  }
  if (modifiable && ruleOn(ctx, "ROLL_BONUS")) modifiers.push({ source: m`Rewritten rules`, delta: 1 });
  const staticStatus = statusOf(p, "STATIC");
  if (staticStatus) modifiers.push({ source: ref.status("STATIC"), delta: staticStatus.value ?? -1 });
  const total = raw + modifiers.reduce((sum, m) => sum + m.delta, 0);
  const final = clampDie(total);
  const roll: Roll = {
    id: newId(ctx, "r"),
    playerId: p.playerId,
    purpose,
    label,
    raw,
    modifiers,
    fateSpent: 0,
    final,
    tier: tierOf(final),
    modifiable,
    done: false,
  };
  ctx.s.roll = roll;
  ctx.s.rollContext = { ...rc, asked: [], stakes: modifiable ? armedStakes(ctx, p) : rc.stakes };
  cue(ctx, "ROLL", { rollId: roll.id, playerId: p.playerId, raw, final, purpose });
  offerFate(ctx, p, roll);
  return roll;
}

/** Bets and doubled stakes armed on the roller apply to this roll and are used up. */
function armedStakes(ctx: Ctx, p: PlayerGameState): RollContext["stakes"] {
  const allIn = removeStatus(p, "ALL_IN");
  const doubled = removeStatus(p, "DOUBLE_NEXT_ROLL");
  const wager = p.wager;
  p.wager = null;
  if (wager) removeStatus(p, "WAGER");
  if (!allIn && !doubled && !wager) return undefined;
  if (allIn || doubled) log(ctx, allIn ? m`${p.nickname}'s roll counts double, for better or worse.` : m`${p.nickname}'s roll counts double.`, "ROLL", p.playerId);
  return { rewardMult: allIn || doubled ? 2 : 1, penaltyMult: allIn ? 2 : 1, onSuccess: wager?.onSuccess, onFail: wager?.onFail };
}

function offerFate(ctx: Ctx, p: PlayerGameState, roll: Roll): void {
  const room = Math.min(fateLimit(ctx), p.fate, 6 - roll.final);
  const stored = p.storedResult !== null && p.storedResult !== roll.final;
  if (!roll.modifiable || (room <= 0 && !stored) || p.away) return reactionStage(ctx);
  const options: WindowOption[] = Array.from({ length: Math.max(0, room) + 1 }, (_, n) => ({
    id: String(n),
    label: n === 0 ? m`Keep it` : m`Spend ${n} Fate`,
    detail: n ? m`${roll.final} → ${roll.final + n} (${TIER_LABEL[tierOf(roll.final + n)]})` : m`${roll.final} (${TIER_LABEL[roll.tier]})`,
  }));
  if (stored) options.push({ id: "STORED", label: m`Use your recorded ${p.storedResult!}`, detail: m`${roll.final} → ${p.storedResult!} (${TIER_LABEL[tierOf(p.storedResult!)]}), once` });
  openWindow(ctx, {
    kind: "FATE_SPEND",
    title: m`Bend fate?`,
    prompt: roll.final !== roll.raw
      ? m`You rolled ${roll.raw}, ${roll.final} after modifiers. Each Fate adds +1 (at most ${fateLimit(ctx)}).`
      : m`You rolled ${roll.raw}. Each Fate adds +1 (at most ${fateLimit(ctx)}).`,
    addressees: [p.playerId],
    options,
    defaultOptionId: "0",
    resume: { kind: "ROLL_FATE" },
    blocksTable: true,
    ownerId: p.playerId,
  });
}

onResume("ROLL_FATE", (ctx, w, answers) => {
  const roll = ctx.s.roll;
  if (!roll || roll.done) return;
  const p = ctx.s.players[roll.playerId];
  if (answers[roll.playerId] === "STORED" && p.storedResult !== null) {
    setRollValue(ctx, roll, p.storedResult, m`${p.nickname} uses a recorded result`);
    p.storedResult = null;
    return reactionStage(ctx);
  }
  const n = Math.max(0, Math.min(Number(answers[roll.playerId] ?? 0), fateLimit(ctx), p.fate));
  if (n > 0) {
    spendFate(ctx, p, n);
    p.stats.fateSpentOnDice += n;
    roll.fateSpent += n;
    roll.final = clampDie(roll.final + n);
    roll.tier = tierOf(roll.final);
    log(ctx, m`${p.nickname} spends ${n} Fate: ${roll.final - n} → ${roll.final}.`, "FATE", p.playerId);
    cue(ctx, "FATE_SPEND", { playerId: p.playerId, amount: n, final: roll.final });
  }
  void w;
  reactionStage(ctx);
});

/** Asks each ability holder woken by this roll, one at a time. */
export function reactionStage(ctx: Ctx): void {
  const roll = ctx.s.roll;
  const rc = ctx.s.rollContext;
  if (!roll || !rc || roll.done) return;
  const asked = (rc.asked ??= []);
  const woken = roll.modifiable ? reactions.woken(ctx, roll, asked) : [];
  const next = woken[0];
  if (!next) return finishRoll(ctx);
  asked.push(next);
  const owner = ctx.s.players[next];
  if (reactions.passive(ctx, next)) {
    reactions.use(ctx, next, roll, "USE");
    if (ctx.s.pending.length === 0) reactionStage(ctx);
    return;
  }
  openWindow(ctx, {
    kind: "REACTION",
    title: m`Your ability can answer this`,
    prompt: m`${ctx.s.players[roll.playerId].nickname} rolled ${roll.final} (${TIER_LABEL[roll.tier]}). Use your ability now? It's once per run.`,
    addressees: [next],
    options: reactions.options(ctx, next),
    defaultOptionId: "SKIP",
    resume: { kind: "ROLL_REACTION" },
    blocksTable: true,
    ownerId: owner.playerId,
  });
}

onResume("ROLL_REACTION", (ctx, w, answers) => {
  const roll = ctx.s.roll;
  const ownerId = w.addressees[0];
  const answer = answers[ownerId] ?? "SKIP";
  if (roll && !roll.done && answer !== "SKIP") reactions.use(ctx, ownerId, roll, answer);
  // a reaction may itself have opened a window (e.g. a reroll's Fate window)
  if (ctx.s.pending.length === 0) reactionStage(ctx);
});

/** Applies a new value to the roll in progress (rerolls, tier shifts). */
export function setRollValue(ctx: Ctx, roll: Roll, value: number, why: Msg): void {
  const before = roll.final;
  roll.final = clampDie(value);
  roll.tier = tierOf(roll.final);
  log(ctx, m`${why}: ${before} → ${roll.final} (${TIER_LABEL[roll.tier]}).`, "ROLL", roll.playerId);
  cue(ctx, "ROLL_CHANGED", { rollId: roll.id, final: roll.final });
}

export function finishRoll(ctx: Ctx): void {
  const roll = ctx.s.roll;
  const rc = ctx.s.rollContext;
  if (!roll || !rc || roll.done) return;
  roll.done = true;
  roll.tier = tierOf(roll.final);
  const p = ctx.s.players[roll.playerId];
  if (roll.tier === "PERFECT") p.stats.perfects++;
  if (isSuccess(roll.tier)) p.stats.successes++;
  else p.stats.failures++;
  log(ctx, m`${p.nickname}'s ${roll.label}: ${roll.final}, ${TIER_LABEL[roll.tier]}.`, `ROLL_${roll.tier}`, p.playerId);
  if (roll.modifiable) recordRoll(ctx, p, roll);
  cue(ctx, "ROLL_DONE", { rollId: roll.id, playerId: p.playerId, final: roll.final, tier: roll.tier });
  ctx.s.rollContext = null;
  if (roll.tier === "PERFECT" && ctx.s.nightRule === "FULL_MOON" && roll.modifiable) {
    p.fate += 1;
    log(ctx, m`The full moon favours ${p.nickname}: +1 Fate.`, "FATE", p.playerId);
  }
  // whatever the outcome gives its roller counts as a reward
  const [gain] = measureRewards(ctx, [p.playerId], roll.label, () => OUTCOMES.get(rc.kind)?.(ctx, p, roll, rc));
  settleStakes(ctx, p, roll, rc, gain);
}

/**
 * A forced roll with no windows that still counts as `purpose` where the
 * player stands (Forced Advance, Parallel Tasks): its outcome and rewards apply.
 */
export function resolveAs(ctx: Ctx, p: PlayerGameState, purpose: RollPurpose, value: number, label: Msg): void {
  const final = clampDie(value);
  const roll: Roll = { id: newId(ctx, "r"), playerId: p.playerId, purpose, label, raw: final, modifiers: [], fateSpent: 0, final, tier: tierOf(final), modifiable: false, done: true };
  log(ctx, m`${p.nickname}'s ${label}: ${final}, ${TIER_LABEL[roll.tier]}.`, `ROLL_${roll.tier}`, p.playerId);
  cue(ctx, "QUICK_ROLL", { playerId: p.playerId, value: final, tier: roll.tier });
  measureRewards(ctx, [p.playerId], label, () => OUTCOMES.get(purpose)?.(ctx, p, roll, { kind: purpose, carriageIndex: p.carriageIndex }));
}

/** A roll with no windows at all (group event rolls). Returns the tier. */
export function quickRoll(ctx: Ctx, p: PlayerGameState): { value: number; tier: RollTier } {
  const st = statusOf(p, "STATIC");
  const value = clampDie(d6(ctx.s) + (st?.value ?? 0));
  return { value, tier: tierOf(value) };
}

const KIND_BIT: Partial<Record<RollPurpose, number>> = { INVESTIGATE: 1, SEARCH: 2, REPAIR: 4, CONFRONT: 8 };

/** What a finished ordinary roll means for round records, streaks and bonds. */
function recordRoll(ctx: Ctx, p: PlayerGameState, roll: Roll): void {
  const s = ctx.s;
  const rr = s.roundRecord;
  const c = p.counters;
  rr.bestRoll = Math.max(rr.bestRoll, roll.final);
  if (!isSuccess(roll.tier)) {
    c.successStreak = 0;
    c.plainStreak = 0;
    return;
  }
  if (!rr.succeeded.includes(p.playerId)) rr.succeeded.push(p.playerId);
  rr.lastSuccess = p.playerId;
  c.successStreak = (c.successStreak ?? 0) + 1;
  c.plainStreak = roll.tier === "SUCCESS" ? (c.plainStreak ?? 0) + 1 : 0;
  c.successKinds = (c.successKinds ?? 0) | (KIND_BIT[roll.purpose] ?? 0);
  if (c.lastSuccessRound !== s.round) c.successRoundsRunning = c.lastSuccessRound === s.round - 1 ? (c.successRoundsRunning ?? 0) + 1 : 1;
  c.lastSuccessRound = s.round;
  payBonds(ctx, p.playerId, "onFirstSuccess");
}

/** Doubled rewards repeat what the outcome gave; a bet pays or costs on top. */
function settleStakes(ctx: Ctx, p: PlayerGameState, roll: Roll, rc: RollContext, gain?: { fate: number; item?: ItemId }): void {
  const st = rc.stakes;
  if (!st) return;
  const scope = { ownerId: "SYSTEM" as const, self: p.playerId, targets: [], label: roll.label };
  if (isSuccess(roll.tier)) {
    if (st.rewardMult > 1 && gain) {
      if (gain.fate) gainFate(ctx, p, gain.fate * (st.rewardMult - 1), m`a doubled reward`);
      if (gain.item) p.items.push(gain.item);
    }
    if (st.onSuccess) applyEffects(ctx, st.onSuccess, scope);
  } else if (st.onFail && !st.noPenalty) {
    applyEffects(ctx, st.onFail, scope);
  }
}
