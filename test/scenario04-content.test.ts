import { describe, expect, it } from "vitest";
import { ROSTER } from "../src/shared/characters/roster/index.ts";
import { LOTS04 } from "../src/shared/game/scenario04/lots.ts";
import { AUCTION_SKILL04, SKILLS04 } from "../src/shared/game/scenario04/skills.ts";
import { characterSkill } from "../src/shared/game/skills.ts";
import { createGame } from "../src/server/engine/create.ts";
import { activePlayerId } from "../src/server/engine/context.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import type { GameState } from "../src/shared/game/state.ts";
import type { LotId04 } from "../src/shared/game/scenario04/types.ts";
import { rigNextDie, SEED, seatsFor, T0 } from "./helpers.ts";

function start(): GameState {
  let s = startGame(createGame("s4-content", seatsFor(3), SEED, T0, "S04_UNDERGROUND_AUCTION"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  s.auction!.counterfeitLots = [];
  return s;
}

const act = (s: GameState, id: string, action: Parameters<typeof applyGameAction>[2]): GameState => applyGameAction(s, id, action, T0 + s.version + 2).state;
function grant(s: GameState, playerId: string, lotId: LotId04) {
  s.auction!.players[playerId].items.push(lotId);
  s.auction!.itemInstances[lotId] = { itemInstanceId: lotId, lotId, offeredRound: Number(lotId.slice(4, 6)), counterfeit: false, sourceItemInstanceId: null, consumed: false };
}

describe("Scenario 04 content and abilities", () => {
  it("registers ten ordered lots and gives every character an auction ability without changing earlier scenarios", () => {
    expect(LOTS04).toHaveLength(10);
    expect(LOTS04.map((lot) => lot.id)).toEqual(Array.from({ length: 10 }, (_, i) => `LOT_${String(i + 1).padStart(2, "0")}`));
    expect(LOTS04[4]).toMatchObject({ effect: "COPY" });
    expect(LOTS04.every((lot) => lot.startingBid === 1)).toBe(true);
    expect(LOTS04[7].finalAuctionModifier).toBe(2);
    expect(ROSTER).toHaveLength(192);
    for (const character of ROSTER) {
      const skill = SKILLS04[character.id];
      expect(skill.type).toBe("ACTIVE");
      expect(skill.effects).toEqual([{ kind: "AUCTION_ABILITY", mode: AUCTION_SKILL04[characterSkill(character.id).category].mode }]);
      expect(skill.description).toBeTruthy();
      expect(characterSkill(character.id).effects).not.toEqual(skill.effects);
    }
  });

  it("plays nine ordinary lots, then resolves tied zero Final Bids before the ending", () => {
    let s = start();
    for (let round = 1; round <= 9; round++) {
      expect(s.round).toBe(round);
      expect(s.collapse).toBe(round - 1);
      expect(s.collapseMax).toBe(10);
      expect(s.auction!.currentLot).toBe(LOTS04[round - 1].id);
      for (let i = 0; i < 3; i++) {
        const id = activePlayerId(s)!;
        s = act(s, id, { type: "PASS" });
        s = act(s, id, { type: "END_TURN" });
      }
      expect(s.auction!.auctionHistory.at(-1)).toMatchObject({ round, winnerId: null });
    }
    expect(s.round).toBe(10);
    expect(s.collapse).toBe(9);
    expect(s.auction!.final?.stage).toBe("SETTLEMENT");
    for (const id of s.auction!.seatOrder) s = act(s, id, { type: "FINAL_READY" });
    for (const id of s.auction!.seatOrder) s = act(s, id, { type: "FINAL_BID", amount: 0 });
    expect(s.auction!.final?.stage).toBe("REVEAL");
    expect(s.auction!.final?.winnerId).toBeNull();
    expect(s.auction!.auctionHistory.at(-1)?.round).toBe(9);
    for (const id of s.auction!.seatOrder) s = act(s, id, { type: "FINAL_CONTINUE" });
    expect(s.auction!.final?.stage).toBe("SHOWDOWN_PICK");
    for (const id of s.auction!.seatOrder) s.auction!.final!.showdown!.cards[id][0] = id === "a" ? 14 : 2;
    for (const id of s.auction!.seatOrder) s = act(s, id, { type: "FINAL_SHOWDOWN_PICK", cardIndex: 0 });
    expect(s.auction!.final?.stage).toBe("SHOWDOWN_REVEAL");
    expect(s.auction!.auctionHistory.at(-1)).toMatchObject({ round: 10, winnerId: "a" });
    for (const id of s.auction!.seatOrder) s = act(s, id, { type: "FINAL_CONTINUE" });
    expect(Object.values(s.auction!.players).every((player) => !player.items.includes("LOT_10"))).toBe(true);
    expect(s.outcome).toBe("S04_EXIT");
    expect(s.collapse).toBe(10);
    expect(s.phase).toBe("ENDING");
  });

  it("uses the Black Die once and preserves exact private chip counts", () => {
    let s = start();
    grant(s, "a", "LOT_01");
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_01" });
    expect(s.auction!.players.a.items).not.toContain("LOT_01");
    s.auction!.players.a.nextRollPenalty = -2;
    rigNextDie(s, 1);
    s = act(s, "a", { type: "INVESTIGATE" });
    expect(s.roll!.final).toBe(6);
    expect(s.auction!.players.a.nextRollPenalty).toBe(0);
    expect(s.auction!.players.a.usedLotEffects).toContain("LOT_01");
    expect(project(s, "b").auction!.players.a.blackChips).toBeNull();
  });

  it("executes every adapted character ability through the shared resolver", () => {
    for (const character of ROSTER) {
      let s = start();
      const skill = SKILLS04[character.id];
      const effect = skill.effects[0];
      if (effect.kind !== "AUCTION_ABILITY") throw new Error(`missing auction effect for ${character.id}`);
      s.players.a.characterId = character.id;
      s.players.a.skill = { usesLeft: skill.maxUses, state: "READY" };
      s.players.a.sanity = 2;
      s.auction!.players.a.debt = 1;
      if (effect.mode === "EXPOSE") { s.auction!.currentLot = "LOT_07"; s.auction!.players.a.privateIntel.push("LOT_07_CONNECTION"); }
      s.auction!.players.b.privateIntel.push("LOT_01_LIMIT");
      if (effect.mode === "CLEANSE") s.auction!.players.b.nextRollPenalty = -1;
      if (effect.mode === "EXPOSE") s.round = 7;
      const before = JSON.stringify({ a: s.auction!.players.a, b: s.auction!.players.b, ap: s.players.a.ap, fate: s.players.a.fate, sanity: s.players.a.sanity, publicIntel: s.auction!.publicIntel });
      s = act(s, "a", { type: "USE_SKILL", targets: skill.target === "OTHER_PLAYER" ? ["b"] : [] });
      expect(s.players.a.skill.usesLeft, character.id).toBe(skill.maxUses - 1);
      const after = JSON.stringify({ a: s.auction!.players.a, b: s.auction!.players.b, ap: s.players.a.ap, fate: s.players.a.fate, sanity: s.players.a.sanity, publicIntel: s.auction!.publicIntel });
      expect(after, `${character.id} should change a real auction state`).not.toBe(before);
    }
  });

  it("settles a deal at its stated terms without a Red Contract discount", () => {
    let s = start();
    grant(s, "a", "LOT_04");
    s = act(s, "a", { type: "DEAL", targetId: "b", chips: 2, forPass: true });
    expect(project(s, "b").auction!.deal).toMatchObject({ chips: 2 });
    const w = s.pending.at(-1)!;
    s = act(s, "b", { type: "RESPOND", windowId: w.id, optionId: "ACCEPT" });
    expect(s.auction!.players.a.blackChips).toBe(6);
    expect(s.auction!.players.b.blackChips).toBe(10);
    expect(s.auction!.passedPlayers).toContain("b");
  });

  it("uses Bottomless Credit once to clear Debt", () => {
    let s = start();
    grant(s, "a", "LOT_06");
    s.auction!.players.a.debt = 3;
    s = act(s, "a", { type: "USE_LOT", lotId: "LOT_06" });
    expect(s.auction!.players.a).toMatchObject({ blackChips: 8, debt: 0 });
    expect(s.auction!.players.a.usedLotEffects).toContain("LOT_06");
    s = act(s, "a", { type: "BORROW" });
    expect(s.auction!.players.a).toMatchObject({ blackChips: 10, debt: 1 });
    expect(() => act(s, "a", { type: "USE_LOT", lotId: "LOT_06" })).toThrow();
  });
});
