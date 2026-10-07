// Abilities as scenario 01 runs them: every character's core ability with
// this scenario's adapter applied. Engine and client read abilities here.
import { ROSTER } from "../../characters/roster/index.ts";
import type { CharacterId, Skill } from "../../characters/types.ts";
import { skillTable } from "../../skills/resolver.ts";
import { SCENARIO01_SKILLS } from "./skill-adapters/index.ts";

export const SKILLS: Record<CharacterId, Skill> = skillTable(ROSTER, SCENARIO01_SKILLS);

export const characterSkill = (id: CharacterId): Skill => {
  const s = SKILLS[id];
  if (!s) throw new Error(`no ability for ${id}`);
  return s;
};
