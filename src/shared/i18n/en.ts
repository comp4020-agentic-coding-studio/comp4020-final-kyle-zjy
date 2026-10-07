// English text, read straight from the canonical game data.
import { MBTI_INFO, TEMPERAMENTS, ZODIAC_INFO } from "../characters/signs.ts";
import { ROSTER } from "../characters/roster/index.ts";
import { ANCHOR_NAMES, BOON_LABELS, CARRIAGES, endingText, FRAGMENTS, ITEMS, LOCK_NAMES, NIGHT_RULES, OBSESSIONS, RULE_CHANGES, SCENARIO, TASK_GOALS } from "../game/scenario01/content.ts";
import { EVENTS } from "../game/scenario01/events.ts";
import { STATUSES } from "../game/scenario01/statuses.ts";
import type { CharactersText, EndingKey, ScenarioText } from "./content-types.ts";

const pick = <T extends object, K extends keyof T>(o: T, keys: K[]) => Object.fromEntries(keys.map((k) => [k, o[k]])) as Pick<T, K>;
const mapValues = <K extends string, V, W>(o: Record<K, V>, f: (v: V) => W) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v as V)])) as Record<K, W>;

const ending = (key: EndingKey) => {
  const t = key.startsWith("FAILED") ? endingText("FAILED", key.slice(7) as never) : endingText(key as never, null);
  return { kicker: t.kicker, title: t.title, lines: t.lines };
};

export const EN_SCENARIO: ScenarioText = {
  scenario: { title: SCENARIO.title, tagline: SCENARIO.tagline },
  carriages: mapValues(CARRIAGES, (c) => pick(c, ["name", "theme", "blurb", "investigateHint", "searchHint"])),
  fragments: FRAGMENTS,
  items: mapValues(ITEMS, (i) => ({ name: i.name, text: i.text })),
  nightRules: NIGHT_RULES,
  obsessions: OBSESSIONS,
  statuses: STATUSES,
  events: Object.fromEntries(
    EVENTS.map((e) => [e.id, { title: e.title, text: e.text, options: e.options && Object.fromEntries(e.options.map((o) => [o.id, { label: o.label, detail: o.detail }])) }]),
  ),
  endings: Object.fromEntries((["NORMAL", "TRUE_DELETE", "TRUE_TICKET", "FAILED_COLLAPSE", "FAILED_ALL_LOST", "FAILED_TIME"] as EndingKey[]).map((k) => [k, ending(k)])) as ScenarioText["endings"],
  anchors: ANCHOR_NAMES,
  locks: LOCK_NAMES,
  ruleChanges: RULE_CHANGES,
  goals: TASK_GOALS,
  boons: BOON_LABELS,
  zodiac: mapValues(ZODIAC_INFO, (z) => ({ name: z.name, dates: z.dates, theme: z.theme })),
  mbti: mapValues(MBTI_INFO, (i) => ({ title: i.title, traits: i.traits })),
  temperaments: Object.fromEntries(TEMPERAMENTS.map((t) => [t.id, t.name])) as ScenarioText["temperaments"],
};

export const EN_CHARACTERS = Object.fromEntries(ROSTER.map((c) => [c.id, { title: c.nickname, skillName: c.skill.name, skillDescription: c.skill.description }])) as CharactersText;
