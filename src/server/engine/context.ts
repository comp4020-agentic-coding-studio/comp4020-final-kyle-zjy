// The working context of one engine step: the state being changed, the time
// the action arrived (recorded in the action log, so replays use the same
// clock) and the cues produced for the clients' animations.
import type { RejectCode } from "../../shared/game/actions.ts";
import type { GameState, LogLine, PlayerGameState, PlayerId } from "../../shared/game/state.ts";
import type { GameEvent } from "../../shared/protocol.ts";

export type Ctx = {
  s: GameState;
  now: number;
  events: GameEvent[];
};

export class RuleError extends Error {
  code: RejectCode;
  constructor(code: RejectCode, message: string) {
    super(message);
    this.code = code;
  }
}

const LOG_LIMIT = 80;

/** In-fiction clock: 00:17 plus a minute per log line, wrapping past midnight hour. */
function clock(seq: number): string {
  const minutes = 17 + seq;
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function log(ctx: Ctx, text: string, kind = "INFO", actorId?: PlayerId): void {
  const s = ctx.s;
  const line: LogLine = { seq: s.logSeq, clock: clock(s.logSeq), text, kind, actorId };
  s.logSeq++;
  s.log.push(line);
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

export function cue(ctx: Ctx, kind: string, payload: Record<string, unknown> = {}): void {
  ctx.events.push({ seq: ctx.events.length, kind, payload });
}

export function player(ctx: Ctx, id: PlayerId): PlayerGameState {
  const p = ctx.s.players[id];
  if (!p) throw new RuleError("ILLEGAL_TARGET", "That player isn't in this run.");
  return p;
}

export const name = (ctx: Ctx, id: PlayerId | "SYSTEM"): string => (id === "SYSTEM" ? "The train" : (ctx.s.players[id]?.nickname ?? "Someone"));

export const activePlayerId = (s: GameState): PlayerId | null =>
  s.step === "PLAYER_TURNS" ? (s.turnOrder[s.activeIndex] ?? null) : null;

/** Deterministic unique ids within one run. */
export function newId(ctx: Ctx, prefix: string): string {
  ctx.s.flags.idSeq = (ctx.s.flags.idSeq ?? 0) + 1;
  return `${prefix}${ctx.s.flags.idSeq}`;
}
