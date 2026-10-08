// Which ending text a finished run shows, keyed the way scenarioText().endings is.
import type { EndingKey } from "../../shared/i18n/content-types.ts";
import type { FailReason, Outcome } from "../../shared/game/state.ts";

export function endingKey(outcome: Outcome, reason: FailReason | null): EndingKey {
  // scenario 02 shows each player's own ending, not a shared one
  if (outcome === "S02_EVACUATED") throw new Error("scenario 02 has no shared ending text");
  if (outcome !== "FAILED") return outcome;
  return reason === "COLLAPSE" ? "FAILED_COLLAPSE" : reason === "ALL_LOST" ? "FAILED_ALL_LOST" : "FAILED_TIME";
}

export const endingWon = (outcome: Outcome): boolean => outcome !== "FAILED";
