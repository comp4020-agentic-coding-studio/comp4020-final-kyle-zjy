import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { activePlayerId } from "../src/server/engine/context.ts";
import { applyGameAction, startGame, tickGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { LOTS04 } from "../src/shared/game/scenario04/lots.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";
import { rigNextDie } from "./helpers.ts";

const act = (s: GameState, id: string, action: GameAction) => applyGameAction(s, id, action, T0 + s.version + 100).state;
function start(): GameState {
  const base = createGame("expanded", seatsFor(3), SEED, T0, "S04_UNDERGROUND_AUCTION");
  base.auction!.lotOrder = LOTS04.slice(0, 9).map((lot) => lot.id);
  let s = startGame(base, T0).state;
  for (const id of s.turnOrder) s = act(s, id, { type: "ACK_SEQUENCE" });
  s.auction!.counterfeitLots = [];
  return s;
}
function grant(s: GameState, playerId: string, lotId: `LOT_${string}`, counterfeit = false) {
  s.auction!.players[playerId].items.push(lotId);
  s.auction!.itemInstances[lotId] = { itemInstanceId: lotId, lotId, offeredRound: s.round, counterfeit, sourceItemInstanceId: null, consumed: false };
}

describe("Scenario 04 expanded item effects", () => {
  it("Bell blocks one raise opportunity; Stopwatch atomically rejoins after Pass", () => {
    let s = start();
    grant(s, "a", "LOT_11");
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_11" });
    s = act(s, "a", { type: "BID", amount: 1 });
    expect(s.auction!.raiseBlockedPlayers).toEqual(["b", "c"]);
    s = act(s, "a", { type: "END_TURN" });
    expect(() => act(s, "b", { type: "BID", amount: 2 })).toThrow();
    s = act(s, "b", { type: "END_TURN" });
    expect(s.auction!.raiseBlockedPlayers).not.toContain("b");

    let rewind = start();
    grant(rewind, "a", "LOT_17");
    rewind = act(rewind, "a", { type: "PASS" });
    rewind = act(rewind, "a", { type: "END_TURN" });
    expect(activePlayerId(rewind)).toBe("b");
    rewind = act(rewind, "a", { type: "USE_LOT", lotId: "LOT_17", amount: 1 });
    expect(rewind.auction!.passedPlayers).not.toContain("a");
    expect(rewind.auction!.currentBidder).toBe("a");
    expect(rewind.auction!.currentBid).toBe(1);
    expect(() => act(rewind, "a", { type: "USE_LOT", lotId: "LOT_17", amount: 2 })).toThrow();
  });

  it("Blank Cheque moves one winning chip to debt and Ownerless Number remains private", () => {
    let s = start();
    grant(s, "a", "LOT_13");
    grant(s, "a", "LOT_18");
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_18", targetId: "b" });
    expect(project(s, "a").auction!.players.a.privateObservations).toContainEqual({ kind: "CHIP_BAND", targetId: "b", value: "7+" });
    expect(project(s, "b").auction!.players.a.privateObservations).toBeNull();
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_13" });
    s = act(s, "a", { type: "BID", amount: 1 });
    s = act(s, "a", { type: "END_TURN" });
    for (const id of ["b", "c"]) { s = act(s, id, { type: "PASS" }); s = act(s, id, { type: "END_TURN" }); }
    expect(s.auction!.auctionHistory[0]).toMatchObject({ winnerId: "a", price: 0 });
    expect(s.auction!.players.a.blackChips).toBe(8);
    expect(s.auction!.players.a.debt).toBe(2);
  });

  it("Night Ledger extends only legal Borrow and reveals a passive counterfeit privately", () => {
    let genuine = start();
    grant(genuine, "a", "LOT_25");
    genuine = act(genuine, "a", { type: "BORROW" });
    expect(genuine.auction!.players.a).toMatchObject({ blackChips: 11, debt: 2 });
    expect(() => act(genuine, "a", { type: "BORROW" })).toThrow();
    let fake = start();
    grant(fake, "a", "LOT_25", true);
    fake = act(fake, "a", { type: "BORROW" });
    expect(fake.auction!.players.a).toMatchObject({ blackChips: 10, debt: 1 });
    expect(fake.auction!.players.a.privateIntel).toContain("LOT_25_COUNTERFEIT");
    expect(project(fake, "b").auction!.players.a.privateIntel).toBeNull();
    expect(project(fake, "b").auction!.players.a.itemNotice).toBeNull();
  });

  it("Burnt Card replaces only the bust-causing Hit; the new card and history stay visible", () => {
    let s = start();
    grant(s, "b", "LOT_27");
    s = act(s, "a", { type: "CHALLENGE", targetId: "b", wager: 1 });
    let w = s.pending.at(-1)!;
    s = act(s, "b", { type: "RESPOND", windowId: w.id, optionId: "ACCEPT" });
    s.auction!.challenge!.targetHand = [10, 10];
    s.auction!.challenge!.deck.push(5);
    w = s.pending.at(-1)!;
    s = act(s, "b", { type: "RESPOND", windowId: w.id, optionId: "HIT" });
    expect(s.auction!.challenge!.bust).toMatchObject({ playerId: "b", card: 5, total: 25 });
    s.auction!.challenge!.deck.push(1);
    w = s.pending.at(-1)!;
    s = act(s, "b", { type: "RESPOND", windowId: w.id, optionId: "BURN" });
    s = act(s, "a", { type: "RESPOND", windowId: w.id, optionId: "CONTINUE" });
    expect(s.auction!.challenge!.burntReplacement).toMatchObject({ playerId: "b", discarded: 5, replacement: 1 });
    expect(s.auction!.challenge!.targetHand).toEqual([10, 10, 1]);
    expect(s.auction!.challenge!.bust).toBeNull();
    expect(s.auction!.players.b.items).not.toContain("LOT_27");
    expect(project(s, "a").auction!.challenge!.burntReplacement?.replacement).toBe(1);
  });

  it("Half Ticket and Last Match affect effective bid only, while burning forfeits conversion", () => {
    let s = start();
    s.round = 9; s.step = "ROUND_START"; s.sequence = null;
    s = tickGame(s, T0 + 50_000).state;
    grant(s, "a", "LOT_12");
    grant(s, "a", "LOT_30");
    grant(s, "a", "LOT_02");
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_12" });
    expect(s.auction!.players.a.finalItemModifiers?.[0].amount).toBe(3);
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_30", sourceLotId: "LOT_02" });
    expect(s.auction!.players.a.items).not.toContain("LOT_02");
    expect(s.auction!.players.a.finalItemModifiers?.[1]).toMatchObject({ amount: 3, burnedItemId: "LOT_02", burnedValue: 2 });
    expect(() => act(s, "a", { type: "FINAL_CONVERT", resource: "ITEM", lotId: "LOT_02" })).toThrow();
    for (const id of ["a", "b", "c"]) s = act(s, id, { type: "FINAL_READY" });
    for (const id of ["a", "b", "c"]) s = act(s, id, { type: "FINAL_BID", amount: 0 });
    expect(project(s, "b").auction!.final!.players.a.modifier).toBe(6);
    expect(s.auction!.final!.players.a.balance).toBe(0);
  });

  it("developer grants retain chosen authenticity and are invisible to ordinary rooms", () => {
    let s = start();
    expect(() => act(s, "a", { type: "DEV_GRANT_LOT", lotId: "LOT_18", counterfeit: true })).toThrow();
    s.flags.developerCheck = 1;
    s = act(s, "a", { type: "DEV_GRANT_LOT", lotId: "LOT_18", counterfeit: true });
    const item = s.auction!.players.a.items.at(-1)!;
    expect(s.auction!.itemInstances[item].counterfeit).toBe(true);
    expect(project(s, "a").auction!.debugPool?.counterfeit).toHaveLength(0);
    s = act(s, "a", { type: "DEV_GENERATE_POOL" });
    expect(project(s, "a").auction!.debugPool?.preview?.order).toHaveLength(9);
  });

  it("fake active use has no effect and reveals only to its holder", () => {
    let s = start();
    s.auction!.players.a.debt = 3;
    grant(s, "a", "LOT_19", true);
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_19" });
    expect(s.auction!.players.a.debt).toBe(3);
    expect(s.auction!.players.a.items).not.toContain("LOT_19");
    expect(project(s, "a").auction!.players.a.itemNotice?.result).toBe("COUNTERFEIT");
    expect(project(s, "b").auction!.players.a.itemNotice).toBeNull();
    expect(project(s, "b").auction!.players.a.privateIntel).toBeNull();
  });

  it("Mirror upgrades an investigation and Tarot reverses a raw die in the server window", () => {
    let mirror = start();
    grant(mirror, "a", "LOT_16");
    mirror = act(mirror, "a", { type: "USE_LOT", lotId: "LOT_16" });
    rigNextDie(mirror, 2);
    mirror = act(mirror, "a", { type: "INVESTIGATE" });
    while (mirror.pending.length) {
      const w = mirror.pending.at(-1)!;
      mirror = act(mirror, w.addressees[0], { type: "RESPOND", windowId: w.id, optionId: w.defaultOptionId });
    }
    expect(mirror.auction!.players.a.privateIntel).toContain("LOT_01_LIMIT");
    expect(mirror.auction!.players.a.mirrorArmed).toBe(false);

    let tarot = start();
    grant(tarot, "a", "LOT_20");
    rigNextDie(tarot, 1);
    tarot = act(tarot, "a", { type: "INVESTIGATE" });
    const window = tarot.pending.at(-1)!;
    expect(window.options.some((option) => option.id === "TAROT")).toBe(true);
    tarot = act(tarot, "a", { type: "RESPOND", windowId: window.id, optionId: "TAROT" });
    expect(tarot.roll!.raw).toBe(6);
    expect(tarot.roll!.final).toBe(6);
    expect(tarot.auction!.players.a.items).not.toContain("LOT_20");
  });

  it("an IOU changes debt only after voluntary acceptance; Scissors cancels pending terms", () => {
    let s = start();
    s.auction!.players.a.debt = 1;
    grant(s, "a", "LOT_29");
    s = act(s, "a", { type: "DEAL", targetId: "b", chips: 0, giveItem: "LOT_29" });
    expect(project(s, "b").auction!.deal?.giveItem).toBe("LOT_29");
    let w = s.pending.at(-1)!;
    s = act(s, "b", { type: "RESPOND", windowId: w.id, optionId: "ACCEPT" });
    expect(s.auction!.players.a.debt).toBe(0);
    expect(s.auction!.players.b.debt).toBe(2);
    expect(s.auction!.itemInstances.LOT_29.consumed).toBe(true);

    let cut = start();
    grant(cut, "a", "LOT_14");
    cut = act(cut, "a", { type: "DEAL", targetId: "b", chips: 1, forPass: true });
    cut = act(cut, "a", { type: "USE_LOT", lotId: "LOT_14" });
    expect(cut.pending).toHaveLength(0);
    expect(cut.auction!.deal).toBeNull();
    expect(cut.auction!.players.a.blackChips).toBe(8);
  });

  it("Safe Key authenticates only an owned item and Glass Dice Cup peeks only for its holder", () => {
    let s = start();
    grant(s, "a", "LOT_24");
    grant(s, "a", "LOT_18", true);
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_24", sourceLotId: "LOT_18" });
    expect(s.auction!.players.a.privateObservations).toContainEqual({ kind: "AUTH_CHECK", lotId: "LOT_18", value: "ANOMALY" });
    expect(project(s, "b").auction!.players.a.privateObservations).toBeNull();

    let cup = start();
    grant(cup, "a", "LOT_23");
    cup = act(cup, "a", { type: "USE_LOT", lotId: "LOT_23" });
    cup = act(cup, "a", { type: "CHALLENGE", targetId: "b", wager: 1 });
    const w = cup.pending.at(-1)!;
    cup = act(cup, "b", { type: "RESPOND", windowId: w.id, optionId: "ACCEPT" });
    const glimpse = Number(cup.auction!.players.a.privateObservations?.at(-1)?.value);
    expect(cup.auction!.challenge!.targetHand).toContain(glimpse);
    expect(project(cup, "b").auction!.players.a.privateObservations).toBeNull();
    expect(JSON.stringify(project(cup, "a").auction!.challenge)).not.toContain("deck");
  });

  it("Expired Membership covers one zero-AP action; Black Invitation opens one out-of-turn deal", () => {
    let member = start();
    member.auction!.houseRuleOrder = undefined; // Isolate the item's AP waiver from Round 1 opening courtesy.
    grant(member, "a", "LOT_28");
    member.players.a.ap = 0;
    member = act(member, "a", { type: "USE_LOT", lotId: "LOT_28" });
    rigNextDie(member, 4);
    member = act(member, "a", { type: "INVESTIGATE" });
    while (member.pending.length) {
      const w = member.pending.at(-1)!;
      member = act(member, w.addressees[0], { type: "RESPOND", windowId: w.id, optionId: w.defaultOptionId });
    }
    expect(member.players.a.ap).toBe(0);
    expect(member.auction!.players.a.membershipUsedRound).toBe(1);
    member.players.a.ap = 1;
    expect(() => act(member, "a", { type: "READ", targetId: "b" })).toThrow();

    let invite = start();
    grant(invite, "a", "LOT_22");
    invite = act(invite, "a", { type: "USE_LOT", lotId: "LOT_22" });
    invite = act(invite, "a", { type: "END_TURN" });
    expect(activePlayerId(invite)).toBe("b");
    invite = act(invite, "a", { type: "DEAL", targetId: "c", chips: 1, forPass: true });
    expect(invite.auction!.deal?.from).toBe("a");
    expect(invite.auction!.players.a.invitationReady).toBe(false);
  });
});
