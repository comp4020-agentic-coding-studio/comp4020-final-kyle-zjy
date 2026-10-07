// What a resolved roll does, by purpose and by carriage. Rewards and penalties
// go through the shared effect handlers so shields, immunities and skills see
// them like any other effect.
import { CARRIAGES, FRAGMENTS } from "../../shared/game/scenario01/content.ts";
import type { Effect } from "../../shared/game/effects.ts";
import type { AnchorId, CarriageIdentity, FragmentType, PlayerGameState, Roll, RollContext } from "../../shared/game/state.ts";
import { cue, log, newId, type Ctx } from "./context.ts";
import { isSuccess, onRollOutcome } from "./dice.ts";
import { applyEffects, changeCollapse, grantFragment, grantItem, restoreAnchor, type Scope } from "./effects.ts";
import { addStatus, identityAt, removeStatus, statusOf } from "./players.ts";
import { int, pick } from "./rng.ts";

const scopeFor = (p: PlayerGameState, label: string): Scope => ({ ownerId: "SYSTEM", self: p.playerId, targets: [], label });

/** A roll's reward. Doubled rewards and bets are settled around the whole outcome (dice.ts, finishRoll). */
function reward(ctx: Ctx, p: PlayerGameState, rc: RollContext, effects: Effect[], label: string): void {
  applyEffects(ctx, effects, scopeFor(p, label));
}

function penalty(ctx: Ctx, p: PlayerGameState, rc: RollContext, effects: Effect[], label: string): void {
  const times = rc.stakes?.penaltyMult ?? 1;
  if (rc.stakes?.noPenalty) return log(ctx, `${p.nickname} walks away from the failure untouched.`, "DEFENCE", p.playerId);
  if (statusOf(p, "SAFETY_ROPE")) {
    removeStatus(p, "SAFETY_ROPE");
    log(ctx, `${p.nickname}'s safety rope holds: the failure costs nothing.`, "DEFENCE", p.playerId);
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
    penalty(ctx, p, rc, [{ kind: "LOSE_SANITY", who: "SELF", amount: 1 }], "something looked back");
    if (identity === "MIRROR") applyEffects(ctx, [{ kind: "SPAWN_ENTITY", entity: "SHADOW", where: "SUBJECT_CARRIAGE" }], scopeFor(p, "the mirror"));
    // exploring risks the explorer, not the train: only key tasks (repairs, confrontations) raise Collapse
    return;
  }
  if (!isSuccess(roll.tier)) return log(ctx, `${p.nickname} finds nothing but their own reflection.`, "INFO", p.playerId);

  let found = false;
  const times = rc.stakes?.rewardMult ?? 1;
  if (info.fragment && !ctx.s.fragments.includes(info.fragment)) found = grantFragment(ctx, info.fragment, p.playerId);
  if (roll.tier === "PERFECT" && identity !== "START" && identity !== "CAB" && !ctx.s.flags[`core_${identity}`]) {
    ctx.s.flags[`core_${identity}`] = 1;
    applyEffects(ctx, [{ kind: "GRANT_CORE_MEMORY", amount: 1 }], scopeFor(p, `a core memory in the ${info.name}`));
    found = true;
  }
  if (identity === "SLEEPER") dreamCard(ctx, p);
  if (!found) {
    for (let i = 0; i < times; i++) applyEffects(ctx, [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }], scopeFor(p, "a useful clue"));
  }
});

/** A private dream: true or false information about the train. */
export function dreamCard(ctx: Ctx, p: PlayerGameState): void {
  const secrets = ctx.s.secrets[p.playerId];
  const middle = ctx.s.carriages.filter((c) => c.identity !== "START" && c.identity !== "CAB");
  const unfound = middle.filter((c) => !ctx.s.flags[`core_${c.identity}`]);
  const truthful = int(ctx.s, 3) > 0; // two in three dreams tell the truth
  let text: string;
  if (truthful && unfound.length) {
    text = `A core memory still sleeps in the ${CARRIAGES[pick(ctx.s, unfound).identity].name}.`;
  } else {
    // a lie names a carriage whose memory is already awake, or claims they all are
    const found = middle.filter((c) => ctx.s.flags[`core_${c.identity}`]);
    text = !truthful && found.length ? `A core memory still sleeps in the ${CARRIAGES[pick(ctx.s, found).identity].name}.` : "Every core memory has woken. The train is running out of things to hide.";
  }
  secrets.dreamCards.push({ id: newId(ctx, "dream"), text, isTrue: truthful });
  log(ctx, `${p.nickname} draws a dream card and keeps it to themselves.`, "SECRET", p.playerId);
  cue(ctx, "SECRET", { playerId: p.playerId });
  if (ctx.s.nightRule === "NAMELESS_NIGHT") p.fate += 1;
}

onRollOutcome("SEARCH", (ctx, p, roll, rc) => {
  const identity = identityAt(ctx, rc.carriageIndex);
  const scope = (label: string) => scopeFor(p, label);
  if (roll.tier === "DISASTER") {
    penalty(ctx, p, rc, [{ kind: "LOSE_SANITY", who: "SELF", amount: 1 }], identity === "DINING" ? "a dish that tasted of nothing" : "something in the dark bit back");
    return;
  }
  if (!isSuccess(roll.tier)) return log(ctx, `${p.nickname} comes up empty-handed.`, "INFO", p.playerId);
  const perfect = roll.tier === "PERFECT";
  switch (identity) {
    case "LUGGAGE":
      grantItem(ctx, p.playerId, "ANY", "an unclaimed bag");
      if (perfect) grantItem(ctx, p.playerId, "ANY", "a second bag");
      break;
    case "DINING":
      reward(ctx, p, rc, p.sanity < 3 ? [{ kind: "GAIN_SANITY", who: "SELF", amount: 1 }] : [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }], "a warm meal");
      if (perfect) applyEffects(ctx, [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }], scope("dessert"));
      return;
    case "ENGINE_ROOM":
      p.items.push("SPARE_BATTERY");
      log(ctx, `${p.nickname} pockets a spare battery.`, "ITEM", p.playerId);
      cue(ctx, "ITEM", { playerId: p.playerId, item: "SPARE_BATTERY" });
      if (perfect) applyEffects(ctx, [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }], scope("spare parts"));
      break;
    default:
      if (perfect || int(ctx.s, 3) === 0) grantItem(ctx, p.playerId, "ANY", "something left behind");
      else return reward(ctx, p, rc, [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }], "loose change of fate");
  }
});

/** Which anchor or escape lock a repair in this carriage works on, if any. */
export function repairTarget(ctx: Ctx, carriageIndex: number): { kind: "ANCHOR"; anchor: AnchorId } | { kind: "LOCK"; lock: "power" | "route" | "drive" } | null {
  const identity = identityAt(ctx, carriageIndex);
  if (ctx.s.act === 1) return null;
  const anchorHere: Partial<Record<CarriageIdentity, AnchorId>> = { ENGINE_ROOM: "POWER", ARCHIVE: "IDENTITY", SLEEPER: "MEMORY", MIRROR: "MEMORY" };
  const anchor = anchorHere[identity];
  if (anchor && !ctx.s.anchors[anchor].repaired) return { kind: "ANCHOR", anchor };
  if (ctx.s.act === 3) {
    if (identity === "ENGINE_ROOM") return { kind: "LOCK", lock: "power" };
    if (identity === "ARCHIVE") return { kind: "LOCK", lock: "route" };
    if (identity === "CAB") return { kind: "LOCK", lock: "drive" };
  }
  return null;
}

export const LOCK_NAMES = { power: "Power Lock", route: "Route Lock", drive: "Drive Lock" } as const;

onRollOutcome("REPAIR", (ctx, p, roll, rc) => {
  if (roll.tier === "DISASTER") {
    penalty(ctx, p, rc, [{ kind: "LOSE_SANITY", who: "SELF", amount: 1 }], "a jolt from the machinery");
    changeCollapse(ctx, 1, "a botched repair");
    return;
  }
  if (!isSuccess(roll.tier)) return log(ctx, `${p.nickname}'s repair doesn't hold.`, "INFO", p.playerId);
  const target = repairTarget(ctx, rc.carriageIndex);
  if (!target) return;
  const unaided = !roll.modifiers.some((m) => m.source === "Help");
  p.stats.repairs++;
  if (target.kind === "ANCHOR") {
    const a = ctx.s.anchors[target.anchor];
    const gain = (roll.tier === "PERFECT" ? 2 : 1) * (rc.stakes?.rewardMult ?? 1);
    a.progress = Math.min(a.required, a.progress + gain);
    a.lastRepairedBy = p.playerId;
    log(ctx, `${p.nickname} works on the ${anchorName(a.id)}: ${a.progress}/${a.required}.`, "ANCHOR", p.playerId);
    cue(ctx, "ANCHOR", { anchor: a.id, progress: a.progress, required: a.required });
    if (a.progress >= a.required && !a.repaired) {
      if (unaided) p.stats.soloKeyTasks++;
      restoreAnchor(ctx, a);
    }
  } else {
    const esc = ctx.s.escape;
    if (esc.round !== ctx.s.round) {
      esc.round = ctx.s.round;
      esc.power = esc.route = esc.drive = false;
      esc.by = {};
    }
    esc[target.lock] = true;
    esc.by[target.lock] = p.playerId;
    if (unaided) p.stats.soloKeyTasks++;
    if (ctx.s.round >= 10) p.stats.finalTaskRound = ctx.s.round;
    log(ctx, `${p.nickname} engages the ${LOCK_NAMES[target.lock]}. (${[esc.power, esc.route, esc.drive].filter(Boolean).length}/3 this round)`, "LOCK", p.playerId);
    cue(ctx, "LOCK", { lock: target.lock });
  }
});

export const anchorName = (id: AnchorId): string => ({ POWER: "Power Anchor", IDENTITY: "Identity Anchor", MEMORY: "Memory Anchor" })[id];

onRollOutcome("CONFRONT", (ctx, p, roll, rc) => {
  p.stats.confronts++;
  if (roll.tier === "DISASTER") {
    penalty(ctx, p, rc, [{ kind: "LOSE_SANITY", who: "SELF", amount: 1 }], "it struck back");
    changeCollapse(ctx, 1, "a disastrous confrontation");
    return;
  }
  if (!isSuccess(roll.tier)) return log(ctx, `${p.nickname}'s confrontation goes nowhere.`, "INFO", p.playerId);
  const hits = (roll.tier === "PERFECT" ? 2 : 1) * (rc.stakes?.rewardMult ?? 1);
  if (rc.target === "INSPECTOR") {
    const insp = ctx.s.inspector;
    insp.distortion += hits;
    log(ctx, `${p.nickname} unsettles the Faceless Inspector: distortion ${Math.min(3, insp.distortion)}/3.`, "INSPECTOR", p.playerId);
    cue(ctx, "DISTORTION", { distortion: insp.distortion });
    if (insp.distortion >= 3) {
      insp.distortion = 0;
      insp.banishedUntilRound = ctx.s.round + 1;
      insp.targetId = null;
      log(ctx, "The Inspector's face flickers out. It is gone, for now.", "INSPECTOR_GONE");
      cue(ctx, "INSPECTOR_BANISHED", {});
      if (ctx.s.nightRule === "RED_EYE") applyEffects(ctx, [{ kind: "GAIN_FATE", who: "ALL", amount: 1 }], scopeFor(p, "the red-eye bounty"));
    }
    return;
  }
  const ent = ctx.s.entities.find((e) => e.id === rc.target);
  if (!ent) return;
  ent.hp -= hits;
  if (ent.hp <= 0) {
    ctx.s.entities = ctx.s.entities.filter((e) => e.id !== ent.id);
    log(ctx, `${p.nickname} dispels the ${ent.kind === "SHADOW" ? "shadow passenger" : "echo"}.`, "ENTITY_GONE", p.playerId);
    cue(ctx, "ENTITY_GONE", { id: ent.id });
    reward(ctx, p, rc, [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }], "dispelling it");
  } else {
    log(ctx, `${p.nickname} drives the ${ent.kind === "SHADOW" ? "shadow passenger" : "echo"} back (${ent.hp} left).`, "ENTITY", p.playerId);
  }
});

onRollOutcome("TICKET_CHECK", (ctx, p, roll, rc) => {
  if (roll.tier === "PERFECT") {
    addStatus(ctx, p, { kind: "TEMP_PASS", polarity: "POSITIVE", sourceId: "SYSTEM", expiresAtRound: null, hidden: false, ordinary: false });
    return log(ctx, `${p.nickname}'s ticket is stamped. They earn a temporary pass.`, "TICKET", p.playerId);
  }
  if (roll.tier === "SUCCESS") return log(ctx, `${p.nickname}'s ticket is in order.`, "TICKET", p.playerId);
  const effects: Effect[] = [{ kind: "LOSE_FATE", who: "SELF", amount: 1 }];
  if (roll.tier === "DISASTER") effects.push({ kind: "LOSE_SANITY", who: "SELF", amount: 1 });
  log(ctx, `"This ticket is not valid." The Inspector writes something down about ${p.nickname}.`, "TICKET_FAIL", p.playerId);
  penalty(ctx, p, rc, effects, "a failed ticket check");
});

export const fragmentName = (f: FragmentType) => FRAGMENTS[f].name;
