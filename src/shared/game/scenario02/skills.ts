// Abilities as scenario 02 runs them. Same core abilities as every scenario;
// scenario 01's dress, except the few whose wording or behaviour belongs to
// the train (skill-adapters.ts): those read and work as the city needs.
import { getCharacterById, ROSTER } from "../../characters/roster/index.ts";
import type { CharacterId, Skill } from "../../characters/types.ts";
import { skillTable } from "../../skills/resolver.ts";
import type { ScenarioSkillSet, SkillAdapters } from "../../skills/types.ts";
import { SCENARIO01_SKILLS } from "../scenario01/skill-adapters/index.ts";
import { S02_SKILL_TEXT } from "./skill-adapters.ts";

const overrides: SkillAdapters = Object.fromEntries(
  Object.entries(S02_SKILL_TEXT).map(([id, text]) => [getCharacterById(id as CharacterId).coreSkillId, { ...text, vfx: SCENARIO01_SKILLS.adapters[getCharacterById(id as CharacterId).coreSkillId].vfx }]),
);

export const SCENARIO02_SKILLS: ScenarioSkillSet = {
  scenario: "02",
  adapters: { ...SCENARIO01_SKILLS.adapters, ...overrides },
  vfxByCategory: SCENARIO01_SKILLS.vfxByCategory,
};

export const SKILLS02: Record<CharacterId, Skill> = skillTable(ROSTER, SCENARIO02_SKILLS);
