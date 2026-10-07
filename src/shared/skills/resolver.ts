// Core ability + scenario adapter -> the ability as that scenario runs it.
// The server's Skill Resolver (src/server/engine/resolver.ts) and the client
// read abilities only through a table built here.
import type { Character, CharacterId } from "../characters/types.ts";
import { CORE_SKILLS } from "./core/index.ts";
import type { CoreSkill, Skill } from "./core/types.ts";
import type { ScenarioSkillSet } from "./types.ts";

export function resolveSkill(core: CoreSkill, set: ScenarioSkillSet): Skill {
  const adapter = set.adapters[core.id];
  if (!adapter) throw new Error(`${set.scenario} has no adapter for core ability ${core.id}`);
  const { id, ...mechanics } = core;
  return {
    ...mechanics,
    ...adapter.behaviour,
    coreSkillId: id,
    name: adapter.name,
    description: adapter.description,
    vfx: adapter.vfx ?? set.vfxByCategory[core.category],
  };
}

/** Every character's ability in one scenario. Throws on a dangling id, so a gap fails at load. */
export function skillTable(characters: Pick<Character, "id" | "coreSkillId">[], set: ScenarioSkillSet): Record<CharacterId, Skill> {
  return Object.fromEntries(
    characters.map((c) => {
      const core = CORE_SKILLS[c.coreSkillId];
      if (!core) throw new Error(`${c.id} points at unknown core ability ${c.coreSkillId}`);
      return [c.id, resolveSkill(core, set)];
    }),
  ) as Record<CharacterId, Skill>;
}
