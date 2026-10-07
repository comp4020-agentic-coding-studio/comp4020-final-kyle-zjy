import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { config } from "./config.ts";
import { log } from "./log.ts";
import { renderReadme } from "./readme.ts";
import type { Hub } from "./rooms/hub.ts";
import { RoomError, type RoomService } from "./rooms/service.ts";

const startedAt = Date.now();

export function createApp(rooms: RoomService, hub: Hub): Hono {
  const app = new Hono();
  const indexPath = join(config.clientDir, "index.html");

  const fail = (c: Context, err: unknown) => {
    if (err instanceof RoomError) return c.json({ code: err.code, message: err.message }, err.status);
    log.error("request failed", { path: c.req.path, err: String(err) });
    return c.json({ code: "INVALID", message: "Something went wrong." }, 500 as 400);
  };
  const body = async (c: Context): Promise<Record<string, unknown>> => {
    try {
      const parsed = await c.req.json();
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  app.use("/api/*", bodyLimit({ maxSize: 4 * 1024 }));

  app.get("/api/health", (c) =>
    c.json({ ok: true, uptimeS: Math.round((Date.now() - startedAt) / 1000), sockets: hub.connectionCount(), runs: hub.runsInMemory() }),
  );

  app.post("/api/rooms", async (c) => {
    const { nickname, sessionToken } = await body(c);
    try {
      const joined = rooms.createRoom(nickname, sessionToken);
      log.info("room created", { room: joined.roomCode, player: joined.playerId });
      return c.json(joined, 201);
    } catch (err) {
      return fail(c, err);
    }
  });

  app.get("/api/rooms/:code", (c) => {
    const room = rooms.roomExists(c.req.param("code"));
    return room ? c.json(room) : c.json({ code: "ROOM_NOT_FOUND", message: "That room doesn't exist." }, 404);
  });

  app.post("/api/rooms/:code/join", async (c) => {
    const { nickname, sessionToken } = await body(c);
    try {
      const joined = rooms.joinRoom(c.req.param("code"), nickname, sessionToken);
      log.info("room joined", { room: joined.roomCode, player: joined.playerId });
      hub.broadcast(joined.roomCode);
      return c.json(joined);
    } catch (err) {
      return fail(c, err);
    }
  });

  app.all("/api/*", (c) => c.json({ code: "INVALID", message: "Not found." }, 404));

  app.get("/readme", (c) => c.redirect("/readme/", 301));
  app.get("/readme/", (c) => c.html(renderReadme()));
  // README images are linked relatively (docs/x.png), so /readme/docs/x.png
  app.get("/readme/docs/*", serveStatic({ root: config.root, rewriteRequestPath: (p) => p.replace(/^\/readme/, "") }));

  app.use("/*", serveStatic({ root: config.clientDir }));

  // The SPA owns / and /room/:code; it picks the screen from the room's phase.
  const spa = (c: Context) =>
    existsSync(indexPath)
      ? c.html(readFileSync(indexPath, "utf8"))
      : c.html("<!doctype html><title>Fate Instance</title><p>Client not built. Run <code>pnpm build</code>.</p>");
  app.get("/", spa);
  app.get("/room/:code", spa);

  return app;
}
