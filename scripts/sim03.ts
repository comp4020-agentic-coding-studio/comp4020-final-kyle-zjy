// Real-action Scenario 03 balance probe. No teleports, state edits or fixed die.
// The driver spends Fate when it can turn a required action roll into success.
// Run with: node scripts/sim03.ts [--runs 8]
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { canEnter03 } from "../src/server/engine/scenario03/actions.ts";
import { ADJACENT03, type RoomId03, type Year03, placeKey03 } from "../src/shared/game/scenario03/map.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { seatsFor } from "../test/helpers.ts";
import { settle03 } from "../test/scenario03-helpers.ts";

type Route = "OFFICIAL_HISTORY" | "NO_TOMORROW" | "DECEIVE_HISTORY";
type Task = { room: RoomId03; year: Year03; action?: GameAction };
const sizes = [2, 3, 4, 6, 10];
const routes: Route[] = ["OFFICIAL_HISTORY", "NO_TOMORROW", "DECEIVE_HISTORY"];
const runs = Number(process.argv.includes("--runs") ? process.argv[process.argv.indexOf("--runs") + 1] : 8);
if (!Number.isInteger(runs) || runs < 1) throw new Error("--runs must be a positive integer");

function taskFor(s: GameState, id: string, route: Route): Task | null {
  const temporal = s.temporal!;
  const index = s.turnOrder.indexOf(id);
  const requiresRelics = route !== "NO_TOMORROW";
  if (requiresRelics) {
    const obligation = temporal.bootstrap.find((entry) => entry.assignedTo === id && !entry.placedBy);
    if (obligation) {
      const item = temporal.storedItems[obligation.instanceId];
      if (item.ownerId === id && item.status === "HELD_1996") return { room: obligation.storageRoom, year: "Y1996", action: { type: "STORE_ITEM", instanceId: item.instanceId } };
      if (item.ownerId === id && item.status === "HELD_2026") return { room: obligation.storageRoom, year: "Y1996", action: { type: "STORE_ITEM", instanceId: item.instanceId } };
      if (item.status === "AVAILABLE_2026") return { room: item.roomId, year: "Y2026", action: { type: "PICK_UP", instanceId: item.instanceId } };
    }
  }
  const done = (nodeId: string) => temporal.interventions.some((entry) => entry.nodeId === nodeId);
  if (route !== "OFFICIAL_HISTORY" && index === 0) {
    if (s.act < 3) return { room: "RESEARCH_WING", year: "Y1996" };
    if (!done("PROTOTYPE_CORE")) return s.act < 3 ? { room: "RESEARCH_WING", year: "Y1996" } : { room: "PROTOTYPE_ROOM", year: "Y1996", action: { type: "INTERVENE", nodeId: "PROTOTYPE_CORE", choiceId: "SHUT_DOWN" } };
    if (route === "DECEIVE_HISTORY") {
      if (s.act < 4) return { room: "PROTOTYPE_ROOM", year: "Y1996" };
      if (!done("PROTOTYPE_FATE")) return { room: "PROTOTYPE_ROOM", year: "Y1996", action: { type: "INTERVENE", nodeId: "PROTOTYPE_FATE", choiceId: "HIDE" } };
      if (s.turnOrder.length === 2 && !done("STAFF_EVACUATION")) return { room: "MAIN_LAB", year: "Y1996", action: { type: "INTERVENE", nodeId: "STAFF_EVACUATION", choiceId: "EVACUATE" } };
    }
  }
  if (index === 1 || (s.turnOrder.length === 2 && index === 1)) {
    if (s.act < 4) return { room: "ARCHIVES", year: "Y1996" };
    if (!done("ACCIDENT_RECORD")) return { room: "ARCHIVES", year: "Y1996", action: { type: "INTERVENE", nodeId: "ACCIDENT_RECORD", choiceId: route === "OFFICIAL_HISTORY" ? "OFFICIAL" : route === "NO_TOMORROW" ? "ERASED" : "CONTROLLED" } };
    if (route === "DECEIVE_HISTORY" && !done("JI_RECORD")) return { room: "DIRECTOR_OFFICE", year: "Y1996", action: { type: "INTERVENE", nodeId: "JI_RECORD", choiceId: "STAGE_DEATH" } };
    if (route === "DECEIVE_HISTORY" && !done("STAFF_EVACUATION") && s.turnOrder.length < 3) return { room: "ARCHIVES", year: "Y1996" };
    return { room: "ARCHIVES", year: "Y1996", action: { type: "RESOLVE_HISTORY", route } };
  }
  if (route === "DECEIVE_HISTORY" && index === 2) {
    if (s.act < 2) return { room: "RESEARCH_WING", year: "Y1996" };
    if (s.act < 4 || !done("STAFF_EVACUATION")) return { room: "MAIN_LAB", year: "Y1996", action: s.act >= 4 ? { type: "INTERVENE", nodeId: "STAFF_EVACUATION", choiceId: "EVACUATE" } : undefined };
  }
  return null;
}

function nextTravel(s: GameState, id: string, target: Task): { action: GameAction; cost: number } | null {
  const from = s.temporal!.locations[id];
  const key = (room: RoomId03, year: Year03) => `${room}/${year}`;
  const start = key(from.roomId, from.year);
  const goal = key(target.room, target.year);
  if (start === goal) return null;
  const best = new Map<string, { distance: number; first: { action: GameAction; cost: number } | null }>([[start, { distance: 0, first: null }]]);
  const queue = [{ room: from.roomId, year: from.year, distance: 0 }];
  while (queue.length) {
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift()!;
    const here = key(current.room, current.year);
    if (current.distance !== best.get(here)?.distance) continue;
    if (here === goal) return best.get(here)!.first;
    const edges: { room: RoomId03; year: Year03; cost: number; action: GameAction }[] = [
      ...ADJACENT03[current.room].filter((room) => canEnter03(s, room, current.year)).map((room) => ({ room, year: current.year, cost: 1, action: { type: "MOVE", toCarriage: placeKey03(room, current.year) } as GameAction })),
    ];
    const other = current.year === "Y1996" ? "Y2026" : "Y1996";
    if (canEnter03(s, current.room, other)) edges.push({ room: current.room, year: other, cost: 2, action: { type: "TIME_JUMP" } });
    for (const edge of edges) {
      const dest = key(edge.room, edge.year);
      const distance = current.distance + edge.cost;
      if (distance >= (best.get(dest)?.distance ?? Infinity)) continue;
      best.set(dest, { distance, first: best.get(here)!.first ?? { action: edge.action, cost: edge.cost } });
      queue.push({ room: edge.room, year: edge.year, distance });
    }
  }
  return null;
}

function play(n: number, route: Route, run: number) {
  let now = 1_800_000_000_000;
  const routeIndex = routes.indexOf(route);
  const seed = Array.from({ length: 4 }, (_, index) =>
    ((n * 1315423911 + routeIndex * 2246822519 + run * 3266489917 + index * 2654435761) >>> 0).toString(16).padStart(8, "0"),
  ).join("");
  let s = startGame(createGame(`s3-sim-${n}-${route}-${run}`, seatsFor(n), seed, now, "S03_INCIDENT_ZERO"), now).state;
  const apply = (id: string, action: GameAction) => { s = applyGameAction(s, id, action, ++now).state; };
  for (const id of s.turnOrder) apply(id, { type: "ACK_SEQUENCE" });
  let turns = 0;
  let idle = 0;
  let apSpent = 0;
  let jumps = 0;
  for (let guard = 0; s.phase !== "ENDING" && guard < 5000; guard++) {
    s = settle03(s, ++now, true);
    if (s.phase === "ENDING") break;
    if (s.sequence) { for (const id of s.turnOrder) apply(id, { type: "ACK_SEQUENCE" }); continue; }
    const id = s.turnOrder[s.activeIndex];
    const player = s.players[id];
    const task = taskFor(s, id, route);
    if (task && player.ap > 0) {
      const at = s.temporal!.locations[id];
      const travel = nextTravel(s, id, task);
      if (travel && player.ap >= travel.cost) {
        apply(id, travel.action);
        apSpent += travel.cost;
        if (travel.action.type === "TIME_JUMP") jumps++;
        continue;
      }
      if (!travel && at.roomId === task.room && at.year === task.year && task.action && player.ap >= 1) {
        // A route may not be ready until a teammate finishes another task.
        if (task.action.type !== "RESOLVE_HISTORY" || s.temporal!.interventions.some((entry) => entry.nodeId === "ACCIDENT_RECORD") && (route === "NO_TOMORROW" || s.temporal!.bootstrap.every((entry) => !!entry.placedBy)) && (route !== "DECEIVE_HISTORY" || ["STAFF_EVACUATION", "JI_RECORD", "PROTOTYPE_FATE"].every((node) => s.temporal!.interventions.some((entry) => entry.nodeId === node)))) {
          apply(id, task.action);
          apSpent++;
          continue;
        }
      }
    }
    if (player.ap === 3 && !task) idle++;
    turns++;
    apply(id, { type: "END_TURN" });
  }
  if (s.phase !== "ENDING") throw new Error(`Scenario 03 run stalled: ${n}p ${route} #${run}`);
  return { outcome: s.outcome, round: s.round, turns, idle, apSpent, jumps, collapse: s.collapse, relics: s.temporal!.bootstrap.filter((item) => item.placedBy).length };
}

for (const n of sizes) for (const route of routes) {
  const rows = Array.from({ length: runs }, (_, index) => play(n, route, index));
  const wins = rows.filter((row) => row.outcome === `S03_${route}`).length;
  const mean = (key: "round" | "idle" | "apSpent" | "jumps") => (rows.reduce((sum, row) => sum + row[key], 0) / runs).toFixed(1);
  console.log(`${n}p ${route}: ${wins}/${runs} wins, round ${mean("round")}, AP spent ${mean("apSpent")}, jumps ${mean("jumps")}, idle turns ${mean("idle")}`);
  if (wins !== runs) console.log(`  outcomes: ${rows.map((row) => `${row.outcome}@${row.round}`).join(", ")}`);
}
