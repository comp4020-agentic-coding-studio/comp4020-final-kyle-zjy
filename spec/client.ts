// WebSocket + HTTP client for spec tests, talking to the running app.
import { inject } from "vitest";
import type { GameAction, LobbyAction } from "../src/shared/game/actions.ts";
import type { JoinResponse, ServerMessage, Snapshot } from "../src/shared/protocol.ts";

export const baseUrl = inject("baseUrl");
const wsUrl = new URL("/ws", baseUrl.replace(/^http/, "ws")).toString();
export const PUSH_MS = 1000;

export async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

export const create = async (nickname: string): Promise<JoinResponse> => (await post("/api/rooms", { nickname })).json;
export const join = (code: string, nickname: string, sessionToken?: string) =>
  post(`/api/rooms/${code}/join`, { nickname, sessionToken });

export type Client = {
  ws: WebSocket;
  messages: ServerMessage[];
  next: (match: (m: ServerMessage) => boolean, ms?: number) => Promise<ServerMessage>;
  snapshot: (match: (s: Snapshot) => boolean, ms?: number) => Promise<Snapshot>;
  act: (action: LobbyAction) => Promise<ServerMessage>;
  play: (action: GameAction, opts?: { actionId?: string; stateVersion?: number }) => Promise<ServerMessage>;
  /** Every message received, kept for secrecy checks. */
  all: ServerMessage[];
  closed: Promise<number>;
};

let actionSeq = 0;

export function connect(roomCode: string, sessionToken: string): Promise<Client> {
  const ws = new WebSocket(wsUrl);
  const messages: ServerMessage[] = [];
  const all: ServerMessage[] = [];
  const waiters: { match: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
  // like the real client, actions carry the version of the last game state seen
  let seenVersion = 0;
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(String(e.data)) as ServerMessage;
    if ((msg.t === "STATE" || msg.t === "WELCOME") && msg.snapshot.game) seenVersion = msg.snapshot.game.version;
    messages.push(msg);
    all.push(msg);
    for (const w of [...waiters]) {
      if (w.match(msg)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(msg);
      }
    }
  });
  const next = (match: (m: ServerMessage) => boolean, ms = PUSH_MS) =>
    new Promise<ServerMessage>((resolve, reject) => {
      const seen = messages.find(match);
      if (seen) {
        messages.splice(messages.indexOf(seen), 1);
        return resolve(seen);
      }
      const timer = setTimeout(() => reject(new Error(`no matching message within ${ms}ms`)), ms);
      waiters.push({
        match,
        resolve: (m) => {
          clearTimeout(timer);
          messages.splice(messages.indexOf(m), 1);
          resolve(m);
        },
      });
    });
  const snapshot = async (match: (s: Snapshot) => boolean, ms = PUSH_MS) => {
    const m = await next((m) => (m.t === "STATE" || m.t === "WELCOME") && match(m.snapshot), ms);
    return (m as Extract<ServerMessage, { snapshot: Snapshot }>).snapshot;
  };
  const act = (action: LobbyAction) => {
    const actionId = `a${++actionSeq}`;
    ws.send(JSON.stringify({ t: "LOBBY_ACTION", actionId, action }));
    return next((m) => (m.t === "ACK" || m.t === "REJECTED") && m.actionId === actionId);
  };
  const play = (action: GameAction, opts: { actionId?: string; stateVersion?: number } = {}) => {
    const actionId = opts.actionId ?? `g${++actionSeq}`;
    ws.send(JSON.stringify({ t: "GAME_ACTION", actionId, stateVersion: opts.stateVersion ?? seenVersion, action }));
    return next((m) => (m.t === "ACK" || m.t === "REJECTED") && m.actionId === actionId);
  };
  const closed = new Promise<number>((resolve) => ws.addEventListener("close", (e) => resolve(e.code)));
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ t: "HELLO", roomCode, sessionToken }));
      resolve({ ws, messages, next, snapshot, act, play, all, closed });
    });
    ws.addEventListener("error", () => reject(new Error("socket error")));
  });
}

export const welcome = async (c: Client) => (await c.next((m) => m.t === "WELCOME")) as Extract<ServerMessage, { t: "WELCOME" }>;

