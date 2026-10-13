import { LOTS04, type AuctionItemCategory04 } from "../../../shared/game/scenario04/lots.ts";
import type { LotId04 } from "../../../shared/game/scenario04/types.ts";
import type { GameState } from "../../../shared/game/state.ts";
import { shuffle } from "../rng.ts";

const quotas: { categories: AuctionItemCategory04[]; count: number }[] = [
  { categories: ["intel"], count: 2 },
  { categories: ["economy"], count: 2 },
  { categories: ["bidding", "social"], count: 2 },
  { categories: ["gambling"], count: 1 },
  { categories: ["highRisk"], count: 1 },
  { categories: ["endgame"], count: 1 },
];

/** Nine distinct ordinary lots, followed by two counterfeit identities from that draw. */
export function generateAuctionPool04(s: Pick<GameState, "rng" | "rngCalls">): { order: LotId04[]; counterfeit: LotId04[] } {
  const remaining = shuffle(s, LOTS04.filter((lot) => lot.id !== "LOT_10"));
  const selected: LotId04[] = [];
  for (const quota of quotas) {
    for (let i = 0; i < quota.count; i++) {
      const index = remaining.findIndex((lot) => quota.categories.includes(lot.category));
      if (index < 0) break;
      selected.push(remaining.splice(index, 1)[0].id);
    }
  }
  while (selected.length < 9 && remaining.length) selected.push(remaining.shift()!.id);
  if (selected.length !== 9 || new Set(selected).size !== 9) throw new Error("Scenario 04 needs nine distinct ordinary lots");
  const order = shuffle(s, selected);
  return { order, counterfeit: shuffle(s, order).slice(0, 2) };
}
