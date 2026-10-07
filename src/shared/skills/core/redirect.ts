// Core abilities of the REDIRECT family. Mechanics only: no names, no scenario objects.
import type { CoreSkill } from "./types.ts";

export const REDIRECT: CoreSkill[] = [
  {
    id: "REDIRECT_01",
    category: "REDIRECT",
    type: "REACTION",
    maxUses: 1,
    copyable: true,
    tags: ["defence", "redirect"],
    trigger: { on: "NEGATIVE_EFFECT_TARGETS_SELF" },
    target: "RANDOM_PLAYERS",
    effects: [{ kind: "REDIRECT", to: "RANDOM_LEGAL" }],
  },
  {
    id: "REDIRECT_02",
    category: "REDIRECT",
    type: "REACTION",
    maxUses: 1,
    copyable: true,
    tags: ["defence", "protect", "redirect"],
    trigger: { on: "NEGATIVE_EFFECT_TARGETS_ANY", others: true },
    target: "TRIGGER_SOURCE",
    effects: [{ kind: "REDIRECT", to: "SELF" }, { kind: "REDUCE_EFFECT", levels: 1 }],
  },
  {
    id: "REDIRECT_03",
    category: "REDIRECT",
    type: "REACTION",
    maxUses: 1,
    copyable: true,
    tags: ["rules", "redirect"],
    trigger: { on: "TARGETED_ABILITY_DECLARED", others: true },
    target: "TRIGGER_SOURCE",
    effects: [{ kind: "DICTATE_TARGET", who: "TRIGGER_SOURCE", action: "RETARGET_NOW" }],
  },
];
