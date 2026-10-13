import { afterEach, expect, it, vi } from "vitest";
import { CHECK_PRESETS, type CheckPresetId } from "../src/shared/developer.ts";
import { prepareCheckpoint, CHECK_SEED } from "../src/server/developer/fixtures.ts";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, hostSkip } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { seatsFor, T0, rigNextDie } from "./helpers.ts";
import { settle03 } from "./scenario03-helpers.ts";
import { openDb } from "../src/server/db/db.ts";
import { GameStore } from "../src/server/game/store.ts";
import { GameRunner } from "../src/server/game/runner.ts";
import { RoomService } from "../src/server/rooms/service.ts";
import { Hub } from "../src/server/rooms/hub.ts";
import { createApp } from "../src/server/http.ts";
import { launchCheck, advanceCheck } from "../src/server/developer/service.ts";
import { bootstrapClosed03, routeTargets03 } from "../src/server/engine/scenario03/ending.ts";
import type { GameState } from "../src/shared/game/state.ts";

const checkpoint = (id: CheckPresetId) => prepareCheckpoint(createGame(`dev-${id}`, seatsFor(3), CHECK_SEED, T0, CHECK_PRESETS.find((p) => p.id === id)!.scenarioId), id, T0);
const act = (s: GameState, playerId: string, action: Parameters<typeof applyGameAction>[2]) => applyGameAction(s, playerId, action, T0 + 10000 + s.version).state;
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach((fn) => fn()); vi.restoreAllMocks(); });
function server() {
  const db = openDb(":memory:"), games = new GameStore(db), rooms = new RoomService(db, games), runner = new GameRunner(db, games, () => T0 + 20000), hub = new Hub(rooms, runner);
  cleanups.push(() => { hub.close(); runner.close(); db.close(); });
  return { db, games, rooms, runner, hub, app: createApp(rooms, hub) };
}

it("builds every closed preset as a serializable, projected state that can take another real engine step", () => {
  for (const preset of CHECK_PRESETS) {
    const state = JSON.parse(JSON.stringify(checkpoint(preset.id))) as GameState;
    expect(state.flags.developerCheck, preset.id).toBe(1);
    const view = project(state, state.turnOrder[0]);
    expect(view.myActions, preset.id).toBeDefined();
    expect(() => hostSkip(state, T0 + 20000), preset.id).not.toThrow();
    expect(view).not.toHaveProperty("seed");
    expect(view).not.toHaveProperty("secrets");
  }
});

it("prepares train anchors, a playable last lock and the real nameless-passenger choice", () => {
  const anchors = checkpoint("s1.anchors");
  expect(Object.values(anchors.anchors).every((anchor) => anchor.repaired && anchor.progress >= anchor.required)).toBe(true);
  expect(Object.values(anchors.players).flatMap((p) => p.items)).toEqual(expect.arrayContaining(["POWER_KEY", "IDENTITY_KEY", "MEMORY_KEY"]));
  let locks = checkpoint("s1.locks");
  expect(locks.escape).toMatchObject({ round: locks.round, power: true, identity: true, memory: false });
  rigNextDie(locks, 4);
  locks = act(locks, locks.turnOrder[locks.activeIndex], { type: "REPAIR" });
  locks = settle03(locks, T0 + 30000);
  expect(locks.outcome).toBe("NORMAL");
  let nameless = checkpoint("s1.nameless");
  const choice = nameless.pending.at(-1)!;
  expect(choice.kind).toBe("ENDING_CHOICE");
  for (const id of choice.addressees) nameless = act(nameless, id, { type: "RESPOND", windowId: choice.id, optionId: "TICKET" });
  expect(nameless.outcome).toBe("TRUE_TICKET");
  const fold = checkpoint("s1.fold").sequence!.fold!;
  expect(fold.before.slice(1, 7).every((carriage, i) => carriage !== fold.after[i + 1])).toBe(true);
});

it("keeps boat components unique, exposes a real boarding window and launches through a legal engineer roll", () => {
  const parts = checkpoint("s2.parts"), city = parts.city!;
  for (const part of ["ENGINE", "FUEL", "NAV"]) {
    const copies = [...city.zones.flatMap((z) => z.caches), ...Object.values(city.holdings).flatMap((h) => h.parts), ...city.boat.installed].filter((value) => value === part);
    expect(copies).toHaveLength(1);
  }
  expect(project(checkpoint("s2.start"), "a").city!.boat.capacity).toBeNull();
  expect(checkpoint("s2.capacity").sequence?.kind).toBe("CAPACITY");
  expect(checkpoint("s2.boarding").pending.at(-1)?.resume.kind).toBe("S2_BOARD");
  let generator = checkpoint("s2.generator");
  expect(generator.city!.boat).toMatchObject({ autoStart: false, launched: false });
  expect(generator.city!.boat.aboard).toHaveLength(1);
  const engineer = generator.turnOrder[generator.activeIndex];
  expect(generator.city!.boat.aboard).not.toContain(engineer);
  rigNextDie(generator, 4);
  generator = act(generator, engineer, { type: "RESTART_GENERATOR" });
  generator = settle03(generator, T0 + 30000);
  expect(generator.city!.boat.launched).toBe(true);
  expect(generator.results!.find((r) => r.playerId === engineer)?.escape).toBe("ENGINEER");
});

it("continues a temporal rewrite/source placement and earns all three histories through existing rules", () => {
  let shift = checkpoint("s3.shift");
  rigNextDie(shift, 4);
  shift = act(shift, shift.turnOrder[shift.activeIndex], { type: "INTERVENE", nodeId: "REPORT", choiceId: "CORRECT" });
  shift = settle03(shift, T0 + 30000);
  expect(shift.temporal!.causalRevision).toBe(1);
  expect(shift.temporal!.present.report).toBe("CORRECTED");
  let loop = checkpoint("s3.bootstrap");
  const source = loop.temporal!.bootstrap.find((o) => !o.placedBy)!;
  expect(loop.temporal!.storedItems[source.instanceId].ownerId).toBe(source.assignedTo);
  loop = act(loop, source.assignedTo, { type: "STORE_ITEM", instanceId: source.instanceId });
  expect(bootstrapClosed03(loop)).toBe(true);
  const archive = checkpoint("s3.archive");
  expect(routeTargets03(archive)).toContain("OFFICIAL_HISTORY");
  expect(act(archive, archive.turnOrder[archive.activeIndex], { type: "RESOLVE_HISTORY", route: "OFFICIAL_HISTORY" }).outcome).toBe("S03_OFFICIAL_HISTORY");
  expect(checkpoint("s3.official").outcome).toBe("S03_OFFICIAL_HISTORY");
  expect(checkpoint("s3.erased").outcome).toBe("S03_NO_TOMORROW");
  expect(checkpoint("s3.deceive").outcome).toBe("S03_DECEIVE_HISTORY");
  expect(checkpoint("s3.echo").temporal!.story.revealed).toContain("ROUND5_ECHO");
});

it("uses genuine counterfeit instances, balances and sealed bids, with hidden five-card showdown hands", () => {
  let fake = checkpoint("s4.counterfeit");
  const owner = fake.turnOrder[fake.activeIndex];
  const item = fake.auction!.players[owner].items.find((id) => fake.auction!.itemInstances[id].counterfeit)!;
  expect(fake.auction!.auctionHistory.find((h) => h.lotId === item)?.winnerId).toBe(owner);
  fake = act(fake, owner, { type: "USE_LOT", lotId: item });
  expect(fake.auction!.players[owner].itemNotice?.result).toBe("COUNTERFEIT");
  let sealed = checkpoint("s4.final-bid");
  expect(sealed.auction!.final?.stage).toBe("AUCTION");
  const [first, other] = sealed.turnOrder;
  expect(sealed.auction!.final!.players[first].usable).toBeGreaterThanOrEqual(5);
  sealed = act(sealed, first, { type: "FINAL_BID", amount: 5 });
  expect(project(sealed, other).auction!.final!.players[first].bid).toBeNull();
  const showdown = checkpoint("s4.showdown"), final = showdown.auction!.final!;
  expect(final.stage).toBe("SHOWDOWN_PICK");
  expect(final.showdown!.participatingPlayerIds).toHaveLength(2);
  for (const id of final.showdown!.participatingPlayerIds) {
    expect(final.showdown!.cards[id]).toHaveLength(5);
    const view = project(showdown, id).auction!.final!.showdown!;
    expect(view.cardSlots).toEqual([null, null, null, null, null]);
    expect(view).not.toHaveProperty("cards");
    expect(() => act(showdown, id, { type: "FINAL_SHOWDOWN_PICK", cardIndex: 0 })).not.toThrow();
  }
  expect(checkpoint("s4.debt").outcome).toBe("S04_DEBT");
});

it("persists prepared initial snapshots, replays actions, pauses disconnected test seats and evicts idle runs", () => {
  const { games, rooms, runner } = server();
  const run = launchCheck(rooms, runner, "s4.final-bid");
  const code = run.seats[0].roomCode;
  const state = games.load(code)!;
  expect(state.auction!.final?.stage).toBe("AUCTION");
  expect(games.history(state.sessionId).initial).toEqual(state);
  runner.presence(code, run.seats[0].playerId, false);
  expect(runner.state(code)!.players[run.seats[0].playerId].away).toBe(false);
  advanceCheck(rooms, runner, code, run.seats[run.initialSeat].sessionToken);
  const history = games.history(state.sessionId);
  expect(history.entries).toHaveLength(1);
  expect(hostSkip(history.initial, history.entries[0].at).state).toEqual(games.load(code));
  expect(runner.cached).toBe(0); // Hub evicted the empty test room after broadcast.
  expect(runner.state(code)).toEqual(games.load(code));
  expect(runner.evictIfIdle(code)).toBe(true);
  runner.resumeAll();
  expect(runner.cached).toBe(0); // Cold restart does not retain idle manual checkpoints.
});

it("rejects arbitrary state/seed input and protects normal rooms and unowned seats", async () => {
  const { rooms, games, runner, app } = server();
  for (const body of [{ presetId: "s4.final-bid", state: { round: 10 } }, { presetId: "s1.start", seed: "client" }, { presetId: "unknown" }]) {
    const response = await app.request("/api/developer/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect(response.status).toBe(400);
  }
  const normal = rooms.createRoom("Normal", undefined);
  games.create(normal.roomCode, seatsFor(3), T0);
  const before = games.load(normal.roomCode);
  expect(() => advanceCheck(rooms, runner, normal.roomCode, normal.sessionToken)).toThrow("only available");
  expect(games.load(normal.roomCode)).toEqual(before);
  const check = launchCheck(rooms, runner, "s1.brake");
  expect(() => advanceCheck(rooms, runner, check.seats[0].roomCode, normal.sessionToken)).toThrow();
});

it("rolls back a failed prepared snapshot and cleans up only the new test identities", () => {
  const { db, rooms, games, runner } = server();
  const existing = rooms.createRoom("Existing", undefined);
  vi.spyOn(games, "create").mockImplementationOnce(() => { throw new Error("fixture failed"); });
  expect(() => launchCheck(rooms, runner, "s1.start")).toThrow("fixture failed");
  expect(db.prepare("SELECT code FROM rooms").all()).toEqual([{ code: existing.roomCode }]);
  expect(db.prepare("SELECT id FROM players").all()).toEqual([{ id: existing.playerId }]);
});
