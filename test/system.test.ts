import { describe, expect, it } from "vitest";
import { applyGameAction, setAway, tickGame } from "../src/server/engine/engine.ts";
import { ROSTER } from "../src/shared/characters/roster/index.ts";
import type { MBTI, Zodiac } from "../src/shared/characters/types.ts";
import { MAX_SANITY } from "../src/shared/game/scenario01/content.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { playRun, type RunInput } from "./bot.ts";
import { SEED } from "./helpers.ts";

// Whole runs at every table size: an idle table and a disconnected table must
// still reach the results (no dead ends), every step must be a legal state,
// the stored inputs must replay to the same end, and a sensible team must be
// able to win.

const SIZES = [2, 3, 4, 6, 8, 10];
const charsFor = (n: number, salt = 0): [Zodiac, MBTI][] => Array.from({ length: n }, (_, i) => ROSTER[(i * 37 + n * 11 + salt * 53) % ROSTER.length]).map((c) => [c.zodiac, c.mbti]);

function problems(s: GameState): string[] {
  const out: string[] = [];
  for (const p of Object.values(s.players)) {
    if (!Number.isInteger(p.fate) || p.fate < 0) out.push(`${p.playerId} fate ${p.fate}`);
    if (!Number.isInteger(p.sanity) || p.sanity < 0 || p.sanity > MAX_SANITY) out.push(`${p.playerId} sanity ${p.sanity}`);
    if (!Number.isInteger(p.ap) || p.ap < 0) out.push(`${p.playerId} ap ${p.ap}`);
    if (p.skill.usesLeft < 0) out.push(`${p.playerId} uses ${p.skill.usesLeft}`);
  }
  if (s.collapse < 0 || s.collapse > s.collapseMax) out.push(`collapse ${s.collapse}`);
  if (s.round > 12) out.push(`round ${s.round}`);
  if (s.pending.some((w) => !w.addressees.length)) out.push("a window nobody can answer");
  return out;
}

function replay(initial: GameState, inputs: RunInput[]): GameState {
  let s = initial;
  for (const i of inputs) s = i.kind === "TICK" ? tickGame(s, i.at).state : applyGameAction(s, i.actor!, i.action!, i.at).state;
  return s;
}

describe.each(SIZES)("%i players", (n) => {
  it("an idle table plays to its results, legal at every step, and its inputs replay to the same end", () => {
    let bad: string[] = [];
    const run = playRun({ seed: SEED, chars: charsFor(n), strategy: "idle", onStep: (s) => (bad = bad.length ? bad : problems(s)) });
    expect(bad).toEqual([]);
    expect(run.state.phase).toBe("RESULTS");
    expect(run.state.outcome).toBe("FAILED");
    expect(run.state.results).toHaveLength(n);
    expect(replay(run.initial, run.inputs)).toEqual(run.state);
  });

  it("with everyone disconnected, the timers alone carry the run to its results", () => {
    let s = playRun({ seed: SEED, chars: charsFor(n), strategy: "idle", onStep: () => {} }).initial;
    let now = 1_800_000_000_000;
    for (const id of s.turnOrder) s = setAway(s, id, true, now).state;
    for (let i = 0; i < 2000 && s.phase !== "RESULTS"; i++) s = tickGame(s, (now += 15_000)).state;
    expect(s.phase).toBe("RESULTS");
    expect(problems(s)).toEqual([]);
  });

  it("a sensible team can win", () => {
    let won: GameState | null = null;
    for (let k = 0; k < 40 && !won; k++) {
      const { state } = playRun({ seed: `${SEED.slice(0, 30)}${String(k).padStart(2, "0")}`, chars: charsFor(n, k) });
      expect(state.phase).toBe("RESULTS");
      if (state.outcome !== "FAILED") won = state;
    }
    expect(won?.outcome).toMatch(/NORMAL|TRUE_/);
  });
});
