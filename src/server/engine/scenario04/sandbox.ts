import type { GameAction } from "../../../shared/game/actions.ts";
import { LOTS04 } from "../../../shared/game/scenario04/lots.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { fail, type Spec } from "../actions.ts";
import { generateAuctionPool04 } from "./pool.ts";
import { noticeAcquiredLot04 } from "./items.ts";
import { SHUFFLED_HOUSE_RULES04 } from "../../../shared/game/scenario04/houseRules.ts";
import { shuffle } from "../rng.ts";

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

export const DEV_SET_HOUSE_RULE04: Spec<Extract<GameAction, { type: "DEV_SET_HOUSE_RULE" }>> = {
  check: (s, _p, action) => s.flags.developerCheck !== 1 || !action || !["openingCourtesy", ...SHUFFLED_HOUSE_RULES04, "finalSettlement"].includes(action.ruleId) || s.round < 1 || s.round > 10
    ? fail("INVALID", m`This House Rule preview is available only in a Scenario 04 developer room.`) : null,
  apply: (ctx, _p, action) => {
    const a = ctx.s.auction!;
    (a.houseRuleOrder ??= Array(10).fill("openingCourtesy"))[ctx.s.round - 1] = action.ruleId;
    a.houseChallengeBonusClaimed = false;
    a.holdingDeclarations = {};
    a.holdingPendingIds = action.ruleId === "holdingDisclosure" ? a.seatOrder.filter((id) => a.players[id].items.length > 0) : [];
    a.publicTrades = [];
    for (const p of Object.values(ctx.s.players)) { p.counters.s4CourtesyUsedRound = 0; p.counters.s4RaisedRound = 0; }
  },
};

export const DEV_GENERATE_HOUSE_RULES04: Spec<Extract<GameAction, { type: "DEV_GENERATE_HOUSE_RULES" }>> = {
  check: (s) => s.flags.developerCheck === 1 ? null : fail("INVALID", m`This House Rule preview is available only in a Scenario 04 developer room.`),
  apply: (ctx) => {
    const seed = `${ctx.s.seed}:${ctx.s.rngCalls}`;
    ctx.s.auction!.debugHouseRulePreview = { seed, order: ["openingCourtesy", ...shuffle(ctx.s, SHUFFLED_HOUSE_RULES04), "finalSettlement"] };
  },
};
