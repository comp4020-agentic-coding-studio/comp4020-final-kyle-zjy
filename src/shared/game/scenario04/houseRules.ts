import type { AuctionState04, HouseRuleId04 } from "./types.ts";

export const SHUFFLED_HOUSE_RULES04: readonly HouseRuleId04[] = [
  "anonymousSeat", "doubleRaise", "creditNight", "holdingDisclosure",
  "houseChallenge", "transparentTrade", "singleRaise", "creditFreeze",
];

/** Old saved auctions have no schedule and keep their original rules. */
export function houseRuleAt04(auction: Pick<AuctionState04, "houseRuleOrder"> | null | undefined, round: number): HouseRuleId04 | null {
  return auction?.houseRuleOrder?.[round - 1] ?? null;
}
