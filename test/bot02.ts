// A simple, sensible team for scenario 02 (the sinking city), for whole-run
// tests and the simulator (node scripts/sim.ts --scenario 02). It reads the
// full server state (where the parts are hidden, when zones sink): it is a
// measuring stick for the scenario, not a fair player.
//
// Roles spread the table: part hunters search the part sites and carry what
// they find to the pier; others repair the power station, the pier gate and
// the pumps, and run the pumps once fixed; anyone near a waiting stranger
// rescues them. Nobody stays in a zone that goes under at the next rise.
// When the boat is ready, everyone heads for the pier. At the departure: pass
// holders board; someone ashore (or, failing that, the least-contributing
// person aboard) holds the gate; those aboard wait for stragglers until the
// water is high.
import type { MBTI, Zodiac } from "../src/shared/characters/types.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import { BOAT_PARTS } from "../src/shared/game/scenario02/items.ts";
import { zoneIndex } from "../src/shared/game/scenario02/map.ts";
import type { GameState, PlayerId } from "../src/shared/game/state.ts";
import { availableActions } from "../src/server/engine/actions.ts";
import { activePlayerId } from "../src/server/engine/context.ts";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame, tickGame } from "../src/server/engine/engine.ts";
import { moveTargets, partSite } from "../src/server/engine/scenario02/city.ts";
import type { RunInput } from "./bot.ts";

const PIER = zoneIndex("HARBOUR");
const enabled = (s: GameState, id: PlayerId, type: GameAction["type"]) => availableActions(s, id).find((a) => a.type === type)?.enabled ?? false;

/** The next zone on the shortest walkable route from `from` to `goal`, or null. */
function nextStep(s: GameState, from: number, goal: number): number | null {
  if (from === goal) return null;
  const city = s.city!;
  const prev = new Map<number, number>([[from, -1]]);
  const queue = [from];
  while (queue.length) {
    const at = queue.shift()!;
    if (at === goal) break;
    for (const n of moveTargets(city, at)) {
      if (prev.has(n)) continue;
      prev.set(n, at);
      queue.push(n);
    }
  }
  if (!prev.has(goal)) return null;
  let step = goal;
  while (prev.get(step) !== from) step = prev.get(step)!;
  return step;
}

type Goal = { at: number; action: GameAction };

const ROLES = ["PARTS", "POWER", "GATE", "PASSES", "PARTS", "PUMPS", "PEOPLE"] as const;
const NPC_PASS = new Set(["ENGINEER", "TEACHER"]);

/** Where this player should be and what to do there. */
function goal(s: GameState, id: PlayerId): Goal | null {
  const city = s.city!;
  const b = city.boat;
  const me = s.players[id];
  const mine = city.holdings[id];
  // anything I carry for the boat goes to the pier first
  const fit = mine.parts.find((p) => !b.installed.includes(p));
  if (fit) return { at: PIER, action: { type: "INSTALL", part: fit } };
  if (b.readyRound !== null || s.collapse >= 9) {
    if (mine.passes === 0 && s.act >= 2 && city.passSources.includes("EXCHANGE") && me.fate >= 3 && me.items.length) return { at: PIER, action: { type: "REGISTER" } };
    return { at: PIER, action: { type: "END_TURN" } };
  }
  const role = ROLES[s.turnOrder.indexOf(id) % ROLES.length];
  const partSites = BOAT_PARTS.filter((p) => !b.installed.includes(p) && !Object.values(city.holdings).some((h) => h.parts.includes(p)))
    .map((p) => partSite(city, p))
    .filter((z) => z >= 0 && city.zones[z].status !== "SUBMERGED")
    .sort((x, y) => city.zones[x].sinkAt - city.zones[y].sinkAt);
  // a part about to go down with its zone comes before everything
  const urgent = partSites.find((z) => city.zones[z].sinkAt <= s.collapse + 2 && nextStep(s, me.carriageIndex, z) !== null);
  if (urgent !== undefined) return { at: urgent, action: { type: "SEARCH" } };
  const jobs: Record<(typeof ROLES)[number], () => Goal | null> = {
    PARTS: () => (partSites.length ? { at: partSites[0], action: { type: "SEARCH" } } : null),
    PASSES: () => {
      if (mine.passes > 0) return null;
      const vip = city.zones.findIndex((z) => z.caches.includes("VIP_PASS") && z.status !== "SUBMERGED");
      if (vip >= 0) return { at: vip, action: { type: "SEARCH" } };
      const npc = city.npcs.find((n) => n.state === "WAITING" && NPC_PASS.has(n.id));
      if (npc) return { at: npc.zone, action: { type: "RESCUE", npcId: npc.id } };
      if (s.act >= 2 && city.passSources.includes("EXCHANGE") && me.fate >= 3 && me.items.length) return { at: PIER, action: { type: "REGISTER" } };
      return null;
    },
    POWER: () => (!city.facilities.POWER_STATION.done && !b.batteryPower ? { at: zoneIndex("POWER_STATION"), action: { type: "REPAIR" } } : null),
    GATE: () => (!city.facilities.HARBOUR_GATE.done ? { at: PIER, action: { type: "REPAIR" } } : null),
    PUMPS: () => {
      const f = city.facilities.PUMP_STATION;
      if (!f.done) return { at: zoneIndex("PUMP_STATION"), action: { type: "REPAIR" } };
      return city.pumpedRound !== s.round ? { at: zoneIndex("PUMP_STATION"), action: { type: "OPERATE" } } : null;
    },
    PEOPLE: () => {
      const npc = city.npcs.find((n) => n.state === "WAITING" && nextStep(s, me.carriageIndex, n.zone) !== null);
      return npc ? { at: npc.zone, action: { type: "RESCUE", npcId: npc.id } } : null;
    },
  };
  // my own role first, then whatever the boat still needs most; once seats are known, a pass comes first
  const order = s.act >= 2 && mine.passes === 0 ? (["PASSES", role, "PARTS", "POWER", "GATE", "PUMPS", "PEOPLE"] as const) : ([role, "PARTS", "POWER", "GATE", "PASSES", "PUMPS", "PEOPLE"] as const);
  for (const r of order) {
    const g = jobs[r]();
    if (g && nextStep(s, me.carriageIndex, g.at) !== null) return g;
    if (g && me.carriageIndex === g.at) return g;
  }
  return null;
}

/** One action for the active player. */
export function turn02(s: GameState, id: PlayerId): GameAction {
  const city = s.city!;
  const me = s.players[id];
  if (city.boat.aboard.includes(id)) return { type: "END_TURN" };
  if (me.lost && enabled(s, id, "STABILIZE")) return { type: "STABILIZE", mode: "SANITY" };
  const here = me.carriageIndex;
  const g = goal(s, id);
  // never wait where the water arrives next
  const doomed = city.zones[here].sinkAt <= s.collapse + 1 && here !== PIER;
  if (g && here === g.at && !doomed) {
    if (g.action.type === "END_TURN") return g.action;
    if (enabled(s, id, g.action.type)) return g.action;
  }
  const target = g && !(here === g.at && !doomed) ? g.at : doomed ? PIER : null;
  if (target !== null && enabled(s, id, "MOVE")) {
    const step = nextStep(s, here, target) ?? moveTargets(city, here).sort((a, b) => city.zones[b].sinkAt - city.zones[a].sinkAt)[0];
    if (step !== undefined) return { type: "MOVE", toCarriage: step };
  }
  const waiting = city.npcs.find((n) => n.state === "WAITING" && n.zone === here);
  if (waiting && enabled(s, id, "RESCUE")) return { type: "RESCUE", npcId: waiting.id };
  if (enabled(s, id, "SEARCH")) return { type: "SEARCH" };
  if (me.sanity <= 1 && enabled(s, id, "STABILIZE")) return { type: "STABILIZE", mode: "SANITY" };
  return { type: "END_TURN" };
}

/** Answers a decision for a sensible team. */
export function answer02(s: GameState, id: PlayerId, w: GameState["pending"][number]): string {
  const b = s.city!.boat;
  if (w.kind === "FATE_SPEND" && s.roll) {
    const need = Math.max(0, 4 - s.roll.final);
    return w.options.some((o) => o.id === String(need)) ? String(need) : "0";
  }
  if (w.resume.kind === "S2_BOARD") return "BOARD";
  if (w.resume.kind === "S2_GATE") {
    const ashore = w.addressees.filter((x) => !b.aboard.includes(x));
    if (ashore.length) return ashore[0] === id ? "HOLD" : "NO";
    const least = [...w.addressees].sort((x, y) => (s.city!.contrib[x] ?? 0) - (s.city!.contrib[y] ?? 0))[0];
    return least === id ? "HOLD" : "NO";
  }
  if (w.resume.kind === "S2_LAUNCH") return s.collapse >= 10 ? "LEAVE" : "WAIT";
  if (w.kind === "TRADE_OFFER") {
    const want = JSON.parse(String(w.resume.payload?.want ?? "{}")) as { items?: unknown[]; fate?: number; parts?: unknown[]; passes?: number };
    if (!want.items?.length && !want.fate && !want.parts?.length && !want.passes) return "ACCEPT";
  }
  return w.defaultOptionId;
}

export type Run02 = { initial: GameState; state: GameState; inputs: RunInput[] };

/** Plays a whole scenario 02 run to its results (or the guard). */
export function playRun02(o: { seed: string; chars: [Zodiac, MBTI][]; onStep?: (s: GameState) => void }): Run02 {
  const seats = o.chars.map(([zodiac, mbti], i) => ({ playerId: `p${i}`, nickname: `P${i}`, seat: i, zodiac, mbti }));
  let now = 1_800_000_000_000;
  const initial = startGame(createGame("run", seats, o.seed, now, "S02_SUNKEN_CITY"), now).state;
  let s = initial;
  const inputs: RunInput[] = [];
  const act = (id: PlayerId, a: GameAction) => {
    now += 500;
    s = applyGameAction(s, id, a, now).state;
    inputs.push({ kind: "ACT", actor: id, action: a, at: now });
    o.onStep?.(s);
  };
  const tick = () => {
    now += 1000;
    s = tickGame(s, now).state;
    inputs.push({ kind: "TICK", at: now });
    o.onStep?.(s);
  };
  for (let guard = 0; guard < 20_000 && s.phase !== "RESULTS"; guard++) {
    const w = s.pending.at(-1);
    if (w) {
      const waiting = w.addressees.filter((x) => !(x in w.answers));
      if (waiting.length) act(waiting[0], { type: "RESPOND", windowId: w.id, optionId: answer02(s, waiting[0], w) });
      else tick();
      continue;
    }
    if (s.sequence) {
      const ack = s.turnOrder.find((id) => !s.sequence!.acks.includes(id));
      if (ack) act(ack, { type: "ACK_SEQUENCE" });
      else tick();
      continue;
    }
    const id = activePlayerId(s);
    if (!id) {
      tick();
      continue;
    }
    const a = turn02(s, id);
    try {
      act(id, a);
    } catch {
      act(id, { type: "END_TURN" });
    }
  }
  return { initial, state: s, inputs };
}

