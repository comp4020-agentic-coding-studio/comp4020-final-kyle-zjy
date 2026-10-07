// Core abilities of the RESTORE_SKILL family. Mechanics only: no names, no scenario objects.
import type { CoreSkill } from "./types.ts";

export const RESTORE_SKILL: CoreSkill[] = [
  {
    id: "RESTORE_SKILL_01",
    category: "RESTORE_SKILL",
    type: "REACTION",
    maxUses: 1,
    copyable: true,
    tags: ["ability", "restore", "support"],
    trigger: { on: "SKILL_USED_BY_OTHER", condition: "FIZZLED" },
    target: "TRIGGER_SOURCE",
    effects: [{ kind: "RESTORE_SKILL", who: "TRIGGER_SOURCE", onlyIfNoEffect: true }],
  },
  {
    id: "RESTORE_SKILL_02",
    category: "RESTORE_SKILL",
    type: "ACTIVE",
    maxUses: 1,
    copyable: false,
    tags: ["restore", "fate"],
    trigger: { on: "OWN_TURN" },
    target: "OTHER_PLAYER",
    requires: "TARGET_ABILITY_BURNED",
    effects: [{ kind: "RESTORE_SKILL", who: "TARGET", cost: { fate: 1 } }],
  },
  {
    id: "RESTORE_SKILL_03",
    category: "RESTORE_SKILL",
    type: "ACTIVE",
    maxUses: 1,
    copyable: false,
    tags: ["chaos", "group"],
    trigger: { on: "OWN_TURN" },
    target: "ALL_PLAYERS",
    effects: [{ kind: "SHUFFLE_SKILLS", scope: "UNUSED_ACTIVE", rounds: 1 }],
  },
];
