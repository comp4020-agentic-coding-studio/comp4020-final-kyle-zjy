import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { availableActions } from "../src/server/engine/actions.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { derivePresent03 } from "../src/shared/game/scenario03/nodes.ts";
import { placeKey03 } from "../src/shared/game/scenario03/map.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";
import { successfulAction03 } from "./scenario03-helpers.ts";

function start(): GameState {
  let s = startGame(createGame("s3-causal", seatsFor(3), SEED, T0, "S03_INCIDENT_ZERO"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
}

function place(s: GameState, id: string, roomId: "ARCHIVES" | "RESEARCH_WING", year: "Y1996" | "Y2026") {
  s.temporal!.locations[id] = { roomId, year };
  s.players[id].carriageIndex = placeKey03(roomId, year);
  s.players[id].ap = 3;
}

describe("Scenario 03 causal rewrites", () => {
  it("replays 1996 actions from baseline in order and changes real 2026 access, worker, badge and report", () => {
    let s = start();
    const id = s.turnOrder[s.activeIndex];
    place(s, id, "ARCHIVES", "Y1996");
    const first = successfulAction03(s, id, { type: "INTERVENE", nodeId: "ARCHIVE_GATE", choiceId: "OPEN" }, T0 + 2);
    s = first.state;
    expect(first.events.find((e) => e.kind === "S3_CAUSAL_REWRITE")?.payload).toMatchObject({ revision: 1, nodeId: "ARCHIVE_GATE", before: { secretArchiveOpen: false }, after: { secretArchiveOpen: true } });
    expect(s.temporal!.present.secretArchiveOpen).toBe(true);
    expect(s.temporal!.baselinePresent.secretArchiveOpen).toBe(false);
    expect(() => applyGameAction(s, id, { type: "INTERVENE", nodeId: "ARCHIVE_GATE", choiceId: "OPEN" }, T0 + 3)).toThrow();
    place(s, id, "ARCHIVES", "Y2026");
    expect(availableActions(s, id).find((a) => a.type === "MOVE")!.targets).toContain(placeKey03("SECRET_ARCHIVE", "Y2026"));
    s = applyGameAction(s, id, { type: "MOVE", toCarriage: placeKey03("SECRET_ARCHIVE", "Y2026") }, T0 + 3).state;
    expect(s.temporal!.locations[id].roomId).toBe("SECRET_ARCHIVE");
    place(s, id, "RESEARCH_WING", "Y1996");
    s = successfulAction03(s, id, { type: "INTERVENE", nodeId: "WORKER", choiceId: "SAVE" }, T0 + 4).state;
    expect(s.temporal!.present).toMatchObject({ workerPresent: true, badgeCache: true });
    place(s, id, "ARCHIVES", "Y1996");
    s = successfulAction03(s, id, { type: "INTERVENE", nodeId: "REPORT", choiceId: "CORRECT" }, T0 + 5).state;
    expect(s.temporal!.present.report).toBe("CORRECTED");
    expect(s.temporal!.causalRevision).toBe(3);
    expect(s.temporal!.interventions.map((i) => i.seq)).toEqual([1, 2, 3]);
    expect(derivePresent03(s.temporal!.baselinePresent, s.temporal!.interventions)).toEqual(s.temporal!.present);
    expect(s.collapse).toBe(0);
    expect(project(s, id).temporal!.present).toEqual(s.temporal!.present);
  });

  it("keeps sealed case evidence private across projection and snapshot reload", () => {
    let s = start();
    const id = s.turnOrder[s.activeIndex];
    const other = s.turnOrder.find((x) => x !== id)!;
    place(s, id, "ARCHIVES", "Y2026");
    s = successfulAction03(s, id, { type: "INVESTIGATE" }, T0 + 2).state;
    const evidence = `CASE_FILE_${s.temporal!.present.caseFile}`;
    expect(project(s, id).temporal!.myEvidence).toContain(evidence);
    expect(project(s, other).temporal!.myEvidence).toEqual([]);
    expect(JSON.stringify(project(s, other))).not.toContain(evidence);
    const restored = JSON.parse(JSON.stringify(s)) as GameState;
    expect(project(restored, id).temporal!.myEvidence).toContain(evidence);
    expect(project(restored, other).temporal!.myEvidence).toEqual([]);
    expect(() => applyGameAction(s, id, { type: "INVESTIGATE" }, T0 + 3)).toThrow();
  });

  it("rejects wrong-year, wrong-room and invented choices without changing the timeline", () => {
    const s = start();
    const id = s.turnOrder[s.activeIndex];
    expect(() => applyGameAction(s, id, { type: "INTERVENE", nodeId: "WORKER", choiceId: "SAVE" }, T0 + 2)).toThrow();
    place(s, id, "ARCHIVES", "Y1996");
    expect(() => applyGameAction(s, id, { type: "INTERVENE", nodeId: "WORKER", choiceId: "SAVE" }, T0 + 3)).toThrow();
    expect(() => applyGameAction(s, id, { type: "INTERVENE", nodeId: "REPORT", choiceId: "ERASE" }, T0 + 4)).toThrow();
    expect(s.temporal!.causalRevision).toBe(0);
    expect(s.temporal!.interventions).toEqual([]);
  });

  it("records a leave decision without claiming a 2026 rewrite", () => {
    const s = start();
    const id = s.turnOrder[s.activeIndex];
    place(s, id, "ARCHIVES", "Y1996");
    const step = successfulAction03(s, id, { type: "INTERVENE", nodeId: "ARCHIVE_GATE", choiceId: "LEAVE" }, T0 + 2);
    expect(step.state.temporal!.interventions).toHaveLength(1);
    expect(step.state.temporal!.causalRevision).toBe(0);
    expect(step.events.some((e) => e.kind === "S3_CAUSAL_REWRITE")).toBe(false);
    expect(step.state.temporal!.present).toEqual(step.state.temporal!.baselinePresent);
  });

  it("replays the same seeded case file and intervention roll", () => {
    const initialA = start();
    const initialB = start();
    const id = initialA.turnOrder[initialA.activeIndex];
    expect(initialA.temporal!.baselinePresent).toEqual(initialB.temporal!.baselinePresent);
    place(initialA, id, "RESEARCH_WING", "Y1996");
    place(initialB, id, "RESEARCH_WING", "Y1996");
    const beforeCalls = initialA.rngCalls;
    const action = { type: "INTERVENE", nodeId: "WORKER", choiceId: "SAVE" } as const;
    const a = successfulAction03(initialA, id, action, T0 + 2).state;
    const b = successfulAction03(initialB, id, action, T0 + 2).state;
    expect(a.temporal).toEqual(b.temporal);
    expect(a.rngCalls).toBeGreaterThan(beforeCalls);
  });
});
