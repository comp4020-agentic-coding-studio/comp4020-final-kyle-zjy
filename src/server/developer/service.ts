import { checkPreset, type CheckRun } from "../../shared/developer.ts";
import type { RoomService } from "../rooms/service.ts";
import { RoomError } from "../rooms/service.ts";
import type { GameRunner } from "../game/runner.ts";
import { transaction } from "../db/db.ts";
import { m } from "../../shared/i18n/msg.ts";
import { CHECK_SEED, prepareCheckpoint } from "./fixtures.ts";

export function launchCheck(rooms: RoomService, runner: GameRunner, presetId: unknown): CheckRun {
  const preset = checkPreset(presetId);
  if (!preset || !rooms.games) throw new RoomError("INVALID", m`Choose a known developer checkpoint.`, 400);
  const db = rooms.db;
  const first = rooms.createRoom("Ada", undefined);
  const seats = [{ ...first, nickname: "Ada" }];
  let run: CheckRun;
  try {
    for (const nickname of ["Bea", "Cal"]) seats.push({ ...rooms.joinRoom(first.roomCode, nickname, undefined), nickname });
    run = transaction(db, () => {
      const choices = [["scorpio", "ENTP"], ["pisces", "ISFJ"], ["leo", "ESFP"]] as const;
      for (const [i, seat] of seats.entries()) db.prepare("UPDATE room_members SET zodiac=?, mbti=?, stage='READY' WHERE room_code=? AND player_id=?").run(...choices[i], first.roomCode, seat.playerId);
      db.prepare("UPDATE rooms SET scenario_id=? WHERE code=?").run(preset.scenarioId, first.roomCode);
      const state = rooms.games!.create(first.roomCode, seats.map((seat, i) => ({ playerId: seat.playerId, seat: i, nickname: seat.nickname, zodiac: choices[i][0], mbti: choices[i][1] })), Date.now(), CHECK_SEED, preset.scenarioId, (state) => prepareCheckpoint(state, preset.id, Date.now()));
      const viewer = state.pending.at(-1)?.addressees[0] ?? state.turnOrder[state.activeIndex] ?? seats[0].playerId;
      return { presetId: preset.id, sessionId: state.sessionId, scenarioId: state.scenarioId, initialSeat: seats.findIndex((seat) => seat.playerId === viewer), seats };
    });
  } catch (error) {
    transaction(db, () => {
      db.prepare("DELETE FROM rooms WHERE code=?").run(first.roomCode);
      for (const seat of seats) db.prepare("DELETE FROM players WHERE id=?").run(seat.playerId);
    });
    throw error;
  }
  runner.resumeRoom(run.seats[0].roomCode);
  return run;
}

export function advanceCheck(rooms: RoomService, runner: GameRunner, code: string, token: unknown) {
  const actor = rooms.authenticate(code, token);
  if (runner.state(code)?.flags.developerCheck !== 1) throw new RoomError("INVALID", m`This command is only available in a developer test room.`, 403);
  runner.hostSkip(code, actor);
}
