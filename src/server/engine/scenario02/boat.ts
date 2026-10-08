// The way out: the boat at the pier, the passes that let someone compete for
// a seat on it, and the departure, which is its own explicit phase:
//
//   1. READY   the boat has its parts, power and gate; boarding waits for act 2
//   2. BOARD   from the round after the countdown starts, each round:
//              pass-holders at the pier choose to board; seats go by
//              contribution when there are more takers than seats. Once
//              aboard, a player is locked in and takes no more turns.
//   3. START   someone still in the city restarts the generator at the power
//              station (RESTART_GENERATOR, a roll that can be retried); on a
//              success the boat leaves. The rare auto-control chip starts it
//              from the deck instead.
//
// A pass is the right to compete for a seat, not a seat: there are always
// more passes than seats.
import { BOAT_PARTS } from "../../../shared/game/scenario02/items.ts";
import { HARBOUR_ZONE, ZONES, zoneIndex } from "../../../shared/game/scenario02/map.ts";
import type { GameState, PlayerGameState, PlayerId, PlayerResult } from "../../../shared/game/state.ts";
import { list, m, ref } from "../../../shared/i18n/msg.ts";
import type { Msg } from "../../../shared/i18n/types.ts";
import { cue, log, type Ctx } from "../context.ts";
import { startEnding } from "../ending.ts";
import { present } from "../players.ts";
import { shuffle } from "../rng.ts";
import { onResume, openWindow } from "../windows.ts";
import { partSite } from "./city.ts";
import { ensurePassContest } from "./passes.ts";

const harbour = () => zoneIndex(HARBOUR_ZONE);
const nick = (s: GameState, id: PlayerId) => s.players[id].nickname;

/** What the boat still needs, in order (empty: ready). */
export function boatMissing(s: GameState): Msg[] {
  const city = s.city!;
  const b = city.boat;
  const out: Msg[] = [];
  for (const part of BOAT_PARTS) if (!b.installed.includes(part)) out.push(m`the ${ref.part(part)}`);
  if (!city.facilities.POWER_STATION.done && !b.batteryPower) out.push(m`power at the pier`);
  if (!city.facilities.HARBOUR_GATE.done) out.push(m`a working pier gate`);
  return out;
}

export const boatReady = (s: GameState) => boatMissing(s).length === 0;

// ---- capacity -------------------------------------------------------------------

/**
 * The capacity is shown the first time anyone sees the boat once the city is
 * coming apart (act 2: reaching the pier or investigating there), or, failing
 * that, when Collapse reaches 7.
 */
export function checkReveal(ctx: Ctx, force = false): void {
  const s = ctx.s;
  const b = s.city?.boat;
  if (!b || b.revealed) return;
  const seen = force || (s.act >= 2 && present(ctx).some((p) => p.carriageIndex === harbour()));
  if (!seen && s.collapse < 7) return;
  b.revealed = true;
  log(ctx, seen ? m`Someone gets a proper look at the boat. It can carry ${b.capacity}. There are ${s.turnOrder.length} of you.` : m`Word spreads through the city: the boat at the pier can carry ${b.capacity}. There are ${s.turnOrder.length} of you.`, "BOAT");
  s.sequence ??= { kind: "CAPACITY", acks: [] };
  cue(ctx, "CAPACITY", { capacity: b.capacity });
}

// ---- passes -------------------------------------------------------------------------

/** A live pass source pays out once; returns whether it did. */
export function awardPass(ctx: Ctx, source: string, to: PlayerGameState, how: Msg): boolean {
  const city = ctx.s.city!;
  const i = city.passSources.indexOf(source);
  if (i < 0) return false;
  city.passSources.splice(i, 1);
  city.holdings[to.playerId].passes++;
  log(ctx, m`${to.nickname} is given something by ${how}, and pockets it without a word.`, "PASS", to.playerId);
  ctx.s.secrets[to.playerId].peeks.push({ id: `pass_${ctx.s.logSeq}`, text: m`You hold an evacuation pass (${how}). It lets you compete for a seat on the boat. It is not a seat.`, round: ctx.s.round });
  cue(ctx, "PASS", { playerId: to.playerId });
  return true;
}

/** A finished job's pass, if this run has one, goes to whoever put the most work into it. */
export function jobDone(ctx: Ctx, job: "POWER_STATION" | "PUMP_STATION" | "HARBOUR_GATE"): void {
  const fac = ctx.s.city!.facilities[job];
  const best = Object.entries(fac.contributors).sort((a, b) => b[1] - a[1] || ctx.s.turnOrder.indexOf(a[0]) - ctx.s.turnOrder.indexOf(b[0]))[0];
  if (best) awardPass(ctx, `JOB:${job}`, ctx.s.players[best[0]], m`the grateful crew at ${ref.zone(ZONES[zoneIndex(job === "HARBOUR_GATE" ? HARBOUR_ZONE : job)].id)}`);
}

// ---- a part lost to the water ---------------------------------------------------------

/** If a part the boat needs went under unfound, nobody leaves: the run ends now. */
export function checkBoatLost(ctx: Ctx): boolean {
  const s = ctx.s;
  const city = s.city!;
  for (const part of BOAT_PARTS) {
    if (city.boat.installed.includes(part) || Object.values(city.holdings).some((h) => h.parts.includes(part))) continue;
    const site = partSite(city, part);
    if (site >= 0 && city.zones[site].status !== "SUBMERGED") continue;
    log(ctx, m`The ${ref.part(part)} goes down with ${ref.zone(ZONES[site].id)}. Without it, no boat will ever leave this city.`, "STORY");
    startEnding(ctx, "FAILED", "BOAT_LOST");
    return true;
  }
  return false;
}

// ---- departure ------------------------------------------------------------------------

const atPier = (ctx: Ctx) => present(ctx).filter((p) => p.carriageIndex === harbour());
const seatsLeft = (s: GameState) => s.city!.boat.capacity - s.city!.boat.aboard.length;

/** Someone is aboard and the boat only waits for its generator: the last task in the city. */
export const awaitingStart = (s: GameState) => {
  const b = s.city!.boat;
  return !b.launched && b.readyRound !== null && b.aboard.length > 0;
};

/**
 * The WORLD step: once the boat is ready, the round after, the departure runs.
 * The evacuation window only opens in act 2 (Collapse 5): a boat ready before
 * that waits, and its countdown starts when the act changes (startCountdown).
 */
export function departureStep(ctx: Ctx): void {
  const s = ctx.s;
  const b = s.city!.boat;
  if (b.launched || !boatReady(s)) return;
  if (s.act < 2) {
    if (s.flags.s2_readyEarly) return;
    s.flags.s2_readyEarly = 1;
    log(ctx, m`The boat is ready, but the evacuation window isn't open yet. Boarding starts in Act II.`, "BOAT");
    cue(ctx, "BOAT_READY", { early: true });
    return;
  }
  if (b.readyRound === null) return startCountdown(ctx);
  if (s.round <= b.readyRound) return;
  board(ctx);
}

/**
 * The departure countdown: boarding is in the next round's world step. The
 * seats are shown now, so nobody spends their last round guessing, and the
 * office is topped up if the contest for seats has died.
 */
export function startCountdown(ctx: Ctx): void {
  const s = ctx.s;
  const b = s.city!.boat;
  if (b.launched || b.readyRound !== null || s.act < 2 || !boatReady(s)) return;
  b.readyRound = s.round;
  log(ctx, m`The boat is ready. Boarding opens next round. Anyone with a pass: get to the pier.`, "BOAT");
  cue(ctx, "BOAT_READY", {});
  checkReveal(ctx, true);
  ensurePassContest(ctx);
}

/** Each world step from the round after the countdown: pass-holders at the pier choose whether to take a seat. */
function board(ctx: Ctx): void {
  const s = ctx.s;
  const b = s.city!.boat;
  const seats = seatsLeft(s);
  const askers = atPier(ctx).filter((p) => s.city!.holdings[p.playerId].passes > 0 && !b.aboard.includes(p.playerId));
  if (!askers.length || seats <= 0) return;
  log(ctx, seats === 1 ? m`Boarding. 1 seat left.` : m`Boarding. ${seats} seats left.`, "BOAT");
  openWindow(ctx, {
    kind: "VOTE",
    title: m`Board the boat?`,
    prompt:
      seats === 1
        ? m`1 seat left. Boarding uses your pass, and once aboard you stay aboard: no more turns in the city. If more board than there are seats, seats go to whoever did most for the city.`
        : m`${seats} seats left. Boarding uses your pass, and once aboard you stay aboard: no more turns in the city. If more board than there are seats, seats go to whoever did most for the city.`,
    addressees: askers.map((p) => p.playerId),
    options: [
      { id: "BOARD", label: m`Board` },
      { id: "STAY", label: m`Stay ashore` },
    ],
    defaultOptionId: "STAY",
    resume: { kind: "S2_BOARD" },
    blocksTable: true,
  });
}

onResume("S2_BOARD", (ctx, _w, answers) => {
  const s = ctx.s;
  const city = s.city!;
  const b = city.boat;
  const wanting = Object.entries(answers).filter(([, a]) => a === "BOARD").map(([id]) => id);
  const seats = seatsLeft(s);
  // most public work first; ties by the run's generator, the same on replay
  const order = shuffle(s, wanting).sort((x, y) => (city.contrib[y] ?? 0) - (city.contrib[x] ?? 0));
  const taken = order.slice(0, seats);
  for (const id of taken) {
    city.holdings[id].passes--;
    b.aboard.push(id);
  }
  if (taken.length) log(ctx, m`Aboard now: ${list(b.aboard.map((id) => nick(s, id)))}.`, "BOAT");
  const left = order.slice(seats);
  if (left.length) log(ctx, m`No seat for ${list(left.map((id) => nick(s, id)))}. They did less for the city than those who took them.`, "BOAT");
  cue(ctx, "BOARD", { aboard: b.aboard });
  if (!taken.length) return;
  if (b.autoStart) {
    log(ctx, m`The auto-control chip starts the boat's engine from the deck. Nobody has to go back for the generator.`, "BOAT");
    return castOff(ctx, null);
  }
  if (!s.flags.s2_awaitStart) {
    s.flags.s2_awaitStart = 1;
    log(ctx, m`Those aboard can only wait. The boat's engine needs one last surge of power: someone still in the city has to reach ${ref.zone("POWER_STATION")} and restart the generator.`, "BOAT");
    cue(ctx, "AWAIT_START", {});
  }
});

/** The generator caught (or the chip started the boat): it leaves with whoever is aboard. */
export function castOff(ctx: Ctx, engineer: PlayerGameState | null): void {
  const s = ctx.s;
  const b = s.city!.boat;
  b.launched = true;
  b.engineer = engineer?.playerId ?? null;
  log(
    ctx,
    engineer
      ? b.aboard.length === 1
        ? m`Power surges down to the pier. The boat clears the breakwater with 1 aboard. ${engineer.nickname} watches it go from the power station.`
        : m`Power surges down to the pier. The boat clears the breakwater with ${b.aboard.length} aboard. ${engineer.nickname} watches it go from the power station.`
      : b.aboard.length === 1
        ? m`The boat clears the breakwater with 1 aboard.`
        : m`The boat clears the breakwater with ${b.aboard.length} aboard.`,
    "STORY",
  );
  cue(ctx, "LAUNCH", { aboard: b.aboard });
  startEnding(ctx, "S02_EVACUATED");
}

// ---- how each player's run ended ------------------------------------------------------------

/** Each player's own outcome, a title earned by what they plainly did, and the facts behind it. */
export function results02(ctx: Ctx): PlayerResult[] {
  const s = ctx.s;
  const city = s.city!;
  const b = city.boat;
  const ids = s.turnOrder;
  const escape = (id: PlayerId) => (b.launched ? (b.aboard.includes(id) ? "ESCAPED" : b.engineer === id ? "ENGINEER" : "LEFT_BEHIND") : "DROWNED");
  const most = (score: (id: PlayerId) => number, min: number) => {
    const best = Math.max(...ids.map(score));
    return best >= min ? ids.filter((id) => score(id) === best) : [];
  };
  const held = (id: PlayerId) => s.players[id].items.length + city.holdings[id].parts.length + city.holdings[id].passes;
  const rescuers = most((id) => city.rescues[id] ?? 0, 2);
  const workers = most((id) => s.players[id].stats.repairs, 3);
  const gamblers = most((id) => s.players[id].stats.fateSpentOnDice, 3);
  const hoarders = most(held, 4);
  const escaped = ids.filter((id) => escape(id) === "ESCAPED");

  return ids.map((id) => {
    const fate = escape(id);
    const contrib = city.contrib[id] ?? 0;
    const title: Msg =
      fate === "ENGINEER"
        ? m`The Last Engineer`
        : escaped.length === 1 && escaped[0] === id && ids.length > 1
          ? m`The Last Survivor`
          : fate !== "ESCAPED" && b.launched && contrib >= 3
            ? m`The Unsung Hero`
            : rescuers.includes(id)
              ? m`The Rescuer`
              : workers.includes(id)
                ? m`Companion in the Deep`
                : gamblers.includes(id)
                  ? m`Fate's Gambler`
                  : hoarders.includes(id)
                    ? m`The Hoarder`
                    : fate === "ESCAPED"
                      ? m`A Survivor`
                      : m`Taken by the Water`;
    const line: Msg =
      fate === "ESCAPED"
        ? m`Escaped on the boat.`
        : fate === "ENGINEER"
          ? m`Restarted the generator so the others could leave.`
          : fate === "LEFT_BEHIND"
            ? m`Left behind when the boat sailed.`
            : m`Went down with the city.`;
    const highlights: Msg[] = [line, contrib === 1 ? m`1 point of public work` : m`${contrib} points of public work`];
    if (city.rescues[id]) highlights.push(city.rescues[id] === 1 ? m`1 rescue` : m`${city.rescues[id]} rescues`);
    return { playerId: id, obsession: null, obsessionMet: false, title, highlights, messages: [], escape: fate };
  });
}

/** The ending's line in the log. */
export function announce02(ctx: Ctx): void {
  const s = ctx.s;
  const b = s.city!.boat;
  if (s.outcome === "S02_EVACUATED") return log(ctx, m`Evacuated: ${b.aboard.length} of ${s.turnOrder.length}.`, "ENDING_WIN");
  log(ctx, s.failReason === "BOAT_LOST" ? m`No boat leaves the city. Nobody escapes.` : m`The city is gone. Nobody escapes.`, "ENDING_FAIL");
}
