import type { GameAction } from "../../../shared/game/actions.ts";
import { AUCTION_CONFIG04 } from "../../../shared/game/scenario04/config.ts";
import { GENUINE_ITEM_FINAL_VALUE04 } from "../../../shared/game/scenario04/debt.ts";
import { houseRuleAt04 } from "../../../shared/game/scenario04/houseRules.ts";
import { copyItemId04, itemLotId04, lotForAuctionRound04, LOTS04 } from "../../../shared/game/scenario04/lots.ts";
import type { AuctionPlayer04, IntelId04, LotId04 } from "../../../shared/game/scenario04/types.ts";
import type { GameState } from "../../../shared/game/state.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { MAX_SANITY } from "../../../shared/game/scenario01/content.ts";
import { fail, type Spec } from "../actions.ts";
import { cue, log, type Ctx } from "../context.ts";
import { gainSanity, loseSanity } from "../players.ts";
import { closeTop } from "../windows.ts";

function earlierInstance(s: GameState, keyItemId: LotId04, sourceLotId: LotId04 | undefined) {
  if (!sourceLotId) return null;
  const keyRound = s.auction!.itemInstances[keyItemId]?.offeredRound;
  if (keyRound === undefined) return null;
  const history = s.auction!.auctionHistory.find((entry) => entry.lotId === sourceLotId && entry.round < keyRound);
  return history ? s.auction!.itemInstances[history.itemInstanceId] ?? null : null;
}

export function consumeLot04(ctx: Ctx, playerId: string, itemId: LotId04, result: "ACTIVATED" | "COUNTERFEIT" = "ACTIVATED"): boolean {
  const a = ctx.s.auction!;
  const holder = a.players[playerId];
  const instance = a.itemInstances[itemId];
  if (!instance || instance.consumed || !holder.items.includes(itemId)) return false;
  holder.items.splice(holder.items.indexOf(itemId), 1);
  instance.consumed = true;
  holder.usedLotEffects.push(itemId);
  const counterfeit = instance.counterfeit;
  if (counterfeit) {
    const intel = `${instance.lotId}_COUNTERFEIT` as IntelId04;
    if (!holder.privateIntel.includes(intel)) holder.privateIntel.push(intel);
  }
  holder.itemNotice = { seq: ++holder.itemNoticeSeq, at: ctx.now, lotId: itemId, result: counterfeit ? "COUNTERFEIT" : result };
  if (ctx.s.round !== 10) {
    log(ctx, m`${ctx.s.players[playerId].nickname} uses an auction item.`, "S4_ITEM", playerId);
    cue(ctx, "S4_ITEM_USED", { playerId, lotId: itemId });
  }
  return !counterfeit;
}

export function heldLot04(s: GameState, playerId: string, base: LotId04): LotId04 | null {
  return s.auction?.players[playerId].items.find((id) => itemLotId04(id) === base) ?? null;
}

export function confirmPassiveFake04(ctx: Ctx, playerId: string, itemId: LotId04): void {
  const a = ctx.s.auction!;
  const holder = a.players[playerId];
  const intel = `${itemLotId04(itemId)}_COUNTERFEIT` as IntelId04;
  if (holder.privateIntel.includes(intel)) return;
  holder.privateIntel.push(intel);
  holder.itemNotice = { seq: ++holder.itemNoticeSeq, at: ctx.now, lotId: itemId, result: "COUNTERFEIT" };
}

export function noticeAcquiredLot04(holder: AuctionPlayer04, lotId: LotId04, at: number): void {
  holder.itemNotice = { seq: ++holder.itemNoticeSeq, at, lotId, result: "ACQUIRED" };
}

function usable(s: GameState, playerId: string, action: Extract<GameAction, { type: "USE_LOT" }>): boolean {
  const a = s.auction!;
  const holder = s.auction!.players[playerId];
  if (!holder.items.includes(action.lotId)) return false;
  const instance = s.auction!.itemInstances[action.lotId];
  if (!instance || instance.consumed) return false;
  const base = itemLotId04(action.lotId);
  if (base === "LOT_05") return !!earlierInstance(s, action.lotId, action.sourceLotId);
  if (base === "LOT_25" || base === "LOT_27" || base === "LOT_29" || base === "LOT_20") return false;
  if (base === "LOT_14") return !!a.deal && [a.deal.from, a.deal.to].includes(playerId);
  if (a.deal || s.pending.some((w) => w.blocksTable)) return false;
  if (base === "LOT_12") return s.round === 10 && a.final?.stage === "SETTLEMENT" && !a.final.players[playerId].ready;
  if (base === "LOT_17") {
    const rule = houseRuleAt04(a, s.round);
    const minimum = Math.max(lotForAuctionRound04(s, s.round).startingBid, a.currentBid + (rule === "doubleRaise" && a.currentBidder ? 2 : 1));
    return s.round < 10 && a.auctionOpen && a.passedPlayers.includes(playerId) && a.bidThisTurn !== playerId && !a.raiseBlockedPlayers?.includes(playerId) && !(rule === "singleRaise" && s.players[playerId].counters.s4RaisedRound === s.round) && Number.isSafeInteger(action.amount) && action.amount! >= minimum && action.amount! <= holder.blackChips;
  }
  if (base === "LOT_18" || base === "LOT_21") return !!action.targetId && action.targetId !== playerId && a.seatOrder.includes(action.targetId);
  if (base === "LOT_15") return !!action.sourceLotId && a.auctionHistory.some((entry) => entry.lotId === action.sourceLotId && entry.round > instance.offeredRound && entry.winnerId && entry.winnerId !== playerId);
  if (base === "LOT_24") return !!action.sourceLotId && action.sourceLotId !== action.lotId && holder.items.includes(action.sourceLotId) && !holder.privateIntel.some((id) => id === `${itemLotId04(action.sourceLotId!)}_COUNTERFEIT` || id === `${itemLotId04(action.sourceLotId!)}_AUTHENTIC`);
  if (base === "LOT_30") return s.round === 10 && a.final?.stage === "SETTLEMENT" && !!action.sourceLotId && action.sourceLotId !== action.lotId && holder.items.includes(action.sourceLotId) && !a.itemInstances[action.sourceLotId]?.counterfeit;
  if (action.sourceLotId !== undefined || action.targetId !== undefined || action.amount !== undefined) return false;
  if (base === "LOT_06" && holder.debt === 0) return false;
  if (base === "LOT_19" && holder.debt === 0) return false;
  if (base === "LOT_26") return a.auctionOpen && a.currentBidder === playerId && holder.blackChips >= a.currentBidReal + 1;
  if (base === "LOT_11" || base === "LOT_13" || base === "LOT_16" || base === "LOT_22" || base === "LOT_23") return s.round < 10 && a.auctionOpen;
  if (base === "LOT_28") return s.round < 10 && a.auctionOpen && s.players[playerId].ap === 0;
  const investedSanity = s.auction!.final?.players[playerId]?.converted.sanity ?? 0;
  if (base === "LOT_09" && (s.players[playerId].sanity <= investedSanity || holder.sanityWard)) return false;
  return base !== "LOT_10";
}

export const USE_LOT04: Spec<Extract<GameAction, { type: "USE_LOT" }>> = {
  targets: (s, p) => s.auction!.players[p.playerId].items.filter((id) => !["LOT_14", "LOT_15", "LOT_17", "LOT_18", "LOT_20", "LOT_21", "LOT_24", "LOT_25", "LOT_27", "LOT_29", "LOT_30"].includes(itemLotId04(id)) || itemLotId04(id) === "LOT_14" && !!s.auction!.deal),
  check: (s, p, action) => {
    if (!action) return s.auction!.players[p.playerId].items.length ? null : fail("ILLEGAL_TARGET", m`You have no auction item.`);
    return usable(s, p.playerId, action) ? null : fail("ILLEGAL_TARGET", m`That auction item cannot be used now.`);
  },
  apply: (ctx, p, action) => {
    const a = ctx.s.auction!;
    const holder = a.players[p.playerId];
    const base = itemLotId04(action.lotId);
    const instance = a.itemInstances[action.lotId];
    const genuine = consumeLot04(ctx, p.playerId, action.lotId);
    let copyLotId: LotId04 | undefined;
    if (!genuine) return;
    if (base === "LOT_01") {
      holder.armedBlackDie++;
    } else if (base === "LOT_02") {
      holder.glassEyeSnapshots.push({ round: ctx.s.round, chips: Object.fromEntries(a.seatOrder.filter((id) => id !== p.playerId).map((id) => [id, a.players[id].blackChips])) });
    } else if (base === "LOT_03") {
      holder.armedCoin++;
    } else if (base === "LOT_04") {
      holder.redContractRemainingRounds = AUCTION_CONFIG04.redContractRounds;
      holder.redContractStartsRound = ctx.s.round + 1;
    } else if (base === "LOT_05") {
      const source = earlierInstance(ctx.s, action.lotId, action.sourceLotId)!;
      copyLotId = source.lotId;
      const itemInstanceId = copyItemId04(source.lotId, a.nextItemInstanceNumber++);
      a.itemInstances[itemInstanceId] = {
        itemInstanceId, lotId: source.lotId, offeredRound: source.offeredRound,
        counterfeit: source.counterfeit, sourceItemInstanceId: source.itemInstanceId, consumed: false,
      };
      holder.items.push(itemInstanceId);
      holder.itemNotice = { seq: ++holder.itemNoticeSeq, at: ctx.now, lotId: action.lotId, result: "COPIED", copyLotId };
    } else if (base === "LOT_06") {
      holder.debt = 0;
    } else if (base === "LOT_07") {
      holder.sanityWard = true;
      gainSanity(ctx, p, MAX_SANITY - p.sanity, m`the Nameless File`);
    } else if (base === "LOT_08") {
      holder.activeCrown = true;
    } else if (base === "LOT_09") {
      const sanity = p.sanity - (a.final?.players[p.playerId]?.converted.sanity ?? 0);
      holder.blackChips += sanity;
      loseSanity(ctx, p, sanity, m`using the Devil's Key`);
    } else if (base === "LOT_11") {
      holder.bellArmed = true;
    } else if (base === "LOT_12") {
      const hasOther = holder.items.some((id) => !a.itemInstances[id].counterfeit && !a.itemInstances[id].consumed);
      (holder.finalItemModifiers ??= []).push({ lotId: action.lotId, amount: hasOther ? 3 : 2 });
    } else if (base === "LOT_13") {
      holder.blankChequeArmed = true;
    } else if (base === "LOT_14") {
      a.deal = null;
      closeTop(ctx);
    } else if (base === "LOT_15") {
      const lot = LOTS04.find((entry) => entry.id === action.sourceLotId)!;
      (holder.privateObservations ??= []).push({ kind: "ITEM_HINT", lotId: lot.id, value: lot.hiddenInfo });
    } else if (base === "LOT_16") {
      holder.mirrorArmed = true;
    } else if (base === "LOT_17") {
      a.passedPlayers.splice(a.passedPlayers.indexOf(p.playerId), 1);
      a.currentBid = action.amount!;
      a.currentBidReal = action.amount!;
      a.currentBidder = p.playerId;
      a.bidThisTurn = p.playerId;
      p.counters.s4RaisedRound = ctx.s.round;
      a.hollowCoinOwner = null;
      if (holder.bellArmed) {
        holder.bellArmed = false;
        a.raiseBlockedPlayers = a.seatOrder.filter((id) => id !== p.playerId && !a.passedPlayers.includes(id));
      }
      a.stats.highestBid = Math.max(a.stats.highestBid, action.amount!);
      if (houseRuleAt04(a, ctx.s.round) === "anonymousSeat") {
        log(ctx, m`An anonymous bidder raises to ${action.amount!} Black Chips.`, "S4_BID");
        cue(ctx, "S4_BID", { amount: action.amount! });
      } else {
        log(ctx, m`${p.nickname} bids ${action.amount!} Black Chips.`, "S4_BID", p.playerId);
        cue(ctx, "S4_BID", { playerId: p.playerId, amount: action.amount! });
      }
    } else if (base === "LOT_18") {
      const n = a.players[action.targetId!].blackChips;
      (holder.privateObservations ??= []).push({ kind: "CHIP_BAND", targetId: action.targetId, value: n <= 3 ? "0–3" : n <= 6 ? "4–6" : "7+" });
    } else if (base === "LOT_19") {
      holder.debt = Math.max(0, holder.debt - 2);
    } else if (base === "LOT_21") {
      holder.secondWillBeneficiaryId = action.targetId!;
    } else if (base === "LOT_22") {
      holder.invitationReady = true;
    } else if (base === "LOT_23") {
      holder.glassCupArmed = true;
    } else if (base === "LOT_24") {
      const target = a.itemInstances[action.sourceLotId!]!;
      (holder.privateObservations ??= []).push({ kind: "AUTH_CHECK", lotId: action.sourceLotId, value: target.counterfeit ? "ANOMALY" : "CLEAR" });
      const intel = `${target.lotId}_${target.counterfeit ? "COUNTERFEIT" : "AUTHENTIC"}` as IntelId04;
      if (!holder.privateIntel.includes(intel)) holder.privateIntel.push(intel);
    } else if (base === "LOT_26") {
      a.currentBid++;
      a.currentBidReal++;
      a.hollowCoinOwner = p.playerId;
    } else if (base === "LOT_28") {
      holder.membershipArmed = true;
    } else if (base === "LOT_30") {
      const burned = action.sourceLotId!;
      holder.items.splice(holder.items.indexOf(burned), 1);
      a.itemInstances[burned].consumed = true;
      (holder.finalItemModifiers ??= []).push({ lotId: action.lotId, amount: 3, burnedItemId: burned, burnedValue: GENUINE_ITEM_FINAL_VALUE04 });
    }
  },
};
