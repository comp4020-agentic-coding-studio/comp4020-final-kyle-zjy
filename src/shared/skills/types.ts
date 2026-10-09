// How a scenario dresses the core abilities. An adapter gives an ability its
// name and description in that scenario and, only where the scenario's own
// rules must take part, a behaviour that replaces part of the core mechanics.
import type { CoreSkill, CoreSkillCategory, CoreSkillId } from "./core/types.ts";

/** The visual a skill use plays (cue icon and tone); one per family by default. */
export const SKILL_VFX = ["DICE", "EYE", "SHIELD", "SWAP", "SPARK", "CHAIN", "STRIKE", "CLOCK"] as const;
export type SkillVfx = (typeof SKILL_VFX)[number];

export type SkillBehaviour = Partial<Pick<CoreSkill, "type" | "effects" | "trigger" | "target" | "requires" | "count">>;

export type SkillAdapter = {
  name: string;
  description: string;
  vfx?: SkillVfx;
  /** Only for abilities whose form in this scenario goes through its own rules. */
  behaviour?: SkillBehaviour;
};

export type SkillAdapters = Record<CoreSkillId, SkillAdapter>;

export type ScenarioSkillSet = {
  scenario: string;
  adapters: SkillAdapters;
  vfxByCategory: Record<CoreSkillCategory, SkillVfx>;
};
