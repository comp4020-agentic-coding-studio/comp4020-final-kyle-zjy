import type { GameAction } from "../../../shared/game/actions.ts";
import { lotForAuctionRound04 } from "../../../shared/game/scenario04/lots.ts";
import type { GameState, PlayerGameState, PlayerId } from "../../../shared/game/state.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { fail, type Spec } from "../actions.ts";
import { cue, log, type Ctx } from "../context.ts";
import { nextTurn } from "../flow.ts";
import { noticeAcquiredLot04 } from "./items.ts";
import { openFinal04 } from "./final.ts";
import { houseRuleAt04 } from "../../../shared/game/scenario04/houseRules.ts";
import { autoDeclareHolding04 } from "./houseRules.ts";

export function minimumBid04(s: GameState): number {
  const a = s.auction!;
  const step = houseRuleAt04(a, s.round) === "doubleRaise" && a.currentBidder ? 2 : 1;
  return Math.max(lotForAuctionRound04(s, Math.max(1, s.round)).startingBid, a.currentBid + step);
}

export function openAuctionRound04(ctx: Ctx): void {
  const s = ctx.s;
  const auction = s.auction!;
  const prior = auction.auctionHistory.at(-1);
  const previous = prior?.winnerId ?? prior?.openingPlayerId;
  const start = previous ? auction.seatOrder[(auction.seatOrder.indexOf(previous) + 1) % auction.seatOrder.length] : auction.seatOrder[0];
  const index = auction.seatOrder.indexOf(start);
  s.turnOrder = [...auction.seatOrder.slice(index), ...auction.seatOrder.slice(0, index)];
  auction.currentLot = lotForAuctionRound04(s, s.round).id;
  auction.itemInstances[auction.currentLot] = {
    itemInstanceId: auction.currentLot,
    lotId: auction.currentLot,
    offeredRound: s.round,
    counterfeit: auction.counterfeitLots.includes(auction.currentLot),
    sourceItemInstanceId: null,
    consumed: false,
  };
  auction.currentBid = lotForAuctionRound04(s, s.round).startingBid - 1;
  auction.currentBidReal = 0;
  auction.currentBidder = null;
  auction.bidThisTurn = null;
  auction.roundStartPlayerId = start;
  auction.turnPlayerId = start;
  auction.passedPlayers = [];
  auction.raiseBlockedPlayers = [];
  auction.hollowCoinOwner = null;
  auction.houseChallengeBonusClaimed = false;
  auction.holdingDeclarations = {};
  auction.holdingPendingIds = houseRuleAt04(auction, s.round) === "holdingDisclosure"
    ? auction.seatOrder.filter((id) => auction.players[id].items.length > 0) : [];
  auction.publicTrades = [];
  for (const holder of Object.values(auction.players)) holder.bellArmed = false;
  auction.auctionOpen = true;
  auction.deal = null;
  auction.challenge = null;
  if (s.round === 10) {
    openFinal04(ctx);
    return;
  }
  cue(ctx, "S4_ROUND", { round: s.round, lotId: auction.currentLot });
}

function closeAuction04(ctx: Ctx): void {
  const s = ctx.s;
  const a = s.auction!;
  let winner = a.currentBidder;
  let paid = 0;
  if (winner && a.players[winner].blackChips < a.currentBidReal) {
    // A Hollow Coin bidder who cannot honour the binding amount forfeits this lot.
    a.players[winner].debt++;
    winner = null;
    a.currentBidder = null;
    a.currentBid = 0;
    a.currentBidReal = 0;
  }
  if (winner) {
    const player = a.players[winner];
    const discount = player.blankChequeArmed ? Math.min(1, a.currentBidReal) : 0;
    player.blankChequeArmed = false;
    paid = a.currentBidReal - discount;
    player.blackChips -= paid;
    if (discount) player.debt += 2;
    player.items.push(a.currentLot);
    noticeAcquiredLot04(player, a.currentLot, ctx.now);
    a.stats.highestBid = Math.max(a.stats.highestBid, a.currentBid);
    log(ctx, m`${s.players[winner].nickname} wins the lot for ${paid} Black Chips.`, "S4_SOLD", winner);
  } else {
    log(ctx, m`The lot receives no bids and is withdrawn.`, "S4_UNSOLD");
  }
  a.auctionHistory.push({ round: s.round, lotId: a.currentLot, itemInstanceId: a.currentLot, winnerId: winner, price: paid, openingPlayerId: a.roundStartPlayerId });
  a.auctionOpen = false;
  a.turnPlayerId = null;
  s.step = "WORLD";
  s.activeIndex = s.turnOrder.length;
  s.turnDeadline = null;
  cue(ctx, winner ? "S4_SOLD" : "S4_UNSOLD", { round: s.round, lotId: a.currentLot, winnerId: winner, price: paid });
}

export function advanceAuction04(ctx: Ctx, from: PlayerId): void {
  const s = ctx.s;
  const a = s.auction!;
  if (!a.auctionOpen) return;
  autoDeclareHolding04(ctx, from);
  a.raiseBlockedPlayers = (a.raiseBlockedPlayers ?? []).filter((id) => id !== from);
  a.bidThisTurn = null;
  const competitors = a.seatOrder.filter((id) => !a.passedPlayers.includes(id) && id !== a.currentBidder);
  if (!competitors.length) return closeAuction04(ctx);
  const fromIndex = s.turnOrder.indexOf(from);
  for (let distance = 1; distance <= s.turnOrder.length; distance++) {
    const index = (fromIndex + distance) % s.turnOrder.length;
    const next = s.turnOrder[index];
    if (!competitors.includes(next)) continue;
    s.activeIndex = index - 1;
    nextTurn(ctx);
    a.turnPlayerId = next;
    return;
  }
}

export function skipAuctionTurn04(ctx: Ctx, p: PlayerGameState): void {
  const a = ctx.s.auction!;
  if (!a.passedPlayers.includes(p.playerId) && a.currentBidder !== p.playerId) PASS04.apply(ctx, p, { type: "PASS" });
  advanceAuction04(ctx, p.playerId);
}

export const END_TURN04: Spec<Extract<GameAction, { type: "END_TURN" }>> = {
  check: () => null,
  apply: (ctx, p) => {
    log(ctx, m`${p.nickname} ends their turn.`, "TURN", p.playerId);
    advanceAuction04(ctx, p.playerId);
  },
};

export const BID04: Spec<Extract<GameAction, { type: "BID" }>> = {
  check: (s, p, action) => {
    const a = s.auction!;
    if (!a.auctionOpen || a.passedPlayers.includes(p.playerId) || a.currentBidder === p.playerId || a.bidThisTurn === p.playerId || a.raiseBlockedPlayers?.includes(p.playerId) || houseRuleAt04(a, s.round) === "singleRaise" && p.counters.s4RaisedRound === s.round) return fail("ILLEGAL_TARGET", m`You cannot bid on this lot now.`);
    const bonus = 0;
    const chips = a.players[p.playerId].blackChips;
    if (chips + bonus < minimumBid04(s)) return fail("ILLEGAL_TARGET", m`You do not have enough Black Chips to bid.`);
    if (action && (!Number.isSafeInteger(action.amount) || action.amount + bonus < minimumBid04(s))) return fail("INVALID", m`Choose a higher whole-number bid.`);
    if (action && action.amount > chips) return fail("ILLEGAL_TARGET", m`You cannot bid more Black Chips than you hold.`);
    return null;
  },
  targets: (s, p) => {
    const a = s.auction!;
    const bonus = 0;
    const limit = a.players[p.playerId].blackChips;
    const floor = minimumBid04(s) - bonus;
    return Array.from({ length: Math.max(0, limit - floor + 1) }, (_, i) => floor + i);
  },
  apply: (ctx, p, action) => {
    const a = ctx.s.auction!;
    const bonus = 0;
    a.currentBid = action.amount + bonus;
    a.currentBidReal = action.amount;
    a.currentBidder = p.playerId;
    a.bidThisTurn = p.playerId;
    p.counters.s4RaisedRound = ctx.s.round;
    a.hollowCoinOwner = null;
    if (a.players[p.playerId].bellArmed) {
      a.players[p.playerId].bellArmed = false;
      a.raiseBlockedPlayers = a.seatOrder.filter((id) => id !== p.playerId && !a.passedPlayers.includes(id));
    }
    a.stats.highestBid = Math.max(a.stats.highestBid, action.amount);
    if (houseRuleAt04(a, ctx.s.round) === "anonymousSeat") {
      log(ctx, m`An anonymous bidder raises to ${action.amount} Black Chips.`, "S4_BID");
      cue(ctx, "S4_BID", { amount: action.amount });
    } else {
      log(ctx, m`${p.nickname} bids ${action.amount} Black Chips.`, "S4_BID", p.playerId);
      cue(ctx, "S4_BID", { playerId: p.playerId, amount: action.amount });
    }
  },
};

export const PASS04: Spec<Extract<GameAction, { type: "PASS" }>> = {
  check: (s, p) => s.auction!.auctionOpen && !s.auction!.passedPlayers.includes(p.playerId) && s.auction!.currentBidder !== p.playerId
    ? null : fail("ILLEGAL_TARGET", m`You cannot pass this lot now.`),
  apply: (ctx, p) => {
    ctx.s.auction!.passedPlayers.push(p.playerId);
    log(ctx, m`${p.nickname} passes for this lot.`, "S4_PASS", p.playerId);
    cue(ctx, "S4_PASS", { playerId: p.playerId });
  },
};
