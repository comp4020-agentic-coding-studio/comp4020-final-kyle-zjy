import { describe, expect, it } from "vitest";
import type { Ctx } from "../src/server/engine/context.ts";
import { secretMessage } from "../src/server/engine/beats.ts";
import { moveInspector } from "../src/server/engine/inspector.ts";
import { next } from "../src/server/engine/rng.ts";
import { applyEffects } from "../src/server/engine/effects.ts";
import { dreamCard } from "../src/server/engine/outcomes.ts";
import { project } from "../src/server/engine/project.ts";
import { CARRIAGES } from "../src/shared/game/scenario01/content.ts";
import type { CarriageIdentity, GameState } from "../src/shared/game/state.ts";
import { rigNextDie, Table } from "./helpers.ts";

// Act 2 (rounds 4–7): the Faceless Inspector and ticket checks, seat
// neighbours, the three anchors, round-5 secret messages, the round-6 brake
// vote and the round-7 Reality Fold.

const turnsOf = (round: number) => (s: GameState) => s.round === round && s.step === "PLAYER_TURNS" && !s.sequence && !s.pending.length;
const ctxOf = (s: GameState): Ctx => ({ s, now: 0, events: [] });
const indexOf = (s: GameState, identity: CarriageIdentity) => s.carriages.find((c) => c.identity === identity)!.index;

function atRound(n: number, round: number): Table {
  const t = new Table(n);
  t.playUntil(turnsOf(round));
  return t;
}

/** Edits a copy of the state (engine states are treated as immutable). */
function edit(t: Table, patch: (s: GameState) => void): void {
  const s = structuredClone(t.state);
  patch(s);
  t.state = s;
}

const drain = (t: Table, option?: string) => {
  while (t.state.pending.length) t.answerAll(option);
};

describe("act 2: round 4", () => {
  it("the Inspector appears at the front middle carriage", () => {
    const t = atRound(3, 4);
    expect(t.state.act).toBe(2);
    expect(t.state.inspector).toMatchObject({ active: true, distortion: 0, carriageIndex: t.state.carriages.length - 2 });
  });

  it.each([2, 3, 5, 8])("seat neighbours cover all %i players once, in pairs plus at most one trio", (n) => {
    const t = atRound(n, 4);
    const groups = t.state.seatNeighbours;
    expect(groups.flat().sort()).toEqual(Object.keys(t.state.players).sort());
    expect(groups.filter((g) => g.length === 3).length).toBe(n % 2);
    expect(groups.every((g) => g.length === 2 || g.length === 3)).toBe(true);
  });

  it("helping a seat neighbour gives +2, anyone else +1", () => {
    const t = atRound(4, 4);
    const me = t.active!;
    const mate = t.state.seatNeighbours.find((g) => g.includes(me))!.find((id) => id !== me)!;
    const stranger = t.state.turnOrder.find((id) => id !== me && id !== mate)!;
    edit(t, (s) => Object.values(s.players).forEach((p) => (p.carriageIndex = 0)));
    t.act(me, { type: "HELP", targetId: mate });
    t.act(me, { type: "HELP", targetId: stranger });
    expect(t.state.players[mate].helpBonus).toBe(2);
    expect(t.state.players[stranger].helpBonus).toBe(1);
  });
});

describe("act 2: the Inspector", () => {
  const run = (patch: (s: GameState) => void) => {
    const t = atRound(4, 4);
    const s = structuredClone(t.state);
    for (const p of Object.values(s.players)) {
      p.carriageIndex = 0;
      p.fate = 1;
      p.items = [];
    }
    patch(s);
    moveInspector(ctxOf(s), 1);
    return s;
  };

  it("walks one carriage toward the passenger with the most Fate", () => {
    const s = run((x) => {
      x.players.c.fate = 4;
      x.players.c.carriageIndex = 1;
    });
    expect(s.inspector.targetId).toBe("c");
    expect(s.inspector.carriageIndex).toBe(s.carriages.length - 3);
  });

  it("breaks a Fate tie by items, then by turn order", () => {
    expect(run((x) => (x.players.d.items = ["FLASHLIGHT"])).inspector.targetId).toBe("d");
    const s = run(() => {});
    expect(s.inspector.targetId).toBe(s.turnOrder[0]);
  });

  it("checks tickets only for its target count, richest first", () => {
    const t = new Table(8);
    t.playUntil(turnsOf(4));
    const s = structuredClone(t.state);
    for (const [i, id] of ["a", "b", "c"].entries()) {
      s.players[id].carriageIndex = s.inspector.carriageIndex;
      s.players[id].fate = i + 1;
    }
    moveInspector(ctxOf(s), 1);
    expect(s.config.inspectorTargets).toBe(2);
    expect(s.jobs.map((j) => j.playerId)).toEqual(["c", "b"]);
  });
});

describe("act 2: ticket checks", () => {
  /** Queues a ticket check for the active player, standing with the Inspector, with 1 Fate. */
  function check(die: number, patch: (s: GameState, me: string) => void = () => {}) {
    const t = atRound(3, 4);
    const me = t.active!;
    edit(t, (s) => {
      s.players[me].carriageIndex = s.inspector.carriageIndex;
      s.players[me].fate = 1;
      patch(s, me);
      s.jobs.push({ kind: "TICKET_CHECK", playerId: me });
      rigNextDie(s, die);
    });
    t.tick(1);
    drain(t, "0");
    return { t, s: t.state, me };
  }

  it("a failure costs 1 Fate", () => {
    const { s, me } = check(2);
    expect(s.players[me]).toMatchObject({ fate: 0, sanity: 3 });
  });

  it("a disaster costs 1 Fate and 1 Sanity", () => {
    const { s, me } = check(1);
    expect(s.players[me]).toMatchObject({ fate: 0, sanity: 2 });
  });

  it("a perfect earns a temporary pass, which the next check uses up instead of rolling", () => {
    const { t, s, me } = check(6);
    expect(s.players[me].statuses.map((x) => x.kind)).toContain("TEMP_PASS");
    const rollBefore = t.state.roll?.id;
    edit(t, (x) => x.jobs.push({ kind: "TICKET_CHECK", playerId: me }));
    t.tick(1);
    expect(t.state.roll?.id).toBe(rollBefore);
    expect(t.state.players[me].statuses.map((x) => x.kind)).not.toContain("TEMP_PASS");
    expect(t.state.players[me].fate).toBe(1);
  });

  it("nobody is checked if they walked out of the Inspector's carriage", () => {
    const { s, me } = check(1, (x, id) => (x.players[id].carriageIndex = 0));
    expect(s.players[me]).toMatchObject({ fate: 1, sanity: 3 });
  });
});

describe("act 2: confronting the Inspector", () => {
  function confront(die: number, distortion: number) {
    const t = atRound(3, 4);
    const me = t.active!;
    edit(t, (s) => {
      s.inspector.carriageIndex = s.players[me].carriageIndex;
      s.inspector.distortion = distortion;
      s.players[me].fate = 0;
      rigNextDie(s, die);
    });
    t.act(me, { type: "CONFRONT", target: "INSPECTOR" });
    drain(t);
    return { t, me };
  }

  it("a success adds one distortion mark", () => {
    expect(confront(4, 0).t.state.inspector.distortion).toBe(1);
  });

  it("the third mark banishes it: no confronting, moving or checking until it returns", () => {
    const { t, me } = confront(4, 2);
    const insp = t.state.inspector;
    expect(insp.banishedUntilRound).toBe(5);
    expect(insp.distortion).toBe(0);
    expect(t.state.players[me].ap).toBe(1);
    expect(() => t.act(me, { type: "CONFRONT", target: "INSPECTOR" })).toThrow(/Nothing in this carriage/);
    const before = insp.carriageIndex;
    t.playUntil(turnsOf(6));
    expect(t.state.log.some((l) => l.text.includes("has come back"))).toBe(false);
    expect(t.state.inspector.carriageIndex).toBe(before);
    t.playUntil((s) => s.inspector.banishedUntilRound === null);
    expect(t.state.log.some((l) => l.text.includes("has come back"))).toBe(true);
  });
});

describe("act 2: anchors", () => {
  function repairAt(identity: CarriageIdentity, die: number, n = 4) {
    const t = atRound(n, 4);
    const me = t.active!;
    edit(t, (s) => {
      s.players[me].carriageIndex = indexOf(s, identity);
      s.players[me].fate = 0;
      rigNextDie(s, die);
    });
    t.act(me, { type: "REPAIR" });
    drain(t);
    return { t, me };
  }

  it("a success in the Engine Room advances the Power Anchor", () => {
    const { t } = repairAt("ENGINE_ROOM", 4);
    expect(t.state.anchors.POWER).toMatchObject({ progress: 1, required: 2, repaired: false });
  });

  it("a perfect restores a two-step anchor in one go, and Collapse eases by 1", () => {
    const t = atRound(4, 4);
    const before = t.state.collapse;
    const me = t.active!;
    edit(t, (s) => {
      s.players[me].carriageIndex = indexOf(s, "ARCHIVE");
      s.players[me].fate = 0;
      rigNextDie(s, 6);
    });
    t.act(me, { type: "REPAIR" });
    drain(t);
    expect(t.state.anchors.IDENTITY).toMatchObject({ progress: 2, repaired: true, lastRepairedBy: me });
    expect(t.state.collapse).toBe(before - 1);
  });

  it("an ability or event finishing an anchor restores it the same way", () => {
    const t = atRound(4, 4);
    const s = structuredClone(t.state);
    for (const a of Object.values(s.anchors)) a.progress = a.id === "POWER" ? 1 : 0;
    const ctx = ctxOf(s);
    applyEffects(ctx, [{ kind: "REPAIR_ANCHOR", which: "WEAKEST", amount: 2 }], { ownerId: "SYSTEM", targets: [], label: "test" });
    const done = Object.values(s.anchors).filter((a) => a.repaired);
    expect(done).toHaveLength(1);
    expect(s.collapse).toBe(t.state.collapse - 1);
    expect(ctx.events.map((e) => e.kind)).toContain("ANCHOR_DONE");
    expect(ctx.events.find((e) => e.kind === "ANCHOR")?.payload).toMatchObject({ required: 2 });
  });

  it("the same passenger can't make two repairs in a row on one anchor", () => {
    const { t, me } = repairAt("SLEEPER", 4);
    expect(() => t.act(me, { type: "REPAIR" })).toThrow(/Someone else must make the next repair/);
  });

  it("alone at a 2–3 player table one success restores an anchor", () => {
    const { t } = repairAt("MIRROR", 4, 2);
    expect(t.state.anchors.MEMORY).toMatchObject({ required: 1, repaired: true });
  });
});

describe("act 2: round 5 secret messages", () => {
  it("everyone gets exactly one; nobody sees another's, nor whether their own is true", () => {
    const t = atRound(4, 5);
    for (const id of t.state.turnOrder) expect(t.state.secrets[id].messages).toHaveLength(1);
    for (const viewer of t.state.turnOrder) {
      const view = project(t.state, viewer);
      expect(view.mySecrets!.messages[0]).not.toHaveProperty("isTrue");
      const json = JSON.stringify(view);
      for (const other of t.state.turnOrder.filter((id) => id !== viewer)) expect(json).not.toContain(t.state.secrets[other].messages[0].id);
    }
    const over = structuredClone(t.state);
    over.phase = "RESULTS";
    expect(project(over, "a").mySecrets!.messages[0]).toHaveProperty("isTrue");
  });

  /** Judges a message against the table, so a "false" message is checked to really be false. */
  function holds(s: GameState, text: string): boolean {
    const byName = (n: string) => Object.values(s.players).find((p) => p.nickname === n)!;
    const middle = s.carriages.filter((c) => c.identity !== "START" && c.identity !== "CAB");
    let m: RegExpMatchArray | null;
    if ((m = text.match(/^(\w+)'s ability is (still unused|already burned)\.$/))) return (byName(m[1]).skill.usesLeft > 0) === (m[2] === "still unused");
    if ((m = text.match(/^(\w+) is carrying (\d+) Fate\.$/))) return byName(m[1]).fate === Number(m[2]);
    if ((m = text.match(/^A core memory (?:is still asleep|still sleeps) in the (.+)\.$/))) {
      const c = middle.find((x) => CARRIAGES[x.identity].name === m![1])!;
      return !s.flags[`core_${c.identity}`];
    }
    if (text.startsWith("Every core memory")) return middle.every((c) => s.flags[`core_${c.identity}`]);
    if (text.startsWith("Nobody on this train")) return Object.values(s.players).every((p) => p.sanity >= 2);
    if (text.startsWith("Someone on this train")) return Object.values(s.players).some((p) => p.sanity < 2);
    throw new Error(`unknown message: ${text}`);
  }

  // the edges a lie used to fall into: nobody has Fate, and no core memory is
  // awake; each sample advances the run's own generator a different distance
  const tables = [
    (s: GameState) => Object.values(s.players).forEach((p) => (p.fate = 0)),
    (s: GameState) => s.carriages.forEach((c) => (s.flags[`core_${c.identity}`] = 1)),
  ];

  it.each(tables.map((f, i) => [i, f] as const))("a true message is true and a false one is false (table %i)", (_, setUp) => {
    const t = atRound(4, 5);
    for (const truthful of [true, false]) {
      for (let i = 1; i <= 120; i++) {
        const s = structuredClone(t.state);
        setUp(s);
        for (let k = 0; k < i; k++) next(s);
        const text = secretMessage(ctxOf(s), s.players.a, truthful);
        expect(holds(s, text), text).toBe(truthful);
      }
    }
  });

  it.each(tables.map((f, i) => [i, f] as const))("a dream card is true exactly when it says so (table %i)", (_, setUp) => {
    const t = atRound(3, 4);
    for (let i = 1; i <= 120; i++) {
      const s = structuredClone(t.state);
      setUp(s);
      for (let k = 0; k < i; k++) next(s);
      dreamCard(ctxOf(s), s.players.a);
      const card = s.secrets.a.dreamCards.at(-1)!;
      expect(holds(s, card.text), card.text).toBe(card.isTrue);
    }
  });
});

describe("act 2: round 6 emergency brake", () => {
  function vote(choices: Record<string, string>, n = 3) {
    const t = atRound(n, 5);
    t.playUntil((s) => s.round === 6 && s.pending.at(-1)?.kind === "VOTE");
    const w = t.state.pending.at(-1)!;
    expect(t.state.currentEvent?.id).toBe("EMERGENCY_BRAKE");
    // everyone at the back, so the Inspector's step can't reach anyone for a ticket check
    edit(t, (s) => Object.values(s.players).forEach((p) => (p.carriageIndex = 0)));
    const before = structuredClone(t.state);
    for (const id of w.addressees) t.act(id, { type: "RESPOND", windowId: w.id, optionId: choices[id] });
    drain(t);
    return { before, t };
  }

  it("braking: Collapse −2 and the Inspector acts at once", () => {
    const { before, t } = vote({ a: "BRAKE", b: "BRAKE", c: "CONTINUE" });
    expect(t.state.currentEvent?.choice).toBe("BRAKE");
    expect(t.state.collapse).toBe(before.collapse - 2 + 1); // +1 is the round end
    expect(t.state.inspector.carriageIndex).toBe(before.inspector.carriageIndex - 1);
  });

  it("keeping going: everyone gains 1 Fate and Collapse +1", () => {
    const { before, t } = vote({ a: "CONTINUE", b: "CONTINUE", c: "BRAKE" });
    expect(t.state.currentEvent?.choice).toBe("CONTINUE");
    expect(t.state.collapse).toBe(before.collapse + 1 + 1);
    for (const id of ["a", "b", "c"]) expect(t.state.players[id].fate).toBe(before.players[id].fate + 1);
  });

  it("a tie is settled by the seeded generator, the same way on replay", () => {
    const one = vote({ a: "BRAKE", b: "CONTINUE" }, 2).t.state.currentEvent!;
    const two = vote({ a: "BRAKE", b: "CONTINUE" }, 2).t.state.currentEvent!;
    expect(one.resultText).toContain("tie, settled by chance");
    expect(two.choice).toBe(one.choice);
  });
});

describe("act 2: round 7 Reality Fold", () => {
  it("re-shuffles the middle carriages under everyone's feet", () => {
    const t = atRound(3, 6);
    const before = structuredClone(t.state);
    t.playUntil((s) => s.round === 7);
    const s = t.state;
    expect(s.sequence?.kind).toBe("FOLD");
    const ids = (x: GameState) => x.carriages.map((c) => c.identity);
    expect(ids(s)[0]).toBe("START");
    expect(ids(s).at(-1)).toBe(ids(before).at(-1));
    expect([...ids(s)].sort()).toEqual([...ids(before)].sort());
    expect(ids(s)).not.toEqual(ids(before));
    for (const id of s.turnOrder) expect(s.players[id].carriageIndex).toBe(before.players[id].carriageIndex);
  });

  it("the end of round 7 opens the cab and starts act 3", () => {
    const t = atRound(3, 7);
    t.playUntil((s) => s.act === 3);
    expect(t.state.sequence?.kind).toBe("CAB_OPEN");
    expect(t.state.carriages.every((c) => !c.locked)).toBe(true);
  });
});
