import type { IntelId04, LotId04 } from "./types.ts";

export type Lot04 = {
  id: LotId04;
  name: string;
  publicDescription: string;
  startingBid: number;
  hiddenInfo: IntelId04;
  perfectInfo: IntelId04;
  effect: "DIE" | "EYE" | "COIN" | "CONTRACT" | "COPY" | "CREDIT" | "WARD" | "CROWN" | "DEVIL" | "EXIT";
  transferable: boolean;
  tags: string[];
  finalAuctionModifier: number;
};

export const LOTS04: readonly Lot04[] = [
  { id: "LOT_01", name: "The Black Die", publicDescription: "Activate it, then your next Investigate, Read or Sabotage resolves as Perfect.", startingBid: 1, hiddenInfo: "LOT_01_LIMIT", perfectInfo: "LOT_01_PERFECT", effect: "DIE", transferable: true, tags: ["TUTORIAL"], finalAuctionModifier: 0 },
  { id: "LOT_02", name: "The Glass Eye", publicDescription: "Use once to privately see every other bidder's current Black Chips.", startingBid: 1, hiddenInfo: "LOT_02_READ", perfectInfo: "LOT_02_PERFECT", effect: "EYE", transferable: true, tags: ["INFORMATION"], finalAuctionModifier: 0 },
  { id: "LOT_03", name: "Gambler's Coin", publicDescription: "Activate it before Blackjack to adjust one starting card by one point, within 1–10.", startingBid: 1, hiddenInfo: "LOT_03_WAGER", perfectInfo: "LOT_03_PERFECT", effect: "COIN", transferable: true, tags: ["GAMBLE"], finalAuctionModifier: 0 },
  { id: "LOT_04", name: "The Red Contract", publicDescription: "Activate it for 2 starting AP in each of the next three full rounds.", startingBid: 1, hiddenInfo: "LOT_04_DEAL", perfectInfo: "LOT_04_PERFECT", effect: "CONTRACT", transferable: true, tags: ["AP"], finalAuctionModifier: 0 },
  { id: "LOT_05", name: "Prototype Chrono Key", publicDescription: "Activate it to obtain a copy of any lot offered before this key. A counterfeit source yields a counterfeit copy.", startingBid: 1, hiddenInfo: "LOT_05_ANOMALY", perfectInfo: "LOT_05_PERFECT", effect: "COPY", transferable: true, tags: ["COPY"], finalAuctionModifier: 0 },
  { id: "LOT_06", name: "The Bottomless Credit", publicDescription: "Use once to clear all your current Debt.", startingBid: 1, hiddenInfo: "LOT_06_DEBT", perfectInfo: "LOT_06_PERFECT", effect: "CREDIT", transferable: true, tags: ["DEBT"], finalAuctionModifier: 0 },
  { id: "LOT_07", name: "The Nameless File", publicDescription: "Activate it to keep your Sanity at 3/3 for the rest of this game.", startingBid: 1, hiddenInfo: "LOT_07_CONNECTION", perfectInfo: "LOT_07_PERFECT", effect: "WARD", transferable: true, tags: ["SANITY"], finalAuctionModifier: 0 },
  { id: "LOT_08", name: "The Black Crown", publicDescription: "Activate it before the final auction: your real bid counts 2 higher, but you pay only the real amount.", startingBid: 1, hiddenInfo: "LOT_08_LIMIT", perfectInfo: "LOT_08_PERFECT", effect: "CROWN", transferable: true, tags: ["FINAL"], finalAuctionModifier: 2 },
  { id: "LOT_09", name: "The Devil's Key", publicDescription: "Use once to turn all your current Sanity into an equal number of Black Chips, then become Lost.", startingBid: 1, hiddenInfo: "LOT_09_RECORD", perfectInfo: "LOT_09_SUBJECTS", effect: "DEVIL", transferable: true, tags: ["RISK"], finalAuctionModifier: 0 },
  { id: "LOT_10", name: "Exit Rights", publicDescription: "A seat may leave. The debt follows.", startingBid: 1, hiddenInfo: "LOT_10_COST", perfectInfo: "LOT_10_PERFECT", effect: "EXIT", transferable: false, tags: ["FINAL"], finalAuctionModifier: 0 },
] as const;

export const lotForRound04 = (round: number): Lot04 => {
  const lot = LOTS04[round - 1];
  if (!lot) throw new Error(`invalid auction round ${round}`);
  return lot;
};

/** Each Chrono Key copy has an independent inventory identity. */
export const copyItemId04 = (source: LotId04, sequence: number): LotId04 => `LOT_05_COPY_${source.slice(-2)}_${sequence}`;
export const itemLotId04 = (item: LotId04): LotId04 => {
  const copy = /^LOT_05_COPY_(0[1-4])_\d+$/.exec(item);
  return copy ? `LOT_${copy[1]}` : item;
};
