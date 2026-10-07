// How the aquarius abilities appear in scenario 01 (00:17, train N13): the name and
// description players read. Mechanics come from the core ability.
import type { SkillAdapters } from "../../../skills/types.ts";

export const AQUARIUS: SkillAdapters = {
  // aquarius-intj
  RULE_01: {
    name: "Rewrite the Rules",
    description: "Choose one rule change for this round: +1 to every roll, +1 action point for everyone, or Fate can add up to 3 to a roll.",
  },
  // aquarius-intp
  REROLL_07: {
    name: "Superposition",
    description: "One of your rolls produces two results. Choose which one counts before it resolves.",
  },
  // aquarius-entj
  GAIN_RESOURCE_44: { name: "System Update", description: "Next round, a random rule change applies to everyone." },
  // aquarius-entp
  CONTROL_EVENT_14: {
    name: "Throw an Error",
    description: "When a public event is revealed, every loss or Collapse rise it causes is 1 smaller.",
  },
  // aquarius-infj
  MODIFY_RESULT_08: { name: "Time Cache", description: "See the value of your next roll in advance." },
  // aquarius-infp
  SHIELD_19: {
    name: "Not From Here",
    description: "You will shrug off the next negative effect that hits most of the table.",
  },
  // aquarius-enfj
  EMPOWER_05: { name: "Patch", description: "Give a chosen player a random small positive status." },
  // aquarius-enfp
  COPY_EFFECT_08: {
    name: "Anything Goes",
    description: "Draw a random legal ability from the copyable pool of all 192 characters and use it at once.",
  },
  // aquarius-istj
  SWAP_STATE_10: {
    name: "Version Rollback",
    description: "Restore your ordinary statuses to how they were at the end of last round.",
  },
  // aquarius-isfj
  SHIELD_20: { name: "Access Denied", description: "Refuse one ordinary ability another player uses directly on you." },
  // aquarius-estj
  REMOVE_STATUS_04: { name: "Hard Reboot", description: "Clear every ongoing status in play that is allowed to be cleared." },
  // aquarius-esfj
  BIND_07: {
    name: "Auto Mesh",
    description: "Three random players are bonded this round. The first reward any of them gains pays each of the others 1 Fate.",
  },
  // aquarius-istp
  SHIELD_21: {
    name: "Go Offline",
    description: "For the rest of this round, ordinary effects from other players can't touch you.",
  },
  // aquarius-isfp
  COPY_EFFECT_09: { name: "Random Skin", description: "Copy one buff a chosen player has, for one round." },
  // aquarius-estp
  REROLL_08: { name: "Hack", description: "Force a player to reroll one of their ordinary rolls." },
  // aquarius-esfp
  RESTORE_SKILL_03: {
    name: "Server Rave",
    description: "This round, several players' unused active abilities are randomly reassigned. Ownership returns next round.",
  },
};
