import { expect, it } from "vitest";
import { openDb } from "../src/server/db/db.ts";
import { GameStore } from "../src/server/game/store.ts";
import { GameRunner } from "../src/server/game/runner.ts";
import { RoomService } from "../src/server/rooms/service.ts";
import { Hub } from "../src/server/rooms/hub.ts";
import { createApp } from "../src/server/http.ts";

it("retires utility routes without exposing or modifying legacy stored data", async () => {
  const db = openDb(":memory:");
  const games = new GameStore(db);
  const rooms = new RoomService(db, games);
  const runner = new GameRunner(db, games);
  const hub = new Hub(rooms, runner);
  try {
    const host = rooms.createRoom("Host", undefined);
    const legacy = JSON.stringify({ privateDice: [1, 2, 3, 4, 5] });
    db.prepare("INSERT INTO toolbox_rooms(room_code,state_json) VALUES (?,?)").run(host.roomCode, legacy);
    const app = createApp(rooms, hub);
    for (const [path, method] of [[`/tools/${host.roomCode}`, "GET"], [`/api/tools/${host.roomCode}`, "GET"], [`/api/tools/${host.roomCode}/action`, "POST"]]) {
      const response = await app.request(path, { method, headers: { Authorization: `Bearer ${host.sessionToken}`, "Content-Type": "application/json" }, ...(method === "POST" ? { body: JSON.stringify({ action: { type: "ROLL" } }) } : {}) });
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain("privateDice");
    }
    expect(db.prepare("SELECT state_json FROM toolbox_rooms WHERE room_code=?").get(host.roomCode)?.state_json).toBe(legacy);
    expect(rooms.roomState(host.roomCode, new Set())?.members).toHaveLength(1);
  } finally { hub.close(); runner.close(); db.close(); }
});
