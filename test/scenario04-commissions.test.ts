import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { commissionFor04, commissionMet04 } from "../src/server/engine/scenario04/commissions.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";

function start(seed = SEED): GameState {
  let s = startGame(createGame("s4-commission", seatsFor(3), seed, T0, "S04_UNDERGROUND_AUCTION"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
}

describe("Scenario 04 secret commissions", () => {
  it("is chosen per seed and player without drawing from the seeded RNG", () => {
    const a = start();
    const b = start();
    expect(["a", "b", "c"].map((id) => a.secrets[id].commission04!.id)).toEqual(["a", "b", "c"].map((id) => b.secrets[id].commission04!.id));
    expect(a.secrets.a.commission04!.id).toBe(commissionFor04(SEED, "a"));
    // different seeds spread across the table (not one fixed commission)
    const seen = new Set(Array.from({ length: 30 }, (_, i) => commissionFor04(`seed-${i}`, "a")));
    expect(seen.size).toBeGreaterThan(2);
    // the pool draw (which uses the RNG) is unchanged by commissions: same call count as before they existed
    expect(a.rngCalls).toBe(b.rngCalls);
  });

  it("is sent only to its owner while the game runs", () => {
    const s = start();
    for (const viewer of ["a", "b", "c"]) {
      const view = project(s, viewer);
      expect(view.mySecrets!.commission04!.id).toBe(s.secrets[viewer].commission04!.id);
      expect(view.results).toBeNull();
      for (const other of ["a", "b", "c"].filter((id) => id !== viewer)) {
        expect(JSON.stringify(view).split("commission04").length - 1).toBe(1); // only the owner's own
        expect(view.players[other]).not.toHaveProperty("commission04");
      }
    }
  });

  it("judges each commission from real state", () => {
    const s = start();
    const a = s.auction!;
    const judge = (id: "COLLECTOR" | "EXPOSER" | "GAMBLER" | "DEBTOR" | "DEALER") => { s.secrets.a.commission04 = { id, deals: s.secrets.a.commission04!.deals }; return commissionMet04(s, "a"); };
    expect(["COLLECTOR", "EXPOSER", "GAMBLER", "DEBTOR", "DEALER"].map((id) => judge(id as never))).toEqual([false, false, false, false, false]);
    a.itemInstances.LOT_01 = { itemInstanceId: "LOT_01", lotId: "LOT_01", offeredRound: 1, counterfeit: false, sourceItemInstanceId: null, consumed: true };
    a.itemInstances.LOT_02 = { itemInstanceId: "LOT_02", lotId: "LOT_02", offeredRound: 2, counterfeit: true, sourceItemInstanceId: null, consumed: false };
    a.itemInstances.LOT_03 = { itemInstanceId: "LOT_03", lotId: "LOT_03", offeredRound: 3, counterfeit: false, sourceItemInstanceId: null, consumed: false };
    a.auctionHistory.push(
      { round: 1, lotId: "LOT_01", itemInstanceId: "LOT_01", winnerId: "a", price: 1, openingPlayerId: "a" },
      { round: 2, lotId: "LOT_02", itemInstanceId: "LOT_02", winnerId: "a", price: 1, openingPlayerId: "a" },
    );
    expect(judge("COLLECTOR")).toBe(false); // the second lot is counterfeit
    a.auctionHistory.push({ round: 3, lotId: "LOT_03", itemInstanceId: "LOT_03", winnerId: "a", price: 1, openingPlayerId: "a" });
    expect(judge("COLLECTOR")).toBe(true);
    a.players.a.privateIntel.push("LOT_02_COUNTERFEIT");
    expect(judge("EXPOSER")).toBe(true);
    a.stats.challengesWon.a = 1;
    expect(judge("GAMBLER")).toBe(true);
    a.players.a.debt = 2;
    expect(judge("DEBTOR")).toBe(true);
    s.secrets.a.commission04 = { id: "DEALER", deals: 1 };
    expect(commissionMet04(s, "a")).toBe(true);
  });
});
