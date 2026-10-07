// Core abilities of the HINDER family. Mechanics only: no names, no scenario objects.
import type { CoreSkill } from "./types.ts";

export const HINDER: CoreSkill[] = [
  {
    id: "HINDER_01",
    category: "HINDER",
    type: "REACTION",
    maxUses: 1,
    copyable: true,
    tags: ["item", "steal"],
    trigger: { on: "PLAYER_GAINS_REWARDS", others: true },
    target: "TRIGGER_SOURCE",
    requires: "REWARD_IS_ITEM",
    effects: [{ kind: "STEAL_ITEM", from: "TRIGGER_SUBJECT", transferableOnly: true }],
  },
  {
    id: "HINDER_02",
    category: "HINDER",
    type: "REACTION",
    maxUses: 1,
    copyable: true,
    tags: ["reward", "delay"],
    trigger: { on: "SELF_GAINS_REWARD" },
    target: "SELF",
    effects: [{ kind: "LOSE_FATE", who: "SELF", amount: 1 }, { kind: "DOUBLE_REWARD", who: "SELF", next: "REWARD" }],
  },
  {
    id: "HINDER_03",
    category: "HINDER",
    type: "ACTIVE",
    maxUses: 1,
    copyable: true,
    tags: ["fate", "punish"],
    trigger: { on: "OWN_TURN" },
    target: "OTHER_PLAYER",
    requires: "TARGET_ATTACKED_TWICE_THIS_ROUND",
    effects: [{ kind: "LOSE_FATE", who: "TARGET", amount: 1 }],
  },
];
