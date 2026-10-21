CREATE TABLE toolbox_rooms (
  room_code TEXT PRIMARY KEY REFERENCES rooms(code) ON DELETE CASCADE,
  state_json TEXT NOT NULL
);
