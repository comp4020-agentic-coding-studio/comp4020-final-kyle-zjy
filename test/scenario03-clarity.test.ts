import { describe, expect, it } from "vitest";
import { actSteps03, routeSteps03 } from "../src/client/game/scenario03/clarity03.ts";
import { investigationAt03 } from "../src/client/game/scenario03/Panels03.tsx";
import { createGame } from "../src/server/engine/create.ts";
import { startGame, applyGameAction } from "../src/server/engine/engine.ts";
import { routeTargets03 } from "../src/server/engine/scenario03/ending.ts";
import { project } from "../src/server/engine/project.ts";
import { placeKey03 } from "../src/shared/game/scenario03/map.ts";
import type { EndingRoute03 } from "../src/shared/game/scenario03/story.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { seatsFor, SEED, T0 } from "./helpers.ts";

function start(): GameState {
  let s = startGame(createGame("s3-clarity", seatsFor(3), SEED, T0, "S03_INCIDENT_ZERO"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
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
