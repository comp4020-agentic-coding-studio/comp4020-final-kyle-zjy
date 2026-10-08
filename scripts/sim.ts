// Plays whole runs through the real engine with a simple, sensible team
// strategy, to check the scenario is winnable and see how often, per table
// size. No browser, no server: the same pure functions the server calls.
//
//   node scripts/sim.ts [--runs 40] [--players 2,4,6,10] [--abilities] [--logs dir]
//   node scripts/sim.ts --coverage 6        every character as seat 0, 6 runs each:
//                                           which abilities never get used, and why to look
//   node scripts/sim.ts --scenario 02 [--runs 40] [--players 2,4,6,10] [--logs dir]
//                                           the sinking city: how often the boat leaves,
//                                           how many get out, and what ended the rest
//
// --abilities: players use their active ability once it can act, and accept
// every reaction. --logs: one JSON file per run (seed, characters, every input,
// outcome) that replays exactly through the engine.
//
// The team's strategy lives in test/bot.ts (shared with the whole-run tests).
import { randomBytes } from "node:crypto";
import { tuningFor } from "../src/shared/game/scenario01/content.ts";
import { ROSTER } from "../src/shared/characters/roster/index.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import type { CharacterId } from "../src/shared/characters/types.ts";
import { playRun } from "../test/bot.ts";
import { playRun02 } from "../test/bot02.ts";
import { characterSkill } from "../src/shared/game/scenario01/skills.ts";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const RUNS = Number(arg("runs", "40"));
const SIZES = arg("players", "2,4,6,10").split(",").map(Number);
const ABILITIES = process.argv.includes("--abilities");
const LOGS = arg("logs", "");
const COVERAGE = Number(arg("coverage", "0"));
if (LOGS) mkdirSync(LOGS, { recursive: true });

type Result = { turns: number; emptyTurns: number; used: CharacterId[]; seat0Used: boolean; outcome: string; reason: string | null; round: number; anchors: number; fragments: number; collapse: Map<string, number> };

let logNo = 0;
function play(n: number, first?: CharacterId): Result {
  const picks = [...ROSTER].filter((c) => c.id !== first).sort(() => Math.random() - 0.5).slice(0, n);
  if (first) picks[0] = ROSTER.find((c) => c.id === first)!;
  const seed = randomBytes(16).toString("hex");
  // where Collapse came from, read off the log as it grows
  const collapse = new Map<string, number>();
  let seen = 0;
  const run = playRun({
    seed,
    abilities: ABILITIES || COVERAGE > 0,
    chars: picks.map((c) => [c.zodiac, c.mbti]),
    onStep: (st) => {
      for (const l of st.log.filter((x) => x.seq >= seen && x.kind === "COLLAPSE_UP")) {
        const why = l.text.match(/\((.+)\)\.$/)?.[1] ?? "?";
        collapse.set(why, (collapse.get(why) ?? 0) + 1);
      }
      seen = st.logSeq;
    },
  });
  const s = run.state;
  if (LOGS) writeFileSync(`${LOGS}/run-${n}p-${String(++logNo).padStart(3, "0")}.json`, JSON.stringify({ seed, characters: picks.map((c) => c.id), abilities: ABILITIES, outcome: s.outcome, failReason: s.failReason, round: s.round, inputs: run.inputs }));
  return { turns: run.turns, emptyTurns: run.emptyTurns, used: run.usedAbility, seat0Used: run.usedAbility.includes(picks[0].id), outcome: s.outcome ?? "STUCK", reason: s.failReason, round: s.round, anchors: Object.values(s.anchors).filter((a) => a.repaired).length, fragments: s.fragments.length, collapse };
}

if (arg("scenario", "01") === "02") {
  // scenario 02: the team in test/bot02.ts
  for (const n of SIZES) {
    const rows = Array.from({ length: RUNS }, () => {
      const picks = [...ROSTER].sort(() => Math.random() - 0.5).slice(0, n);
      const seed = randomBytes(16).toString("hex");
      const collapse = new Map<string, number>();
      let seen = 0;
      const run = playRun02({
        seed,
        chars: picks.map((c) => [c.zodiac, c.mbti]),
        onStep: (st) => {
          for (const l of st.log.filter((x) => x.seq >= seen && x.kind === "COLLAPSE_UP")) {
            const why = l.text.match(/\((.+)\)\.$/)?.[1] ?? "?";
            collapse.set(why, (collapse.get(why) ?? 0) + 1);
          }
          seen = st.logSeq;
        },
      });
      const st = run.state;
      if (LOGS) writeFileSync(`${LOGS}/s02-${n}p-${String(++logNo).padStart(3, "0")}.json`, JSON.stringify({ scenario: "S02_SUNKEN_CITY", seed, characters: picks.map((c) => c.id), outcome: st.outcome, failReason: st.failReason, round: st.round, inputs: run.inputs }));
      const b = st.city!.boat;
      return { left: st.outcome === "S02_EVACUATED", stuck: st.phase !== "RESULTS", reason: st.failReason, aboard: b.aboard.length, seats: b.capacity, chip: b.autoGate, round: st.round, collapse };
    });
    const left = rows.filter((r) => r.left);
    const reasons = ["COLLAPSE", "BOAT_LOST"].map((x) => `${x.toLowerCase()} ${rows.filter((r) => r.reason === x).length}`).join(", ");
    const aboard = left.reduce((a, r) => a + r.aboard, 0);
    const seats = left.reduce((a, r) => a + r.seats, 0);
    console.log(
      `${String(n).padStart(2)} players: boat left ${left.length}/${RUNS} · escaped ${aboard}/${left.length * n} players when it did (${seats} seats)` +
        ` · no sacrifice (chip) ${left.filter((r) => r.chip).length} · lost: ${reasons} · stuck ${rows.filter((r) => r.stuck).length} · avg rounds ${(rows.reduce((a, r) => a + r.round, 0) / RUNS).toFixed(1)}`,
    );
    const sources = new Map<string, number>();
    for (const r of rows) for (const [k, v] of r.collapse) sources.set(k, (sources.get(k) ?? 0) + v);
    console.log(`   Collapse per run: ${[...sources].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / RUNS).toFixed(1)}`).join(" · ")}`);
  }
  process.exit(0);
}

if (COVERAGE) {
  // every character in seat 0 of a 4-player table, COVERAGE times
  const never: string[] = [];
  const rare: string[] = [];
  for (const c of ROSTER) {
    const used = Array.from({ length: COVERAGE }, () => play(4, c.id)).filter((r) => r.seat0Used).length;
    if (used === 0) never.push(`${c.id} (${characterSkill(c.id).name}, ${characterSkill(c.id).type} ${characterSkill(c.id).trigger.on}${characterSkill(c.id).trigger.condition ? ":" + characterSkill(c.id).trigger.condition : ""})`);
    else if (used * 3 < COVERAGE) rare.push(`${c.id} ${used}/${COVERAGE}`);
  }
  console.log(`never used (${never.length}):\n  ${never.join("\n  ")}`);
  console.log(`rarely used (${rare.length}): ${rare.join(", ")}`);
  process.exit(0);
}

for (const n of SIZES) {
  const results = Array.from({ length: RUNS }, () => play(n));
  const count = (f: (r: Result) => boolean) => results.filter(f).length;
  const wins = count((r) => r.outcome !== "FAILED" && r.outcome !== "STUCK");
  const reasons = ["COLLAPSE", "TIME", "ALL_LOST"].map((x) => `${x.toLowerCase()} ${count((r) => r.reason === x)}`).join(", ");
  const winRounds = results.filter((r) => r.outcome !== "FAILED" && r.outcome !== "STUCK").map((r) => r.round);
  console.log(
    `${String(n).padStart(2)} players (${tuningFor(n).tier}): won ${wins}/${RUNS}` +
      (winRounds.length ? ` (rounds ${Math.min(...winRounds)}–${Math.max(...winRounds)})` : "") +
      ` · lost: ${reasons} · stuck ${count((r) => r.outcome === "STUCK")}` +
      ` · avg anchors ${(results.reduce((a, r) => a + r.anchors, 0) / RUNS).toFixed(1)}, fragments ${(results.reduce((a, r) => a + r.fragments, 0) / RUNS).toFixed(1)}`,
  );
  const sources = new Map<string, number>();
  for (const r of results) for (const [k, v] of r.collapse) sources.set(k, (sources.get(k) ?? 0) + v);
  const turns = results.reduce((a, r) => a + r.turns, 0);
  const empty = results.reduce((a, r) => a + r.emptyTurns, 0);
  console.log(`   turns with action points but nothing worth doing: ${empty}/${turns} (${((100 * empty) / Math.max(1, turns)).toFixed(1)}%)`);
  console.log(`   Collapse per run: ${[...sources].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / RUNS).toFixed(1)}`).join(" · ")}`);
}
