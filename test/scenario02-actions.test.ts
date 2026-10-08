import { describe, expect, it } from "vitest";
import { activePlayerId, type Ctx } from "../src/server/engine/context.ts";
import { createGame } from "../src/server/engine/create.ts";
import { applyEffects } from "../src/server/engine/effects.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { neighbours } from "../src/server/engine/scenario02/city.ts";
import { ITEM_IDS02 } from "../src/shared/game/scenario02/items.ts";
import { ZONES, zoneIndex } from "../src/shared/game/scenario02/map.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { en } from "../src/shared/i18n/format.ts";
import { m } from "../src/shared/i18n/msg.ts";
import { rigNextDie, SEED, seatsFor, T0 } from "./helpers.ts";

// PHASE S2-3: what players do in the city. Rolls go through the shared dice
// (Fate and help apply); public work counts as contribution; what a player
// finds or learns is theirs until they share it; trading only moves goods.

const at = (id: string) => zoneIndex(id);
const ack = (s: GameState, t: number) => s.turnOrder.reduce((x, id) => applyGameAction(x, id, { type: "ACK_SEQUENCE" }, t).state, s);
let clock = T0 + 10;

/** A scenario 02 table at the first turn; everyone placed in `zone`, the active player first in `ids`. */
function table(zone: string, patch: (s: GameState, ids: string[]) => void = () => {}, n = 3) {
  const s = ack(startGame(createGame("g", seatsFor(n), SEED, T0, "S02_SUNKEN_CITY"), T0).state, T0 + 1);
  const me = activePlayerId(s)!;
  const ids = [me, ...s.turnOrder.filter((x) => x !== me)];
  for (const id of ids) s.players[id].carriageIndex = at(zone);
  patch(s, ids);
  return { s, ids };
}

/** Plays an action and answers every window that opens (Fate: `fate` spent; others: their default). */
function play(s: GameState, actor: string, action: GameAction, fate = "0"): GameState {
  let x = applyGameAction(s, actor, action, clock++).state;
  while (x.pending.length) {
    const w = x.pending[0];
    const pickFate = w.kind === "FATE_SPEND" && w.options.some((o) => o.id === fate);
    x = applyGameAction(x, w.addressees[0], { type: "RESPOND", windowId: w.id, optionId: pickFate ? fate : w.defaultOptionId }, clock++).state;
  }
  return x;
}

describe("search", () => {
  it("a success empties the zone's cache: parts go to the finder's holdings (not items), supplies to their items", () => {
    const { s, ids } = table("SHIPYARD", (x) => {
      x.city!.zones[at("SHIPYARD")].caches = ["ENGINE", "ROPE"];
      rigNextDie(x, 5);
    });
    const x = play(s, ids[0], { type: "SEARCH" });
    expect(x.city!.holdings[ids[0]].parts).toEqual(["ENGINE"]);
    expect(x.players[ids[0]].items).toEqual(["ROPE"]);
    expect(x.city!.zones[at("SHIPYARD")]).toMatchObject({ searched: true, caches: [] });
    expect(() => applyGameAction(x, ids[0], { type: "SEARCH" }, clock++)).toThrow(/picked clean/);
    // which part is the finder's to tell
    expect(project(x, ids[0]).city!.holdings[ids[0]]).toEqual({ parts: ["ENGINE"], partCount: 1, passes: 0 });
    expect(project(x, ids[1]).city!.holdings[ids[0]]).toEqual({ parts: null, partCount: 1, passes: null });
    expect(JSON.stringify(project(x, ids[1]))).not.toContain("ENGINE");
  });

  it("a failure leaves the zone to be searched again; a disaster costs Sanity", () => {
    const fail = table("QUARRY", (x) => rigNextDie(x, 2));
    const x = play(fail.s, fail.ids[0], { type: "SEARCH" });
    expect(x.city!.zones[at("QUARRY")].searched).toBe(false);
    const bad = table("QUARRY", (y) => rigNextDie(y, 1));
    expect(play(bad.s, bad.ids[0], { type: "SEARCH" }).players[bad.ids[0]].sanity).toBe(2);
  });
});

describe("knowing things", () => {
  it("an investigation's facts are true, go only to the investigator, and are public only once shared", () => {
    const { s, ids } = table("CIVIC_SQUARE", (x) => {
      x.city!.zones.forEach((z) => (z.caches = z.caches.filter((c) => c !== "FUEL")));
      x.city!.zones[at("CITY_HALL")].caches.push("FUEL");
      rigNextDie(x, 5);
    });
    const x = play(s, ids[0], { type: "INVESTIGATE" });
    const peeks = x.secrets[ids[0]].peeks.map((p) => en(p.text));
    expect(peeks.some((t) => t === "The Fuel Drums is hidden somewhere in City Hall Control Centre.")).toBe(true);
    const sink = peeks.find((t) => / goes under | will not go under/.test(t))!;
    const [, name, n] = sink.match(/^(.+?) goes under when the water rises (\d+) more times\.$/) ?? sink.match(/^(.+?) goes under at the next rise\.$/) ?? [];
    if (name && n) expect(x.city!.zones[ZONES.findIndex((z) => z.name === name)].sinkAt - x.collapse).toBe(Number(n));
    expect(JSON.stringify(project(x, ids[1]))).not.toContain("Fuel Drums");
    const shared = play(x, ids[0], { type: "SHARE_INTEL", intelId: x.secrets[ids[0]].peeks[0].id });
    expect(shared.players[ids[0]].ap).toBe(x.players[ids[0]].ap);
    expect(shared.log.some((l) => l.text.startsWith(`${shared.players[ids[0]].nickname} shares what they know: `))).toBe(true);
    expect(() => applyGameAction(shared, ids[0], { type: "SHARE_INTEL", intelId: x.secrets[ids[0]].peeks[0].id }, clock++)).toThrow(/already shared/);
  });
});

describe("working together", () => {
  it("each other worker on a job this round adds +1 to the roll, and the work counts as contribution", () => {
    const { s, ids } = table("POWER_STATION", (x, who) => {
      x.city!.facilities.POWER_STATION.workedThisRound = [who[1], who[2]];
      rigNextDie(x, 2);
    });
    const x = play(s, ids[0], { type: "REPAIR" });
    // a 2 alone fails; with two others already at it, it's a 4
    expect(x.city!.facilities.POWER_STATION.progress).toBe(1);
    expect(x.city!.contrib[ids[0]]).toBe(1);
    const alone = table("POWER_STATION", (y) => rigNextDie(y, 2));
    expect(play(alone.s, alone.ids[0], { type: "REPAIR" }).city!.facilities.POWER_STATION.progress).toBe(0);
  });

  it("finishing the power station powers it and holds back the next rise; a disaster sets the work back, and only at the power station raises Collapse", () => {
    const { s, ids } = table("POWER_STATION", (x) => {
      x.city!.facilities.POWER_STATION.progress = x.city!.facilities.POWER_STATION.required - 1;
      rigNextDie(x, 5);
    });
    const x = play(s, ids[0], { type: "REPAIR" });
    expect(x.city!.facilities.POWER_STATION.done).toBe(true);
    expect(x.city!.zones[at("POWER_STATION")].powered).toBe(true);
    expect(x.city!.hold).toBe(1);
    expect(() => applyGameAction(x, ids[0], { type: "REPAIR" }, clock++)).toThrow(/already working/);
    const bad = table("PUMP_STATION", (y) => {
      y.city!.facilities.PUMP_STATION.progress = 1;
      rigNextDie(y, 1);
    });
    const after = play(bad.s, bad.ids[0], { type: "REPAIR" });
    expect(after.city!.facilities.PUMP_STATION.progress).toBe(0);
    expect(after.collapse).toBe(bad.s.collapse);
    const blast = table("POWER_STATION", (y) => {
      y.city!.facilities.POWER_STATION.progress = 1;
      rigNextDie(y, 1);
    });
    expect(play(blast.s, blast.ids[0], { type: "REPAIR" }).collapse).toBe(blast.s.collapse + 1);
  });

  it("the pumps run only once repaired, once a round, and each run holds back up to 2 of the next rise", () => {
    const { s, ids } = table("PUMP_STATION");
    expect(() => applyGameAction(s, ids[0], { type: "OPERATE" }, clock++)).toThrow(/need repairing/);
    s.city!.facilities.PUMP_STATION.done = true;
    const x = play(s, ids[0], { type: "OPERATE" });
    expect(x.city!.hold).toBe(2);
    expect(() => applyGameAction(x, ids[0], { type: "OPERATE" }, clock++)).toThrow(/already running/);
  });
});

describe("people", () => {
  it("rescuing a waiting stranger is a roll; success saves them and pays their reward", () => {
    const { s, ids } = table("NIGHT_MARKET", (x) => {
      x.city!.npcs = [{ id: "CHILD", zone: at("NIGHT_MARKET"), state: "WAITING" }];
      rigNextDie(x, 5);
    });
    const x = play(s, ids[0], { type: "RESCUE", npcId: "CHILD" });
    expect(x.city!.npcs[0].state).toBe("RESCUED");
    expect(x.players[ids[0]].fate).toBe(s.players[ids[0]].fate + 2);
    expect(x.city!.contrib[ids[0]]).toBe(2);
  });

  it("a stranger nobody reached is lost when their zone goes under", () => {
    const { s } = table("CIVIC_SQUARE", (x) => {
      x.city!.npcs = [{ id: "TEACHER", zone: at("METRO"), state: "WAITING" }];
      x.city!.zones[at("METRO")].sinkAt = 1;
    });
    const ctx: Ctx = { s, now: T0, events: [] };
    applyEffects(ctx, [{ kind: "CHANGE_COLLAPSE", delta: 1 }], { ownerId: "SYSTEM", targets: [], label: m`test` });
    expect(s.city!.npcs[0].state).toBe("LOST");
  });

  it("a shaken companion in your zone can be talked down: +1 Sanity, no roll", () => {
    const { s, ids } = table("PARK", (x, who) => (x.players[who[1]].sanity = 1));
    const x = play(s, ids[0], { type: "RESCUE", targetId: ids[1] });
    expect(x.players[ids[1]].sanity).toBe(2);
    expect(x.players[ids[0]].ap).toBe(s.players[ids[0]].ap - 1);
  });
});

describe("risk and items", () => {
  it("salvage needs a flooded or doomed zone, once a round there; a success finds an item and 1 Fate", () => {
    const dry = table("CIVIC_SQUARE");
    expect(() => applyGameAction(dry.s, dry.ids[0], { type: "SALVAGE" }, clock++)).toThrow(/flooded zone/);
    const { s, ids } = table("METRO", (x) => {
      x.city!.zones[at("METRO")].status = "FLOODED";
      rigNextDie(x, 5);
    });
    const x = play(s, ids[0], { type: "SALVAGE" });
    expect(x.players[ids[0]].items).toHaveLength(1);
    expect(ITEM_IDS02).toContain(x.players[ids[0]].items[0]);
    expect(x.players[ids[0]].fate).toBe(s.players[ids[0]].fate + 1);
    expect(() => applyGameAction(x, ids[0], { type: "SALVAGE" }, clock++)).toThrow(/salvaged this round/);
  });

  it("a life jacket turns a failed wade into a safe one", () => {
    const { s, ids } = table("CIVIC_SQUARE", (x, who) => {
      x.city!.zones[at("CITY_HALL")].status = "FLOODED";
      x.players[who[0]].statuses.push({ id: "lj", kind: "BUOYANT", polarity: "POSITIVE", sourceId: "SYSTEM", expiresAtRound: null, hidden: false, ordinary: true });
      x.players[who[0]].fate = 0;
      rigNextDie(x, 1);
    });
    const x = play(s, ids[0], { type: "MOVE", toCarriage: at("CITY_HALL") });
    expect(x.players[ids[0]]).toMatchObject({ carriageIndex: at("CITY_HALL"), sanity: 3 });
    expect(x.players[ids[0]].statuses.some((st) => st.kind === "BUOYANT")).toBe(false);
  });

  it("a raft crosses one sunken zone to dry ground beyond, and is spent", () => {
    const { s, ids } = table("CIVIC_SQUARE", (x, who) => {
      x.city!.zones[at("METRO")].status = "SUBMERGED";
      x.players[who[0]].items.push("INFLATABLE_RAFT");
    });
    const beyond = neighbours(s.city!, at("METRO")).find((z) => !neighbours(s.city!, at("CIVIC_SQUARE")).includes(z) && z !== at("CIVIC_SQUARE"))!;
    const x = play(s, ids[0], { type: "MOVE", toCarriage: beyond });
    expect(x.players[ids[0]].carriageIndex).toBe(beyond);
    expect(x.players[ids[0]].items).not.toContain("INFLATABLE_RAFT");
  });

  it("an ability that grants an item draws from this scenario's items", () => {
    const { s, ids } = table("CIVIC_SQUARE");
    const ctx: Ctx = { s, now: T0, events: [] };
    for (let i = 0; i < 20; i++) applyEffects(ctx, [{ kind: "GRANT_ITEM", who: "SELF", pool: "ANY", count: 1 }], { ownerId: ids[0], self: ids[0], targets: [], label: m`test` });
    for (const item of s.players[ids[0]].items) expect(ITEM_IDS02).toContain(item);
  });
});

describe("trade", () => {
  it("is free, moves boat parts at once, and completing it triggers nothing", () => {
    const { s, ids } = table("CIVIC_SQUARE", (x, who) => (x.city!.holdings[who[1]].parts = ["NAV"]));
    const offered = applyGameAction(s, ids[0], { type: "TRADE", targetId: ids[1], give: { items: [], fate: 1 }, want: { items: [], fate: 0, parts: ["NAV"] } }, clock++).state;
    expect(offered.players[ids[0]].ap).toBe(s.players[ids[0]].ap);
    const w = offered.pending[0];
    const done = applyGameAction(offered, ids[1], { type: "RESPOND", windowId: w.id, optionId: "ACCEPT" }, clock++).state;
    expect(done.city!.holdings[ids[0]].parts).toEqual(["NAV"]);
    expect(done.city!.holdings[ids[1]].parts).toEqual([]);
    expect(done.players[ids[1]].fate).toBe(s.players[ids[1]].fate + 1);
    expect(done.triggerQueue).toEqual([]);
    expect(done.city!.contrib).toEqual(s.city!.contrib);
  });

  it("a player can make three offers a round, then must wait", () => {
    let { s, ids } = table("CIVIC_SQUARE");
    const offer: GameAction = { type: "TRADE", targetId: ids[1], give: { items: [], fate: 1 }, want: { items: [], fate: 0 } };
    for (let i = 0; i < 3; i++) s = play(s, ids[0], offer);
    expect(() => applyGameAction(s, ids[0], offer, clock++)).toThrow(/3 offers this round/);
  });
});
