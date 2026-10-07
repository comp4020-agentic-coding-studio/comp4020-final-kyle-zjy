// How the pisces abilities appear in scenario 01 (00:17, train N13): the name and
// description players read. Mechanics come from the core ability.
import type { SkillAdapters } from "../../../skills/types.ts";

export const PISCES: SkillAdapters = {
  // pisces-intj
  CONTROL_EVENT_15: {
    name: "Dream Script",
    description: "Decide whether your next random event leans towards a reward or a challenge.",
  },
  // pisces-intp
  PREVIEW_EVENT_08: {
    name: "Is This Real?",
    description: "Look at one hidden effect and decide whether it triggers as written.",
  },
  // pisces-entj
  CONTROL_EVENT_16: {
    name: "Shared Slumber",
    description: "Choose two players. They and you enter the same random event together.",
  },
  // pisces-entp
  EMPOWER_06: {
    name: "Fake Result",
    description: "Show the Inspector a fake result: your next ticket check passes whatever you roll.",
    behaviour: { effects: [{ kind: "ADD_STATUS", who: "SELF", status: "PASS", rounds: 99, polarity: "POSITIVE" }] },
  },
  // pisces-infj
  PREVIEW_EVENT_09: { name: "Dream Omen", description: "See the next public event in full." },
  // pisces-infp
  SHIELD_22: {
    name: "Five More Minutes",
    description: "After you fail a roll, take none of its penalty, and gain 1 extra action point next round.",
  },
  // pisces-enfj
  COPY_EFFECT_10: {
    name: "Shared Dream",
    description: "When a player gains a buff, give a weaker copy of it to another player.",
  },
  // pisces-enfp
  CONTROL_EVENT_17: {
    name: "Strange Dream",
    description: "When an event is revealed, randomly change its target, its reward or one non-core condition.",
  },
  // pisces-istj
  MODIFY_RESULT_09: {
    name: "Dream Log",
    description: "Your first successful roll is recorded. Later, you may use that result once in place of a roll.",
  },
  // pisces-isfj
  REMOVE_STATUS_05: { name: "Sleep Easy", description: "Clear one ordinary negative status from a chosen player." },
  // pisces-estj
  SHIELD_23: {
    name: "Wake Up",
    description: "End every rule change in play, and clear one ordinary negative status from each player.",
  },
  // pisces-esfj
  GAIN_RESOURCE_45: {
    name: "I Get You",
    description: "When the player with the least Fate gains a reward, you also gain 1 Fate.",
  },
  // pisces-istp
  CONTROL_EVENT_18: {
    name: "Dive",
    description: "Skip the current event if it can be skipped, and stay hidden until the next round begins.",
  },
  // pisces-isfp
  MODIFY_RESULT_10: { name: "Paint the Dream", description: "Turn one of your ordinary successes into a perfect success." },
  // pisces-estp
  CONTROL_EVENT_19: {
    name: "Ride the Dream",
    description: "Generate two legal events and take the one with the higher potential reward. You must accept its risk.",
  },
  // pisces-esfp
  EMPOWER_07: { name: "Everybody Dream", description: "Every player gains a different random temporary status." },
};
