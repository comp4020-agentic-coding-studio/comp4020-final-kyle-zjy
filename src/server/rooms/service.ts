// Rooms, seats and the lobby. Every public method is synchronous and wraps its
// writes in one transaction, so two requests can never interleave between the
// "is there room?" check and the insert (docs/architecture.md §4).
import { createHash, randomBytes, randomInt } from "node:crypto";
import { MBTIS, ZODIACS, type MBTI, type Zodiac } from "../../shared/characters/types.ts";
import type { LobbyAction, RejectCode } from "../../shared/game/actions.ts";
import { isScenarioId, SCENARIOS } from "../../shared/game/scenarios.ts";
import type { GamePhase, Member, MemberStage, PlayerId, RoomCode, RoomState, ScenarioId } from "../../shared/game/state.ts";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type JoinResponse,
} from "../../shared/protocol.ts";
import { transaction, type Db } from "../db/db.ts";
import type { GameStore } from "../game/store.ts";
import { en } from "../../shared/i18n/format.ts";
import { m } from "../../shared/i18n/msg.ts";
import type { Msg } from "../../shared/i18n/types.ts";

export class RoomError extends Error {
  code: RejectCode;
  status: 400 | 403 | 404 | 409;
  /** Why, for each client to render in its own locale (`message` is the English). */
  msg: Msg;
  constructor(code: RejectCode, msg: Msg, status: 400 | 403 | 404 | 409 = 400) {
    super(en(msg));
    this.code = code;
    this.msg = msg;
    this.status = status;
  }
}

type MemberRow = {
  player_id: string;
  seat: number;
  nickname: string;
  stage: MemberStage;
  zodiac: Zodiac | null;
  mbti: MBTI | null;
};

type RoomRow = {
  code: string;
  host_player_id: string | null;
  scenario_id: ScenarioId;
  phase: GamePhase;
  version: number;
  closed_at: number | null;
};

/** What the hub must do after a lobby action besides broadcasting. */
export type LobbyOutcome = { kicked?: PlayerId; left?: PlayerId; started?: boolean; ended?: boolean; skip?: boolean };

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export function normaliseCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normaliseNickname(input: unknown): string {
  if (typeof input !== "string") throw new RoomError("INVALID", m`Enter a nickname.`);
  // strip control characters, collapse whitespace
  const name = input.replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim();
  if (name.length < 1) throw new RoomError("INVALID", m`Enter a nickname.`);
  if ([...name].length > 16) throw new RoomError("INVALID", m`Nicknames are at most 16 characters.`);
  return name;
}

export class RoomService {
  db: Db;
  games: GameStore | null;
  /** Draws room-code letters; tests replace it to force collisions. */
  random: (n: number) => number;
  constructor(db: Db, games: GameStore | null = null, random: (n: number) => number = randomInt) {
    this.db = db;
    this.games = games;
    this.random = random;
  }

  // ---- identity -------------------------------------------------------------

  /** Reuses the player behind a valid token, or mints a new anonymous one. */
  private identify(token: unknown): { playerId: string; sessionToken: string } {
    const now = Date.now();
    if (typeof token === "string" && token.length >= 32) {
      const row = this.db.prepare("SELECT id FROM players WHERE session_token_hash = ?").get(hashToken(token));
      if (row) {
        this.db.prepare("UPDATE players SET last_seen_at = ? WHERE id = ?").run(now, row.id as string);
        return { playerId: row.id as string, sessionToken: token };
      }
    }
    const playerId = "p_" + randomBytes(10).toString("base64url");
    const sessionToken = randomBytes(32).toString("base64url");
    this.db
      .prepare("INSERT INTO players (id, session_token_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?)")
      .run(playerId, hashToken(sessionToken), now, now);
    return { playerId, sessionToken };
  }

  /** The seated member a socket's token belongs to, or an error. */
  authenticate(rawCode: string, token: unknown): PlayerId {
    const code = normaliseCode(rawCode);
    if (typeof token !== "string") throw new RoomError("NOT_IN_ROOM", m`Missing session.`, 403);
    const room = this.room(code);
    if (!room) throw new RoomError("ROOM_NOT_FOUND", m`That room doesn't exist.`, 404);
    const row = this.db
      .prepare(
        `SELECT m.player_id FROM room_members m JOIN players p ON p.id = m.player_id
         WHERE m.room_code = ? AND p.session_token_hash = ? AND m.left_at IS NULL`,
      )
      .get(code, hashToken(token));
    if (!row) throw new RoomError("NOT_IN_ROOM", m`You're not seated in this room.`, 403);
    this.db.prepare("UPDATE players SET last_seen_at = ? WHERE id = ?").run(Date.now(), row.player_id as string);
    return row.player_id as string;
  }

  // ---- create / join --------------------------------------------------------

  createRoom(rawNickname: unknown, token: unknown): JoinResponse {
    const nickname = normaliseNickname(rawNickname);
    return transaction(this.db, () => {
      const who = this.identify(token);
      const now = Date.now();
      let code = "";
      for (let attempt = 0; ; attempt++) {
        code = Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[this.random(ROOM_CODE_ALPHABET.length)]).join("");
        if (!this.room(code)) break;
        if (attempt > 20) throw new Error("could not allocate a room code");
      }
      this.db
        .prepare("INSERT INTO rooms (code, host_player_id, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .run(code, who.playerId, now, now);
      this.db
        .prepare("INSERT INTO room_members (room_code, player_id, seat, nickname, joined_at) VALUES (?, ?, 0, ?, ?)")
        .run(code, who.playerId, nickname, now);
      return { roomCode: code, ...who };
    });
  }

  /**
   * Joining with the token of someone already seated returns that seat (a
   * refresh or a second tab never creates a second player). New players get
   * the lowest free seat, while the room is in its lobby and under the cap.
   */
  joinRoom(rawCode: string, rawNickname: unknown, token: unknown): JoinResponse {
    const code = normaliseCode(rawCode);
    return transaction(this.db, () => {
      const room = this.room(code);
      if (!room || room.closed_at) throw new RoomError("ROOM_NOT_FOUND", m`That room doesn't exist.`, 404);
      const who = this.identify(token);
      const existing = this.db
        .prepare("SELECT left_at, kicked FROM room_members WHERE room_code = ? AND player_id = ?")
        .get(code, who.playerId) as { left_at: number | null; kicked: number } | undefined;
      if (existing?.kicked) throw new RoomError("NOT_IN_ROOM", m`The host removed you from this room.`, 403);
      if (existing && existing.left_at === null) return { roomCode: code, ...who };

      const nickname = normaliseNickname(rawNickname);
      if (room.phase !== "LOBBY") throw new RoomError("GAME_IN_PROGRESS", m`That room has already started.`, 409);
      const members = this.members(code);
      if (members.length >= MAX_PLAYERS) throw new RoomError("ROOM_FULL", m`That room is full (${MAX_PLAYERS} players).`, 409);
      if (members.some((m) => m.nickname.toLowerCase() === nickname.toLowerCase())) {
        throw new RoomError("NICKNAME_TAKEN", m`Someone in that room already uses that nickname.`, 409);
      }
      const taken = new Set(members.map((m) => m.seat));
      const seat = [...Array(MAX_PLAYERS).keys()].find((s) => !taken.has(s))!;
      const now = Date.now();
      if (existing) {
        this.db
          .prepare(
            `UPDATE room_members SET seat = ?, nickname = ?, stage = 'JOINED', zodiac = NULL, mbti = NULL,
             joined_at = ?, left_at = NULL WHERE room_code = ? AND player_id = ?`,
          )
          .run(seat, nickname, now, code, who.playerId);
      } else {
        this.db
          .prepare("INSERT INTO room_members (room_code, player_id, seat, nickname, joined_at) VALUES (?, ?, ?, ?, ?)")
          .run(code, who.playerId, seat, nickname, now);
      }
      if (!room.host_player_id) this.db.prepare("UPDATE rooms SET host_player_id = ? WHERE code = ?").run(who.playerId, code);
      this.touch(code);
      return { roomCode: code, ...who };
    });
  }

  roomExists(rawCode: string): { code: string; phase: GamePhase; players: number } | null {
    const code = normaliseCode(rawCode);
    const room = this.room(code);
    if (!room || room.closed_at) return null;
    return { code, phase: room.phase, players: this.members(code).length };
  }

  // ---- lobby ----------------------------------------------------------------

  applyLobbyAction(rawCode: string, actor: PlayerId, action: LobbyAction, connected: Set<PlayerId>): LobbyOutcome {
    const code = normaliseCode(rawCode);
    return transaction(this.db, () => {
      const room = this.room(code);
      if (!room) throw new RoomError("ROOM_NOT_FOUND", m`That room doesn't exist.`, 404);
      const members = this.members(code);
      const me = members.find((m) => m.player_id === actor);
      if (!me) throw new RoomError("NOT_IN_ROOM", m`You're not seated in this room.`, 403);
      const isHost = room.host_player_id === actor;
      const inLobby = room.phase === "LOBBY";
      const requireLobby = () => {
        if (!inLobby) throw new RoomError("WRONG_PHASE", m`That's only possible in the lobby.`);
      };
      const requireHost = () => {
        if (!isHost) throw new RoomError("NOT_HOST", m`Only the host can do that.`, 403);
      };
      const setMember = (sql: string, ...args: (string | number | null)[]) =>
        this.db.prepare(`UPDATE room_members SET ${sql} WHERE room_code = ? AND player_id = ?`).run(...args, code, actor);
      let outcome: LobbyOutcome = {};

      switch (action.type) {
        case "SET_NICKNAME": {
          requireLobby();
          const nickname = normaliseNickname(action.nickname);
          if (members.some((m) => m.player_id !== actor && m.nickname.toLowerCase() === nickname.toLowerCase())) {
            throw new RoomError("NICKNAME_TAKEN", m`Someone here already uses that nickname.`, 409);
          }
          setMember("nickname = ?", nickname);
          break;
        }
        case "PICK_ZODIAC": {
          requireLobby();
          if (!ZODIACS.includes(action.zodiac)) throw new RoomError("INVALID", m`Unknown zodiac sign.`);
          // a new sign starts the pick over: MBTI is chosen against the sign
          setMember("zodiac = ?, mbti = NULL, stage = 'ZODIAC_CHOSEN'", action.zodiac);
          break;
        }
        case "PICK_MBTI": {
          requireLobby();
          if (!MBTIS.includes(action.mbti)) throw new RoomError("INVALID", m`Unknown MBTI type.`);
          if (!me.zodiac) throw new RoomError("INVALID", m`Choose a zodiac sign first.`);
          setMember("mbti = ?, stage = 'REVEALED'", action.mbti);
          break;
        }
        case "SET_READY": {
          requireLobby();
          if (action.ready && (!me.zodiac || !me.mbti)) {
            throw new RoomError("INVALID", m`Choose your sign and type before readying up.`);
          }
          setMember("stage = ?", action.ready ? "READY" : me.zodiac && me.mbti ? "REVEALED" : me.stage);
          break;
        }
        case "KICK": {
          requireLobby();
          requireHost();
          if (action.playerId === actor) throw new RoomError("ILLEGAL_TARGET", m`You can't remove yourself; leave instead.`);
          if (!members.some((m) => m.player_id === action.playerId)) {
            throw new RoomError("ILLEGAL_TARGET", m`That player isn't in the room.`);
          }
          this.db
            .prepare("UPDATE room_members SET left_at = ?, kicked = 1 WHERE room_code = ? AND player_id = ?")
            .run(Date.now(), code, action.playerId);
          outcome = { kicked: action.playerId };
          break;
        }
        case "SELECT_SCENARIO": {
          requireLobby();
          requireHost();
          if (!isScenarioId(action.scenarioId) || !SCENARIOS[action.scenarioId].open) throw new RoomError("INVALID", m`That scenario isn't open yet.`);
          this.db.prepare("UPDATE rooms SET scenario_id = ? WHERE code = ?").run(action.scenarioId, code);
          break;
        }
        case "START_GAME": {
          requireLobby();
          requireHost();
          if (members.length < MIN_PLAYERS) {
            throw new RoomError("NOT_ENOUGH_PLAYERS", m`At least ${MIN_PLAYERS} players are needed to start.`);
          }
          if (members.some((m) => m.stage !== "READY" || !m.zodiac || !m.mbti)) throw new RoomError("NOT_ALL_READY", m`Everyone has to be ready first.`);
          if (!this.games) throw new RoomError("INVALID", m`Runs can't start on this server.`);
          // the run is created in this same transaction: a room is never "started" without one
          this.games.create(
            code,
            members.map((m) => ({ playerId: m.player_id, nickname: m.nickname, seat: m.seat, zodiac: m.zodiac!, mbti: m.mbti! })),
            Date.now(),
            undefined,
            room.scenario_id,
          );
          outcome = { started: true };
          break;
        }
        case "SKIP_WAITING": {
          requireHost();
          if (inLobby) throw new RoomError("WRONG_PHASE", m`There's nothing to skip in the lobby.`);
          outcome = { skip: true };
          break;
        }
        case "BACK_TO_LOBBY":
        case "RESTART": {
          requireHost();
          if (inLobby) throw new RoomError("WRONG_PHASE", m`The room is already in the lobby.`);
          this.db.prepare("UPDATE game_sessions SET ended_at = COALESCE(ended_at, ?) WHERE id = (SELECT current_session FROM rooms WHERE code = ?)").run(Date.now(), code);
          this.db.prepare("UPDATE rooms SET phase = 'LOBBY', current_session = NULL WHERE code = ?").run(code);
          outcome = { ended: true };
          // characters are kept; everyone confirms again before the next run
          this.db.prepare("UPDATE room_members SET stage = 'REVEALED' WHERE room_code = ? AND stage = 'READY'").run(code);
          break;
        }
        case "LEAVE": {
          if (!inLobby) throw new RoomError("WRONG_PHASE", m`You can't leave a run in progress; it keeps your seat.`);
          setMember("left_at = ?", Date.now());
          outcome = { left: actor };
          break;
        }
        default:
          throw new RoomError("INVALID", m`Unknown action.`);
      }

      if (outcome.kicked || outcome.left) this.reassignHostIfNeeded(code, connected);
      this.touch(code);
      return outcome;
    });
  }

  /**
   * Passes the crown to the next seat (after the host's) that is connected —
   * or, if nobody is, to the next seat at all. Returns true if it changed.
   */
  reassignHostIfNeeded(code: RoomCode, connected: Set<PlayerId>, hostIsGone = false): boolean {
    const room = this.room(code);
    if (!room) return false;
    const members = this.members(code);
    if (members.length === 0) {
      this.db.prepare("UPDATE rooms SET host_player_id = NULL, closed_at = ? WHERE code = ?").run(Date.now(), code);
      return true;
    }
    const host = members.find((m) => m.player_id === room.host_player_id);
    if (host && !hostIsGone) return false;
    const after = host ? host.seat : -1;
    const ordered = [...members].sort((a, b) => ((a.seat - after + 10) % 10) - ((b.seat - after + 10) % 10));
    const candidates = ordered.filter((m) => m.player_id !== room.host_player_id);
    const next = candidates.find((m) => connected.has(m.player_id)) ?? candidates[0];
    if (!next) return false;
    this.db.prepare("UPDATE rooms SET host_player_id = ? WHERE code = ?").run(next.player_id, code);
    this.touch(code);
    return true;
  }

  /** Called when a disconnected host's grace period runs out. */
  hostTimedOut(code: RoomCode, connected: Set<PlayerId>): boolean {
    return transaction(this.db, () => {
      const room = this.room(code);
      if (!room?.host_player_id || connected.has(room.host_player_id)) return false;
      const others = this.members(code).filter((m) => m.player_id !== room.host_player_id);
      if (!others.some((m) => connected.has(m.player_id))) return false;
      return this.reassignHostIfNeeded(code, connected, true);
    });
  }

  // ---- reads ----------------------------------------------------------------

  roomState(rawCode: string, connected: Set<PlayerId>): RoomState | null {
    const code = normaliseCode(rawCode);
    const room = this.room(code);
    if (!room) return null;
    const members: Member[] = this.members(code).map((m) => ({
      playerId: m.player_id,
      seat: m.seat,
      nickname: m.nickname,
      stage: m.stage,
      zodiac: m.zodiac,
      mbti: m.mbti,
      connected: connected.has(m.player_id),
      isHost: m.player_id === room.host_player_id,
    }));
    return { code, phase: room.phase, scenarioId: room.scenario_id, members, version: room.version };
  }

  sweep(ttlMs: number): number {
    const cutoff = Date.now() - ttlMs;
    const result = this.db
      .prepare("DELETE FROM rooms WHERE updated_at < ? OR (closed_at IS NOT NULL AND closed_at < ?)")
      .run(cutoff, Date.now() - 24 * 60 * 60 * 1000);
    return Number(result.changes);
  }

  private room(code: string): RoomRow | undefined {
    return this.db.prepare("SELECT code, host_player_id, scenario_id, phase, version, closed_at FROM rooms WHERE code = ?").get(code) as
      | RoomRow
      | undefined;
  }

  private members(code: string): MemberRow[] {
    return this.db
      .prepare(
        "SELECT player_id, seat, nickname, stage, zodiac, mbti FROM room_members WHERE room_code = ? AND left_at IS NULL ORDER BY seat",
      )
      .all(code) as MemberRow[];
  }

  private touch(code: string): void {
    this.db.prepare("UPDATE rooms SET version = version + 1, updated_at = ? WHERE code = ?").run(Date.now(), code);
  }
}
