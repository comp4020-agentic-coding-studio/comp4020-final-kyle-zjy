/** One starting Final Chip is lost for each two Debt, up to four. */
import type { AuctionPlayer04 } from "./types.ts";

export const GENUINE_ITEM_FINAL_VALUE04 = 2;

/** All item bonuses affect comparison only; a winner pays the submitted bid. */
export function finalBidModifier04(player: AuctionPlayer04): number {
  return (player.activeCrown ? 2 : 0) + (player.finalItemModifiers ?? []).reduce((sum, entry) => sum + entry.amount, 0);
}

export function debtPenalty04(debt: number): number {
  return Math.min(4, Math.floor(Math.max(0, debt) / 2));
}

export function debtTier04(debt: number): "none" | "light" | "medium" | "heavy" | "extreme" {
  return (["none", "light", "medium", "heavy", "extreme"] as const)[debtPenalty04(debt)];
}
