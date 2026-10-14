import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { LOTS04 } from "../src/shared/game/scenario04/lots.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";

function start(): GameState {
  const fixture = createGame("s4-visibility", seatsFor(3), SEED, T0, "S04_UNDERGROUND_AUCTION");
  fixture.auction!.lotOrder = LOTS04.slice(0, 9).map((lot) => lot.id);
  let s = startGame(fixture, T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
}
const act = (s: GameState, id: string, action: GameAction): GameState => applyGameAction(s, id, action, T0 + s.version + 2).state;
function grant(s: GameState, playerId: string, lotId: `LOT_${string}`, counterfeit: boolean) {
  s.auction!.players[playerId].items.push(lotId);
  s.auction!.itemInstances[lotId] = { itemInstanceId: lotId, lotId, offeredRound: s.round, counterfeit, sourceItemInstanceId: null, consumed: false };
}

describe("Scenario 04 information audit", () => {
  it("never sends counterfeit status or private intel of a lot to someone who has not learned it", () => {
    const s = start();
    s.auction!.counterfeitLots = ["LOT_01", "LOT_02"];
    for (const viewer of ["a", "b", "c"]) {
      const view = project(s, viewer);
      const json = JSON.stringify(view);
      expect(json).not.toContain("counterfeitLots");
      expect(json).not.toContain("itemInstances");
      expect(json).not.toContain("COUNTERFEIT");
    }
  });

  it("keeps one player's private intel and commission out of every other view", () => {
    const s = start();
    s.auction!.players.a.privateIntel.push("LOT_03_WAGER");
    const own = project(s, "a");
    expect(own.auction!.players.a.privateIntel).toContain("LOT_03_WAGER");
    expect(own.mySecrets!.commission04).toBeTruthy();
    for (const viewer of ["b", "c"]) {
      const view = project(s, viewer);
      expect(view.auction!.players.a.privateIntel).toBeNull();
      expect(JSON.stringify(view)).not.toContain("LOT_03_WAGER");
      expect(view.mySecrets!.commission04!.id).toBe(s.secrets[viewer].commission04!.id);
    }
  });

  it("shows other players only 'X used a lot' when a counterfeit is used; the verdict is the user's alone", () => {
    let s = start();
    grant(s, "a", "LOT_01", true);
    s = applyGameAction(s, "a", { type: "USE_LOT", lotId: "LOT_01" }, T0 + 500).state;
    const mine = project(s, "a").auction!.players.a;
    expect(mine.itemNotice).toMatchObject({ lotId: "LOT_01", result: "COUNTERFEIT" });
    expect(mine.privateIntel).toContain("LOT_01_COUNTERFEIT");
    for (const viewer of ["b", "c"]) {
      const view = project(s, viewer);
      expect(view.auction!.players.a.itemNotice).toBeNull();
      expect(view.auction!.players.a.privateIntel).toBeNull();
      expect(JSON.stringify(view)).not.toContain("COUNTERFEIT");
      expect(view.log.some((line) => line.kind === "S4_ITEM")).toBe(true);
    }
  });

  it("the cue for a used lot carries only who and which lot, never authenticity", () => {
    const s = start();
    grant(s, "a", "LOT_01", true);
    const step = applyGameAction(s, "a", { type: "USE_LOT", lotId: "LOT_01" }, T0 + 500);
    const cue = step.events.find((e) => e.kind === "S4_ITEM_USED")!;
    expect(Object.keys(cue.payload).sort()).toEqual(["lotId", "playerId"]);
  });
});
