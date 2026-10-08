import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { ROOM_IDS, placeKey03, type RoomId03, type Year03 } from "../src/shared/game/scenario03/map.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";
import { endTurn03, settle03 } from "./scenario03-helpers.ts";

function start(): GameState {
  let s = startGame(createGame("s3-act3", seatsFor(3), SEED, T0, "S03_INCIDENT_ZERO"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
}

function advance(s: GameState, target: number): GameState {
  for (let step = 0; step < 50 && s.round < target; step++) {
    if (s.sequence) {
      for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + step + 2).state;
    } else s = endTurn03(s, T0 + step + 2);
  }
  expect(s.round).toBe(target);
  return settle03(s, T0 + 200);
}

function place(s: GameState, id: string, roomId: RoomId03, year: Year03): void {
  s.temporal!.locations[id] = { roomId, year };
  s.players[id].carriageIndex = placeKey03(roomId, year);
  s.players[id].ap = 3;
}

describe("Scenario 03 Act III", () => {
  it("only opens the prototype intervention in Act III and makes shutdown rewrite the present", () => {
    let s = advance(start(), 4);
    const id = s.turnOrder[s.activeIndex];
    place(s, id, "PROTOTYPE_ROOM", "Y1996");
    expect(() => applyGameAction(s, id, { type: "INTERVENE", nodeId: "PROTOTYPE_CORE", choiceId: "SHUT_DOWN" }, T0 + 40)).toThrow();
    expect(s.temporal!.present.powerRoomExists).toBe(true);
    s = advance(s, 7);
    expect(s.temporal!.story.availableRoutes).toEqual(["OFFICIAL_HISTORY", "NO_TOMORROW"]);
    expect(s.temporal!.story.revealed).toContain("ZERO_DIRECTIVE");
    place(s, id, "PROTOTYPE_ROOM", "Y1996");
    const collapse = s.collapse;
    const revision = s.temporal!.causalRevision;
    const result = applyGameAction(s, id, { type: "INTERVENE", nodeId: "PROTOTYPE_CORE", choiceId: "SHUT_DOWN" }, T0 + 70);
    s = result.state;
    expect(s.collapse).toBe(collapse + 1);
    expect(s.temporal!.causalRevision).toBe(revision + 1);
    expect(s.temporal!.present).toMatchObject({ powerRoomExists: false, administrationIntegrity: "FADING" });
    expect(s.temporal!.story.revealed).toContain("PREVENTION_ATTEMPT");
    expect(s.temporal!.story.availableRoutes).not.toContain("DECEIVE_HISTORY");
    expect(s.temporal!.surveillance.at(-1)).toMatchObject({ kind: "INTERVENTION", actorId: id, nodeId: "PROTOTYPE_CORE" });
    expect(ROOM_IDS).toHaveLength(8);
    const other = s.turnOrder.find((person) => person !== id)!;
    const view = project(s, other).temporal!;
    expect(view.present.powerRoomExists).toBe(false);
    expect(view.interventions.at(-1)?.actorId).toBe(id);
    place(s, id, "PROTOTYPE_ROOM", "Y2026");
    const projected = project(s, id);
    const move = projected.myActions.find((a) => a.type === "MOVE")!;
    expect(move.targets).not.toContain(String(placeKey03("POWER_ROOM", "Y2026")));
    place(s, id, "POWER_ROOM", "Y1996");
    expect(() => applyGameAction(s, id, { type: "TIME_JUMP" }, T0 + 71)).toThrow();
    expect(project(s, id).myActions.find((a) => a.type === "MOVE")!.targets).toContain(placeKey03("RESEARCH_WING", "Y1996"));
  });

  it("a preserved prototype leaves 2026 intact and adds no immediate collapse", () => {
    let s = advance(start(), 7);
    const id = s.turnOrder[s.activeIndex];
    place(s, id, "PROTOTYPE_ROOM", "Y1996");
    const before = s.collapse;
    s = applyGameAction(s, id, { type: "INTERVENE", nodeId: "PROTOTYPE_CORE", choiceId: "LEAVE" }, T0 + 70).state;
    expect(s.collapse).toBe(before);
    expect(s.temporal!.present.powerRoomExists).toBe(true);
    expect(s.temporal!.story.revealed).not.toContain("PREVENTION_ATTEMPT");
  });

  it("keeps private investigations private while publishing only supported fact pairs", () => {
    let s = advance(start(), 7);
    const id = s.turnOrder[s.activeIndex];
    const other = s.turnOrder.find((person) => person !== id)!;
    place(s, id, "DIRECTOR_OFFICE", "Y2026");
    s = applyGameAction(s, id, { type: "INVESTIGATE" }, T0 + 70).state;
    expect(s.temporal!.evidence[id]).toContain("SURVEILLANCE_TAPE");
    expect(s.temporal!.discoveredFacts).toEqual([]);
    s = applyGameAction(s, id, { type: "INVESTIGATE" }, T0 + 71).state;
    expect(s.temporal!.discoveredFacts).toEqual(["FOUNDER"]);
    expect(project(s, id).temporal!.myEvidence).toContain("FOUNDER_DISCREPANCY");
    expect(project(s, other).temporal!.myEvidence).not.toContain("FOUNDER_DISCREPANCY");
    expect(project(s, other).temporal!.discoveredFacts).toEqual(["FOUNDER"]);
    expect(s.temporal!.story.revealed).not.toContain("HISTORY_CAN_BE_DECEIVED");
    expect(s.temporal!.story.revealed).not.toContain("JI_NOTE");
    place(s, id, "CENTRAL_HALL", "Y2026");
    expect(project(s, id).myActions.find((a) => a.type === "INTERACT_NPC")?.targets).toContain("ZERO");
    s = applyGameAction(s, id, { type: "INTERACT_NPC", npcId: "ZERO" }, T0 + 72).state;
    expect(project(s, id).temporal!.myEvidence).toContain("ZERO_TRANSCRIPT");
    expect(project(s, other).temporal!.myEvidence).not.toContain("ZERO_TRANSCRIPT");
    expect(project(s, other).temporal!.story.revealed).toContain("ZERO_CONSULTED");
    expect(s.temporal!.story.revealed).not.toContain("ARCHIVIST_CONTACT");
    place(s, id, "DIRECTOR_OFFICE", "Y1996");
    s = applyGameAction(s, id, { type: "INVESTIGATE" }, T0 + 73).state;
    s = applyGameAction(s, id, { type: "INVESTIGATE" }, T0 + 74).state;
    expect(s.temporal!.surveillance.at(-1)).toMatchObject({ kind: "INVESTIGATION", evidenceId: "JI_MARGIN_NOTE" });
    expect(JSON.stringify(project(s, other).temporal!.surveillance)).not.toContain("evidenceId");
    expect(project(s, other).temporal!.myEvidence).not.toContain("JI_MARGIN_NOTE");
  });

  it("reveals the founding paradox by round 8 and the third route at round 9 without resolving an ending", () => {
    let s = advance(start(), 8);
    for (let step = 0; s.round === 8; step++) s = endTurn03(s, T0 + 80 + step);
    expect(s.temporal!.story.revealed).toContain("FOUNDING_PARADOX");
    expect(s.temporal!.discoveredFacts).toContain("FOUNDER");
    expect(s.temporal!.story.availableRoutes).toEqual(["OFFICIAL_HISTORY", "NO_TOMORROW"]);
    expect(s.round).toBe(9);
    for (let step = 0; !s.sequence && step < 3; step++) s = endTurn03(s, T0 + 85 + step);
    expect(s.phase).toBe("ACT_4");
    expect(s.sequence?.kind).toBe("S3_THIRD_ROUTE");
    expect(s.temporal!.story.availableRoutes).toEqual(["OFFICIAL_HISTORY", "NO_TOMORROW", "DECEIVE_HISTORY"]);
    expect(s.temporal!.story.revealed).toContain("HISTORY_CAN_BE_DECEIVED");
    expect(s.phase).not.toBe("ENDING");
    for (const id of s.turnOrder.slice(0, -1)) {
      s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 90).state;
      expect(s.round).toBe(9);
    }
    s = applyGameAction(s, s.turnOrder.at(-1)!, { type: "ACK_SEQUENCE" }, T0 + 91).state;
    expect(s.round).toBe(10);
    expect(s.phase).not.toBe("ENDING");
  });
});
