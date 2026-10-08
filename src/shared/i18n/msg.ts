// Building messages. The server writes English at the call site with the `m`
// tag, so English stays the source wording, and the template itself becomes
// the key other locales translate:
//
//   log(ctx, m`${p.nickname} gains ${n} Fate (${why}).`)
//     → { k: "{0} gains {1} Fate ({2}).", p: ["Kyle", 2, …] }
//
// Content (carriage names, items, skills…) goes in as a reference, never as
// an English string, so a Chinese sentence never ends up holding English words.
import type { CarriageIdentity, FragmentType, ItemId, NightRuleId, ObsessionId, AnchorId, EscapeLockId, ScenarioId } from "../game/state.ts";
import type { CharacterId, Zodiac } from "../characters/types.ts";
import type { Msg, MsgParam } from "./types.ts";

export function m(strings: TemplateStringsArray, ...values: MsgParam[]): Msg {
  const k = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `{${i}}` : ""), "");
  return values.length ? { k, p: values } : { k };
}

const r = (kind: string, ...ids: (string | number)[]): Msg => ({ k: `@${kind}`, p: ids });

/** References to scenario content, named by each locale. */
export const ref = {
  carriage: (id: CarriageIdentity) => r("carriage", id),
  item: (id: ItemId) => r("item", id),
  fragment: (id: FragmentType) => r("fragment", id),
  fragmentText: (id: FragmentType) => r("fragmentText", id),
  /** An ending's title and lines (key: NORMAL, TRUE_DELETE, TRUE_TICKET, FAILED_COLLAPSE…). */
  ending: (key: string) => r("ending", key),
  status: (kind: string) => r("status", kind),
  anchor: (id: AnchorId) => r("anchor", id),
  lock: (id: EscapeLockId) => r("lock", id),
  /** In a scenario that re-words abilities, pass it (scenario 01 by default). */
  skill: (id: CharacterId, scenarioId?: ScenarioId) => (scenarioId && scenarioId !== "S01_LAST_TRAIN" ? r("skill", id, scenarioId) : r("skill", id)),
  title: (id: CharacterId) => r("title", id),
  event: (id: string) => r("event", id),
  option: (eventId: string, optionId: string) => r("option", eventId, optionId),
  optionDetail: (eventId: string, optionId: string) => r("optionDetail", eventId, optionId),
  eventText: (id: string) => r("eventText", id),
  nightRule: (id: NightRuleId) => r("nightRule", id),
  nightRuleText: (id: NightRuleId) => r("nightRuleText", id),
  obsession: (id: ObsessionId) => r("obsession", id),
  zodiac: (id: Zodiac) => r("zodiac", id),
  ruleChange: (id: string) => r("ruleChange", id),
  goal: (id: string) => r("goal", id),
  /** Scenario 02's wording of the same goal. */
  goal02: (id: string) => r("goal02", id),
  /** Incident Zero's causal and temporal version of a shared task goal. */
  goal03: (id: string) => r("goal03", id),
  boon: (id: string) => r("boon", id),
  investigateHint: (id: CarriageIdentity) => r("investigateHint", id),
  searchHint: (id: CarriageIdentity) => r("searchHint", id),
  skillDescription: (id: CharacterId, scenarioId?: ScenarioId) => (scenarioId && scenarioId !== "S01_LAST_TRAIN" ? r("skillDescription", id, scenarioId) : r("skillDescription", id)),
  /** Scenario 02: a city zone, by its id in scenario02/map.ts. */
  zone: (id: string) => r("zone", id),
  part: (id: string) => r("part", id),
  npc: (id: string) => r("npc", id),
};

/** Joins messages with the locale's list separator (", " / "、"). */
export const list = (items: MsgParam[]): Msg => ({ k: "@list", p: items });
