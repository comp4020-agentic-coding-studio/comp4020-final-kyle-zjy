import { describe, expect, it } from "vitest";
import { en } from "../src/shared/i18n/format.ts";
import { m } from "../src/shared/i18n/msg.ts";
import { createGame } from "../src/server/engine/create.ts";
import { applyEffects } from "../src/server/engine/effects.ts";
import { next } from "../src/server/engine/rng.ts";
import { project } from "../src/server/engine/project.ts";
import { OBSESSION_IDS } from "../src/shared/game/scenario01/content.ts";
import type { CarriageIdentity, GameState, ItemId } from "../src/shared/game/state.ts";
import { rigNextDie, SEED, seatsFor, T0, Table } from "./helpers.ts";

// Act 1 (rounds 1–3): what each carriage gives, items, the public events and
// the round-3 blackout into act 2.

/** Puts the active player in a carriage with no Fate (so no Fate window) and the given die result next. */
function setUp(t: Table, identity: CarriageIdentity, die: number, patch: (s: GameState, me: string) => void = () => {}): string {
  const me = t.active!;
  const s = structuredClone(t.state);
  s.players[me].carriageIndex = s.carriages.find((c) => c.identity === identity)!.index;
  s.players[me].fate = 0;
  patch(s, me);
  rigNextDie(s, die);
  t.state = s;
  return me;
}

const roll = (t: Table, me: string, type: "INVESTIGATE" | "SEARCH") => {
  t.act(me, { type });
  while (t.state.pending.length) t.answerAll();
  return t.state;
};

describe("act 1: investigating", () => {
  it("a success in the Archive Car recovers the Passenger List fragment", () => {
    const t = new Table(3);
    const me = setUp(t, "ARCHIVE", 4);
    const s = roll(t, me, "INVESTIGATE");
    expect(s.fragments).toEqual(["MANIFEST"]);
    expect(s.players[me].stats).toMatchObject({ fragmentsFound: 1, hiddenInvestigations: 1 });
  });

  it("a Perfect also wakes that carriage's core memory, once", () => {
    const t = new Table(3);
    const me = setUp(t, "ARCHIVE", 6);
    let s = roll(t, me, "INVESTIGATE");
    expect(s.coreMemories).toBe(1);
    expect(s.fragments).toContain("MANIFEST");
    setUp(t, "ARCHIVE", 6, (x) => (x.players[me].ap = 1));
    s = roll(t, me, "INVESTIGATE");
    expect(s.coreMemories).toBe(1);
    expect(s.players[me].fate).toBe(1); // nothing left to find: a clue instead
  });

  it("a success where the fragment is already found gives a clue (+1 Fate)", () => {
    const t = new Table(3);
    const me = setUp(t, "MIRROR", 5, (s) => (s.fragments = ["DRIVER"]));
    const s = roll(t, me, "INVESTIGATE");
    expect(s.fragments).toEqual(["DRIVER"]);
    expect(s.players[me].fate).toBe(1);
  });

  it("a disaster in the Mirror Car costs Sanity and wakes a shadow passenger, but leaves Collapse alone", () => {
    const t = new Table(3);
    const me = setUp(t, "MIRROR", 1);
    const s = roll(t, me, "INVESTIGATE");
    expect(s.players[me].sanity).toBe(2);
    expect(s.entities).toMatchObject([{ kind: "SHADOW", carriageIndex: s.players[me].carriageIndex }]);
    expect(s.collapse).toBe(0); // exploring risks the explorer; only key tasks raise Collapse
  });

  it("the Sleeper Car gives the Route fragment and a private dream card", () => {
    const t = new Table(3);
    const me = setUp(t, "SLEEPER", 4);
    const s = roll(t, me, "INVESTIGATE");
    expect(s.fragments).toContain("ROUTE");
    expect(s.secrets[me].dreamCards).toHaveLength(1);
    const other = s.turnOrder.find((id) => id !== me)!;
    expect(JSON.stringify(project(s, other))).not.toContain(s.secrets[me].dreamCards[0].text);
    expect(project(s, me).mySecrets!.dreamCards).toHaveLength(1);
  });

  it("a failure changes nothing but the action point", () => {
    const t = new Table(3);
    const me = setUp(t, "ARCHIVE", 2);
    const before = structuredClone(t.state.players[me]);
    const s = roll(t, me, "INVESTIGATE");
    expect(s.fragments).toEqual([]);
    expect(s.players[me]).toMatchObject({ fate: before.fate, sanity: before.sanity, ap: before.ap - 1, items: before.items });
  });
});

describe("act 1: searching", () => {
  it("the Luggage Car gives an item (two on a Perfect)", () => {
    const t = new Table(3);
    const me = setUp(t, "LUGGAGE", 4);
    expect(roll(t, me, "SEARCH").players[me].items).toHaveLength(2);
    setUp(t, "LUGGAGE", 6, (s) => (s.players[me].ap = 1));
    expect(roll(t, me, "SEARCH").players[me].items).toHaveLength(4);
  });

  it("the Dining Car restores Sanity if you need it, Fate otherwise; a bad dish costs Sanity", () => {
    const t = new Table(3);
    const me = setUp(t, "DINING", 4, (s, id) => (s.players[id].sanity = 2));
    expect(roll(t, me, "SEARCH").players[me]).toMatchObject({ sanity: 3, fate: 0 });
    setUp(t, "DINING", 5, (s) => (s.players[me].ap = 1));
    expect(roll(t, me, "SEARCH").players[me]).toMatchObject({ sanity: 3, fate: 1 });
    const t2 = new Table(3);
    const me2 = setUp(t2, "DINING", 1);
    expect(roll(t2, me2, "SEARCH").players[me2].sanity).toBe(2);
  });

  it("the Engine Room turns up a spare battery", () => {
    const t = new Table(3);
    const me = setUp(t, "ENGINE_ROOM", 4, (s, id) => (s.players[id].items = []));
    expect(roll(t, me, "SEARCH").players[me].items).toEqual(["SPARE_BATTERY"]);
  });
});

describe("act 1: moving and items", () => {
  it("coming back to the Boarding Car the first time restores 1 Sanity, only once", () => {
    const t = new Table(2);
    const me = t.active!;
    t.state = { ...structuredClone(t.state) };
    t.state.players[me].sanity = 1;
    t.act(me, { type: "MOVE", toCarriage: 1 });
    t.act(me, { type: "MOVE", toCarriage: 0 });
    expect(t.state.players[me].sanity).toBe(2);
    t.state.players[me].ap = 2;
    t.act(me, { type: "MOVE", toCarriage: 1 });
    t.act(me, { type: "MOVE", toCarriage: 0 });
    expect(t.state.players[me].sanity).toBe(2);
  });

  const withItem = (item: ItemId) => {
    const t = new Table(3);
    const me = t.active!;
    t.state = structuredClone(t.state);
    t.state.players[me].items = [item];
    return { t, me };
  };

  it("the Flashlight adds +2 to the next investigation", () => {
    const { t, me } = withItem("FLASHLIGHT");
    t.act(me, { type: "USE_ITEM", item: "FLASHLIGHT" });
    expect(t.state.players[me].items).toEqual([]);
    t.act(me, { type: "INVESTIGATE" });
    expect(t.state.roll!.modifiers).toContainEqual({ source: { k: "@item", p: ["FLASHLIGHT"] }, delta: 2 });
  });

  it("the Spare Battery adds an action point; the Pocket Watch winds Collapse back", () => {
    const { t, me } = withItem("SPARE_BATTERY");
    t.act(me, { type: "USE_ITEM", item: "SPARE_BATTERY" });
    expect(t.state.players[me].ap).toBe(3);
    const w = withItem("POCKET_WATCH");
    w.t.state.collapse = 4;
    w.t.act(w.me, { type: "USE_ITEM", item: "POCKET_WATCH" });
    expect(w.t.state.collapse).toBe(3);
  });

  it("the Medkit heals someone in your carriage, not across the train", () => {
    const { t, me } = withItem("MEDKIT");
    const mate = t.state.turnOrder.find((id) => id !== me)!;
    t.state.players[mate].sanity = 1;
    t.act(me, { type: "USE_ITEM", item: "MEDKIT", targetId: mate });
    expect(t.state.players[mate].sanity).toBe(2);
    const far = withItem("MEDKIT");
    const other = far.t.state.turnOrder.find((id) => id !== far.me)!;
    far.t.state.players[other].carriageIndex = 4;
    expect(() => far.t.act(far.me, { type: "USE_ITEM", item: "MEDKIT", targetId: other })).toThrow();
  });

  it("the Red Umbrella's shield blocks the next negative effect", () => {
    const { t, me } = withItem("RED_UMBRELLA");
    t.act(me, { type: "USE_ITEM", item: "RED_UMBRELLA" });
    expect(t.state.players[me].shields).toBe(1);
    setUp(t, "DINING", 1, (s) => (s.players[me].ap = 1));
    const s = roll(t, me, "SEARCH");
    expect(s.players[me]).toMatchObject({ sanity: 3, shields: 0 });
  });
});

describe("act 1: public events", () => {
  const withDeck = (deck: string[], n = 3) => {
    const t = new Table(n);
    t.state = structuredClone(t.state);
    t.state.eventDeck = deck;
    return t;
  };

  it("an instant event applies at once: ticket stubs give everyone 1 Fate", () => {
    const t = withDeck(["TICKET_STUBS"]);
    const before = Object.values(t.state.players).map((p) => p.fate);
    t.playUntil((s) => !!s.currentEvent?.resolved);
    expect(Object.values(t.state.players).map((p) => p.fate)).toEqual(before.map((f) => f + 1));
  });

  it("cards from later acts are never drawn in act 1", () => {
    const t = withDeck(["TUNNEL_DRAFT", "INSPECTORS_WHISTLE", "TICKET_STUBS"]);
    t.playUntil((s) => !!s.currentEvent);
    expect(t.state.currentEvent!.id).toBe("TICKET_STUBS");
    expect(t.state.eventDeck).toEqual(["TUNNEL_DRAFT", "INSPECTORS_WHISTLE"]);
  });

  it("a vote is decided by the majority and nobody sees the others' votes until it closes", () => {
    const t = withDeck(["WRONG_PLATFORM"]);
    t.playUntil((s) => s.pending.at(-1)?.kind === "VOTE");
    const w = t.state.pending.at(-1)!;
    expect(w.addressees).toHaveLength(3);
    const [a, b, c] = w.addressees;
    t.act(a, { type: "RESPOND", windowId: w.id, optionId: "CORD" });
    expect(project(t.state, b).pending[0].myAnswer).toBeNull();
    t.act(b, { type: "RESPOND", windowId: w.id, optionId: "CORD" });
    const collapse = t.state.collapse;
    t.act(c, { type: "RESPOND", windowId: w.id, optionId: "QUIET" });
    expect(t.state.currentEvent).toMatchObject({ resolved: true, choice: "CORD" });
    // +1 from pulling the cord, +1 as the round then ends
    expect(t.state.collapse).toBe(collapse + 2);
  });

  it("an each-chooses event applies every player's own choice", () => {
    const t = withDeck(["MUSIC_FROM_THE_DINING_CAR"]);
    for (const p of Object.values(t.state.players)) p.sanity = 2;
    t.playUntil((s) => s.pending.at(-1)?.kind === "EVENT_CHOICE");
    const w = t.state.pending.at(-1)!;
    const [a, b, c] = w.addressees;
    const fate = { ...Object.fromEntries(Object.values(t.state.players).map((p) => [p.playerId, p.fate])) };
    t.act(a, { type: "RESPOND", windowId: w.id, optionId: "DANCE" });
    t.act(b, { type: "RESPOND", windowId: w.id, optionId: "REST" });
    t.act(c, { type: "RESPOND", windowId: w.id, optionId: "DANCE" });
    expect(t.state.players[a].fate).toBe(fate[a] + 1);
    expect(t.state.players[b]).toMatchObject({ fate: fate[b], sanity: 3 });
  });

  it("an unanswered vote waits as long as it takes; the host's skip gives the default", () => {
    const t = withDeck(["WRONG_PLATFORM"]);
    t.playUntil((s) => s.pending.at(-1)?.kind === "VOTE");
    t.tick(10 * 60_000);
    expect(t.state.pending.at(-1)?.kind).toBe("VOTE");
    t.skip();
    expect(t.state.currentEvent).toMatchObject({ resolved: true, choice: "QUIET" });
  });

  it("a group roll resolves for everyone without stopping the table", () => {
    const t = withDeck(["FLICKERING_LIGHTS"]);
    t.playUntil((s) => !!s.currentEvent?.resolved);
    expect(t.state.currentEvent!.resultText!.p).toHaveLength(3);
  });
});

describe("act 1 → act 2", () => {
  it("round 3 ends in a blackout; the passenger count glitches; round 4 opens act 2", () => {
    const t = new Table(3);
    t.playUntil((s) => s.phase === "ACT_2");
    expect(t.state).toMatchObject({ act: 2, sequence: { kind: "BLACKOUT" } });
    expect(t.state.log.some((l) => l.text.includes("Passengers on board: 4"))).toBe(true);
    t.playUntil((s) => s.round === 4 && s.step === "PLAYER_TURNS");
    expect(t.state.inspector.active).toBe(true);
    expect(t.state.collapse).toBeGreaterThanOrEqual(3);
  });
});

describe("a run's setup", () => {
  it("carriage order, night rule and turn order vary by seed; Boarding first, Cab last", () => {
    const layouts = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const s = createGame("g", seatsFor(4), i.toString(16).padStart(32, "7"), T0);
      expect(s.carriages[0].identity).toBe("START");
      expect(s.carriages.at(-1)!.identity).toBe("CAB");
      layouts.add(s.carriages.map((c) => c.identity).join());
    }
    expect(layouts.size).toBeGreaterThan(6);
  });

  it("every passenger gets a different secret obsession", () => {
    const s = createGame("g", seatsFor(10), SEED, T0);
    const dealt = Object.values(s.secrets).map((x) => x.obsession);
    expect(new Set(dealt).size).toBe(10);
    expect(dealt.every((o) => o && OBSESSION_IDS.includes(o))).toBe(true);
  });

  it.each([2, 3, 4, 6, 7, 10])("tunes the scenario for %i players", (n) => {
    const s = createGame("g", seatsFor(n), SEED, T0);
    expect(Object.keys(s.players)).toHaveLength(n);
    expect(s.config.anchorRequired).toBe(n <= 3 ? 1 : n <= 5 ? 2 : n <= 7 ? 3 : 4);
    expect(s.config.bonusAp).toBe(n === 2 ? 1 : 0);
    expect(s.collapse).toBe(n <= 5 ? 0 : n <= 7 ? 1 : 2);
    expect(s.config.inspectorTargets).toBe(n >= 7 ? 2 : 1);
    expect(s.config.echoes).toBe(n <= 3 ? 1 : n <= 6 ? 2 : 3);
  });

  it("Lucky Night starts everyone on 3 Fate; Void Hour locks abilities for round 1 only", () => {
    const find = (rule: string) => {
      for (let i = 0; i < 400; i++) {
        const seed = i.toString(16).padStart(32, "a");
        if (createGame("g", seatsFor(2), seed, T0).nightRule === rule) return seed;
      }
      throw new Error(`no seed for ${rule}`);
    };
    const lucky = new Table(2, { seed: find("LUCKY_NIGHT") });
    expect(Object.values(lucky.state.players).every((p) => p.fate === 3)).toBe(true);
    const voidHour = new Table(2, { seed: find("VOID_HOUR") });
    expect(Object.values(voidHour.state.players).every((p) => p.skill.state === "LOCKED")).toBe(true);
    voidHour.playUntil((s) => s.round === 2);
    expect(Object.values(voidHour.state.players).every((p) => p.skill.state === "READY")).toBe(true);
  });
});

describe("night rules", () => {
  it("Mercury Retrograde: a player's first reroll may cost 1 Sanity, their later ones never", () => {
    let costs = 0;
    for (let i = 0; i < 30; i++) {
      const t = new Table(2);
      const s = structuredClone(t.state);
      s.nightRule = "MERCURY_RETROGRADE";
      for (let k = 0; k < i; k++) next(s); // a different point in the run's own generator
      s.roll = { id: "r1", playerId: "a", purpose: "SEARCH", label: m`a search`, raw: 2, modifiers: [], fateSpent: 0, final: 2, tier: "FAIL", modifiable: true, done: false };
      const ctx = { s, now: t.now, events: [] };
      applyEffects(ctx, [{ kind: "REROLL", who: "SELF", keep: "SECOND" }], { ownerId: "a", targets: [], label: m`a reroll` });
      const afterFirst = s.players.a.sanity;
      costs += 3 - afterFirst;
      s.roll.done = false;
      applyEffects(ctx, [{ kind: "REROLL", who: "SELF", keep: "SECOND" }], { ownerId: "a", targets: [], label: m`a reroll` });
      expect(s.players.a.sanity).toBe(afterFirst);
    }
    expect(costs).toBeGreaterThan(0);
    expect(costs).toBeLessThan(30);
  });
});
