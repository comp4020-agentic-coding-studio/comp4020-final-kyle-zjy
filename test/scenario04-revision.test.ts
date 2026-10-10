import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { activePlayerId } from "../src/server/engine/context.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { blackjackTotal04 } from "../src/server/engine/scenario04/blackjack.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import type { GameState } from "../src/shared/game/state.ts";
import type { LotId04 } from "../src/shared/game/scenario04/types.ts";
import { rigNextDie, SEED, seatsFor, T0 } from "./helpers.ts";

function start(): GameState {
  let s = startGame(createGame("s4-revision", seatsFor(3), SEED, T0, "S04_UNDERGROUND_AUCTION"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  s.auction!.counterfeitLots = [];
  return s;
}
const act = (s: GameState, id: string, action: GameAction) => applyGameAction(s, id, action, T0 + s.version + 2).state;
function grant(s: GameState, playerId: string, ...lotIds: LotId04[]) {
  for (const lotId of lotIds) {
    s.auction!.players[playerId].items.push(lotId);
    s.auction!.itemInstances[lotId] = { itemInstanceId: lotId, lotId, offeredRound: Number(lotId.slice(4, 6)), counterfeit: s.auction!.counterfeitLots.includes(lotId), sourceItemInstanceId: null, consumed: false };
  }
}
function answer(s: GameState, choice: string) {
  const w = s.pending.at(-1)!;
  return act(s, w.addressees[0], { type: "RESPOND", windowId: w.id, optionId: choice });
}
function roll(s: GameState) {
  while (s.pending.length) s = answer(s, s.pending.at(-1)!.defaultOptionId);
  return s;
}
function passRound(s: GameState) {
  const round = s.round;
  for (let i = 0; i < 12 && s.round === round; i++) {
    const id = activePlayerId(s)!;
    s = act(s, id, { type: "PASS" });
    s = act(s, id, { type: "END_TURN" });
  }
  return s;
}

describe("Scenario 04 revised rules", () => {
  it("chooses exactly two seeded counterfeit lots from rounds one through nine and keeps them secret", () => {
    const first = startGame(createGame("random-a", seatsFor(3), SEED, T0, "S04_UNDERGROUND_AUCTION"), T0).state;
    const again = startGame(createGame("random-b", seatsFor(3), SEED, T0, "S04_UNDERGROUND_AUCTION"), T0).state;
    expect(first.auction!.counterfeitLots).toEqual(again.auction!.counterfeitLots);
    expect(new Set(first.auction!.counterfeitLots).size).toBe(2);
    expect(first.auction!.counterfeitLots.every((id) => Number(id.slice(4)) >= 1 && Number(id.slice(4)) <= 9)).toBe(true);
    expect(JSON.stringify(project(first, "a"))).not.toContain("counterfeitLots");
    expect(JSON.stringify(project(first, "a"))).not.toContain("itemInstances");
    const layouts = new Set(Array.from({ length: 12 }, (_, i) => {
      const variedSeed = `${(i + 1).toString(16).padStart(8, "0")}${SEED.slice(8)}`;
      const state = startGame(createGame(`random-${i}`, seatsFor(3), variedSeed, T0, "S04_UNDERGROUND_AUCTION"), T0).state;
      return [...state.auction!.counterfeitLots].sort().join(",");
    }));
    expect(layouts.size).toBeGreaterThan(1);
  });

  it("copies an earlier lot and preserves its counterfeit identity until used", () => {
    let s = start();
    s.auction!.counterfeitLots = ["LOT_02", "LOT_08"];
    for (let i = 0; i < 4; i++) s = passRound(s);
    s.auction!.itemInstances.LOT_02.counterfeit = true;
    grant(s, "a", "LOT_05");
    while (activePlayerId(s) !== "a") { const id = activePlayerId(s)!; s = act(s, id, { type: "PASS" }); s = act(s, id, { type: "END_TURN" }); }
    s.auction!.counterfeitLots = [];
    expect(() => act(s, "a", { type: "USE_LOT", lotId: "LOT_05", sourceLotId: "LOT_06" })).toThrow();
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_05", sourceLotId: "LOT_02" });
    const copyId = s.auction!.players.a.items[0];
    expect(copyId).toMatch(/^LOT_05_COPY_02_\d+$/);
    expect(s.auction!.itemInstances[copyId]).toMatchObject({ sourceItemInstanceId: "LOT_02", counterfeit: true, consumed: false });
    expect(s.auction!.players.a.itemNotice).toMatchObject({ result: "COPIED", copyLotId: "LOT_02" });
    expect(() => act(s, "a", { type: "USE_LOT", lotId: "LOT_05" })).toThrow();
    s = act(s, "a", { type: "USE_LOT", lotId: copyId });
    expect(s.auction!.players.a.items).toEqual([]);
    expect(s.auction!.players.a.glassEyeSnapshots).toEqual([]);
    expect(s.auction!.players.a.itemNotice?.result).toBe("COUNTERFEIT");
  });

  it("keeps an authentic copied item inert until its holder uses it", () => {
    let s = start();
    for (let i = 0; i < 4; i++) s = passRound(s);
    s.auction!.itemInstances.LOT_01.counterfeit = false;
    s.auction!.itemInstances.LOT_01.consumed = true;
    grant(s, "a", "LOT_05");
    while (activePlayerId(s) !== "a") { const id = activePlayerId(s)!; s = act(s, id, { type: "PASS" }); s = act(s, id, { type: "END_TURN" }); }
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_05", sourceLotId: "LOT_01" });
    const copyId = s.auction!.players.a.items[0];
    expect(s.auction!.players.a.armedBlackDie).toBe(0);
    expect(s.auction!.itemInstances[copyId]).toMatchObject({ sourceItemInstanceId: "LOT_01", counterfeit: false, consumed: false });
    s = act(s, "a", { type: "USE_LOT", lotId: copyId });
    expect(s.auction!.players.a).toMatchObject({ items: [], armedBlackDie: 1 });
    expect(s.auction!.itemInstances[copyId].consumed).toBe(true);
    expect(s.auction!.itemInstances.LOT_01.consumed).toBe(true);
    expect(s.auction!.players.a.itemNotice?.result).toBe("ACTIVATED");
  });

  it("copies an earlier item even after the original was actually used", () => {
    let s = start();
    s = passRound(s);
    s.auction!.itemInstances.LOT_02.counterfeit = false;
    grant(s, "a", "LOT_02");
    while (activePlayerId(s) !== "a") { const id = activePlayerId(s)!; s = act(s, id, { type: "PASS" }); s = act(s, id, { type: "END_TURN" }); }
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_02" });
    expect(s.auction!.itemInstances.LOT_02.consumed).toBe(true);
    expect(s.auction!.players.a.glassEyeSnapshots).toHaveLength(1);
    for (let i = 0; i < 3; i++) s = passRound(s);
    grant(s, "a", "LOT_05");
    while (activePlayerId(s) !== "a") { const id = activePlayerId(s)!; s = act(s, id, { type: "PASS" }); s = act(s, id, { type: "END_TURN" }); }
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_05", sourceLotId: "LOT_02" });
    const copyId = s.auction!.players.a.items[0];
    expect(s.auction!.itemInstances[copyId]).toMatchObject({ sourceItemInstanceId: "LOT_02", consumed: false });
    expect(s.auction!.players.a.glassEyeSnapshots).toHaveLength(1);
    s = act(s, "a", { type: "USE_LOT", lotId: copyId });
    expect(s.auction!.players.a.glassEyeSnapshots).toHaveLength(2);
    expect(s.auction!.itemInstances[copyId].consumed).toBe(true);
  });

  it("keeps Sanity at three after the Nameless File is used", () => {
    let s = start();
    s.players.a.sanity = 1;
    grant(s, "a", "LOT_07");
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_07" });
    expect(s.players.a.sanity).toBe(3);
    expect(s.auction!.players.a).toMatchObject({ sanityWard: true, items: [] });
    rigNextDie(s, 1);
    s = roll(act(s, "a", { type: "INVESTIGATE" }));
    expect(s.players.a.sanity).toBe(3);
    grant(s, "a", "LOT_09");
    expect(() => act(s, "a", { type: "USE_LOT", lotId: "LOT_09" })).toThrow();
  });

  it("gives Red Contract two AP for three full rounds, then one again", () => {
    let s = start();
    expect(s.players.a.ap).toBe(1);
    while (s.round < 4) s = passRound(s);
    expect(activePlayerId(s)).toBe("a");
    s = act(s, "a", { type: "BID", amount: 3 });
    s = act(s, "a", { type: "END_TURN" });
    for (const id of ["b", "c"]) {
      s = act(s, id, { type: "PASS" });
      s = act(s, id, { type: "END_TURN" });
    }
    expect(s.round).toBe(5);
    expect(s.auction!.players.a.redContractRemainingRounds).toBe(0);
    while (activePlayerId(s) !== "a") {
      const id = activePlayerId(s)!;
      s = act(s, id, { type: "PASS" });
      s = act(s, id, { type: "END_TURN" });
    }
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_04" });
    expect(s.auction!.players.a.redContractRemainingRounds).toBe(3);
    s = passRound(s);
    expect(s.round).toBe(6);
    for (const expected of [2, 2, 2]) {
      expect(s.players.a.ap).toBe(expected);
      s = passRound(s);
    }
    expect(s.round).toBe(9);
    expect(s.players.a.ap).toBe(1);
  });

  it("recovers Sanity through the shared Lost system and spends the turn's AP", () => {
    let s = start();
    expect(() => act(s, "a", { type: "RECOVER" })).toThrow();
    s.players.a.sanity = 0;
    s.players.a.lost = true;
    s = act(s, "a", { type: "RECOVER" });
    expect(s.players.a).toMatchObject({ sanity: 1, lost: false, ap: 0 });
    expect(activePlayerId(s)).toBe("a");
  });

  it("keeps Glass Eye snapshots private, clears Debt, and converts Sanity with Devil's Key", () => {
    let s = start();
    grant(s, "a", "LOT_02", "LOT_06", "LOT_09");
    s.auction!.players.a.debt = 3;
    s.auction!.players.b.blackChips = 4;
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_02" });
    expect(project(s, "a").auction!.players.a.glassEyeSnapshots?.at(-1)?.chips).toMatchObject({ b: 4, c: 8 });
    expect(project(s, "b").auction!.players.a.glassEyeSnapshots).toBeNull();
    expect(project(s, "b").auction!.players.a.blackChips).toBeNull();
    expect(() => act(s, "a", { type: "USE_LOT", lotId: "LOT_02" })).toThrow();
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_06" });
    expect(s.auction!.players.a.debt).toBe(0);
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_09" });
    expect(s.auction!.players.a.blackChips).toBe(11);
    expect(s.players.a).toMatchObject({ sanity: 0, lost: true });
    expect(() => act(s, "a", { type: "USE_LOT", lotId: "LOT_09" })).toThrow();
  });

  it("lets Gambler's Coin alter one dealt card before the target acts", () => {
    let s = start();
    grant(s, "b", "LOT_03");
    s.auction!.players.b.armedCoin = 1;
    s = act(s, "a", { type: "CHALLENGE", targetId: "b", wager: 2 });
    s = answer(s, "ACCEPT");
    expect(s.pending.at(-1)?.kind).toBe("S4_COIN");
    const hand = [...s.auction!.challenge!.targetHand];
    const choice = s.pending.at(-1)!.options.find((o) => o.id !== "KEEP")!.id;
    s = answer(s, choice);
    const [index, value] = choice.split(":").map(Number);
    expect(s.auction!.challenge!.targetHand[index]).toBe(value);
    expect(Math.abs(Math.min(hand[index], 10) - value)).toBe(1);
    expect(s.auction!.players.b.armedCoin).toBe(0);
    expect(s.pending.at(-1)?.kind).toBe("S4_BLACKJACK");
    expect(s.pending.at(-1)?.addressees).toEqual(["b"]);
  });

  it("calculates ace totals and a push without minting chips", () => {
    expect(blackjackTotal04([1, 10])).toBe(21);
    expect(blackjackTotal04([1, 1, 10])).toBe(12);
    let s = start();
    s.auction!.players.b.blackChips = 2;
    s = act(s, "a", { type: "CHALLENGE", targetId: "b", wager: 5 });
    s = answer(s, "ACCEPT");
    expect(s.auction!.challenge!.effectiveWager).toBe(2);
    expect(s.auction!.challenge!.turn).toBe("b");
    s.auction!.challenge!.targetHand = [10, 10];
    s.auction!.challenge!.challengerHand = [10, 10];
    s = answer(s, "STAND");
    s = answer(s, "STAND");
    expect(s.auction!.challenge).toBeNull();
    expect(s.auction!.players.a.blackChips).toBe(8);
    expect(s.auction!.players.b.blackChips).toBe(2);
  });

  it("copies current-lot intel only on a Perfect READ", () => {
    let s = start();
    s.auction!.players.b.privateIntel.push("LOT_01_LIMIT");
    rigNextDie(s, 6);
    s = roll(act(s, "a", { type: "READ", targetId: "b" }));
    expect(s.auction!.players.a.reads.at(-1)).toMatchObject({ blackChips: 8, hasCurrentIntel: true });
    expect(s.auction!.players.a.privateIntel).toContain("LOT_01_LIMIT");
    expect(project(s, "c").auction!.players.a.privateIntel).toBeNull();
  });

  it("applies disaster, failure, success, and Perfect to the three dice actions", () => {
    for (const die of [1, 3, 5, 6]) {
      let investigate = start();
      rigNextDie(investigate, die);
      investigate = roll(act(investigate, "a", { type: "INVESTIGATE" }));
      expect(investigate.players.a.sanity).toBe(die === 1 ? 2 : 3);
      expect(investigate.auction!.players.a.privateIntel.includes("LOT_01_LIMIT")).toBe(die >= 4);
      expect(investigate.auction!.players.a.privateIntel.includes("LOT_01_PERFECT")).toBe(die === 6);

      let read = start();
      read.auction!.players.b.privateIntel.push("LOT_01_LIMIT");
      rigNextDie(read, die);
      read = roll(act(read, "a", { type: "READ", targetId: "b" }));
      expect(read.players.a.sanity).toBe(die === 1 ? 2 : 3);
      expect(read.auction!.players.a.reads.length).toBe(die >= 4 ? 1 : 0);
      expect(read.auction!.players.a.privateIntel.includes("LOT_01_LIMIT")).toBe(die === 6);

      let sabotage = start();
      rigNextDie(sabotage, die);
      sabotage = roll(act(sabotage, "a", { type: "SABOTAGE", targetId: "b" }));
      expect(sabotage.players.a.sanity).toBe(die === 1 ? 2 : 3);
      expect(sabotage.auction!.players.b.nextRollPenalty).toBe(die === 6 ? -2 : die >= 4 ? -1 : 0);
      expect(project(sabotage, "b").auction!.players.b.nextRollPenalty).toBe(die === 6 ? -2 : die >= 4 ? -1 : 0);
      expect(project(sabotage, "a").auction!.players.b.nextRollPenalty).toBeNull();
    }
  });

  it("settles transferable items and private intel together with chips", () => {
    let s = start();
    grant(s, "b", "LOT_02");
    s.auction!.players.b.privateIntel.push("LOT_01_LIMIT");
    s = act(s, "a", { type: "DEAL", targetId: "b", chips: 2, forItem: "LOT_02", forIntel: "LOT_01_LIMIT" });
    expect(s.players.a.ap).toBe(1);
    s = answer(s, "ACCEPT");
    expect(s.auction!.players.a).toMatchObject({ blackChips: 6, items: ["LOT_02"] });
    expect(project(s, "a").auction!.players.a.itemNotice).toMatchObject({ lotId: "LOT_02", result: "ACQUIRED" });
    expect(project(s, "b").auction!.players.a.itemNotice).toBeNull();
    expect(s.auction!.players.a.privateIntel).toContain("LOT_01_LIMIT");
    expect(s.auction!.players.b).toMatchObject({ blackChips: 10, items: [] });
    expect(project(s, "c").auction!.players.a.privateIntel).toBeNull();
  });

  it("consumes counterfeit items and never places Exit Rights in inventory", () => {
    let s = start();
    s.auction!.counterfeitLots = ["LOT_05", "LOT_07"];
    for (let i = 0; i < 4; i++) s = passRound(s);
    grant(s, "a", "LOT_05", "LOT_07");
    while (activePlayerId(s) !== "a") { const id = activePlayerId(s)!; s = act(s, id, { type: "PASS" }); s = act(s, id, { type: "END_TURN" }); }
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_05", sourceLotId: "LOT_01" });
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_07" });
    expect(s.auction!.players.a.items).toEqual([]);
    expect(s.auction!.players.a.sanityWard).toBe(false);
    expect(project(s, "a").auction!.players.a.itemNotice?.result).toBe("COUNTERFEIT");
    expect(project(s, "b").auction!.players.a.itemNotice).toBeNull();
    expect(JSON.stringify(project(s, "b"))).not.toContain("LOT_05_COUNTERFEIT");
    let final = start();
    final.round = 10;
    final.auction!.currentLot = "LOT_10";
    final.auction!.players.a.blackChips = 10;
    final = act(final, "a", { type: "BID", amount: 8 });
    final = act(final, "a", { type: "END_TURN" });
    final = act(final, "b", { type: "PASS" });
    final = act(final, "b", { type: "END_TURN" });
    final = act(final, "c", { type: "PASS" });
    final = act(final, "c", { type: "END_TURN" });
    expect(final.auction!.players.a.items).not.toContain("LOT_10");
  });

  it("pays only the effective Blackjack wager to a winning all-in target", () => {
    let s = start();
    s.auction!.players.b.blackChips = 2;
    s = act(s, "a", { type: "CHALLENGE", targetId: "b", wager: 5 });
    s = answer(s, "ACCEPT");
    s.auction!.challenge!.targetHand = [10, 10];
    s.auction!.challenge!.challengerHand = [8, 10];
    s = answer(s, "STAND");
    s = answer(s, "STAND");
    expect(s.auction!.players.b.blackChips).toBe(4);
    expect(s.auction!.players.a.blackChips).toBe(6);
    expect(s.auction!.players.a.blackChips + s.auction!.players.b.blackChips).toBe(10);
  });
});
