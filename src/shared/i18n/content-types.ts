// The shape of every locale's scenario and character text. English is built
// from the canonical game data (no copy); other locales fill the same shape,
// keyed by stable ids, so the compiler lists anything missing.
import type { CharacterId, MBTI, Zodiac } from "../characters/types.ts";
import type { AnchorId, CarriageIdentity, FragmentType, ItemId, NightRuleId, ObsessionId, TaskGoal, EscapeLockId } from "../game/state.ts";

export type NameText = { name: string; text: string };
export type CharacterText = { title: string; skillName: string; skillDescription: string };
export type EventText = { title: string; text: string; options?: Record<string, { label: string; detail: string }> };
export type EndingKey = "NORMAL" | "TRUE_DELETE" | "TRUE_TICKET" | "FAILED_COLLAPSE" | "FAILED_ALL_LOST" | "FAILED_TIME";

export type ScenarioText = {
  scenario: { title: string; tagline: string };
  carriages: Record<CarriageIdentity, { name: string; theme: string; blurb: string; investigateHint: string; searchHint: string }>;
  fragments: Record<FragmentType, NameText>;
  items: Record<ItemId, NameText>;
  nightRules: Record<NightRuleId, NameText>;
  obsessions: Record<ObsessionId, NameText>;
  statuses: Record<string, { short: string; long: string }>;
  events: Record<string, EventText>;
  endings: Record<EndingKey, { kicker: string; title: string; lines: string[] }>;
  anchors: Record<AnchorId, string>;
  locks: Record<EscapeLockId, string>;
  ruleChanges: Record<string, string>;
  goals: Record<TaskGoal, string>;
  boons: Record<string, string>;
  zodiac: Record<Zodiac, { name: string; dates: string; theme: string }>;
  mbti: Record<MBTI, { title: string; traits: string }>;
  temperaments: Record<"NT" | "NF" | "SJ" | "SP", string>;
};

export type CharactersText = Record<CharacterId, CharacterText>;
