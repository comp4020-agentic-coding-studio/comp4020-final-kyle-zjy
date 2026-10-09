import type { PlayerId } from "../state.ts";

export type LotId04 = `LOT_${string}`;
export type IntelId04 = `${LotId04}_${string}`;

export type AuctionPlayer04 = {
  blackChips: number;
  debt: number;
  items: LotId04[];
  usedLotEffects: LotId04[];
  privateIntel: IntelId04[];
  /** A READ result belongs only to its observer and records a snapshot. */
  reads: { targetId: PlayerId; round: number; blackChips: number; hasCurrentIntel: boolean }[];
  nextRollPenalty: number;
};

export type AuctionHistory04 = {
  round: number;
  lotId: LotId04;
  winnerId: PlayerId | null;
  price: number;
  openingPlayerId: PlayerId;
};

export type AuctionState04 = {
  seatOrder: PlayerId[];
  currentLot: LotId04;
  currentBid: number;
  currentBidder: PlayerId | null;
  turnPlayerId: PlayerId | null;
  roundStartPlayerId: PlayerId;
  passedPlayers: PlayerId[];
  auctionOpen: boolean;
  auctionHistory: AuctionHistory04[];
  players: Record<PlayerId, AuctionPlayer04>;
  publicIntel: IntelId04[];
  connectedPlayerId: PlayerId | null;
  /** The active transaction or Blackjack game suspends bidding. */
  deal: null | { from: PlayerId; to: PlayerId; chips: number; contractDiscount?: boolean; receiveChips?: number; giveIntel?: IntelId04; giveItem?: LotId04; forIntel?: IntelId04; forItem?: LotId04; forPass?: boolean };
  challenge: null | {
    challenger: PlayerId;
    target: PlayerId;
    wager: number;
    effectiveWager: number;
    deck: number[];
    challengerHand: number[];
    targetHand: number[];
    turn: PlayerId;
    stood: PlayerId[];
  };
  stats: { highestBid: number; challengesWon: Record<PlayerId, number>; investigations: Record<PlayerId, number>; deals: number; borrows: Record<PlayerId, number> };
};

export type PublicAuctionPlayer04 = {
  debt: number;
  items: LotId04[];
  passed: boolean;
  blackChips: number | null;
  privateIntel: IntelId04[] | null;
  reads: AuctionPlayer04["reads"] | null;
};

export type PublicAuction04 = Omit<AuctionState04, "players" | "challenge" | "deal"> & {
  players: Record<PlayerId, PublicAuctionPlayer04>;
  deal: AuctionState04["deal"];
  challenge: null | Omit<NonNullable<AuctionState04["challenge"]>, "deck">;
};
