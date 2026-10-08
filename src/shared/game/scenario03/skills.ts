import { ROSTER } from "../../characters/roster/index.ts";
import type { CharacterId, Skill } from "../../characters/types.ts";
import { skillTable } from "../../skills/resolver.ts";
import { SCENARIO03_SKILLS } from "./skill-adapters.ts";

export const SKILLS03: Record<CharacterId, Skill> = skillTable(ROSTER, SCENARIO03_SKILLS);
