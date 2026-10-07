// Scenario and character text for a locale. Missing entries fall back to
// English (the coverage tests make sure none are missing).
import type { CharacterId } from "../characters/types.ts";
import type { CharacterText, ScenarioText } from "./content-types.ts";
import { EN_CHARACTERS, EN_SCENARIO } from "./en.ts";
import { ZH_CHARACTERS } from "./zh-CN/characters/index.ts";
import { ZH_SCENARIO } from "./zh-CN/scenario.ts";
import type { Locale } from "./types.ts";

export function scenarioText(locale: Locale): ScenarioText {
  return locale === "zh-CN" ? ZH_SCENARIO : EN_SCENARIO;
}

export function characterText(locale: Locale, id: CharacterId): CharacterText {
  return (locale === "zh-CN" ? ZH_CHARACTERS[id] : undefined) ?? EN_CHARACTERS[id];
}
