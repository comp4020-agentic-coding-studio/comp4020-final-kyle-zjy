import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { directiveMet03, directiveOf03 } from "../src/server/engine/scenario03/directives.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { seatsFor, SEED, T0 } from "./helpers.ts";

function start(n: number, seed = SEED): GameState {
  let s = startGame(createGame("s3-directives", seatsFor(n), seed, T0, "S03_INCIDENT_ZERO"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
}

describe("scenario 03 private directives", () => {
  it("deals each traveller a directive from the seed alone, distinct at five or fewer, without touching the generator", () => {
    const s = start(5);
    const before = structuredClone(s.rng);
    const dealt = s.turnOrder.map((id) => directiveOf03(s, id));
    expect(new Set(dealt).size).toBe(5);
    expect(s.turnOrder.map((id) => directiveOf03(start(5), id))).toEqual(dealt);
    expect(s.rng).toEqual(before);
    const other = start(5, "f".repeat(32));
    expect(other.turnOrder.map((id) => directiveOf03(other, id))).not.toEqual(dealt);
  });

  it("shows a traveller only their own directive, unjudged, until the run is over", () => {
    const s = start(3);
    const [a, b] = s.turnOrder;
    const mine = project(s, a).temporal!.directives!;
    expect(mine).toEqual([{ playerId: a, directive: directiveOf03(s, a), met: null }]);
    expect(JSON.stringify(project(s, a).temporal)).not.toContain(`"playerId":"${b}","directive"`);
    s.phase = "RESULTS";
    const all = project(s, a).temporal!.directives!;
    expect(all.map((d) => d.playerId)).toEqual(s.turnOrder);
    expect(all.every((d) => typeof d.met === "boolean")).toBe(true);
  });

  it("judges directives from the final history, and some pull against each other", () => {
    const s = start(3);
    const shut = { seq: 1, nodeId: "PROTOTYPE_CORE" as const, choiceId: "SHUT_DOWN", actorId: s.turnOrder[0], round: 7, roomId: "PROTOTYPE_ROOM" as const, year: "Y1996" as const };
    expect(directiveMet03(s, "PURGE")).toBe(false);
    expect(directiveMet03(s, "STABILITY")).toBe(true);
    s.temporal!.interventions.push(shut);
    s.temporal!.present.administrationIntegrity = "FADING";
    expect(directiveMet03(s, "PURGE")).toBe(true);
    expect(directiveMet03(s, "STABILITY")).toBe(false);
    expect(directiveMet03(s, "HUMANE")).toBe(false);
    s.temporal!.present.staffEvacuated = true;
    expect(directiveMet03(s, "HUMANE")).toBe(true);
  });
});
