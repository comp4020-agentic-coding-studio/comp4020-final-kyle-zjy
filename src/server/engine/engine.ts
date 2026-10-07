// The engine's public face: pure functions from (state, input, time) to
// (next state, animation cues). The server persists the result; tests and
// replays call the same functions.
import type { GameAction } from "../../shared/game/actions.ts";
import type { GameState, PlayerId } from "../../shared/game/state.ts";
import type { GameEvent } from "../../shared/protocol.ts";
import { applyAction } from "./actions.ts";
import { activePlayerId, log, RuleError, type Ctx } from "./context.ts";
import { advance, endTurn, tick } from "./flow.ts";
import { closeTop } from "./windows.ts";
import "./outcomes.ts";
import "./inspector.ts";
import "./skill-effects.ts";
import "./event-effects.ts";

export type Step = { state: GameState; events: GameEvent[] };

function run(state: GameState, now: number, body: (ctx: Ctx) => void): Step {
  const ctx: Ctx = { s: structuredClone(state), now, events: [] };
  body(ctx);
  ctx.s.version++;
  return { state: ctx.s, events: ctx.events };
}

/** A player's action. Throws RuleError (nothing changes) if it isn't allowed. */
export function applyGameAction(state: GameState, actorId: PlayerId, action: GameAction, now: number): Step {
  return run(state, now, (ctx) => {
    const p = ctx.s.players[actorId];
    if (p?.away) p.away = false;
    applyAction(ctx, actorId, action);
    advance(ctx);
  });
}

/** Timers: expired windows, timed-out turns, finished cinematics. */
export function tickGame(state: GameState, now: number): Step {
  return run(state, now, (ctx) => tick(ctx));
}

/**
 * A player's connection dropped or came back. A player who drops on their
 * own turn keeps it for a short grace (awayTurnSeconds), long enough for a
 * refresh; one who comes back has as long as they need again.
 */
export function setAway(state: GameState, playerId: PlayerId, away: boolean, now: number): Step {
  return run(state, now, (ctx) => {
    const p = ctx.s.players[playerId];
    if (!p || p.away === away) return;
    p.away = away;
    log(ctx, away ? `${p.nickname} has lost their connection.` : `${p.nickname} is back.`, "PRESENCE", playerId);
    const theirTurn = ctx.s.turnOrder[ctx.s.activeIndex] === playerId && ctx.s.step === "PLAYER_TURNS";
    if (theirTurn) ctx.s.turnDeadline = away ? now + ctx.s.config.awayTurnSeconds * 1000 : null;
    tick(ctx);
  });
}

/**
 * The host moves a stalled table along, one step per press: the open decision
 * closes with the default for whoever hasn't answered, a scene ends for
 * everyone, or the active player's turn passes. Nothing has a time limit, so
 * this is how a table gets past someone who has stepped away from the screen.
 */
export function hostSkip(state: GameState, now: number): Step {
  return run(state, now, (ctx) => {
    const s = ctx.s;
    const names = (ids: PlayerId[]) => ids.map((id) => s.players[id]?.nickname ?? "someone").join(", ");
    const w = s.pending.at(-1);
    const active = activePlayerId(s);
    if (w) {
      const waiting = w.addressees.filter((id) => w.answers[id] === undefined);
      log(ctx, `The host moves things along: ${names(waiting)} ${waiting.length === 1 ? "takes" : "take"} the default for "${w.title}".`, "HOST");
      closeTop(ctx);
    } else if (s.sequence) {
      log(ctx, "The host moves things along: the scene ends.", "HOST");
      s.sequence.acks = s.turnOrder.slice();
    } else if (active) {
      log(ctx, `The host moves things along: ${names([active])}'s turn passes.`, "HOST", active);
      endTurn(ctx);
    } else {
      throw new RuleError("INVALID", "Nobody is being waited for.");
    }
    advance(ctx);
  });
}

/** Starts the run (the intro sequence is already on the state). */
export function startGame(state: GameState, now: number): Step {
  return run(state, now, (ctx) => advance(ctx));
}
