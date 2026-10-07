import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCharacter, ROSTER } from "../src/shared/characters/roster/index.ts";
import { SCENARIO01_SKILLS } from "../src/shared/game/scenario01/skill-adapters/index.ts";
import { characterSkill, SKILLS } from "../src/shared/game/scenario01/skills.ts";
import { CORE_SKILLS, CORE_SKILL_LIST } from "../src/shared/skills/core/index.ts";
import { CORE_SKILL_CATEGORIES } from "../src/shared/skills/core/types.ts";
import { resolveSkill, skillTable } from "../src/shared/skills/resolver.ts";
import type { ScenarioSkillSet } from "../src/shared/skills/types.ts";

// Character -> core ability -> scenario adapter -> the ability the engine runs.
// A character knows no scenario; a core ability has mechanics but no name;
// scenario 01 dresses every one the roster uses.

const N13_WORDS = /\b(N13|train|carriage|inspector|ticket|conductor|cab|anchor|escape lock|echo)\b/i;

describe("skill architecture", () => {
  it("every one of the 192 characters points at a real core ability", () => {
    expect(ROSTER).toHaveLength(192);
    const missing = ROSTER.filter((c) => !CORE_SKILLS[c.coreSkillId]).map((c) => c.id);
    expect(missing).toEqual([]);
    expect(new Set(CORE_SKILL_LIST.map((c) => c.id)).size).toBe(CORE_SKILL_LIST.length);
    for (const c of CORE_SKILL_LIST) expect(CORE_SKILL_CATEGORIES, c.id).toContain(c.category);
  });

  it("scenario 01 dresses all 192: a name, a description and a visual for each", () => {
    expect(Object.keys(SKILLS)).toHaveLength(192);
    for (const c of ROSTER) {
      const s = characterSkill(c.id);
      expect(s.coreSkillId, c.id).toBe(c.coreSkillId);
      expect(s.name.trim() && s.description.trim() && s.vfx, c.id).toBeTruthy();
    }
    const unused = Object.keys(SCENARIO01_SKILLS.adapters).filter((id) => !CORE_SKILLS[id]);
    expect(unused).toEqual([]);
  });

  it("character data holds no skill text or mechanics and no scenario words", () => {
    const dir = new URL("../src/shared/characters/roster/", import.meta.url);
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
      const src = readFileSync(new URL(f, dir), "utf8");
      expect(src, f).not.toMatch(/\b(effects|trigger|description|skill)\s*:/);
      // titles are kept as they are ("Discipline Inspector" is about discipline, not the train)
      expect(src.replace(/entry\("\w+", "[^"]*"/g, "entry("), f).not.toMatch(N13_WORDS);
    }
    for (const c of ROSTER) expect(Object.keys(c).sort(), c.id).toEqual(["avatar", "coreSkillId", "id", "mbti", "nickname", "visual", "zodiac"]);
  });

  it("core abilities carry no names and no scenario words", () => {
    for (const c of CORE_SKILL_LIST) {
      expect(c, c.id).not.toHaveProperty("name");
      expect(c, c.id).not.toHaveProperty("description");
      expect(JSON.stringify(c), c.id).not.toMatch(N13_WORDS);
    }
  });

  it("the brief's example: Scorpio ENTP's core is a retaliation, shown in scenario 01 as Backbite", () => {
    const c = getCharacter("scorpio", "ENTP");
    expect(CORE_SKILLS[c.coreSkillId].category).toBe("RETALIATE");
    expect(characterSkill(c.id)).toMatchObject({ name: "Backbite", type: "REACTION", vfx: "STRIKE" });
  });

  it("another scenario renames and re-dresses the same core without copying its mechanics", () => {
    const core = CORE_SKILLS[getCharacter("scorpio", "ENTP").coreSkillId];
    const other: ScenarioSkillSet = { ...SCENARIO01_SKILLS, scenario: "test", adapters: { [core.id]: { name: "Riposte", description: "Strike back.", vfx: "SPARK" } } };
    const s = resolveSkill(core, other);
    expect(s).toMatchObject({ name: "Riposte", vfx: "SPARK", category: "RETALIATE" });
    expect(s.effects).toEqual(core.effects);
    expect(() => skillTable(ROSTER, other)).toThrow(/no adapter/);
  });

  it("a scenario behaviour replaces only what it names: N13's ticket pass is a protection at core", () => {
    const id = getCharacter("pisces", "ENTP").coreSkillId;
    expect(CORE_SKILLS[id].category).toBe("SHIELD");
    expect(CORE_SKILLS[id].effects).toEqual([{ kind: "SHIELD", who: "SELF", charges: 1 }]);
    expect(characterSkill("pisces-entp").effects).toEqual([{ kind: "ADD_STATUS", who: "SELF", status: "PASS", rounds: 99, polarity: "POSITIVE" }]);
    expect(characterSkill("pisces-entp").trigger).toEqual(CORE_SKILLS[id].trigger);
  });
});
