// Authoring helpers for the roster files. Every skill is usable once unless it
// says otherwise, and copyable unless copying it would loop (copy-a-copy) or
// make no sense.
import type { RosterEntry, Skill } from "../types.ts";

type SkillInput = Omit<Skill, "maxUses" | "copyable"> & Partial<Pick<Skill, "maxUses" | "copyable">>;

export const defineSkill = (s: SkillInput): Skill => ({ maxUses: 1, copyable: true, ...s });

export const entry = (mbti: RosterEntry["mbti"], title: string, skill: SkillInput): RosterEntry => ({
  mbti,
  title,
  skill: defineSkill(skill),
});
