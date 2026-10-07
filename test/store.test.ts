import { describe, expect, it } from "vitest";
import { openDb } from "../src/server/db/db.ts";
import { applyGameAction, hostSkip, setAway, startGame, tickGame } from "../src/server/engine/engine.ts";
import { GameRunner } from "../src/server/game/runner.ts";
import { GameStore } from "../src/server/game/store.ts";
import { RoomService } from "../src/server/rooms/service.ts";
import type { GameState } from "../src/shared/game/state.ts";

// Persistence: every input is stored with its resulting state, a restarted
// server picks the run up where it was, and the stored history replays to the
// same state.

function setup() {
  const db = openDb(":memory:");
  const store = new GameStore(db);
  const rooms = new RoomService(db, store);
  // the lobby stamps the run with the real clock, so the runner's clock starts there too
  let now = Date.now();
  const clock = () => now;
  const runner = new GameRunner(db, store, clock);
  const host = rooms.createRoom("Host", undefined);
  const guest = rooms.joinRoom(host.roomCode, "Guest", undefined);
  for (const [who, z, m] of [[host.playerId, "scorpio", "ENTP"], [guest.playerId, "pisces", "ISFJ"]] as const) {
    rooms.applyLobbyAction(host.roomCode, who, { type: "PICK_ZODIAC", zodiac: z }, new Set());
    rooms.applyLobbyAction(host.roomCode, who, { type: "PICK_MBTI", mbti: m }, new Set());
    rooms.applyLobbyAction(host.roomCode, who, { type: "SET_READY", ready: true }, new Set());
  }
  const out = rooms.applyLobbyAction(host.roomCode, host.playerId, { type: "START_GAME" }, new Set());
  expect(out.started).toBe(true);
  runner.started(host.roomCode);
  return { db, store, runner, code: host.roomCode, advance: (ms: number) => (now += ms), clock };
}

/** Everyone presses "Board the train", ending the intro (it has no time limit). */
function boardAll(runner: GameRunner, code: string): void {
  for (const id of runner.state(code)!.turnOrder) runner.apply(code, id, `board-${id}`, runner.state(code)!.version, { type: "ACK_SEQUENCE" });
}

describe("game persistence", () => {
  it("starting a run creates exactly one session and moves the room out of its lobby", () => {
    const { db, code, runner } = setup();
    expect(runner.state(code)?.phase).toBe("INTRO");
    expect(db.prepare("SELECT COUNT(*) AS n FROM game_sessions").get()).toEqual({ n: 1 });
    expect(db.prepare("SELECT phase FROM rooms WHERE code = ?").get(code)).toEqual({ phase: "INTRO" });
    runner.close();
  });

  it("a restarted server resumes the run exactly where it was", () => {
    const { db, store, runner, code, clock } = setup();
    boardAll(runner, code);
    const s = runner.state(code)!;
    const active = s.turnOrder[s.activeIndex];
    runner.apply(code, active, "a1", s.version, { type: "MOVE", toCarriage: 1 });
    const before = runner.state(code)!;
    runner.close();
    const restarted = new GameRunner(db, store, clock);
    expect(restarted.resumeAll()).toBe(1);
    expect(restarted.state(code)).toEqual(before);
    restarted.close();
  });

  it("a turn action pressed before that turn began is refused; one pressed after it is applied", () => {
    const { runner, code } = setup();
    boardAll(runner, code);
    const first = runner.state(code)!;
    const [a, b] = [first.turnOrder[first.activeIndex], first.turnOrder[first.activeIndex + 1]];
    // both press End turn on the same view: a's lands first, which hands the turn to b
    runner.apply(code, a, "end-a", first.version, { type: "END_TURN" });
    expect(() => runner.apply(code, b, "end-b", first.version, { type: "END_TURN" })).toThrow(/before this turn began/);
    const now = runner.state(code)!;
    expect(now.turnOrder[now.activeIndex]).toBe(b);
    runner.apply(code, b, "end-b2", now.version, { type: "END_TURN" });
    expect(runner.state(code)!.activeIndex).not.toBe(now.activeIndex);
    runner.close();
  });

  it("a finished run in an empty room leaves memory but not the database; a live one stays", () => {
    const { runner, code } = setup();
    expect(runner.evictIfIdle(code)).toBe(false); // still in progress: its timers need it
    expect(runner.cached).toBe(1);
    runner.state(code)!.phase = "RESULTS";
    expect(runner.evictIfIdle(code)).toBe(true);
    expect(runner.cached).toBe(0);
    expect(runner.state(code)?.sessionId).toBeTruthy(); // reloads from the database on demand
    runner.close();
  });

  it("an action id is only ever applied once, even across a restart", () => {
    const { db, store, runner, code, clock } = setup();
    boardAll(runner, code);
    const s = runner.state(code)!;
    const active = s.turnOrder[s.activeIndex];
    expect(runner.apply(code, active, "dup", s.version, { type: "MOVE", toCarriage: 1 }).duplicate).toBe(false);
    const restarted = new GameRunner(db, store, clock);
    expect(restarted.apply(code, active, "dup", s.version, { type: "MOVE", toCarriage: 2 }).duplicate).toBe(true);
    expect(restarted.state(code)!.players[active].carriageIndex).toBe(1);
    runner.close();
    restarted.close();
  });

  it("the stored history replays to the stored state", () => {
    const { store, runner, code, advance } = setup();
    boardAll(runner, code);
    let s = runner.state(code)!;
    runner.apply(code, s.turnOrder[s.activeIndex], "x1", s.version, { type: "SEARCH" });
    s = runner.state(code)!;
    for (const w of [...s.pending].reverse()) runner.apply(code, w.addressees[0], `r-${w.id}`, s.version, { type: "RESPOND", windowId: w.id, optionId: w.defaultOptionId });
    s = runner.state(code)!;
    runner.presence(code, s.turnOrder[1], false);
    advance(30_000);
    runner.tick(code);
    runner.hostSkip(code, s.turnOrder[0]); // the host moves the table along: logged, and replayed

    const { initial, entries } = store.history(s.sessionId);
    let replay: GameState = initial;
    for (const e of entries) {
      if (e.kind === "START") replay = startGame(replay, e.at).state;
      else if (e.kind === "TICK") replay = tickGame(replay, e.at).state;
      else if (e.kind === "AWAY" || e.kind === "BACK") replay = setAway(replay, e.actorId!, e.kind === "AWAY", e.at).state;
      else if (e.kind === "SKIP") replay = hostSkip(replay, e.at).state;
      else replay = applyGameAction(replay, e.actorId!, e.action as never, e.at).state;
    }
    expect(replay).toEqual(runner.state(code));
    runner.close();
  });

  it("returning to the lobby ends the run and frees the room", () => {
    const { db, runner, code } = setup();
    const host = (db.prepare("SELECT host_player_id AS h FROM rooms WHERE code = ?").get(code) as { h: string }).h;
    const rooms = new RoomService(db, new GameStore(db));
    expect(rooms.applyLobbyAction(code, host, { type: "BACK_TO_LOBBY" }, new Set()).ended).toBe(true);
    runner.drop(code);
    expect(runner.state(code)).toBeNull();
    expect(db.prepare("SELECT COUNT(*) AS n FROM game_sessions WHERE ended_at IS NOT NULL").get()).toEqual({ n: 1 });
    runner.close();
  });
});
