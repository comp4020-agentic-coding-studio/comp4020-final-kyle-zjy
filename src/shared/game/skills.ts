// A character's ability in the scenario being played. Engine and client read
// abilities through here, never through one scenario's table directly.
import type { CharacterId, Skill } from "../characters/types.ts";
import { SKILLS } from "./scenario01/skills.ts";
import { SKILLS02 } from "./scenario02/skills.ts";
import { SKILLS03 } from "./scenario03/skills.ts";
import type { ScenarioId } from "./state.ts";

const TABLES: Record<ScenarioId, Record<CharacterId, Skill>> = { S01_LAST_TRAIN: SKILLS, S02_SUNKEN_CITY: SKILLS02, S03_INCIDENT_ZERO: SKILLS03 };

export function characterSkill(id: CharacterId, scenarioId: ScenarioId = "S01_LAST_TRAIN"): Skill {
  const s = TABLES[scenarioId]?.[id];
  if (!s) throw new Error(`no ability for ${id} in ${scenarioId}`);
  return s;
}
