// Character data types. The 192-entry roster is typed against these. A
// character's ability is a core ability id; see src/shared/skills/.
import type { CoreSkillId } from "../skills/core/types.ts";

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

// Skill vocabulary lives with the core abilities (src/shared/skills/core/types.ts).
export { TRIGGERS } from "../skills/core/types.ts";
export type { RollTier, Skill, SkillTrigger, SkillType, TargetRule, TriggerKind } from "../skills/core/types.ts";

/**
 * Who a character is, in every scenario. Their ability is a pointer to a core
 * ability (src/shared/skills/core); each scenario's adapter decides how it is
 * named and shown there. Nothing here knows about any one scenario.
 */
export type Character = {
  id: CharacterId;
  zodiac: Zodiac;
  mbti: MBTI;
  /** Title shown on the card, e.g. "The Venom-Tongued Schemer". */
  nickname: string;
  coreSkillId: CoreSkillId;
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
  coreSkillId: CoreSkillId;
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
