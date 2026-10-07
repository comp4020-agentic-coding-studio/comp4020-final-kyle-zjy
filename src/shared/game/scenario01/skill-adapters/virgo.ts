// How the virgo abilities appear in scenario 01 (00:17, train N13): the name and
// description players read. Mechanics come from the core ability.
import type { SkillAdapters } from "../../../skills/types.ts";

export const VIRGO: SkillAdapters = {
  // virgo-intj
  MODIFY_RESULT_04: {
    name: "Calibrate",
    description: "After one of your rolls resolves, raise it to the next higher result tier.",
  },
  // virgo-intp
  SHIELD_10: { name: "Debug", description: "When a public event is revealed, cancel it before it takes effect." },
  // virgo-entj
  REROLL_03: {
    name: "Standardise",
    description: "When a player fails a roll, have them redo the same kind of roll once.",
  },
  // virgo-entp
  REDIRECT_03: {
    name: "Technicality",
    description: "When another player declares an ability on someone, it has to go to a different legal target instead.",
  },
  // virgo-infj
  PREVIEW_EVENT_04: {
    name: "Advance Review",
    description: "Look at the next two public events and decide the order they appear in.",
  },
  // virgo-infp
  GAIN_RESOURCE_29: { name: "Small Joys", description: "When two of your rolls in a row are plain Successes, gain 1 Fate." },
  // virgo-enfj
  MODIFY_RESULT_05: {
    name: "Correct Your Form",
    description: "When a player fails a roll, turn that failure into an ordinary success.",
  },
  // virgo-enfp
  REROLL_04: {
    name: "Close Enough",
    description: "When you fail a roll, reroll it and keep the better of the two results.",
  },
  // virgo-istj
  GAIN_RESOURCE_30: {
    name: "Recheck",
    description: "Choose a player. Anything waiting for them in a later round (set-aside gains, a prepared shield) arrives now.",
  },
  // virgo-isfj
  RESTORE_SKILL_01: {
    name: "Plan B",
    description: "When a player's ability legally produces no effect at all, give them back that use.",
  },
  // virgo-estj
  HINDER_03: {
    name: "Penalty Notice",
    description: "Choose a player whose abilities hurt other players twice this round. They lose 1 Fate.",
  },
  // virgo-esfj
  CHALLENGE_09: {
    name: "Make-Up Work",
    description: "The player with the least Fate makes an extra small roll. On a success, they gain 1 Fate.",
  },
  // virgo-istp
  REMOVE_STATUS_03: { name: "Defuse", description: "Remove one ordinary lasting negative status from any player." },
  // virgo-isfp
  MODIFY_RESULT_06: {
    name: "Fine-Tune",
    description: "When one of your rolls comes out extreme, move it one tier toward the middle.",
  },
  // virgo-estp
  CHALLENGE_10: {
    name: "One More Time",
    description: "When a player succeeds, have them roll again. If they succeed again, you and they each gain 1 Fate.",
  },
  // virgo-esfp
  CHALLENGE_11: {
    name: "Take Two",
    description: "Call a vote. If the majority agrees, the next public event is thrown out and replaced.",
  },
};
