// Scenario 02 (Sunken City: The Last High Ground) as the engine's hooks.
// Collapse is the water: it changes the map (city.ts) every time it moves, and
// the act follows it, not the round number. The boat, passes and endings come
// in later phases; the scenario stays closed in the lobby until it is playable.
import { m } from "../../../shared/i18n/msg.ts";
import { BUFF_ITEMS02, ITEM_IDS02 } from "../../../shared/game/scenario02/items.ts";
import type { Msg } from "../../../shared/i18n/types.ts";
import { cue, log, type Ctx } from "../context.ts";
import { changeCollapse } from "../effects.ts";
import { startEnding } from "../ending.ts";
import { int, pick } from "../rng.ts";
import { registerScenario } from "../scenario.ts";
import { s02Actions } from "./actions.ts";
import { applyFlood, moveTargets, stepToward } from "./city.ts";
import { announce02, checkBoatLost, checkReveal, departureStep, results02, startCountdown } from "./boat.ts";
import { ensurePassContest } from "./passes.ts";
import { createScenario02 } from "./create.ts";
import { drawRoundEvent } from "../round-events.ts";
import "./events.ts";

/** The act a Collapse value puts the city in: the water came (0–4), not everyone fits (5–8), the last high ground (9–11). */
export const actAt = (collapse: number): 1 | 2 | 3 => (collapse >= 9 ? 3 : collapse >= 5 ? 2 : 1);

/** What the city looks like as each band of Collapse is reached, said once. */
const BANDS: [number, Msg][] = [
  [3, m`The low streets are going under. Anyone still down there needs to move.`],
  [5, m`Tunnels flood and low bridges give way. The city is coming apart.`],
  [7, m`The city is sinking in earnest. Whole districts go dark at once.`],
  [9, m`Only the high ground and the pier are left above water.`],
  [11, m`The last dry ground. There is no next stage after this one.`],
];

/**
 * The round-end water, by table size, out of 20: how often it holds and how
 * often it surges by 2 (otherwise it rises by 1). Bigger tables have more hands
 * and more seats to fight over, so the sea presses harder; it still holds
 * often enough that nobody can count the rounds left. Expected rise a round:
 * 2 players 0.60, 3–4 0.80, 5–6 0.85, 7–8 0.90, 9–10 0.95.
 */
export function waterOdds(players: number): { hold: number; surge: number } {
  if (players <= 2) return { hold: 10, surge: 2 };
  if (players <= 4) return { hold: 7, surge: 3 };
  if (players <= 6) return { hold: 6, surge: 3 };
  if (players <= 8) return { hold: 6, surge: 4 };
  return { hold: 5, surge: 4 };
}

/** Round-end water: held, +1 or +2 by the table's odds, plus surges, minus what the pumps and good events hold back. */
function roundWater(ctx: Ctx): void {
  const city = ctx.s.city!;
  const odds = waterOdds(ctx.s.turnOrder.length);
  const d = int(ctx.s, 20);
  let rise = (d < odds.hold ? 0 : d >= 20 - odds.surge ? 2 : 1) + city.surge;
  city.surge = 0;
  const held = Math.min(city.hold, rise);
  city.hold = 0;
  rise -= held;
  if (held) log(ctx, m`The pumps hold back part of the water this round.`, "FLOOD");
  if (rise === 0) return log(ctx, m`The water pauses for a moment. Nobody trusts it.`, "FLOOD");
  changeCollapse(ctx, rise, rise === 2 ? m`a surge from the sea` : m`the water rises`);
}

function waterMoved(ctx: Ctx, from: number): void {
  const s = ctx.s;
  if (!s.city) return;
  applyFlood(ctx);
  for (const [at, text] of BANDS) {
    if (s.collapse < at || from >= at || s.flags[`band_${at}`]) continue;
    s.flags[`band_${at}`] = 1;
    log(ctx, text, "STORY");
  }
  if (s.outcome || checkBoatLost(ctx)) return;
  const act = actAt(s.collapse);
  if (act > s.act && (s.phase === "ACT_1" || s.phase === "ACT_2")) {
    s.act = act;
    s.phase = act === 3 ? "ACT_3" : "ACT_2";
    s.sequence = { kind: "FLOOD", acks: [], stage: act };
    cue(ctx, "FLOOD_STAGE", { act });
    checkReveal(ctx);
    // the evacuation window opens: a boat already waiting starts its countdown, and the contest for seats is checked
    startCountdown(ctx);
    ensurePassContest(ctx);
  }
  checkReveal(ctx);
}

/** By this round the city is past its first act, however well the pumps have held. */
export const ACT2_BY_ROUND = 6;

/**
 * The soft deadline on act 1: a round starting at ACT2_BY_ROUND or later with
 * the water still below 5 brings it to 5 (nothing else is added; the pumps
 * can't hold this back). Pumps slow the water; they can't keep the city in act 1.
 */
function act2Deadline(ctx: Ctx): void {
  const s = ctx.s;
  if (s.round < ACT2_BY_ROUND || s.act >= 2 || s.collapse >= 5 || s.outcome) return;
  s.flags.s2_act2Deadline = s.round;
  log(ctx, m`The sea wall at the harbour mouth gives way. No pump in the city can hold back what comes through.`, "STORY");
  changeCollapse(ctx, 5 - s.collapse, m`the sea wall giving way`);
}

registerScenario({
  id: "S02_SUNKEN_CITY",
  create: createScenario02,
  // a getter: actions.ts may still be loading when this registers (import cycle through create.ts)
  get actions() {
    return s02Actions();
  },
  itemPools: { any: ITEM_IDS02, buff: BUFF_ITEMS02 },
  roundHeader: (s) => m`— Round ${s.round} —`,
  // three action points a round in the city (one when in despair); none once aboard
  apFor: (s, p) => (s.city!.boat.aboard.includes(p.playerId) ? 0 : (p.lost ? 1 : 3) + s.config.bonusAp),
  // those aboard are locked in: no more turns, only the view
  takesTurn: (s, p) => !s.city!.boat.aboard.includes(p.playerId),
  onRoundStart: (ctx) => {
    // a crew is whoever worked a job this round
    for (const fac of Object.values(ctx.s.city!.facilities)) fac.workedThisRound = [];
    act2Deadline(ctx);
  },
  afterTurns: () => "WORLD",
  worldStep: departureStep,
  roundEvent: drawRoundEvent,
  roundCollapse: roundWater,
  collapseChanged: waterMoved,
  afterRound: () => false,
  checkEnd: (ctx) => {
    if (ctx.s.collapse < ctx.s.collapseMax || ctx.s.city!.boat.launched) return false;
    log(ctx, m`The last rooftops go under. The city is gone, and the boat with it.`, "STORY");
    startEnding(ctx, "FAILED", "COLLAPSE");
    return true;
  },
  results: results02,
  movePlayer: (ctx, id, to, ownerId, label) => {
    const s = ctx.s;
    const city = s.city!;
    const p = s.players[id];
    const from = p.carriageIndex;
    const pool = to === "TOWARD_SELF" ? [] : to === "ADJACENT" ? moveTargets(city, from) : city.zones.map((_, i) => i).filter((i) => i !== from && (city.zones[i].status === "NORMAL" || city.zones[i].status === "FLOODED"));
    const next = to === "TOWARD_SELF" ? (ownerId ? stepToward(city, from, s.players[ownerId].carriageIndex) : null) : pool.length ? pick(s, pool) : null;
    if (next === null || next === from) return;
    p.carriageIndex = next;
    cue(ctx, "MOVE", { playerId: id, from, to: next });
    log(ctx, to === "TOWARD_SELF" ? m`${p.nickname} moves one zone closer (${label}).` : m`${p.nickname} is swept into another zone (${label}).`, "MOVE", id);
  },
  announceEnding: announce02,
  runJob: () => {},
});
