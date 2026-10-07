// How the cancer abilities appear in scenario 01 (00:17, train N13): the name and
// description players read. Mechanics come from the core ability.
import type { SkillAdapters } from "../../../skills/types.ts";

export const CANCER: SkillAdapters = {
  // cancer-intj
  SHIELD_04: {
    name: "Safe House",
    description: "Choose a player. This round, they can't be the target of other players' negative active abilities.",
  },
  // cancer-intp
  SHIELD_05: {
    name: "Into the Shell",
    description: "Give up the rest of your actions this round. You are immune to negative effects until the round ends.",
  },
  // cancer-entj
  SHIELD_06: {
    name: "Close Ranks",
    description: "When a teammate receives a negative effect, cancel it. You gain 1 Fate.",
  },
  // cancer-entp
  RETALIATE_01: {
    name: "Now You Feel It",
    description: "When a player gives you a negative status, they receive a weaker version of it too.",
  },
  // cancer-infj
  PREVIEW_EVENT_03: {
    name: "Mood Forecast",
    description: "Learn whether next round's public event leans toward reward, crisis or a mix.",
  },
  // cancer-infp
  GAIN_RESOURCE_18: { name: "A Hug", description: "You and the player with the least Fate each gain 1 Fate." },
  // cancer-enfj
  GAIN_RESOURCE_19: {
    name: "One Family",
    description: "Form a temporary group of up to three players. This round, each group member's first reward gains +1.",
  },
  // cancer-enfp
  REMOVE_STATUS_02: { name: "Cheer Up", description: "Clear one ordinary negative status from a random player." },
  // cancer-istj
  GAIN_RESOURCE_20: {
    name: "House Rules",
    description: "After two rounds in a row without actively attacking another player, gain 2 Fate.",
  },
  // cancer-isfj
  SHIELD_07: { name: "Tuck In", description: "Give a player one shield." },
  // cancer-estj
  SHIELD_08: {
    name: "Come Home",
    description: "When an ability that would move Fate, items or statuses between players is declared, cancel it.",
  },
  // cancer-esfj
  GAIN_RESOURCE_21: { name: "Nobody Left Out", description: "The two players with the least Fate each gain 1 Fate." },
  // cancer-istp
  SWAP_STATE_04: {
    name: "Swap Shells",
    description: "When a negative effect is aimed at you, give up one of your buffs to cancel it.",
  },
  // cancer-isfp
  GAIN_RESOURCE_22: {
    name: "Soft Response",
    description: "When another player helps you, you and that player each gain 1 Fate.",
  },
  // cancer-estp
  REROLL_02: { name: "Pull You Back", description: "When another player fails a roll, let them reroll it immediately." },
  // cancer-esfp
  GAIN_RESOURCE_23: {
    name: "Rising Tide",
    description: "Choose three random players. This round, the first reward each of them gains is +1.",
  },
};
