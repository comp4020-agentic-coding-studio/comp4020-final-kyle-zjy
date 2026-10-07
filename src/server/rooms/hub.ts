// Live sockets per room. A socket proves who it is with HELLO (room code +
// session token); from then on every accepted change is answered with a fresh
// snapshot pushed to everyone in the room, each built for its own viewer, so
// one player's secrets never travel on another player's socket.
import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import type { PlayerId, RoomCode } from "../../shared/game/state.ts";
import type { ClientMessage, GameEvent, ServerMessage, Snapshot } from "../../shared/protocol.ts";
import { config } from "../config.ts";
import { RuleError } from "../engine/context.ts";
import { project } from "../engine/project.ts";
import type { GameRunner } from "../game/runner.ts";
import { log } from "../log.ts";
import { RoomError, normaliseCode, type RoomService } from "./service.ts";

const HEARTBEAT_MS = 20_000;
const HELLO_TIMEOUT_MS = 10_000;

/** Close codes the client acts on. */
export const CLOSE = { REPLACED: 4001, KICKED: 4002, UNAUTHORISED: 4003, LEFT: 4004 } as const;

type Alive = WebSocket & { isAlive?: boolean };

export class Hub {
  rooms: RoomService;
  games: GameRunner;
  private sockets = new Map<RoomCode, Map<PlayerId, WebSocket>>();
  private hostTimers = new Map<RoomCode, NodeJS.Timeout>();
  private heartbeat: NodeJS.Timeout;

  constructor(rooms: RoomService, games: GameRunner) {
    this.rooms = rooms;
    this.games = games;
    games.onChange = (code, events) => this.broadcast(code, events);
    this.heartbeat = setInterval(() => this.beat(), HEARTBEAT_MS);
    this.heartbeat.unref();
  }

  connected(code: RoomCode): Set<PlayerId> {
    return new Set(this.sockets.get(code)?.keys() ?? []);
  }

  connectionCount(): number {
    let n = 0;
    for (const room of this.sockets.values()) n += room.size;
    return n;
  }

  attach(ws: WebSocket, req: IncomingMessage): void {
    (ws as Alive).isAlive = true;
    ws.on("pong", () => ((ws as Alive).isAlive = true));
    let bound: { code: RoomCode; playerId: PlayerId } | null = null;
    const helloTimer = setTimeout(() => {
      if (!bound) ws.close(CLOSE.UNAUTHORISED, "no hello");
    }, HELLO_TIMEOUT_MS);

    ws.on("message", (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;
      if (msg.t === "PING") return send(ws, { t: "PONG" });

      if (msg.t === "HELLO") {
        try {
          const code = normaliseCode(String(msg.roomCode ?? ""));
          const playerId = this.rooms.authenticate(code, msg.sessionToken);
          clearTimeout(helloTimer);
          bound = { code, playerId };
          this.bind(code, playerId, ws);
          const snapshot = this.snapshot(code, playerId);
          if (snapshot) send(ws, { t: "WELCOME", playerId, snapshot });
          this.games.presence(code, playerId, true);
          this.broadcast(code);
          log.info("socket bound", { room: code, player: playerId, ip: req.socket.remoteAddress });
        } catch (err) {
          const message = err instanceof RoomError ? err.message : "Could not join the room.";
          send(ws, { t: "REJECTED", actionId: "hello", code: err instanceof RoomError ? err.code : "INVALID", message });
          ws.close(CLOSE.UNAUTHORISED, "unauthorised");
        }
        return;
      }

      if (!bound) return;
      const actionId = String((msg as { actionId?: unknown }).actionId ?? "");
      try {
        if (msg.t === "LOBBY_ACTION") {
          const outcome = this.rooms.applyLobbyAction(bound.code, bound.playerId, msg.action, this.connected(bound.code));
          send(ws, { t: "ACK", actionId });
          if (outcome.kicked) this.dropPlayer(bound.code, outcome.kicked, "KICKED");
          if (outcome.left) this.dropPlayer(bound.code, outcome.left, "LEFT");
          if (outcome.ended) this.games.drop(bound.code);
          if (outcome.started) this.games.started(bound.code);
          this.broadcast(bound.code);
          log.info("lobby action", { room: bound.code, player: bound.playerId, type: msg.action?.type });
        } else if (msg.t === "GAME_ACTION") {
          this.games.apply(bound.code, bound.playerId, actionId, msg.stateVersion, msg.action);
          send(ws, { t: "ACK", actionId });
        }
      } catch (err) {
        if (err instanceof RoomError || err instanceof RuleError) {
          send(ws, { t: "REJECTED", actionId, code: err.code, message: err.message });
        } else {
          log.error("action failed", { room: bound.code, player: bound.playerId, err: String(err), stack: (err as Error)?.stack?.split("\n").slice(0, 4).join(" | ") });
          send(ws, { t: "REJECTED", actionId, code: "INVALID", message: "Something went wrong." });
        }
      }
    });

    ws.on("close", () => {
      clearTimeout(helloTimer);
      if (!bound) return;
      const room = this.sockets.get(bound.code);
      // a replaced socket closing must not unseat its replacement
      if (room?.get(bound.playerId) !== ws) return;
      room.delete(bound.playerId);
      if (room.size === 0) this.sockets.delete(bound.code);
      this.armHostTimer(bound.code);
      this.games.presence(bound.code, bound.playerId, false);
      this.broadcast(bound.code);
    });
  }

  /** Push the current room to every socket in it, each with its own view. */
  broadcast(code: RoomCode, events: GameEvent[] = []): void {
    const room = this.sockets.get(code);
    // an empty room with a finished run lets it go from memory
    if (!room) return void this.games.evictIfIdle(code);
    for (const [playerId, ws] of room) {
      const snapshot = this.snapshot(code, playerId);
      if (snapshot) send(ws, { t: "STATE", snapshot, events });
    }
  }

  /** Runs held in memory (finished runs in empty rooms are let go). */
  runsInMemory(): number {
    return this.games.cached;
  }

  close(): void {
    clearInterval(this.heartbeat);
    for (const t of this.hostTimers.values()) clearTimeout(t);
    for (const room of this.sockets.values()) for (const ws of room.values()) ws.terminate();
  }

  private snapshot(code: RoomCode, viewerId: PlayerId): Snapshot | null {
    const room = this.rooms.roomState(code, this.connected(code));
    if (!room) return null;
    const game = room.phase !== "LOBBY" ? this.games.state(code) : null;
    return { room, game: game ? project(game, viewerId) : null, serverTime: Date.now() };
  }

  private bind(code: RoomCode, playerId: PlayerId, ws: WebSocket): void {
    let room = this.sockets.get(code);
    if (!room) this.sockets.set(code, (room = new Map()));
    const previous = room.get(playerId);
    room.set(playerId, ws);
    if (previous && previous !== ws) {
      send(previous, { t: "SESSION_REPLACED" });
      previous.close(CLOSE.REPLACED, "replaced");
    }
  }

  private dropPlayer(code: RoomCode, playerId: PlayerId, why: "KICKED" | "LEFT"): void {
    const room = this.sockets.get(code);
    const ws = room?.get(playerId);
    if (!room || !ws) return;
    room.delete(playerId);
    if (why === "KICKED") send(ws, { t: "KICKED" });
    ws.close(why === "KICKED" ? CLOSE.KICKED : CLOSE.LEFT, why.toLowerCase());
  }

  /** A host who drops gets a grace period (a refresh) before the crown moves. */
  private armHostTimer(code: RoomCode): void {
    clearTimeout(this.hostTimers.get(code));
    const timer = setTimeout(() => {
      this.hostTimers.delete(code);
      if (this.rooms.hostTimedOut(code, this.connected(code))) {
        log.info("host reassigned after disconnect", { room: code });
        this.broadcast(code);
      }
    }, config.hostGraceMs);
    timer.unref();
    this.hostTimers.set(code, timer);
  }

  private beat(): void {
    for (const room of this.sockets.values()) {
      for (const ws of room.values()) {
        const alive = ws as Alive;
        if (!alive.isAlive) {
          ws.terminate();
          continue;
        }
        alive.isAlive = false;
        ws.ping();
      }
    }
  }
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}
