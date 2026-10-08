// The way out: the boat at the pier, the passes that let someone compete for
// a seat on it, and the departure, which is its own explicit phase:
//
//   1. BOARD   pass-holders at the pier choose to board; seats go by
//              contribution when there are more takers than seats
//   2. GATE    someone at the pier must hold the gate, and stays (unless the
//              auto-control chip is fitted)
//   3. LAUNCH  if a seat is free and a pass-holder is still out in the city,
//              those aboard vote to leave now or wait one more round
//
// A pass is the right to compete for a seat, not a seat: there are always
// more passes than seats. "Betrayer" is only ever someone who voted to leave
// while a pass-holder was still outside and a seat was free.
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
/** Pass-holders not aboard (and not holding the gate), anywhere in the city. */
const outside = (ctx: Ctx) => present(ctx).filter((p) => ctx.s.city!.holdings[p.playerId].passes > 0 && !ctx.s.city!.boat.aboard.includes(p.playerId) && ctx.s.city!.boat.gatekeeper !== p.playerId);

/** The WORLD step: once the boat is ready, the round after, the departure runs. */
export function departureStep(ctx: Ctx): void {
  const s = ctx.s;
  const b = s.city!.boat;
  if (b.launched || !boatReady(s)) return;
  if (b.readyRound === null) {
    b.readyRound = s.round;
    log(ctx, m`The boat is ready. It leaves at the end of next round. Anyone with a pass: get to the pier.`, "BOAT");
    cue(ctx, "BOAT_READY", {});
    return;
  }
  if (s.round <= b.readyRound) return;
  // nobody boards without knowing how many seats there are
  checkReveal(ctx, true);
  board(ctx);
}

/** Step 1. Pass-holders at the pier choose whether to take a seat. */
function board(ctx: Ctx): void {
  const s = ctx.s;
  const b = s.city!.boat;
  const askers = atPier(ctx).filter((p) => s.city!.holdings[p.playerId].passes > 0 && !b.aboard.includes(p.playerId));
  if (!askers.length) return gate(ctx);
  log(ctx, m`Boarding. ${b.capacity - b.aboard.length} seats left.`, "BOAT");
  openWindow(ctx, {
    kind: "VOTE",
    title: m`Board the boat?`,
    prompt: m`${b.capacity - b.aboard.length} seats left. Boarding uses your pass. If more board than there are seats, seats go to whoever did most for the city.`,
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
  const seats = b.capacity - b.aboard.length;
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
  gate(ctx);
});

/** Step 2. Someone at the pier holds the gate, and stays. The chip makes this unnecessary. */
function gate(ctx: Ctx): void {
  const s = ctx.s;
  const b = s.city!.boat;
  if (!b.aboard.length) return log(ctx, m`Nobody is aboard. The boat waits at the pier.`, "BOAT");
  if (b.autoGate) {
    log(ctx, m`The auto-control chip takes the gate. Nobody has to stay behind.`, "BOAT");
    return launch(ctx);
  }
  const askers = atPier(ctx).map((p) => p.playerId);
  openWindow(ctx, {
    kind: "VOTE",
    title: m`Who holds the gate?`,
    prompt: m`The pier gate only stays open while someone works it by hand. Whoever holds it cannot reach the boat in time. If someone aboard volunteers, they give up their seat.`,
    addressees: askers,
    options: [
      { id: "HOLD", label: m`I'll hold the gate` },
      { id: "NO", label: m`Not me` },
    ],
    defaultOptionId: "NO",
    resume: { kind: "S2_GATE" },
    blocksTable: true,
  });
}

onResume("S2_GATE", (ctx, _w, answers) => {
  const s = ctx.s;
  const city = s.city!;
  const b = city.boat;
  const volunteers = s.turnOrder.filter((id) => answers[id] === "HOLD");
  // someone ashore first; a volunteer aboard steps off and frees their seat
  const holder = volunteers.find((id) => !b.aboard.includes(id)) ?? volunteers[0];
  if (!holder) return log(ctx, m`Nobody will hold the gate. The boat can't leave this round.`, "BOAT");
  if (b.aboard.includes(holder)) {
    b.aboard.splice(b.aboard.indexOf(holder), 1);
    log(ctx, m`${nick(s, holder)} steps off the boat to hold the gate.`, "BOAT", holder);
  } else log(ctx, m`${nick(s, holder)} takes the gate wheel.`, "BOAT", holder);
  b.gatekeeper = holder;
  cue(ctx, "GATE", { playerId: holder });
  if (!b.aboard.length) {
    b.gatekeeper = null;
    return log(ctx, m`Nobody is left aboard. The boat waits at the pier.`, "BOAT");
  }
  launch(ctx);
});

/** Step 3. With a seat free and a pass-holder still out there, those aboard decide: go now, or wait a round. */
function launch(ctx: Ctx): void {
  const s = ctx.s;
  const b = s.city!.boat;
  const free = b.capacity - b.aboard.length;
  const out = outside(ctx);
  if (free <= 0 || !out.length) return castOff(ctx);
  openWindow(ctx, {
    kind: "VOTE",
    title: m`Leave now?`,
    prompt: m`${free} seats are still free, and ${list(out.map((p) => p.nickname))} still hold a pass somewhere in the city. Leave now, or wait one more round?`,
    addressees: [...b.aboard],
    options: [
      { id: "LEAVE", label: m`Leave now` },
      { id: "WAIT", label: m`Wait one more round` },
    ],
    defaultOptionId: "WAIT",
    resume: { kind: "S2_LAUNCH", payload: { outside: JSON.stringify(out.map((p) => p.playerId)) } },
    blocksTable: true,
  });
}

onResume("S2_LAUNCH", (ctx, w, answers) => {
  const s = ctx.s;
  const b = s.city!.boat;
  const leave = b.aboard.filter((id) => answers[id] === "LEAVE");
  const wait = b.aboard.filter((id) => answers[id] !== "LEAVE");
  // a tie waits: nobody is left behind on a coin toss
  if (leave.length <= wait.length) {
    b.gatekeeper = null;
    return log(ctx, m`The boat waits one more round. Whoever held the gate can let go for now.`, "BOAT");
  }
  // an unambiguous act: you chose to go while a pass-holder was out there and a seat was free
  const outsideIds = JSON.parse(String(w.resume.payload?.outside ?? "[]")) as string[];
  if (outsideIds.length) for (const id of leave) if (!b.betrayers.includes(id)) b.betrayers.push(id);
  log(ctx, m`${list(leave.map((id) => nick(s, id)))} vote to leave now.`, "BOAT");
  castOff(ctx);
});

function castOff(ctx: Ctx): void {
  const s = ctx.s;
  const b = s.city!.boat;
  b.launched = true;
  log(ctx, b.gatekeeper ? m`The gate swings open. The boat clears the breakwater with ${b.aboard.length} aboard. ${nick(s, b.gatekeeper)} watches it go.` : m`The gate swings open on its own. The boat clears the breakwater with ${b.aboard.length} aboard.`, "STORY");
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
  const escape = (id: PlayerId) => (b.launched ? (b.aboard.includes(id) ? "ESCAPED" : b.gatekeeper === id ? "GATEKEEPER" : "LEFT_BEHIND") : "DROWNED");
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
    const title: Msg = b.gatekeeper === id && b.launched
      ? m`The Last Gatekeeper`
      : b.betrayers.includes(id)
        ? m`The Betrayer`
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
      fate === "ESCAPED" ? m`Escaped on the boat.` : fate === "GATEKEEPER" ? m`Held the gate so the others could leave.` : fate === "LEFT_BEHIND" ? m`Left behind when the boat sailed.` : m`Went down with the city.`;
    const highlights: Msg[] = [line, contrib === 1 ? m`1 point of public work` : m`${contrib} points of public work`];
    if (city.rescues[id]) highlights.push(city.rescues[id] === 1 ? m`1 rescue` : m`${city.rescues[id]} rescues`);
    if (b.betrayers.includes(id)) highlights.push(m`voted to leave while someone with a pass was still out there`);
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

