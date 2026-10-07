// Core abilities of the MOVE family. Mechanics only: no names, no scenario objects.
import type { CoreSkill } from "./types.ts";

export const MOVE: CoreSkill[] = [
  {
    id: "MOVE_01",
    category: "MOVE",
    type: "ACTIVE",
    maxUses: 1,
    copyable: true,
    tags: ["control"],
    trigger: { on: "OWN_TURN" },
    target: "OTHER_PLAYER",
    effects: [{ kind: "MOVE_PLAYER", who: "TARGET", to: "TOWARD_SELF" }],
  },
];
