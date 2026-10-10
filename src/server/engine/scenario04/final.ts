import type { GameAction } from "../../../shared/game/actions.ts";
import { debtPenalty04 } from "../../../shared/game/scenario04/debt.ts";
import type { FinalPlayer04 } from "../../../shared/game/scenario04/types.ts";
import type { GameState } from "../../../shared/game/state.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { fail, type Spec } from "../actions.ts";
import { cue, log, type Ctx } from "../context.ts";
import { int } from "../rng.ts";

export function openFinal04(ctx: Ctx): void {
  const a = ctx.s.auction!;
  a.final = {
    stage: "SETTLEMENT", logStartSeq: ctx.s.logSeq, winnerId: null, tiedPlayerIds: [], showdown: null,
    players: Object.fromEntries(a.seatOrder.map((id): [string, FinalPlayer04] => {
      const p = ctx.s.players[id];
      return [id, {
        balance: debtPenalty04(a.players[id].debt) ? -debtPenalty04(a.players[id].debt) : 0,
        converted: { blackChips: 0, sanity: 0, fate: 0, ap: 0, items: [] },
        ready: false, usable: null, bid: null, revealReady: false,
        initial: { sanity: p.sanity, fate: p.fate, ap: 0, lost: p.lost, debt: a.players[id].debt },
      }];
    })),
  };
  a.currentBid = 0;
  a.currentBidReal = 0;
  a.currentBidder = null;
  a.turnPlayerId = null;
  a.auctionOpen = false;
  a.passedPlayers = [];
  cue(ctx, "S4_FINAL_SETTLEMENT");
}

export function startFinalSettlement04(ctx: Ctx): void {
  const final = ctx.s.auction!.final!;
  for (const id of ctx.s.auction!.seatOrder) final.players[id].initial.ap = ctx.s.players[id].ap;
}

const settlement = (s: GameState, id: string) => s.round === 10 && s.auction?.final?.stage === "SETTLEMENT" && !s.auction.final.players[id].ready;

export const FINAL_CONVERT04: Spec<Extract<GameAction, { type: "FINAL_CONVERT" }>> = {
  check: (s, p, action) => {
    if (!settlement(s, p.playerId)) return fail("WRONG_PHASE", m`Final Settlement is closed for you.`);
    if (!action) return null;
    const own = s.auction!.players[p.playerId];
    const spent = s.auction!.final!.players[p.playerId].converted;
    const valid = action.resource === "BLACK_CHIPS" ? own.blackChips > spent.blackChips && action.lotId === undefined
      : action.resource === "SANITY" ? p.sanity > spent.sanity && action.lotId === undefined
      : action.resource === "FATE" ? p.fate > spent.fate && action.lotId === undefined
      : action.resource === "AP" ? p.ap > spent.ap && action.lotId === undefined
      : action.resource === "ITEM" ? typeof action.lotId === "string" && own.items.includes(action.lotId) && !s.auction!.itemInstances[action.lotId]?.consumed
      : false;
    return valid ? null : fail("ILLEGAL_TARGET", m`That resource cannot be converted now.`);
  },
  apply: (ctx, p, action) => {
    const a = ctx.s.auction!;
    const own = a.players[p.playerId];
    const final = a.final!.players[p.playerId];
    const spent = final.converted;
    let gain = 0;
    if (action.resource === "BLACK_CHIPS") { gain = own.blackChips - spent.blackChips; spent.blackChips += gain; }
    else if (action.resource === "SANITY") { gain = p.sanity - spent.sanity; spent.sanity += gain; }
    else if (action.resource === "FATE") { gain = p.fate - spent.fate; spent.fate += gain; }
    else if (action.resource === "AP") { gain = p.ap - spent.ap; spent.ap += gain; }
    else {
      const id = action.lotId!;
      const instance = a.itemInstances[id];
      gain = instance.counterfeit ? 0 : 2;
      own.items.splice(own.items.indexOf(id), 1);
      instance.consumed = true;
      spent.items.push({ id, gain });
      own.itemNotice = { seq: ++own.itemNoticeSeq, at: ctx.now, lotId: id, result: gain ? "CONVERTED" : "CONVERTED_COUNTERFEIT" };
    }
    final.balance += gain;
  },
};

function awardExitRights(ctx: Ctx, winner: string | null, effectiveBid: number): void {
  const a = ctx.s.auction!;
  const final = a.final!;
  final.winnerId = winner;
  const paid = winner ? final.players[winner].bid! : 0;
  if (winner) final.players[winner].balance -= paid;
  a.currentBidder = winner;
  a.currentBid = winner ? effectiveBid : 0;
  a.currentBidReal = paid;
  a.stats.highestBid = Math.max(a.stats.highestBid, a.currentBid);
  a.auctionHistory.push({ round: 10, lotId: "LOT_10", itemInstanceId: "LOT_10", winnerId: winner, price: paid, openingPlayerId: a.seatOrder[0] });
  log(ctx, winner ? m`${ctx.s.players[winner].nickname} claims Exit Rights in the final reveal.` : m`No final bid claims Exit Rights.`, winner ? "S4_SOLD" : "S4_UNSOLD", winner ?? undefined);
}

function beginShowdown(ctx: Ctx, participants: string[], round: number): void {
  const final = ctx.s.auction!.final!;
  final.stage = "SHOWDOWN_PICK";
  final.showdown = {
    participatingPlayerIds: participants,
    showdownRound: round,
    cards: Object.fromEntries(participants.map((id) => [id, Array.from({ length: 5 }, () => 2 + int(ctx.s, 13))])),
    selectedCardIndex: Object.fromEntries(participants.map((id) => [id, null])),
    locked: Object.fromEntries(participants.map((id) => [id, false])),
    revealedCard: null,
    advancingPlayerIds: [],
    winnerId: null,
  };
  cue(ctx, "S4_FINAL_SHOWDOWN_START", { round, participatingPlayerIds: participants });
}

export const FINAL_READY04: Spec<Extract<GameAction, { type: "FINAL_READY" }>> = {
  check: (s, p) => settlement(s, p.playerId) ? null : fail("WRONG_PHASE", m`Your Final Settlement is already locked.`),
  apply: (ctx, p) => {
    const final = ctx.s.auction!.final!;
    const mine = final.players[p.playerId];
    mine.ready = true;
    mine.usable = Math.max(0, mine.balance);
    if (Object.values(final.players).every((entry) => entry.ready)) {
      final.stage = "AUCTION";
      cue(ctx, "S4_FINAL_AUCTION");
    }
  },
};

export const FINAL_BID04: Spec<Extract<GameAction, { type: "FINAL_BID" }>> = {
  check: (s, p, action) => {
    const final = s.auction?.final;
    const mine = final?.players[p.playerId];
    if (s.round !== 10 || final?.stage !== "AUCTION" || !mine?.ready || mine.bid !== null) return fail("WRONG_PHASE", m`Your final bid is already locked or the auction is closed.`);
    if (action && (!Number.isSafeInteger(action.amount) || action.amount < 0 || action.amount > mine.usable!)) return fail("ILLEGAL_TARGET", m`Choose a Final Bid within your usable Final Chips.`);
    return null;
  },
  apply: (ctx, p, action) => {
    const a = ctx.s.auction!;
    const final = a.final!;
    final.players[p.playerId].bid = action.amount;
    if (!Object.values(final.players).every((entry) => entry.bid !== null)) return;
    final.stage = "REVEAL";
    const ranked = a.seatOrder.map((id) => ({ id, bid: final.players[id].bid!, modifier: a.players[id].activeCrown ? 2 : 0 }))
      .sort((left, right) => (right.bid + right.modifier) - (left.bid + left.modifier));
    const topEffective = ranked[0].bid + ranked[0].modifier;
    final.tiedPlayerIds = ranked.filter(({ bid, modifier }) => bid + modifier === topEffective).map(({ id }) => id);
    if (final.tiedPlayerIds.length === 1) awardExitRights(ctx, topEffective > 0 ? ranked[0].id : null, topEffective);
    cue(ctx, "S4_FINAL_REVEAL", { winnerId: final.winnerId, tiedPlayerIds: final.tiedPlayerIds });
  },
};

export const FINAL_SHOWDOWN_PICK04: Spec<Extract<GameAction, { type: "FINAL_SHOWDOWN_PICK" }>> = {
  check: (s, p, action) => {
    const final = s.auction?.final;
    const showdown = final?.showdown;
    if (final?.stage !== "SHOWDOWN_PICK" || !showdown?.participatingPlayerIds.includes(p.playerId) || showdown.locked[p.playerId]) return fail("WRONG_PHASE", m`You cannot choose a Showdown card now.`);
    if (action && (!Number.isSafeInteger(action.cardIndex) || action.cardIndex < 0 || action.cardIndex >= 5)) return fail("ILLEGAL_TARGET", m`Choose one of the five hidden cards.`);
    return null;
  },
  apply: (ctx, p, action) => {
    const final = ctx.s.auction!.final!;
    const showdown = final.showdown!;
    showdown.selectedCardIndex[p.playerId] = action.cardIndex;
    showdown.locked[p.playerId] = true;
    if (!showdown.participatingPlayerIds.every((id) => showdown.locked[id])) return;
    showdown.revealedCard = Object.fromEntries(showdown.participatingPlayerIds.map((id) => [id, showdown.cards[id][showdown.selectedCardIndex[id]!] ]));
    const best = Math.max(...Object.values(showdown.revealedCard));
    showdown.advancingPlayerIds = showdown.participatingPlayerIds.filter((id) => showdown.revealedCard![id] === best);
    if (showdown.advancingPlayerIds.length === 1) {
      showdown.winnerId = showdown.advancingPlayerIds[0];
      const id = showdown.winnerId;
      const effectiveBid = final.players[id].bid! + (ctx.s.auction!.players[id].activeCrown ? 2 : 0);
      awardExitRights(ctx, id, effectiveBid);
    }
    for (const entry of Object.values(final.players)) entry.revealReady = false;
    final.stage = "SHOWDOWN_REVEAL";
    cue(ctx, "S4_FINAL_SHOWDOWN_REVEAL", { round: showdown.showdownRound, winnerId: showdown.winnerId });
  },
};

export const FINAL_CONTINUE04: Spec<Extract<GameAction, { type: "FINAL_CONTINUE" }>> = {
  check: (s, p) => (s.auction?.final?.stage === "REVEAL" || s.auction?.final?.stage === "SHOWDOWN_REVEAL") && !s.auction.final.players[p.playerId].revealReady
    ? null : fail("WRONG_PHASE", m`The final reveal is not waiting for you.`),
  apply: (ctx, p) => {
    const final = ctx.s.auction!.final!;
    final.players[p.playerId].revealReady = true;
    if (Object.values(final.players).every((entry) => entry.revealReady)) {
      if (final.stage === "REVEAL" && final.tiedPlayerIds.length > 1) beginShowdown(ctx, final.tiedPlayerIds, 1);
      else if (final.stage === "SHOWDOWN_REVEAL" && final.showdown!.advancingPlayerIds.length > 1) beginShowdown(ctx, final.showdown!.advancingPlayerIds, final.showdown!.showdownRound + 1);
      else {
        ctx.s.step = "WORLD";
        ctx.s.activeIndex = ctx.s.turnOrder.length;
      }
    }
  },
};
