import type { GameAction } from "../../../shared/game/actions.ts";
import { lotForRound04 } from "../../../shared/game/scenario04/lots.ts";
import type { GameState, PlayerGameState, PlayerId } from "../../../shared/game/state.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { fail, type Spec } from "../actions.ts";
import { cue, log, type Ctx } from "../context.ts";
import { nextTurn } from "../flow.ts";

export function openAuctionRound04(ctx: Ctx): void {
  const s = ctx.s;
  const auction = s.auction!;
  const prior = auction.auctionHistory.at(-1);
  const previous = prior?.winnerId ?? prior?.openingPlayerId;
  const start = previous ? auction.seatOrder[(auction.seatOrder.indexOf(previous) + 1) % auction.seatOrder.length] : auction.seatOrder[0];
  const index = auction.seatOrder.indexOf(start);
  s.turnOrder = [...auction.seatOrder.slice(index), ...auction.seatOrder.slice(0, index)];
  auction.currentLot = lotForRound04(s.round).id;
  if (s.round === 7) auction.connectedPlayerId = auction.seatOrder[6 % auction.seatOrder.length];
  auction.currentBid = lotForRound04(s.round).startingBid - 1;
  auction.currentBidder = null;
  auction.roundStartPlayerId = start;
  auction.turnPlayerId = start;
  auction.passedPlayers = [];
  auction.auctionOpen = true;
  auction.deal = null;
  auction.challenge = null;
  cue(ctx, "S4_ROUND", { round: s.round, lotId: auction.currentLot });
}

function closeAuction04(ctx: Ctx): void {
  const s = ctx.s;
  const a = s.auction!;
  const winner = a.currentBidder;
  if (winner) {
    const player = a.players[winner];
    const crownDiscount = s.round === 10 && player.items.includes("LOT_08") ? 2 : 0;
    player.blackChips -= Math.max(0, a.currentBid - crownDiscount);
    player.items.push(a.currentLot);
    a.stats.highestBid = Math.max(a.stats.highestBid, a.currentBid);
    log(ctx, m`${s.players[winner].nickname} wins the lot for ${a.currentBid} Black Chips.`, "S4_SOLD", winner);
  } else {
    log(ctx, m`The lot receives no bids and is withdrawn.`, "S4_UNSOLD");
  }
  a.auctionHistory.push({ round: s.round, lotId: a.currentLot, winnerId: winner, price: winner ? a.currentBid : 0, openingPlayerId: a.roundStartPlayerId });
  a.auctionOpen = false;
  a.turnPlayerId = null;
  s.step = "WORLD";
  s.activeIndex = s.turnOrder.length;
  s.turnDeadline = null;
  cue(ctx, winner ? "S4_SOLD" : "S4_UNSOLD", { round: s.round, lotId: a.currentLot, winnerId: winner, price: winner ? a.currentBid : 0 });
}

export function advanceAuction04(ctx: Ctx, from: PlayerId): void {
  const s = ctx.s;
  const a = s.auction!;
  if (!a.auctionOpen) return;
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

export const BID04: Spec<Extract<GameAction, { type: "BID" }>> = {
  check: (s, p, action) => {
    const a = s.auction!;
    if (!a.auctionOpen || a.passedPlayers.includes(p.playerId) || a.currentBidder === p.playerId) return fail("ILLEGAL_TARGET", m`You cannot bid on this lot now.`);
    if (action && (!Number.isSafeInteger(action.amount) || action.amount <= a.currentBid || action.amount < lotForRound04(s.round).startingBid)) return fail("INVALID", m`Choose a higher whole-number bid.`);
    const chips = a.players[p.playerId].blackChips + (s.round === 10 && a.players[p.playerId].items.includes("LOT_08") ? 2 : 0);
    if (chips <= a.currentBid || chips < lotForRound04(s.round).startingBid) return fail("ILLEGAL_TARGET", m`You do not have enough Black Chips to bid.`);
    if (action && action.amount > chips) return fail("ILLEGAL_TARGET", m`You cannot bid more Black Chips than you hold.`);
    return null;
  },
  targets: (s, p) => {
    const a = s.auction!;
    const limit = a.players[p.playerId].blackChips + (s.round === 10 && a.players[p.playerId].items.includes("LOT_08") ? 2 : 0);
    const floor = Math.max(a.currentBid + 1, lotForRound04(Math.max(1, s.round)).startingBid);
    return Array.from({ length: Math.max(0, limit - floor + 1) }, (_, i) => floor + i);
  },
  apply: (ctx, p, action) => {
    const a = ctx.s.auction!;
    a.currentBid = action.amount;
    a.currentBidder = p.playerId;
    a.stats.highestBid = Math.max(a.stats.highestBid, action.amount);
    log(ctx, m`${p.nickname} bids ${action.amount} Black Chips.`, "S4_BID", p.playerId);
    cue(ctx, "S4_BID", { playerId: p.playerId, amount: action.amount });
    advanceAuction04(ctx, p.playerId);
  },
};

export const PASS04: Spec<Extract<GameAction, { type: "PASS" }>> = {
  check: (s, p) => s.auction!.auctionOpen && !s.auction!.passedPlayers.includes(p.playerId) && s.auction!.currentBidder !== p.playerId
    ? null : fail("ILLEGAL_TARGET", m`You cannot pass this lot now.`),
  apply: (ctx, p) => {
    ctx.s.auction!.passedPlayers.push(p.playerId);
    log(ctx, m`${p.nickname} passes for this lot.`, "S4_PASS", p.playerId);
    cue(ctx, "S4_PASS", { playerId: p.playerId });
    advanceAuction04(ctx, p.playerId);
  },
};
