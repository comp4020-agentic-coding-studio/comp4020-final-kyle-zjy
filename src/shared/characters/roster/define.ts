// Authoring helper for the roster files: a character is a type, a title and
// the id of its core ability (src/shared/skills/core).
import type { RosterEntry } from "../types.ts";

export const entry = (mbti: RosterEntry["mbti"], title: string, coreSkillId: string): RosterEntry => ({ mbti, title, coreSkillId });
