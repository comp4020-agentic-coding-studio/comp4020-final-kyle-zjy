// How the scorpio abilities appear in scenario 01 (00:17, train N13): the name and
// description players read. Mechanics come from the core ability.
import type { SkillAdapters } from "../../../skills/types.ts";

export const SCORPIO: SkillAdapters = {
  // scorpio-intj
  BIND_04: {
    name: "Hidden Thread",
    description: "Secretly choose another player. The next time they gain a reward, you gain 1 Fate.",
  },
  // scorpio-intp
  PREVIEW_EVENT_05: { name: "Crack It", description: "See the next public event in full." },
  // scorpio-entj
  SHIELD_13: { name: "Dominate", description: "Choose another player. Their next active ability can't target you." },
  // scorpio-entp
  RETALIATE_04: {
    name: "Backbite",
    description: "After another player puts a negative effect on you, make that player take a risk roll.",
  },
  // scorpio-infj
  PREVIEW_EVENT_06: { name: "Death Omen", description: "Look ahead at the next major penalty public event of this run." },
  // scorpio-infp
  GAIN_RESOURCE_32: {
    name: "Hold a Grudge",
    description: "The first player to attack you is remembered. If you later help that player, gain 2 Fate.",
  },
  // scorpio-enfj
  BIND_05: {
    name: "Blood Pact",
    description: "Secretly name an ally. The first time you have helped each other, you each gain 2 Fate.",
  },
  // scorpio-enfp
  SWAP_STATE_08: { name: "Trade Secrets", description: "Two random players swap one hidden status that can be swapped." },
  // scorpio-istj
  RETALIATE_05: {
    name: "On Record",
    description: "When another player's ability hurts you, it still lands, and the same effect hits them too.",
  },
  // scorpio-isfj
  EMPOWER_04: {
    name: "Thorn Guard",
    description: "Protect a player. This round, the first player to attack them loses 1 Fate.",
  },
  // scorpio-estj
  CHALLENGE_14: {
    name: "Reckoning",
    description: "The player who has attacked other players most often this run takes an extra risk roll.",
  },
  // scorpio-esfj
  BIND_06: {
    name: "Secret Alliance",
    description: "Two random pairs are secretly bonded for 3 rounds. The first time a partner succeeds on a roll, the other gains 1 Fate.",
  },
  // scorpio-istp
  SHIELD_14: {
    name: "Vanish",
    description: "For the rest of this round, other players' active abilities can't target you.",
  },
  // scorpio-isfp
  GAIN_RESOURCE_33: { name: "Leave a Mark", description: "Mark a player. Their next legal reward gives 1 extra Fate." },
  // scorpio-estp
  COPY_EFFECT_05: {
    name: "Intercept",
    description: "When another player gains a reward, you gain the same (up to 2 Fate, or the same item).",
  },
  // scorpio-esfp
  SWAP_STATE_09: {
    name: "Reversal Party",
    description: "The players with the most and the least Fate swap one temporary status.",
  },
};
