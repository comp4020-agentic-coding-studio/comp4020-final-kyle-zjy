-- Lobby layer of docs/database-schema.md. Game-session tables arrive with the
-- engine (PHASE 4) as migration 002.

CREATE TABLE players (
  id                  TEXT PRIMARY KEY,
  session_token_hash  TEXT NOT NULL UNIQUE,
  created_at          INTEGER NOT NULL,
  last_seen_at        INTEGER NOT NULL
);

CREATE TABLE rooms (
  code             TEXT PRIMARY KEY,
  host_player_id   TEXT REFERENCES players(id),
  scenario_id      TEXT NOT NULL DEFAULT 'S01_LAST_TRAIN',
  phase            TEXT NOT NULL DEFAULT 'LOBBY',
  current_session  TEXT,
  version          INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  closed_at        INTEGER
);

CREATE TABLE room_members (
  room_code    TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  player_id    TEXT NOT NULL REFERENCES players(id),
  seat         INTEGER NOT NULL CHECK (seat BETWEEN 0 AND 9),
  nickname     TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 16),
  stage        TEXT NOT NULL DEFAULT 'JOINED',
  zodiac       TEXT,
  mbti         TEXT,
  joined_at    INTEGER NOT NULL,
  left_at      INTEGER,
  kicked       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (room_code, player_id)
);
CREATE UNIQUE INDEX room_members_active_seat
  ON room_members(room_code, seat) WHERE left_at IS NULL;
