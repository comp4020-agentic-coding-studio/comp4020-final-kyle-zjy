// The sinking city: its seeded flood schedule, the check that a run can still
// be won as the water follows that schedule, what changes each time Collapse
// moves, and who is caught when a zone goes under.
import { ADJACENT, FRAGILE, hexDistance, PART_SITES, START_ZONE, HARBOUR_ZONE, ZONES, zoneIndex } from "../../../shared/game/scenario02/map.ts";
import type { CityEdge, CityState, CityZone, GameState, PublicCity, ZoneStatus } from "../../../shared/game/state.ts";
import { m, ref } from "../../../shared/i18n/msg.ts";
import { cue, log, type Ctx } from "../context.ts";
import { loseSanity, present } from "../players.ts";
import { int, pick, shuffle } from "../rng.ts";
import { ITEM_IDS02 } from "../../../shared/game/scenario02/items.ts";
import { NPCS } from "../../../shared/game/scenario02/npcs.ts";

/** When a zone of each height floods and goes under, as Collapse values drawn per run. */
const SCHEDULE = {
  LOW: { flood: [0, 1, 2], sink: [3, 4, 5, 6] },
  MEDIUM: { flood: [5, 6, 7], sink: [8, 9, 10] },
  HIGH: { flood: [9, 10, 11], sink: [11, 12, 12] },
} as const;
/** The pier floods late but never goes under: the boat is moored there. */
const NEVER = 99;
/** The power station's generator hall stands on a raised plinth: it floods but never goes under (the boat's last start is there). */
const RAISED = ["POWER_STATION"];

const id = (i: number) => ZONES[i].id;

// ---- the schedule and its check ---------------------------------------------

/** The zone's state at a Collapse value, by the schedule alone (events aside). */
export function scheduledStatus(z: CityZone, collapse: number): ZoneStatus {
  if (z.status === "BLOCKED") return "BLOCKED";
  return collapse >= z.sinkAt ? "SUBMERGED" : collapse >= z.floodAt ? "FLOODED" : "NORMAL";
}

const edgeOpenAt = (e: CityEdge, collapse: number) => !e.broken && (e.breakAt === null || collapse < e.breakAt);
const zoneOpenAt = (z: CityZone, collapse: number) => {
  const st = scheduledStatus(z, collapse);
  return st !== "SUBMERGED" && st !== "BLOCKED";
};

/** Zones reachable from `from` at a Collapse value, through open zones and edges. */
export function reachableAt(city: CityState, from: number, collapse: number): Set<number> {
  const seen = new Set<number>();
  if (!zoneOpenAt(city.zones[from], collapse)) return seen;
  const queue = [from];
  seen.add(from);
  while (queue.length) {
    const at = queue.shift()!;
    for (const e of city.edges) {
      if (!edgeOpenAt(e, collapse)) continue;
      const next = e.a === at ? e.b : e.b === at ? e.a : -1;
      if (next < 0 || seen.has(next) || !zoneOpenAt(city.zones[next], collapse)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

/** Where each part lies, if the run has one. */
export const partSite = (city: CityState, part: string): number => city.zones.findIndex((z) => z.caches.includes(part));

/**
 * Can this run be won if the water follows its schedule? Every part's zone
 * stays above water through acts 1 and 2 (it never goes under before Collapse
 * 9), and must be reachable from the start, and from it the pier, through
 * Collapse 6; the power and pump stations
 * must be reachable while the middle of the city stands (Collapse 6); the pier
 * must be reachable from the start until the middle floods (Collapse 8) and from
 * the high ground after that (Collapse 10); the power station (where the boat's
 * generator is restarted) must be reachable from the pier through Collapse 8.
 */
export function solvable(city: CityState): string[] {
  const problems: string[] = [];
  const start = city.startZone;
  const harbour = zoneIndex(HARBOUR_ZONE);
  const fromStart6 = reachableAt(city, start, 6);
  for (const part of Object.keys(PART_SITES)) {
    const at = partSite(city, part);
    if (at < 0) problems.push(`${part}: not placed`);
    else if (city.zones[at].sinkAt < PART_SAFE_UNTIL) problems.push(`${part}: ${id(at)} goes under before Collapse ${PART_SAFE_UNTIL}`);
    else if (!fromStart6.has(at)) problems.push(`${part}: ${id(at)} cut off from the start by Collapse 6`);
    else if (!reachableAt(city, at, 6).has(harbour)) problems.push(`${part}: ${id(at)} cut off from the pier by Collapse 6`);
  }
  for (const f of ["POWER_STATION", "PUMP_STATION"]) if (!fromStart6.has(zoneIndex(f))) problems.push(`${f}: cut off by Collapse 6`);
  if (!reachableAt(city, start, 8).has(harbour)) problems.push("pier: cut off from the start by Collapse 8");
  if (!reachableAt(city, harbour, 8).has(zoneIndex("POWER_STATION"))) problems.push("power station: cut off from the pier by Collapse 8");
  const high = city.zones.map((_, i) => i).filter((i) => ZONES[i].elevation === "HIGH");
  if (!high.some((h) => reachableAt(city, h, 10).has(harbour))) problems.push("pier: no high ground reaches it at Collapse 10");
  return problems;
}

/** A zone holding a boat part doesn't go under in acts 1 and 2 (it may still flood). */
export const PART_SAFE_UNTIL = 9;
function keepDry(z: CityZone, part: string): void {
  z.caches.push(part);
  if (z.sinkAt < PART_SAFE_UNTIL) z.sinkAt = PART_SAFE_UNTIL;
}

/** Draws one candidate city from the run's generator. */
function drawCity(s: GameState): CityState {
  const zones: CityZone[] = ZONES.map((z) => {
    if (z.id === HARBOUR_ZONE) return { status: "NORMAL", searched: false, powered: false, floodAt: 9, sinkAt: NEVER, caches: [] };
    const sched = SCHEDULE[z.elevation];
    return { status: "NORMAL", searched: false, powered: false, floodAt: pick(s, [...sched.flood]), sinkAt: pick(s, [...sched.sink]), caches: [] };
  });
  for (const r of RAISED) zones[zoneIndex(r)].sinkAt = NEVER;
  // the meeting point is dry when the sirens start
  const start = zoneIndex(START_ZONE);
  zones[start].floodAt = Math.max(zones[start].floodAt, 5);
  const fragile = new Map(FRAGILE.map((f) => [[zoneIndex(f.a), zoneIndex(f.b)].sort((x, y) => x - y).join("-"), f.kind]));
  const edges: CityEdge[] = ADJACENT.map(([a, b]) => {
    const kind = fragile.get(`${a}-${b}`) ?? "ROAD";
    return { a, b, kind, breakAt: kind === "ROAD" ? null : pick(s, [5, 6]), broken: false };
  });
  // one road already blocked by the quake that started it all (never at the start or the pier)
  const harbour = zoneIndex(HARBOUR_ZONE);
  const roads = edges.filter((e) => e.kind === "ROAD" && ![e.a, e.b].some((x) => x === start || x === harbour));
  pick(s, roads).broken = true;
  for (const [part, sites] of Object.entries(PART_SITES)) keepDry(zones[zoneIndex(pick(s, sites))], part);
  return emptyCity(zones, edges, start);
}

function emptyCity(zones: CityZone[], edges: CityEdge[], startZone: number): CityState {
  const facility = (required: number) => ({ required, progress: 0, done: false, workedThisRound: [], contributors: {} });
  return {
    zones,
    edges,
    startZone,
    hold: 0,
    surge: 0,
    facilities: { POWER_STATION: facility(0), PUMP_STATION: facility(0), HARBOUR_GATE: facility(0) },
    boat: { capacity: 0, revealed: false, installed: [], batteryPower: false, autoStart: false, readyRound: null, aboard: [], engineer: null, launched: false },
    passSources: [],
    pumpedRound: 0,
    holdings: {},
    npcs: [],
    contrib: {},
    rescues: {},
    shared: [],
  };
}

/** Seats on the boat: about 60–80% of the table, never everyone (2 players: 1; 10 players: 6–8). */
export function capacityRange(players: number): [number, number] {
  const hi = Math.max(1, Math.min(players - 1, Math.round(players * 0.8)));
  const lo = Math.min(hi, Math.max(1, Math.round(players * 0.6)));
  return [lo, hi];
}

/** Passes in the city: always more than seats (1 more at small tables, 2 at larger), never more than players. */
export const passSupply = (players: number, capacity: number) => Math.min(players, capacity + (players <= 4 ? 1 : 2));

/**
 * Fills a winnable city for this table: ordinary supplies scattered through
 * it, a few people still waiting for help, and work sized to the number of
 * hands (bigger tables need more repairs, so nobody can do it alone).
 */
function populate(s: GameState, city: CityState, players: number): void {
  const harbour = zoneIndex(HARBOUR_ZONE);
  const open = shuffle(s, city.zones.map((_, i) => i).filter((i) => i !== city.startZone && i !== harbour));
  for (const i of open.slice(0, 12)) city.zones[i].caches.push(pick(s, ITEM_IDS02));
  const spots = shuffle(s, open.filter((i) => ZONES[i].elevation !== "HIGH"));
  const count = Math.min(NPCS.length, 2 + Math.floor(players / 3));
  let chosen = shuffle(s, NPCS).slice(0, count);
  // every run has at least one of the two people who carry a spare pass
  if (!chosen.some((n) => n.reward === "PASS")) chosen = [pick(s, NPCS.filter((n) => n.reward === "PASS")), ...chosen.slice(0, count - 1)];
  city.npcs = chosen.map((n, k) => ({ id: n.id, zone: spots[k], state: "WAITING" }));
  city.facilities.POWER_STATION.required = 1 + Math.ceil(players / 2);
  city.facilities.PUMP_STATION.required = Math.max(1, Math.ceil(players / 4));
  city.facilities.HARBOUR_GATE.required = Math.ceil(players / 3);

  const [lo, hi] = capacityRange(players);
  city.boat.capacity = lo + int(s, hi - lo + 1);
  // where passes can come from; only some are live each run, so finding one is never a sure thing.
  // Half (rounded up) come from the work everyone needs done anyway, the rest from going out looking.
  const vipSpots = open.slice(12, 16);
  const work = ["JOB:POWER_STATION", "JOB:PUMP_STATION", "JOB:HARBOUR_GATE", "INSTALL:ENGINE", "INSTALL:FUEL", "INSTALL:NAV"];
  // a person who carries a pass always has it (their reward is public from the start)
  const people = city.npcs.filter((n) => NPCS.find((d) => d.id === n.id)!.reward === "PASS").map((n) => `NPC:${n.id}`);
  const search = [...vipSpots.map((z) => `VIP:${z}`), "EXCHANGE", "EXCHANGE", "EXCHANGE"];
  const supply = passSupply(players, city.boat.capacity);
  const fromWork = Math.max(0, Math.min(Math.ceil(supply / 2), supply - people.length));
  city.passSources = [...people, ...shuffle(s, work).slice(0, fromWork), ...shuffle(s, search).slice(0, Math.max(0, supply - people.length - fromWork))];
  for (const src of city.passSources) if (src.startsWith("VIP:")) city.zones[Number(src.slice(4))].caches.push("VIP_PASS");
  // the rare way out without a sacrifice: not every run has one
  if (int(s, 5) < 2) city.zones[pick(s, open.filter((i) => ZONES[i].elevation !== "LOW"))].caches.push("CHIP");
}

/**
 * Where each player starts, drawn from the seed: scattered across the city,
 * a different zone each while there are enough. Only safe ground: not the
 * pier, dry when the sirens stop, not going under before act 2 (Collapse 5),
 * and still joined to the pier and the power station at Collapse 6, so nobody
 * starts cut off.
 */
export function spawnZones(s: GameState, city: CityState, players: number): number[] {
  const harbour = zoneIndex(HARBOUR_ZONE);
  const power = zoneIndex("POWER_STATION");
  const safe = city.zones
    .map((z, i) => ({ z, i }))
    .filter(({ z, i }) => i !== harbour && scheduledStatus(z, 0) === "NORMAL" && z.sinkAt > 5)
    .map(({ i }) => i)
    .filter((i) => {
      const r = reachableAt(city, i, 6);
      return r.has(harbour) && r.has(power);
    });
  const pool = shuffle(s, safe.length ? safe : [city.startZone]);
  return Array.from({ length: players }, (_, k) => pool[k % pool.length]);
}

/** A city that can be won, drawn from the seed. Redraws (deterministically) until the schedule check passes. */
export function generateCity(s: GameState, players = s.config?.playerCount ?? 4): CityState {
  let city: CityState | null = null;
  for (let attempt = 0; attempt < 200 && !city; attempt++) {
    const draw = drawCity(s);
    if (!solvable(draw).length) city = draw;
  }
  // practically unreachable (the tests draw thousands of seeds); keeps the run playable regardless
  city ??= safeCity();
  populate(s, city, players);
  return city;
}

/** The latest schedule in every range, no quake damage, each part at its first site. Solvable (tested). */
export function safeCity(): CityState {
  const zones: CityZone[] = ZONES.map((z) =>
    z.id === HARBOUR_ZONE
      ? { status: "NORMAL", searched: false, powered: false, floodAt: 9, sinkAt: NEVER, caches: [] }
      : { status: "NORMAL", searched: false, powered: false, floodAt: Math.max(...SCHEDULE[z.elevation].flood), sinkAt: RAISED.includes(z.id) ? NEVER : Math.max(...SCHEDULE[z.elevation].sink), caches: [] },
  );
  const fragile = new Map(FRAGILE.map((f) => [[zoneIndex(f.a), zoneIndex(f.b)].sort((x, y) => x - y).join("-"), f.kind]));
  const edges: CityEdge[] = ADJACENT.map(([a, b]) => {
    const kind = fragile.get(`${a}-${b}`) ?? "ROAD";
    return { a, b, kind, breakAt: kind === "ROAD" ? null : 6, broken: false };
  });
  for (const [part, sites] of Object.entries(PART_SITES)) keepDry(zones[zoneIndex(sites[0])], part);
  return emptyCity(zones, edges, zoneIndex(START_ZONE));
}

// ---- the water moves ----------------------------------------------------------

const DEPTH: Record<ZoneStatus, number> = { NORMAL: 0, FLOODED: 1, SUBMERGED: 2, BLOCKED: 3 };

/** Brings every zone and edge to the current Collapse, and handles anyone caught. */
export function applyFlood(ctx: Ctx): void {
  const s = ctx.s;
  const city = s.city!;
  const c = s.collapse;
  const sunk: number[] = [];
  city.zones.forEach((z, i) => {
    const next = scheduledStatus(z, c);
    // the water only gets worse by itself: a lower Collapse doesn't raise a zone back up
    if (next === z.status || DEPTH[next] < DEPTH[z.status]) return;
    const was = z.status;
    z.status = next;
    if (next === "SUBMERGED") sunk.push(i);
    else if (next === "FLOODED" && was === "NORMAL") log(ctx, m`Water pours into ${ref.zone(id(i))}.`, "FLOOD");
  });
  for (const i of sunk) log(ctx, m`${ref.zone(id(i))} goes under.`, "SUNK");
  for (const e of city.edges) {
    if (e.broken || e.breakAt === null || c < e.breakAt) continue;
    e.broken = true;
    log(ctx, e.kind === "TUNNEL" ? m`The tunnel between ${ref.zone(id(e.a))} and ${ref.zone(id(e.b))} floods for good.` : m`The low bridge between ${ref.zone(id(e.a))} and ${ref.zone(id(e.b))} is swept away.`, "ROAD");
  }
  if (sunk.length) cue(ctx, "SUNK", { zones: sunk });
  for (const npc of city.npcs) {
    if (npc.state !== "WAITING" || city.zones[npc.zone].status !== "SUBMERGED") continue;
    npc.state = "LOST";
    log(ctx, m`Nobody reached ${ref.npc(npc.id)} in time. The water closes over ${ref.zone(id(npc.zone))}.`, "NPC_LOST");
    for (const p of present(ctx)) if (hexDistance(p.carriageIndex, npc.zone) <= 1) loseSanity(ctx, p, 1, m`a voice that stopped`);
  }
  for (const p of present(ctx)) if (city.zones[p.carriageIndex].status === "SUBMERGED") caught(ctx, p.playerId);
}

/**
 * A zone went under with someone in it: they scramble to the nearest dry zone
 * they can reach (a 4+ gets them out unhurt), or, with nowhere to go, are
 * dragged out at the nearest dry ground and lose more.
 */
function caught(ctx: Ctx, playerId: string): void {
  const s = ctx.s;
  const city = s.city!;
  const p = s.players[playerId];
  const from = p.carriageIndex;
  const dry = (i: number) => city.zones[i].status !== "SUBMERGED" && city.zones[i].status !== "BLOCKED";
  // breadth-first over open edges, through water if need be, to the first dry zone
  const dist = new Map<number, number>([[from, 0]]);
  const queue = [from];
  let to = -1;
  while (queue.length && to < 0) {
    const at = queue.shift()!;
    for (const n of neighbours(city, at)) {
      if (dist.has(n)) continue;
      dist.set(n, dist.get(at)! + 1);
      if (dry(n)) {
        to = n;
        break;
      }
      queue.push(n);
    }
  }
  const unhurt = int(s, 6) >= 3; // 4, 5 or 6
  if (to >= 0) {
    p.carriageIndex = to;
    log(ctx, m`${p.nickname} is caught as ${ref.zone(id(from))} goes under, and struggles through to ${ref.zone(id(to))}.`, "CAUGHT", playerId);
    if (!unhurt) loseSanity(ctx, p, 1, m`the cold water`);
  } else {
    const ground = city.zones.map((_, i) => i).filter(dry);
    to = ground.sort((a, b) => hexDistance(from, a) - hexDistance(from, b) || a - b)[0] ?? city.startZone;
    p.carriageIndex = to;
    log(ctx, m`${p.nickname} is swept away from ${ref.zone(id(from))} and washes up at ${ref.zone(id(to))}.`, "CAUGHT", playerId);
    loseSanity(ctx, p, unhurt ? 1 : 2, m`being swept away`);
  }
  cue(ctx, "MOVE", { playerId, from, to });
}

// ---- getting around ---------------------------------------------------------------

/** Zones joined to `at` by an edge that still stands. */
export function neighbours(city: CityState | PublicCity, at: number): number[] {
  return city.edges.filter((e) => !e.broken && (e.a === at || e.b === at)).map((e) => (e.a === at ? e.b : e.a));
}

export type MoveCheck = { ok: true; wade: boolean } | { ok: false; why: "NOT_ADJACENT" | "SUBMERGED" | "BLOCKED" };

/** Can a player step from one zone to the next? Flooded zones are waded (a roll). */
export function canMove(city: CityState, from: number, to: number): MoveCheck {
  if (!neighbours(city, from).includes(to)) return { ok: false, why: "NOT_ADJACENT" };
  const st = city.zones[to].status;
  if (st === "SUBMERGED") return { ok: false, why: "SUBMERGED" };
  if (st === "BLOCKED") return { ok: false, why: "BLOCKED" };
  return { ok: true, wade: st === "FLOODED" };
}

/** Every zone a player could step into now. */
export const moveTargets = (city: CityState, from: number): number[] => neighbours(city, from).filter((to) => canMove(city, from, to).ok);

/** With a raft: dry zones two steps away across one sunken zone (and not reachable on foot). */
export function raftTargets(city: CityState, from: number): number[] {
  const walk = new Set(moveTargets(city, from));
  const out = new Set<number>();
  for (const mid of neighbours(city, from)) {
    if (city.zones[mid].status !== "SUBMERGED") continue;
    for (const to of neighbours(city, mid)) {
      const st = city.zones[to].status;
      if (to !== from && !walk.has(to) && st !== "SUBMERGED" && st !== "BLOCKED") out.add(to);
    }
  }
  return [...out].sort((x, y) => x - y);
}

// ---- what players see ---------------------------------------------------------------

/**
 * The flood schedule and the caches stay on the server; a zone shows a warning
 * one rise before it goes under. Which parts someone carries is theirs to tell:
 * the others see how many.
 */
export function publicCity(s: GameState, viewerId: string): PublicCity | null {
  if (!s.city) return null;
  const { zones, edges, holdings, passSources, boat, ...rest } = s.city;
  const office = passSources.filter((x) => x === "EXCHANGE").length;
  return {
    ...rest,
    zones: zones.map(({ floodAt: _f, sinkAt, caches: _c, ...z }) => ({ ...z, warning: z.status !== "SUBMERGED" && sinkAt === s.collapse + 1 })),
    edges: edges.map(({ breakAt: _b, ...e }) => e),
    holdings: Object.fromEntries(Object.entries(holdings).map(([id, h]) => {
      const mine = id === viewerId || s.phase === "RESULTS";
      return [id, { parts: mine ? h.parts : null, partCount: h.parts.length, passes: mine ? h.passes : null }];
    })),
    boat: { ...boat, capacity: boat.revealed ? boat.capacity : null },
    officePasses: s.act >= 2 ? office : null,
    passesOut: Object.values(holdings).reduce((n, h) => n + h.passes, 0),
    knownPassSources: (s.act >= 2 ? office : 0) + s.city.npcs.filter((n) => n.state === "WAITING" && s.city!.passSources.includes(`NPC:${n.id}`)).length,
  };
}

/** Zones with someone standing in them, for tests and the bot. */
export const occupied = (s: GameState): number[] => [...new Set(present({ s, now: 0, events: [] }).map((p) => p.carriageIndex))];


/** One walkable step from `from` toward `goal` (dry or flooded zones, standing roads), or null. */
export function stepToward(city: CityState, from: number, goal: number): number | null {
  if (from === goal) return null;
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
