-- Game sessions (docs/database-schema.md). The authoritative state is one
-- JSON snapshot per session, written in the same transaction as the input
-- that produced it; action_log keeps every input (player actions, timer
-- ticks, presence changes) so a run can be replayed from initial_json.

CREATE TABLE game_sessions (
  id            TEXT PRIMARY KEY,
  room_code     TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  scenario_id   TEXT NOT NULL,
  seed          TEXT NOT NULL,
  phase         TEXT NOT NULL,
  version       INTEGER NOT NULL,
  initial_json  TEXT NOT NULL,
  state_json    TEXT NOT NULL,
  outcome       TEXT,
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER
);
CREATE INDEX game_sessions_room ON game_sessions(room_code);

CREATE TABLE action_log (
  session_id   TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  seq          INTEGER NOT NULL,
  action_id    TEXT,
  actor_id     TEXT,
  kind         TEXT NOT NULL,
  action_json  TEXT,
  at           INTEGER NOT NULL,
  PRIMARY KEY (session_id, seq)
);
CREATE UNIQUE INDEX action_log_dedupe ON action_log(session_id, action_id) WHERE action_id IS NOT NULL;
