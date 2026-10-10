import { m } from "../../../shared/i18n/msg.ts";
import { AUCTION_CONFIG04 } from "../../../shared/game/scenario04/config.ts";
import { log } from "../context.ts";
import { startEnding } from "../ending.ts";
import { registerScenario } from "../scenario.ts";
import { s04Actions } from "./actions.ts";
import { openAuctionRound04 } from "./auction.ts";
import { skipAuctionTurn04 } from "./auction.ts";
import { createScenario04 } from "./create.ts";

registerScenario({
  id: "S04_UNDERGROUND_AUCTION",
  create: createScenario04,
  get actions() { return s04Actions(); },
  itemPools: { any: [], buff: [] },
  roundOpens: openAuctionRound04,
  roundHeader: (s) => m`— Auction ${s.round} of 10 —`,
  apFor: (s, p) => p.lost ? 1 : s.auction!.players[p.playerId].items.includes("LOT_04") && s.round >= s.auction!.players[p.playerId].redContractStartsRound && s.auction!.players[p.playerId].redContractRemainingRounds > 0 ? 2 : 1,
  skipTurn: skipAuctionTurn04,
  roundCloses: (ctx) => {
    for (const player of Object.values(ctx.s.auction!.players)) {
      if (player.items.includes("LOT_04") && ctx.s.round >= player.redContractStartsRound && player.redContractRemainingRounds > 0) player.redContractRemainingRounds--;
    }
  },
  onRoundStart: () => {},
  afterTurns: () => "WORLD",
  worldStep: () => {},
  roundEvent: () => {},
  roundCollapse: () => {},
  afterRound: (ctx) => {
    if (ctx.s.round < 10) return false;
    const winner = ctx.s.auction!.auctionHistory.at(-1)?.winnerId;
    const debt = winner ? ctx.s.auction!.players[winner].debt : 0;
    startEnding(ctx, !winner ? "S04_UNSOLD" : debt >= AUCTION_CONFIG04.debtHeavyEnding ? "S04_DEBT" : "S04_EXIT");
    return true;
  },
  checkEnd: () => false,
  results: (ctx) => Object.values(ctx.s.players).map((p) => {
    const a = ctx.s.auction!;
    const held = a.players[p.playerId];
    const wins = a.auctionHistory.filter((entry) => entry.winnerId === p.playerId).length;
    return {
      playerId: p.playerId, obsession: null, obsessionMet: false,
      title: a.auctionHistory.at(-1)?.winnerId === p.playerId ? m`Exit Rights Holder` : wins ? m`Auction Winner` : m`Auction Witness`,
      highlights: [wins === 1 ? m`1 lot won` : m`${wins} lots won`, m`${held.debt} Debt at closing`],
      messages: [],
    };
  }),
  announceEnding: (ctx) => log(ctx, ctx.s.outcome === "S04_EXIT" ? m`Exit Rights are claimed; the winner leaves the table.` : ctx.s.outcome === "S04_DEBT" ? m`Exit Rights are claimed, but the debt follows the winner.` : m`Exit Rights are withdrawn. Nobody leaves the table.`, "STORY"),
  runJob: () => {},
});
