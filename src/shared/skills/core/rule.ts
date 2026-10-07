// Core abilities of the RULE family. Mechanics only: no names, no scenario objects.
import type { CoreSkill } from "./types.ts";

export const RULE: CoreSkill[] = [
  {
    id: "RULE_01",
    category: "RULE",
    type: "ACTIVE",
    maxUses: 1,
    copyable: true,
    tags: ["rules"],
    trigger: { on: "OWN_TURN" },
    target: "NONE",
    effects: [{ kind: "MODIFY_RULE", rule: "CHOSEN_NUMERIC_RULE", delta: 1, rounds: 1 }],
  },
];
