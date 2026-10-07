import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

export const config = {
  port: Number(process.env.PORT ?? 8080),
  dataDir: process.env.DATA_DIR ?? (process.env.NODE_ENV === "production" ? "/data" : join(root, "data")),
  root,
  clientDir: join(root, "dist/client"),
  readmePath: join(root, "README.md"),
  /** How long a disconnected host keeps the crown before it passes on. */
  hostGraceMs: Number(process.env.HOST_GRACE_MS ?? 30_000),
  /** Rooms untouched this long are deleted at startup. */
  roomTtlMs: 7 * 24 * 60 * 60 * 1000,
};
