// The core ability vocabulary: what an ability does, independent of any
// scenario. A core ability is a trigger, a target rule and a list of Effect
// primitives (src/shared/game/effects.ts); the Skill Resolver runs any of them
// without per-character code.
import type { Effect } from "../../game/effects.ts";
import type { SkillVfx } from "../types.ts";

export type CoreSkillId = string;

/** The family an ability belongs to: its role at any table, in any scenario. */
export const CORE_SKILL_CATEGORIES = [
  "REROLL",
  "MODIFY_RESULT",
  "PREVIEW_EVENT",
  "CONTROL_EVENT",
  "SHIELD",
  "REDIRECT",
  "COPY_EFFECT",
  "SWAP_STATE",
  "GAIN_RESOURCE",
  "RESTORE_SKILL",
  "CHANGE_TURN_ORDER",
  "REMOVE_STATUS",
  "BIND",
  "CHALLENGE",
  "RETALIATE",
  "EMPOWER",
  "HINDER",
  "MOVE",
  "TASK",
  "RULE",
] as const;
export type CoreSkillCategory = (typeof CORE_SKILL_CATEGORIES)[number];

export type SkillType = "ACTIVE" | "REACTION" | "PASSIVE";

export const TRIGGERS = [
  "OWN_TURN", // ACTIVE skills: used during your own turn
  "OWN_ROLL_RESOLVED",
  "ANY_ROLL_RESOLVED",
  "PUBLIC_ROLL_DONE",
  "NEGATIVE_EFFECT_TARGETS_SELF",
  "NEGATIVE_EFFECT_TARGETS_ANY",
  "ATTACKED_BY_PLAYER",
  "TARGETED_ABILITY_DECLARED",
  "PLAYER_GAINS_FATE",
  "PLAYER_GAINS_BUFF",
  "PLAYER_GAINS_REWARDS",
  "SELF_GAINS_REWARD",
  "HELPED_BY_PLAYER",
  "SKILL_USED_BY_OTHER",
  "OWN_CHOICE_MADE",
  "EVENT_REVEALED",
  "CHOICE_EVENT_REVEALED",
  "STATUS_EXPIRING",
  "FATE_REACHES_ZERO",
  "FATE_THEFT_ATTEMPTED",
  "RULE_CONFLICT",
  "ROUND_START",
  "ROUND_END",
  "CONDITION_MET", // PASSIVE skills tracked by a counter or a game condition
] as const;
export type TriggerKind = (typeof TRIGGERS)[number];

/** When a skill's window opens. ACTIVE skills use OWN_TURN. */
export type SkillTrigger = {
  on: TriggerKind;
  /** Only these roll tiers fire the trigger. */
  tiers?: RollTier[];
  /** Only events caused by / happening to other players. */
  others?: boolean;
  fromPlayer?: boolean;
  minAmount?: number;
  /** CONDITION_MET: machine-readable condition id, e.g. "NO_NEGATIVE_2_ROUNDS". */
  condition?: string;
};

export type RollTier = "DISASTER" | "FAIL" | "SUCCESS" | "PERFECT";

/** Who an effect may point at; validated server-side against the live state. */
export type TargetRule =
  | "SELF"
  | "ANY_PLAYER"
  | "OTHER_PLAYER"
  | "SAME_CARRIAGE"
  | "TWO_PLAYERS"
  | "UP_TO_THREE_PLAYERS"
  | "ALL_PLAYERS"
  | "LOWEST_FATE"
  | "HIGHEST_FATE"
  | "TRIGGER_SOURCE"
  | "RANDOM_PLAYERS"
  | "NONE";

/** An ability's mechanics, the same in every scenario. */
export type CoreSkill = {
  /** e.g. "RETALIATE_04"; stable, referenced by characters and adapters. */
  id: CoreSkillId;
  /** The ability's role, kept by every scenario's version of it. */
  category: CoreSkillCategory;
  type: SkillType;
  maxUses: number;
  tags: string[];
  trigger: SkillTrigger;
  target: TargetRule;
  /** Ordered primitives; the resolver applies them in sequence. */
  effects: Effect[];
  /** Extra precondition beyond the trigger, as a machine-readable id (e.g. "TARGET_WAS_HELPED_THIS_ROUND"). */
  requires?: string;
  /** RANDOM_PLAYERS: how many players the server draws (default 2). */
  count?: number;
  /** May other skills (copy / "anything is possible") reproduce this one? */
  copyable: boolean;
};

/**
 * An ability as one scenario runs it: the core mechanics (with any scenario
 * behaviour applied) plus that scenario's name, description and effect.
 */
export type Skill = Omit<CoreSkill, "id"> & {
  coreSkillId: CoreSkillId;
  name: string;
  description: string;
  vfx: SkillVfx;
};

