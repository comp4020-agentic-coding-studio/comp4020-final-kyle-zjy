// The engine's public face: pure functions from (state, input, time) to
// (next state, animation cues). The server persists the result; tests and
// replays call the same functions.
import type { GameAction } from "../../shared/game/actions.ts";
import type { GameState, PlayerId } from "../../shared/game/state.ts";
import type { GameEvent } from "../../shared/protocol.ts";
import { applyAction } from "./actions.ts";
import { log, type Ctx } from "./context.ts";
import { advance, tick } from "./flow.ts";
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

/** A player's connection dropped or came back. Away players' turns pass quickly. */
export function setAway(state: GameState, playerId: PlayerId, away: boolean, now: number): Step {
  return run(state, now, (ctx) => {
    const p = ctx.s.players[playerId];
    if (!p || p.away === away) return;
    p.away = away;
    log(ctx, away ? `${p.nickname} has lost their connection.` : `${p.nickname} is back.`, "PRESENCE", playerId);
    if (away && ctx.s.turnOrder[ctx.s.activeIndex] === playerId && ctx.s.step === "PLAYER_TURNS" && ctx.s.turnDeadline !== null) {
      ctx.s.turnDeadline = Math.min(ctx.s.turnDeadline, now + ctx.s.config.awayTurnSeconds * 1000);
    }
    tick(ctx);
  });
}

/** Starts the run (the intro sequence is already on the state). */
export function startGame(state: GameState, now: number): Step {
  return run(state, now, (ctx) => advance(ctx));
}
