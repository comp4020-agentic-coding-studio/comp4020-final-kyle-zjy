import type { PlayerId } from "../state.ts";

export type LotId04 = `LOT_${string}`;
export type IntelId04 = `${LotId04}_${string}`;

export type AuctionItemInstance04 = {
  itemInstanceId: LotId04;
  lotId: LotId04;
  offeredRound: number;
  counterfeit: boolean;
  sourceItemInstanceId: LotId04 | null;
  consumed: boolean;
};

export type AuctionPlayer04 = {
  blackChips: number;
  debt: number;
  items: LotId04[];
  usedLotEffects: LotId04[];
  armedBlackDie: number;
  armedCoin: number;
  activeCrown: boolean;
  sanityWard: boolean;
  itemNoticeSeq: number;
  itemNotice: null | { seq: number; at: number; lotId: LotId04; result: "ACQUIRED" | "ACTIVATED" | "COUNTERFEIT" | "COPIED" | "CONVERTED" | "CONVERTED_COUNTERFEIT"; copyLotId?: LotId04 };
  redContractRemainingRounds: number;
  redContractStartsRound: number;
  privateIntel: IntelId04[];
  /** A READ result belongs only to its observer and records a snapshot. */
  reads: { targetId: PlayerId; round: number; blackChips: number; hasCurrentIntel: boolean }[];
  glassEyeSnapshots: { round: number; chips: Record<PlayerId, number> }[];
  nextRollPenalty: number;
};

export type AuctionHistory04 = {
  round: number;
  lotId: LotId04;
  itemInstanceId: LotId04;
  winnerId: PlayerId | null;
  price: number;
  openingPlayerId: PlayerId;
};

export type FinalPlayer04 = {
  balance: number;
  converted: { blackChips: number; sanity: number; fate: number; ap: number; items: { id: LotId04; gain: number }[] };
  ready: boolean;
  usable: number | null;
  bid: number | null;
  revealReady: boolean;
  initial: { sanity: number; fate: number; ap: number; lost: boolean; debt: number };
};

export type FinalState04 = {
  stage: "SETTLEMENT" | "AUCTION" | "REVEAL";
  logStartSeq: number;
  players: Record<PlayerId, FinalPlayer04>;
  winnerId: PlayerId | null;
};

export type AuctionState04 = {
  seatOrder: PlayerId[];
  currentLot: LotId04;
  currentBid: number;
  /** The binding amount; currentBid is the effective comparison value. */
  currentBidReal: number;
  currentBidder: PlayerId | null;
  bidThisTurn: PlayerId | null;
  turnPlayerId: PlayerId | null;
  roundStartPlayerId: PlayerId;
  passedPlayers: PlayerId[];
  auctionOpen: boolean;
  final: FinalState04 | null;
  auctionHistory: AuctionHistory04[];
  /** Server-only identity, authenticity, and use state of offered lots and copies. */
  itemInstances: Record<string, AuctionItemInstance04>;
  nextItemInstanceNumber: number;
  players: Record<PlayerId, AuctionPlayer04>;
  publicIntel: IntelId04[];
  /** Secret, seeded choice of exactly two lots among rounds 1–9. */
  counterfeitLots: LotId04[];
  /** The active transaction or Blackjack game suspends bidding. */
  deal: null | { from: PlayerId; to: PlayerId; chips: number; receiveChips?: number; giveIntel?: IntelId04; giveItem?: LotId04; forIntel?: IntelId04; forItem?: LotId04; forPass?: boolean };
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
    coinAsked: PlayerId[];
  };
  stats: { highestBid: number; challengesWon: Record<PlayerId, number>; investigations: Record<PlayerId, number>; deals: number; borrows: Record<PlayerId, number> };
};

export type PublicAuctionPlayer04 = {
  debt: number;
  items: LotId04[];
  usedLotEffects: LotId04[];
  armedBlackDie: number;
  armedCoin: number;
  activeCrown: boolean;
  sanityWard: boolean;
  itemNotice: AuctionPlayer04["itemNotice"] | null;
  redContractRemainingRounds: number;
  redContractStartsRound: number | null;
  nextRollPenalty: number | null;
  passed: boolean;
  blackChips: number | null;
  privateIntel: IntelId04[] | null;
  reads: AuctionPlayer04["reads"] | null;
  glassEyeSnapshots: AuctionPlayer04["glassEyeSnapshots"] | null;
};

export type PublicFinalPlayer04 = {
  status: "SETTLING" | "READY" | "BID_SUBMITTED" | "REVEALED";
  continued: boolean;
  balance: number | null;
  converted: FinalPlayer04["converted"] | null;
  usable: number | null;
  bid: number | null;
  modifier: number | null;
  effectiveBid: number | null;
};

export type PublicFinal04 = {
  stage: FinalState04["stage"];
  players: Record<PlayerId, PublicFinalPlayer04>;
  winnerId: PlayerId | null;
};

export type PublicAuction04 = Omit<AuctionState04, "players" | "challenge" | "deal" | "final" | "counterfeitLots" | "itemInstances" | "nextItemInstanceNumber"> & {
  players: Record<PlayerId, PublicAuctionPlayer04>;
  final: PublicFinal04 | null;
  deal: AuctionState04["deal"];
  challenge: null | Omit<NonNullable<AuctionState04["challenge"]>, "deck">;
};
