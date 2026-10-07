// How the gemini abilities appear in scenario 01 (00:17, train N13): the name and
// description players read. Mechanics come from the core ability.
import type { SkillAdapters } from "../../../skills/types.ts";

export const GEMINI: SkillAdapters = {
  // gemini-intj
  SWAP_STATE_01: { name: "Identity Swap", description: "Swap one swappable temporary status with a chosen player." },
  // gemini-intp
  COPY_EFFECT_01: {
    name: "Copy the Code",
    description: "Copy the effect of the ability the previous player just used successfully, if it can be copied.",
  },
  // gemini-entj
  CHALLENGE_04: {
    name: "Parallel Tasks",
    description: "Two chosen players each make a quick roll. You choose which result counts; it resolves as an Investigate where that player stands.",
  },
  // gemini-entp
  CONTROL_EVENT_02: {
    name: "I Never Said That",
    description: "When everyone has answered a vote or choice, you may change your own answer before it settles.",
  },
  // gemini-infj
  PREVIEW_EVENT_02: { name: "Read the Channel", description: "Look at one of a chosen player's hidden statuses." },
  // gemini-infp
  CONTROL_EVENT_03: { name: "The Other Way", description: "When an either-or event is revealed, you decide it for everyone." },
  // gemini-enfj
  SWAP_STATE_02: { name: "Rewire", description: "Swap the current bonds of two legal players." },
  // gemini-enfp
  CONTROL_EVENT_04: { name: "Change the Channel", description: "When a replaceable random event appears, generate it again." },
  // gemini-istj
  MODIFY_RESULT_02: {
    name: "Backup Copy",
    description: "Record one of your successful rolls. Later, you can replace one of your ordinary rolls with that result.",
  },
  // gemini-isfj
  EMPOWER_02: { name: "Quiet Warning", description: "Choose a player. The next time they fail, they may reroll once." },
  // gemini-estj
  CHANGE_TURN_ORDER_01: {
    name: "Reorder",
    description: "Choose up to three players. Next round they act first, in the order you chose.",
  },
  // gemini-esfj
  COPY_EFFECT_02: {
    name: "Spread the Word",
    description: "When a player gains a buff, another legal player gains a weaker version of it.",
  },
  // gemini-istp
  HINDER_01: { name: "Snatch", description: "When another player gains an item as a reward, take it from them." },
  // gemini-isfp
  COPY_EFFECT_03: { name: "Become You", description: "Copy one copyable buff a chosen player has, for one round." },
  // gemini-estp
  SWAP_STATE_03: {
    name: "Switcheroo",
    description: "When a roll is about to resolve, it takes the best result anyone has rolled this round.",
  },
  // gemini-esfp
  CHALLENGE_05: {
    name: "All-Channel Broadcast",
    description: "Every player makes a quick secret choice at the same time. Players in the minority gain a reward.",
  },
};
