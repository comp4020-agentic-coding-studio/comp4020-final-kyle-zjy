// Core abilities of the TASK family. Mechanics only: no names, no scenario objects.
import type { CoreSkill } from "./types.ts";

export const TASK: CoreSkill[] = [
  {
    id: "TASK_01",
    category: "TASK",
    type: "ACTIVE",
    maxUses: 1,
    copyable: true,
    tags: ["task", "fate", "planning"],
    trigger: { on: "OWN_TURN" },
    target: "SELF",
    effects: [{ kind: "SET_TASK", who: "SELF", rounds: 1, reward: [{ kind: "GAIN_FATE", who: "SELF", amount: 2 }] }],
  },
  {
    id: "TASK_02",
    category: "TASK",
    type: "ACTIVE",
    maxUses: 1,
    copyable: true,
    tags: ["fate", "task", "secret"],
    trigger: { on: "OWN_TURN" },
    target: "SELF",
    effects: [
      {
        kind: "SET_TASK",
        who: "SELF",
        rounds: 3,
        reward: [{ kind: "GAIN_FATE", who: "SELF", amount: 3 }],
        secret: true,
      },
    ],
  },
  {
    id: "TASK_03",
    category: "TASK",
    type: "ACTIVE",
    maxUses: 1,
    copyable: true,
    tags: ["fate", "task", "support"],
    trigger: { on: "OWN_TURN" },
    target: "OTHER_PLAYER",
    effects: [
      {
        kind: "SET_TASK",
        who: "TARGET",
        rounds: 1,
        reward: [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }, { kind: "GAIN_FATE", who: "TARGET", amount: 1 }],
      },
    ],
  },
];
