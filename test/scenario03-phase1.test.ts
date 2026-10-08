import { describe, expect, it } from "vitest";
import { openDb } from "../src/server/db/db.ts";
import { activePlayerId, type Ctx } from "../src/server/engine/context.ts";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { rulesFor } from "../src/server/engine/scenario.ts";
import { actAt } from "../src/server/engine/scenario02/rules.ts";
import { GameRunner } from "../src/server/game/runner.ts";
import { GameStore } from "../src/server/game/store.ts";
import { RoomService } from "../src/server/rooms/service.ts";
import { ADJACENT03, ROOM_IDS, placeKey03 } from "../src/shared/game/scenario03/map.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";
import { endTurn03, settle03 } from "./scenario03-helpers.ts";

const start = (n: number): GameState => {
  let s = startGame(createGame("s3-phase1", seatsFor(n), SEED, T0, "S03_INCIDENT_ZERO"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
};

describe("Scenario 03 movement foundation", () => {
  it.each([2, 3, 4])("%i players get exactly 3 AP, walk once and jump years at the same room for 2 AP", (n) => {
    let s = start(n);
    const id = activePlayerId(s)!;
    const other = s.turnOrder.find((x) => x !== id)!;
    expect(s.round).toBe(1);
    for (const p of Object.values(s.players)) expect(p.ap).toBe(3);
    expect(s.config.bonusAp).toBe(0);
    expect(s.temporal!.locations[id]).toEqual({ roomId: "CENTRAL_HALL", year: "Y2026" });
    expect(project(s, other).temporal!.locations[id]).toEqual(s.temporal!.locations[id]);

    s = applyGameAction(s, id, { type: "MOVE", toCarriage: placeKey03("ARCHIVES", "Y2026") }, T0 + 2).state;
    expect(s.players[id].ap).toBe(2);
    expect(s.temporal!.locations[id]).toEqual({ roomId: "ARCHIVES", year: "Y2026" });
    expect(() => applyGameAction(s, id, { type: "MOVE", toCarriage: placeKey03("SECRET_ARCHIVE", "Y2026") }, T0 + 3)).toThrow(/open adjacent room/);

    s = applyGameAction(s, id, { type: "TIME_JUMP" }, T0 + 4).state;
    expect(s.players[id].ap).toBe(0);
    expect(s.temporal!.locations[id]).toEqual({ roomId: "ARCHIVES", year: "Y1996" });
    expect(s.players[id].carriageIndex).toBe(placeKey03("ARCHIVES", "Y1996"));
    expect(s.temporal!.locations[other].year).toBe("Y2026");
    expect(() => applyGameAction(s, id, { type: "TIME_JUMP" }, T0 + 5)).toThrow(/Needs 2 action points/);
  });

  it("has eight physical rooms and one tree, with the containment area not a ninth node", () => {
    expect(ROOM_IDS).toHaveLength(8);
    expect(new Set(ROOM_IDS)).toHaveProperty("size", 8);
    expect(ROOM_IDS).not.toContain("TEMPORAL_CONTAINMENT");
    for (const room of ROOM_IDS) for (const next of ADJACENT03[room]) expect(ADJACENT03[next]).toContain(room);
    expect(Object.values(ADJACENT03).reduce((n, list) => n + list.length, 0) / 2).toBe(7);
  });

  it.each([3, 4])("%i players reach Act IV only after round 9 and end during round 12", (n) => {
    let s = start(n);
    const phases = new Map<number, string>([[s.round, s.phase]]);
    for (let guard = 0; guard < 100 && s.phase !== "ENDING"; guard++) {
      if (s.sequence?.kind === "S3_IDENTITY" || s.sequence?.kind === "S3_THIRD_ROUTE") {
        expect(s.round).toBe(s.sequence.kind === "S3_IDENTITY" ? 6 : 9);
        expect(s.phase).toBe(s.sequence.kind === "S3_IDENTITY" ? "ACT_3" : "ACT_4");
        for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + guard + 2).state;
        phases.set(s.round, s.phase);
        continue;
      }
      s = endTurn03(s, T0 + guard + 2);
      phases.set(s.round, s.phase);
      if (s.phase === "ACT_1" || s.phase === "ACT_2" || s.phase === "ACT_3" || s.phase === "ACT_4") {
        const expected = s.round <= 3 ? 1 : s.round === 6 && s.sequence?.kind === "S3_IDENTITY" ? 3 : s.round <= 6 ? 2 : s.round === 9 && s.sequence?.kind === "S3_THIRD_ROUTE" ? 4 : s.round <= 9 ? 3 : 4;
        expect(s.act).toBe(expected);
        for (const p of Object.values(s.players)) if (p.ap > 0) expect(p.ap).toBe(3);
      }
    }
    s = settle03(s, T0 + 200);
    expect(s.phase).toBe("ENDING");
    expect(s.round).toBe(12);
    expect(s.collapse).toBe(12);
    expect(phases.get(4)).toBe("ACT_2");
    expect(phases.get(7)).toBe("ACT_3");
    expect(phases.get(10)).toBe("ACT_4");
  });
});

describe("fourth-act compatibility", () => {
  it("the existing train and city retain their three-act boundaries", () => {
    const train = createGame("train", seatsFor(3), SEED, T0, "S01_LAST_TRAIN");
    const ctx: Ctx = { s: train, now: T0, events: [] };
    train.round = 3;
    expect(rulesFor(train).afterRound(ctx)).toBe(false);
    expect(train.phase).toBe("ACT_2");
    train.round = 7;
    expect(rulesFor(train).afterRound(ctx)).toBe(false);
    expect(train.phase).toBe("ACT_3");
    train.round = 8;
    expect(rulesFor(train).afterRound(ctx)).toBe(false);
    expect(train.phase).toBe("ACT_3");
    expect([0, 4, 5, 8, 9, 11, 12].map(actAt)).toEqual([1, 1, 2, 2, 3, 3, 3]);
  });
});

describe("Scenario 03 persistence and reconnect", () => {
  it.each([3, 4])("%i players keep their year, room and turn after a runner restart", (n) => {
    const db = openDb(":memory:");
    const store = new GameStore(db);
    const rooms = new RoomService(db, store);
    const host = rooms.createRoom("Host", undefined);
    const members = [host, ...Array.from({ length: n - 1 }, (_, i) => rooms.joinRoom(host.roomCode, `Guest${i + 1}`, undefined))];
    rooms.applyLobbyAction(host.roomCode, host.playerId, { type: "SELECT_SCENARIO", scenarioId: "S03_INCIDENT_ZERO" }, new Set());
    expect(rooms.roomState(host.roomCode, new Set())?.scenarioId).toBe("S03_INCIDENT_ZERO");
    for (const member of members) {
      rooms.applyLobbyAction(host.roomCode, member.playerId, { type: "PICK_ZODIAC", zodiac: "aries" }, new Set());
      rooms.applyLobbyAction(host.roomCode, member.playerId, { type: "PICK_MBTI", mbti: "INTJ" }, new Set());
      rooms.applyLobbyAction(host.roomCode, member.playerId, { type: "SET_READY", ready: true }, new Set());
    }
    rooms.applyLobbyAction(host.roomCode, host.playerId, { type: "START_GAME" }, new Set());
    const runner = new GameRunner(db, store);
    runner.started(host.roomCode);
    for (const id of runner.state(host.roomCode)!.turnOrder) {
      const s = runner.state(host.roomCode)!;
      runner.apply(host.roomCode, id, `intro-${id}`, s.version, { type: "ACK_SEQUENCE" });
    }
    let s = runner.state(host.roomCode)!;
    const active = activePlayerId(s)!;
    runner.apply(host.roomCode, active, "jump", s.version, { type: "TIME_JUMP" });
    s = runner.state(host.roomCode)!;
    runner.presence(host.roomCode, active, false);
    runner.close();
    const restarted = new GameRunner(db, store);
    expect(restarted.resumeAll()).toBe(1);
    const restored = restarted.state(host.roomCode)!;
    expect(restored.temporal!.locations[active]).toEqual({ roomId: "CENTRAL_HALL", year: "Y1996" });
    expect(restored.players[active].away).toBe(true);
    restarted.presence(host.roomCode, active, true);
    expect(project(restarted.state(host.roomCode)!, active).temporal!.locations[active].year).toBe("Y1996");
    expect(activePlayerId(restarted.state(host.roomCode)!)).toBe(active);
    restarted.close();
    db.close();
  });
});
