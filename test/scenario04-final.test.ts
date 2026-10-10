import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, hostSkip, startGame, tickGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { debtPenalty04, debtTier04 } from "../src/shared/game/scenario04/debt.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { rigNextDie, SEED, seatsFor, T0 } from "./helpers.ts";

function start(): GameState {
  let s = startGame(createGame("s4-final", seatsFor(3), SEED, T0, "S04_UNDERGROUND_AUCTION"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
}

function finalRound(before: (s: GameState) => void = () => {}): GameState {
  const s = start();
  before(s);
  s.round = 9;
  s.step = "ROUND_START";
  s.sequence = null;
  return tickGame(s, T0 + 50_000).state;
}

const act = (s: GameState, id: string, action: GameAction) => applyGameAction(s, id, action, T0 + 60_000 + s.version).state;
const convert = (s: GameState, id: string, resource: "BLACK_CHIPS" | "SANITY" | "FATE" | "AP" | "ITEM", lotId?: `LOT_${string}`) => act(s, id, { type: "FINAL_CONVERT", resource, lotId });
function tiedReveal(bids: [number, number, number] = [5, 5, 0]): GameState {
  let s = finalRound();
  for (const id of ["a", "b", "c"]) {
    s = convert(s, id, "BLACK_CHIPS");
    s = act(s, id, { type: "FINAL_READY" });
  }
  for (const [index, id] of ["a", "b", "c"].entries()) s = act(s, id, { type: "FINAL_BID", amount: bids[index] });
  return s;
}
function continueAll(s: GameState): GameState {
  for (const id of ["a", "b", "c"]) s = act(s, id, { type: "FINAL_CONTINUE" });
  return s;
}

describe("Scenario 04 Debt and simultaneous final auction", () => {
  it("maps every Debt band to a public text tier and one negative starting penalty", () => {
    const expected = [
      [0, "none", 0], [1, "none", 0], [2, "light", 1], [3, "light", 1],
      [4, "medium", 2], [5, "medium", 2], [6, "heavy", 3], [7, "heavy", 3],
      [8, "extreme", 4], [12, "extreme", 4],
    ] as const;
    for (const [debt, tier, penalty] of expected) {
      expect(debtTier04(debt)).toBe(tier);
      expect(debtPenalty04(debt)).toBe(penalty);
      const s = finalRound((state) => { state.auction!.players.a.debt = debt; });
      expect(s.auction!.final!.players.a.balance).toBe(penalty ? -penalty : 0);
    }
  });

  it("applies Debt as a dice modifier without changing raw d6 and stacks other modifiers", () => {
    for (const debt of [0, 1, 2, 3, 4, 5, 6, 7, 8, 10]) {
      const s = start();
      s.auction!.players.a.debt = debt;
      s.players.a.helpBonus = 1;
      s.auction!.players.a.nextRollPenalty = -1;
      rigNextDie(s, 6);
      const rolled = act(s, "a", { type: "INVESTIGATE" });
      expect(rolled.roll?.raw).toBe(6);
      expect(rolled.roll?.modifiers).toEqual(expect.arrayContaining([
        { source: expect.any(Object), delta: 1 }, { source: expect.any(Object), delta: -1 },
        ...(debtPenalty04(debt) ? [{ source: expect.any(Object), delta: -debtPenalty04(debt) }] : []),
      ]));
      expect(rolled.roll?.final).toBe(Math.max(1, Math.min(6, 6 - debtPenalty04(debt))));
      expect(rolled.auction!.players.a.nextRollPenalty).toBe(0);
    }
  });

  it("makes INVESTIGATE, READ, and SABOTAGE critical failures after a Debt modifier", () => {
    for (const action of [{ type: "INVESTIGATE" }, { type: "READ", targetId: "b" }, { type: "SABOTAGE", targetId: "b" }] as const) {
      const initial = start();
      initial.auction!.players.a.debt = 4;
      rigNextDie(initial, 3);
      let s = act(initial, "a", action);
      expect(s.roll).toMatchObject({ raw: 3, final: 1, tier: "DISASTER" });
      while (s.pending.length) {
        const window = s.pending.at(-1)!;
        s = act(s, window.addressees[0], { type: "RESPOND", windowId: window.id, optionId: window.defaultOptionId });
      }
      expect(s.players.a.sanity).toBe(2);
    }
  });

  it("keeps a negative balance, converts every resource by click, and locks READY without an Ability bonus", () => {
    let s = finalRound((state) => { state.auction!.players.a.debt = 5; state.auction!.players.a.blackChips = 6; });
    expect(s.auction!.final!.players.a.balance).toBe(-2);
    expect(s.auction!.final!.players.a.initial.ap).toBe(s.players.a.ap);
    s = convert(s, "a", "SANITY");
    expect(s.auction!.final!.players.a.balance).toBe(1);
    s = convert(s, "a", "BLACK_CHIPS");
    expect(s.auction!.final!.players.a.balance).toBe(7);
    s = convert(s, "a", "FATE");
    s = convert(s, "a", "AP");
    expect(s.auction!.final!.players.a.balance).toBe(7 + s.players.a.fate + s.players.a.ap);
    expect(() => convert(s, "a", "SANITY")).toThrow();
    const beforeReady = s.auction!.final!.players.a.balance;
    s = act(s, "a", { type: "FINAL_READY" });
    expect(s.auction!.final!.players.a.usable).toBe(beforeReady);
    expect(() => convert(s, "a", "ITEM", "LOT_01")).toThrow();
    expect(() => act(s, "a", { type: "FINAL_READY" })).toThrow();
    expect(s.auction!.final!.stage).toBe("SETTLEMENT");
    expect(project(s, "b").auction!.final!.players.a).toMatchObject({ status: "READY", balance: null, converted: null, usable: null, bid: null });
  });

  it("clamps only on READY and allows independent settlement by all players", () => {
    let s = finalRound((state) => { state.auction!.players.b.debt = 8; });
    s = act(s, "b", { type: "FINAL_READY" });
    expect(s.auction!.final!.players.b).toMatchObject({ balance: -4, usable: 0, ready: true });
    expect(s.auction!.final!.stage).toBe("SETTLEMENT");
    s = convert(s, "c", "FATE");
    s = act(s, "c", { type: "FINAL_READY" });
    s = convert(s, "a", "BLACK_CHIPS");
    s = act(s, "a", { type: "FINAL_READY" });
    expect(s.auction!.final!.stage).toBe("AUCTION");
    expect(() => convert(s, "a", "SANITY")).toThrow();
  });

  it("converts authentic item instances for two, counterfeits for zero, and keeps the outcome private", () => {
    let s = finalRound((state) => {
      state.auction!.players.a.items.push("LOT_01", "LOT_02");
      state.auction!.itemInstances.LOT_01 = { itemInstanceId: "LOT_01", lotId: "LOT_01", offeredRound: 1, counterfeit: false, sourceItemInstanceId: null, consumed: false };
      state.auction!.itemInstances.LOT_02 = { itemInstanceId: "LOT_02", lotId: "LOT_02", offeredRound: 2, counterfeit: true, sourceItemInstanceId: null, consumed: false };
    });
    const startBalance = s.auction!.final!.players.a.balance;
    expect(project(s, "a").auction!.players.a.items).toEqual(["LOT_01", "LOT_02"]);
    expect(JSON.stringify(project(s, "a"))).not.toContain('"counterfeit":true');
    s = convert(s, "a", "ITEM", "LOT_01");
    expect(s.auction!.final!.players.a.balance).toBe(startBalance + 2);
    s = convert(s, "a", "ITEM", "LOT_02");
    expect(s.auction!.final!.players.a.balance).toBe(startBalance + 2);
    expect(s.auction!.players.a.items).toEqual([]);
    expect(s.auction!.itemInstances.LOT_01.consumed).toBe(true);
    expect(s.auction!.itemInstances.LOT_02.consumed).toBe(true);
    expect(project(s, "a").auction!.players.a.itemNotice?.result).toBe("CONVERTED_COUNTERFEIT");
    expect(project(s, "b").auction!.final!.players.a.converted).toBeNull();
    expect(project(s, "b").auction!.players.a.itemNotice).toBeNull();
  });

  it("reserves invested Sanity so an item cannot spend it again", () => {
    let s = finalRound((state) => {
      state.auction!.players.a.items.push("LOT_09");
      state.auction!.itemInstances.LOT_09 = { itemInstanceId: "LOT_09", lotId: "LOT_09", offeredRound: 9, counterfeit: false, sourceItemInstanceId: null, consumed: false };
    });
    s = convert(s, "a", "SANITY");
    expect(s.auction!.final!.players.a.converted.sanity).toBe(3);
    expect(() => act(s, "a", { type: "USE_LOT", lotId: "LOT_09" })).toThrow();
    expect(s.auction!.players.a.items).toContain("LOT_09");
  });

  it("keeps an opponent's public Debt unchanged during private item use", () => {
    let s = finalRound((state) => {
      state.auction!.players.a.debt = 4;
      state.auction!.players.a.items.push("LOT_06");
      state.auction!.itemInstances.LOT_06 = { itemInstanceId: "LOT_06", lotId: "LOT_06", offeredRound: 6, counterfeit: false, sourceItemInstanceId: null, consumed: false };
    });
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_06" });
    expect(s.auction!.players.a.debt).toBe(0);
    expect(project(s, "a").auction!.players.a.debt).toBe(0);
    expect(project(s, "b").auction!.players.a.debt).toBe(4);
    expect(project(s, "b").auction!.players.a.items).toEqual([]);
  });

  it("allows the host to advance an absent player's settlement, bid, and reveal", () => {
    let s = finalRound();
    s = act(s, "a", { type: "FINAL_READY" });
    s = hostSkip(s, T0 + 70_000).state;
    expect(s.auction!.final!.players.b).toMatchObject({ ready: true, usable: 0 });
    s = hostSkip(s, T0 + 70_001).state;
    expect(s.auction!.final!.stage).toBe("AUCTION");
    s = act(s, "a", { type: "FINAL_BID", amount: 0 });
    s = hostSkip(s, T0 + 70_002).state;
    expect(s.auction!.final!.players.b.bid).toBe(0);
    s = hostSkip(s, T0 + 70_003).state;
    expect(s.auction!.final!.stage).toBe("REVEAL");
    s = act(s, "a", { type: "FINAL_CONTINUE" });
    s = hostSkip(s, T0 + 70_004).state;
    expect(s.auction!.final!.players.b.revealReady).toBe(true);
    s = hostSkip(s, T0 + 70_005).state;
    expect(s.auction!.final!.stage).toBe("SHOWDOWN_PICK");
    for (let i = 0; i < 100 && s.phase !== "ENDING"; i++) s = hostSkip(s, T0 + 70_006 + i).state;
    expect(s.phase).toBe("ENDING");
  });

  it("uses Black Crown instead of converting it, then seals bids until every player submits", () => {
    let s = finalRound((state) => {
      state.auction!.players.a.items.push("LOT_08");
      state.auction!.itemInstances.LOT_08 = { itemInstanceId: "LOT_08", lotId: "LOT_08", offeredRound: 8, counterfeit: false, sourceItemInstanceId: null, consumed: false };
    });
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_08" });
    expect(s.auction!.players.a.activeCrown).toBe(true);
    expect(s.auction!.final!.players.a.balance).toBe(0);
    expect(s.auction!.players.a.items).not.toContain("LOT_08");
    for (const id of ["a", "b", "c"]) {
      s = convert(s, id, "BLACK_CHIPS");
      s = act(s, id, { type: "FINAL_READY" });
    }
    expect(s.auction!.final!.stage).toBe("AUCTION");
    const secret = act(s, "a", { type: "FINAL_BID", amount: 4 });
    expect(project(secret, "b").auction!.final!.players.a).toMatchObject({ status: "BID_SUBMITTED", bid: null, modifier: null, effectiveBid: null });
    expect(project(secret, "b").auction!.currentBid).toBe(0);
    expect(JSON.stringify(project(secret, "b"))).not.toContain('"bid":4');
    expect(() => act(secret, "a", { type: "FINAL_BID", amount: 5 })).toThrow();
    s = act(secret, "b", { type: "FINAL_BID", amount: 5 });
    expect(s.auction!.final!.stage).toBe("AUCTION");
    s = act(s, "c", { type: "FINAL_BID", amount: 0 });
    expect(s.auction!.final!.stage).toBe("REVEAL");
    expect(s.auction!.final!.winnerId).toBe("a");
    expect(s.auction!.final!.players.a.balance).toBe(4);
    expect(s.auction!.auctionHistory.at(-1)).toMatchObject({ round: 10, winnerId: "a", price: 4 });
    expect(project(s, "b").auction!.final!.players.a).toMatchObject({ bid: 4, modifier: 2, effectiveBid: 6 });
    expect(() => act(s, "b", { type: "FINAL_BID", amount: 1 })).toThrow();
    s = act(s, "b", { type: "FINAL_CONTINUE" });
    expect(s.auction!.final!.stage).toBe("REVEAL");
    s = act(s, "c", { type: "FINAL_CONTINUE" });
    s = act(s, "a", { type: "FINAL_CONTINUE" });
    expect(s.auction!.auctionHistory.at(-1)?.winnerId).toBe("a");
    expect(s.phase).toBe("ENDING");
  });

  it("shows tied effective bids without awarding Exit Rights, then deals five hidden cards only to tied bidders", () => {
    let s = tiedReveal();
    expect(s.auction!.final).toMatchObject({ stage: "REVEAL", winnerId: null, tiedPlayerIds: ["a", "b"], showdown: null });
    expect(s.auction!.auctionHistory).not.toContainEqual(expect.objectContaining({ round: 10 }));
    expect(project(s, "c").auction!.final!.players.a).toMatchObject({ bid: 5, modifier: 0, effectiveBid: 5 });
    expect(project(s, "a").auction!.final!.winnerId).toBeNull();
    s = continueAll(s);
    const showdown = s.auction!.final!.showdown!;
    expect(s.auction!.final!.stage).toBe("SHOWDOWN_PICK");
    expect(showdown.participatingPlayerIds).toEqual(["a", "b"]);
    expect(showdown.showdownRound).toBe(1);
    for (const id of ["a", "b"]) {
      expect(showdown.cards[id]).toHaveLength(5);
      expect(showdown.cards[id].every((rank) => rank >= 2 && rank <= 14)).toBe(true);
      const shown = project(s, id).auction!.final!.showdown!;
      expect(shown.cardSlots).toEqual([null, null, null, null, null]);
      expect(shown.revealedCard).toBeNull();
      expect(shown).not.toHaveProperty("cards");
      expect(shown).not.toHaveProperty("selectedCardIndex");
    }
    expect(project(s, "c").auction!.final!.showdown!.cardSlots).toEqual([]);
    expect(() => act(s, "c", { type: "FINAL_SHOWDOWN_PICK", cardIndex: 0 })).toThrow();
    expect(() => act(s, "a", { type: "FINAL_CONTINUE" })).toThrow();
  });

  it("locks a blind choice, reveals together, ranks Ace above King, and enters Ending only after reveal confirmation", () => {
    let s = continueAll(tiedReveal());
    s.auction!.final!.showdown!.cards.a[2] = 14;
    s.auction!.final!.showdown!.cards.b[3] = 13;
    const before = s.auction!.final!.players.a.balance;
    s = act(s, "a", { type: "FINAL_SHOWDOWN_PICK", cardIndex: 2 });
    expect(s.auction!.final!.stage).toBe("SHOWDOWN_PICK");
    expect(s.auction!.final!.showdown!.selectedCardIndex.a).toBe(2);
    expect(s.auction!.final!.showdown!.locked.a).toBe(true);
    expect(project(s, "a").auction!.final!.showdown).toMatchObject({ myLocked: true, revealedCard: null });
    expect(project(s, "b").auction!.final!.showdown!.lockedPlayerIds).toEqual(["a"]);
    expect(project(s, "b").auction!.final!.showdown).not.toHaveProperty("selectedCardIndex");
    expect(() => act(s, "a", { type: "FINAL_SHOWDOWN_PICK", cardIndex: 4 })).toThrow();
    expect(() => act(s, "b", { type: "FINAL_SHOWDOWN_PICK", cardIndex: -1 })).toThrow();
    expect(() => act(s, "b", { type: "FINAL_SHOWDOWN_PICK", cardIndex: 5 })).toThrow();
    expect(s.auction!.final!.winnerId).toBeNull();
    expect(s.auction!.auctionHistory).not.toContainEqual(expect.objectContaining({ round: 10 }));
    s = act(s, "b", { type: "FINAL_SHOWDOWN_PICK", cardIndex: 3 });
    expect(s.auction!.final!.stage).toBe("SHOWDOWN_REVEAL");
    expect(project(s, "c").auction!.final!.showdown!.revealedCard).toEqual({ a: 14, b: 13 });
    expect(s.auction!.final!.winnerId).toBe("a");
    expect(s.auction!.final!.players.a.balance).toBe(before - 5);
    expect(s.auction!.auctionHistory.at(-1)).toMatchObject({ round: 10, winnerId: "a", price: 5 });
    expect(s.phase).not.toBe("ENDING");
    s = act(s, "a", { type: "FINAL_CONTINUE" });
    s = act(s, "b", { type: "FINAL_CONTINUE" });
    expect(s.phase).not.toBe("ENDING");
    s = act(s, "c", { type: "FINAL_CONTINUE" });
    expect(s.phase).toBe("ENDING");
  });

  it("repeats a tied hidden draw with only its highest cards and can resolve by host skip", () => {
    let s = continueAll(tiedReveal([5, 5, 5]));
    s.auction!.final!.showdown!.cards.a[0] = 13;
    s.auction!.final!.showdown!.cards.b[0] = 13;
    s.auction!.final!.showdown!.cards.c[0] = 12;
    for (const id of ["a", "b", "c"]) s = act(s, id, { type: "FINAL_SHOWDOWN_PICK", cardIndex: 0 });
    expect(s.auction!.final!.stage).toBe("SHOWDOWN_REVEAL");
    expect(s.auction!.final!.winnerId).toBeNull();
    expect(s.auction!.final!.showdown!.advancingPlayerIds).toEqual(["a", "b"]);
    expect(s.auction!.auctionHistory).not.toContainEqual(expect.objectContaining({ round: 10 }));
    const rngCalls = s.rngCalls;
    s = continueAll(s);
    expect(s.auction!.final!.stage).toBe("SHOWDOWN_PICK");
    expect(s.auction!.final!.showdown).toMatchObject({ showdownRound: 2, participatingPlayerIds: ["a", "b"], revealedCard: null });
    expect(s.rngCalls).toBe(rngCalls + 10);
    expect(() => act(s, "c", { type: "FINAL_SHOWDOWN_PICK", cardIndex: 0 })).toThrow();
    s.auction!.final!.showdown!.cards.a[0] = 2;
    s.auction!.final!.showdown!.cards.b[0] = 14;
    s = hostSkip(s, T0 + 80_000).state;
    expect(s.auction!.final!.showdown!.locked.a).toBe(true);
    expect(s.auction!.final!.stage).toBe("SHOWDOWN_PICK");
    s = act(s, "b", { type: "FINAL_SHOWDOWN_PICK", cardIndex: 0 });
    expect(s.auction!.final!.winnerId).toBe("b");
    expect(s.auction!.final!.showdown!.revealedCard).toEqual({ a: 2, b: 14 });
  });
});
