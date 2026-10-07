import type { JoinResponse } from "../../shared/protocol.ts";
import { session } from "./session.ts";

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { "content-type": "application/json" } });
  } catch {
    throw new ApiError("NETWORK", "Can't reach the station. Check your connection and try again.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.code ?? "INVALID", json.message ?? "Something went wrong.");
  return json as T;
}

const remember = (r: JoinResponse): JoinResponse => {
  session.setToken(r.sessionToken);
  session.setLastRoom(r.roomCode);
  return r;
};

export const api = {
  createRoom: async (nickname: string) =>
    remember(
      await call<JoinResponse>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ nickname, sessionToken: session.token() }),
      }),
    ),
  joinRoom: async (code: string, nickname: string) =>
    remember(
      await call<JoinResponse>(`/api/rooms/${encodeURIComponent(code)}/join`, {
        method: "POST",
        body: JSON.stringify({ nickname, sessionToken: session.token() }),
      }),
    ),
  roomInfo: (code: string) =>
    call<{ code: string; phase: string; players: number }>(`/api/rooms/${encodeURIComponent(code)}`),
};
