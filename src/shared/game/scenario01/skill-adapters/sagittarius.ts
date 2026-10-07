// How the sagittarius abilities appear in scenario 01 (00:17, train N13): the name and
// description players read. Mechanics come from the core ability.
import type { SkillAdapters } from "../../../skills/types.ts";

export const SAGITTARIUS: SkillAdapters = {
  // sagittarius-intj
  TASK_01: {
    name: "Long-Range Plan",
    description: "Draw a goal for this round and the next. If you meet it, gain 2 Fate.",
  },
  // sagittarius-intp
  CONTROL_EVENT_08: { name: "Into the Unknown", description: "Choose one of three hidden random events and open it." },
  // sagittarius-entj
  CONTROL_EVENT_09: { name: "Move Out", description: "Choose two players to join you in an extra multiplayer event." },
  // sagittarius-entp
  CHALLENGE_15: {
    name: "High or Low",
    description: "Bet on your next roll: on a success, gain 3 extra Fate; on a failure, lose 1 Fate.",
  },
  // sagittarius-infj
  PREVIEW_EVENT_07: { name: "See Further", description: "Look at the types of the next three public events." },
  // sagittarius-infp
  CONTROL_EVENT_10: {
    name: "Free Route",
    description: "When a public event is revealed, step out of it and draw an extra event for yourself instead.",
  },
  // sagittarius-enfj
  COPY_EFFECT_06: {
    name: "Come Along",
    description: "When you gain a reward, a chosen player gains the same (up to 2 Fate, or the same item).",
  },
  // sagittarius-enfp
  CONTROL_EVENT_11: { name: "Random Warp", description: "Draw an extra group-roll event for yourself." },
  // sagittarius-istj
  GAIN_RESOURCE_34: {
    name: "Check In",
    description: "Succeed on three different kinds of roll (Investigate, Search, Repair, Confront) and gain 2 Fate.",
  },
  // sagittarius-isfj
  GAIN_RESOURCE_35: { name: "Supply Pack", description: "Give yourself or a teammate one random single-use buff." },
  // sagittarius-estj
  CONTROL_EVENT_12: {
    name: "New Map",
    description: "Replace the current public event, if it can be replaced, with an event from a different category.",
  },
  // sagittarius-esfj
  CHALLENGE_16: {
    name: "Group Tour",
    description: "Choose up to three players to roll together. If their total reaches 4 per player, each of them gains 1 Fate.",
  },
  // sagittarius-istp
  SHIELD_15: { name: "Bail Out", description: "When you fail a roll, take none of its penalty." },
  // sagittarius-isfp
  GAIN_RESOURCE_36: { name: "Capture the Moment", description: "Whenever you roll an extreme 1 or 6, gain 1 Fate." },
  // sagittarius-estp
  GAIN_RESOURCE_37: { name: "All In", description: "Your next roll counts double: rewards and penalties alike." },
  // sagittarius-esfp
  CONTROL_EVENT_13: {
    name: "Mystery Destination",
    description: "Split all players into two random groups, each entering a different small public event.",
  },
};
