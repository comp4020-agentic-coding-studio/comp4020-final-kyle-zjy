import { describe, expect, it } from "vitest";
import { activePlayerId, type Ctx } from "../src/server/engine/context.ts";
import { createGame } from "../src/server/engine/create.ts";
import { changeCollapse } from "../src/server/engine/effects.ts";
import { availableActions } from "../src/server/engine/actions.ts";
import { applyGameAction, startGame, tickGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { capacityRange, passSupply } from "../src/server/engine/scenario02/city.ts";
import { zoneIndex } from "../src/shared/game/scenario02/map.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { en } from "../src/shared/i18n/format.ts";
import { m } from "../src/shared/i18n/msg.ts";
import { rigNextDie, SEED, seatsFor, T0 } from "./helpers.ts";

// PHASE S2-4: the boat, passes and the departure. A pass is the right to
// compete for a seat; there are more passes than seats; the departure is its
// own phase (board, then the generator); each player's run ends on its own terms.

const PIER = zoneIndex("HARBOUR");
const POWER = zoneIndex("POWER_STATION");
let clock = T0 + 10;
const seedFor = (i: number) => ((i + 1) * 2654435761 >>> 0).toString(16).padStart(8, "0").repeat(4);
const ack = (s: GameState) => s.turnOrder.reduce((x, id) => applyGameAction(x, id, { type: "ACK_SEQUENCE" }, clock++).state, s);

function table(n = 4, seed = SEED, patch: (s: GameState) => void = () => {}): GameState {
  const s = ack(startGame(createGame("g", seatsFor(n), seed, T0, "S02_SUNKEN_CITY"), T0).state);
  patch(s);
  return s;
}

/** In act 2 (the evacuation window is open), a boat with everything fitted, ready since last round; `atPier` hold passes and stand at the pier. */
function readyBoat(n: number, atPier: string[], opts: { capacity?: number; chip?: boolean } = {}): GameState {
  return table(n, SEED, (s) => {
    Object.assign(s, { collapse: 5, act: 2, phase: "ACT_2" });
    const b = s.city!.boat;
    b.installed = ["ENGINE", "FUEL", "NAV", ...(opts.chip ? ["CHIP" as const] : [])];
    b.autoStart = !!opts.chip;
    b.capacity = opts.capacity ?? b.capacity;
    s.city!.facilities.POWER_STATION.done = true;
    s.city!.facilities.HARBOUR_GATE.done = true;
    b.readyRound = 0;
    for (const id of atPier) {
      s.players[id].carriageIndex = PIER;
      s.city!.holdings[id].passes = 1;
    }
  });
}

/** Ends turns (taking every default) until a departure decision is open or the run ends. */
function toDecision(s: GameState): GameState {
  for (let i = 0; i < 200 && !s.pending.length && s.phase !== "ENDING"; i++) {
    if (s.sequence) s = ack(s);
    const id = activePlayerId(s);
    if (id) s = applyGameAction(s, id, { type: "END_TURN" }, clock++).state;
  }
  return s;
}

/** Answers every open decision (Fate, a reaction) with its default. */
function settle(s: GameState): GameState {
  for (let i = 0; i < 20 && s.pending.length; i++) s = answer(s, {});
  return s;
}

/** One step of play: the open decision's defaults, a scene seen through, or the active turn ended. */
function step(s: GameState): GameState {
  if (s.pending.length) return answer(s, {});
  if (s.sequence) return ack(s);
  const id = activePlayerId(s);
  return id ? applyGameAction(s, id, { type: "END_TURN" }, clock++).state : tickGame(s, clock++).state;
}

/** Plays on until it is `id`'s turn with nothing open. */
function turnOf(s: GameState, id: string): GameState {
  for (let i = 0; i < 400 && !(activePlayerId(s) === id && !s.pending.length && !s.sequence) && !s.outcome; i++) s = step(s);
  expect(activePlayerId(s)).toBe(id);
  return s;
}

/** `id` restarts the generator with the die showing `raw`, taking no Fate. */
function restart(s: GameState, id: string, raw: number): GameState {
  s.players[id].nextRaw = raw;
  s = applyGameAction(s, id, { type: "RESTART_GENERATOR" }, clock++).state;
  return settle(s);
}

/** Answers the open decision: `answers[id]` or the default. */
function answer(s: GameState, answers: Record<string, string>): GameState {
  const w = s.pending[0];
  for (const id of w.addressees) s = applyGameAction(s, id, { type: "RESPOND", windowId: w.id, optionId: answers[id] ?? w.defaultOptionId }, clock++).state;
  return s;
}

describe("seats and passes", () => {
  it("capacity is 60–80% of the table and never everyone; passes always outnumber seats, never players", () => {
    for (let n = 2; n <= 10; n++) {
      const [lo, hi] = capacityRange(n);
      expect(lo).toBeGreaterThanOrEqual(1);
      expect(hi).toBeLessThan(n);
      for (let i = 0; i < 15; i++) {
        const s = table(n, seedFor(i));
        const cap = s.city!.boat.capacity;
        expect(cap, `${n} players`).toBeGreaterThanOrEqual(lo);
        expect(cap).toBeLessThanOrEqual(hi);
        expect(s.city!.passSources.length).toBe(passSupply(n, cap));
        expect(s.city!.passSources.length).toBeGreaterThan(cap);
        expect(s.city!.passSources.length).toBeLessThanOrEqual(n);
      }
    }
    expect(capacityRange(4)).toEqual([2, 3]);
    expect(capacityRange(10)).toEqual([6, 8]);
  });

  it("capacity stays hidden until someone reaches the boat in act 2, or Collapse reaches 7", () => {
    const s = table(4);
    const me = activePlayerId(s)!;
    expect(project(s, me).city!.boat.capacity).toBeNull();
    s.players[me].carriageIndex = PIER;
    changeCollapse({ s, now: T0, events: [] }, 1, m`test`);
    expect(s.city!.boat.revealed).toBe(false); // act 1: being there isn't enough
    s.city!.boat.installed = ["ENGINE", "FUEL", "NAV"];
    changeCollapse({ s, now: T0, events: [] }, 4, m`test`);
    expect(s.act).toBe(2);
    expect(s.city!.boat.revealed).toBe(true);
    expect(project(s, me).city!.boat.capacity).toBe(s.city!.boat.capacity);
    const late = table(4, SEED, (x) => (x.city!.boat.installed = ["ENGINE", "FUEL", "NAV"]));
    changeCollapse({ s: late, now: T0, events: [] }, 7, m`test`);
    expect(late.city!.boat.revealed).toBe(true);
  });

  it("a live VIP card found in a search is a pass only its finder can see", () => {
    const s = table(4);
    const me = activePlayerId(s)!;
    const other = s.turnOrder.find((x) => x !== me)!;
    const zone = zoneIndex("QUARRY");
    s.city!.passSources.push(`VIP:${zone}`);
    s.city!.zones[zone].caches = ["VIP_PASS"];
    s.players[me].carriageIndex = zone;
    rigNextDie(s, 5);
    const x = settle(applyGameAction(s, me, { type: "SEARCH" }, clock++).state);
    expect(x.city!.holdings[me].passes).toBe(1);
    expect(project(x, me).city!.holdings[me].passes).toBe(1);
    expect(project(x, other).city!.holdings[me].passes).toBeNull();
  });

  it("finishing a job pays its pass, if live, to whoever worked it most; a source that isn't live pays nothing", () => {
    const run = (live: boolean) =>
      table(4, SEED, (s) => {
        const me = activePlayerId(s)!;
        s.city!.passSources = live ? ["JOB:PUMP_STATION"] : [];
        const fac = s.city!.facilities.PUMP_STATION;
        fac.progress = fac.required - 1;
        fac.contributors = { [me]: 2 };
        s.players[me].carriageIndex = zoneIndex("PUMP_STATION");
        rigNextDie(s, 5);
      });
    for (const live of [true, false]) {
      const s = run(live);
      const me = activePlayerId(s)!;
      const x = settle(applyGameAction(s, me, { type: "REPAIR" }, clock++).state);
      expect(x.city!.facilities.PUMP_STATION.done).toBe(true);
      expect(x.city!.holdings[me].passes).toBe(live ? 1 : 0);
    }
  });

  it("a pass changes hands in a trade at once", () => {
    const s = table(4);
    const [a, b] = [activePlayerId(s)!, s.turnOrder.find((x) => x !== activePlayerId(s))!];
    s.players[b].carriageIndex = s.players[a].carriageIndex;
    s.city!.holdings[a].passes = 1;
    const offered = applyGameAction(s, a, { type: "TRADE", targetId: b, give: { items: [], fate: 0, passes: 1 }, want: { items: [], fate: 2 } }, clock++).state;
    const done = answer(offered, { [b]: "ACCEPT" });
    expect([done.city!.holdings[a].passes, done.city!.holdings[b].passes]).toEqual([0, 1]);
  });
});

describe("fitting out the boat", () => {
  it("parts are fitted at the pier; two batteries can stand in for the power station", () => {
    const s = table(4);
    const me = activePlayerId(s)!;
    s.city!.holdings[me].parts = ["ENGINE"];
    expect(() => applyGameAction(s, me, { type: "INSTALL", part: "ENGINE" }, clock++)).toThrow(/at the pier/);
    s.players[me].carriageIndex = PIER;
    s.players[me].items = ["EMERGENCY_BATTERY", "EMERGENCY_BATTERY"];
    let x = applyGameAction(s, me, { type: "INSTALL", part: "ENGINE" }, clock++).state;
    x = applyGameAction(x, me, { type: "INSTALL", part: "BATTERIES" }, clock++).state;
    expect(x.city!.boat).toMatchObject({ installed: ["ENGINE"], batteryPower: true });
    expect(x.log.at(-1)!.text).toBe("The boat still needs: the Fuel Drums, the Navigation Module, a working pier gate.");
  });

  it("a part that goes under before anyone finds it ends the run: no boat can leave", () => {
    const s = table(4);
    const engine = s.city!.zones.findIndex((z) => z.caches.includes("ENGINE"));
    s.city!.zones[engine].sinkAt = 1;
    changeCollapse({ s, now: T0, events: [] }, 1, m`test`);
    expect(s).toMatchObject({ phase: "ENDING", outcome: "FAILED", failReason: "BOAT_LOST" });
    expect(s.results!.every((r) => r.escape === "DROWNED")).toBe(true);
  });
});

describe("the departure", () => {
  it("boarding is a choice; with more takers than seats, seats go by public work", () => {
    let s = readyBoat(4, ["a", "b", "c"], { capacity: 2 });
    s.city!.contrib = { a: 5, b: 1, c: 3, d: 0 };
    s = toDecision(s);
    expect(en(s.pending[0].title)).toBe("Board the boat?");
    expect(s.pending[0].addressees.sort()).toEqual(["a", "b", "c"]);
    s = answer(s, { a: "BOARD", b: "BOARD", c: "BOARD" });
    expect(s.city!.boat.aboard.sort()).toEqual(["a", "c"]);
    expect(s.city!.holdings.b.passes).toBe(1);
    expect(s.city!.holdings.a.passes).toBe(0);
  });

  it("once someone is aboard, the boat waits for the generator; restarting it sends the boat off; each run ends differently", () => {
    let s = readyBoat(4, ["a", "b", "c"], { capacity: 2 });
    s.city!.contrib = { a: 5, b: 1, c: 3, d: 0 };
    s = answer(toDecision(s), { a: "BOARD", b: "BOARD", c: "BOARD" });
    expect(s.city!.boat.launched).toBe(false);
    expect(s.log.some((l) => l.text.startsWith("Those aboard can only wait."))).toBe(true);
    s = turnOf(s, "b");
    s.players.b.carriageIndex = POWER;
    s = restart(s, "b", 6);
    expect(s).toMatchObject({ phase: "ENDING", outcome: "S02_EVACUATED" });
    expect(s.city!.boat.engineer).toBe("b");
    const fate = Object.fromEntries(s.results!.map((r) => [r.playerId, r.escape]));
    expect(fate).toEqual({ a: "ESCAPED", c: "ESCAPED", b: "ENGINEER", d: "LEFT_BEHIND" });
    expect(en(s.results!.find((r) => r.playerId === "b")!.title)).toBe("The Last Engineer");
  });

  it("a failed restart costs Sanity, doesn't end the run, and can be tried again next round (not twice in one)", () => {
    let s = readyBoat(3, ["a"], { capacity: 1 });
    s = answer(toDecision(s), { a: "BOARD" });
    s = turnOf(s, "b");
    s.players.b.carriageIndex = POWER;
    const sanity = s.players.b.sanity;
    const collapse = s.collapse;
    s = restart(s, "b", 2);
    expect(s.city!.boat.launched).toBe(false);
    expect(s.outcome).toBeNull();
    expect(s.players.b.sanity).toBe(sanity - 1);
    expect(s.collapse).toBe(collapse);
    expect(() => applyGameAction(s, "b", { type: "RESTART_GENERATOR" }, clock++)).toThrow(/already tried/);
    const round = s.round;
    s = applyGameAction(s, "b", { type: "END_TURN" }, clock++).state;
    s = turnOf(s, "b");
    expect(s.round).toBe(round + 1);
    s = restart(s, "b", 6);
    expect(s.outcome).toBe("S02_EVACUATED");
  });

  it("a disastrous restart costs Sanity and one point of Collapse, nothing like the whole city", () => {
    let s = readyBoat(3, ["a"], { capacity: 1 });
    s = answer(toDecision(s), { a: "BOARD" });
    s = turnOf(s, "b");
    s.players.b.carriageIndex = POWER;
    const collapse = s.collapse;
    s = restart(s, "b", 1);
    expect(s.city!.boat.launched).toBe(false);
    expect(s.collapse).toBe(collapse + 1);
    expect(s.outcome).toBeNull();
  });

  it("the generator can't be restarted before anyone is aboard, or away from the power station", () => {
    let s = readyBoat(3, []);
    s = turnOf(s, "b");
    s.players.b.carriageIndex = POWER;
    expect(() => applyGameAction(s, "b", { type: "RESTART_GENERATOR" }, clock++)).toThrow(/Nobody is aboard/);
    s.city!.boat.aboard = ["a"];
    s.players.b.carriageIndex = PIER;
    expect(() => applyGameAction(s, "b", { type: "RESTART_GENERATOR" }, clock++)).toThrow(/generator is at/);
  });

  it("the rare chip starts the boat from the deck: nobody has to restart the generator", () => {
    let s = readyBoat(3, ["a", "b"], { capacity: 2, chip: true });
    s = answer(toDecision(s), { a: "BOARD", b: "BOARD" });
    expect(s).toMatchObject({ phase: "ENDING", outcome: "S02_EVACUATED" });
    expect(s.city!.boat.engineer).toBeNull();
    expect(s.results!.filter((r) => r.escape === "ESCAPED")).toHaveLength(2);
  });

  it("some runs hide a chip and some don't", () => {
    const has = Array.from({ length: 40 }, (_, i) => table(4, seedFor(i)).city!.zones.some((z) => z.caches.includes("CHIP")));
    expect(has.some(Boolean)).toBe(true);
    expect(has.every(Boolean)).toBe(false);
  });

  it("those aboard are locked in: no action points, no turns, no city actions; the others play on", () => {
    let s = readyBoat(4, ["a", "b"], { capacity: 2 });
    s = answer(toDecision(s), { a: "BOARD", b: "BOARD" });
    const round = s.round;
    const order: string[] = [];
    for (let i = 0; i < 400 && s.round <= round + 1 && !s.outcome; i++) {
      const id = activePlayerId(s);
      if (id && order.at(-1) !== id) order.push(id);
      s = step(s);
    }
    expect(order.length).toBeGreaterThan(0);
    expect(order.every((id) => id === "c" || id === "d")).toBe(true);
    expect(s.players.a.ap).toBe(0);
    s = turnOf(s, "c");
    for (const a of [{ type: "MOVE", toCarriage: zoneIndex("VIADUCT") }, { type: "SEARCH" }, { type: "END_TURN" }] as GameAction[]) {
      expect(() => applyGameAction(s, "a", a, clock++)).toThrow();
    }
    expect(availableActions(s, "a").every((x) => !x.enabled)).toBe(true);
  });

  it("the water reaching 12 before the boat leaves takes everyone", () => {
    const before = table(4, SEED, (x) => (x.city!.boat.installed = ["ENGINE", "FUEL", "NAV"]));
    changeCollapse({ s: before, now: T0, events: [] } as Ctx, 12, m`test`);
    const s = tickGame(before, clock++).state;
    expect(s).toMatchObject({ phase: "ENDING", outcome: "FAILED", failReason: "COLLAPSE" });
    expect(s.results!.every((r) => r.escape === "DROWNED")).toBe(true);
  });

  it.each([2, 10])("a %i-player departure: only as many leave as there are seats", (n) => {
    const ids = seatsFor(n).map((x) => x.playerId);
    let s = readyBoat(n, ids);
    const cap = s.city!.boat.capacity;
    s = toDecision(s);
    s = answer(s, Object.fromEntries(ids.map((id) => [id, "BOARD"])));
    expect(s.city!.boat.aboard).toHaveLength(cap);
    const ashore = ids.find((id) => !s.city!.boat.aboard.includes(id))!;
    s = turnOf(s, ashore);
    s.players[ashore].carriageIndex = POWER;
    s = restart(s, ashore, 6);
    expect(s.outcome).toBe("S02_EVACUATED");
    expect(s.results!.filter((r) => r.escape === "ESCAPED")).toHaveLength(cap);
    expect(s.results!.filter((r) => r.escape !== "ESCAPED").length).toBe(n - cap);
  });
});

describe("what everyone can see", () => {
  it("shared intel lands in every player's view, not only the log", () => {
    const s = table(3);
    const me = activePlayerId(s)!;
    s.secrets[me].peeks.push({ id: "i1", text: m`The pier holds.`, round: 1 });
    const x = applyGameAction(s, me, { type: "SHARE_INTEL", intelId: "i1" }, clock++).state;
    for (const id of x.turnOrder) expect(project(x, id).city!.shared.map((e) => [e.from, en(e.text)])).toEqual([[me, "The pier holds."]]);
  });

  it("the office's passes are hidden in act 1, then shown to everyone and counted down", () => {
    const s = table(4);
    const me = activePlayerId(s)!;
    s.city!.passSources = ["EXCHANGE", "EXCHANGE"];
    // two passes already out: with the office's two the contest is there, so entering act 2 adds none
    for (const id of s.turnOrder.filter((x) => x !== me).slice(0, 2)) s.city!.holdings[id].passes = 1;
    expect(project(s, me).city!.officePasses).toBeNull();
    s.city!.boat.installed = ["ENGINE", "FUEL", "NAV"];
    changeCollapse({ s, now: T0, events: [] }, 5, m`test`);
    s.sequence = null;
    expect(project(s, s.turnOrder[1]).city!.officePasses).toBe(2);
    s.players[me].carriageIndex = PIER;
    s.players[me].fate = 3;
    s.players[me].items = ["ROPE"];
    const x = applyGameAction(s, me, { type: "REGISTER" }, clock++).state;
    expect(x.city!.holdings[me].passes).toBe(1);
    expect(project(x, x.turnOrder[1]).city!.officePasses).toBe(1);
  });

  it("every run has the harbour engineer or Ms Varga waiting, and her pass is really there", () => {
    for (let i = 0; i < 40; i++) {
      const s = table(2 + (i % 9), seedFor(i));
      const carriers = s.city!.npcs.filter((n) => n.id === "ENGINEER" || n.id === "TEACHER");
      expect(carriers.length, seedFor(i)).toBeGreaterThan(0);
      for (const n of carriers) expect(s.city!.passSources).toContain(`NPC:${n.id}`);
      expect(s.city!.passSources.length).toBe(passSupply(s.turnOrder.length, s.city!.boat.capacity));
    }
  });
});
