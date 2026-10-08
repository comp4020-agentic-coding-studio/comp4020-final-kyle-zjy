import { describe, expect, it } from "vitest";
import { activePlayerId, type Ctx } from "../src/server/engine/context.ts";
import { createGame } from "../src/server/engine/create.ts";
import { changeCollapse } from "../src/server/engine/effects.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { passSupply } from "../src/server/engine/scenario02/city.ts";
import { ensurePassContest, passAvailability } from "../src/server/engine/scenario02/passes.ts";
import { zoneIndex } from "../src/shared/game/scenario02/map.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { en } from "../src/shared/i18n/format.ts";
import { m } from "../src/shared/i18n/msg.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";

// Scenario 02 hotfix. (1) The departure never starts before act 2 (Collapse 5):
// a boat ready in act 1 waits, with no vote open and no scene stacked on a
// vote. (2) When the act changes or the countdown starts, the evacuation
// office is topped up so that passes held plus passes someone can really get
// in time outnumber the seats, never past the table, and never with passes
// nobody can reach.

const PIER = zoneIndex("HARBOUR");
const FAR = zoneIndex("BROADCAST_TOWER"); // five steps from the pier on an undamaged map
let clock = T0 + 10;
const ack = (s: GameState) => s.turnOrder.reduce((x, id) => applyGameAction(x, id, { type: "ACK_SEQUENCE" }, clock++).state, s);
const ctxOf = (s: GameState): Ctx => ({ s, now: clock, events: [] });

function table(n: number, patch: (s: GameState) => void = () => {}): GameState {
  const s = ack(startGame(createGame("g", seatsFor(n), SEED, T0, "S02_SUNKEN_CITY"), T0).state);
  patch(s);
  return s;
}

/** Everything the boat needs, fitted and working. */
function fitOut(s: GameState): void {
  s.city!.boat.installed = ["ENGINE", "FUEL", "NAV"];
  s.city!.facilities.POWER_STATION.done = true;
  s.city!.facilities.HARBOUR_GATE.done = true;
}

/** One step of play: answer the open decision with defaults, see a scene through, or end the active turn. */
function step(s: GameState): GameState {
  const w = s.pending.at(-1);
  if (w) {
    for (const id of w.addressees.filter((x) => w.answers[x] === undefined)) s = applyGameAction(s, id, { type: "RESPOND", windowId: w.id, optionId: w.defaultOptionId }, clock++).state;
    return s;
  }
  if (s.sequence) return ack(s);
  const id = activePlayerId(s);
  return id ? applyGameAction(s, id, { type: "END_TURN" }, clock++).state : s;
}

const boardingOpen = (s: GameState) => s.pending.some((w) => w.resume.kind === "S2_BOARD");

describe("the departure waits for act 2", () => {
  it("a boat ready at Collapse 3 opens no vote and starts no countdown, however many rounds pass in act 1", () => {
    let s = table(4, (x) => {
      fitOut(x);
      x.collapse = 3;
      for (const id of ["a", "b"]) {
        x.players[id].carriageIndex = PIER;
        x.city!.holdings[id].passes = 1;
      }
    });
    const start = s.round;
    for (let i = 0; i < 400 && s.act < 2 && s.round < start + 4; i++) {
      s = step(s);
      if (s.act >= 2) break;
      expect(boardingOpen(s), `round ${s.round}`).toBe(false);
      expect(s.city!.boat.readyRound).toBeNull();
      for (const id of s.turnOrder) expect(project(s, id).pending.some((w) => en(w.title) === "Board the boat?")).toBe(false);
    }
    expect(s.round).toBeGreaterThan(start);
    expect(s.flags.s2_readyEarly).toBe(1);
    expect(s.log.filter((l) => l.text === "The boat is ready, but the evacuation window isn't open yet. Boarding starts in Act II.")).toHaveLength(1);
  });

  it("Collapse 4 → 5 opens act 2 and the countdown; boarding opens the next round with no scene on top of it", () => {
    let s = table(4, (x) => {
      fitOut(x);
      x.collapse = 4;
      x.flags.s2_readyEarly = 1;
      for (const id of ["a", "b", "c"]) {
        x.players[id].carriageIndex = PIER;
        x.city!.holdings[id].passes = 1;
      }
    });
    changeCollapse(ctxOf(s), 1, m`test`);
    expect(s).toMatchObject({ act: 2, phase: "ACT_2" });
    const b = s.city!.boat;
    expect(b.readyRound).toBe(s.round);
    expect(b.revealed).toBe(true);
    expect(s.log.some((l) => l.text === "The boat is ready. Boarding opens next round. Anyone with a pass: get to the pier.")).toBe(true);
    for (let i = 0; i < 400 && !boardingOpen(s) && s.phase !== "ENDING"; i++) s = step(s);
    expect(boardingOpen(s)).toBe(true);
    expect(s.round).toBe(b.readyRound! + 1);
    // the bug: a capacity scene stacked on the vote hid it, and its "waiting for the others" never ended
    expect(s.sequence).toBeNull();
    expect(s.pending.at(-1)!.addressees.sort()).toEqual(["a", "b", "c"]);
  });

  it("only pass-holders at the pier are asked; nobody else holds it up, and nobody answers twice", () => {
    let s = table(4, (x) => {
      fitOut(x);
      Object.assign(x, { collapse: 5, act: 2, phase: "ACT_2" });
      x.city!.boat.readyRound = 0;
      x.city!.boat.capacity = 2;
      x.players.a.carriageIndex = PIER;
      x.city!.holdings.a.passes = 1;
      x.players.b.carriageIndex = PIER; // at the pier, no pass
      x.city!.holdings.c.passes = 1; // a pass, out in the city
    });
    for (let i = 0; i < 400 && !boardingOpen(s); i++) s = step(s);
    const w = s.pending.at(-1)!;
    expect(w.addressees).toEqual(["a"]);
    expect(() => applyGameAction(s, "b", { type: "RESPOND", windowId: w.id, optionId: "BOARD" }, clock++)).toThrow(/isn't yours/);
    expect(project(s, "b").pending.at(-1)).toMatchObject({ addressees: ["a"], answeredBy: [] });
    const after = applyGameAction(s, "a", { type: "RESPOND", windowId: w.id, optionId: "BOARD" }, clock++).state;
    expect(after.pending.some((x) => x.id === w.id)).toBe(false);
    expect(after.city!.boat.aboard).toEqual(["a"]);
    expect(() => applyGameAction(after, "a", { type: "RESPOND", windowId: w.id, optionId: "BOARD" }, clock++)).toThrow(/already closed/);
  });
});

/** A table entering act 2 with every pass source drawn at creation gone, and `held` passes already out. */
function enterAct2(n: number, held: Record<string, number> = {}): GameState {
  const s = table(n, (x) => {
    x.collapse = 4;
    x.city!.passSources = [];
    for (const [id, k] of Object.entries(held)) x.city!.holdings[id].passes = k;
  });
  changeCollapse(ctxOf(s), 1, m`test`);
  expect(s.act).toBe(2);
  return s;
}

const office = (s: GameState) => s.city!.passSources.filter((x) => x === "EXCHANGE").length;

describe("the contest for seats survives", () => {
  it("2 players, 1 seat: the office makes it a contest of two, and no more than two", () => {
    const s = enterAct2(2);
    expect(s.city!.boat.capacity).toBe(1);
    expect(office(s)).toBe(2);
    expect(ensurePassContest(ctxOf(s))).toBe(0);
    expect(passAvailability(s)).toMatchObject({ effective: 2, target: 2 });
  });

  it("4 players, 2 seats, one pass out and nothing else to find: the office tops up to three in the running", () => {
    const s = table(4, (x) => {
      x.collapse = 4;
      x.city!.boat.capacity = 2;
      x.city!.passSources = [];
      x.city!.holdings.a.passes = 1;
    });
    changeCollapse(ctxOf(s), 1, m`test`);
    expect(office(s)).toBe(2);
    const a = passAvailability(s);
    expect(a).toMatchObject({ held: 1, obtainable: 2, effective: 3, target: 3 });
    expect(s.log.some((l) => l.text === "A late list comes through at the pier: the evacuation office has 2 more passes to give.")).toBe(true);
    expect(project(s, "b").city).toMatchObject({ officePasses: 2, passesOut: 1, knownPassSources: 2 });
  });

  it("4 players with three already in the running: the office stays empty", () => {
    const s = enterAct2(4, { a: 1, b: 1, c: 1 });
    expect(office(s)).toBe(0);
    expect(s.flags.s2_officeAdded ?? 0).toBe(0);
  });

  it("6 players: more people in the running than seats", () => {
    const s = enterAct2(6);
    const a = passAvailability(s);
    expect(a.effective).toBeGreaterThan(s.city!.boat.capacity);
    expect(a.effective).toBe(passSupply(6, s.city!.boat.capacity));
  });

  it("10 players: enough passes for a contest, and asking again and again adds nothing", () => {
    const s = enterAct2(10);
    const first = office(s);
    expect(passAvailability(s).effective).toBeGreaterThan(s.city!.boat.capacity);
    for (let i = 0; i < 5; i++) expect(ensurePassContest(ctxOf(s))).toBe(0);
    expect(office(s)).toBe(first);
    expect(first).toBeLessThanOrEqual(10);
    expect(s.flags.s2_officeAdded).toBe(first);
  });

  it("the office isn't stocked with passes nobody could reach in time", () => {
    const s = table(4, (x) => {
      fitOut(x);
      Object.assign(x, { collapse: 5, act: 2, phase: "ACT_2", step: "WORLD" });
      x.city!.passSources = [];
      for (const id of x.turnOrder) x.players[id].carriageIndex = FAR;
      x.city!.boat.readyRound = x.round; // one round of turns left, and the pier is five steps away
    });
    expect(ensurePassContest(ctxOf(s))).toBe(0);
    expect(office(s)).toBe(0);
  });
});

describe("what counts as a pass someone can really get", () => {
  /** Act 2, players at the pier, one live source; returns how many passes count as obtainable. */
  function obtainable(source: string, patch: (s: GameState) => void = () => {}): number {
    const s = table(4, (x) => {
      Object.assign(x, { collapse: 5, act: 2, phase: "ACT_2" });
      for (const id of x.turnOrder) x.players[id].carriageIndex = PIER;
      x.city!.passSources = [source];
      x.city!.zones[FAR].sinkAt = 99;
      const npc = x.city!.npcs[0];
      npc.zone = FAR;
      patch(x);
    });
    return passAvailability(s).obtainable;
  }
  const npc = (s: GameState) => s.city!.npcs[0];

  it("a VIP card counts only while its zone is above water", () => {
    expect(obtainable(`VIP:${FAR}`)).toBe(1);
    expect(obtainable(`VIP:${FAR}`, (s) => (s.city!.zones[FAR].status = "SUBMERGED"))).toBe(0);
  });

  it("a person's pass counts only while they are still waiting", () => {
    expect(obtainable("NPC:@", (s) => (s.city!.passSources = [`NPC:${npc(s).id}`]))).toBe(1);
    expect(obtainable("NPC:@", (s) => {
      s.city!.passSources = [`NPC:${npc(s).id}`];
      npc(s).state = "LOST";
    })).toBe(0);
  });

  it("a source cut off by broken roads doesn't count", () => {
    expect(obtainable(`VIP:${FAR}`, (s) => {
      for (const e of s.city!.edges) if (e.a === FAR || e.b === FAR) e.broken = true;
    })).toBe(0);
  });

  it("with the countdown running, a source too far to reach and still make the pier doesn't count", () => {
    const withNpc = (countdown: boolean) => (s: GameState) => {
      s.city!.passSources = [`NPC:${npc(s).id}`];
      if (countdown) {
        s.city!.boat.readyRound = s.round;
        s.step = "WORLD";
      }
    };
    expect(obtainable("NPC:@", withNpc(false))).toBe(1);
    expect(obtainable("NPC:@", withNpc(true))).toBe(0);
  });
});
