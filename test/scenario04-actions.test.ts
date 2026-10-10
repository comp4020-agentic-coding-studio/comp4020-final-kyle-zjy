import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { activePlayerId } from "../src/server/engine/context.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { rigNextDie, SEED, seatsFor, T0 } from "./helpers.ts";

function start(): GameState {
  let s = startGame(createGame("s4-actions", seatsFor(3), SEED, T0, "S04_UNDERGROUND_AUCTION"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
}

function act(s: GameState, id: string, action: GameAction): GameState {
  return applyGameAction(s, id, action, T0 + s.version + 2).state;
}

function answer(s: GameState, option: string): GameState {
  const w = s.pending.at(-1)!;
  return act(s, w.addressees[0], { type: "RESPOND", windowId: w.id, optionId: option });
}

function settleRoll(s: GameState): GameState {
  for (let i = 0; s.pending.length && i < 15; i++) s = answer(s, s.pending.at(-1)!.defaultOptionId);
  if (s.pending.length) throw new Error("roll did not settle");
  return s;
}

describe("Scenario 04 tactical actions", () => {
  it("keeps investigation and READ findings private, then exposes only held intel", () => {
    let s = start();
    rigNextDie(s, 6);
    s = settleRoll(act(s, "a", { type: "INVESTIGATE" }));
    expect(s.auction!.players.a.privateIntel).toEqual(expect.arrayContaining(["LOT_01_LIMIT", "LOT_01_PERFECT"]));
    expect(project(s, "b").auction!.players.a.privateIntel).toBeNull();
    expect(s.players.a.ap).toBe(0);
    s.players.a.ap = 1; // Red Contract permits a second tactical action in a turn.
    rigNextDie(s, 6);
    s = settleRoll(act(s, "a", { type: "READ", targetId: "b" }));
    expect(s.auction!.players.a.reads.at(-1)).toMatchObject({ targetId: "b", blackChips: 8, hasCurrentIntel: false });
    expect(project(s, "b").auction!.players.a.reads).toBeNull();
    expect(activePlayerId(s)).toBe("a");
    s.round = 7;
    s.players.a.ap = 1;
    expect(() => act(s, "a", { type: "EXPOSE", intelId: "LOT_02_READ" })).toThrow();
    s = act(s, "a", { type: "EXPOSE", intelId: "LOT_01_LIMIT" });
    expect(project(s, "b").auction!.publicIntel).toContain("LOT_01_LIMIT");
  });

  it("settles a certified intel and current-pass deal atomically; tactical play preserves the bid turn", () => {
    let s = start();
    s.auction!.players.b.privateIntel.push("LOT_01_LIMIT");
    s = act(s, "a", { type: "DEAL", targetId: "b", chips: 2, forIntel: "LOT_01_LIMIT", forPass: true });
    expect(s.pending.at(-1)?.kind).toBe("S4_DEAL");
    s = answer(s, "ACCEPT");
    expect(s.auction!.players.a.blackChips).toBe(6);
    expect(s.auction!.players.b.blackChips).toBe(10);
    expect(s.auction!.players.a.privateIntel).toContain("LOT_01_LIMIT");
    expect(s.auction!.passedPlayers).toContain("b");
    expect(activePlayerId(s)).toBe("a");
    s = act(s, "a", { type: "BID", amount: 1 });
    expect(activePlayerId(s)).toBe("a");
    s = act(s, "a", { type: "END_TURN" });
    expect(activePlayerId(s)).toBe("c");
  });

  it("does not reveal a recipient's chips or intel through deal and challenge validation", () => {
    let s = start();
    s.auction!.players.b.blackChips = 0;
    const before = project(s, "a");
    expect(before.myActions.find((action) => action.type === "CHALLENGE")?.targets).toContain("b");
    s = act(s, "a", { type: "DEAL", targetId: "b", chips: 1, receiveChips: 2, forIntel: "LOT_01_LIMIT" });
    expect(s.pending.at(-1)?.kind).toBe("S4_DEAL");
    expect(() => answer(s, "ACCEPT")).toThrow();
    expect(s.pending.at(-1)?.answers.b).toBeUndefined();
    s = answer(s, "REJECT");
    expect(s.auction!.players.a.blackChips).toBe(8);
    s = act(s, "a", { type: "DEAL", targetId: "b", chips: 1, forIntel: "LOT_01_LIMIT" });
    expect(() => answer(s, "ACCEPT")).toThrow();
    s = answer(s, "REJECT");
    s.players.a.ap = 1;
    s = act(s, "a", { type: "CHALLENGE", targetId: "b", wager: 1 });
    s = answer(s, "ACCEPT");
    expect(s.auction!.challenge?.effectiveWager).toBe(0);
  });

  it("runs seeded Blackjack with equal effective stakes and charges a declined challenge", () => {
    let s = start();
    s.auction!.players.b.blackChips = 2;
    s = act(s, "a", { type: "CHALLENGE", targetId: "b", wager: 5 });
    expect(s.players.a.ap).toBe(0);
    s = answer(s, "ACCEPT");
    expect(s.auction!.challenge?.effectiveWager).toBe(2);
    expect(s.auction!.players.a.blackChips).toBe(6);
    expect(s.auction!.players.b.blackChips).toBe(0);
    expect(project(s, "c").auction!.challenge).not.toHaveProperty("deck");
    s = answer(s, "STAND");
    s = answer(s, "STAND");
    expect(s.auction!.challenge).toBeNull();
    expect(s.auction!.players.a.blackChips + s.auction!.players.b.blackChips).toBe(10);
    expect(activePlayerId(s)).toBe("a");
    s.players.a.ap = 1;
    s.auction!.players.b.blackChips = Math.max(1, s.auction!.players.b.blackChips);
    s = act(s, "a", { type: "CHALLENGE", targetId: "b", wager: 1 });
    s.players.b.ap = 0;
    s = answer(s, "DECLINE");
    expect(s.auction!.players.b.debt).toBe(1);
    s.players.a.ap = 1;
    s.players.b.ap = 2;
    s = act(s, "a", { type: "CHALLENGE", targetId: "b", wager: 1 });
    s = answer(s, "DECLINE");
    expect(s.players.b.ap).toBe(1);
    expect(s.auction!.players.b.debt).toBe(1);
  });

  it("holds a busted Blackjack hand and last card until both players confirm", () => {
    let s = start();
    s = act(s, "a", { type: "CHALLENGE", targetId: "b", wager: 2 });
    s = answer(s, "ACCEPT");
    s.auction!.challenge!.targetHand = [10, 10];
    s.auction!.challenge!.deck.push(13);
    const chipsBefore = s.auction!.players.a.blackChips;
    s = answer(s, "HIT");
    expect(s.pending.at(-1)).toMatchObject({ kind: "S4_BLACKJACK_RESULT", addressees: ["b", "a"] });
    expect(s.auction!.challenge!.targetHand).toEqual([10, 10, 13]);
    expect(s.auction!.challenge!.bust).toMatchObject({ playerId: "b", card: 13, total: 30, winnerId: "a" });
    expect(project(s, "b").auction!.challenge?.bust?.card).toBe(13);
    expect(project(s, "a").auction!.challenge?.targetHand).toEqual([10, 10, 13]);
    expect(s.auction!.players.a.blackChips).toBe(chipsBefore);
    s = answer(s, "CONTINUE");
    expect(s.auction!.challenge?.bust?.total).toBe(30);
    expect(s.pending.at(-1)?.kind).toBe("S4_BLACKJACK_RESULT");
    s = act(s, "a", { type: "RESPOND", windowId: s.pending.at(-1)!.id, optionId: "CONTINUE" });
    expect(s.auction!.challenge).toBeNull();
    expect(s.auction!.players.a.blackChips).toBe(chipsBefore + 4);
  });

  it("borrowing increases private chips and public debt, while sabotage is consumed by the next roll", () => {
    let s = start();
    s = act(s, "a", { type: "BORROW" });
    expect(project(s, "b").auction!.players.a).toMatchObject({ blackChips: null, debt: 1 });
    expect(() => act(s, "a", { type: "BORROW" })).toThrow();
    s.players.a.ap = 1;
    rigNextDie(s, 5);
    s = settleRoll(act(s, "a", { type: "SABOTAGE", targetId: "b" }));
    expect(s.auction!.players.b.nextRollPenalty).toBe(-1);
    s = act(s, "a", { type: "PASS" });
    s = act(s, "a", { type: "END_TURN" });
    rigNextDie(s, 5);
    s = settleRoll(act(s, "b", { type: "INVESTIGATE" }));
    expect(s.roll?.modifiers).toContainEqual({ source: expect.anything(), delta: -1 });
    expect(s.auction!.players.b.nextRollPenalty).toBe(0);
  });
});
