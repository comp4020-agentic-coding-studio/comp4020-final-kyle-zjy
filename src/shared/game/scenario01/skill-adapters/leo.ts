// How the leo abilities appear in scenario 01 (00:17, train N13): the name and
// description players read. Mechanics come from the core ability.
import type { SkillAdapters } from "../../../skills/types.ts";

export const LEO: SkillAdapters = {
  // leo-intj
  CONTROL_EVENT_05: { name: "Lead Role", description: "You alone decide the next public event that asks for a choice." },
  // leo-intp
  GAIN_RESOURCE_24: {
    name: "Hidden Protagonist",
    description: "If no other player targets you this round, gain 2 Fate at the end of the round.",
  },
  // leo-entj
  MOVE_01: { name: "Do As I Say", description: "Choose a player. They move one carriage toward you." },
  // leo-entp
  CHALLENGE_06: {
    name: "Try Me",
    description: "Challenge any player to roll at the same time as you. The higher result gains 2 Fate.",
  },
  // leo-infj
  GAIN_RESOURCE_25: { name: "Spotlight Prophecy", description: "Choose a player. Their next roll's rewards are doubled." },
  // leo-infp
  GAIN_RESOURCE_26: {
    name: "Shine Alone",
    description: "When you are the only player who gains from a public event, gain 1 extra Fate.",
  },
  // leo-enfj
  EMPOWER_03: {
    name: "Eyes on Me",
    description: "This round, hostile effects that could target you aim at you first. You also gain one shield.",
  },
  // leo-enfp
  CONTROL_EVENT_06: {
    name: "Encore",
    description: "After you succeed on a roll two rounds running, draw an extra reward event for yourself.",
  },
  // leo-istj
  GAIN_RESOURCE_27: { name: "Record of Deeds", description: "On your third successful roll this run, gain 3 extra Fate." },
  // leo-isfj
  SHIELD_09: { name: "Protect the Crown", description: "Cancel a negative effect on another player. You gain 1 Fate." },
  // leo-estj
  CHANGE_TURN_ORDER_02: {
    name: "Fall In",
    description: "Everyone who hasn't acted yet this round goes in order of least Fate first.",
  },
  // leo-esfj
  GAIN_RESOURCE_28: {
    name: "Applause",
    description: "A chosen player gains 1 Fate. If another player also helped them this round, you gain 1 Fate too.",
  },
  // leo-istp
  MODIFY_RESULT_03: { name: "Grand Entrance", description: "Your first failure this run counts as an ordinary success instead." },
  // leo-isfp
  HINDER_02: {
    name: "Graceful Exit",
    description: "When you gain a reward, give 1 Fate back. Your next roll's rewards are doubled.",
  },
  // leo-estp
  CHALLENGE_07: { name: "Duel", description: "Call out a player for a contest roll against you. The winner gains 2 Fate." },
  // leo-esfp
  CHALLENGE_08: {
    name: "Centre of Attention",
    description: "Every player votes for one player. That player and you each gain 2 Fate.",
  },
};
