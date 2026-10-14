import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame, tickGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { getCharacterById } from "../src/shared/characters/roster/index.ts";
import type { CharacterId } from "../src/shared/characters/types.ts";
import type { GameState, ScenarioId } from "../src/shared/game/state.ts";
import type { RunInput } from "./bot.ts";

type Log = { scenario?: ScenarioId; seed: string; characters: CharacterId[]; inputs: RunInput[] };

function replay(file: string): GameState[] {
  const log = JSON.parse(readFileSync(new URL(`../docs/simulations/${file}`, import.meta.url), "utf8")) as Log;
  const seats = log.characters.map((id, i) => ({ playerId: `p${i}`, nickname: `P${i}`, seat: i, zodiac: getCharacterById(id).zodiac, mbti: getCharacterById(id).mbti }));
  const t0 = 1_800_000_000_000;
  const states = [startGame(createGame("run", seats, log.seed, t0, log.scenario), t0).state];
  for (const i of log.inputs) {
    const s = states.at(-1)!;
    states.push(i.kind === "TICK" ? tickGame(s, i.at).state : applyGameAction(s, i.actor!, i.action!, i.at).state);
  }
  return states;
}

describe("run chronicle", () => {
  it("records a won scenario 01 run's story beats in order", () => {
    const end = replay("6p-escaped.json").at(-1)!;
    const kinds = end.chronicle!.map((e) => e.kind);
    expect(kinds).toContain("BLACKOUT");
    expect(kinds).toContain("FOLD");
    expect(kinds.at(-1)).toBe("ENDING");
    // other table votes also cue VOTE_RESULT; only the round-6 brake is told
    expect(end.chronicle!.filter((e) => e.kind === "BRAKE_VOTE")).toHaveLength(1);
    expect(kinds).not.toContain("VOTE_RESULT");
    const rounds = end.chronicle!.map((e) => e.round);
    expect(rounds).toEqual([...rounds].sort((a, b) => a - b));
    // locks reset at a round's end unless all three turned in it: the last three share a round
    const locks = end.chronicle!.filter((e) => e.kind === "LOCK");
    const last = locks.slice(-3);
    expect(new Set(last.map((e) => e.data.lock)).size).toBe(3);
    expect(new Set(last.map((e) => e.round)).size).toBe(1);
    for (const lock of locks) expect(lock.actors).toHaveLength(1);
  });

  it("records scenario 02's evacuation", () => {
    const kinds = replay("s02-4p-escaped.json").at(-1)!.chronicle!.map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(["CAPACITY", "BOARD", "LAUNCH", "ENDING"]));
  });

  it("is withheld from every client until the run has ended", () => {
    const states = replay("6p-escaped.json");
    const midRun = states.find((s) => s.phase === "ACT_3" && (s.chronicle?.length ?? 0) > 0)!;
    expect(project(midRun, "p0").chronicle).toEqual([]);
    const end = states.at(-1)!;
    expect(project(end, "p0").chronicle).toEqual(end.chronicle);
  });
});
