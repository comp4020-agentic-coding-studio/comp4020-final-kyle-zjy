# Database schema

Status: PHASE 0 design. Engine: SQLite through Node's built-in `node:sqlite`,
file `${DATA_DIR}/fate.db` (`/data` on Fly). WAL mode, `foreign_keys = ON`,
`busy_timeout = 2000`. Migrations are numbered SQL files in
`src/server/db/migrations/` applied at boot inside a transaction and recorded
in `schema_migrations`.

## Why not one table per noun

The prompt lists ~15 candidate tables. The split below follows **how the data
is read and written**, not the nouns:

- **Static game data is code, not rows.** The 192 characters, items, carriages
  and event cards ship in `src/shared/` as typed constants. Putting them in the
  DB would add a second source of truth that can drift from the code (and
  `test/` checks the code directly).
- **Per-round game data is one snapshot.** Player resources, inventory,
  statuses, turns, anchors, the inspector, pending votes/choices change on
  almost every action and are always read together. They live in one JSON
  snapshot per session, written in the same transaction as the action that
  changed them. This is what makes every action atomic without
  cross-table locking.
- **History is append-only.** `action_log` (inputs) and `game_events`
  (outputs) are never updated, so they support replay, debugging and the
  results screen.
- **Secrets are partitioned by owner.** `secret_information` rows are keyed by
  `player_id`; the snapshot's secret section is stripped by the projection.
  Clients never query the database: the server is the only reader, so the
  "RLS" layer is the projection function, covered by a spec test.

## Mapping from the prompt's list

| Prompt table | Where it lives |
| --- | --- |
| rooms | `rooms` |
| players | `players` (anonymous identities + session token hash) |
| room_players | `room_members` |
| game_sessions | `game_sessions` |
| game_state | `game_sessions.state_json` + `version` |
| characters | code: `src/shared/characters/roster.ts` |
| player_characters | `room_members.zodiac`, `.mbti` (character id derived) |
| player_states, inventory | snapshot `players[id]` |
| events, event_choices | code (deck definitions) + snapshot (`pending`, `eventDeck`) + `game_events` (history) |
| votes | snapshot `pending` window + `action_log` (each `RESPOND`) |
| turns | snapshot (`round`, `turnOrder`, `activeSeat`) + `action_log` |
| action_logs | `action_log` |
| secret_information | `secret_information` (+ projection) |

## DDL (migration 001)

```sql
CREATE TABLE schema_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  INTEGER NOT NULL
);

-- An anonymous person. Created on first create/join; reused on reconnect.
CREATE TABLE players (
  id                  TEXT PRIMARY KEY,          -- 'p_' + 16 random base32 chars
  session_token_hash  TEXT NOT NULL UNIQUE,      -- sha256(hex) of the secret token
  created_at          INTEGER NOT NULL,
  last_seen_at        INTEGER NOT NULL
);

CREATE TABLE rooms (
  code             TEXT PRIMARY KEY,             -- 6 chars, alphabet without 0/O/1/I/L
  host_player_id   TEXT REFERENCES players(id),
  scenario_id      TEXT NOT NULL DEFAULT 'S01_LAST_TRAIN',
  phase            TEXT NOT NULL DEFAULT 'LOBBY',  -- mirrors GamePhase for listing/eviction
  current_session  TEXT,                         -- game_sessions.id when in game
  version          INTEGER NOT NULL DEFAULT 0,   -- bumps on every lobby change
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  closed_at        INTEGER
);

CREATE TABLE room_members (
  room_code    TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  player_id    TEXT NOT NULL REFERENCES players(id),
  seat         INTEGER NOT NULL CHECK (seat BETWEEN 0 AND 9),
  nickname     TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 16),
  stage        TEXT NOT NULL DEFAULT 'JOINED',   -- JOINED|ZODIAC_CHOSEN|REVEALED|READY
  zodiac       TEXT,                             -- 'aries'..'pisces'
  mbti         TEXT,                             -- 'INTJ'..'ESFP'
  joined_at    INTEGER NOT NULL,
  left_at      INTEGER,                          -- NULL while seated
  kicked       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (room_code, player_id)
);
-- At most one active member per seat, and the 10-seat cap falls out of the CHECK.
CREATE UNIQUE INDEX room_members_active_seat
  ON room_members(room_code, seat) WHERE left_at IS NULL;

CREATE TABLE game_sessions (
  id            TEXT PRIMARY KEY,                -- 'g_' + random
  room_code     TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  scenario_id   TEXT NOT NULL,
  seed          TEXT NOT NULL,                   -- hex, 128 bits
  phase         TEXT NOT NULL,                   -- GamePhase
  version       INTEGER NOT NULL,                -- = last applied action seq
  state_json    TEXT NOT NULL,                   -- full authoritative GameState
  outcome       TEXT,                            -- NORMAL|TRUE_DELETE|TRUE_TICKET|FAILED
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER
);
CREATE INDEX game_sessions_room ON game_sessions(room_code);

-- Every accepted input, in order. Replay = initial state + seed + this log.
CREATE TABLE action_log (
  session_id   TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  seq          INTEGER NOT NULL,                 -- 1, 2, 3 … (= version after apply)
  action_id    TEXT NOT NULL,                    -- client-generated, for dedupe
  actor_id     TEXT,                             -- NULL for SYSTEM (timeouts, inspector)
  action_json  TEXT NOT NULL,
  rng_cursor   INTEGER NOT NULL,                 -- cursor before apply
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (session_id, seq),
  UNIQUE (session_id, action_id)
);

-- Outputs of each action: public log lines and animation cues.
CREATE TABLE game_events (
  session_id   TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  seq          INTEGER NOT NULL,                 -- action seq that produced it
  idx          INTEGER NOT NULL,                 -- order within that action
  kind         TEXT NOT NULL,                    -- MOVE|ROLL|SKILL_USED|INSPECTOR_MOVE|…
  visibility   TEXT NOT NULL DEFAULT 'PUBLIC',   -- PUBLIC | PRIVATE
  player_id    TEXT,                             -- recipient when PRIVATE
  payload_json TEXT NOT NULL,
  PRIMARY KEY (session_id, seq, idx)
);

-- Owner-only information. Mirrors the snapshot's secret section so it can be
-- audited and so the results screen can reveal it after the game.
CREATE TABLE secret_information (
  session_id   TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id    TEXT NOT NULL REFERENCES players(id),
  kind         TEXT NOT NULL,                    -- OBSESSION|SECRET_MESSAGE|SECRET_ALLY|DREAM|PEEK|HIDDEN_STATUS
  payload_json TEXT NOT NULL,
  is_true      INTEGER,                          -- for round-5 messages (revealed at results)
  created_at   INTEGER NOT NULL,
  revealed_at  INTEGER
);
CREATE INDEX secret_information_owner ON secret_information(session_id, player_id);
```

## Transactions

| Operation | One transaction contains |
| --- | --- |
| Create room | insert player (if new) → generate code (retry on PK conflict) → insert room → insert member seat 0 → set host |
| Join room | check room open, not in game, < 10 active members, nickname unique in room → insert/reactivate member at lowest free seat → bump room version |
| Lobby action | update member/room → bump room version |
| Start game | verify ≥ 2, all READY → insert game_sessions with initial state → insert initial secrets → room.phase/current_session |
| Game action | `INSERT action_log` (fails on duplicate `action_id` → treated as already applied) → `UPDATE game_sessions SET state_json=?, version=version+1 WHERE id=? AND version=?` (0 rows → stale, rollback) → insert game_events, secrets |

## Room codes

6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 symbols, no
look-alikes) → ~887 million codes. Generated with `crypto.randomInt`;
uniqueness enforced by the primary key with retry. Input is upper-cased and
trimmed before lookup.

## Retention

- Startup sweep: rooms with `updated_at` older than 7 days are deleted (cascade).
- Closed rooms (everyone left) are marked `closed_at` and swept after 24 h.
