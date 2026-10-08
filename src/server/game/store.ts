// Game sessions in SQLite. Every write is one transaction: the input goes into
// action_log and the resulting snapshot replaces state_json, so the stored
// state and its history can never disagree.
import { randomBytes } from "node:crypto";
import type { GameState, ScenarioId } from "../../shared/game/state.ts";
import { DEFAULT_SCENARIO } from "../../shared/game/scenarios.ts";
import type { Db } from "../db/db.ts";
import { createGame, type Seat } from "../engine/create.ts";
import { newSeed } from "../engine/rng.ts";

export type LogEntry = { kind: "START" | "ACTION" | "TICK" | "AWAY" | "BACK" | "SKIP"; actionId?: string; actorId?: string; action?: unknown; at: number };

export class GameStore {
  db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  /** Creates the session and points the room at it. Call inside the room's transaction. */
  create(roomCode: string, seats: Seat[], now: number, seed = newSeed(), scenarioId: ScenarioId = DEFAULT_SCENARIO): GameState {
    const id = "g_" + randomBytes(9).toString("base64url");
    const state = createGame(id, seats, seed, now, scenarioId);
    const json = JSON.stringify(state);
    this.db
      .prepare(
        `INSERT INTO game_sessions (id, room_code, scenario_id, seed, phase, version, initial_json, state_json, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, roomCode, state.scenarioId, seed, state.phase, state.version, json, json, now);
    this.db.prepare("UPDATE rooms SET current_session = ?, phase = ? WHERE code = ?").run(id, state.phase, roomCode);
    return state;
  }

  load(roomCode: string): GameState | null {
    const row = this.db
      .prepare("SELECT s.state_json FROM rooms r JOIN game_sessions s ON s.id = r.current_session WHERE r.code = ?")
      .get(roomCode) as { state_json: string } | undefined;
    return row ? (JSON.parse(row.state_json) as GameState) : null;
  }

  hasAction(sessionId: string, actionId: string): boolean {
    return !!this.db.prepare("SELECT 1 FROM action_log WHERE session_id = ? AND action_id = ?").get(sessionId, actionId);
  }

  /** Persists one input and its resulting state. Call inside a transaction. */
  save(roomCode: string, state: GameState, entry: LogEntry): void {
    const next = this.db.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM action_log WHERE session_id = ?").get(state.sessionId) as { seq: number };
    this.db
      .prepare("INSERT INTO action_log (session_id, seq, action_id, actor_id, kind, action_json, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(state.sessionId, next.seq, entry.actionId ?? null, entry.actorId ?? null, entry.kind, entry.action === undefined ? null : JSON.stringify(entry.action), entry.at);
    const ended = state.phase === "RESULTS" ? entry.at : null;
    this.db
      .prepare("UPDATE game_sessions SET state_json = ?, version = ?, phase = ?, outcome = ?, ended_at = COALESCE(ended_at, ?) WHERE id = ?")
      .run(JSON.stringify(state), state.version, state.phase, state.outcome, ended, state.sessionId);
    this.db.prepare("UPDATE rooms SET phase = ?, updated_at = ? WHERE code = ? AND current_session = ?").run(state.phase, entry.at, roomCode, state.sessionId);
  }

  /** Room codes with a run that still needs its timers (after a restart). */
  activeRooms(): string[] {
    return (
      this.db
        .prepare("SELECT r.code FROM rooms r JOIN game_sessions s ON s.id = r.current_session WHERE s.phase NOT IN ('RESULTS')")
        .all() as { code: string }[]
    ).map((r) => r.code);
  }

  /** Replay inputs, in order (tests and debugging). */
  history(sessionId: string): { initial: GameState; entries: LogEntry[] } {
    const s = this.db.prepare("SELECT initial_json FROM game_sessions WHERE id = ?").get(sessionId) as { initial_json: string };
    const rows = this.db
      .prepare("SELECT kind, action_id, actor_id, action_json, at FROM action_log WHERE session_id = ? ORDER BY seq")
      .all(sessionId) as { kind: LogEntry["kind"]; action_id: string | null; actor_id: string | null; action_json: string | null; at: number }[];
    return {
      initial: JSON.parse(s.initial_json),
      entries: rows.map((r) => ({ kind: r.kind, actionId: r.action_id ?? undefined, actorId: r.actor_id ?? undefined, action: r.action_json ? JSON.parse(r.action_json) : undefined, at: r.at })),
    };
  }
}
