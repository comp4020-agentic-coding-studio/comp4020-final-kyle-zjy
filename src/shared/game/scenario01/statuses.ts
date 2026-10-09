// Player-facing names for statuses: `short` for chips, `long` for the log.
export const STATUSES: Record<string, { short: string; long: string }> = {
  STATIC: { short: "Static −1", long: "Static (−1 to rolls)" },
  REPAIR_BONUS: { short: "Old Key +2", long: "Old Key (+2 to next repair)" },
  INVESTIGATE_BONUS: { short: "Flashlight +2", long: "Flashlight (+2 to next investigation)" },
  PASS: { short: "Passenger Pass", long: "Passenger Pass" },
  TEMP_PASS: { short: "Temporary Pass", long: "Temporary Pass" },
  ADVANTAGE: { short: "Roll twice", long: "Blank Ticket (roll twice)" },
  FATE_LOCKED: { short: "Fate locked", long: "Locked Fate" },
  IMMUNE_NEGATIVE: { short: "Immune", long: "Immunity" },
  IMMUNE_GROUP: { short: "Not From Here", long: "Not From Here (immune to group effects)" },
  IMMUNE_ABILITY: { short: "Firewall", long: "Firewall (refuses direct abilities)" },
  UNTARGETABLE: { short: "Untargetable", long: "Untargetable" },
  SHIELD_NEXT_ROUND: { short: "Shield next round", long: "Prepared Shield" },
  CHILL: { short: "Chill −1 AP", long: "Chill (−1 action point next round)" },
  TEMPORAL_LAG: { short: "Temporal lag −1 AP", long: "Temporal lag (−1 action point next cycle, minimum 1)" },
  FIELD_FOCUS: { short: "Field focus +2", long: "Field focus (+2 to the next rolled non-scan action this cycle)" },
  TEMPORAL_ALIGNMENT: { short: "Temporal Alignment · Next Time Jump costs 1 AP", long: "Temporal Alignment (next Time Jump costs 1 AP)" },
  TAUNT: { short: "Taunt", long: "Taunt (hostile effects aim here first)" },
  MARKED: { short: "Marked", long: "Marked" },
  REROLL_NEXT_FAILURE: { short: "Reroll next failure", long: "Quiet Warning (reroll next failure)" },
  SAFETY_ROPE: { short: "Safety rope", long: "Safety Rope (next failure costs nothing)" },
  DOUBLE_NEXT_ROLL: { short: "Next roll ×2", long: "Doubled (next roll's rewards count twice)" },
  ALL_IN: { short: "All in", long: "All In (next roll's rewards and penalties count twice)" },
  WAGER: { short: "Bet placed", long: "Bet (next roll pays or costs extra)" },
  FORBIDDEN_TARGET: { short: "Restrained", long: "Restrained (next ability can't target its source)" },
  BONUS_NEXT_REWARD: { short: "Next reward +1", long: "Marked for Luck (+1 Fate on next reward)" },
  RANDOM_BUFF: { short: "Patched +1", long: "Patched (+1 to next roll)" },
  RANDOM_DEBUFF: { short: "Unsettled −1", long: "Unsettled (−1 to next roll)" },
};

const fallback = (kind: string) => kind.toLowerCase().replace(/_/g, " ");
export const statusShort = (kind: string): string => STATUSES[kind]?.short ?? fallback(kind);
export const statusLong = (kind: string): string => STATUSES[kind]?.long ?? fallback(kind);
