import { describe, expect, it } from "vitest";
import { openDb } from "../src/server/db/db.ts";
import { GameStore } from "../src/server/game/store.ts";
import { RoomError, RoomService } from "../src/server/rooms/service.ts";

// Room codes and the host's crown: the parts of the lobby that only go wrong
// under bad luck (a code collision) or bad timing (the host dropping out).

/** A service whose code letters come from `letters` in order (then cycle). */
function service(letters: number[] = []) {
  const db = openDb(":memory:");
  let i = 0;
  const rooms = new RoomService(db, new GameStore(db), (n) => (letters.length ? letters[i++ % letters.length] % n : Math.floor(Math.random() * n)));
  return { db, rooms };
}

/** A room with `n` ready players; returns the code and their ids, host first. */
function readyRoom(rooms: RoomService, n: number) {
  const host = rooms.createRoom("Host", undefined);
  const ids = [host.playerId];
  for (let i = 1; i < n; i++) ids.push(rooms.joinRoom(host.roomCode, `P${i}`, undefined).playerId);
  const signs = ["scorpio", "pisces", "leo", "aries"] as const;
  ids.forEach((id, i) => {
    rooms.applyLobbyAction(host.roomCode, id, { type: "PICK_ZODIAC", zodiac: signs[i] }, new Set());
    rooms.applyLobbyAction(host.roomCode, id, { type: "PICK_MBTI", mbti: "ENTP" }, new Set());
    rooms.applyLobbyAction(host.roomCode, id, { type: "SET_READY", ready: true }, new Set());
  });
  return { code: host.roomCode, ids };
}

const hostOf = (db: ReturnType<typeof openDb>, code: string) => (db.prepare("SELECT host_player_id AS h FROM rooms WHERE code = ?").get(code) as { h: string }).h;

describe("room codes", () => {
  it("a code that is already taken is drawn again", () => {
    // the first two rooms both draw AAAAAA; the second must retry
    const { rooms } = service([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
    const a = rooms.createRoom("Ann", undefined).roomCode;
    const b = rooms.createRoom("Ben", undefined).roomCode;
    expect(a).not.toBe(b);
  });

  it("a closed room's code is never handed out again", () => {
    const { db, rooms } = service([0]);
    const a = rooms.createRoom("Ann", undefined).roomCode;
    db.prepare("UPDATE rooms SET closed_at = 1 WHERE code = ?").run(a);
    expect(() => rooms.createRoom("Ben", undefined)).toThrow(/could not allocate a room code/);
  });
});

describe("the host's crown", () => {
  it("a host who drops passes it to the next connected seat once the grace period ends", () => {
    const { db, rooms } = service();
    const { code, ids } = readyRoom(rooms, 3);
    // seat 1 is offline too, so seat 2 takes it
    expect(rooms.hostTimedOut(code, new Set([ids[2]]))).toBe(true);
    expect(hostOf(db, code)).toBe(ids[2]);
  });

  it("nobody else online: the crown stays where it is", () => {
    const { db, rooms } = service();
    const { code, ids } = readyRoom(rooms, 3);
    expect(rooms.hostTimedOut(code, new Set())).toBe(false);
    expect(hostOf(db, code)).toBe(ids[0]);
  });

  it("a host back before the grace period ends keeps it", () => {
    const { db, rooms } = service();
    const { code, ids } = readyRoom(rooms, 2);
    expect(rooms.hostTimedOut(code, new Set(ids))).toBe(false);
    expect(hostOf(db, code)).toBe(ids[0]);
  });

  it("on the results screen, the new host can take everyone back to the lobby", () => {
    const { db, rooms } = service();
    const { code, ids } = readyRoom(rooms, 3);
    expect(rooms.applyLobbyAction(code, ids[0], { type: "START_GAME" }, new Set(ids)).started).toBe(true);
    db.prepare("UPDATE rooms SET phase = 'RESULTS' WHERE code = ?").run(code);
    const online = new Set([ids[1], ids[2]]);
    expect(() => rooms.applyLobbyAction(code, ids[1], { type: "RESTART" }, online)).toThrow(RoomError);
    expect(rooms.hostTimedOut(code, online)).toBe(true);
    expect(rooms.applyLobbyAction(code, ids[1], { type: "RESTART" }, online).ended).toBe(true);
    expect(db.prepare("SELECT phase FROM rooms WHERE code = ?").get(code)).toEqual({ phase: "LOBBY" });
  });
});
