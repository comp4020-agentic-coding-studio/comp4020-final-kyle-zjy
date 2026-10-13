import type { GameAction } from "../../../shared/game/actions.ts";
import { LOTS04 } from "../../../shared/game/scenario04/lots.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { fail, type Spec } from "../actions.ts";
import { generateAuctionPool04 } from "./pool.ts";
import { noticeAcquiredLot04 } from "./items.ts";

export const DEV_GRANT_LOT04: Spec<Extract<GameAction, { type: "DEV_GRANT_LOT" }>> = {
  check: (s, _p, action) => s.flags.developerCheck !== 1 || !action || typeof action.counterfeit !== "boolean" || !LOTS04.some((lot) => lot.id === action.lotId && lot.id !== "LOT_10")
    ? fail("INVALID", m`This item sandbox is available only in a Scenario 04 developer room.`) : null,
  apply: (ctx, p, action) => {
    const a = ctx.s.auction!;
    const itemInstanceId = `LOT_DEV_${action.lotId.slice(-2)}_${a.nextItemInstanceNumber++}` as const;
    a.itemInstances[itemInstanceId] = { itemInstanceId, lotId: action.lotId, offeredRound: ctx.s.round, counterfeit: action.counterfeit, sourceItemInstanceId: null, consumed: false };
    a.players[p.playerId].items.push(itemInstanceId);
    noticeAcquiredLot04(a.players[p.playerId], itemInstanceId, ctx.now);
  },
};

export const DEV_GENERATE_POOL04: Spec<Extract<GameAction, { type: "DEV_GENERATE_POOL" }>> = {
  check: (s) => s.flags.developerCheck === 1 ? null : fail("INVALID", m`This item sandbox is available only in a Scenario 04 developer room.`),
  apply: (ctx) => {
    const label = `${ctx.s.seed}:${ctx.s.rngCalls}`;
    const pool = generateAuctionPool04(ctx.s);
    ctx.s.auction!.debugPreview = { seed: label, ...pool };
  },
};
