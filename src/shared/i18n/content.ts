// Scenario and character text for a locale. Missing entries fall back to
// English (the coverage tests make sure none are missing).
import type { CharacterId } from "../characters/types.ts";
import type { CharacterText, ScenarioText } from "./content-types.ts";
import { EN_CHARACTERS, EN_SCENARIO } from "./en.ts";
import { ZH_CHARACTERS } from "./zh-CN/characters/index.ts";
import { ZH_SCENARIO } from "./zh-CN/scenario.ts";
import type { Locale } from "./types.ts";
import type { ItemId, S01ItemId, ScenarioId } from "../game/state.ts";
import { S02_SKILL_TEXT } from "../game/scenario02/skill-adapters.ts";
import { ZH_S02_SKILL_TEXT } from "./zh-CN/skills02.ts";
import { S03_SKILL_TEXT } from "../game/scenario03/skill-adapters.ts";
import { ZH_S03_SKILL_TEXT } from "./zh-CN/skills03.ts";
import type { NameText } from "./content-types.ts";
import { scenario02Text } from "./scenario02.ts";
import { scenario03Items } from "./scenario03.ts";

export function scenarioText(locale: Locale): ScenarioText {
  return locale === "zh-CN" ? ZH_SCENARIO : EN_SCENARIO;
}

/** An item of any scenario. */
export function itemText(locale: Locale, id: ItemId): NameText {
  return scenarioText(locale).items[id as S01ItemId] ?? scenario02Text(locale).items[id] ?? scenario03Items(locale)[id as keyof ReturnType<typeof scenario03Items>] ?? { name: id, text: "" };
}

/** A character's title and ability text; a scenario may re-word an ability (scenario02/skill-adapters.ts). */
export function characterText(locale: Locale, id: CharacterId, scenarioId: ScenarioId = "S01_LAST_TRAIN"): CharacterText {
  const base = (locale === "zh-CN" ? ZH_CHARACTERS[id] : undefined) ?? EN_CHARACTERS[id];
  const s02 = scenarioId === "S02_SUNKEN_CITY" ? ((locale === "zh-CN" ? ZH_S02_SKILL_TEXT[id] : undefined) ?? S02_SKILL_TEXT[id]) : undefined;
  const s03 = scenarioId === "S03_INCIDENT_ZERO" ? ((locale === "zh-CN" ? ZH_S03_SKILL_TEXT[id] ?? ZH_S02_SKILL_TEXT[id] : undefined) ?? S03_SKILL_TEXT[id] ?? S02_SKILL_TEXT[id]) : undefined;
  const words = s03 ?? s02;
  return words ? { title: base.title, skillName: words.name, skillDescription: words.description } : base;
}
