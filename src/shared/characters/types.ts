// Character and skill data types. The 192-entry roster (PHASE 2) is typed
// against these; skills are data — a trigger, a target rule and a list of
// Effect primitives — so the Skill Resolver can run all 192 without bespoke code.
import type { Effect } from "../game/effects.ts";

export const ZODIACS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
] as const;
export type Zodiac = (typeof ZODIACS)[number];

export const MBTIS = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP",
] as const;
export type MBTI = (typeof MBTIS)[number];

/** `scorpio-entp` — also the avatar file stem. */
export type CharacterId = `${Zodiac}-${Lowercase<MBTI>}`;

export const characterId = (zodiac: Zodiac, mbti: MBTI): CharacterId =>
  `${zodiac}-${mbti.toLowerCase() as Lowercase<MBTI>}`;

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

export type Skill = {
  name: string;
  description: string;
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

export type Character = {
  id: CharacterId;
  zodiac: Zodiac;
  mbti: MBTI;
  /** Title shown on the card, e.g. "The Venom-Tongued Schemer". */
  nickname: string;
  skill: Skill;
  /** Public path, e.g. `/avatars/scorpio-entp.svg`. */
  avatar: string;
  visual: {
    archetype: string;
    accessory: string;
    motif: string;
  };
};

/** One line of the roster as authored: the zodiac comes from the file. */
export type RosterEntry = {
  mbti: MBTI;
  title: string;
  skill: Skill;
};

export type ZodiacInfo = {
  id: Zodiac;
  name: string;
  glyph: string;
  theme: string;
  motif: string;
  accent: string;
};

export type MbtiInfo = {
  id: MBTI;
  temperament: "NT" | "NF" | "SJ" | "SP";
  traits: string;
};
