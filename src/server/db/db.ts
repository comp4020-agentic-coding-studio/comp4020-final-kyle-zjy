import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "../config.ts";
import { log } from "../log.ts";

const MIGRATIONS_DIR = join(import.meta.dirname, "migrations");

export type Db = DatabaseSync;

export function openDb(file = join(config.dataDir, "fate.db")): Db {
  if (file !== ":memory:") mkdirSync(config.dataDir, { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 2000;");
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)");
  const applied = new Set(
    db.prepare("SELECT version FROM schema_migrations").all().map((r) => Number(r.version)),
  );
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  for (const file of files) {
    const version = Number(file.split("_")[0]);
    if (applied.has(version)) continue;
    transaction(db, () => {
      db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(version, Date.now());
    });
    log.info("migration applied", { file });
  }
}

/**
 * Runs fn inside BEGIN IMMEDIATE … COMMIT. Callers keep fn synchronous: with
 * DatabaseSync and no await inside, a transaction can never interleave with
 * another request on Node's single thread.
 */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
