import type { GameAction } from "../../../shared/game/actions.ts";
import type { LotId04 } from "../../../shared/game/scenario04/types.ts";
import type { GameState } from "../../../shared/game/state.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { fail, type Spec } from "../actions.ts";
import { cue, log } from "../context.ts";
import { loseSanity } from "../players.ts";

const ACTIVE_LOTS: LotId04[] = ["LOT_02", "LOT_06", "LOT_09"];

function usable(s: GameState, playerId: string, lotId: LotId04): boolean {
  const holder = s.auction!.players[playerId];
  if (!ACTIVE_LOTS.includes(lotId) || !holder.items.includes(lotId)) return false;
  if (Object.values(s.auction!.players).some((p) => p.usedLotEffects.includes(lotId))) return false;
  if (lotId === "LOT_06" && holder.debt === 0) return false;
  if (lotId === "LOT_09" && s.players[playerId].sanity === 0) return false;
  return true;
}

export const USE_LOT04: Spec<Extract<GameAction, { type: "USE_LOT" }>> = {
  targets: (s, p) => s.auction!.players[p.playerId].items,
  check: (s, p, action) => {
    if (!action) return s.auction!.players[p.playerId].items.length ? null : fail("ILLEGAL_TARGET", m`You have no auction item.`);
    return usable(s, p.playerId, action.lotId) ? null : fail("ILLEGAL_TARGET", m`That auction item cannot be used now.`);
  },
  apply: (ctx, p, action) => {
    const a = ctx.s.auction!;
    const holder = a.players[p.playerId];
    holder.usedLotEffects.push(action.lotId);
    if (action.lotId === "LOT_02") {
      holder.glassEyeSnapshots.push({ round: ctx.s.round, chips: Object.fromEntries(a.seatOrder.filter((id) => id !== p.playerId).map((id) => [id, a.players[id].blackChips])) });
      log(ctx, m`${p.nickname} uses the Glass Eye.`, "S4_ITEM", p.playerId);
    } else if (action.lotId === "LOT_06") {
      holder.debt = 0;
      log(ctx, m`${p.nickname} clears their Debt with Bottomless Credit.`, "S4_ITEM", p.playerId);
    } else if (action.lotId === "LOT_09") {
      const sanity = p.sanity;
      holder.blackChips += sanity;
      loseSanity(ctx, p, sanity, m`using the Devil's Key`);
      log(ctx, m`${p.nickname} turns Sanity into Black Chips with the Devil's Key.`, "S4_ITEM", p.playerId);
    }
    cue(ctx, "S4_ITEM_USED", { playerId: p.playerId, lotId: action.lotId });
  },
};
