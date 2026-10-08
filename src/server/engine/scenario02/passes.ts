// How many people can still realistically compete for a seat. A pass is the
// right to compete for one, and the departure only has a contest if there are
// more people with a pass (or a real chance of one) than seats. The pass
// sources drawn at creation can die during a run (a person drowns, a VIP card's
// zone goes under, a road breaks, there's no time left), so at a few fixed
// moments (entering act 2 or 3, the departure countdown starting) the
// evacuation office is topped up until the contest is back, and never past it.
//
// "Realistic" is an approximation, not a solver: walking distance over the
// current map (one action point a step, through dry or flooded zones and
// standing roads), the action points each player has in the rounds left, and
// one action point to claim. Each player can account for one source.
import { HARBOUR_ZONE, zoneIndex } from "../../../shared/game/scenario02/map.ts";
import type { GameState, PlayerGameState } from "../../../shared/game/state.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { cue, log, type Ctx } from "../context.ts";
import { present } from "../players.ts";
import { rulesFor } from "../scenario.ts";
import { moveTargets, partSite, passSupply } from "./city.ts";

/** Without a departure countdown, how many rounds ahead a source still counts as within reach. */
export const HORIZON_ROUNDS = 2;

/** Walking distance in steps from `from` to every zone a player can reach on foot now. */
export function walkDistances(s: GameState, from: number): Map<number, number> {
  const city = s.city!;
  const dist = new Map<number, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const at = queue.shift()!;
    for (const n of moveTargets(city, at)) {
      if (dist.has(n)) continue;
      dist.set(n, dist.get(at)! + 1);
      queue.push(n);
    }
  }
  return dist;
}

/** Rounds of turns left before boarding (the countdown), or the look-ahead horizon when there is none yet. */
export function roundsLeft(s: GameState): number {
  const b = s.city!.boat;
  if (b.readyRound === null) return HORIZON_ROUNDS;
  // boarding is in the world step of the round after the boat was ready; a round's turns count until they are over
  const turnsDone = s.step !== "ROUND_START" && s.step !== "PLAYER_TURNS";
  return Math.max(0, b.readyRound + 1 - s.round + (turnsDone ? 0 : 1));
}

/** Where a live pass source would be claimed, and whether it can still pay out at all; null when it can't. */
function sourceZone(s: GameState, src: string, countdown: boolean): { zone: number; extra: number } | null {
  const city = s.city!;
  const [kind, key] = src.split(":");
  const harbour = zoneIndex(HARBOUR_ZONE);
  // a zone that goes under at the next rise is lost before anyone gets the use of it (with a countdown, boarding comes first)
  const lasts = (z: number) => countdown || city.zones[z].sinkAt > s.collapse + 1;
  switch (kind) {
    case "EXCHANGE":
      return s.act >= 2 ? { zone: harbour, extra: 0 } : null;
    case "NPC": {
      const npc = city.npcs.find((n) => n.id === key);
      return npc && npc.state === "WAITING" && lasts(npc.zone) ? { zone: npc.zone, extra: 0 } : null;
    }
    case "VIP": {
      // a hidden card nobody knows the place of is no plan with one round left
      const z = Number(key);
      return !countdown && !city.zones[z].searched && lasts(z) ? { zone: z, extra: 0 } : null;
    }
    case "JOB": {
      const fac = city.facilities[key as keyof typeof city.facilities];
      if (!fac || fac.done) return null;
      const z = zoneIndex(key === "HARBOUR_GATE" ? HARBOUR_ZONE : key);
      // each repair is an action; with a countdown only a job one repair from done is in reach
      const work = fac.required - fac.progress;
      return (!countdown || work <= 1) && lasts(z) ? { zone: z, extra: Math.max(0, work - 1) } : null;
    }
    case "INSTALL": {
      if (city.boat.installed.includes(key as never)) return null;
      const holder = Object.entries(city.holdings).find(([, h]) => h.parts.includes(key as never));
      if (holder) return { zone: harbour, extra: 0 };
      const site = partSite(city, key);
      return site >= 0 && lasts(site) ? { zone: site, extra: 0 } : null;
    }
    default:
      return null;
  }
}

export type PassAvailability = {
  /** Passes in players' hands, plus seats already taken with one. */
  held: number;
  /** Live sources someone could actually get to and claim in time (one per player). */
  obtainable: number;
  /** Live sources by the book, reachable or not. */
  theoretical: number;
  /** held + obtainable, never more than the table. */
  effective: number;
  /** What a contest needs: more than the seats (passSupply), never more than the table. */
  target: number;
  capacity: number;
  /** Players who could still claim a pass at the pier office in time and aren't counted for another source. */
  officeReach: number;
};

export function passAvailability(s: GameState): PassAvailability {
  const city = s.city!;
  const b = city.boat;
  const players = s.turnOrder.length;
  const countdown = b.readyRound !== null;
  const rounds = roundsLeft(s);
  const harbour = zoneIndex(HARBOUR_ZONE);
  const held = Object.values(city.holdings).reduce((n, h) => n + h.passes, 0) + b.aboard.length;
  const ctx = { s, now: 0, events: [] };
  const people = present(ctx).filter((p) => !b.aboard.includes(p.playerId));
  const dists = new Map(people.map((p) => [p.playerId, walkDistances(s, p.carriageIndex)]));
  const budget = (p: PlayerGameState) => rounds * rulesFor(s).apFor(s, p);
  // can this player get to the zone, claim (one action plus any work left) and, with a countdown, still reach the pier?
  const canClaim = (p: PlayerGameState, zone: number, extra: number) => {
    const d = dists.get(p.playerId)!;
    const there = d.get(zone);
    if (there === undefined) return false;
    let cost = there + 1 + extra;
    if (countdown) {
      const back = walkDistances(s, zone).get(harbour);
      if (back === undefined) return false;
      cost += back;
    }
    return cost <= budget(p);
  };

  const live = city.passSources.map((src) => sourceZone(s, src, countdown)).filter((x) => x !== null);
  // greedy, scarcest source first: each player is counted for one source
  const used = new Set<string>();
  let obtainable = 0;
  const options = live.map((src) => ({ src, who: people.filter((p) => canClaim(p, src.zone, src.extra)) })).sort((x, y) => x.who.length - y.who.length);
  for (const { who } of options) {
    const p = who.find((x) => !used.has(x.playerId));
    if (!p) continue;
    used.add(p.playerId);
    obtainable++;
  }
  const officeReach = s.act >= 2 ? people.filter((p) => !used.has(p.playerId) && canClaim(p, harbour, 0)).length : 0;
  const target = passSupply(players, b.capacity);
  return { held, obtainable, theoretical: city.passSources.length, effective: Math.min(players, held + obtainable), target, capacity: b.capacity, officeReach };
}

/**
 * Tops the evacuation office up so that held plus realistically obtainable
 * passes reach the target (more than the seats, never more than the table),
 * and only with passes someone can actually reach the office for in time.
 * Returns how many it added.
 */
export function ensurePassContest(ctx: Ctx): number {
  const s = ctx.s;
  const city = s.city;
  if (!city || s.act < 2 || city.boat.launched || s.outcome) return 0;
  const a = passAvailability(s);
  const add = Math.max(0, Math.min(a.target - a.effective, a.officeReach));
  if (!add) return 0;
  for (let i = 0; i < add; i++) city.passSources.push("EXCHANGE");
  s.flags.s2_officeAdded = (s.flags.s2_officeAdded ?? 0) + add;
  log(ctx, add === 1 ? m`A late list comes through at the pier: the evacuation office has one more pass to give.` : m`A late list comes through at the pier: the evacuation office has ${add} more passes to give.`, "PASS");
  cue(ctx, "OFFICE", { added: add });
  return add;
}
