// Builds real runs through the engine's public functions, so tests exercise
// the same code paths as the server.
import type { MBTI, Zodiac } from "../src/shared/characters/types.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import type { GameState, PlayerId } from "../src/shared/game/state.ts";
import { createGame, type Seat } from "../src/server/engine/create.ts";
import { applyGameAction, hostSkip, startGame, tickGame, type Step } from "../src/server/engine/engine.ts";
import { activePlayerId } from "../src/server/engine/context.ts";
import { next as nextFloat } from "../src/server/engine/rng.ts";

export const T0 = 1_800_000_000_000;
export const SEED = "0123456789abcdef0123456789abcdef";

const DEFAULT_CHARS: [Zodiac, MBTI][] = [
  ["scorpio", "ENTP"],
  ["pisces", "ISFJ"],
  ["leo", "ESFP"],
  ["aries", "INTJ"],
  ["gemini", "INTP"],
  ["cancer", "ENFJ"],
  ["capricorn", "ENTP"],
  ["aquarius", "INTJ"],
  ["virgo", "ISTJ"],
  ["libra", "ESTP"],
];

export const ids = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i)); // a, b, c…

export function seatsFor(n: number, chars: [Zodiac, MBTI][] = DEFAULT_CHARS): Seat[] {
  return ids(n).map((id, i) => ({ playerId: id, nickname: id.toUpperCase(), seat: i, zodiac: chars[i % chars.length][0], mbti: chars[i % chars.length][1] }));
}

/** A run past the intro (everyone has boarded), at the start of round 1. */
export function newRun(n = 3, opts: { seed?: string; chars?: [Zodiac, MBTI][] } = {}): { state: GameState; now: number } {
  const created = createGame("g_test", seatsFor(n, opts.chars), opts.seed ?? SEED, T0);
  let now = T0;
  let step: Step = startGame(created, now);
  for (const id of step.state.turnOrder) step = applyGameAction(step.state, id, { type: "ACK_SEQUENCE" }, (now += 1000));
  return { state: step.state, now };
}

export class Table {
  state: GameState;
  now: number;
  constructor(n = 3, opts: { seed?: string; chars?: [Zodiac, MBTI][] } = {}) {
    const run = newRun(n, opts);
    this.state = run.state;
    this.now = run.now;
  }
  get active(): PlayerId | null {
    return activePlayerId(this.state);
  }
  act(actor: PlayerId, action: GameAction, advanceMs = 1000): Step {
    this.now += advanceMs;
    const step = applyGameAction(this.state, actor, action, this.now);
    this.state = step.state;
    return step;
  }
  tick(ms: number): Step {
    this.now += ms;
    const step = tickGame(this.state, this.now);
    this.state = step.state;
    return step;
  }
  /** Plays (ending turns, default answers, skipping cinematics) until `done` holds. */
  playUntil(done: (s: GameState) => boolean, answer?: string): void {
    for (let guard = 0; guard < 2000 && !done(this.state); guard++) {
      if (this.state.pending.length) this.answerAll(answer);
      else if (this.state.sequence) this.ackAll();
      else if (this.active) this.act(this.active, { type: "END_TURN" });
      else this.tick(1000);
    }
    if (!done(this.state)) throw new Error("condition never reached");
  }
  /** The host moves the table along one step (the only way past someone who doesn't answer). */
  skip(ms = 1000): Step {
    this.now += ms;
    const step = hostSkip(this.state, this.now);
    this.state = step.state;
    return step;
  }
  /** Everyone still watching the current scene presses Continue. */
  ackAll(): void {
    for (const id of this.state.turnOrder) {
      if (this.state.sequence && !this.state.sequence.acks.includes(id) && !this.state.players[id].away) this.act(id, { type: "ACK_SEQUENCE" });
    }
  }
  /** Answers the top window for everyone it's addressed to with the given option (or the default). */
  answerAll(option?: string): void {
    const w = this.state.pending.at(-1);
    if (!w) return;
    for (const id of w.addressees) {
      if (this.state.pending.at(-1)?.id !== w.id) break;
      this.act(id, { type: "RESPOND", windowId: w.id, optionId: option && w.options.some((o) => o.id === option) ? option : w.defaultOptionId });
    }
  }
}

/**
 * Rigs the generator so the next d6 rolls `value`, by searching for a
 * generator state whose next draw lands there. Tests use it to reach a
 * specific outcome without touching engine code.
 */
export function rigNextDie(state: GameState, value: number): void {
  for (let i = 1; i < 10_000; i++) {
    const probe = { rng: [i * 2654435761 >>> 0, i * 40503 + 7, i * 9973 + 11, i] as [number, number, number, number], rngCalls: 0 };
    const copy = { ...probe, rng: [...probe.rng] as [number, number, number, number] };
    if (1 + Math.floor(nextFloat(copy) * 6) === value) {
      state.rng = probe.rng;
      return;
    }
  }
  throw new Error("could not rig the die");
}
