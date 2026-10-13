import type { IntelId04, LotId04 } from "./types.ts";

export type AuctionItemCategory04 = "intel" | "economy" | "bidding" | "gambling" | "social" | "highRisk" | "endgame";

export type Lot04 = {
  id: LotId04;
  name: string;
  publicDescription: string;
  startingBid: number;
  hiddenInfo: IntelId04;
  perfectInfo: IntelId04;
  effect: string;
  transferable: boolean;
  tags: string[];
  finalAuctionModifier: number;
  category: AuctionItemCategory04;
  icon: string;
  /** Player-facing descriptions are deliberately atmospheric; mechanics stay on the server. */
  active: boolean;
  maxUses: number;
};

export const LOTS04: readonly Lot04[] = [
  { id: "LOT_01", name: "The Black Die", publicDescription: "Its faces are dark even beneath the lamp.", startingBid: 1, hiddenInfo: "LOT_01_LIMIT", perfectInfo: "LOT_01_PERFECT", effect: "DIE", transferable: true, tags: ["TUTORIAL"], finalAuctionModifier: 0, category: "highRisk", icon: "DICE", active: true, maxUses: 1 },
  { id: "LOT_02", name: "The Glass Eye", publicDescription: "It follows every hand around the table.", startingBid: 1, hiddenInfo: "LOT_02_READ", perfectInfo: "LOT_02_PERFECT", effect: "EYE", transferable: true, tags: ["INFORMATION"], finalAuctionModifier: 0, category: "intel", icon: "SECRET", active: true, maxUses: 1 },
  { id: "LOT_03", name: "Gambler's Coin", publicDescription: "The same face turns up in every story.", startingBid: 1, hiddenInfo: "LOT_03_WAGER", perfectInfo: "LOT_03_PERFECT", effect: "COIN", transferable: true, tags: ["GAMBLE"], finalAuctionModifier: 0, category: "gambling", icon: "S4_COIN", active: true, maxUses: 1 },
  { id: "LOT_04", name: "The Red Contract", publicDescription: "A signature dries while no one holds the pen.", startingBid: 1, hiddenInfo: "LOT_04_DEAL", perfectInfo: "LOT_04_PERFECT", effect: "CONTRACT", transferable: true, tags: ["AP"], finalAuctionModifier: 0, category: "social", icon: "CHALLENGE", active: true, maxUses: 1 },
  { id: "LOT_05", name: "Prototype Chrono Key", publicDescription: "A key cut for a lock that has already closed.", startingBid: 1, hiddenInfo: "LOT_05_ANOMALY", perfectInfo: "LOT_05_PERFECT", effect: "COPY", transferable: true, tags: ["COPY"], finalAuctionModifier: 0, category: "endgame", icon: "KEY", active: true, maxUses: 1 },
  { id: "LOT_06", name: "The Bottomless Credit", publicDescription: "The issuer's name runs off the page.", startingBid: 1, hiddenInfo: "LOT_06_DEBT", perfectInfo: "LOT_06_PERFECT", effect: "CREDIT", transferable: true, tags: ["DEBT"], finalAuctionModifier: 0, category: "economy", icon: "S4_CREDIT", active: true, maxUses: 1 },
  { id: "LOT_07", name: "The Nameless File", publicDescription: "Its pages carry a life with no name.", startingBid: 1, hiddenInfo: "LOT_07_CONNECTION", perfectInfo: "LOT_07_PERFECT", effect: "WARD", transferable: true, tags: ["SANITY"], finalAuctionModifier: 0, category: "highRisk", icon: "REGISTER", active: true, maxUses: 1 },
  { id: "LOT_08", name: "The Black Crown", publicDescription: "Only the final bidder is allowed to try it on.", startingBid: 1, hiddenInfo: "LOT_08_LIMIT", perfectInfo: "LOT_08_PERFECT", effect: "CROWN", transferable: true, tags: ["FINAL"], finalAuctionModifier: 2, category: "endgame", icon: "S4_CROWN", active: true, maxUses: 1 },
  { id: "LOT_09", name: "The Devil's Key", publicDescription: "Its teeth resemble a row of tiny hands.", startingBid: 1, hiddenInfo: "LOT_09_RECORD", perfectInfo: "LOT_09_SUBJECTS", effect: "DEVIL", transferable: true, tags: ["RISK"], finalAuctionModifier: 0, category: "highRisk", icon: "S4_DEVIL_KEY", active: true, maxUses: 1 },
  { id: "LOT_10", name: "Exit Rights", publicDescription: "A seat may leave. The debt follows.", startingBid: 1, hiddenInfo: "LOT_10_COST", perfectInfo: "LOT_10_PERFECT", effect: "EXIT", transferable: false, tags: ["FINAL"], finalAuctionModifier: 0, category: "endgame", icon: "S4_EXIT", active: false, maxUses: 0 },
  { id: "LOT_11", name: "Bell of Silence", publicDescription: "They say no voice can rise after it rings.", startingBid: 1, hiddenInfo: "LOT_11_HINT", perfectInfo: "LOT_11_PERFECT", effect: "SILENT_BELL", transferable: true, tags: [], finalAuctionModifier: 0, category: "bidding", icon: "S4_BELL", active: true, maxUses: 1 },
  { id: "LOT_12", name: "Half Ticket", publicDescription: "Its destination is torn away; only a seat number remains.", startingBid: 1, hiddenInfo: "LOT_12_HINT", perfectInfo: "LOT_12_PERFECT", effect: "HALF_TICKET", transferable: true, tags: [], finalAuctionModifier: 0, category: "endgame", icon: "S4_TICKET", active: true, maxUses: 1 },
  { id: "LOT_13", name: "Blank Cheque", publicDescription: "The signature is genuine. The amount was never written.", startingBid: 1, hiddenInfo: "LOT_13_HINT", perfectInfo: "LOT_13_PERFECT", effect: "BLANK_CHEQUE", transferable: true, tags: [], finalAuctionModifier: 0, category: "economy", icon: "S4_CHEQUE", active: true, maxUses: 1 },
  { id: "LOT_14", name: "Red Thread Scissors", publicDescription: "Does it cut the thread, or the promise?", startingBid: 1, hiddenInfo: "LOT_14_HINT", perfectInfo: "LOT_14_PERFECT", effect: "SCISSORS", transferable: true, tags: [], finalAuctionModifier: 0, category: "social", icon: "S4_SCISSORS", active: true, maxUses: 1 },
  { id: "LOT_15", name: "The Third Glove", publicDescription: "The auctioneer denies that this glove belongs to anyone.", startingBid: 1, hiddenInfo: "LOT_15_HINT", perfectInfo: "LOT_15_PERFECT", effect: "THIRD_GLOVE", transferable: true, tags: [], finalAuctionModifier: 0, category: "intel", icon: "S4_GLOVE", active: true, maxUses: 1 },
  { id: "LOT_16", name: "Two-Sided Mirror", publicDescription: "The person in the glass makes a different choice.", startingBid: 1, hiddenInfo: "LOT_16_HINT", perfectInfo: "LOT_16_PERFECT", effect: "MIRROR", transferable: true, tags: [], finalAuctionModifier: 0, category: "intel", icon: "S4_MIRROR", active: true, maxUses: 1 },
  { id: "LOT_17", name: "Broken Stopwatch", publicDescription: "It always stops a second before the hammer falls.", startingBid: 1, hiddenInfo: "LOT_17_HINT", perfectInfo: "LOT_17_PERFECT", effect: "STOPWATCH", transferable: true, tags: [], finalAuctionModifier: 0, category: "bidding", icon: "S4_WATCH", active: true, maxUses: 1 },
  { id: "LOT_18", name: "Ownerless Number", publicDescription: "The number exists, but its seat is empty.", startingBid: 1, hiddenInfo: "LOT_18_HINT", perfectInfo: "LOT_18_PERFECT", effect: "NUMBER", transferable: true, tags: [], finalAuctionModifier: 0, category: "intel", icon: "S4_BADGE", active: true, maxUses: 1 },
  { id: "LOT_19", name: "Pardon Seal", publicDescription: "It once cancelled a debt that should not have existed.", startingBid: 1, hiddenInfo: "LOT_19_HINT", perfectInfo: "LOT_19_PERFECT", effect: "PARDON", transferable: true, tags: [], finalAuctionModifier: 0, category: "economy", icon: "S4_STAMP", active: true, maxUses: 1 },
  { id: "LOT_20", name: "Reversed Tarot", publicDescription: "Face down, fate appears more honest.", startingBid: 1, hiddenInfo: "LOT_20_HINT", perfectInfo: "LOT_20_PERFECT", effect: "TAROT", transferable: true, tags: [], finalAuctionModifier: 0, category: "highRisk", icon: "S4_CARD", active: true, maxUses: 1 },
  { id: "LOT_21", name: "Second Will", publicDescription: "Both wills are genuine; their beneficiaries differ.", startingBid: 1, hiddenInfo: "LOT_21_HINT", perfectInfo: "LOT_21_PERFECT", effect: "WILL", transferable: true, tags: [], finalAuctionModifier: 0, category: "social", icon: "S4_SCROLL", active: true, maxUses: 1 },
  { id: "LOT_22", name: "Black Invitation", publicDescription: "Another person's name is written inside.", startingBid: 1, hiddenInfo: "LOT_22_HINT", perfectInfo: "LOT_22_PERFECT", effect: "INVITATION", transferable: true, tags: [], finalAuctionModifier: 0, category: "social", icon: "S4_ENVELOPE", active: true, maxUses: 1 },
  { id: "LOT_23", name: "Glass Dice Cup", publicDescription: "You cannot see through it, though the host insists it is clear.", startingBid: 1, hiddenInfo: "LOT_23_HINT", perfectInfo: "LOT_23_PERFECT", effect: "DICE_CUP", transferable: true, tags: [], finalAuctionModifier: 0, category: "gambling", icon: "S4_CUP", active: true, maxUses: 1 },
  { id: "LOT_24", name: "Safe Fragment Key", publicDescription: "It opens no door, but judges every other key.", startingBid: 1, hiddenInfo: "LOT_24_HINT", perfectInfo: "LOT_24_PERFECT", effect: "SAFE_KEY", transferable: true, tags: [], finalAuctionModifier: 0, category: "intel", icon: "KEY", active: true, maxUses: 1 },
  { id: "LOT_25", name: "Night Ledger", publicDescription: "Every debt has a signature that is not its owner's.", startingBid: 1, hiddenInfo: "LOT_25_HINT", perfectInfo: "LOT_25_PERFECT", effect: "LEDGER", transferable: true, tags: [], finalAuctionModifier: 0, category: "economy", icon: "S4_BOOK", active: false, maxUses: 1 },
  { id: "LOT_26", name: "Hollow Coin", publicDescription: "Its weight is right. Its sound is wrong.", startingBid: 1, hiddenInfo: "LOT_26_HINT", perfectInfo: "LOT_26_PERFECT", effect: "HOLLOW_COIN", transferable: true, tags: [], finalAuctionModifier: 0, category: "bidding", icon: "S4_COIN", active: true, maxUses: 1 },
  { id: "LOT_27", name: "Burnt Playing Card", publicDescription: "Only a corner of the spade survived.", startingBid: 1, hiddenInfo: "LOT_27_HINT", perfectInfo: "LOT_27_PERFECT", effect: "BURNT_CARD", transferable: true, tags: [], finalAuctionModifier: 0, category: "gambling", icon: "S4_CARD", active: true, maxUses: 1 },
  { id: "LOT_28", name: "Expired Membership", publicDescription: "Its expiration date is tomorrow.", startingBid: 1, hiddenInfo: "LOT_28_HINT", perfectInfo: "LOT_28_PERFECT", effect: "MEMBERSHIP", transferable: true, tags: [], finalAuctionModifier: 0, category: "highRisk", icon: "S4_BADGE", active: true, maxUses: 1 },
  { id: "LOT_29", name: "Stranger's IOU", publicDescription: "The debtor's name was torn away.", startingBid: 1, hiddenInfo: "LOT_29_HINT", perfectInfo: "LOT_29_PERFECT", effect: "IOU", transferable: true, tags: [], finalAuctionModifier: 0, category: "economy", icon: "S4_CHEQUE", active: true, maxUses: 1 },
  { id: "LOT_30", name: "The Last Match", publicDescription: "Only one match remains, already struck once.", startingBid: 1, hiddenInfo: "LOT_30_HINT", perfectInfo: "LOT_30_PERFECT", effect: "LAST_MATCH", transferable: true, tags: [], finalAuctionModifier: 0, category: "endgame", icon: "S4_MATCH", active: true, maxUses: 1 },
] as const;

export const lotForRound04 = (round: number): Lot04 => {
  const lot = LOTS04[round - 1];
  if (!lot) throw new Error(`invalid auction round ${round}`);
  return lot;
};

/** Each Chrono Key copy has an independent inventory identity. */
export const copyItemId04 = (source: LotId04, sequence: number): LotId04 => `LOT_05_COPY_${source.slice(-2)}_${sequence}`;
export const itemLotId04 = (item: LotId04): LotId04 => {
  const copy = /^LOT_05_COPY_(\d{2})_\d+$/.exec(item);
  const developer = /^LOT_DEV_(\d{2})_\d+$/.exec(item);
  return copy ? `LOT_${copy[1]}` : developer ? `LOT_${developer[1]}` : item;
};

/** Saved pre-pool games retain their original fixed sequence. */
export const lotForAuctionRound04 = (s: { auction?: { lotOrder?: LotId04[] } | null }, round: number): Lot04 => {
  const id = s.auction?.lotOrder?.[round - 1];
  return id ? LOTS04.find((lot) => lot.id === id)! : lotForRound04(round);
};
