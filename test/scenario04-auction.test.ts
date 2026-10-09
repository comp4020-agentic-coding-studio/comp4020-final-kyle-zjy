import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { activePlayerId } from "../src/server/engine/context.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";

function start(n = 4): GameState {
  let s = startGame(createGame("s4-auction", seatsFor(n), SEED, T0, "S04_UNDERGROUND_AUCTION"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
}

const act = (s: GameState, type: "PASS" | "BID", amount?: number) => applyGameAction(s, activePlayerId(s)!, type === "BID" ? { type, amount: amount! } : { type }, T0 + s.version + 2).state;

describe("Scenario 04 clockwise auction", () => {
  it("revisits bidders across several laps without refreshing AP, then settles only the winner", () => {
    let s = start();
    const order = s.auction!.seatOrder;
    expect(s.round).toBe(1);
    expect(s.auction!.seatOrder).toEqual(["a", "b", "c", "d"]);
    expect(Object.values(s.players).map((p) => p.ap)).toEqual([2, 2, 2, 2]);
    expect(activePlayerId(s)).toBe(order[0]);
    s = act(s, "BID", 1); // A
    s = act(s, "BID", 2); // B
    s = act(s, "PASS"); // C
    s = act(s, "PASS"); // D
    expect(activePlayerId(s)).toBe("a");
    s = act(s, "BID", 3); // A, second lap
    expect(s.round).toBe(1);
    expect(s.players.a.ap).toBe(2);
    expect(activePlayerId(s)).toBe("b");
    s = act(s, "PASS");
    expect(s.auction!.auctionHistory.at(-1)).toMatchObject({ round: 1, winnerId: "a", price: 3 });
    expect(s.auction!.players.a.blackChips).toBe(5);
    expect(s.auction!.players.a.items).toContain("LOT_01");
    for (const id of ["b", "c", "d"]) expect(s.auction!.players[id].blackChips).toBe(8);
    expect(s.round).toBe(2);
    expect(s.turnOrder).toEqual(["b", "c", "d", "a"]);
    expect(Object.values(s.players).map((p) => p.ap)).toEqual([2, 2, 2, 2]);
  });

  it("rejects fractional, low, and unaffordable bids; passing remains final", () => {
    let s = start(3);
    expect(() => act(s, "BID", 1.5)).toThrow();
    expect(() => act(s, "BID", 9)).toThrow();
    s = act(s, "BID", 1);
    expect(() => act(s, "BID", 1)).toThrow();
    s = act(s, "PASS");
    s = act(s, "PASS");
    expect(s.round).toBe(2);
  });

  it("withdraws an unbid lot and rotates the next opening seat", () => {
    let s = start(3);
    s = act(s, "PASS");
    s = act(s, "PASS");
    s = act(s, "PASS");
    expect(s.auction!.auctionHistory[0]).toMatchObject({ winnerId: null, price: 0, openingPlayerId: "a" });
    expect(s.round).toBe(2);
    expect(s.turnOrder).toEqual(["b", "c", "a"]);
  });

  it("keeps exact Black Chips private while Debt and bids are public", () => {
    const s = start(3);
    s.auction!.players.a.debt = 2;
    expect(project(s, "a").auction!.players.a.blackChips).toBe(8);
    expect(project(s, "b").auction!.players.a.blackChips).toBeNull();
    expect(project(s, "b").auction!.players.a.privateIntel).toBeNull();
    expect(project(s, "b").auction!.players.a.debt).toBe(2);
  });
});
