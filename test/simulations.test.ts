import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame, tickGame } from "../src/server/engine/engine.ts";
import { getCharacterById } from "../src/shared/characters/roster/index.ts";
import type { CharacterId } from "../src/shared/characters/types.ts";
import type { RunInput } from "./bot.ts";
import type { ScenarioId } from "../src/shared/game/state.ts";

// The simulated runs kept in docs/simulations (PHASE 11) replay through the
// engine to exactly the recorded ending: the action logs are complete, and
// the engine is still deterministic. If a rule change alters a replay on
// purpose, regenerate the logs (node scripts/sim.ts --logs …).

const DIR = new URL("../docs/simulations/", import.meta.url);
type Log = { scenario?: ScenarioId; seed: string; characters: CharacterId[]; outcome: string; failReason: string | null; round: number; inputs: RunInput[] };

describe("kept simulation logs replay exactly", () => {
  it.each(readdirSync(DIR).filter((f) => f.endsWith(".json")))("%s", (file) => {
    const log = JSON.parse(readFileSync(new URL(file, DIR), "utf8")) as Log;
    const seats = log.characters.map((id, i) => ({ playerId: `p${i}`, nickname: `P${i}`, seat: i, zodiac: getCharacterById(id).zodiac, mbti: getCharacterById(id).mbti }));
    const t0 = 1_800_000_000_000;
    let s = startGame(createGame("run", seats, log.seed, t0, log.scenario), t0).state;
    for (const i of log.inputs) s = i.kind === "TICK" ? tickGame(s, i.at).state : applyGameAction(s, i.actor!, i.action!, i.at).state;
    expect({ outcome: s.outcome, failReason: s.failReason, round: s.round, phase: s.phase }).toEqual({ outcome: log.outcome, failReason: log.failReason, round: log.round, phase: "RESULTS" });
  });
});
