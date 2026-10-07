// Runs the games: applies inputs through the pure engine, persists each result
// in one transaction, and keeps one timer per room for the next deadline
// (window, turn or cinematic). Node runs this on one thread and every method
// is synchronous from read to write, so inputs for a room are applied strictly
// one at a time: two players pressing the same button produce two inputs, and
// the second is judged against the state the first left behind.
import type { GameAction } from "../../shared/game/actions.ts";
import type { GameState, PlayerId } from "../../shared/game/state.ts";
import type { GameEvent } from "../../shared/protocol.ts";
import { transaction, type Db } from "../db/db.ts";
import { RuleError } from "../engine/context.ts";
import { TURN_ACTIONS } from "../engine/actions.ts";
import { applyGameAction, setAway, startGame, tickGame, type Step } from "../engine/engine.ts";
import { nextDeadline } from "../engine/flow.ts";
import { log } from "../log.ts";
import type { GameStore, LogEntry } from "./store.ts";

/** Actions judged against what the player saw: a stale view is refused, not guessed at. */
const VERSIONED = new Set<GameAction["type"]>(["USE_SKILL", "USE_ITEM", "TRADE"]);

export class GameRunner {
  db: Db;
  store: GameStore;
  onChange: (roomCode: string, events: GameEvent[]) => void = () => {};
  private cache = new Map<string, GameState>();
  private timers = new Map<string, NodeJS.Timeout>();
  private clock: () => number;

  constructor(db: Db, store: GameStore, clock: () => number = Date.now) {
    this.db = db;
    this.store = store;
    this.clock = clock;
  }

  state(roomCode: string): GameState | null {
    const cached = this.cache.get(roomCode);
    if (cached) return cached;
    const loaded = this.store.load(roomCode);
    if (loaded) this.cache.set(roomCode, loaded);
    return loaded;
  }

  /** The room's run was just created (inside the lobby's START transaction). */
  started(roomCode: string): void {
    const state = this.store.load(roomCode);
    if (!state) return;
    this.cache.set(roomCode, state);
    this.commit(roomCode, startGame(state, this.clock()), { kind: "START", at: this.clock() });
  }

  apply(roomCode: string, actorId: PlayerId, actionId: string, stateVersion: unknown, action: GameAction): { duplicate: boolean } {
    const state = this.state(roomCode);
    if (!state) throw new RuleError("WRONG_PHASE", "No run is in progress in this room.");
    if (typeof actionId !== "string" || !actionId || actionId.length > 64) throw new RuleError("INVALID", "Missing action id.");
    if (this.store.hasAction(state.sessionId, actionId)) return { duplicate: true };
    if (action && VERSIONED.has(action.type) && stateVersion !== state.version) {
      throw new RuleError("STALE_VERSION", "The table changed while you were deciding. Take another look and try again.");
    }
    // a turn action pressed before this turn began (a double tap, a slow link) mustn't spend the new turn
    if (action && TURN_ACTIONS.includes(action.type) && !(typeof stateVersion === "number" && stateVersion >= state.turnVersion)) {
      throw new RuleError("STALE_VERSION", "That was pressed before this turn began. Take a look and try again.");
    }
    const now = this.clock();
    const step = applyGameAction(state, actorId, action, now);
    this.commit(roomCode, step, { kind: "ACTION", actionId, actorId, action, at: now });
    return { duplicate: false };
  }

  presence(roomCode: string, playerId: PlayerId, connected: boolean): void {
    const state = this.state(roomCode);
    const p = state?.players[playerId];
    if (!state || !p || p.away === !connected || state.phase === "RESULTS") return;
    const now = this.clock();
    this.commit(roomCode, setAway(state, playerId, !connected, now), { kind: connected ? "BACK" : "AWAY", actorId: playerId, at: now });
  }

  tick(roomCode: string): void {
    this.timers.delete(roomCode);
    const state = this.state(roomCode);
    if (!state || state.phase === "RESULTS") return;
    const now = this.clock();
    const step = tickGame(state, now);
    this.commit(roomCode, step, { kind: "TICK", at: now });
  }

  /**
   * Nobody is connected to the room any more: a finished run leaves memory
   * (it stays in the database and reloads if anyone comes back). A run still
   * in progress stays, so its timers can carry it to the end.
   */
  evictIfIdle(roomCode: string): boolean {
    const state = this.cache.get(roomCode);
    if (!state || state.phase !== "RESULTS") return false;
    this.drop(roomCode);
    return true;
  }

  /** How many runs are held in memory (for health checks and tests). */
  get cached(): number {
    return this.cache.size;
  }

  /** The room went back to its lobby: forget the run (it stays in the database). */
  drop(roomCode: string): void {
    clearTimeout(this.timers.get(roomCode));
    this.timers.delete(roomCode);
    this.cache.delete(roomCode);
  }

  /** After a restart: re-arm timers for every run still in progress. */
  resumeAll(): number {
    const rooms = this.store.activeRooms();
    for (const code of rooms) {
      const state = this.state(code);
      if (state) this.schedule(code, state);
    }
    return rooms.length;
  }

  close(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  private commit(roomCode: string, step: Step, entry: LogEntry): void {
    transaction(this.db, () => this.store.save(roomCode, step.state, entry));
    this.cache.set(roomCode, step.state);
    this.schedule(roomCode, step.state);
    this.onChange(roomCode, step.events);
  }

  private schedule(roomCode: string, state: GameState): void {
    clearTimeout(this.timers.get(roomCode));
    this.timers.delete(roomCode);
    if (state.phase === "RESULTS") return;
    const at = nextDeadline(state);
    if (at === null) return;
    const timer = setTimeout(() => {
      try {
        this.tick(roomCode);
      } catch (err) {
        log.error("game tick failed", { room: roomCode, err: String(err) });
      }
    }, Math.max(0, at - this.clock()) + 25);
    timer.unref();
    this.timers.set(roomCode, timer);
  }
}
