import type { IntelId04, LotId04 } from "./types.ts";

export type Lot04 = {
  id: LotId04;
  name: string;
  publicDescription: string;
  startingBid: number;
  hiddenInfo: IntelId04;
  perfectInfo: IntelId04;
  effect: "DIE" | "READ" | "CHALLENGE" | "DEAL" | "NONE" | "BORROW" | "CONNECTION" | "FINAL" | "RECORD" | "EXIT";
  transferable: boolean;
  tags: string[];
  finalAuctionModifier: number;
};

export const LOTS04: readonly Lot04[] = [
  { id: "LOT_01", name: "The Black Die", publicDescription: "Your next auction action roll gains +1, once.", startingBid: 1, hiddenInfo: "LOT_01_LIMIT", perfectInfo: "LOT_01_PERFECT", effect: "DIE", transferable: true, tags: ["TUTORIAL"], finalAuctionModifier: 0 },
  { id: "LOT_02", name: "The Glass Eye", publicDescription: "Your next successful READ also identifies one piece of current lot intel.", startingBid: 2, hiddenInfo: "LOT_02_READ", perfectInfo: "LOT_02_PERFECT", effect: "READ", transferable: true, tags: ["INFORMATION"], finalAuctionModifier: 0 },
  { id: "LOT_03", name: "Gambler's Coin", publicDescription: "Once, draw a replacement starting Blackjack card and keep it if it improves your hand.", startingBid: 2, hiddenInfo: "LOT_03_WAGER", perfectInfo: "LOT_03_PERFECT", effect: "CHALLENGE", transferable: true, tags: ["GAMBLE"], finalAuctionModifier: 0 },
  { id: "LOT_04", name: "The Red Contract", publicDescription: "Once, reduce the chips you pay in an accepted deal by one.", startingBid: 3, hiddenInfo: "LOT_04_DEAL", perfectInfo: "LOT_04_PERFECT", effect: "DEAL", transferable: true, tags: ["TRADE"], finalAuctionModifier: 0 },
  { id: "LOT_05", name: "Prototype Chrono Key", publicDescription: "A key said to unlock an impossible moment.", startingBid: 4, hiddenInfo: "LOT_05_ANOMALY", perfectInfo: "LOT_05_COUNTERFEIT", effect: "NONE", transferable: true, tags: ["COUNTERFEIT"], finalAuctionModifier: 0 },
  { id: "LOT_06", name: "The Bottomless Credit", publicDescription: "Once, borrow at a reduced Debt cost.", startingBid: 3, hiddenInfo: "LOT_06_DEBT", perfectInfo: "LOT_06_PERFECT", effect: "BORROW", transferable: true, tags: ["DEBT"], finalAuctionModifier: 0 },
  { id: "LOT_07", name: "The Nameless File", publicDescription: "Property of a current bidder.", startingBid: 4, hiddenInfo: "LOT_07_CONNECTION", perfectInfo: "LOT_07_PERFECT", effect: "CONNECTION", transferable: false, tags: ["IDENTITY"], finalAuctionModifier: 0 },
  { id: "LOT_08", name: "The Black Crown", publicDescription: "In the final auction, you may bid up to 2 more than your chips and pay 2 less if you win.", startingBid: 6, hiddenInfo: "LOT_08_LIMIT", perfectInfo: "LOT_08_PERFECT", effect: "FINAL", transferable: true, tags: ["FINAL"], finalAuctionModifier: 2 },
  { id: "LOT_09", name: "The Auction Record", publicDescription: "A true record of the bids, debts, deals and challenges at this table.", startingBid: 4, hiddenInfo: "LOT_09_RECORD", perfectInfo: "LOT_09_SUBJECTS", effect: "RECORD", transferable: false, tags: ["REVELATION"], finalAuctionModifier: 0 },
  { id: "LOT_10", name: "Exit Rights", publicDescription: "A seat may leave. The debt follows.", startingBid: 8, hiddenInfo: "LOT_10_COST", perfectInfo: "LOT_10_PERFECT", effect: "EXIT", transferable: false, tags: ["FINAL"], finalAuctionModifier: 0 },
] as const;

export const lotForRound04 = (round: number): Lot04 => {
  const lot = LOTS04[round - 1];
  if (!lot) throw new Error(`invalid auction round ${round}`);
  return lot;
};
