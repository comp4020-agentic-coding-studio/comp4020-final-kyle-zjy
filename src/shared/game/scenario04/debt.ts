/** One starting Final Chip is lost for each two Debt, up to four. */
export function debtPenalty04(debt: number): number {
  return Math.min(4, Math.floor(Math.max(0, debt) / 2));
}

export function debtTier04(debt: number): "none" | "light" | "medium" | "heavy" | "extreme" {
  return (["none", "light", "medium", "heavy", "extreme"] as const)[debtPenalty04(debt)];
}
