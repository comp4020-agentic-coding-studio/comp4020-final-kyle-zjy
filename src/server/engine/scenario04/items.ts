import type { GameAction } from "../../../shared/game/actions.ts";
import { AUCTION_CONFIG04 } from "../../../shared/game/scenario04/config.ts";
import { copyItemId04, itemLotId04 } from "../../../shared/game/scenario04/lots.ts";
import type { LotId04 } from "../../../shared/game/scenario04/types.ts";
import type { GameState } from "../../../shared/game/state.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { MAX_SANITY } from "../../../shared/game/scenario01/content.ts";
import { fail, type Spec } from "../actions.ts";
import { cue, log } from "../context.ts";
import { gainSanity, loseSanity } from "../players.ts";

function earlierInstance(s: GameState, sourceLotId: LotId04 | undefined) {
  if (!sourceLotId) return null;
  const keyRound = s.auction!.itemInstances.LOT_05?.offeredRound;
  if (keyRound === undefined) return null;
  const history = s.auction!.auctionHistory.find((entry) => entry.lotId === sourceLotId && entry.round < keyRound);
  return history ? s.auction!.itemInstances[history.itemInstanceId] ?? null : null;
}

function usable(s: GameState, playerId: string, action: Extract<GameAction, { type: "USE_LOT" }>): boolean {
  const holder = s.auction!.players[playerId];
  if (!holder.items.includes(action.lotId)) return false;
  const instance = s.auction!.itemInstances[action.lotId];
  if (!instance || instance.consumed) return false;
  const base = itemLotId04(action.lotId);
  if (base === "LOT_05") return !!earlierInstance(s, action.sourceLotId);
  if (action.sourceLotId !== undefined) return false;
  if (base === "LOT_06" && holder.debt === 0) return false;
  if (base === "LOT_09" && (s.players[playerId].sanity === 0 || holder.sanityWard)) return false;
  return base !== "LOT_10";
}

export const USE_LOT04: Spec<Extract<GameAction, { type: "USE_LOT" }>> = {
  targets: (s, p) => s.auction!.players[p.playerId].items,
  check: (s, p, action) => {
    if (!action) return s.auction!.players[p.playerId].items.length ? null : fail("ILLEGAL_TARGET", m`You have no auction item.`);
    return usable(s, p.playerId, action) ? null : fail("ILLEGAL_TARGET", m`That auction item cannot be used now.`);
  },
  apply: (ctx, p, action) => {
    const a = ctx.s.auction!;
    const holder = a.players[p.playerId];
    const base = itemLotId04(action.lotId);
    const instance = a.itemInstances[action.lotId];
    const counterfeit = instance.counterfeit;
    holder.items.splice(holder.items.indexOf(action.lotId), 1);
    instance.consumed = true;
    holder.usedLotEffects.push(action.lotId);
    let result: "ACTIVATED" | "COUNTERFEIT" | "COPIED" = counterfeit ? "COUNTERFEIT" : "ACTIVATED";
    let copyLotId: LotId04 | undefined;
    if (counterfeit) {
      const intel = `${base}_COUNTERFEIT` as const;
      if (!holder.privateIntel.includes(intel)) holder.privateIntel.push(intel);
    } else if (base === "LOT_01") {
      holder.armedBlackDie++;
    } else if (base === "LOT_02") {
      holder.glassEyeSnapshots.push({ round: ctx.s.round, chips: Object.fromEntries(a.seatOrder.filter((id) => id !== p.playerId).map((id) => [id, a.players[id].blackChips])) });
    } else if (base === "LOT_03") {
      holder.armedCoin++;
    } else if (base === "LOT_04") {
      holder.redContractRemainingRounds = AUCTION_CONFIG04.redContractRounds;
      holder.redContractStartsRound = ctx.s.round + 1;
    } else if (base === "LOT_05") {
      const source = earlierInstance(ctx.s, action.sourceLotId)!;
      copyLotId = source.lotId;
      const itemInstanceId = copyItemId04(source.lotId, a.nextItemInstanceNumber++);
      a.itemInstances[itemInstanceId] = {
        itemInstanceId, lotId: source.lotId, offeredRound: source.offeredRound,
        counterfeit: source.counterfeit, sourceItemInstanceId: source.itemInstanceId, consumed: false,
      };
      holder.items.push(itemInstanceId);
      result = "COPIED";
    } else if (base === "LOT_06") {
      holder.debt = 0;
    } else if (base === "LOT_07") {
      holder.sanityWard = true;
      gainSanity(ctx, p, MAX_SANITY - p.sanity, m`the Nameless File`);
    } else if (base === "LOT_08") {
      holder.activeCrown = true;
    } else if (base === "LOT_09") {
      const sanity = p.sanity;
      holder.blackChips += sanity;
      loseSanity(ctx, p, sanity, m`using the Devil's Key`);
    }
    log(ctx, m`${p.nickname} uses an auction item.`, "S4_ITEM", p.playerId);
    holder.itemNotice = { seq: holder.usedLotEffects.length, lotId: action.lotId, result, copyLotId };
    cue(ctx, "S4_ITEM_USED", { playerId: p.playerId, lotId: action.lotId });
  },
};
