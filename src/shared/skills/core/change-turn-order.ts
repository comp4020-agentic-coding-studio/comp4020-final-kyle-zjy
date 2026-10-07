// Core abilities of the CHANGE_TURN_ORDER family. Mechanics only: no names, no scenario objects.
import type { CoreSkill } from "./types.ts";

export const CHANGE_TURN_ORDER: CoreSkill[] = [
  {
    id: "CHANGE_TURN_ORDER_01",
    category: "CHANGE_TURN_ORDER",
    type: "ACTIVE",
    maxUses: 1,
    copyable: true,
    tags: ["tempo", "turn-order"],
    trigger: { on: "OWN_TURN" },
    target: "UP_TO_THREE_PLAYERS",
    effects: [{ kind: "CHANGE_TURN_ORDER", scope: "NEXT_ROUND" }],
  },
  {
    id: "CHANGE_TURN_ORDER_02",
    category: "CHANGE_TURN_ORDER",
    type: "ACTIVE",
    maxUses: 1,
    copyable: true,
    tags: ["tempo", "turn-order"],
    trigger: { on: "OWN_TURN" },
    target: "NONE",
    effects: [{ kind: "CHANGE_TURN_ORDER", scope: "REMAINING_THIS_ROUND" }],
  },
];
