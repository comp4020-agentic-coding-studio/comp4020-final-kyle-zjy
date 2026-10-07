import type { Msg } from "./i18n/types.ts";
// WebSocket messages on /ws. The server always sends whole projected snapshots
// (small at ≤ 10 players), so a missed message is fixed by the next one.
import type { GameAction, LobbyAction, RejectCode } from "./game/actions.ts";
import type { PlayerId, PlayerView, RoomCode, RoomState } from "./game/state.ts";

export type ClientMessage =
  | { t: "HELLO"; roomCode: RoomCode; sessionToken: string }
  | { t: "LOBBY_ACTION"; actionId: string; action: LobbyAction }
  | { t: "GAME_ACTION"; actionId: string; stateVersion: number; action: GameAction }
  | { t: "PING" };

export type Snapshot = {
  room: RoomState;
  /** Present once a game session exists. */
  game: PlayerView | null;
  serverTime: number;
};

/** Short-lived cues the client turns into animations and log entries. */
export type GameEvent = {
  seq: number;
  kind: string;
  payload: Record<string, unknown>;
};

export type ServerMessage =
  | { t: "WELCOME"; playerId: PlayerId; snapshot: Snapshot }
  | { t: "STATE"; snapshot: Snapshot; events: GameEvent[] }
  | { t: "ACK"; actionId: string }
  | { t: "REJECTED"; actionId: string; code: RejectCode; message: string; msg?: Msg }
  | { t: "SESSION_REPLACED" }
  | { t: "KICKED" }
  | { t: "ROOM_CLOSED" }
  | { t: "PONG" };

/** HTTP: POST /api/rooms and POST /api/rooms/:code/join. */
export type JoinResponse = {
  roomCode: RoomCode;
  playerId: PlayerId;
  sessionToken: string;
};

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
