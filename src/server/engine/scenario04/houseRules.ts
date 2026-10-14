import type { GameAction } from "../../../shared/game/actions.ts";
import { debtPenalty04, finalBidModifier04, GENUINE_ITEM_FINAL_VALUE04 } from "../../../shared/game/scenario04/debt.ts";
import { houseRuleAt04 } from "../../../shared/game/scenario04/houseRules.ts";
import { itemLotId04 } from "../../../shared/game/scenario04/lots.ts";
import type { PreliminarySettlement04 } from "../../../shared/game/scenario04/types.ts";
import type { GameState } from "../../../shared/game/state.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { fail, type Spec } from "../actions.ts";
import { cue, type Ctx } from "../context.ts";
import { int } from "../rng.ts";

export function preliminarySettlement04(s: GameState, playerId: string): PreliminarySettlement04 {
  const held = s.auction!.players[playerId];
  const player = s.players[playerId];
  const genuineItems = held.items.filter((id) => !s.auction!.itemInstances[id]?.counterfeit && !s.auction!.itemInstances[id]?.consumed).length;
  const itemValue = genuineItems * GENUINE_ITEM_FINAL_VALUE04;
  const debtPenalty = debtPenalty04(held.debt);
  const finalModifier = finalBidModifier04(held);
  return { blackChips: held.blackChips, sanity: player.sanity, fate: player.fate, ap: player.ap,
    genuineItems, itemValue, debtPenalty, finalModifier,
    total: Math.max(0, held.blackChips + player.sanity + player.fate + player.ap + itemValue - debtPenalty) + finalModifier };
}

export function autoDeclareHolding04(ctx: Ctx, playerId: string): void {
  const a = ctx.s.auction!;
  if (houseRuleAt04(a, ctx.s.round) !== "holdingDisclosure" || !a.holdingPendingIds?.includes(playerId)) return;
  const items = a.players[playerId].items;
  if (!items.length) { a.holdingPendingIds = a.holdingPendingIds.filter((id) => id !== playerId); return; }
  declare(ctx, playerId, items[int(ctx.s, items.length)]);
}

function declare(ctx: Ctx, playerId: string, itemId: string): void {
  const a = ctx.s.auction!;
  (a.holdingDeclarations ??= {})[playerId] = itemLotId04(itemId as `LOT_${string}`);
  a.holdingPendingIds = (a.holdingPendingIds ?? []).filter((id) => id !== playerId);
  cue(ctx, "S4_HOLDING_DECLARED", { playerId, lotId: itemLotId04(itemId as `LOT_${string}`) });
}

export const DECLARE_HOLDING04: Spec<Extract<GameAction, { type: "DECLARE_HOLDING" }>> = {
  targets: (s, p) => s.auction!.players[p.playerId].items,
  check: (s, p, action) => {
    if (houseRuleAt04(s.auction, s.round) !== "holdingDisclosure" || !s.auction!.holdingPendingIds?.includes(p.playerId)) return fail("WRONG_PHASE", m`You have no holding to declare this round.`);
    if (action && !s.auction!.players[p.playerId].items.includes(action.itemId)) return fail("ILLEGAL_TARGET", m`Declare an item you currently hold.`);
    return null;
  },
  apply: (ctx, p, action) => declare(ctx, p.playerId, action.itemId),
};
