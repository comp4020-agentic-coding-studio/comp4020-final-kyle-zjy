import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { project } from "../src/server/engine/project.ts";
import { results02 } from "../src/server/engine/scenario02/boat.ts";
import { tieFor, tieMet } from "../src/server/engine/scenario02/ties.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";

const make = (n: number, seed = SEED): GameState => createGame("g", seatsFor(n), seed, T0, "S02_SUNKEN_CITY");

describe("scenario 02 private ties", () => {
  it("every player has a tie, and a seed always gives the same ones", () => {
    const a = make(5), b = make(5);
    for (const id of a.turnOrder) expect(a.secrets[id].tie02).toBeDefined();
    expect(Object.fromEntries(a.turnOrder.map((id) => [id, a.secrets[id].tie02]))).toEqual(Object.fromEntries(b.turnOrder.map((id) => [id, b.secrets[id].tie02])));
    // the tie draws nothing from the run's generator
    expect(a.rngCalls).toBe(createGame("g", seatsFor(5), SEED, T0, "S02_SUNKEN_CITY").rngCalls);
    expect(tieFor("seed-one", "a", ["NURSE"])).toEqual(tieFor("seed-one", "a", ["NURSE"]));
  });

  it("the projection never carries another player's tie before the results", () => {
    const s = make(4);
    for (const viewer of s.turnOrder) {
      const v = project(s, viewer);
      expect(v.mySecrets?.tie02).toEqual(s.secrets[viewer].tie02);
      // only the viewer's own tie is in the payload (others may share its words, so count the key)
      expect(JSON.stringify(v).split("tie02").length - 1).toBe(1);
      expect(v.results).toBeNull();
    }
  });

  it("the results mark a tie met or unmet from what happened", () => {
    const s = make(3);
    const npc = s.city!.npcs[0].id;
    s.secrets.a.tie02 = { kind: "RESCUE", target: npc };
    s.secrets.b.tie02 = { kind: "ABOARD", target: null };
    s.secrets.c.tie02 = { kind: "RESTORE", target: "PUMP_STATION" };
    s.city!.npcs[0].state = "RESCUED";
    s.city!.boat.aboard = ["c"];
    s.city!.boat.launched = true;
    s.city!.facilities.PUMP_STATION.done = true;
    s.city!.facilities.PUMP_STATION.contributors = { c: 2 };
    const r = Object.fromEntries(results02({ s, now: T0, events: [] }).map((x) => [x.playerId, x.tie02]));
    expect(r.a).toMatchObject({ kind: "RESCUE", met: true });
    expect(r.b).toMatchObject({ kind: "ABOARD", met: false });
    expect(r.c).toMatchObject({ kind: "RESTORE", met: true });
    s.city!.facilities.PUMP_STATION.contributors = {};
    expect(tieMet(s, "c", s.secrets.c.tie02!)).toBe(false);
  });
});
