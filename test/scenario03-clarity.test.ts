import { describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import { actSteps03, routeSteps03 } from "../src/client/game/scenario03/clarity03.ts";
import { investigationAt03 } from "../src/client/game/scenario03/Panels03.tsx";
import { createGame } from "../src/server/engine/create.ts";
import { startGame, applyGameAction } from "../src/server/engine/engine.ts";
import { routeTargets03 } from "../src/server/engine/scenario03/ending.ts";
import { project } from "../src/server/engine/project.ts";
import { Hub } from "../src/server/rooms/hub.ts";
import type { GameRunner } from "../src/server/game/runner.ts";
import type { RoomService } from "../src/server/rooms/service.ts";
import { placeKey03 } from "../src/shared/game/scenario03/map.ts";
import type { EndingRoute03 } from "../src/shared/game/scenario03/story.ts";
import type { GameState, PlayerView } from "../src/shared/game/state.ts";
import { seatsFor, SEED, T0 } from "./helpers.ts";
import { successfulAction03 } from "./scenario03-helpers.ts";

function start(n = 3): GameState {
  let s = startGame(createGame("s3-clarity", seatsFor(n), SEED, T0, "S03_INCIDENT_ZERO"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
}

function place(s: GameState, id: string, roomId: "ARCHIVES" | "DIRECTOR_OFFICE" | "MAIN_LAB", year: "Y1996" | "Y2026"): void {
  s.temporal!.locations[id] = { roomId, year };
  s.players[id].carriageIndex = placeKey03(roomId, year);
  s.players[id].ap = 3;
}

/** Keep two sockets attached while the runner's normal change callback pushes new projections. */
function connectedViews(state: GameState, ids: string[]) {
  let current = state;
  const latest = new Map<string, PlayerView>();
  const received = new Map<string, number>();
  const sockets = new Map(ids.map((id) => [id, {
    send(raw: string) {
      const message = JSON.parse(raw) as { t: string; snapshot?: { game: PlayerView } };
      if (message.t !== "STATE" || !message.snapshot?.game) return;
      latest.set(id, message.snapshot.game);
      received.set(id, (received.get(id) ?? 0) + 1);
    },
    terminate() {},
  } as unknown as WebSocket]));
  const runner = { state: () => current, evictIfIdle: () => false, onChange: () => {} } as unknown as GameRunner;
  const rooms = { roomState: () => ({ code: "SHARED", phase: current.phase, scenarioId: current.scenarioId, members: [], version: current.version }) } as unknown as RoomService;
  const hub = new Hub(rooms, runner);
  Reflect.set(hub, "sockets", new Map([["SHARED", sockets]]));
  const broadcast = (next: GameState) => {
    current = next;
    runner.onChange("SHARED", []);
  };
  broadcast(state);
  return { latest, received, broadcast, close: () => hub.close() };
}

function finalAct(s: GameState): void {
  s.act = 4;
  s.phase = "ACT_4";
  s.round = 10;
  s.temporal!.story.availableRoutes = ["OFFICIAL_HISTORY", "NO_TOMORROW", "DECEIVE_HISTORY"];
}

function closeLoops(s: GameState): void {
  for (const entry of s.temporal!.bootstrap) {
    entry.placedBy = entry.assignedTo;
    const item = s.temporal!.storedItems[entry.instanceId];
    item.storedBy = entry.assignedTo;
    item.storedRound = 3;
    item.status = "STORED";
  }
}

describe("Scenario 03 player guidance", () => {
  it.each([
    { act: 1, room: "ARCHIVES", year: "Y2026", key: "s3.guide.act1.file", evidence: "CASE_FILE_" },
    { act: 2, room: "DIRECTOR_OFFICE", year: "Y1996", key: "s3.guide.act2.ledger", evidence: "ACCESS_LEDGER" },
    { act: 3, room: "MAIN_LAB", year: "Y2026", key: "s3.guide.act3.staff", evidence: "STAFF_DISCREPANCY" },
  ] as const)("broadcasts Act $act investigation completion to both connected players without sharing evidence", ({ act, room, year, key, evidence }) => {
    const s = start(2);
    s.act = act;
    s.phase = `ACT_${act}` as GameState["phase"];
    s.round = act === 1 ? 1 : act === 2 ? 4 : 7;
    const a = s.turnOrder[s.activeIndex];
    const b = s.turnOrder.find((id) => id !== a)!;
    place(s, a, room, year);
    const clients = connectedViews(s, [a, b]);
    try {
      for (const id of [a, b]) expect(actSteps03(clients.latest.get(id)!).find((step) => step.key === key)?.done).toBe(false);
      const result = successfulAction03(s, a, { type: "INVESTIGATE" }, T0 + 20).state;
      clients.broadcast(result);
      for (const id of [a, b]) {
        expect(clients.received.get(id)).toBe(2);
        expect(actSteps03(clients.latest.get(id)!).find((step) => step.key === key)?.done).toBe(true);
      }
      expect(result.temporal!.evidence[a].some((id) => id.startsWith(evidence))).toBe(true);
      expect(clients.latest.get(b)!.temporal!.myEvidence).toEqual([]);
      expect(clients.latest.get(b)!.temporal!.myObligations.every((entry) => entry.assignedTo === b)).toBe(true);
      expect(clients.latest.get(b)!.mySecrets?.archiveLead03).toBeUndefined();
    } finally {
      clients.close();
    }
  });

  it("uses team evidence for every Act I–III investigation, including beats that can trigger without investigation", () => {
    const s = start(2);
    const [a, b] = s.turnOrder;
    const expectations = [
      [1, `CASE_FILE_${s.temporal!.present.caseFile}`, "s3.guide.act1.file"],
      [2, "ACCESS_LEDGER", "s3.guide.act2.ledger"],
      [2, "PROTOTYPE_LOG", "s3.guide.act2.prototype"],
      [2, "SURVEILLANCE_TAPE", "s3.guide.act2.tape"],
      [3, "FOUNDER_DISCREPANCY", "s3.guide.act3.founder"],
      [3, "STAFF_DISCREPANCY", "s3.guide.act3.staff"],
      [3, "PROTOTYPE_DISCREPANCY", "s3.guide.act3.prototype"],
      [3, "FOUNDING_CHARTER", "s3.guide.act3.charter"],
    ] as const;
    s.temporal!.story.revealed.push("FOUNDER_CLUE", "FOUNDING_PARADOX");
    s.temporal!.discoveredFacts.push("FOUNDER");
    s.act = 3;
    expect(actSteps03(project(s, b)).find((step) => step.key === "s3.guide.act3.founder")?.done).toBe(false);
    expect(actSteps03(project(s, b)).find((step) => step.key === "s3.guide.act3.charter")?.done).toBe(false);
    for (const [act, evidence, key] of expectations) {
      s.act = act;
      expect(actSteps03(project(s, a)).find((step) => step.key === key)?.done).toBe(false);
      expect(actSteps03(project(s, b)).find((step) => step.key === key)?.done).toBe(false);
      s.temporal!.evidence[a].push(evidence);
      expect(actSteps03(project(s, a)).find((step) => step.key === key)?.done).toBe(true);
      expect(actSteps03(project(s, b)).find((step) => step.key === key)?.done).toBe(true);
      expect(project(s, b).temporal!.myEvidence).toEqual([]);
    }
  });

  it("requires a team investigation of the current case-file version after a causal rewrite", () => {
    const s = start(2);
    const [a, b] = s.turnOrder;
    const original = s.temporal!.present.caseFile;
    s.temporal!.evidence[a].push(`CASE_FILE_${original}`);
    expect(actSteps03(project(s, b)).find((step) => step.key === "s3.guide.act1.file")?.done).toBe(true);
    s.temporal!.present.caseFile = original === "A" ? "B" : "A";
    expect(actSteps03(project(s, a)).find((step) => step.key === "s3.guide.act1.file")?.done).toBe(false);
    expect(actSteps03(project(s, b)).find((step) => step.key === "s3.guide.act1.file")?.done).toBe(false);
    s.temporal!.evidence[b].push(`CASE_FILE_${s.temporal!.present.caseFile}`);
    expect(actSteps03(project(s, a)).find((step) => step.key === "s3.guide.act1.file")?.done).toBe(true);
    expect(actSteps03(project(s, b)).find((step) => step.key === "s3.guide.act1.file")?.done).toBe(true);
  });

  it("keeps story, intervention, relic, and final-route steps identical for both viewers", () => {
    const s = start(2);
    const [a, b] = s.turnOrder;
    s.temporal!.story.revealed.push("BOOTSTRAP_TRACE", "FIRST_JUMP");
    s.temporal!.interventions.push({ seq: 1, nodeId: "ARCHIVE_GATE", choiceId: "OPEN", actorId: a, round: 1, roomId: "ARCHIVES", year: "Y1996" });
    expect(actSteps03(project(s, a))).toEqual(actSteps03(project(s, b)));
    expect(actSteps03(project(s, a)).filter((step) => step.done).map((step) => step.key)).toEqual([
      "s3.guide.act1.relic", "s3.guide.act1.jump", "s3.guide.act1.change",
    ]);
    finalAct(s);
    s.temporal!.present.accidentRecord = "OFFICIAL";
    closeLoops(s);
    expect(routeSteps03(project(s, a), "OFFICIAL_HISTORY")).toEqual(routeSteps03(project(s, b), "OFFICIAL_HISTORY"));
    expect(routeSteps03(project(s, a), "OFFICIAL_HISTORY").every((step) => step.done)).toBe(true);
  });

  it("keeps act-specific leads and keeper assignments behind their real gates", () => {
    const s = start();
    const id = s.turnOrder[s.activeIndex];
    const other = s.turnOrder.find((playerId) => playerId !== id)!;
    const first = project(s, id);
    expect(actSteps03(first).map((step) => step.key)).toEqual([
      "s3.guide.act1.file", "s3.guide.act1.relic", "s3.guide.act1.jump", "s3.guide.act1.change",
    ]);
    expect(routeSteps03(first, "DECEIVE_HISTORY")).toEqual([]);
    expect(JSON.stringify(actSteps03(first))).not.toMatch(/INTRUDERS_IDENTIFIED|FOUNDER_DISCREPANCY|STAFF_DISCREPANCY/);
    const mine = new Set(s.temporal!.bootstrap.filter((entry) => entry.assignedTo === id).map((entry) => entry.instanceId));
    expect(new Set(first.temporal!.myObligations.map((entry) => entry.instanceId))).toEqual(mine);
    expect(project(s, other).temporal!.myObligations.every((entry) => entry.assignedTo === other)).toBe(true);

    s.act = 2;
    expect(actSteps03(project(s, id)).map((step) => step.key)).toEqual([
      "s3.guide.act2.ledger", "s3.guide.act2.prototype", "s3.guide.act2.tape",
    ]);
    expect(investigationAt03(project(s, id), "DIRECTOR_OFFICE", "Y2026")).toBe("s3.intruders.surveillance");
    expect(investigationAt03(project(s, id), "PROTOTYPE_ROOM", "Y2026")).toBeNull();
    s.act = 3;
    expect(actSteps03(project(s, id)).map((step) => step.key)).toContain("s3.guide.act3.founder");
    expect(investigationAt03(project(s, id), "PROTOTYPE_ROOM", "Y2026")).toBe("s3.paradox.prototype");
  });

  it("marks each Act IV route ready exactly when the server can resolve it", () => {
    const routes: EndingRoute03[] = ["OFFICIAL_HISTORY", "NO_TOMORROW", "DECEIVE_HISTORY"];
    const s = start();
    finalAct(s);
    const id = s.turnOrder[s.activeIndex];
    const check = () => {
      const view = project(s, id);
      for (const route of routes) {
        const steps = routeSteps03(view, route);
        expect(steps.length).toBeGreaterThan(0);
        expect(steps.every((step) => step.done), route).toBe(routeTargets03(s).includes(route));
      }
    };
    check();
    s.temporal!.present.accidentRecord = "OFFICIAL";
    closeLoops(s);
    check();
    s.temporal!.present.accidentRecord = "ERASED";
    s.temporal!.interventions.push({ seq: 1, nodeId: "PROTOTYPE_CORE", choiceId: "SHUT_DOWN", actorId: id, round: 7, roomId: "PROTOTYPE_ROOM", year: "Y1996" });
    check();
    s.temporal!.present.accidentRecord = "CONTROLLED";
    s.temporal!.present.staffEvacuated = true;
    s.temporal!.present.jiStaged = true;
    s.temporal!.present.prototypeHidden = true;
    check();
  });

  it("shows action reasons from the same state the server validates and keeps Trade at 0 AP", () => {
    const s = start();
    const id = s.turnOrder[s.activeIndex];
    const p = s.players[id];
    const item = s.temporal!.storedItems[s.temporal!.bootstrap.find((entry) => entry.assignedTo === id)!.instanceId];
    item.ownerId = id;
    item.status = "HELD_2026";
    p.ap = 3;
    const actions = project(s, id).myActions;
    expect(actions.find((action) => action.type === "STORE_ITEM")?.reason?.k).toContain("Store the");
    expect(actions.find((action) => action.type === "TRADE")?.apCost).toBe(0);
    expect(actions.find((action) => action.type === "SEARCH")?.reason?.k).toContain("2026 Research Wing");
    s.temporal!.locations[id] = { roomId: "ARCHIVES", year: "Y1996" };
    p.carriageIndex = placeKey03("ARCHIVES", "Y1996");
    expect(project(s, id).myActions.find((action) => action.type === "INVESTIGATE")?.reason?.k).toContain("no new clues");
  });
});
