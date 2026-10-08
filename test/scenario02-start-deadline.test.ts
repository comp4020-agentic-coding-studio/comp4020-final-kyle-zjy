import { describe, expect, it } from "vitest";
import { activePlayerId } from "../src/server/engine/context.ts";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame, tickGame } from "../src/server/engine/engine.ts";
import { reachableAt, scheduledStatus } from "../src/server/engine/scenario02/city.ts";
import { ACT2_BY_ROUND } from "../src/server/engine/scenario02/rules.ts";
import { zoneIndex } from "../src/shared/game/scenario02/map.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";

// Scenario 02: players start scattered over safe ground (seeded), and act 1
// can't last past round 6 however well the pumps hold.

let clock = T0 + 10;
const seedFor = (i: number) => ((i + 1) * 2654435761 >>> 0).toString(16).padStart(8, "0").repeat(4);
const ack = (s: GameState) => s.turnOrder.reduce((x, id) => applyGameAction(x, id, { type: "ACK_SEQUENCE" }, clock++).state, s);
const run = (n: number, seed = SEED) => createGame("g", seatsFor(n), seed, T0, "S02_SUNKEN_CITY");

function step(s: GameState): GameState {
  const w = s.pending.at(-1);
  if (w) {
    for (const id of w.addressees.filter((x) => w.answers[x] === undefined)) s = applyGameAction(s, id, { type: "RESPOND", windowId: w.id, optionId: w.defaultOptionId }, clock++).state;
    return s;
  }
  if (s.sequence) return ack(s);
  const id = activePlayerId(s);
  return id ? applyGameAction(s, id, { type: "END_TURN" }, clock++).state : tickGame(s, clock++).state;
}

describe("where everyone starts", () => {
  it.each([2, 4, 6, 8, 10])("%i players start scattered: a zone each, safe, never the pier, never cut off", (n) => {
    const pier = zoneIndex("HARBOUR");
    const power = zoneIndex("POWER_STATION");
    for (let i = 0; i < 40; i++) {
      const s = run(n, seedFor(i));
      const at = s.turnOrder.map((id) => s.players[id].carriageIndex);
      expect(new Set(at).size, seedFor(i)).toBe(n);
      for (const z of at) {
        const zone = s.city!.zones[z];
        expect(z).not.toBe(pier);
        expect(zone.status).toBe("NORMAL");
        expect(scheduledStatus(zone, 4)).not.toBe("SUBMERGED");
        const r = reachableAt(s.city!, z, 6);
        expect(r.has(pier) && r.has(power)).toBe(true);
      }
    }
  });

  it("the same seed puts everyone in the same place; another seed doesn't", () => {
    const where = (s: GameState) => s.turnOrder.map((id) => [id, s.players[id].carriageIndex]);
    expect(where(run(6))).toEqual(where(run(6)));
    expect(Array.from({ length: 10 }, (_, i) => JSON.stringify(where(run(6, seedFor(i))))).filter((x, _, a) => a.indexOf(x) === a.lastIndexOf(x)).length).toBeGreaterThan(5);
  });
});

/** A started run at round `round - 1`'s turns, act 1, Collapse `collapse`, the pumps holding everything back and a quiet event deck. */
function act1At(round: number, collapse: number): GameState {
  const s = ack(startGame(run(4), T0).state);
  Object.assign(s, { round: round - 1, collapse });
  s.city!.hold = 99;
  s.eventDeck = Array(20).fill("S2_SALVAGE");
  return s;
}

/** Plays until round `round` has started (its turns are open). */
function toRound(s: GameState, round: number): GameState {
  for (let i = 0; i < 400 && !(s.round === round && activePlayerId(s)); i++) s = step(s);
  expect(s.round).toBe(round);
  return s;
}

describe("act 1 can't last forever", () => {
  it(`round ${ACT2_BY_ROUND} starting in act 1 brings the water to exactly 5 and opens act 2, even with the pumps holding`, () => {
    let s = act1At(ACT2_BY_ROUND - 1, 2);
    s = toRound(s, ACT2_BY_ROUND - 1);
    expect(s).toMatchObject({ act: 1, collapse: 2 });
    s = toRound(s, ACT2_BY_ROUND);
    expect(s).toMatchObject({ act: 2, phase: "ACT_2", collapse: 5 });
    expect(s.flags.s2_act2Deadline).toBe(ACT2_BY_ROUND);
    expect(s.log.some((l) => l.text === "The sea wall at the harbour mouth gives way. No pump in the city can hold back what comes through.")).toBe(true);
    expect(s.log.some((l) => l.text === "Collapse rises to 5 / 12 (the sea wall giving way).")).toBe(true);
  });

  it("with the water already at 5 or more, nothing happens", () => {
    let s = act1At(ACT2_BY_ROUND, 6);
    s.act = 2;
    s.phase = "ACT_2";
    s = toRound(s, ACT2_BY_ROUND);
    expect(s.collapse).toBe(6);
    expect(s.flags.s2_act2Deadline).toBeUndefined();
  });
});
