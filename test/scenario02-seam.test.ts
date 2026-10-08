import { describe, expect, it } from "vitest";
import { openDb } from "../src/server/db/db.ts";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { GameStore } from "../src/server/game/store.ts";
import { RoomService } from "../src/server/rooms/service.ts";
import { ROSTER } from "../src/shared/characters/roster/index.ts";
import { characterSkill } from "../src/shared/game/skills.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { activePlayerId } from "../src/server/engine/context.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";

// PHASE S2-1: the engine runs a scenario through its registered rules, and a
// room's chosen scenario is the one its run is created with.

const ack = (s: GameState, t: number) => s.turnOrder.reduce((x, id) => applyGameAction(x, id, { type: "ACK_SEQUENCE" }, t).state, s);

describe("scenario seam", () => {
  it("a scenario 02 run uses its own round: a WORLD step, and the water rising to Collapse 12 ends it", () => {
    let s = startGame(createGame("g", seatsFor(3), SEED, T0, "S02_SUNKEN_CITY"), T0).state;
    // the parts are safe aboard (no early end for a part lost to the water), but the boat never gets power
    s.city!.boat.installed = ["ENGINE", "FUEL", "NAV"];
    s = ack(s, T0 + 1);
    expect(s).toMatchObject({ scenarioId: "S02_SUNKEN_CITY", phase: "ACT_1", step: "PLAYER_TURNS" });
    expect(s.log.some((l) => l.text === "— Round 1 —")).toBe(true);
    const steps = new Set<string>();
    for (let t = T0 + 2; s.phase !== "ENDING" && t < T0 + 2000; t++) {
      steps.add(s.step);
      if (s.sequence) s = ack(s, t);
      else if (s.pending.length) s = applyGameAction(s, s.pending[0].addressees.find((a) => !(a in s.pending[0].answers))!, { type: "RESPOND", windowId: s.pending[0].id, optionId: s.pending[0].defaultOptionId }, t).state;
      else s = applyGameAction(s, activePlayerId(s)!, { type: "END_TURN" }, t).state;
    }
    expect(steps.has("INSPECTOR")).toBe(false);
    expect(s).toMatchObject({ phase: "ENDING", outcome: "FAILED", failReason: "COLLAPSE", collapse: 12 });
  });

  it("every character has an ability in scenario 02, with the same mechanics as its core", () => {
    for (const c of ROSTER) expect(characterSkill(c.id, "S02_SUNKEN_CITY").coreSkillId, c.id).toBe(c.coreSkillId);
  });

  it("a room starts the scenario its host chose; only the host chooses, and only a real scenario", () => {
    const db = openDb(":memory:");
    const store = new GameStore(db);
    const rooms = new RoomService(db, store);
    const host = rooms.createRoom("Host", undefined);
    const guest = rooms.joinRoom(host.roomCode, "Guest", undefined);
    expect(() => rooms.applyLobbyAction(host.roomCode, guest.playerId, { type: "SELECT_SCENARIO", scenarioId: "S02_SUNKEN_CITY" }, new Set())).toThrow(/Only the host/);
    expect(() => rooms.applyLobbyAction(host.roomCode, host.playerId, { type: "SELECT_SCENARIO", scenarioId: "S99" as never }, new Set())).toThrow(/isn't open yet/);
    rooms.applyLobbyAction(host.roomCode, host.playerId, { type: "SELECT_SCENARIO", scenarioId: "S02_SUNKEN_CITY" }, new Set());
    for (const [id, z] of [[host.playerId, "leo"], [guest.playerId, "aries"]] as const) {
      rooms.applyLobbyAction(host.roomCode, id, { type: "PICK_ZODIAC", zodiac: z }, new Set());
      rooms.applyLobbyAction(host.roomCode, id, { type: "PICK_MBTI", mbti: "INFP" }, new Set());
      rooms.applyLobbyAction(host.roomCode, id, { type: "SET_READY", ready: true }, new Set());
    }
    rooms.applyLobbyAction(host.roomCode, host.playerId, { type: "START_GAME" }, new Set([host.playerId, guest.playerId]));
    expect(store.load(host.roomCode)?.scenarioId).toBe("S02_SUNKEN_CITY");
  });
});
