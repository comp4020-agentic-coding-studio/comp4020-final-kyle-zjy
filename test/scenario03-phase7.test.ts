import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { placeKey03, type RoomId03, type Year03 } from "../src/shared/game/scenario03/map.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";
import { endTurn03, settle03 } from "./scenario03-helpers.ts";

function start(n = 3): GameState {
  let s = startGame(createGame("s3-endings", seatsFor(n), SEED, T0, "S03_INCIDENT_ZERO"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
}

function advance(s: GameState, target: number): GameState {
  for (let step = 0; step < 150 && s.round < target; step++) {
    if (s.sequence) for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + step + 2).state;
    else s = endTurn03(s, T0 + step + 2);
  }
  expect(s.round).toBe(target);
  return settle03(s, T0 + 200);
}

function place(s: GameState, id: string, roomId: RoomId03, year: Year03): void {
  s.temporal!.locations[id] = { roomId, year };
  s.players[id].carriageIndex = placeKey03(roomId, year);
  s.players[id].ap = 3;
}

function intervene(s: GameState, nodeId: "PROTOTYPE_CORE" | "ACCIDENT_RECORD" | "STAFF_EVACUATION" | "JI_RECORD" | "PROTOTYPE_FATE", choiceId: string): GameState {
  const id = s.turnOrder[s.activeIndex];
  const roomId = { PROTOTYPE_CORE: "PROTOTYPE_ROOM", ACCIDENT_RECORD: "ARCHIVES", STAFF_EVACUATION: "MAIN_LAB", JI_RECORD: "DIRECTOR_OFFICE", PROTOTYPE_FATE: "PROTOTYPE_ROOM" }[nodeId] as RoomId03;
  place(s, id, roomId, "Y1996");
  return applyGameAction(s, id, { type: "INTERVENE", nodeId, choiceId }, T0 + 100).state;
}

function closeBootstrap(s: GameState): GameState {
  for (const obligation of s.temporal!.bootstrap) {
    for (let guard = 0; s.turnOrder[s.activeIndex] !== obligation.assignedTo && guard < s.turnOrder.length + 1; guard++) {
      s = endTurn03(s, T0 + 100 + guard);
    }
    expect(s.turnOrder[s.activeIndex]).toBe(obligation.assignedTo);
    const item = s.temporal!.storedItems[obligation.instanceId];
    place(s, obligation.assignedTo, obligation.storageRoom, "Y1996");
    item.ownerId = obligation.assignedTo;
    item.status = "HELD_1996";
    s = applyGameAction(s, obligation.assignedTo, { type: "STORE_ITEM", instanceId: item.instanceId }, T0 + 101).state;
  }
  return s;
}

function resolve(s: GameState, route: "OFFICIAL_HISTORY" | "NO_TOMORROW" | "DECEIVE_HISTORY"): GameState {
  const id = s.turnOrder[s.activeIndex];
  place(s, id, "ARCHIVES", "Y1996");
  return applyGameAction(s, id, { type: "RESOLVE_HISTORY", route }, T0 + 102).state;
}

describe("Scenario 03 Act IV and endings", () => {
  it("opens final operations only in Act IV and requires a real bootstrap source for a stable history", () => {
    let s = advance(start(), 8);
    const id = s.turnOrder[s.activeIndex];
    place(s, id, "ARCHIVES", "Y1996");
    expect(() => applyGameAction(s, id, { type: "INTERVENE", nodeId: "ACCIDENT_RECORD", choiceId: "OFFICIAL" }, T0 + 80)).toThrow();
    s = advance(s, 10);
    expect(s.temporal!.story.revealed).toContain("ACT4_OPEN");
    s = intervene(s, "ACCIDENT_RECORD", "OFFICIAL");
    place(s, id, "ARCHIVES", "Y1996");
    expect(project(s, id).myActions.find((a) => a.type === "RESOLVE_HISTORY")?.targets).toEqual([]);
    expect(() => applyGameAction(s, id, { type: "RESOLVE_HISTORY", route: "OFFICIAL_HISTORY" }, T0 + 101)).toThrow();
    s = closeBootstrap(s);
    expect(s.temporal!.bootstrap.every((item) => item.placedBy === item.assignedTo)).toBe(true);
    s = resolve(s, "OFFICIAL_HISTORY");
    expect(s.phase).toBe("ENDING");
    expect(s.outcome).toBe("S03_OFFICIAL_HISTORY");
    expect(s.temporal!.finalRoute).toBe("OFFICIAL_HISTORY");
    expect(s.temporal!.present).toMatchObject({ staffEvacuated: false, jiStaged: false, prototypeHidden: false, administrationIntegrity: "STABLE" });
    expect(s.temporal!.story.revealed).not.toContain("ARCHIVIST_IS_JI");
    expect(s.temporal!.storedItems["relic-1"].status).toBe("STORED");
    expect(s.results).toHaveLength(3);
    const restored = JSON.parse(JSON.stringify(s)) as GameState;
    expect(project(restored, id).temporal!.finalRoute).toBe("OFFICIAL_HISTORY");
  });

  it("prevents the accident, erases the Administration's relics, and ends as a complete alternative", () => {
    let s = advance(start(), 7);
    s = intervene(s, "PROTOTYPE_CORE", "SHUT_DOWN");
    s = advance(s, 10);
    s = intervene(s, "ACCIDENT_RECORD", "ERASED");
    s = resolve(s, "NO_TOMORROW");
    expect(s.phase).toBe("ENDING");
    expect(s.outcome).toBe("S03_NO_TOMORROW");
    expect(s.temporal!.present).toMatchObject({ accidentRecord: "ERASED", powerRoomExists: false, administrationIntegrity: "FADING" });
    expect(Object.values(s.temporal!.storedItems).every((item) => item.status === "ERASED" && item.ownerId === null)).toBe(true);
    expect(project(s, s.turnOrder[0]).temporal!.worldItems).toEqual([]);
    expect(s.temporal!.story.revealed).not.toContain("ARCHIVIST_IS_JI");
  });

  it("earns the true ending only after evacuation, staged death, hidden prototype, controlled record and closed relic loop", () => {
    let s = advance(start(), 7);
    s = intervene(s, "PROTOTYPE_CORE", "SHUT_DOWN");
    s = advance(s, 10);
    s = intervene(s, "ACCIDENT_RECORD", "CONTROLLED");
    s = intervene(s, "STAFF_EVACUATION", "EVACUATE");
    s = intervene(s, "JI_RECORD", "STAGE_DEATH");
    const id = s.turnOrder[s.activeIndex];
    place(s, id, "ARCHIVES", "Y1996");
    expect(() => applyGameAction(s, id, { type: "RESOLVE_HISTORY", route: "DECEIVE_HISTORY" }, T0 + 103)).toThrow();
    s = intervene(s, "PROTOTYPE_FATE", "HIDE");
    expect(s.temporal!.present).toMatchObject({ accidentRecord: "CONTROLLED", staffEvacuated: true, jiStaged: true, prototypeHidden: true, powerRoomExists: true, administrationIntegrity: "STABLE" });
    expect(s.collapse).toBe(9);
    place(s, id, "ARCHIVES", "Y1996");
    expect(() => applyGameAction(s, id, { type: "RESOLVE_HISTORY", route: "DECEIVE_HISTORY" }, T0 + 104)).toThrow();
    s = closeBootstrap(s);
    s = resolve(s, "DECEIVE_HISTORY");
    expect(s.outcome).toBe("S03_DECEIVE_HISTORY");
    expect(s.temporal!.story.revealed).toContain("ARCHIVIST_IS_JI");
    expect(s.temporal!.story.revealed).toContain("SEVEN_MINUTES_EARLY");
    expect(s.temporal!.surveillance.filter((item) => item.kind === "RELIC_STORAGE")).toHaveLength(2);
    expect(project(s, s.turnOrder[0]).temporal!.bootstrapProgress).toEqual({ placed: 2, total: 2 });
  });

  it("does not invent an ending when the team runs out of cycles", () => {
    let s = start();
    for (let step = 0; step < 100 && s.phase !== "ENDING"; step++) {
      if (s.sequence) for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + step + 2).state;
      else s = endTurn03(s, T0 + step + 2);
    }
    expect(s.phase).toBe("ENDING");
    expect(s.outcome).toBe("FAILED");
    expect(s.temporal!.finalRoute).toBeNull();
    expect(s.temporal!.story.revealed).not.toContain("ARCHIVIST_IS_JI");
  });
});
