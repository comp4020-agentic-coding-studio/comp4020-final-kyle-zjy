// The few abilities whose scenario-01 wording names the train. Everything
// else reads the same in the city. Pisces ENTP's train form is a scenario-01
// behaviour (a ticket-check pass); here it is its plain core: a shield.
// docs/skill-mapping-notes.md keeps what each was, what it is here, and why.
import type { CharacterId } from "../../characters/types.ts";

export const S02_SKILL_TEXT: Partial<Record<CharacterId, { name: string; description: string }>> = {
  "aries-istj": { name: "First-Move Discipline", description: "If you are the first player to succeed on a roll this round, gain 1 extra Fate." },
  "aries-isfp": { name: "Go With Your Gut", description: "The city offers two random instant boons. Choose one." },
  "taurus-istp": { name: "Harden", description: "Remove one ordinary negative status from yourself or a player in your zone." },
  "leo-entj": { name: "Do As I Say", description: "Choose a player. They move one zone toward you." },
  "capricorn-istp": { name: "Hold the Line", description: "Lock your current Fate. It can't be reduced for the rest of this round." },
  "pisces-entp": { name: "Brave Face", description: "Gain a shield that blocks the next negative effect on you." },
};
