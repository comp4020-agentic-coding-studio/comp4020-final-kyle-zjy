// The client's whole picture of the room: the latest server snapshot plus the
// socket's status. Components never edit room data; they send intents through
// `sendLobby` and wait for the next snapshot.
import { create } from "zustand";
import type { GameAction, LobbyAction } from "../shared/game/actions.ts";
import type { Member } from "../shared/game/state.ts";
import type { GameEvent, ServerMessage, Snapshot } from "../shared/protocol.ts";
import { session } from "./net/session.ts";

export type ConnStatus =
  | "idle"
  | "connecting"
  | "online"
  | "reconnecting"
  | "needs-join" // our token isn't seated here: show the join form
  | "kicked"
  | "replaced"
  | "left"
  | "missing";

type Toast = { id: number; text: string; tone: "info" | "error" };

/** A server cue, stamped so animations can tell new ones from old ones. */
export type Cue = GameEvent & { key: string; at: number };

type State = {
  status: ConnStatus;
  roomCode: string | null;
  playerId: string | null;
  snapshot: Snapshot | null;
  cues: Cue[];
  /** Server clock minus local clock, for countdowns. */
  skew: number;
  toasts: Toast[];
  toast: (text: string, tone?: Toast["tone"]) => void;
};

export const useStore = create<State>((set) => ({
  status: "idle",
  roomCode: null,
  playerId: null,
  snapshot: null,
  cues: [],
  skew: 0,
  toasts: [],
  toast: (text, tone = "info") => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
  },
}));

export const useMe = (): Member | null =>
  useStore((s) => s.snapshot?.room.members.find((m) => m.playerId === s.playerId) ?? null);

// ---- socket ----------------------------------------------------------------

const CLOSE_REPLACED = 4001;
const CLOSE_KICKED = 4002;
const CLOSE_UNAUTHORISED = 4003;
const CLOSE_LEFT = 4004;

let ws: WebSocket | null = null;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let wanted: string | null = null;
let seq = 0;
const pending = new Map<string, (ok: boolean) => void>();

export function connectRoom(code: string): void {
  wanted = code;
  retry = 0;
  useStore.setState({ roomCode: code, status: "connecting", snapshot: null, playerId: null });
  open();
}

export function disconnectRoom(): void {
  wanted = null;
  clearTimeout(retryTimer);
  ws?.close(1000);
  ws = null;
  useStore.setState({ status: "idle", roomCode: null, snapshot: null, playerId: null });
}

function open(): void {
  const code = wanted;
  const token = session.token();
  if (!code) return;
  if (!token) return useStore.setState({ status: "needs-join" });
  clearTimeout(retryTimer);
  ws?.close(1000);
  const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
  ws = socket;
  socket.onopen = () => socket.send(JSON.stringify({ t: "HELLO", roomCode: code, sessionToken: token }));
  socket.onmessage = (e) => handle(JSON.parse(String(e.data)) as ServerMessage);
  socket.onclose = (e) => {
    if (ws !== socket) return;
    ws = null;
    for (const done of pending.values()) done(false);
    pending.clear();
    if (!wanted) return;
    if (e.code === CLOSE_REPLACED) return useStore.setState({ status: "replaced" });
    if (e.code === CLOSE_KICKED) {
      session.setLastRoom(null);
      return useStore.setState({ status: "kicked" });
    }
    if (e.code === CLOSE_LEFT) {
      session.setLastRoom(null);
      return useStore.setState({ status: "left" });
    }
    if (e.code === CLOSE_UNAUTHORISED) return; // REJECTED already set the status
    useStore.setState({ status: "reconnecting" });
    const delay = Math.min(8000, 500 * 2 ** retry++);
    retryTimer = setTimeout(open, delay);
  };
}

/** Re-open after "opened in another tab" or a manual retry. */
export const reconnect = (): void => {
  retry = 0;
  useStore.setState({ status: "connecting" });
  open();
};

function handle(msg: ServerMessage): void {
  switch (msg.t) {
    case "WELCOME":
      retry = 0;
      session.setLastRoom(msg.snapshot.room.code);
      useStore.setState({ status: "online", playerId: msg.playerId, snapshot: msg.snapshot, skew: msg.snapshot.serverTime - Date.now() });
      break;
    case "STATE": {
      const at = Date.now();
      const fresh = msg.events.map((e, i) => ({ ...e, key: `${msg.snapshot.game?.version ?? 0}-${i}`, at }));
      useStore.setState((s) => ({
        snapshot: msg.snapshot,
        skew: msg.snapshot.serverTime - at,
        cues: fresh.length ? [...s.cues, ...fresh].slice(-40) : s.cues,
      }));
      break;
    }
    case "ACK":
      pending.get(msg.actionId)?.(true);
      pending.delete(msg.actionId);
      break;
    case "REJECTED":
      if (msg.actionId === "hello") {
        useStore.setState({ status: msg.code === "ROOM_NOT_FOUND" ? "missing" : "needs-join" });
        break;
      }
      useStore.getState().toast(msg.message, "error");
      pending.get(msg.actionId)?.(false);
      pending.delete(msg.actionId);
      break;
    case "KICKED":
    case "SESSION_REPLACED":
    case "ROOM_CLOSED":
    case "PONG":
      break;
  }
}

function sendIntent(message: (actionId: string) => object): Promise<boolean> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    useStore.getState().toast("Reconnecting… try again in a moment.", "error");
    return Promise.resolve(false);
  }
  const actionId = `c${Date.now().toString(36)}${(++seq).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  ws.send(JSON.stringify(message(actionId)));
  return new Promise((resolve) => pending.set(actionId, resolve));
}

/** Sends a lobby intent; resolves true on ACK, false on rejection or drop. */
export const sendLobby = (action: LobbyAction): Promise<boolean> => sendIntent((actionId) => ({ t: "LOBBY_ACTION", actionId, action }));

/** Sends a game intent, stamped with the state version the player is looking at. */
export const sendGame = (action: GameAction): Promise<boolean> =>
  sendIntent((actionId) => ({ t: "GAME_ACTION", actionId, stateVersion: useStore.getState().snapshot?.game?.version ?? 0, action }));

export const useGame = () => useStore((s) => s.snapshot?.game ?? null);
