// How the taurus abilities appear in scenario 01 (00:17, train N13): the name and
// description players read. Mechanics come from the core ability.
import type { SkillAdapters } from "../../../skills/types.ts";

export const TAURUS: SkillAdapters = {
  // taurus-intj
  GAIN_RESOURCE_06: {
    name: "Long-Term Investment",
    description: "Set something aside: at the start of next round, gain 2 Fate.",
  },
  // taurus-intp
  GAIN_RESOURCE_07: { name: "Weigh the Value", description: "Look at two random boons and take one of them." },
  // taurus-entj
  GAIN_RESOURCE_08: {
    name: "Requisition",
    description: "Take 1 Fate from each of two players who have some. Nobody can be taken below 0.",
  },
  // taurus-entp
  CHALLENGE_03: {
    name: "Double Down",
    description: "Bet on your next roll: on a success, gain 2 extra Fate; on a failure, lose 1 Fate.",
  },
  // taurus-infj
  SHIELD_03: {
    name: "Root Shelter",
    description: "You and a chosen player each become immune to the next negative effect.",
  },
  // taurus-infp
  EMPOWER_01: { name: "Can't Let Go", description: "When one of your buffs is about to end, it lasts one more round." },
  // taurus-enfj
  GAIN_RESOURCE_09: {
    name: "Shared Harvest",
    description: "When you gain a reward, give 1 Fate to another player and gain 1 extra yourself.",
  },
  // taurus-enfp
  GAIN_RESOURCE_10: { name: "Surprise Stock", description: "Gain one random single-use item." },
  // taurus-istj
  GAIN_RESOURCE_11: {
    name: "Steady Reserves",
    description: "After two rounds in a row without receiving a negative effect, gain 2 Fate.",
  },
  // taurus-isfj
  GAIN_RESOURCE_12: { name: "Emergency Rations", description: "When your Fate drops to 0, recover 1 Fate." },
  // taurus-estj
  GAIN_RESOURCE_13: {
    name: "Settlement Day",
    description: "Choose a player. All of their delayed rewards that are already due pay out now.",
  },
  // taurus-esfj
  GAIN_RESOURCE_14: {
    name: "Something for Everyone",
    description: "When you gain a reward, the player with the least Fate gains 1 Fate.",
  },
  // taurus-istp
  REMOVE_STATUS_01: {
    name: "Harden",
    description: "Remove one ordinary negative status from yourself or a player in your carriage.",
  },
  // taurus-isfp
  GAIN_RESOURCE_15: { name: "Slow Growth", description: "Gain 1 Fate now, and 1 more at the start of next round." },
  // taurus-estp
  GAIN_RESOURCE_16: {
    name: "Quit While Ahead",
    description: "When another player gains 2 or more Fate at once, you gain 1 Fate.",
  },
  // taurus-esfp
  GAIN_RESOURCE_17: { name: "Open the Granary", description: "You and two other random players each gain 1 Fate." },
};
