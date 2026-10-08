// Scenario 03 dresses the same 192 Core Skills for Incident Zero. The core
// mechanics stay shared; only wording tied to a setting and one train-only
// ticket pass differ here.
import { ROSTER } from "../../characters/roster/index.ts";
import type { CharacterId } from "../../characters/types.ts";
import type { ScenarioSkillSet, SkillAdapter } from "../../skills/types.ts";
import { SCENARIO01_SKILLS } from "../scenario01/skill-adapters/index.ts";
import { S02_SKILL_TEXT } from "../scenario02/skill-adapters.ts";

export const S03_SKILL_TEXT: Partial<Record<CharacterId, Pick<SkillAdapter, "name" | "description">>> = {
  "aries-isfp": { name: "Go With Your Gut", description: "The Administration offers two random instant boons. Choose one." },
  "aries-estj": { name: "Forced Advance", description: "Choose a player. They immediately make a free temporal scan roll where they stand." },
  "gemini-entj": { name: "Parallel Tasks", description: "Two chosen players each make a quick roll. You choose which result counts; it resolves as a temporal scan where that player stands." },
  "taurus-istp": { name: "Harden", description: "Remove one ordinary negative status from yourself or a player in your room and year." },
  "leo-entj": { name: "Do As I Say", description: "Choose a player. They move one open room in their year, toward you if you share that year." },
  "capricorn-estj": { name: "Two Paths", description: "Choose two players. Each makes a free temporal scan roll now; whoever succeeds gains 1 extra Fate." },
  "pisces-entp": { name: "Brave Face", description: "Gain a shield that blocks the next negative effect on you." },
  "sagittarius-istj": { name: "Many Roads", description: "Succeed with all three temporal scan protocols and gain 2 Fate." },
};

const adapters = Object.fromEntries(ROSTER.map((character) => {
  const base = SCENARIO01_SKILLS.adapters[character.coreSkillId];
  const text = S03_SKILL_TEXT[character.id] ?? S02_SKILL_TEXT[character.id];
  const behaviour = character.id === "pisces-entp" ? undefined : base.behaviour;
  return [character.coreSkillId, { ...base, ...text, behaviour }];
}));

export const SCENARIO03_SKILLS: ScenarioSkillSet = {
  scenario: "03",
  adapters,
  vfxByCategory: { ...SCENARIO01_SKILLS.vfxByCategory, PREVIEW_EVENT: "CLOCK", CONTROL_EVENT: "CLOCK", MOVE: "CLOCK" },
};
