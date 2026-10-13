// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { project } from "../src/server/engine/project.ts";
import { seatsFor, SEED, T0 } from "./helpers.ts";
import type { CheckRun } from "../src/shared/developer.ts";

class Socket {
  static instances: Socket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  readyState = 1;
  send = vi.fn();
  close = vi.fn();
  constructor() { Socket.instances.push(this); }
}
beforeEach(() => { vi.resetModules(); localStorage.clear(); Socket.instances = []; vi.stubGlobal("WebSocket", Socket); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const snapshot = (id: string) => ({ room: { code: "ABCDEF", phase: "ACT_1", scenarioId: "S01_LAST_TRAIN", members: [], version: 1 }, game: project(createGame("test", seatsFor(3), SEED, T0), id), serverTime: Date.now() });

it("uses explicit test credentials without replacing normal identity/rejoin, and discards stale seat messages", async () => {
  localStorage.setItem("fate:token", "ordinary-token");
  localStorage.setItem("fate:lastRoom", "NORMAL");
  const { connectRoom, disconnectRoom, reconnect, useStore } = await import("../src/client/store.ts");
  connectRoom("ABCDEF", "test-seat-a");
  const old = Socket.instances[0]; old.onopen!();
  expect(JSON.parse(old.send.mock.calls[0][0]).sessionToken).toBe("test-seat-a");
  old.onmessage!({ data: JSON.stringify({ t: "WELCOME", playerId: "a", snapshot: snapshot("a") }) });
  expect(localStorage.getItem("fate:lastRoom")).toBe("NORMAL");
  disconnectRoom();
  expect(useStore.getState().snapshot).toBeNull();
  expect(useStore.getState().cues).toEqual([]);
  connectRoom("ABCDEF", "test-seat-b");
  const next = Socket.instances[1]; next.onopen!();
  next.onmessage!({ data: JSON.stringify({ t: "WELCOME", playerId: "b", snapshot: snapshot("b") }) });
  old.onmessage!({ data: JSON.stringify({ t: "STATE", snapshot: snapshot("a"), events: [] }) });
  expect(useStore.getState().snapshot!.game!.viewerId).toBe("b");
  expect(localStorage.getItem("fate:token")).toBe("ordinary-token");
  reconnect(); const retry = Socket.instances[2]; retry.onopen!();
  expect(JSON.parse(retry.send.mock.calls[0][0]).sessionToken).toBe("test-seat-b");
  disconnectRoom();
  connectRoom("NORMAL"); const normal = Socket.instances[3]; normal.onopen!();
  expect(JSON.parse(normal.send.mock.calls[0][0]).sessionToken).toBe("ordinary-token");
  disconnectRoom();
});

it("stores only test credentials and marks checkpoint openings seen while fresh starts still replay", async () => {
  const { rememberCheck, savedChecks } = await import("../src/client/developer/session.ts");
  const { openingKey, shouldOpen } = await import("../src/client/game/opening/memory.ts");
  const run: CheckRun = { presetId: "s1.locks", sessionId: "g_test", scenarioId: "S01_LAST_TRAIN", initialSeat: 0, seats: ["a", "b", "c"].map((playerId) => ({ playerId, nickname: playerId, roomCode: "ABCDEF", sessionToken: `test-${playerId}` })) };
  rememberCheck(run);
  expect(savedChecks().at(-1)).toEqual(run);
  expect(localStorage.getItem("fate:token")).toBeNull();
  expect(shouldOpen({ ...run, viewerId: "a", phase: "ACT_1", round: 1 })).toBe(false);
  const fresh = { ...run, presetId: "s1.start" as const, sessionId: "new" };
  rememberCheck(fresh);
  expect(shouldOpen({ ...fresh, viewerId: "a", phase: "ACT_1", round: 1 })).toBe(true);
  expect(openingKey({ ...run, viewerId: "a" })).toContain("g_test");
});
