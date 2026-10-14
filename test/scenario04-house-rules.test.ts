import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame, tickGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { SHUFFLED_HOUSE_RULES04 } from "../src/shared/game/scenario04/houseRules.ts";
import type { HouseRuleId04 } from "../src/shared/game/scenario04/types.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";

const act = (s: GameState, id: string, action: GameAction) => applyGameAction(s, id, action, T0 + s.version + 100).state;
function start(seed = SEED): GameState {
  let s = startGame(createGame("house", seatsFor(3), seed, T0, "S04_UNDERGROUND_AUCTION"), T0).state;
  for (const id of s.turnOrder) s = act(s, id, { type: "ACK_SEQUENCE" });
  return s;
}
function rule(s: GameState, id: HouseRuleId04): GameState {
  s.auction!.houseRuleOrder![s.round - 1] = id;
  return s;
}
function grant(s: GameState, id: string, lotId: `LOT_${string}`, counterfeit = false) {
  s.auction!.players[id].items.push(lotId);
  s.auction!.itemInstances[lotId] = { itemInstanceId: lotId, lotId, offeredRound: s.round, counterfeit, sourceItemInstanceId: null, consumed: false };
}

describe("Scenario 04 House Rules", () => {
  it("fixes the first and last rules and shuffles each middle rule once with seeded replay", () => {
    const first = start("0123456789abcdef0123456789abcdef").auction!.houseRuleOrder!;
    const replay = start("0123456789abcdef0123456789abcdef").auction!.houseRuleOrder!;
    const other = start("fedcba9876543210fedcba9876543210").auction!.houseRuleOrder!;
    expect(first).toEqual(replay);
    expect(first[0]).toBe("openingCourtesy");
    expect(first[9]).toBe("finalSettlement");
    expect([...first.slice(1, 9)].sort()).toEqual([...SHUFFLED_HOUSE_RULES04].sort());
    expect(other.slice(1, 9)).not.toEqual(first.slice(1, 9));
    expect(other[8]).not.toBe(first[8]); // Round 9 is one of the shuffled slots.
    expect(project(start("0123456789abcdef0123456789abcdef"), "a").auction).not.toHaveProperty("houseRuleOrder");
  });

  it("makes only the first Round 1 investigation free while still resolving its die", () => {
    let s = start();
    const ap = s.players.a.ap;
    s = act(s, "a", { type: "INVESTIGATE" });
    expect(s.players.a.ap).toBe(ap);
    expect(s.roll).toBeTruthy();
    expect(s.players.a.counters.s4CourtesyUsedRound).toBe(1);
  });

  it("hides only the live leader and reveals the resolved winner", () => {
    let s = rule(start(), "anonymousSeat");
    s = act(s, "a", { type: "BID", amount: 1 });
    const other = project(s, "b").auction!;
    expect(other.currentBid).toBe(1);
    expect(other.currentBidder).toBeNull();
    expect(JSON.stringify(other)).not.toContain('"currentBidder":"a"');
    expect(project(s, "a").auction!.currentBidder).toBe("a");
    s = act(s, "a", { type: "END_TURN" });
    for (const id of ["b", "c"]) { s = act(s, id, { type: "PASS" }); s = act(s, id, { type: "END_TURN" }); }
    expect(project(s, "b").auction!.auctionHistory[0].winnerId).toBe("a");

    let watch = rule(start(), "anonymousSeat");
    grant(watch, "a", "LOT_17");
    watch = act(watch, "a", { type: "PASS" });
    watch = act(watch, "a", { type: "END_TURN" });
    watch = act(watch, "a", { type: "USE_LOT", lotId: "LOT_17", amount: 1 });
    expect(project(watch, "b").auction!.currentBidder).toBeNull();
    expect(JSON.stringify(watch.log.at(-1))).toContain("An anonymous bidder");
  });

  it("requires a two-chip raise, and limits each player to one bid under One Raise", () => {
    let s = rule(start(), "doubleRaise");
    s = act(s, "a", { type: "BID", amount: 1 });
    s = act(s, "a", { type: "END_TURN" });
    expect(() => act(s, "b", { type: "BID", amount: 2 })).toThrow();
    s = act(s, "b", { type: "BID", amount: 3 });
    expect(s.auction!.currentBid).toBe(3);

    let once = rule(start(), "singleRaise");
    once = act(once, "a", { type: "BID", amount: 1 });
    expect(once.players.a.counters.s4RaisedRound).toBe(1);
    once.auction!.currentBidder = "b";
    once.auction!.bidThisTurn = null;
    expect(() => act(once, "a", { type: "BID", amount: 3 })).toThrow();
    expect(() => act(structuredClone(once), "a", { type: "BID", amount: 3 })).toThrow();
    grant(once, "a", "LOT_17");
    once.auction!.passedPlayers.push("a");
    expect(() => act(once, "a", { type: "USE_LOT", lotId: "LOT_17", amount: 3 })).toThrow();
  });

  it("pays the first completed Blackjack winner a house bonus only once", () => {
    let s = rule(start(), "houseChallenge");
    s = act(s, "a", { type: "CHALLENGE", targetId: "b", wager: 1 });
    let window = s.pending.at(-1)!;
    s = act(s, "b", { type: "RESPOND", windowId: window.id, optionId: "ACCEPT" });
    s.auction!.challenge!.targetHand = [10, 10];
    s.auction!.challenge!.challengerHand = [10, 9];
    const before = s.auction!.players.b.blackChips;
    window = s.pending.at(-1)!;
    s = act(s, "b", { type: "RESPOND", windowId: window.id, optionId: "STAND" });
    window = s.pending.at(-1)!;
    s = act(s, "a", { type: "RESPOND", windowId: window.id, optionId: "STAND" });
    expect(s.auction!.players.b.blackChips).toBe(before + 4); // 2-chip pot and 2 house chips.
    expect(s.auction!.houseChallengeBonusClaimed).toBe(true);
    s.players.a.ap = 1;
    s = act(s, "a", { type: "CHALLENGE", targetId: "c", wager: 1 });
    window = s.pending.at(-1)!;
    s = act(s, "c", { type: "RESPOND", windowId: window.id, optionId: "ACCEPT" });
    s.auction!.challenge!.targetHand = [10, 10];
    s.auction!.challenge!.challengerHand = [10, 9];
    const secondBefore = s.auction!.players.c.blackChips;
    window = s.pending.at(-1)!;
    s = act(s, "c", { type: "RESPOND", windowId: window.id, optionId: "STAND" });
    window = s.pending.at(-1)!;
    s = act(s, "a", { type: "RESPOND", windowId: window.id, optionId: "STAND" });
    expect(s.auction!.players.c.blackChips).toBe(secondBefore + 2);
  });

  it("changes Borrow only on Credit Night and forbids it during Credit Freeze", () => {
    let s = rule(start(), "creditNight");
    const before = { ...s.auction!.players.a };
    s = act(s, "a", { type: "BORROW" });
    expect(s.auction!.players.a.blackChips).toBe(before.blackChips + 3);
    expect(s.auction!.players.a.debt).toBe(before.debt + 2);
    expect(() => act(s, "a", { type: "BORROW" })).toThrow();
    let frozen = rule(start(), "creditFreeze");
    expect(() => act(frozen, "a", { type: "BORROW" })).toThrow();
  });

  it("publishes a held item name without authenticity and auto-declares when skipped", () => {
    let s = rule(start(), "holdingDisclosure");
    grant(s, "a", "LOT_11", true);
    s.auction!.holdingPendingIds = ["a"];
    expect(() => act(s, "a", { type: "BID", amount: 1 })).toThrow();
    s = act(s, "a", { type: "DECLARE_HOLDING", itemId: "LOT_11" });
    expect(project(s, "b").auction!.holdingDeclarations?.a).toBe("LOT_11");
    expect(JSON.stringify(project(s, "b").auction)).not.toContain("counterfeit");
    let skipped = rule(start(), "holdingDisclosure");
    grant(skipped, "a", "LOT_11");
    skipped.auction!.holdingPendingIds = ["a"];
    skipped = act(skipped, "a", { type: "END_TURN" });
    expect(skipped.auction!.holdingDeclarations?.a).toBe("LOT_11");
  });

  it("records only completed trade terms and keeps private intel hidden", () => {
    let s = rule(start(), "transparentTrade");
    s.auction!.players.a.privateIntel.push("LOT_01_LIMIT");
    s = act(s, "a", { type: "DEAL", targetId: "b", chips: 1, giveIntel: "LOT_01_LIMIT" });
    expect(project(s, "c").auction!.publicTrades).toEqual([]);
    const window = s.pending.at(-1)!;
    s = act(s, "b", { type: "RESPOND", windowId: window.id, optionId: "ACCEPT" });
    expect(project(s, "c").auction!.publicTrades).toMatchObject([{ from: "a", to: "b", chips: 1 }]);
    expect(project(s, "c").auction!.players.a.privateIntel).toBeNull();
    expect(JSON.stringify(project(s, "c").auction!.publicTrades)).not.toContain("LOT_01_LIMIT");
  });

  it("shows Round 9 settlement only to its owner and supports developer previews", () => {
    let s = start();
    s.round = 8; s.step = "ROUND_START"; s.sequence = null;
    s = tickGame(s, T0 + 50_000).state;
    grant(s, "a", "LOT_11", true);
    grant(s, "b", "LOT_12", false);
    const own = project(s, "a").auction!.preliminarySettlement!;
    const other = project(s, "b").auction!.preliminarySettlement!;
    expect(own.genuineItems).toBe(0);
    expect(other.genuineItems).toBe(1);
    expect(project(s, "c").auction).not.toHaveProperty("houseRuleOrder");
    s.flags.developerCheck = 1;
    s = act(s, "a", { type: "DEV_SET_HOUSE_RULE", ruleId: "anonymousSeat" });
    expect(project(s, "a").auction!.houseRule).toBe("anonymousSeat");
    s = act(s, "a", { type: "DEV_GENERATE_HOUSE_RULES" });
    expect(project(s, "a").auction!.debugHouseRules?.preview?.order).toHaveLength(10);
  });
});
