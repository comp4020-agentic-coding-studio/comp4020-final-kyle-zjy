import { describe, expect, it } from "vitest";
import type { ScenarioId } from "../src/shared/game/state.ts";
import type { ServerMessage, Snapshot } from "../src/shared/protocol.ts";
import { connect, create, join, welcome, type Client } from "./client.ts";

// The README's enforced promises that game.test.ts doesn't already hold: the
// server, not a socket, holds a run (surviving a restart is test/store.test.ts,
// since this suite can't restart the app it runs against), and every one of the
// four scenarios starts over the wire with each player's secrets kept to them.

async function table(n: number, scenarioId?: ScenarioId) {
  const host = await create("P0");
  const joins = [host];
  for (let i = 1; i < n; i++) joins.push((await join(host.roomCode, `P${i}`)).json);
  const seats: { token: string; playerId: string; c: Client }[] = [];
  for (const j of joins) {
    const c = await connect(host.roomCode, j.sessionToken);
    await welcome(c);
    seats.push({ token: j.sessionToken, playerId: j.playerId, c });
  }
  if (scenarioId) expect(await seats[0].c.act({ type: "SELECT_SCENARIO", scenarioId })).toMatchObject({ t: "ACK" });
  const chars = [["scorpio", "ENTP"], ["pisces", "ISFJ"], ["leo", "ESFP"]] as const;
  for (const [i, { c }] of seats.entries()) {
    await c.act({ type: "PICK_ZODIAC", zodiac: chars[i][0] });
    await c.act({ type: "PICK_MBTI", mbti: chars[i][1] });
    await c.act({ type: "SET_READY", ready: true });
  }
  expect(await seats[0].c.act({ type: "START_GAME" })).toMatchObject({ t: "ACK" });
  return { code: host.roomCode, seats };
}

const game = async (c: Client, match: (s: Snapshot) => boolean, ms = 3000) => (await c.snapshot((s) => !!s.game && match(s), ms)).game!;
const close = (cs: Client[]) => cs.forEach((c) => c.ws.close());

describe("promises held over the wire", () => {
  it("after every socket at the table closes, a new connection is handed the committed move", async () => {
    const { code, seats } = await table(2);
    await game(seats[0].c, (s) => s.game!.phase === "INTRO");
    for (const { c } of seats) await c.play({ type: "ACK_SEQUENCE" });
    const view = await game(seats[0].c, (s) => s.game!.step === "PLAYER_TURNS");
    const mover = seats.find((s) => s.playerId === view.turnOrder[view.activeIndex])!;
    expect(await mover.c.play({ type: "MOVE", toCarriage: 1 })).toMatchObject({ t: "ACK" });
    const moved = await game(mover.c, (s) => s.game!.players[mover.playerId].carriageIndex === 1);
    // every socket at the table goes away; the run lives on only on the server
    close(seats.map((s) => s.c));
    await new Promise((r) => setTimeout(r, 300));
    const fresh = await connect(code, mover.token);
    const back = (await welcome(fresh)).snapshot.game!;
    expect(back.version).toBeGreaterThanOrEqual(moved.version);
    expect(back.players[mover.playerId]).toMatchObject({ carriageIndex: 1, ap: moved.players[mover.playerId].ap });
    fresh.ws.close();
  }, 20_000);

  for (const scenarioId of ["S01_LAST_TRAIN", "S02_SUNKEN_CITY", "S03_INCIDENT_ZERO", "S04_UNDERGROUND_AUCTION"] as const) {
    it(`${scenarioId} starts for three players, each holding only their own secrets`, async () => {
      const { seats } = await table(3, scenarioId);
      const views = await Promise.all(seats.map(({ c }) => game(c, (s) => s.game!.scenarioId === scenarioId)));
      for (const [i, v] of views.entries()) {
        expect(v.viewerId).toBe(seats[i].playerId);
        expect(v.mySecrets).toBeTruthy();
      }
      // no message on any socket carries another seat's secrets block, the seed or the deck
      for (const [i, { c }] of seats.entries()) {
        const mine = JSON.stringify(views[i].mySecrets);
        for (const m of c.all.filter((m): m is Extract<ServerMessage, { snapshot: Snapshot }> => "snapshot" in m && !!m.snapshot.game)) {
          const json = JSON.stringify(m);
          expect(json).not.toContain('"seed"');
          for (const [j, other] of views.entries()) if (j !== i && JSON.stringify(other.mySecrets) !== mine) expect(json).not.toContain(JSON.stringify(other.mySecrets));
        }
      }
      close(seats.map((s) => s.c));
    }, 20_000);
  }
});
