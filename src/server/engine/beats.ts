// Scripted beats of scenario 01, keyed by round (docs/game-state.md §10).
//   R4  the Faceless Inspector appears; seat neighbours are drawn
//   R5  "confirm your seat neighbour is still themselves": one secret message each
//   R6  public vote: emergency brake or keep going (replaces the round's event)
//   R7  Reality Fold: the middle carriages re-shuffle under everyone's feet
//   R8  passenger echoes board (act 3)
// Round-3 blackout and the act-3 cab opening happen at round end (flow.ts).
import { CARRIAGES, MIDDLE } from "../../shared/game/scenario01/content.ts";
import type { PlayerGameState, PlayerId } from "../../shared/game/state.ts";
import { cue, log, newId, type Ctx } from "./context.ts";
import { applyEffects, changeCollapse } from "./effects.ts";
import { inspectorAppears, moveInspector, spawnEchoes } from "./inspector.ts";
import { everyone, present } from "./players.ts";
import { int, pick, shuffle } from "./rng.ts";
import { onResume, openWindow } from "./windows.ts";
import { m, ref } from "../../shared/i18n/msg.ts";
import type { Msg } from "../../shared/i18n/types.ts";

export function onRoundStart(ctx: Ctx): void {
  const s = ctx.s;
  if (s.round === 4) {
    inspectorAppears(ctx);
    drawSeatNeighbours(ctx);
  }
  if (s.round === 5) dealSecretMessages(ctx);
  if (s.round === 7) realityFold(ctx);
  if (s.round === 8) spawnEchoes(ctx);
  if (s.nightRule === "DISPLACED_TIME" && s.round >= 4 && s.turnOrder.length >= 2) {
    const i = int(s, s.turnOrder.length);
    let j = int(s, s.turnOrder.length - 1);
    if (j >= i) j++;
    [s.turnOrder[i], s.turnOrder[j]] = [s.turnOrder[j], s.turnOrder[i]];
    log(ctx, m`Displaced time: ${s.players[s.turnOrder[j]].nickname} and ${s.players[s.turnOrder[i]].nickname} swap places in the turn order.`, "RULE");
  }
}

/** Pairs; with an odd count the last three form one trio. */
function drawSeatNeighbours(ctx: Ctx): void {
  const s = ctx.s;
  const ids = shuffle(s, everyone(ctx).map((p) => p.playerId));
  const groups: PlayerId[][] = [];
  for (let i = 0; i + 1 < ids.length; i += 2) groups.push([ids[i], ids[i + 1]]);
  if (ids.length % 2 === 1) {
    if (groups.length) groups[groups.length - 1].push(ids[ids.length - 1]);
    else groups.push([ids[0]]);
  }
  s.seatNeighbours = groups;
  log(ctx, m`Seat neighbours: ${groups.map((g) => g.map((id) => s.players[id].nickname).join(" ↔ ")).join(" · ")}. Helping a neighbour in your carriage is stronger.`, "NEIGHBOURS");
  cue(ctx, "NEIGHBOURS", { groups });
}

export function neighboursOf(ctx: Ctx, id: PlayerId): PlayerId[] {
  return (ctx.s.seatNeighbours.find((g) => g.includes(id)) ?? []).filter((x) => x !== id);
}

/** Round 5: every player receives one private message. Two in three are true; there is no traitor. */
function dealSecretMessages(ctx: Ctx): void {
  const s = ctx.s;
  log(ctx, m`"Please confirm that your seat neighbour is still themselves." Every phone lights up with a private message.`, "STORY");
  for (const p of everyone(ctx)) {
    const truthful = int(s, 3) > 0;
    const text = secretMessage(ctx, p, truthful);
    s.secrets[p.playerId].messages.push({ id: newId(ctx, "msg"), text, isTrue: truthful, round: s.round });
    if (s.nightRule === "NAMELESS_NIGHT") p.fate += 1;
  }
  cue(ctx, "SECRET", { all: true });
}

/** One message about the table as it stands; a false one is always actually false. */
export function secretMessage(ctx: Ctx, p: PlayerGameState, truthful: boolean): Msg {
  const s = ctx.s;
  const nb = neighboursOf(ctx, p.playerId);
  const other = s.players[nb.length ? pick(s, nb) : pick(s, everyone(ctx).filter((x) => x.playerId !== p.playerId).map((x) => x.playerId).concat(p.playerId))];
  const kind = int(s, 4);
  if (kind === 0) {
    const real = other.skill.usesLeft > 0;
    const claim = truthful ? real : !real;
    return claim ? m`${other.nickname}'s ability is still unused.` : m`${other.nickname}'s ability is already burned.`;
  }
  if (kind === 1) {
    const real = other.fate;
    const off = int(s, 2) ? 2 : -1;
    // a lie must differ from the truth, so with 0 Fate it can't round down to 0
    const claim = truthful ? real : real + off < 0 ? real + 1 : real + off;
    return m`${other.nickname} is carrying ${claim} Fate.`;
  }
  if (kind === 2) {
    const middle = s.carriages.filter((c) => c.identity !== "START" && c.identity !== "CAB");
    const asleep = middle.filter((c) => !s.flags[`core_${c.identity}`]);
    const awake = middle.filter((c) => s.flags[`core_${c.identity}`]);
    // the truth names a sleeping carriage; a lie names an awake one, or claims all are awake
    const pool = truthful ? asleep : awake;
    if (!pool.length) return m`Every core memory on this train is awake.`;
    return m`A core memory is still asleep in the ${ref.carriage(pick(s, pool).identity)}.`;
  }
  const realSafe = present(ctx).every((x) => x.sanity >= 2);
  const claim = truthful ? realSafe : !realSafe;
  return claim ? m`Nobody on this train is close to getting lost. Yet.` : m`Someone on this train is about to get lost.`;
}

/** Round 7: middle identities re-shuffle; nobody moves, but where they stand changes. */
function realityFold(ctx: Ctx): void {
  const s = ctx.s;
  const before = s.carriages.slice(1, 1 + MIDDLE.length).map((c) => c.identity);
  let after = before;
  for (let tries = 0; tries < 10 && after.join() === before.join(); tries++) after = shuffle(s, before);
  after.forEach((identity, i) => (s.carriages[i + 1].identity = identity));
  s.sequence = { kind: "FOLD", acks: [] };
  log(ctx, m`REALITY FOLD. The train turns inside out. You are standing exactly where you were, in a different carriage.`, "FOLD");
  cue(ctx, "FOLD", { before, after });
}

/** Round 6's event is the emergency-brake vote. Returns true if this round has a scripted event. */
export function scriptedRoundEvent(ctx: Ctx): boolean {
  const s = ctx.s;
  if (s.round !== 6) return false;
  s.currentEvent = { id: "EMERGENCY_BRAKE", round: s.round, resolved: false };
  log(ctx, m`"Route error detected. Engage the emergency brake?"`, "EVENT");
  cue(ctx, "EVENT", { id: "EMERGENCY_BRAKE" });
  openWindow(ctx, {
    kind: "VOTE",
    title: m`Route error detected`,
    prompt: m`Engage the emergency brake? Everyone votes. A tie is settled by chance.`,
    addressees: present(ctx).map((p) => p.playerId),
    options: [
      { id: "BRAKE", label: m`Engage the brake`, detail: m`Collapse −2, but the Inspector acts immediately.` },
      { id: "CONTINUE", label: m`Keep going`, detail: m`Everyone gains 1 Fate, but Collapse +1.` },
    ],
    defaultOptionId: "CONTINUE",
    resume: { kind: "BRAKE_VOTE" },
    blocksTable: true,
  });
  return true;
}

/** Majority wins; a tie is settled by the seeded generator. */
export function tally(ctx: Ctx, answers: Record<PlayerId, string>, options: string[]): { winner: string; counts: Record<string, number>; tie: boolean } {
  const counts: Record<string, number> = Object.fromEntries(options.map((o) => [o, 0]));
  for (const a of Object.values(answers)) if (a in counts) counts[a]++;
  const top = Math.max(...Object.values(counts));
  const leaders = options.filter((o) => counts[o] === top);
  return { winner: leaders.length === 1 ? leaders[0] : pick(ctx.s, leaders), counts, tie: leaders.length > 1 };
}

onResume("BRAKE_VOTE", (ctx, w, answers) => {
  const { winner, counts, tie } = tally(ctx, answers, w.options.map((o) => o.id));
  const summary = tie ? m`Brake ${counts.BRAKE} · Keep going ${counts.CONTINUE} (tie, settled by chance)` : m`Brake ${counts.BRAKE} · Keep going ${counts.CONTINUE}`;
  if (winner === "BRAKE") {
    log(ctx, m`The brakes scream. ${summary}.`, "VOTE");
    changeCollapse(ctx, -2, m`the emergency brake`);
    moveInspector(ctx, 1);
  } else {
    log(ctx, m`The train keeps going. ${summary}.`, "VOTE");
    applyEffects(ctx, [{ kind: "GAIN_FATE", who: "ALL", amount: 1 }], { ownerId: "SYSTEM", targets: [], label: m`keeping going`, group: true });
    changeCollapse(ctx, 1, m`an uncorrected route`);
  }
  if (ctx.s.currentEvent) {
    ctx.s.currentEvent.resolved = true;
    ctx.s.currentEvent.choice = winner;
    ctx.s.currentEvent.resultText = winner === "BRAKE" ? m`Brake engaged. ${summary}.` : m`Kept going. ${summary}.`;
  }
  cue(ctx, "VOTE_RESULT", { winner, counts });
});
