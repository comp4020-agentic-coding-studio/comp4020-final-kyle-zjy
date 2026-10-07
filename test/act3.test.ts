import { describe, expect, it } from "vitest";
import { en, format } from "../src/shared/i18n/format.ts";
import { availableActions } from "../src/server/engine/actions.ts";
import type { Ctx } from "../src/server/engine/context.ts";
import { inspectorPhase } from "../src/server/engine/inspector.ts";
import { project } from "../src/server/engine/project.ts";
import type { CarriageIdentity, GameState } from "../src/shared/game/state.ts";
import { rigNextDie, Table } from "./helpers.ts";

// Act 3 (rounds 8–12): echoes, the faster Inspector, the escape protocol,
// every way a run ends, and the results.

const turnsOf = (round: number) => (s: GameState) => s.round === round && s.step === "PLAYER_TURNS" && !s.sequence && !s.pending.length;
const ctxOf = (s: GameState): Ctx => ({ s, now: 0, events: [] });
const indexOf = (s: GameState, identity: CarriageIdentity) => s.carriages.find((c) => c.identity === identity)!.index;

function atRound(n: number, round: number): Table {
  const t = new Table(n);
  t.playUntil(turnsOf(round));
  return t;
}

function edit(t: Table, patch: (s: GameState) => void): void {
  const s = structuredClone(t.state);
  patch(s);
  t.state = s;
}

const drain = (t: Table, option?: string) => {
  while (t.state.pending.length) t.answerAll(option);
};

/** Everything for an escape is in place except the Memory Escape Lock, which the active player (with its key) is about to try in the cab. */
function lastLock(n = 3, patch: (s: GameState, me: string) => void = () => {}) {
  const t = atRound(n, 8);
  const me = t.active!;
  edit(t, (s) => {
    for (const a of Object.values(s.anchors)) Object.assign(a, { progress: a.required, repaired: true });
    s.fragments = ["ROUTE", "DRIVER", "MANIFEST"];
    s.escape = { round: s.round, power: true, identity: true, memory: false, by: {} };
    s.players[me].carriageIndex = indexOf(s, "CAB");
    s.players[me].items.push("MEMORY_KEY");
    s.players[me].fate = 0;
    patch(s, me);
    rigNextDie(s, 4);
  });
  return { t, me };
}

const escape = (t: Table, me: string) => {
  t.act(me, { type: "REPAIR" });
  drain(t);
  return t.state;
};

describe("act 3: the train", () => {
  it.each([
    [3, 1, 1],
    [5, 2, 2],
    [8, 3, 2],
  ])("with %i players: %i echoes board in round 8 and the Inspector walks %i a round", (n, echoes, steps) => {
    const t = atRound(n, 8);
    expect(t.state.entities.filter((e) => e.kind === "ECHO")).toHaveLength(echoes);
    const s = structuredClone(t.state);
    s.nightRule = "FULL_MOON";
    for (const p of Object.values(s.players)) p.carriageIndex = 0;
    s.inspector.carriageIndex = 6;
    s.inspector.banishedUntilRound = null;
    s.entities = [];
    inspectorPhase(ctxOf(s));
    expect(s.inspector.carriageIndex).toBe(6 - steps);
  });

  it("echoes stalk whoever stands at a lock, and their touch costs an action point next round", () => {
    const t = atRound(3, 8);
    const s = structuredClone(t.state);
    const cab = indexOf(s, "CAB");
    for (const p of Object.values(s.players)) p.carriageIndex = 0;
    s.players.b.carriageIndex = cab;
    s.entities = [{ id: "e1", kind: "ECHO", carriageIndex: cab - 1, hp: 2, targetId: null }];
    s.inspector.active = false;
    inspectorPhase(ctxOf(s));
    expect(s.entities[0]).toMatchObject({ targetId: "b", carriageIndex: cab });
    expect(s.jobs).toEqual([{ kind: "ECHO_STRIKE", playerId: "b", payload: { echoId: "e1" } }]);
    t.state = s;
    t.tick(1);
    expect(t.state.players.b.statuses.map((x) => x.kind)).toContain("CHILL");
    t.playUntil(turnsOf(9));
    expect(t.state.players.b.ap).toBe(1);
    expect(t.state.players.a.ap).toBe(2);
  });

  it("two passengers get 3 action points a round, and 4 in act 3; three get 2", () => {
    expect(Object.values(atRound(2, 7).state.players).map((p) => p.ap)).toEqual([3, 3]);
    expect(Object.values(atRound(2, 8).state.players).map((p) => p.ap)).toEqual([4, 4]);
    // a passenger lost to a ticket check acts with 1
    expect(Object.values(atRound(3, 8).state.players).map((p) => (p.lost ? 2 : p.ap))).toEqual([2, 2, 2]);
  });

  it("a shield absorbs an echo's touch", () => {
    const t = atRound(3, 8);
    edit(t, (s) => {
      s.players.b.shields = 1;
      s.jobs.push({ kind: "ECHO_STRIKE", playerId: "b", payload: { echoId: "e1" } });
    });
    t.tick(1);
    expect(t.state.players.b.statuses.map((x) => x.kind)).not.toContain("CHILL");
    expect(t.state.players.b.shields).toBe(0);
  });
});

describe("act 3: escape locks", () => {
  it("each lock is engaged by a successful repair at its carriage, once per round", () => {
    const t = atRound(3, 8);
    const me = t.active!;
    edit(t, (s) => {
      for (const a of Object.values(s.anchors)) Object.assign(a, { progress: a.required, repaired: true });
      s.players[me].carriageIndex = indexOf(s, "ENGINE_ROOM");
      s.players[me].items.push("POWER_KEY");
      s.players[me].fate = 0;
      rigNextDie(s, 5);
    });
    t.act(me, { type: "REPAIR" });
    drain(t);
    expect(t.state.escape).toMatchObject({ round: 8, power: true, identity: false, memory: false, by: { power: me } });
    expect(() => t.act(me, { type: "REPAIR" })).toThrow(/already engaged this round/);
  });

  it("a broken anchor comes first: repairing at the Engine Room works on it, not the lock", () => {
    const t = atRound(3, 8);
    const me = t.active!;
    edit(t, (s) => {
      s.players[me].carriageIndex = indexOf(s, "ENGINE_ROOM");
      s.players[me].fate = 0;
      rigNextDie(s, 4);
    });
    t.act(me, { type: "REPAIR" });
    drain(t);
    expect(t.state.anchors.POWER.repaired).toBe(true);
    expect(t.state.escape.power).toBe(false);
  });

  it("the Identity Escape Lock needs three fragment types", () => {
    const t = atRound(3, 8);
    const me = t.active!;
    edit(t, (s) => {
      s.anchors.IDENTITY.repaired = true;
      s.players[me].items.push("IDENTITY_KEY");
      s.fragments = ["ROUTE", "DRIVER"];
      s.players[me].carriageIndex = indexOf(s, "ARCHIVE");
    });
    expect(() => t.act(me, { type: "REPAIR" })).toThrow(/needs 3 memory fragment types \(you have 2\)/);
  });

  it("without the lock's key the Repair button is disabled and says which key is missing", () => {
    const t = atRound(3, 8);
    const me = t.active!;
    edit(t, (s) => {
      for (const a of Object.values(s.anchors)) Object.assign(a, { progress: a.required, repaired: true });
      s.players[me].carriageIndex = indexOf(s, "ENGINE_ROOM");
      s.players[me].items.push("IDENTITY_KEY", "MEMORY_KEY");
    });
    const repair = availableActions(t.state, me).find((a) => a.type === "REPAIR")!;
    expect(repair.enabled).toBe(false);
    expect(en(repair.reason)).toBe("The Power Escape Lock needs the Power Key, and you aren't carrying it.");
    expect(format("zh-CN", repair.reason!)).toContain("动力钥匙");
    expect(() => t.act(me, { type: "REPAIR" })).toThrow(/needs the Power Key/);
  });

  it("a traded key moves the right to work its lock at once", () => {
    const t = atRound(3, 8);
    const [me, mate] = [t.active!, t.state.turnOrder.find((x) => x !== t.active)!];
    edit(t, (s) => {
      for (const a of Object.values(s.anchors)) Object.assign(a, { progress: a.required, repaired: true });
      for (const id of [me, mate]) s.players[id].carriageIndex = indexOf(s, "ENGINE_ROOM");
      s.players[mate].items.push("POWER_KEY");
    });
    // as if it were each one's turn
    const canRepair = (id: string) => {
      const s = structuredClone(t.state);
      s.activeIndex = s.turnOrder.indexOf(id);
      s.players[id].ap = 2;
      return availableActions(s, id).find((a) => a.type === "REPAIR")!.enabled;
    };
    expect([canRepair(me), canRepair(mate)]).toEqual([false, true]);
    t.act(me, { type: "TRADE", targetId: mate, give: { items: [], fate: 0 }, want: { items: ["POWER_KEY"], fate: 0 } });
    t.answerAll("ACCEPT");
    expect(t.state.players[me].items).toContain("POWER_KEY");
    expect(t.state.players[mate].items).not.toContain("POWER_KEY");
    expect([canRepair(me), canRepair(mate)]).toEqual([true, false]);
  });

  it("locks that don't all hold in one round slip back at the next, and the keys stay where they are", () => {
    const t = atRound(3, 8);
    edit(t, (s) => {
      s.escape = { round: s.round, power: true, identity: true, memory: false, by: {} };
      s.players[s.turnOrder[0]].items.push("POWER_KEY", "IDENTITY_KEY");
    });
    t.playUntil(turnsOf(9));
    expect(t.state.escape).toMatchObject({ round: null, power: false, identity: false });
    expect(t.state.players[t.state.turnOrder[0]].items).toEqual(expect.arrayContaining(["POWER_KEY", "IDENTITY_KEY"]));
    expect(t.state.log.some((l) => l.text.includes("2/3 is not enough"))).toBe(true);
  });
});

describe("endings", () => {
  it("the third lock with everything else in place escapes: normal ending, then results", () => {
    const { t, me } = lastLock();
    const s = escape(t, me);
    expect(s).toMatchObject({ outcome: "NORMAL", phase: "ENDING", failReason: null });
    expect(s.sequence?.kind).toBe("ENDING");
    expect(s.results).toHaveLength(3);
    expect(() => t.act(me, { type: "END_TURN" })).toThrow();
    t.tick(10 * 60_000);
    expect(t.state.phase).toBe("ENDING"); // the scene waits for everyone
    t.ackAll();
    expect(t.state.phase).toBe("RESULTS");
  });

  it.each([
    ["a broken anchor", (s: GameState) => (s.anchors.MEMORY.repaired = false), "1 reality anchor still broken"],
    ["two fragment types", (s: GameState) => (s.fragments = ["ROUTE", "DRIVER"]), "only 2/3 memory fragment types"],
    ["two of three passengers lost", (s: GameState) => ["b", "c"].forEach((id) => (s.players[id].lost = true)), "more than half the passengers are lost"],
  ])("all three locks with %s doesn't escape, and says why", (_, patch, why) => {
    const { t, me } = lastLock(3, patch);
    const s = escape(t, me);
    expect(s.outcome).toBeNull();
    expect(s.escape).toMatchObject({ power: true, identity: true, memory: true });
    expect(s.log.some((l) => l.text.includes("won't let go") && l.text.includes(why))).toBe(true);
  });

  it("two locks and everything else in place is just two locks: no ending, no false alarm", () => {
    const { t } = lastLock();
    t.tick(1);
    expect(t.state.outcome).toBeNull();
    expect(t.state.log.some((l) => l.text.includes("won't let go"))).toBe(false);
  });

  it("exactly half the passengers lost still escapes", () => {
    const { t, me } = lastLock(4, (s, id) => s.turnOrder.filter((x) => x !== id).slice(0, 2).forEach((x) => (s.players[x].lost = true)));
    expect(escape(t, me).outcome).toBe("NORMAL");
  });

  it("with six core memories everyone chooses; the majority decides the true ending", () => {
    const { t, me } = lastLock(3, (s) => (s.coreMemories = 6));
    t.act(me, { type: "REPAIR" });
    while (t.state.pending.at(-1) && t.state.pending.at(-1)!.kind !== "ENDING_CHOICE") t.answerAll();
    expect(t.state.outcome).toBeNull();
    const w = t.state.pending.at(-1)!;
    expect(w.kind).toBe("ENDING_CHOICE");
    for (const [i, id] of w.addressees.entries()) t.act(id, { type: "RESPOND", windowId: w.id, optionId: i === 0 ? "TICKET" : "DELETE" });
    expect(t.state).toMatchObject({ outcome: "TRUE_DELETE", endingChoice: "DELETE", phase: "ENDING" });
  });

  it("an unanswered last choice waits; the host's skip gives it a ticket", () => {
    const { t, me } = lastLock(3, (s) => (s.coreMemories = 6));
    t.act(me, { type: "REPAIR" });
    while (t.state.pending.at(-1) && t.state.pending.at(-1)!.kind !== "ENDING_CHOICE") t.answerAll();
    t.tick(10 * 60_000);
    expect(t.state.outcome).toBeNull(); // nobody is rushed
    t.skip();
    expect(t.state.outcome).toBe("TRUE_TICKET");
  });

  it("Collapse reaching 12 ends the run at once", () => {
    const t = atRound(3, 8);
    edit(t, (s) => (s.collapse = 11));
    t.playUntil((s) => s.outcome !== null);
    expect(t.state).toMatchObject({ outcome: "FAILED", failReason: "COLLAPSE", round: 8 });
  });

  it("everyone lost at once ends the run", () => {
    const t = atRound(3, 8);
    edit(t, (s) => Object.values(s.players).forEach((p) => (p.lost = true)));
    t.tick(1);
    expect(t.state).toMatchObject({ outcome: "FAILED", failReason: "ALL_LOST" });
  });

  it("the end of round 12 without an escape fails on time", () => {
    const t = atRound(3, 8);
    edit(t, (s) => (s.collapse = 0));
    t.playUntil(turnsOf(12));
    edit(t, (s) => (s.collapse = 0));
    t.playUntil((s) => s.outcome !== null);
    expect(t.state).toMatchObject({ outcome: "FAILED", failReason: "TIME", round: 12 });
  });
});

describe("results", () => {
  it("obsessions are judged from what each passenger did", () => {
    const { t, me } = lastLock(3, (s, id) => {
      const other = s.turnOrder.find((x) => x !== id)!;
      s.secrets[id].obsession = "LONE_WOLF"; // this unaided lock is a key task
      s.secrets[other].obsession = "LUCKY";
      s.players[other].stats.perfects = 0;
    });
    const s = escape(t, me);
    const other = s.turnOrder.find((x) => x !== me)!;
    expect(s.results!.find((r) => r.playerId === me)).toMatchObject({ obsession: "LONE_WOLF", obsessionMet: true });
    expect(s.results!.find((r) => r.playerId === other)).toMatchObject({ obsession: "LUCKY", obsessionMet: false });
  });

  it("a title held alone beats one shared, so a tie doesn't name everyone the same", () => {
    const { t, me } = lastLock(2, (s, id) => {
      for (const p of Object.values(s.players)) Object.assign(p.stats, { perfects: 2, repairs: 0, helpsGiven: 0, confronts: 0, fragmentsFound: 0, fateSpentOnDice: 0, carriagesVisited: [] });
      s.players[id].stats.repairs = 3;
    });
    const s = escape(t, me);
    const other = s.turnOrder.find((x) => x !== me)!;
    expect(en(s.results!.find((r) => r.playerId === me)!.title)).toBe("The Train's Mechanic");
    expect(en(s.results!.find((r) => r.playerId === other)!.title)).toBe("Fate's Favourite");
  });

  it("a help on the final roll means it wasn't a lone-wolf task", () => {
    const { t, me } = lastLock(3, (s, id) => {
      s.secrets[id].obsession = "LONE_WOLF";
      s.players[id].helpBonus = 1;
      rigNextDie(s, 3);
    });
    const s = escape(t, me);
    expect(s.outcome).toBe("NORMAL");
    expect(s.results!.find((r) => r.playerId === me)!.obsessionMet).toBe(false);
  });

  it("once the run is over everyone sees the results, but before it nobody sees them", () => {
    const { t, me } = lastLock();
    expect(project(t.state, me).results).toBeNull();
    const s = escape(t, me);
    const view = project(s, s.turnOrder.find((x) => x !== me)!);
    expect(view.results!.map((r) => r.obsession)).toEqual(s.turnOrder.map((id) => s.secrets[id].obsession));
  });
});
