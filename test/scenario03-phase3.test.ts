import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { rulesFor } from "../src/server/engine/scenario.ts";
import { placeKey03, type RoomId03, type Year03 } from "../src/shared/game/scenario03/map.ts";
import type { GameState } from "../src/shared/game/state.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";
import { successfulAction03 } from "./scenario03-helpers.ts";

function start(): GameState {
  let s = startGame(createGame("s3-items", seatsFor(3), SEED, T0, "S03_INCIDENT_ZERO"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
}

function place(s: GameState, id: string, roomId: RoomId03, year: Year03) {
  s.activeIndex = s.turnOrder.indexOf(id);
  s.players[id].ap = 3;
  s.temporal!.locations[id] = { roomId, year };
  s.players[id].carriageIndex = placeKey03(roomId, year);
}

const empty = { items: [], fate: 0 };

describe("Scenario 03 numbered relic conservation", () => {
  it("keeps a completed numbered relic visible in 2026 but permanently unavailable for pickup", () => {
    let s = start();
    expect(s.temporal!.bootstrap).toHaveLength(2);
    const obligation = s.temporal!.bootstrap.find((entry) => entry.storageRoom === "ARCHIVES")!;
    const id = obligation.assignedTo;
    place(s, id, "ARCHIVES", "Y2026");
    expect(project(s, id).temporal!.worldItems.some((item) => item.instanceId === obligation.instanceId)).toBe(true);
    s = applyGameAction(s, id, { type: "PICK_UP", instanceId: obligation.instanceId }, T0 + 2).state;
    expect(s.temporal!.storedItems[obligation.instanceId]).toMatchObject({ status: "HELD_2026", ownerId: id });
    expect(() => applyGameAction(s, id, { type: "PICK_UP", instanceId: obligation.instanceId }, T0 + 3)).toThrow();
    s = applyGameAction(s, id, { type: "TIME_JUMP" }, T0 + 4).state;
    expect(s.temporal!.storedItems[obligation.instanceId].status).toBe("HELD_1996");
    s.players[id].ap = 1;
    s = applyGameAction(s, id, { type: "STORE_ITEM", instanceId: obligation.instanceId }, T0 + 5).state;
    expect(s.temporal!.storedItems[obligation.instanceId]).toMatchObject({ status: "STORED", ownerId: null, storedBy: id });
    expect(s.temporal!.bootstrap.find((entry) => entry.instanceId === obligation.instanceId)!.placedBy).toBe(id);
    expect(project(s, id).temporal!.worldItems.find((item) => item.instanceId === obligation.instanceId)?.status).toBe("STORED");
    const restored = JSON.parse(JSON.stringify(s)) as GameState;
    const other = restored.turnOrder.find((playerId) => playerId !== id)!;
    place(restored, other, "ARCHIVES", "Y2026");
    const view = project(restored, other);
    expect(view.temporal!.worldItems.find((item) => item.instanceId === obligation.instanceId)?.status).toBe("STORED");
    expect(view.temporal!.myItems.map((item) => item.instanceId)).not.toContain(obligation.instanceId);
    expect(view.myActions.find((action) => action.type === "PICK_UP")).toMatchObject({ enabled: false, targets: [], reason: { k: "This numbered relic's time loop is complete. It remains visible in 2026 but cannot be picked up again." } });
    expect(() => applyGameAction(restored, other, { type: "PICK_UP", instanceId: obligation.instanceId }, T0 + 6)).toThrow();
    expect(restored.temporal!.storedItems[obligation.instanceId]).toMatchObject({ status: "STORED", ownerId: null, storedBy: id });
  });

  it("requires assigned keeper and protected storage room, and never stores an objective artifact", () => {
    let s = start();
    const obligation = s.temporal!.bootstrap.find((entry) => entry.storageRoom === "ARCHIVES")!;
    const other = s.turnOrder.find((id) => id !== obligation.assignedTo)!;
    place(s, other, "ARCHIVES", "Y2026");
    s = applyGameAction(s, other, { type: "PICK_UP", instanceId: obligation.instanceId }, T0 + 2).state;
    place(s, other, "ARCHIVES", "Y1996");
    s.temporal!.storedItems[obligation.instanceId].status = "HELD_1996";
    expect(() => applyGameAction(s, other, { type: "STORE_ITEM", instanceId: obligation.instanceId }, T0 + 3)).toThrow();
    s.temporal!.holdings[other].artifacts.push("STAGED_DEATH_RECORD");
    expect(JSON.stringify(project(s, other))).not.toContain("STAGED_DEATH_RECORD");
    expect(() => applyGameAction(s, other, { type: "STORE_ITEM", instanceId: "STAGED_DEATH_RECORD" }, T0 + 4)).toThrow();
    const recipient = s.turnOrder.find((id) => id !== other)!;
    place(s, recipient, "ARCHIVES", "Y1996");
    s.activeIndex = s.turnOrder.indexOf(other);
    expect(() => applyGameAction(s, other, { type: "TRADE", targetId: recipient, give: { ...empty, instances: ["STAGED_DEATH_RECORD"] }, want: empty }, T0 + 5)).toThrow();
    expect(s.temporal!.holdings[other].artifacts).toEqual(["STAGED_DEATH_RECORD"]);
    expect(rulesFor(s).itemPools.any).toEqual(["PHASE_BATTERY", "SEDATIVE03"]);
    expect(rulesFor(s).itemPools.any).not.toContain("TIME_MARKER");
  });

  it("transfers ownership only after same-year consent and rechecks the offer at acceptance", () => {
    let s = start();
    const obligation = s.temporal!.bootstrap.find((entry) => entry.storageRoom === "ARCHIVES")!;
    const from = obligation.assignedTo;
    const to = s.turnOrder.find((id) => id !== from)!;
    place(s, from, "ARCHIVES", "Y2026");
    place(s, to, "ARCHIVES", "Y2026");
    s.activeIndex = s.turnOrder.indexOf(from);
    s = applyGameAction(s, from, { type: "PICK_UP", instanceId: obligation.instanceId }, T0 + 2).state;
    const offer: GameAction = { type: "TRADE", targetId: to, give: { ...empty, instances: [obligation.instanceId] }, want: empty };
    s = applyGameAction(s, from, offer, T0 + 3).state;
    expect(s.temporal!.storedItems[obligation.instanceId].ownerId).toBe(from);
    const windowId = s.pending.at(-1)!.id;
    s = applyGameAction(s, to, { type: "RESPOND", windowId, optionId: "ACCEPT" }, T0 + 4).state;
    expect(s.temporal!.storedItems[obligation.instanceId].ownerId).toBe(to);
    expect(() => applyGameAction(s, from, offer, T0 + 5)).toThrow();
    expect(JSON.parse(JSON.stringify(s)).temporal.storedItems[obligation.instanceId].ownerId).toBe(to);
    s.activeIndex = s.turnOrder.indexOf(to);
    s.players[to].ap = 3;
    s = applyGameAction(s, to, { type: "TRADE", targetId: from, give: { ...empty, instances: [obligation.instanceId] }, want: empty }, T0 + 6).state;
    const secondWindow = s.pending.at(-1)!.id;
    s.temporal!.locations[from].year = "Y1996";
    s.players[from].carriageIndex = placeKey03("ARCHIVES", "Y1996");
    s = applyGameAction(s, from, { type: "RESPOND", windowId: secondWindow, optionId: "ACCEPT" }, T0 + 7).state;
    expect(s.temporal!.storedItems[obligation.instanceId].ownerId).toBe(to);
    place(s, from, "ARCHIVES", "Y1996");
    s.activeIndex = s.turnOrder.indexOf(to);
    expect(() => applyGameAction(s, to, { type: "TRADE", targetId: from, give: { ...empty, instances: [obligation.instanceId] }, want: empty }, T0 + 8)).toThrow();
  });

  it("can find and consume ordinary supplies while objective holdings stay isolated", () => {
    let s = start();
    const id = s.turnOrder[s.activeIndex];
    place(s, id, "RESEARCH_WING", "Y2026");
    s.temporal!.holdings[id].artifacts.push("STAGED_DEATH_RECORD");
    s = successfulAction03(s, id, { type: "SEARCH" }, T0 + 2).state;
    expect(["PHASE_BATTERY", "SEDATIVE03"]).toContain(s.players[id].items[0]);
    const item = s.players[id].items[0];
    s = applyGameAction(s, id, { type: "USE_ITEM", item }, T0 + 3).state;
    expect(s.players[id].items).toEqual([]);
    expect(s.temporal!.holdings[id].artifacts).toEqual(["STAGED_DEATH_RECORD"]);
    expect(() => applyGameAction(s, id, { type: "SEARCH" }, T0 + 4)).toThrow();
  });

  it("materializes one old-badge instance when the worker is saved", () => {
    let s = start();
    const id = s.turnOrder[s.activeIndex];
    place(s, id, "RESEARCH_WING", "Y1996");
    s = successfulAction03(s, id, { type: "INTERVENE", nodeId: "WORKER", choiceId: "SAVE" }, T0 + 2).state;
    expect(Object.values(s.temporal!.storedItems).filter((item) => item.itemId === "OLD_BADGE")).toHaveLength(1);
    expect(() => applyGameAction(s, id, { type: "INTERVENE", nodeId: "WORKER", choiceId: "SAVE" }, T0 + 3)).toThrow();
    place(s, id, "RESEARCH_WING", "Y2026");
    s = applyGameAction(s, id, { type: "PICK_UP", instanceId: "relic-badge" }, T0 + 4).state;
    expect(s.temporal!.storedItems["relic-badge"].ownerId).toBe(id);
    expect(project(s, id).temporal!.worldItems.find((item) => item.instanceId === "relic-badge")).toBeUndefined();
    s.temporal!.storedItems["relic-badge"].status = "STORED";
    s.temporal!.storedItems["relic-badge"].ownerId = null;
    s.temporal!.storedItems["relic-badge"].storedBy = id;
    s.players[id].ap = 3;
    expect(project(s, id).myActions.find((action) => action.type === "PICK_UP")?.targets).toContain("relic-badge");
    s = applyGameAction(s, id, { type: "PICK_UP", instanceId: "relic-badge" }, T0 + 5).state;
    expect(s.temporal!.storedItems["relic-badge"].ownerId).toBe(id);
  });
});
