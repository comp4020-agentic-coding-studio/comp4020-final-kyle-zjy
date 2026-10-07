// How the capricorn abilities appear in scenario 01 (00:17, train N13): the name and
// description players read. Mechanics come from the core ability.
import type { SkillAdapters } from "../../../skills/types.ts";

export const CAPRICORN: SkillAdapters = {
  // capricorn-intj
  TASK_02: {
    name: "Long-Term Goal",
    description: "Secretly draw a goal for the next three rounds. If you meet it, gain 3 Fate.",
  },
  // capricorn-intp
  MODIFY_RESULT_07: { name: "Optimal Route", description: "See the value of your next roll before you decide what to do." },
  // capricorn-entj
  TASK_03: {
    name: "KPI",
    description: "Set another player a goal. If they meet it by the end of next round, you and they each gain 1 Fate.",
  },
  // capricorn-entp
  RESTORE_SKILL_02: { name: "Leverage", description: "Spend 1 Fate to restore another player's ability that is already used." },
  // capricorn-infj
  SHIELD_16: { name: "Plan Ahead", description: "Place a single-use shield on yourself that is ready from next round." },
  // capricorn-infp
  GAIN_RESOURCE_38: {
    name: "Slow and Steady",
    description: "If you go two rounds in a row without using an active ability, gain 2 Fate.",
  },
  // capricorn-enfj
  GAIN_RESOURCE_39: {
    name: "Lend a Hand",
    description: "When the player with the least Fate succeeds on a roll, you and they each gain 1 extra Fate.",
  },
  // capricorn-enfp
  COPY_EFFECT_07: {
    name: "Career Change",
    description: "Draw a random active ability from a character of another sign and use it at once.",
  },
  // capricorn-istj
  GAIN_RESOURCE_40: {
    name: "Compound Interest",
    description: "After two successes in a row, your next success gains 1 extra Fate.",
  },
  // capricorn-isfj
  SHIELD_17: { name: "Safety Rope", description: "Choose a player. Their next failure costs them no resources." },
  // capricorn-estj
  CHALLENGE_17: {
    name: "Deadline",
    description: "Choose two players. Each makes a free Investigate roll now; whoever succeeds gains 1 extra Fate.",
  },
  // capricorn-esfj
  GAIN_RESOURCE_41: {
    name: "Team Building",
    description: "Once three different players have succeeded on a roll this round, gain 1 Fate.",
  },
  // capricorn-istp
  SHIELD_18: {
    name: "Fixed Anchor",
    description: "Lock your current Fate. It can't be reduced for the rest of this round.",
  },
  // capricorn-isfp
  GAIN_RESOURCE_42: {
    name: "Something to Show",
    description: "When one of your temporary buffs ends naturally, turn it into 1 Fate.",
  },
  // capricorn-estp
  CHALLENGE_18: {
    name: "Summit Push",
    description: "Challenge the player with the most Fate to a contest roll. If you win, gain 2 Fate.",
  },
  // capricorn-esfp
  GAIN_RESOURCE_43: {
    name: "Victory Party",
    description: "At the end of the round, the last player to succeed on a roll and you each gain 1 Fate.",
  },
};
