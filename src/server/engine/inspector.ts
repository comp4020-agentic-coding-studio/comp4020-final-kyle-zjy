// The Faceless Inspector (from round 4) and the passenger echoes (act 3).
// The Inspector walks toward the passenger with the most Fate (ties: most
// items, then turn order) and checks tickets in the carriage it stops in. It
// is not a hit-point boss: three distortion marks banish it for a round.
import type { Job, PlayerGameState } from "../../shared/game/state.ts";
import { cue, log, type Ctx } from "./context.ts";
import { startRoll } from "./dice.ts";
import { registerHandler } from "./effects.ts";
import { absorbs, addStatus, present, removeStatus, statusOf, useUpStatus } from "./players.ts";
import { pick } from "./rng.ts";
import { list, m, ref } from "../../shared/i18n/msg.ts";

const lastMiddle = (ctx: Ctx) => ctx.s.carriages.length - 2;

/** Highest Fate, then most items, then earliest in turn order. */
export function inspectorTarget(ctx: Ctx): PlayerGameState | null {
  const candidates = present(ctx);
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => b.fate - a.fate || b.items.length - a.items.length)[0];
}

export function stepToward(from: number, to: number): number {
  return from === to ? from : from + Math.sign(to - from);
}

export function inspectorAppears(ctx: Ctx): void {
  const insp = ctx.s.inspector;
  insp.active = true;
  insp.carriageIndex = lastMiddle(ctx);
  insp.distortion = 0;
  log(ctx, m`A figure in a conductor's uniform steps out of the front carriage. Where its face should be, there is nothing.`, "INSPECTOR");
  cue(ctx, "INSPECTOR_APPEARS", { carriageIndex: insp.carriageIndex });
}

/** Moves the Inspector `steps` carriages toward its target, then queues ticket checks. */
export function moveInspector(ctx: Ctx, steps: number): void {
  const s = ctx.s;
  const insp = s.inspector;
  if (!insp.active) return;
  if (insp.banishedUntilRound !== null) {
    if (s.round <= insp.banishedUntilRound) return log(ctx, m`The Inspector is nowhere to be seen. Yet.`, "INSPECTOR");
    insp.banishedUntilRound = null;
    const middle = s.carriages.filter((c) => c.identity !== "START" && c.identity !== "CAB").map((c) => c.index);
    insp.carriageIndex = pick(s, middle);
    log(ctx, m`The Inspector steps out of a door that wasn't there. It has come back.`, "INSPECTOR");
    cue(ctx, "INSPECTOR_APPEARS", { carriageIndex: insp.carriageIndex });
  }
  const target = inspectorTarget(ctx);
  if (!target) return;
  insp.targetId = target.playerId;
  const from = insp.carriageIndex;
  for (let i = 0; i < steps && insp.carriageIndex !== target.carriageIndex; i++) {
    insp.carriageIndex = stepToward(insp.carriageIndex, target.carriageIndex);
  }
  if (insp.carriageIndex !== from) {
    cue(ctx, "INSPECTOR_MOVE", { from, to: insp.carriageIndex });
    log(ctx, m`The Inspector walks toward ${target.nickname}.`, "INSPECTOR");
  }
  queueTicketChecks(ctx);
}

function queueTicketChecks(ctx: Ctx): void {
  const s = ctx.s;
  const here = present(ctx)
    .filter((p) => p.carriageIndex === s.inspector.carriageIndex)
    .sort((a, b) => b.fate - a.fate || b.items.length - a.items.length)
    .slice(0, s.config.inspectorTargets);
  if (!here.length) return;
  log(ctx, m`"Tickets, please." The Inspector stops beside ${list(here.map((p) => p.nickname))}.`, "INSPECTOR");
  for (const p of here) s.jobs.push({ kind: "TICKET_CHECK", playerId: p.playerId });
}

export function inspectorPhase(ctx: Ctx): void {
  const s = ctx.s;
  const steps = (s.act === 3 ? s.config.inspectorStepsAct3 : 1) + (s.nightRule === "RED_EYE" ? 1 : 0);
  moveInspector(ctx, steps);
  // echoes walk on their own, whatever the Inspector is doing
  if (s.act === 3) moveEchoes(ctx);
}

/** Echoes stalk whoever is working a key task (or holds the most Fate) and sap their next turn. */
function moveEchoes(ctx: Ctx): void {
  const s = ctx.s;
  for (const echo of s.entities.filter((e) => e.kind === "ECHO")) {
    const prey = keyPlayer(ctx);
    if (!prey) return;
    echo.targetId = prey.playerId;
    const from = echo.carriageIndex;
    echo.carriageIndex = stepToward(echo.carriageIndex, prey.carriageIndex);
    if (from !== echo.carriageIndex) cue(ctx, "ENTITY_MOVE", { id: echo.id, from, to: echo.carriageIndex });
    if (echo.carriageIndex === prey.carriageIndex) s.jobs.push({ kind: "ECHO_STRIKE", playerId: prey.playerId, payload: { echoId: echo.id } });
  }
}

/** A player standing where an escape lock is engaged, else the one with the most Fate. */
function keyPlayer(ctx: Ctx): PlayerGameState | null {
  const key = new Set(["ENGINE_ROOM", "ARCHIVE", "CAB"]);
  const candidates = present(ctx);
  const atKey = candidates.filter((p) => key.has(ctx.s.carriages[p.carriageIndex]?.identity));
  const pool = atKey.length ? atKey : candidates;
  return pool.length ? [...pool].sort((a, b) => b.fate - a.fate)[0] : null;
}

export function runInspectorJob(ctx: Ctx, job: Job): void {
  const s = ctx.s;
  const p = s.players[job.playerId];
  if (!p || p.away) return;
  if (job.kind === "TICKET_CHECK") {
    if (p.carriageIndex !== s.inspector.carriageIndex || !s.inspector.active) return;
    const pass = statusOf(p, "TEMP_PASS") ?? statusOf(p, "PASS");
    if (pass) {
      useUpStatus(ctx, p, pass.id);
      log(ctx, m`${p.nickname} shows a pass. The Inspector moves on.`, "TICKET", p.playerId);
      return;
    }
    startRoll(ctx, p, "TICKET_CHECK", m`ticket check`, { kind: "TICKET_CHECK", carriageIndex: p.carriageIndex });
    return;
  }
  // ECHO_STRIKE
  if (absorbs(ctx, p, m`an echo's touch`)) return;
  addStatus(ctx, p, { kind: "CHILL", polarity: "NEGATIVE", sourceId: "SYSTEM", expiresAtRound: null, hidden: false, ordinary: true });
  log(ctx, m`An echo brushes past ${p.nickname}. They feel a round slip away (−1 action point next round).`, "ENTITY", p.playerId);
  cue(ctx, "ECHO_STRIKE", { playerId: p.playerId });
}

export function spawnEchoes(ctx: Ctx): void {
  const s = ctx.s;
  for (let i = 0; i < s.config.echoes; i++) {
    const middle = s.carriages.filter((c) => c.identity !== "START").map((c) => c.index);
    s.entities.push({ id: `echo${s.round}_${i}`, kind: "ECHO", carriageIndex: pick(s, middle), hp: 2, targetId: null });
  }
  log(ctx, m`Passenger echoes start walking the train: ${s.config.echoes}. They follow whoever matters most right now.`, "ENTITY");
  cue(ctx, "ENTITY_SPAWN", { kind: "ECHO", count: s.config.echoes });
}

registerHandler("INSPECTOR_STEP", (ctx, e) => {
  if (!ctx.s.inspector.active) return log(ctx, m`A whistle sounds, but nobody answers it. Not yet.`, "INSPECTOR");
  moveInspector(ctx, e.steps);
});
