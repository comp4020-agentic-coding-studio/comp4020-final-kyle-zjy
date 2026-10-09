import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { placeKey03, type RoomId03, type Year03 } from "../src/shared/game/scenario03/map.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";
import { endTurn03, settle03, successfulAction03 } from "./scenario03-helpers.ts";

function start(n = 3): GameState {
  let s = startGame(createGame("s3-act2", seatsFor(n), SEED, T0, "S03_INCIDENT_ZERO"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
}

function toRound(s: GameState, round: number): GameState {
  for (let step = 0; step < 100 && s.round < round; step++) {
    const id = s.turnOrder[s.activeIndex];
    s = endTurn03(s, T0 + step + 2);
  }
  expect(s.round).toBe(round);
  return settle03(s, T0 + 200);
}

function place(s: GameState, id: string, roomId: RoomId03, year: Year03): void {
  s.temporal!.locations[id] = { roomId, year };
  s.players[id].carriageIndex = placeKey03(roomId, year);
  s.players[id].ap = 3;
}

describe("Scenario 03 Act II surveillance and reveal", () => {
  it("turns real 1996 actions into ordered anonymous traces, without leaking profiles or attribution before round 6", () => {
    let s = start();
    const id = s.turnOrder[s.activeIndex];
    const other = s.turnOrder.find((playerId) => playerId !== id)!;
    s = applyGameAction(s, id, { type: "TIME_JUMP" }, T0 + 2).state;
    s = applyGameAction(s, id, { type: "MOVE", toCarriage: placeKey03("ARCHIVES", "Y1996") }, T0 + 3).state;
    expect(s.temporal!.surveillance.map((trace) => trace.kind)).toEqual(["ARRIVAL", "MOVEMENT"]);
    expect(s.temporal!.surveillance.every((trace) => trace.actorId === id)).toBe(true);
    expect(project(s, other).temporal!.surveillance).toEqual([]);
    s = toRound(s, 2);
    place(s, id, "ARCHIVES", "Y1996");
    s = successfulAction03(s, id, { type: "INTERVENE", nodeId: "ARCHIVE_GATE", choiceId: "OPEN" }, T0 + 20).state;
    expect(s.temporal!.surveillance.at(-1)).toMatchObject({ seq: 3, kind: "INTERVENTION", actorId: id, nodeId: "ARCHIVE_GATE", choiceId: "OPEN", round: 2 });
    expect(project(s, other).temporal!.interventions[0].actorId).toBeNull();
    s = toRound(s, 4);
    place(s, id, "DIRECTOR_OFFICE", "Y2026");
    s = successfulAction03(s, id, { type: "INVESTIGATE" }, T0 + 40).state;
    const publicView = project(s, other).temporal!;
    expect(publicView.surveillance.map((trace) => trace.kind)).toEqual(["ARRIVAL", "MOVEMENT", "INTERVENTION"]);
    expect(publicView.surveillance.every((trace) => trace.actorId === null)).toBe(true);
    expect(publicView.identityMatches).toEqual([]);
    expect(JSON.stringify(project(s, other))).not.toContain("sealedProfiles");
    expect(JSON.stringify(publicView)).not.toContain(`"actorId":"${id}"`);
    expect(project(s, id).temporal!.myEvidence).toContain("SURVEILLANCE_TAPE");
    expect(project(s, other).temporal!.myEvidence).not.toContain("SURVEILLANCE_TAPE");
    const restored = JSON.parse(JSON.stringify(s)) as GameState;
    expect(project(restored, other).temporal!.surveillance).toEqual(publicView.surveillance);
    s = toRound(s, 6);
    for (let step = 0; step < s.turnOrder.length; step++) s = endTurn03(s, T0 + 60 + step);
    const revealed = project(s, other).temporal!;
    const intervention = revealed.surveillance.find((trace) => trace.kind === "INTERVENTION")!;
    expect(intervention.actorId).toBe(id);
    expect(revealed.interventions[0].actorId).toBe(id);
    expect(revealed.identityMatches.find((match) => match.signature === intervention.signature)?.playerId).toBe(id);
  });

  it("lets players investigate newly opened 1996 records without repeating them", () => {
    let s = toRound(start(), 4);
    const id = s.turnOrder[s.activeIndex];
    place(s, id, "DIRECTOR_OFFICE", "Y1996");
    s = successfulAction03(s, id, { type: "INVESTIGATE" }, T0 + 40).state;
    expect(s.temporal!.accessLedgerReviewed).toBe(true);
    expect(s.temporal!.evidence[id]).toContain("ACCESS_LEDGER");
    expect(() => applyGameAction(s, id, { type: "INVESTIGATE" }, T0 + 41)).toThrow();
    place(s, id, "MAIN_LAB", "Y1996");
    s = successfulAction03(s, id, { type: "INVESTIGATE" }, T0 + 42).state;
    expect(s.temporal!.prototypeLogReviewed).toBe(true);
    expect(s.temporal!.story.revealed).toContain("PROTOTYPE_LOG_FOUND");
    expect(s.temporal!.story.revealed).not.toContain("INTRUDERS_IDENTIFIED");
  });

  it("records the actual keeper and instance when a relic is sealed in 1996", () => {
    let s = start();
    const owner = s.temporal!.bootstrap.find((item) => item.instanceId === "relic-2")!.assignedTo;
    for (let step = 0; s.turnOrder[s.activeIndex] !== owner; step++) {
      expect(step).toBeLessThan(3);
      s = endTurn03(s, T0 + step + 2);
    }
    s = applyGameAction(s, owner, { type: "PICK_UP", instanceId: "relic-2" }, T0 + 5).state;
    s = applyGameAction(s, owner, { type: "TIME_JUMP" }, T0 + 6).state;
    for (let step = 0; s.round === 1 || s.turnOrder[s.activeIndex] !== owner; step++) {
      expect(step).toBeLessThan(5);
      s = endTurn03(s, T0 + step + 7);
    }
    s = applyGameAction(s, owner, { type: "STORE_ITEM", instanceId: "relic-2" }, T0 + 20).state;
    expect(s.temporal!.storedItems["relic-2"]).toMatchObject({ storedBy: owner, status: "STORED" });
    expect(s.temporal!.surveillance.at(-1)).toMatchObject({ kind: "RELIC_STORAGE", actorId: owner, instanceId: "relic-2", roomId: "CENTRAL_HALL" });
    expect(s.temporal!.surveillance.filter((trace) => trace.kind === "RELIC_STORAGE")).toHaveLength(1);
  });

  it.each([2, 4])("round 6 matches all %i player profiles, pauses for every acknowledgement, and invents no actions", (n) => {
    let s = start(n);
    for (let step = 0; step < 6 * n; step++) {
      const id = s.turnOrder[s.activeIndex];
      s = endTurn03(s, T0 + step + 2);
    }
    expect(s.round).toBe(6);
    expect(s.phase).toBe("ACT_3");
    expect(s.sequence?.kind).toBe("S3_IDENTITY");
    expect(s.temporal!.story.revealed).toContain("INTRUDERS_IDENTIFIED");
    expect(s.temporal!.surveillance).toEqual([]);
    expect(s.temporal!.identityMatches).toHaveLength(n);
    expect(new Set(s.temporal!.identityMatches.map((match) => match.playerId))).toEqual(new Set(s.turnOrder));
    expect(project(s, s.turnOrder[0]).temporal!.identityMatches).toEqual(s.temporal!.identityMatches);
    for (const id of s.turnOrder.slice(0, -1)) {
      s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 100).state;
      expect(s.round).toBe(6);
    }
    s = applyGameAction(s, s.turnOrder.at(-1)!, { type: "ACK_SEQUENCE" }, T0 + 101).state;
    expect(s.round).toBe(7);
    expect(s.sequence).toBeNull();
  });
});
