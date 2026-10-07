import { m } from "../../shared/i18n/msg.ts";
import type { Msg } from "../../shared/i18n/types.ts";
// Skill Engine interface. PHASE 2 implements the generic, data-driven parts
// that every one of the 192 skills shares: may this player use their skill now,
// against these targets, and whose skill does a game event wake up? The effect
// handlers (EffectHandlers) are implemented in PHASE 8 — one per Effect kind,
// never one per character.
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import type { Character, SkillTrigger, TargetRule, TriggerKind } from "../../shared/characters/types.ts";
import type { RejectCode } from "../../shared/game/actions.ts";
import type { Effect, EffectKind } from "../../shared/game/effects.ts";
import type { GameState, ItemId, PlayerId, Status } from "../../shared/game/state.ts";

export type SkillCheck = { ok: true } | { ok: false; code: RejectCode; reason: Msg };

/** Something that happened in the game, as the trigger matcher sees it. */
export type TriggerEvent = {
  kind: TriggerKind;
  /** Who caused it (the attacker, the roller, the skill user). */
  sourceId?: PlayerId | "SYSTEM";
  /** Who it happened to (the target, the player who gained Fate). */
  subjectId?: PlayerId;
  tier?: "DISASTER" | "FAIL" | "SUCCESS" | "PERFECT";
  amount?: number;
  condition?: string;
  /** The status a buff / expiry trigger is about. */
  status?: Status;
  /** The item a reward trigger is about. */
  item?: ItemId;
};

export type EffectContext = {
  state: GameState;
  ownerId: PlayerId;
  targets: PlayerId[];
  trigger?: TriggerEvent;
};

/** One handler per Effect kind (PHASE 8). A skill is just a list of effects. */
export type EffectHandlers = {
  [K in EffectKind]: (ctx: EffectContext, effect: Extract<Effect, { kind: K }>) => GameState;
};

export interface SkillEngine {
  canUse(state: GameState, ownerId: PlayerId, targets: PlayerId[]): SkillCheck;
  wakes(state: GameState, event: TriggerEvent): PlayerId[];
}

const IN_RUN = new Set(["ACT_1", "ACT_2", "ACT_3"]);

export function characterOf(state: GameState, playerId: PlayerId): Character | null {
  const p = state.players[playerId];
  return p ? getCharacterById(p.characterId) : null;
}

const no = (code: RejectCode, reason: Msg): SkillCheck => ({ ok: false, code, reason });

export function canUseSkill(state: GameState, ownerId: PlayerId, targets: PlayerId[]): SkillCheck {
  const me = state.players[ownerId];
  if (!me || me.away) return no("NOT_IN_ROOM", m`You're not in this run.`);
  if (!IN_RUN.has(state.phase)) return no("WRONG_PHASE", m`Abilities can only be used during the run.`);
  if (me.skill.state === "LOCKED") return no("SKILL_LOCKED", m`Your ability is locked right now.`);
  if (me.skill.usesLeft <= 0 || me.skill.state === "BURNED") return no("SKILL_ALREADY_USED", m`Your ability is already burned.`);

  const skill = getCharacterById(me.skill.borrowed ?? me.characterId).skill;
  const top = state.pending.at(-1);
  if (skill.type === "ACTIVE") {
    if (top?.blocksTable) return no("WINDOW_OPEN", m`Wait for the current decision to finish.`);
    if (state.step !== "PLAYER_TURNS" || state.turnOrder[state.activeIndex] !== ownerId) {
      return no("NOT_YOUR_TURN", m`Active abilities are used on your own turn.`);
    }
  } else {
    const kind = skill.type === "REACTION" ? "REACTION" : "PASSIVE_CONFIRM";
    if (!top || top.kind !== kind || !top.addressees.includes(ownerId)) {
      return no("NOT_YOUR_WINDOW", m`This ability fires only when its moment comes.`);
    }
  }
  return checkTargets(state, ownerId, skill.target, targets);
}

/** Target rules where the player picks; every other rule is resolved by the server. */
const CHOSEN: Partial<Record<TargetRule, { min: number; max: number; others: boolean; sameCarriage?: boolean }>> = {
  ANY_PLAYER: { min: 1, max: 1, others: false },
  OTHER_PLAYER: { min: 1, max: 1, others: true },
  SAME_CARRIAGE: { min: 1, max: 1, others: true, sameCarriage: true },
  TWO_PLAYERS: { min: 2, max: 2, others: false },
  UP_TO_THREE_PLAYERS: { min: 1, max: 3, others: false },
};

export function checkTargets(state: GameState, ownerId: PlayerId, rule: TargetRule, targets: PlayerId[]): SkillCheck {
  const spec = CHOSEN[rule];
  if (!spec) {
    return targets.length === 0 ? { ok: true } : no("ILLEGAL_TARGET", m`This ability doesn't take a chosen target.`);
  }
  if (new Set(targets).size !== targets.length) return no("ILLEGAL_TARGET", m`Choose each player only once.`);
  if (targets.length < spec.min || targets.length > spec.max) {
    return no("ILLEGAL_TARGET", spec.min !== spec.max ? m`Choose ${spec.min} to ${spec.max} players.` : spec.min > 1 ? m`Choose ${spec.min} players.` : m`Choose a player.`);
  }
  const me = state.players[ownerId];
  const shielded = me.statuses.find((st) => st.kind === "FORBIDDEN_TARGET" && targets.includes(st.sourceId as PlayerId));
  if (shielded) return no("ILLEGAL_TARGET", m`Your next ability can't target ${state.players[shielded.sourceId as PlayerId]?.nickname ?? "?"}.`);
  for (const id of targets) {
    const t = state.players[id];
    if (!t || t.away) return no("ILLEGAL_TARGET", m`That player isn't in the run.`);
    if (spec.others && id === ownerId) return no("ILLEGAL_TARGET", m`Choose someone other than yourself.`);
    if (spec.sameCarriage && t.carriageIndex !== me.carriageIndex) return no("ILLEGAL_TARGET", m`They need to be in your carriage.`);
  }
  return { ok: true };
}

export function triggerMatches(trigger: SkillTrigger, ownerId: PlayerId, event: TriggerEvent): boolean {
  if (trigger.on !== event.kind) return false;
  if (trigger.tiers && (!event.tier || !trigger.tiers.includes(event.tier))) return false;
  if (trigger.minAmount !== undefined && (event.amount ?? 0) < trigger.minAmount) return false;
  if (trigger.condition && trigger.condition !== event.condition) return false;
  if (trigger.fromPlayer && (!event.sourceId || event.sourceId === "SYSTEM")) return false;
  if (trigger.others && (event.subjectId === ownerId || event.sourceId === ownerId)) return false;
  // "own" triggers only fire for their owner
  if ((event.kind === "OWN_ROLL_RESOLVED" || event.kind === "OWN_CHOICE_MADE") && event.subjectId !== ownerId) return false;
  const OWN: TriggerKind[] = ["NEGATIVE_EFFECT_TARGETS_SELF", "ATTACKED_BY_PLAYER", "HELPED_BY_PLAYER", "SELF_GAINS_REWARD", "FATE_REACHES_ZERO", "CONDITION_MET", "STATUS_EXPIRING"];
  if (OWN.includes(event.kind) && event.subjectId !== ownerId) {
    return false;
  }
  return true;
}

/** Players whose unused REACTION / PASSIVE skill this event wakes, in turn order. */
export function playersWokenBy(state: GameState, event: TriggerEvent): PlayerId[] {
  return state.turnOrder.filter((id) => {
    const p = state.players[id];
    if (!p || p.away || p.skill.usesLeft <= 0 || p.skill.state !== "READY") return false;
    const skill = getCharacterById(p.characterId).skill;
    return skill.type !== "ACTIVE" && triggerMatches(skill.trigger, id, event);
  });
}

export const skillEngine: SkillEngine = { canUse: canUseSkill, wakes: playersWokenBy };
