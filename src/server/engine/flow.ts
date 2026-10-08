// The step machine. After every accepted action (and on every timer tick) the
// engine calls advance(), which carries the run forward until it has to wait
// for somebody: an open window, the active player's turn, or a cinematic.
//
//   INTRO → ACT_1 → ACT_2 → ACT_3 → optional ACT_4 → ENDING → RESULTS
//   each round: ROUND_START → PLAYER_TURNS → (INSPECTOR | WORLD) → ROUND_EVENT → ROUND_END
// What happens inside a step that differs by scenario comes from its rules
// (src/server/engine/scenario.ts).
import { activePlayerId, cue, log, type Ctx } from "./context.ts";
import { finishRoll } from "./dice.ts";
import { applyEffects } from "./effects.ts";
import { everyone, hasStatus, removeStatus, statusOf } from "./players.ts";
import { continueReveal } from "./round-events.ts";
import { rulesFor } from "./scenario.ts";
import { processPending } from "./intercept.ts";
import { checkTasks } from "./event-effects.ts";
import { processTriggers, roundTriggers, statusesExpiring } from "./resolver.ts";
import { emptyRoundRecord } from "./create.ts";
import { expireWindows } from "./windows.ts";
import { m } from "../../shared/i18n/msg.ts";

const GUARD = 500;

export function advance(ctx: Ctx): void {
  const s = ctx.s;
  for (let i = 0; i < GUARD; i++) {
    if (s.phase === "RESULTS" || s.phase === "LOBBY") return;
    if (s.pending.length) return;
    if (s.roll && !s.roll.done) {
      finishRoll(ctx);
      continue;
    }
    if (s.pendingEffect) {
      processPending(ctx);
      continue;
    }
    if (s.currentEvent?.revealing || s.currentEvent?.rolling) {
      continueReveal(ctx);
      continue;
    }
    if (s.phase !== "ENDING" && rulesFor(s).checkEnd(ctx)) continue;
    if (s.phase !== "ENDING") checkTasks(ctx);
    if (s.phase !== "ENDING" && processTriggers(ctx)) continue;
    if (s.jobs.length) {
      rulesFor(s).runJob(ctx, s.jobs.shift()!);
      continue;
    }
    if (s.sequence) {
      const seq = s.sequence;
      const present = everyone(ctx).filter((p) => !p.away).map((p) => p.playerId);
      if (!present.every((id) => seq.acks.includes(id))) return;
      endSequence(ctx);
      continue;
    }
    if (s.phase === "INTRO") {
      s.phase = "ACT_1";
      s.act = 1;
      s.step = "ROUND_START";
      continue;
    }
    if (s.phase === "ENDING") {
      s.phase = "RESULTS";
      cue(ctx, "RESULTS", {});
      return;
    }
    if (!stepOnce(ctx)) return;
  }
  throw new Error("engine did not settle");
}

/** Runs one round step. Returns false when the engine must wait for input. */
function stepOnce(ctx: Ctx): boolean {
  const s = ctx.s;
  switch (s.step) {
    case "ROUND_START":
      beginRound(ctx);
      return true;
    case "PLAYER_TURNS": {
      const id = activePlayerId(s);
      if (!id) {
        s.step = rulesFor(s).afterTurns(s);
        s.turnDeadline = null;
        return true;
      }
      const p = s.players[id];
      // an away player keeps their turn until its (shortened) deadline, so a refresh doesn't cost it
      if (s.turnDeadline !== null && ctx.now >= s.turnDeadline) {
        log(ctx, p.away ? m`${p.nickname} is away and ran out of time; their turn passes.` : m`${p.nickname} ran out of time; their turn passes.`, "TURN", id);
        endTurn(ctx);
        return true;
      }
      return false;
    }
    case "INSPECTOR":
    case "WORLD":
      rulesFor(s).worldStep(ctx);
      s.step = "ROUND_EVENT";
      return true;
    case "ROUND_EVENT":
      if (!s.flags[`event_${s.round}`]) {
        s.flags[`event_${s.round}`] = 1;
        rulesFor(s).roundEvent(ctx);
        return true;
      }
      s.step = "ROUND_END";
      return true;
    case "ROUND_END":
      endRound(ctx);
      return true;
  }
}

function beginRound(ctx: Ctx): void {
  const s = ctx.s;
  const rules = rulesFor(s);
  s.round++;
  rules.roundOpens?.(ctx);
  s.roundRecord = emptyRoundRecord();
  // abilities lent out by Server Rave come home
  if (s.flags.skillsReturnRound && s.round >= s.flags.skillsReturnRound) {
    for (const p of everyone(ctx)) delete p.skill.borrowed;
    s.flags.skillsReturnRound = 0;
    log(ctx, m`Every borrowed ability returns to its owner.`, "SKILL");
  }
  log(ctx, rules.roundHeader(s), "ROUND");
  cue(ctx, "ROUND", { round: s.round });
  for (const p of everyone(ctx)) {
    p.ap = rules.apFor(s, p);
    if (hasStatus(p, "CHILL")) {
      p.ap = Math.max(0, p.ap - 1);
      removeStatus(p, "CHILL");
    }
    const prepared = statusOf(p, "SHIELD_NEXT_ROUND");
    if (prepared) {
      p.shields += prepared.value ?? 1;
      removeStatus(p, prepared.id);
      log(ctx, m`${p.nickname}'s prepared shield is up.`, "DEFENCE", p.playerId);
    }
    rules.playerRoundStart?.(ctx, p);
  }

  const due = s.delayed.filter((d) => d.dueRound <= s.round);
  s.delayed = s.delayed.filter((d) => d.dueRound > s.round);
  for (const d of due) applyEffects(ctx, d.effects, { ownerId: d.ownerId, targets: d.targets, label: d.label });

  rules.onRoundStart(ctx);
  roundTriggers(ctx, "ROUND_START");
  s.step = "PLAYER_TURNS";
  s.activeIndex = -1;
  nextTurn(ctx);
}

export function nextTurn(ctx: Ctx): void {
  const s = ctx.s;
  s.activeIndex++;
  s.turnDeadline = null;
  // a player out of the city (scenario 02: aboard the boat) is passed over without a turn
  const takes = rulesFor(s).takesTurn;
  while (takes && s.turnOrder[s.activeIndex] && !takes(s, s.players[s.turnOrder[s.activeIndex]])) s.activeIndex++;
  const id = s.turnOrder[s.activeIndex];
  if (!id) return;
  const p = s.players[id];
  // no clock on a connected player; one who is away gets a short grace
  s.turnDeadline = p.away ? ctx.now + s.config.awayTurnSeconds * 1000 : null;
  s.turnVersion = s.version + 1; // the version this step will commit as
  log(ctx, m`${p.nickname}'s turn.`, "TURN", id);
  cue(ctx, "TURN", { playerId: id });
}

export function endTurn(ctx: Ctx): void {
  const id = activePlayerId(ctx.s);
  if (id) ctx.s.players[id].ap = 0;
  nextTurn(ctx);
}

function endRound(ctx: Ctx): void {
  const s = ctx.s;
  const rules = rulesFor(s);
  rules.roundCloses?.(ctx);
  roundTriggers(ctx, "ROUND_END");
  rules.roundCollapse(ctx);
  statusesExpiring(ctx);
  const rr = s.roundRecord;
  for (const p of everyone(ctx)) {
    p.statuses = p.statuses.filter((st) => st.expiresAtRound === null || st.expiresAtRound > s.round);
    p.lastRoundStatuses = p.statuses.filter((st) => st.ordinary).map((st) => ({ ...st }));
    // streaks some passive abilities wait for
    const c = p.counters;
    c.calmRounds = rr.hurt.includes(p.playerId) ? 0 : (c.calmRounds ?? 0) + 1;
    c.peacefulRounds = rr.attackers.includes(p.playerId) ? 0 : (c.peacefulRounds ?? 0) + 1;
    c.restRounds = rr.usedActive.includes(p.playerId) ? 0 : (c.restRounds ?? 0) + 1;
  }
  s.bonds = s.bonds.filter((b) => b.untilRound > s.round);
  for (const sec of Object.values(s.secrets)) sec.tasks = sec.tasks.filter((t) => !t.done && t.untilRound > s.round);
  s.ruleMods = s.ruleMods.filter((m) => m.untilRound > s.round);
  if (rules.checkEnd(ctx)) return;
  if (rules.afterRound(ctx)) return;
  s.step = "ROUND_START";
}

function endSequence(ctx: Ctx): void {
  const seq = ctx.s.sequence;
  ctx.s.sequence = null;
  if (seq) cue(ctx, "SEQUENCE_END", { kind: seq.kind });
}

/** Timer tick: expire windows, pass timed-out turns, end finished cinematics. */
export function tick(ctx: Ctx): void {
  expireWindows(ctx);
  advance(ctx);
}

/** The earliest moment the engine needs to be woken without player input. */
export function nextDeadline(s: Ctx["s"]): number | null {
  const times: number[] = [];
  const top = s.pending.at(-1);
  // windows and scenes wait for people, not clocks; only an away player's turn runs out
  if (!top && !s.sequence && s.turnDeadline !== null && s.step === "PLAYER_TURNS") times.push(s.turnDeadline);
  return times.length ? Math.min(...times) : null;
}
