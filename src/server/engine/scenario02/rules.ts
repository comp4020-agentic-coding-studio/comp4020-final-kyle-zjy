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
import { announce02, checkBoatLost, checkReveal, departureStep, results02 } from "./boat.ts";
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
 * Round-end water. It rises by 1 half the time, holds a third of the time and
 * surges by 2 otherwise (about 0.8 a round), so nobody can count the rounds left; held rounds (pumps, good
 * events) cancel part of a rise.
 */
function roundWater(ctx: Ctx): void {
  const city = ctx.s.city!;
  const d = int(ctx.s, 6);
  let rise = (d <= 1 ? 0 : d === 5 ? 2 : 1) + city.surge;
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
  }
  checkReveal(ctx);
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
  apFor: (s, p) => (p.lost ? 1 : 2) + s.config.bonusAp,
  onRoundStart: (ctx) => {
    // a crew is whoever worked a job this round
    for (const fac of Object.values(ctx.s.city!.facilities)) fac.workedThisRound = [];
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
