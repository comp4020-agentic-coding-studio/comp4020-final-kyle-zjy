import { describe, expect, it } from "vitest";
import type { PlayerView } from "../src/shared/game/state.ts";
import type { ServerMessage, Snapshot } from "../src/shared/protocol.ts";
import type { JoinResponse } from "../src/shared/protocol.ts";
import { connect, create, join, welcome, type Client } from "./client.ts";

// A real run over WebSocket against the running app: the server is the only
// authority, every player gets their own view, and duplicate or simultaneous
// inputs can't double-apply.

type Seat = { join: JoinResponse; c: Client };

async function startedRun(n = 2): Promise<{ code: string; seats: Seat[] }> {
  const host = await create("P0");
  const joins = [host];
  for (let i = 1; i < n; i++) joins.push((await join(host.roomCode, `P${i}`)).json);
  const seats: Seat[] = [];
  for (const j of joins) {
    const c = await connect(host.roomCode, j.sessionToken);
    await welcome(c);
    seats.push({ join: j, c });
  }
  const chars = [["scorpio", "ENTP"], ["pisces", "ISFJ"], ["leo", "ESFP"], ["aries", "INTJ"]] as const;
  for (const [i, { c }] of seats.entries()) {
    await c.act({ type: "PICK_ZODIAC", zodiac: chars[i % 4][0] });
    await c.act({ type: "PICK_MBTI", mbti: chars[i % 4][1] });
    await c.act({ type: "SET_READY", ready: true });
  }
  expect(await seats[0].c.act({ type: "START_GAME" })).toMatchObject({ t: "ACK" });
  return { code: host.roomCode, seats };
}

const gameOf = (c: Client, match: (g: PlayerView) => boolean, ms = 3000) =>
  c.snapshot((s: Snapshot) => !!s.game && match(s.game), ms).then((s) => s.game!);

async function intoRound1(seats: Seat[]): Promise<PlayerView> {
  await gameOf(seats[0].c, (g) => g.phase === "INTRO");
  for (const { c } of seats) await c.play({ type: "ACK_SEQUENCE" });
  return gameOf(seats[0].c, (g) => g.phase === "ACT_1" && g.step === "PLAYER_TURNS");
}

// a dropped socket is reported in milliseconds locally, but takes about 5 s
// through Fly's proxy; these waits also hold when the spec runs against the live app
const AWAY_MS = 10_000;

const close = (seats: Seat[]) => seats.forEach(({ c }) => c.ws.close());

describe("a run over WebSocket", () => {
  it("starts for everyone, each with their own secrets and nobody else's", async () => {
    const { seats } = await startedRun(2);
    const [a, b] = await Promise.all(seats.map(({ c }) => gameOf(c, (g) => g.phase === "INTRO")));
    expect(a.viewerId).toBe(seats[0].join.playerId);
    expect(a.mySecrets?.obsession).toBeTruthy();
    expect(b.mySecrets?.obsession).toBeTruthy();
    const view = await intoRound1(seats);
    expect(view.round).toBe(1);
    // nothing on A's socket ever mentions B's obsession in a secrets block
    const bObsession = b.mySecrets!.obsession;
    const aSaw = seats[0].c.all.filter((m): m is Extract<ServerMessage, { snapshot: Snapshot }> => "snapshot" in m);
    for (const m of aSaw) {
      expect(m.snapshot.game?.mySecrets?.obsession === bObsession && a.mySecrets!.obsession !== bObsession).toBe(false);
      expect(JSON.stringify(m)).not.toContain('"seed"');
      expect(JSON.stringify(m)).not.toContain('"eventDeck"');
    }
    close(seats);
  });

  it("only the active passenger can act, and the server says why", async () => {
    const { seats } = await startedRun(3);
    const view = await intoRound1(seats);
    const active = seats.find((s) => s.join.playerId === view.turnOrder[view.activeIndex])!;
    const idle = seats.find((s) => s !== active)!;
    expect(await idle.c.play({ type: "SEARCH" })).toMatchObject({ t: "REJECTED", code: "NOT_YOUR_TURN" });
    expect(await active.c.play({ type: "MOVE", toCarriage: 5 })).toMatchObject({ t: "REJECTED", code: "ILLEGAL_TARGET" });
    expect(await active.c.play({ type: "MOVE", toCarriage: 1 })).toMatchObject({ t: "ACK" });
    const after = await gameOf(idle.c, (g) => g.players[active.join.playerId].carriageIndex === 1);
    expect(after.players[active.join.playerId].ap).toBe(1);
    close(seats);
  });

  it("a repeated action id is applied once", async () => {
    const { seats } = await startedRun(2);
    const view = await intoRound1(seats);
    const active = seats.find((s) => s.join.playerId === view.turnOrder[view.activeIndex])!;
    expect(await active.c.play({ type: "MOVE", toCarriage: 1 }, { actionId: "same-id" })).toMatchObject({ t: "ACK" });
    const moved = await gameOf(active.c, (g) => g.players[active.join.playerId].carriageIndex === 1);
    expect(await active.c.play({ type: "MOVE", toCarriage: 2 }, { actionId: "same-id" })).toMatchObject({ t: "ACK" });
    await new Promise((r) => setTimeout(r, 300));
    const last = [...active.c.all].reverse().find((m) => m.t === "STATE" || m.t === "WELCOME") as Extract<ServerMessage, { snapshot: Snapshot }>;
    expect(last.snapshot.game!.players[active.join.playerId]).toMatchObject({ carriageIndex: 1, ap: moved.players[active.join.playerId].ap });
    close(seats);
  });

  it("two players pressing at the same moment: exactly one is accepted", async () => {
    const { seats } = await startedRun(2);
    await intoRound1(seats);
    const answers = await Promise.all(seats.map(({ c }) => c.play({ type: "END_TURN" })));
    expect(answers.filter((m) => m.t === "ACK")).toHaveLength(1);
    expect(answers.filter((m) => m.t === "REJECTED")).toHaveLength(1);
    close(seats);
  });

  it("a refresh mid-run resumes the same seat, and the table sees the player leave and return", async () => {
    const { code, seats } = await startedRun(2);
    await intoRound1(seats);
    const [a, b] = seats;
    b.c.ws.close();
    await gameOf(a.c, (g) => g.players[b.join.playerId].away === true, AWAY_MS);
    const again = await connect(code, b.join.sessionToken);
    const w = await welcome(again);
    expect(w.playerId).toBe(b.join.playerId);
    expect(w.snapshot.room.members).toHaveLength(2);
    expect(w.snapshot.game?.phase).toBe("ACT_1");
    await gameOf(a.c, (g) => g.players[b.join.playerId].away === false, AWAY_MS);
    a.c.ws.close();
    again.ws.close();
  }, 20_000);

  it("the active passenger refreshing keeps their turn", async () => {
    const { code, seats } = await startedRun(2);
    const view = await intoRound1(seats);
    const active = seats.find((s) => s.join.playerId === view.turnOrder[view.activeIndex])!;
    const other = seats.find((s) => s !== active)!;
    active.c.ws.close();
    await gameOf(other.c, (g) => g.players[active.join.playerId].away === true, AWAY_MS);
    const again = await connect(code, active.join.sessionToken);
    const w = await welcome(again);
    expect(w.snapshot.game?.turnOrder[w.snapshot.game.activeIndex]).toBe(active.join.playerId);
    expect(await again.play({ type: "SEARCH" })).toMatchObject({ t: "ACK" });
    other.c.ws.close();
    again.ws.close();
  }, 20_000);

  it("nothing has a time limit; the host, and only the host, can pass a stalled turn", async () => {
    const { seats } = await startedRun(2);
    const view = await intoRound1(seats);
    const [host, guest] = seats;
    const active = view.turnOrder[view.activeIndex];
    expect(view.turnDeadline).toBeNull();
    expect(await guest.c.act({ type: "SKIP_WAITING" })).toMatchObject({ t: "REJECTED", code: "NOT_HOST" });
    expect(await host.c.act({ type: "SKIP_WAITING" })).toMatchObject({ t: "ACK" });
    const after = await gameOf(guest.c, (g) => g.turnOrder[g.activeIndex] !== active);
    expect(after.log.some((l) => l.text.includes("The host moves things along"))).toBe(true);
    close(seats);
  });

  it("refuses a stale view for decisions that depend on it", async () => {
    const { seats } = await startedRun(2);
    const view = await intoRound1(seats);
    const active = seats.find((s) => s.join.playerId === view.turnOrder[view.activeIndex])!;
    const item = view.players[active.join.playerId].items[0];
    expect(await active.c.play({ type: "USE_ITEM", item }, { stateVersion: view.version - 1 })).toMatchObject({ t: "REJECTED", code: "STALE_VERSION" });
    close(seats);
  });
});

describe("a full table of 10", () => {
  it("ten passengers boarding at the same instant are each accepted once, and each sees only their own secrets", async () => {
    const { seats } = await startedRun(10);
    await gameOf(seats[0].c, (g) => g.phase === "INTRO");
    const answers = await Promise.all(seats.map(({ c }) => c.play({ type: "ACK_SEQUENCE" })));
    expect(answers.every((m) => m.t === "ACK")).toBe(true);
    const views = await Promise.all(seats.map(({ c }) => gameOf(c, (g) => g.phase === "ACT_1" && g.step === "PLAYER_TURNS")));
    for (const [i, v] of views.entries()) {
      expect(v.viewerId).toBe(seats[i].join.playerId);
      expect(Object.keys(v.players)).toHaveLength(10);
      // a full table's snapshot stays small enough to push on every change
      expect(JSON.stringify(v).length).toBeLessThan(64_000);
    }
    expect(new Set(views.map((v) => JSON.stringify(v.mySecrets))).size).toBe(10);
    close(seats);
  }, 20_000);

  it("ten turns in a row hand over in order and the round moves on", async () => {
    const { seats } = await startedRun(10);
    const first = await intoRound1(seats);
    const byId = new Map(seats.map((s) => [s.join.playerId, s]));
    for (const id of first.turnOrder) {
      const seat = byId.get(id)!;
      await gameOf(seat.c, (g) => g.turnOrder[g.activeIndex] === id && g.pending.length === 0);
      expect(await seat.c.play({ type: "END_TURN" })).toMatchObject({ t: "ACK" });
    }
    // the round's event may ask for a decision; everyone takes the default until round 2
    for (let guard = 0; guard < 30; guard++) {
      const g = await gameOf(seats[0].c, () => true);
      if (g.round === 2 && g.step === "PLAYER_TURNS") break;
      const w = g.pending.at(-1);
      if (w) await Promise.all(w.addressees.filter((id) => !w.answeredBy.includes(id)).map((id) => byId.get(id)!.c.play({ type: "RESPOND", windowId: w.id, optionId: w.defaultOptionId })));
      else if (g.sequence) await Promise.all(seats.map(({ c }) => c.play({ type: "ACK_SEQUENCE" })));
      else await new Promise((r) => setTimeout(r, 100));
    }
    expect((await gameOf(seats[0].c, (g) => g.round === 2)).round).toBe(2);
    close(seats);
  }, 30_000);
});
