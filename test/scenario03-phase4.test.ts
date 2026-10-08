import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { placeKey03 } from "../src/shared/game/scenario03/map.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";
import { endTurn03 } from "./scenario03-helpers.ts";

function start(): GameState {
  let s = startGame(createGame("s3-act1", seatsFor(3), SEED, T0, "S03_INCIDENT_ZERO"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
}

describe("Scenario 03 Act I", () => {
  it("reveals only earned beats, keeps testimony private, and survives reconnect", () => {
    let s = start();
    const id = s.turnOrder[s.activeIndex];
    const other = s.turnOrder.find((x) => x !== id)!;
    expect(s.temporal!.story.revealed).toEqual(["LOCKDOWN"]);
    s = applyGameAction(s, id, { type: "MOVE", toCarriage: placeKey03("ARCHIVES", "Y2026") }, T0 + 2).state;
    s = applyGameAction(s, id, { type: "INTERACT_NPC", npcId: "ARCHIVIST_00" }, T0 + 3).state;
    expect(s.temporal!.story.revealed).toContain("ARCHIVIST_CONTACT");
    expect(project(s, id).temporal!.myEvidence).toContain("ARCHIVIST_NOTE");
    expect(project(s, other).temporal!.myEvidence).toEqual([]);
    expect(() => applyGameAction(s, id, { type: "INTERACT_NPC", npcId: "ARCHIVIST_00" }, T0 + 4)).toThrow();
    s = applyGameAction(s, id, { type: "INVESTIGATE" }, T0 + 5).state;
    expect(s.temporal!.story.revealed).toContain("OFFICIAL_FILE");
    expect(s.temporal!.evidence[id]).toContain(`CASE_FILE_${s.temporal!.present.caseFile}`);
    expect(s.temporal!.story.revealed).not.toContain("FIRST_REWRITE");
    const restored = JSON.parse(JSON.stringify(s)) as GameState;
    expect(project(restored, id).temporal!.story).toEqual(project(s, id).temporal!.story);
    expect(project(restored, other).temporal!.myEvidence).toEqual([]);
  });

  it("first jump and material intervention reveal once; a preserved decision does not claim a rewrite", () => {
    let s = start();
    const id = s.turnOrder[s.activeIndex];
    s = applyGameAction(s, id, { type: "TIME_JUMP" }, T0 + 2).state;
    expect(s.temporal!.story.revealed).toContain("FIRST_JUMP");
    s.temporal!.locations[id] = { roomId: "ARCHIVES", year: "Y1996" };
    s.players[id].carriageIndex = placeKey03("ARCHIVES", "Y1996");
    s.players[id].ap = 3;
    s = applyGameAction(s, id, { type: "INTERVENE", nodeId: "ARCHIVE_GATE", choiceId: "LEAVE" }, T0 + 3).state;
    expect(s.temporal!.story.revealed).not.toContain("FIRST_REWRITE");
    s = start();
    const actor = s.turnOrder[s.activeIndex];
    s.temporal!.locations[actor] = { roomId: "ARCHIVES", year: "Y1996" };
    s.players[actor].carriageIndex = placeKey03("ARCHIVES", "Y1996");
    s = applyGameAction(s, actor, { type: "INTERVENE", nodeId: "ARCHIVE_GATE", choiceId: "OPEN" }, T0 + 4).state;
    expect(s.temporal!.story.revealed.filter((beat) => beat === "FIRST_REWRITE")).toHaveLength(1);
    expect(s.temporal!.interventions[0]).toMatchObject({ actorId: actor, round: 1, choiceId: "OPEN" });
    expect(s.temporal!.story.revealed).not.toContain("INTRUDERS_IDENTIFIED");
  });

  it("relic provenance appears only after a numbered relic is actually picked up", () => {
    let s = start();
    const id = s.turnOrder[s.activeIndex];
    expect(s.temporal!.story.revealed).not.toContain("BOOTSTRAP_TRACE");
    s = applyGameAction(s, id, { type: "PICK_UP", instanceId: "relic-2" }, T0 + 2).state;
    expect(s.temporal!.story.revealed).toContain("BOOTSTRAP_TRACE");
    expect(s.temporal!.storedItems["relic-2"].ownerId).toBe(id);
    expect(s.temporal!.bootstrap.find((entry) => entry.instanceId === "relic-2")?.placedBy).toBeNull();
  });

  it("reveals the round 2 signal and opens Act II rooms only after round 3", () => {
    let s = start();
    for (let guard = 0; guard < 12 && s.round < 4; guard++) {
      const id = s.turnOrder[s.activeIndex];
      s = endTurn03(s, T0 + guard + 2);
      if (s.round <= 3) expect(s.act).toBe(1);
    }
    expect(s.round).toBe(4);
    expect(s.phase).toBe("ACT_2");
    expect(s.temporal!.story.revealed).toContain("ROUND2_SIGNAL");
    expect(s.temporal!.story.revealed).toContain("ACT1_CLOSE");
    expect(s.temporal!.story.revealed).not.toContain("OFFICIAL_FILE");
    expect(s.temporal!.story.revealed).not.toContain("FIRST_JUMP");
  });
});
