// The 192 characters: 12 zodiac files × 16 MBTI entries, assembled into one
// list with ids, avatar paths and visual metadata. test/roster.test.ts proves
// every (zodiac, MBTI) pair appears exactly once.
import { ZODIAC_INFO } from "../signs.ts";
import {
  characterId,
  ZODIACS,
  type Character,
  type CharacterId,
  type MBTI,
  type RosterEntry,
  type Zodiac,
} from "../types.ts";
import { AQUARIUS } from "./aquarius.ts";
import { ARIES } from "./aries.ts";
import { CANCER } from "./cancer.ts";
import { CAPRICORN } from "./capricorn.ts";
import { GEMINI } from "./gemini.ts";
import { LEO } from "./leo.ts";
import { LIBRA } from "./libra.ts";
import { PISCES } from "./pisces.ts";
import { SAGITTARIUS } from "./sagittarius.ts";
import { SCORPIO } from "./scorpio.ts";
import { TAURUS } from "./taurus.ts";
import { VIRGO } from "./virgo.ts";

export const ROSTER_BY_ZODIAC: Record<Zodiac, RosterEntry[]> = {
  aries: ARIES,
  taurus: TAURUS,
  gemini: GEMINI,
  cancer: CANCER,
  leo: LEO,
  virgo: VIRGO,
  libra: LIBRA,
  scorpio: SCORPIO,
  sagittarius: SAGITTARIUS,
  capricorn: CAPRICORN,
  aquarius: AQUARIUS,
  pisces: PISCES,
};

/** MBTI → the character's temperament on the portrait (docs/visual-direction.md §10). */
export const MBTI_VISUAL: Record<MBTI, { archetype: string; accessory: string }> = {
  INTJ: { archetype: "Chess strategist", accessory: "Obsidian chess king" },
  INTP: { archetype: "Lab deconstructor", accessory: "Glass flask" },
  ENTJ: { archetype: "Commander", accessory: "Signet baton" },
  ENTP: { archetype: "Trickster experimenter", accessory: "Half mask" },
  INFJ: { archetype: "Veiled oracle", accessory: "Tarot card" },
  INFP: { archetype: "Gentle dreamer", accessory: "Paper lantern" },
  ENFJ: { archetype: "Ritual leader", accessory: "Ceremonial candle" },
  ENFP: { archetype: "Chaotic spark", accessory: "Sparkler" },
  ISTJ: { archetype: "Archivist", accessory: "Ledger and quill" },
  ISFJ: { archetype: "Guardian healer", accessory: "Wrapped charm" },
  ESTJ: { archetype: "Executive", accessory: "Pocket watch" },
  ESFJ: { archetype: "Host", accessory: "Teacup" },
  ISTP: { archetype: "Lone mechanic", accessory: "Wrench" },
  ISFP: { archetype: "Free artist", accessory: "Paintbrush" },
  ESTP: { archetype: "Daredevil", accessory: "Racing goggles" },
  ESFP: { archetype: "Performer", accessory: "Microphone" },
};

export const ROSTER: Character[] = ZODIACS.flatMap((zodiac) =>
  ROSTER_BY_ZODIAC[zodiac].map(
    (e): Character => ({
      id: characterId(zodiac, e.mbti),
      zodiac,
      mbti: e.mbti,
      nickname: e.title,
      skill: e.skill,
      avatar: `/avatars/${characterId(zodiac, e.mbti)}.svg`,
      visual: { ...MBTI_VISUAL[e.mbti], motif: ZODIAC_INFO[zodiac].motif },
    }),
  ),
);

const BY_ID = new Map<CharacterId, Character>(ROSTER.map((c) => [c.id, c]));

export const getCharacterById = (id: CharacterId): Character => {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`no character ${id}`);
  return c;
};

/** The character a sign + type produces. Total over all 192 pairs (tested). */
export const getCharacter = (zodiac: Zodiac, mbti: MBTI): Character => getCharacterById(characterId(zodiac, mbti));
