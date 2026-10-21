import { describe, expect, it } from "vitest";
import { emptyPoker, actPoker } from "../src/server/toolbox/poker.ts";
import { ToolStore } from "../src/server/toolbox/store.ts";
import { openDb } from "../src/server/db/db.ts";
import { RoomService } from "../src/server/rooms/service.ts";
import type { ToolAction } from "../src/shared/toolbox/types.ts";
function table(n = 3) {
  const p = emptyPoker(); const ids = Array.from({ length: n }, (_, i) => String(i));
  const act = (id: string, a: ToolAction) => actPoker(p, id, a, id === "0", ids);
  act("0", { type: "CONFIG", buyIn: 100, small: 5, big: 10, ids, dealer: "0" });
  act("0", { type: "START" }); return { p, act };
}
describe("physical-card chip table", () => {
  it("uses heads-up blinds, requires turns and lets the big blind check", () => {
    const { p, act } = table(2);
    expect(p.actor).toBe("0"); expect(p.seats.map(s => s.bet)).toEqual([5, 10]);
    expect(() => act("1", { type: "CHECK" })).toThrow();
    expect(() => act("0", { type: "CHECK" })).toThrow();
    act("0", { type: "CALL" }); expect(p.actor).toBe("1");
    act("1", { type: "CHECK" }); expect(p.stage).toBe("between");
    act("0", { type: "NEXT" }); expect(p.actor).toBe("1"); expect(p.street).toBe("flop");
  });
  it("does not reopen a raise after a short all-in; refunds unmatched chips", () => {
    const { p, act } = table(); p.seats[2].stack = 15;
    act("0", { type: "RAISE", to: 20 }); act("1", { type: "CALL" }); act("2", { type: "ALL_IN" });
    expect(p.price).toBe(25); expect(p.actor).toBe("0");
    expect(() => act("0", { type: "RAISE", to: 35 })).toThrow();
    act("0", { type: "CALL" }); act("1", { type: "FOLD" });
    expect(p.stage).toBe("settlement");
    expect(p.seats[0].stack).toBe(75); expect(p.pots.reduce((s, x) => s + x.amount, 0)).toBe(70);
  });
  it("creates side pots, pays only eligible winners and conserves chips", () => {
    const { p, act } = table(); p.seats[0].stack = 30; p.seats[1].stack = 55;
    const initial = p.seats.reduce((n, s) => n + s.stack + s.total, 0);
    act("0", { type: "ALL_IN" }); act("1", { type: "ALL_IN" }); act("2", { type: "CALL" });
    expect(p.stage).toBe("settlement"); expect(p.pots.map(x => x.amount)).toEqual([90, 60]);
    expect(() => act("0", { type: "AWARD", pot: 1, winners: ["0"] })).toThrow();
    act("0", { type: "AWARD", pot: 0, winners: ["0"] }); act("0", { type: "AWARD", pot: 1, winners: ["1", "2"] });
    expect(p.stage).toBe("waiting"); expect(p.seats.reduce((n, s) => n + s.stack, 0)).toBe(initial);
    act("0", { type: "START" }); expect(p.dealer).toBe("1");
  });
  it("automatically pays the sole remaining player", () => {
    const { p, act } = table(); act("0", { type: "FOLD" }); act("1", { type: "FOLD" });
    expect(p.stage).toBe("waiting"); expect(p.seats.reduce((n, s) => n + s.stack, 0)).toBe(300);
  });
});
it("persists tools and projects dice only to their owner, including against the host", () => {
  const db = openDb(":memory:"); const rooms = new RoomService(db); const store = new ToolStore(rooms);
  const a = rooms.createRoom("甲", undefined); const b = rooms.joinRoom(a.roomCode, "乙", undefined);
  const code = a.roomCode; let count = 0;
  const act = (token: string, action: ToolAction, requestId = `request-${++count}`) => store.action(code, token, store.view(code, token).version, requestId, action);
  expect(() => act(b.sessionToken, { type: "SWITCH", tool: "dice" })).toThrow();
  act(a.sessionToken, { type: "SWITCH", tool: "dice" });
  const bv = act(b.sessionToken, { type: "ROLL" }, "roll-once");
  expect(bv.mine[0].values).toHaveLength(5); expect(bv.mine[0].values.every(x => x >= 1 && x <= 6)).toBe(true);
  expect(act(b.sessionToken, { type: "ROLL" }, "roll-once").mine).toEqual(bv.mine);
  const av = store.view(code, a.sessionToken); expect(av.mine).toEqual([]); expect(av).not.toHaveProperty("dice"); expect(av).not.toHaveProperty("rng");
  act(a.sessionToken, { type: "SWITCH", tool: "chips" }); act(a.sessionToken, { type: "SWITCH", tool: "dice" });
  expect(new ToolStore(rooms).view(code, b.sessionToken).mine).toEqual(bv.mine);
  expect(() => store.view(code, "invalid-token")).toThrow();
  expect(() => store.action(code, a.sessionToken, -1, "stale-action", { type: "SWITCH", tool: "chips" })).toThrow();
  db.close();
});
