import { serve } from "@hono/node-server";
import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import { config } from "./config.ts";
import { openDb } from "./db/db.ts";
import { GameRunner } from "./game/runner.ts";
import { GameStore } from "./game/store.ts";
import { createApp } from "./http.ts";
import { log } from "./log.ts";
import { Hub } from "./rooms/hub.ts";
import { RoomService } from "./rooms/service.ts";

const db = openDb();
const games = new GameStore(db);
const rooms = new RoomService(db, games);
const swept = rooms.sweep(config.roomTtlMs);
if (swept) log.info("swept stale rooms", { count: swept });

const runner = new GameRunner(db, games);
const hub = new Hub(rooms, runner);
const resumed = runner.resumeAll();
if (resumed) log.info("resumed runs after restart", { count: resumed });
const app = createApp(rooms, hub);

const server = serve({ fetch: app.fetch, port: config.port, hostname: "0.0.0.0" }, (info) =>
  log.info("listening", { port: info.port, dataDir: config.dataDir }),
) as Server;

const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
server.on("upgrade", (req, socket, head) => {
  if (new URL(req.url ?? "/", "http://x").pathname !== "/ws") return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => hub.attach(ws, req));
});

// Fly stops the machine with SIGINT/SIGTERM; close cleanly so WAL is checkpointed.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    log.info("shutting down", { signal });
    hub.close();
    runner.close();
    wss.close();
    server.close();
    db.close();
    process.exit(0);
  });
}
