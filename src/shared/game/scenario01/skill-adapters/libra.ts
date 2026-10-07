// How the libra abilities appear in scenario 01 (00:17, train N13): the name and
// description players read. Mechanics come from the core ability.
import type { SkillAdapters } from "../../../skills/types.ts";

export const LIBRA: SkillAdapters = {
  // libra-intj
  SWAP_STATE_05: { name: "Level Out", description: "Choose two players. Close the Fate gap between them by up to 2." },
  // libra-intp
  REROLL_05: {
    name: "Take the Mean",
    description: "After one of your rolls, roll a second time and use the average of both results, rounded up.",
  },
  // libra-entj
  GAIN_RESOURCE_31: {
    name: "Redistribute",
    description: "Move 1 Fate from the player with the most Fate to the player with the least.",
  },
  // libra-entp
  REROLL_06: { name: "Objection", description: "After a public group roll, everyone rolls again before it counts." },
  // libra-infj
  SHIELD_11: { name: "Reconcile", description: "Choose two players. Each is cleared of one ordinary negative status." },
  // libra-infp
  RETALIATE_02: {
    name: "No Fighting",
    description: "When another player's ability would harm you, it is cancelled and you each gain 1 Fate instead.",
  },
  // libra-enfj
  SWAP_STATE_06: { name: "Re-Pair", description: "Swap two legal bonds between players." },
  // libra-enfp
  BIND_02: {
    name: "Random Match",
    description: "Bond two random players. This round, the first time either of them succeeds, the other gains 1 Fate.",
  },
  // libra-istj
  COPY_EFFECT_04: {
    name: "Equal Reward",
    description: "When a player gains a reward, the player with the least Fate gains the same (up to 2 Fate, or the same item).",
  },
  // libra-isfj
  RETALIATE_03: { name: "Settle Down", description: "Cancel one attempt by a player to take Fate from another player." },
  // libra-estj
  SWAP_STATE_07: {
    name: "Forced Balance",
    description: "The player with the most Fate loses 1, and the player with the least gains 1.",
  },
  // libra-esfj
  BIND_03: {
    name: "Say Something Nice",
    description: "Choose two players. If they both help each other successfully this round, they each gain 1 Fate.",
  },
  // libra-istp
  SHIELD_12: {
    name: "Void Call",
    description: "When an ability that would take Fate, Sanity or items from a player is declared, cancel it.",
  },
  // libra-isfp
  CONTROL_EVENT_07: { name: "Choose Peace", description: "When a public event is revealed, step out of it and gain 1 Fate." },
  // libra-estp
  CHALLENGE_12: {
    name: "Fair Duel",
    description: "Choose two players to roll at the same time. The higher roll gains 2 Fate; on a tie, each gains 1.",
  },
  // libra-esfp
  CHALLENGE_13: {
    name: "Put It to a Vote",
    description: "When an everyone-chooses event is revealed, it is settled by a vote instead: the majority's choice applies to everyone.",
  },
};
