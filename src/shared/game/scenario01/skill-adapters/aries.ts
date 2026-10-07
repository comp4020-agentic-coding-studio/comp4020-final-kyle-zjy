// How the aries abilities appear in scenario 01 (00:17, train N13): the name and
// description players read. Mechanics come from the core ability.
import type { SkillAdapters } from "../../../skills/types.ts";

export const ARIES: SkillAdapters = {
  // aries-intj
  MODIFY_RESULT_01: {
    name: "Premeditated Charge",
    description: "After seeing your own roll, shift the result one tier in your favour.",
  },
  // aries-intp
  REROLL_01: {
    name: "Reignite",
    description: "After one of your rolls resolves, reroll it once. You must keep the second result.",
  },
  // aries-entj
  GAIN_RESOURCE_01: { name: "All-Out Charge", description: "Choose another player. You and they each gain 1 Fate." },
  // aries-entp
  REDIRECT_01: {
    name: "Pass the Blame",
    description: "When a single-target negative effect is aimed at you, pass it to another random legal player.",
  },
  // aries-infj
  PREVIEW_EVENT_01: { name: "Omen in the Flame", description: "Look at the type of the next public event before it appears." },
  // aries-infp
  SHIELD_01: {
    name: "Warm-Blooded Heart",
    description: "The first time you receive a negative effect, reduce its strength by one level.",
  },
  // aries-enfj
  BIND_01: {
    name: "Follow Me",
    description: "Bind yourself to another player. This round, whenever either of you gains Fate, the other gains 1.",
  },
  // aries-enfp
  CONTROL_EVENT_01: { name: "Sudden Sprint", description: "Immediately draw an extra small event for yourself." },
  // aries-istj
  GAIN_RESOURCE_02: {
    name: "First-Move Discipline",
    description: "If you are the first passenger to succeed on a roll this round, gain 1 extra Fate.",
  },
  // aries-isfj
  REDIRECT_02: {
    name: "Take the Hit",
    description: "Take a negative effect in place of any player, and reduce its strength.",
  },
  // aries-estj
  CHALLENGE_01: {
    name: "Forced Advance",
    description: "Choose a player. They immediately make a free Investigate roll where they stand.",
  },
  // aries-esfj
  GAIN_RESOURCE_03: { name: "Warm Everyone Up", description: "Choose two players. They each gain 1 Fate." },
  // aries-istp
  SHIELD_02: { name: "Precise Dodge", description: "Completely cancel one single-target negative effect aimed at you." },
  // aries-isfp
  GAIN_RESOURCE_04: { name: "Go With Your Gut", description: "The train offers two random instant boons. Choose one." },
  // aries-estp
  GAIN_RESOURCE_05: { name: "Jump the Gun", description: "Right after another player uses an ability, gain 1 action point." },
  // aries-esfp
  CHALLENGE_02: {
    name: "Heat Up the Room",
    description: "Every player makes a small roll. The highest roller and you each gain 1 Fate.",
  },
};
