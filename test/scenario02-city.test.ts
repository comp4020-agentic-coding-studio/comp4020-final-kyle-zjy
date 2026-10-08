import { describe, expect, it } from "vitest";
import { activePlayerId, type Ctx } from "../src/server/engine/context.ts";
import { createGame } from "../src/server/engine/create.ts";
import { changeCollapse } from "../src/server/engine/effects.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { canMove, generateCity, moveTargets, neighbours, reachableAt, safeCity, solvable } from "../src/server/engine/scenario02/city.ts";
import { seedState } from "../src/server/engine/rng.ts";
import { ADJACENT, FRAGILE, hexDistance, PART_SITES, ZONES, zoneIndex } from "../src/shared/game/scenario02/map.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { m } from "../src/shared/i18n/msg.ts";
import { rigNextDie, SEED, seatsFor, T0 } from "./helpers.ts";

// PHASE S2-2: the sinking city. The map is a hex grid; the water follows a
// seeded schedule as Collapse rises; every drawn city can still be won if the
// water keeps to that schedule; people caught by it are moved and hurt.

const ctxOf = (s: GameState): Ctx => ({ s, now: T0, events: [] });
const ack = (s: GameState, t: number) => s.turnOrder.reduce((x, id) => applyGameAction(x, id, { type: "ACK_SEQUENCE" }, t).state, s);
/** A scenario 02 run at its first turn. */
function city(n = 3, seed = SEED): GameState {
  return ack(startGame(createGame("g", seatsFor(n), seed, T0, "S02_SUNKEN_CITY"), T0).state, T0 + 1);
}
const at = (id: string) => zoneIndex(id);
/** A distinct hex seed per index (seeds are hex: anything else reads as zeros). */
const seedFor = (i: number) => ((i + 1) * 2654435761 >>> 0).toString(16).padStart(8, "0").repeat(4);
const fresh = (i: number) => generateCity({ rng: seedState(seedFor(i)), rngCalls: 0 } as GameState);

describe("the hex map", () => {
  it("has 31 zones whose sides are exactly the hex neighbours, and fragile crossings on real sides", () => {
    expect(ZONES).toHaveLength(31);
    expect(new Set(ZONES.map((z) => z.id)).size).toBe(31);
    const pairs = new Set(ADJACENT.map(([a, b]) => `${a}-${b}`));
    for (let a = 0; a < ZONES.length; a++) for (let b = a + 1; b < ZONES.length; b++) expect(pairs.has(`${a}-${b}`), `${ZONES[a].id}/${ZONES[b].id}`).toBe(hexDistance(a, b) === 1);
    for (const f of FRAGILE) expect(hexDistance(at(f.a), at(f.b)), `${f.a}/${f.b}`).toBe(1);
  });
});

describe("drawing a city", () => {
  it("over 1000 seeds, every city keeps a winnable path as its own flood schedule plays out", () => {
    for (let i = 0; i < 1000; i++) expect(solvable(fresh(i)), seedFor(i)).toEqual([]);
    expect(solvable(safeCity())).toEqual([]);
  });

  it("each part is hidden once at one of its sites; the same seed draws the same city", () => {
    for (let i = 0; i < 50; i++) {
      const c = fresh(i);
      for (const [part, sites] of Object.entries(PART_SITES)) {
        const holders = c.zones.map((z, j) => (z.caches.includes(part) ? ZONES[j].id : null)).filter(Boolean);
        expect(holders, part).toHaveLength(1);
        expect(sites).toContain(holders[0]);
      }
      expect(c.edges.filter((e) => e.broken)).toHaveLength(1);
    }
    expect(fresh(7)).toEqual(fresh(7));
    expect(fresh(7)).not.toEqual(fresh(8));
  });

  it("starts everyone together at a dry Civic Square, for 2 and for 10 players", () => {
    for (const n of [2, 10]) {
      const s = city(n);
      expect(s.turnOrder).toHaveLength(n);
      for (const id of s.turnOrder) expect(s.players[id].carriageIndex).toBe(at("CIVIC_SQUARE"));
      expect(s.city!.zones[at("CIVIC_SQUARE")].status).toBe("NORMAL");
    }
  });
});

describe("the water rises", () => {
  it("zones flood and go under on schedule, never come back up, and tunnels give way", () => {
    const s = city();
    const ctx = ctxOf(s);
    const seen = s.city!.zones.map((z) => z.status);
    for (let c = 1; c <= 11; c++) {
      changeCollapse(ctx, 1, m`test`);
      s.city!.zones.forEach((z, i) => {
        const depth = { NORMAL: 0, FLOODED: 1, SUBMERGED: 2, BLOCKED: 3 };
        expect(depth[z.status], ZONES[i].id).toBeGreaterThanOrEqual(depth[seen[i]]);
        seen[i] = z.status;
        expect(z.status === "SUBMERGED", ZONES[i].id).toBe(c >= z.sinkAt);
      });
      for (const e of s.city!.edges) if (e.breakAt !== null) expect(e.broken).toBe(c >= e.breakAt);
      if (c === 10) {
        // by then only the high ground and the pier are left
        const dry = s.city!.zones.map((z, i) => (z.status === "SUBMERGED" ? null : ZONES[i])).filter(Boolean);
        expect(dry.every((z) => z!.elevation === "HIGH" || z!.id === "HARBOUR")).toBe(true);
      }
    }
    expect(s.city!.zones[at("HARBOUR")].status).not.toBe("SUBMERGED");
    changeCollapse(ctx, -3, m`test`);
    expect(s.city!.zones.map((z) => z.status)).toEqual(seen);
  });

  it("the act follows the water: Collapse 5 opens act 2, 9 opens act 3, each with its scene", () => {
    const s = city();
    // the parts are safe aboard, so the water alone decides
    s.city!.boat.installed = ["ENGINE", "FUEL", "NAV"];
    const ctx = ctxOf(s);
    changeCollapse(ctx, 4, m`test`);
    expect(s.act).toBe(1);
    changeCollapse(ctx, 1, m`test`);
    expect(s).toMatchObject({ act: 2, phase: "ACT_2", sequence: { kind: "FLOOD", stage: 2 } });
    s.sequence = null;
    changeCollapse(ctx, 4, m`test`);
    expect(s).toMatchObject({ act: 3, phase: "ACT_3", sequence: { kind: "FLOOD", stage: 3 } });
  });

  it("round-end water usually rises 1, sometimes holds, sometimes surges 2; the pumps cancel a rise", () => {
    const rises = new Set<number>();
    for (let i = 0; i < 60; i++) {
      let s = city(2, seedFor(i));
      s.eventDeck = ["S2_SALVAGE"]; // an event that leaves the water alone
      const before = s.collapse;
      for (let t = T0 + 2; s.round === 1; t++) s = applyGameAction(s, activePlayerId(s)!, { type: "END_TURN" }, t).state;
      rises.add(s.collapse - before);
    }
    expect([...rises].sort()).toEqual([0, 1, 2]);
    let s = city(2);
    s.eventDeck = ["S2_SALVAGE"];
    s.city!.hold = 2;
    const before = s.collapse;
    for (let t = T0 + 2; s.round === 1; t++) s = applyGameAction(s, activePlayerId(s)!, { type: "END_TURN" }, t).state;
    expect(s.collapse).toBe(before);
  });

  it("someone standing in a zone as it goes under is moved to the nearest dry zone they can reach (through water if need be)", () => {
    const s = city();
    const me = s.turnOrder[0];
    const metro = at("METRO");
    s.players[me].carriageIndex = metro;
    for (const z of s.city!.zones) z.sinkAt = Math.max(z.sinkAt, 6);
    s.city!.zones[metro].sinkAt = 3;
    changeCollapse(ctxOf(s), 3, m`test`);
    const p = s.players[me];
    expect(p.carriageIndex).not.toBe(metro);
    expect(neighbours(s.city!, metro)).toContain(p.carriageIndex);
    expect(s.city!.zones[p.carriageIndex].status).not.toBe("SUBMERGED");
    expect(p.sanity).toBeGreaterThanOrEqual(2);
  });

  it("with nowhere to wade to, they wash up at the nearest dry ground and lose more", () => {
    const s = city();
    const me = s.turnOrder[0];
    const marina = at("WEST_MARINA");
    s.players[me].carriageIndex = marina;
    for (const z of s.city!.zones) z.sinkAt = Math.max(z.sinkAt, 6);
    s.city!.zones[marina].sinkAt = 3;
    // every road out of the marina is gone
    for (const e of s.city!.edges) if (e.a === marina || e.b === marina) e.broken = true;
    changeCollapse(ctxOf(s), 3, m`test`);
    expect(s.city!.zones[s.players[me].carriageIndex].status).not.toBe("SUBMERGED");
    expect(s.players[me].sanity).toBeLessThanOrEqual(2);
  });
});

describe("getting around", () => {
  function standing(zone: string, patch: (s: GameState) => void = () => {}) {
    const s = city();
    const me = activePlayerId(s)!;
    s.players[me].carriageIndex = at(zone);
    patch(s);
    return { s, me };
  }

  it("a dry neighbour is one action point away; a far zone, a broken road or a sunk zone can't be reached", () => {
    const { s, me } = standing("CIVIC_SQUARE");
    const next = applyGameAction(s, me, { type: "MOVE", toCarriage: at("CITY_HALL") }, T0 + 5).state;
    expect(next.players[me]).toMatchObject({ carriageIndex: at("CITY_HALL"), ap: 1 });
    expect(() => applyGameAction(s, me, { type: "MOVE", toCarriage: at("HARBOUR") }, T0 + 5)).toThrow(/next to yours/);
    const e = s.city!.edges.find((x) => [x.a, x.b].includes(at("CIVIC_SQUARE")) && [x.a, x.b].includes(at("PARK")))!;
    e.broken = true;
    expect(() => applyGameAction(s, me, { type: "MOVE", toCarriage: at("PARK") }, T0 + 5)).toThrow(/next to yours/);
    s.city!.zones[at("MALL")].status = "SUBMERGED";
    expect(() => applyGameAction(s, me, { type: "MOVE", toCarriage: at("MALL") }, T0 + 5)).toThrow(/under water/);
    expect(moveTargets(s.city!, at("CIVIC_SQUARE"))).not.toContain(at("MALL"));
  });

  const wade = (die: number, fateAnswer = "0", fate = 0) => {
    const { s, me } = standing("CIVIC_SQUARE", (x) => {
      x.city!.zones[at("METRO")].status = "FLOODED";
      rigNextDie(x, die);
    });
    s.players[me].fate = fate;
    expect(canMove(s.city!, at("CIVIC_SQUARE"), at("METRO"))).toEqual({ ok: true, wade: true });
    let x = applyGameAction(s, me, { type: "MOVE", toCarriage: at("METRO") }, T0 + 5).state;
    for (let t = T0 + 6; x.pending.length; t++) {
      const w = x.pending[0];
      x = applyGameAction(x, w.addressees[0], { type: "RESPOND", windowId: w.id, optionId: w.options.some((o) => o.id === fateAnswer) ? fateAnswer : w.defaultOptionId }, t).state;
    }
    return x.players[me];
  };

  it("wading a flooded zone is a roll: a success gets there, a failure gets there shaken, a disaster turns you back", () => {
    expect(wade(5)).toMatchObject({ carriageIndex: at("METRO"), sanity: 3 });
    expect(wade(2)).toMatchObject({ carriageIndex: at("METRO"), sanity: 2 });
    expect(wade(1)).toMatchObject({ carriageIndex: at("CIVIC_SQUARE"), sanity: 2 });
  });

  it("Fate counts on the final result: a 3 lifted to a 4 wades through unhurt", () => {
    expect(wade(3, "1", 1)).toMatchObject({ carriageIndex: at("METRO"), sanity: 3, fate: 0 });
  });

  it("2 action points a round, 1 when lost (2-player tables get the shared +1)", () => {
    const s = city(3);
    for (const id of s.turnOrder) expect(s.players[id].ap).toBe(2);
    const lost = city(3);
    lost.players[lost.turnOrder[1]].lost = true;
    let x = lost;
    for (let t = T0 + 2; x.round === 1; t++) x = applyGameAction(x, activePlayerId(x)!, { type: "END_TURN" }, t).state;
    if (x.sequence) x = ack(x, T0 + 900);
    expect(x.players[x.turnOrder[1]].ap).toBe(1);
    expect(x.players[x.turnOrder[2]].ap).toBe(2);
    expect(city(2).players.a.ap).toBe(3);
  });
});

describe("what players see of the city", () => {
  it("the flood schedule and hidden parts never leave the server; a zone warns one rise before it goes under", () => {
    const s = city();
    const view = project(s, s.turnOrder[0]);
    const json = JSON.stringify(view.city);
    for (const key of ["floodAt", "sinkAt", "caches", "breakAt", "ENGINE", "FUEL", "NAV"]) expect(json).not.toContain(key);
    view.city!.zones.forEach((z, i) => expect(z.warning, ZONES[i].id).toBe(s.city!.zones[i].sinkAt === s.collapse + 1));
  });

  it("the whole map is reachable from the start before the water comes", () => {
    const s = city();
    expect(reachableAt(s.city!, s.city!.startZone, 0).size).toBeGreaterThan(25);
  });
});
