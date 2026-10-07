// What a resolved roll does, by purpose and by carriage. Rewards and penalties
// go through the shared effect handlers so shields, immunities and skills see
// them like any other effect.
import { CARRIAGES, ESCAPE_LOCKS, FRAGMENTS, KEY_FOR_LOCK, LOCK_AT, MAX_SANITY } from "../../shared/game/scenario01/content.ts";
import type { Effect } from "../../shared/game/effects.ts";
import type { AnchorId, CarriageIdentity, EscapeLockId, FragmentType, PlayerGameState, Roll, RollContext } from "../../shared/game/state.ts";
import { cue, log, newId, type Ctx } from "./context.ts";
import { isSuccess, onRollOutcome } from "./dice.ts";
import { applyEffects, changeCollapse, grantFragment, grantItem, restoreAnchor, type Scope } from "./effects.ts";
import { addStatus, identityAt, removeStatus, statusOf } from "./players.ts";
import { int, pick } from "./rng.ts";
import { m, ref } from "../../shared/i18n/msg.ts";
import type { Msg } from "../../shared/i18n/types.ts";

const scopeFor = (p: PlayerGameState, label: Msg): Scope => ({ ownerId: "SYSTEM", self: p.playerId, targets: [], label });

/** A roll's reward. Doubled rewards and bets are settled around the whole outcome (dice.ts, finishRoll). */
function reward(ctx: Ctx, p: PlayerGameState, rc: RollContext, effects: Effect[], label: Msg): void {
  applyEffects(ctx, effects, scopeFor(p, label));
}

function penalty(ctx: Ctx, p: PlayerGameState, rc: RollContext, effects: Effect[], label: Msg): void {
  const times = rc.stakes?.penaltyMult ?? 1;
  if (rc.stakes?.noPenalty) return log(ctx, m`${p.nickname} walks away from the failure untouched.`, "DEFENCE", p.playerId);
  if (statusOf(p, "SAFETY_ROPE")) {
    removeStatus(p, "SAFETY_ROPE");
    log(ctx, m`${p.nickname}'s safety rope holds: the failure costs nothing.`, "DEFENCE", p.playerId);
    return;
  }
  for (let i = 0; i < times; i++) applyEffects(ctx, effects, scopeFor(p, label));
}

const HIDDEN_INFO: CarriageIdentity[] = ["MIRROR", "SLEEPER", "ARCHIVE"];

onRollOutcome("INVESTIGATE", (ctx, p, roll, rc) => {
  const identity = identityAt(ctx, rc.carriageIndex);
  const info = CARRIAGES[identity];
  if (HIDDEN_INFO.includes(identity)) p.stats.hiddenInvestigations++;
  if (roll.tier === "DISASTER") {
    penalty(ctx, p, rc, [{ kind: "LOSE_SANITY", who: "SELF", amount: 1 }], m`something looked back`);
    if (identity === "MIRROR") applyEffects(ctx, [{ kind: "SPAWN_ENTITY", entity: "SHADOW", where: "SUBJECT_CARRIAGE" }], scopeFor(p, m`the mirror`));
    // exploring risks the explorer, not the train: only key tasks (repairs, confrontations) raise Collapse
    return;
  }
  if (!isSuccess(roll.tier)) return log(ctx, m`${p.nickname} finds nothing but their own reflection.`, "INFO", p.playerId);

  let found = false;
  const times = rc.stakes?.rewardMult ?? 1;
  if (info.fragment && !ctx.s.fragments.includes(info.fragment)) found = grantFragment(ctx, info.fragment, p.playerId);
  if (roll.tier === "PERFECT" && identity !== "START" && identity !== "CAB" && !ctx.s.flags[`core_${identity}`]) {
    ctx.s.flags[`core_${identity}`] = 1;
    applyEffects(ctx, [{ kind: "GRANT_CORE_MEMORY", amount: 1 }], scopeFor(p, m`a core memory in the ${ref.carriage(identity)}`));
    found = true;
  }
  if (identity === "SLEEPER") dreamCard(ctx, p);
  if (!found) {
    for (let i = 0; i < times; i++) applyEffects(ctx, [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }], scopeFor(p, m`a useful clue`));
  }
});

/** A private dream: true information about the train (the system never lies). */
export function dreamCard(ctx: Ctx, p: PlayerGameState): void {
  const secrets = ctx.s.secrets[p.playerId];
  const unfound = ctx.s.carriages.filter((c) => c.identity !== "START" && c.identity !== "CAB" && !ctx.s.flags[`core_${c.identity}`]);
  const text = unfound.length
    ? m`A core memory still sleeps in the ${ref.carriage(pick(ctx.s, unfound).identity)}.`
    : m`Every core memory has woken. The train is running out of things to hide.`;
  secrets.dreamCards.push({ id: newId(ctx, "dream"), text });
  log(ctx, m`${p.nickname} draws a dream card and keeps it to themselves.`, "SECRET", p.playerId);
  cue(ctx, "SECRET", { playerId: p.playerId });
  if (ctx.s.nightRule === "NAMELESS_NIGHT") p.fate += 1;
}

onRollOutcome("SEARCH", (ctx, p, roll, rc) => {
  const identity = identityAt(ctx, rc.carriageIndex);
  const scope = (label: Msg) => scopeFor(p, label);
  if (roll.tier === "DISASTER") {
    penalty(ctx, p, rc, [{ kind: "LOSE_SANITY", who: "SELF", amount: 1 }], identity === "DINING" ? m`a dish that tasted of nothing` : m`something in the dark bit back`);
    return;
  }
  if (!isSuccess(roll.tier)) return log(ctx, m`${p.nickname} comes up empty-handed.`, "INFO", p.playerId);
  const perfect = roll.tier === "PERFECT";
  switch (identity) {
    case "LUGGAGE":
      grantItem(ctx, p.playerId, "ANY", m`an unclaimed bag`);
      if (perfect) grantItem(ctx, p.playerId, "ANY", m`a second bag`);
      break;
    case "DINING":
      reward(ctx, p, rc, p.sanity < 3 ? [{ kind: "GAIN_SANITY", who: "SELF", amount: 1 }] : [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }], m`a warm meal`);
      if (perfect) applyEffects(ctx, [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }], scope(m`dessert`));
      return;
    case "ENGINE_ROOM":
      p.items.push("SPARE_BATTERY");
      log(ctx, m`${p.nickname} pockets a spare battery.`, "ITEM", p.playerId);
      cue(ctx, "ITEM", { playerId: p.playerId, item: "SPARE_BATTERY" });
      if (perfect) applyEffects(ctx, [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }], scope(m`spare parts`));
      break;
    default:
      if (perfect || int(ctx.s, 3) === 0) grantItem(ctx, p.playerId, "ANY", m`something left behind`);
      else return reward(ctx, p, rc, [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }], m`loose change of fate`);
  }
});

/** Which anchor or escape lock a repair in this carriage works on, if any. */
export function repairTarget(ctx: Ctx, carriageIndex: number): { kind: "ANCHOR"; anchor: AnchorId } | { kind: "LOCK"; lock: EscapeLockId } | null {
  const identity = identityAt(ctx, carriageIndex);
  if (ctx.s.act === 1) return null;
  const anchorHere: Partial<Record<CarriageIdentity, AnchorId>> = { ENGINE_ROOM: "POWER", ARCHIVE: "IDENTITY", SLEEPER: "MEMORY", MIRROR: "MEMORY" };
  const anchor = anchorHere[identity];
  if (anchor && !ctx.s.anchors[anchor].repaired) return { kind: "ANCHOR", anchor };
  if (ctx.s.act === 3) {
    const lock = ESCAPE_LOCKS.find((l) => LOCK_AT[l] === identity);
    if (lock) return { kind: "LOCK", lock };
  }
  return null;
}

onRollOutcome("REPAIR", (ctx, p, roll, rc) => {
  if (roll.tier === "DISASTER") {
    penalty(ctx, p, rc, [{ kind: "LOSE_SANITY", who: "SELF", amount: 1 }], m`a jolt from the machinery`);
    changeCollapse(ctx, 1, m`a botched repair`);
    return;
  }
  if (!isSuccess(roll.tier)) return log(ctx, m`${p.nickname}'s repair doesn't hold.`, "INFO", p.playerId);
  const target = repairTarget(ctx, rc.carriageIndex);
  if (!target) return;
  const unaided = !roll.modifiers.some((m) => m.source.k === "Help");
  p.stats.repairs++;
  if (target.kind === "ANCHOR") {
    const a = ctx.s.anchors[target.anchor];
    const gain = (roll.tier === "PERFECT" ? 2 : 1) * (rc.stakes?.rewardMult ?? 1);
    a.progress = Math.min(a.required, a.progress + gain);
    a.lastRepairedBy = p.playerId;
    log(ctx, m`${p.nickname} works on the ${ref.anchor(a.id)}: ${a.progress}/${a.required}.`, "ANCHOR", p.playerId);
    cue(ctx, "ANCHOR", { anchor: a.id, progress: a.progress, required: a.required });
    if (a.progress >= a.required && !a.repaired) {
      if (unaided) p.stats.soloKeyTasks++;
      restoreAnchor(ctx, a);
    }
  } else {
    // the key is checked when the action is declared and again here: a trade
    // can't happen mid-roll, but a key must never open a lock it isn't on
    if (!p.items.includes(KEY_FOR_LOCK[target.lock])) return log(ctx, m`${p.nickname} has no ${ref.item(KEY_FOR_LOCK[target.lock])}: the ${ref.lock(target.lock)} won't turn.`, "LOCK", p.playerId);
    const esc = ctx.s.escape;
    if (esc.round !== ctx.s.round) {
      esc.round = ctx.s.round;
      esc.power = esc.identity = esc.memory = false;
      esc.by = {};
    }
    esc[target.lock] = true;
    esc.by[target.lock] = p.playerId;
    if (unaided) p.stats.soloKeyTasks++;
    if (ctx.s.round >= 10) p.stats.finalTaskRound = ctx.s.round;
    log(ctx, m`${p.nickname} engages the ${ref.lock(target.lock)}. (${ESCAPE_LOCKS.filter((l) => esc[l]).length}/3 this round)`, "LOCK", p.playerId);
    cue(ctx, "LOCK", { lock: target.lock });
  }
});

export const anchorName = (id: AnchorId): string => ({ POWER: "Power Anchor", IDENTITY: "Identity Anchor", MEMORY: "Memory Anchor" })[id];

onRollOutcome("CONFRONT", (ctx, p, roll, rc) => {
  p.stats.confronts++;
  if (roll.tier === "DISASTER") {
    penalty(ctx, p, rc, [{ kind: "LOSE_SANITY", who: "SELF", amount: 1 }], m`it struck back`);
    changeCollapse(ctx, 1, m`a disastrous confrontation`);
    return;
  }
  if (!isSuccess(roll.tier)) return log(ctx, m`${p.nickname}'s confrontation goes nowhere.`, "INFO", p.playerId);
  const hits = (roll.tier === "PERFECT" ? 2 : 1) * (rc.stakes?.rewardMult ?? 1);
  if (rc.target === "INSPECTOR") {
    const insp = ctx.s.inspector;
    insp.distortion += hits;
    log(ctx, m`${p.nickname} unsettles the Faceless Inspector: distortion ${Math.min(3, insp.distortion)}/3.`, "INSPECTOR", p.playerId);
    cue(ctx, "DISTORTION", { distortion: insp.distortion });
    if (insp.distortion >= 3) {
      insp.distortion = 0;
      insp.banishedUntilRound = ctx.s.round + 1;
      insp.targetId = null;
      log(ctx, m`The Inspector's face flickers out. It is gone, for now.`, "INSPECTOR_GONE");
      cue(ctx, "INSPECTOR_BANISHED", {});
      if (ctx.s.nightRule === "RED_EYE") applyEffects(ctx, [{ kind: "GAIN_FATE", who: "ALL", amount: 1 }], scopeFor(p, m`the red-eye bounty`));
    }
    return;
  }
  const ent = ctx.s.entities.find((e) => e.id === rc.target);
  if (!ent) return;
  ent.hp -= hits;
  if (ent.hp <= 0) {
    ctx.s.entities = ctx.s.entities.filter((e) => e.id !== ent.id);
    log(ctx, ent.kind === "SHADOW" ? m`${p.nickname} dispels the shadow passenger.` : m`${p.nickname} dispels the echo.`, "ENTITY_GONE", p.playerId);
    cue(ctx, "ENTITY_GONE", { id: ent.id });
    reward(ctx, p, rc, [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }], m`dispelling it`);
  } else {
    log(ctx, ent.kind === "SHADOW" ? m`${p.nickname} drives the shadow passenger back (${ent.hp} left).` : m`${p.nickname} drives the echo back (${ent.hp} left).`, "ENTITY", p.playerId);
  }
});

onRollOutcome("TICKET_CHECK", (ctx, p, roll, rc) => {
  if (roll.tier === "PERFECT") {
    addStatus(ctx, p, { kind: "TEMP_PASS", polarity: "POSITIVE", sourceId: "SYSTEM", expiresAtRound: null, hidden: false, ordinary: false });
    return log(ctx, m`${p.nickname}'s ticket is stamped. They earn a temporary pass.`, "TICKET", p.playerId);
  }
  if (roll.tier === "SUCCESS") return log(ctx, m`${p.nickname}'s ticket is in order.`, "TICKET", p.playerId);
  // the final result (after Fate, abilities and reactions) is 1–3: Sanity drops to 0 and they are lost
  log(ctx, m`"This ticket is not valid." The Inspector writes something down about ${p.nickname}.`, "TICKET_FAIL", p.playerId);
  penalty(ctx, p, rc, [{ kind: "LOSE_SANITY", who: "SELF", amount: MAX_SANITY }], m`a failed ticket check`);
});

export const fragmentName = (f: FragmentType) => FRAGMENTS[f].name;
