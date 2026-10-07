import { describe, expect, it } from "vitest";
import { RuleError } from "../src/server/engine/context.ts";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, setAway, startGame, tickGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { SEED, seatsFor, T0, Table } from "./helpers.ts";

const rejects = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(RuleError);
    expect((e as RuleError).code).toBe(code);
    return;
  }
  throw new Error(`expected rejection ${code}`);
};

/** Ends turns (answering every window with its default) until round `n` starts. */
function playToRound(t: Table, n: number) {
  for (let guard = 0; guard < 400 && t.state.round < n && !t.state.outcome; guard++) {
    if (t.state.pending.length) t.answerAll();
    else if (t.state.sequence) t.tick(20_000);
    else if (t.active) t.act(t.active, { type: "END_TURN" });
    else t.tick(1000);
  }
}

describe("engine: a new run", () => {
  it("starts round 1 of act 1 with every passenger's resources", () => {
    const t = new Table(4);
    const s = t.state;
    expect([s.phase, s.round, s.step]).toEqual(["ACT_1", 1, "PLAYER_TURNS"]);
    expect(t.active).toBe(s.turnOrder[0]);
    expect(s.carriages[0].identity).toBe("START");
    expect(s.carriages.at(-1)).toMatchObject({ identity: "CAB", locked: true });
    expect(new Set(s.carriages.map((c) => c.identity)).size).toBe(8);
    for (const p of Object.values(s.players)) {
      expect(p.ap).toBe(2);
      expect(p.fate).toBe(s.nightRule === "LUCKY_NIGHT" ? 3 : 2);
      expect(p.sanity).toBe(3);
      expect(p.items).toHaveLength(1);
      expect(p.carriageIndex).toBe(0);
      expect(p.skill.usesLeft).toBe(1);
    }
  });

  it("is deterministic: the same seed and actions give the same run", () => {
    const a = new Table(3);
    const b = new Table(3);
    for (const t of [a, b]) {
      t.act(t.active!, { type: "INVESTIGATE" });
      t.answerAll();
    }
    expect(a.state).toEqual(b.state);
  });

  it("different seeds give different runs", () => {
    const layouts = new Set(
      ["a", "b", "c", "d", "e", "f"].map((c) => {
        const t = new Table(3, { seed: c.repeat(32) });
        return t.state.carriages.map((x) => x.identity).join() + t.state.turnOrder.join() + t.state.nightRule;
      }),
    );
    expect(layouts.size).toBeGreaterThan(3);
  });

  it("replaying the recorded inputs reproduces the run exactly", () => {
    const t = new Table(3);
    const inputs: { actor: string; action: GameAction; now: number }[] = [];
    const record = (actor: string, action: GameAction) => {
      t.act(actor, action);
      inputs.push({ actor, action, now: t.now });
    };
    record(t.active!, { type: "SEARCH" });
    while (t.state.pending.length) {
      const w = t.state.pending.at(-1)!;
      record(w.addressees[0], { type: "RESPOND", windowId: w.id, optionId: w.defaultOptionId });
    }
    record(t.active!, { type: "MOVE", toCarriage: 1 });

    let replay = startGame(createGame("g_test", seatsFor(3), SEED, T0), T0).state;
    replay = tickGame(replay, T0 + 60_000).state;
    for (const i of inputs) replay = applyGameAction(replay, i.actor, i.action, i.now).state;
    expect(replay).toEqual(t.state);
  });
});

describe("engine: turns and action points", () => {
  it("only the active passenger can act; nothing changes on a rejection", () => {
    const t = new Table(3);
    const idle = t.state.turnOrder[1];
    const before = structuredClone(t.state);
    rejects(() => applyGameAction(t.state, idle, { type: "SEARCH" }, t.now), "NOT_YOUR_TURN");
    expect(t.state).toEqual(before);
  });

  it("moving costs 1 action point, only to the next carriage, and never into the locked cab", () => {
    const t = new Table(3);
    const me = t.active!;
    rejects(() => applyGameAction(t.state, me, { type: "MOVE", toCarriage: 2 }, t.now), "ILLEGAL_TARGET");
    t.act(me, { type: "MOVE", toCarriage: 1 });
    expect(t.state.players[me]).toMatchObject({ carriageIndex: 1, ap: 1 });
    t.act(me, { type: "MOVE", toCarriage: 2 });
    rejects(() => applyGameAction(t.state, me, { type: "MOVE", toCarriage: 3 }, t.now), "NO_AP");
    const s = structuredClone(t.state);
    s.players[me].carriageIndex = s.carriages.length - 2;
    s.players[me].ap = 2;
    rejects(() => applyGameAction(s, me, { type: "MOVE", toCarriage: s.carriages.length - 1 }, t.now), "ILLEGAL_TARGET");
  });

  it("rejects malformed and forged actions", () => {
    const t = new Table(2);
    const me = t.active!;
    rejects(() => applyGameAction(t.state, me, { type: "MOVE", toCarriage: "1" } as never, t.now), "INVALID");
    rejects(() => applyGameAction(t.state, me, { type: "GIVE_ME_FATE" } as never, t.now), "INVALID");
    rejects(() => applyGameAction(t.state, "intruder", { type: "SEARCH" }, t.now), "NOT_IN_ROOM");
  });

  it("ending a turn passes to the next passenger; a full round refills action points and raises Collapse", () => {
    const t = new Table(3);
    const [first, second] = t.state.turnOrder;
    t.act(first, { type: "MOVE", toCarriage: 1 });
    t.act(first, { type: "END_TURN" });
    expect(t.active).toBe(second);
    playToRound(t, 2);
    expect(t.state.round).toBe(2);
    expect(t.state.collapse).toBeGreaterThanOrEqual(1);
    expect(Object.values(t.state.players).every((p) => p.ap === (p.lost ? 1 : 2))).toBe(true);
  });

  it("a turn that runs out of time passes on its own", () => {
    const t = new Table(3);
    const first = t.active!;
    t.tick(91_000);
    expect(t.active).not.toBe(first);
  });

  it("a passenger who drops on their turn keeps it for a short grace; back in time, they carry on", () => {
    const t = new Table(3);
    const first = t.active!;
    let step = setAway(t.state, first, true, t.now);
    expect(step.state.players[first].away).toBe(true);
    expect(step.state.turnOrder[step.state.activeIndex]).toBe(first); // a refresh doesn't cost the turn
    step = tickGame(step.state, t.now + 5_000);
    expect(step.state.turnOrder[step.state.activeIndex]).toBe(first);
    // back after 5 s: at least 30 s more to act, and the turn is still theirs
    const back = setAway(step.state, first, false, t.now + 5_000).state;
    expect(back.turnDeadline).toBeGreaterThanOrEqual(t.now + 35_000);
    expect(applyGameAction(back, first, { type: "SEARCH" }, t.now + 6_000).state.players[first].ap).toBe(1);
  });

  it("a passenger who stays away loses the turn once the grace runs out", () => {
    const t = new Table(3);
    const first = t.active!;
    let step = setAway(t.state, first, true, t.now);
    step = tickGame(step.state, t.now + 16_000);
    expect(step.state.turnOrder[step.state.activeIndex]).not.toBe(first);
    expect(step.state.log.some((l) => l.text.includes("ran out of time"))).toBe(true);
  });
});

describe("engine: dice and Fate", () => {
  /** A table whose active player has just rolled something Fate can improve. */
  function fateWindowTable(): Table {
    for (const seed of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c"]) {
      const t = new Table(3, { seed: seed.repeat(32) });
      t.act(t.active!, { type: "SEARCH" });
      if (t.state.pending.at(-1)?.kind === "FATE_SPEND") return t;
    }
    throw new Error("no seed produced a Fate window");
  }

  it("a roll records raw → modifiers → final, and its roller decides on Fate", () => {
    const t = fateWindowTable();
    const roll = t.state.roll!;
    const w = t.state.pending.at(-1)!;
    expect(roll.raw).toBeGreaterThanOrEqual(1);
    expect(roll.raw).toBeLessThanOrEqual(6);
    expect(w.addressees).toEqual([roll.playerId]);
    expect(w.options.length).toBeLessThanOrEqual(3); // keep, +1, +2
    const other = t.state.turnOrder.find((id) => id !== roll.playerId)!;
    rejects(() => applyGameAction(t.state, other, { type: "RESPOND", windowId: w.id, optionId: "1" }, t.now), "NOT_YOUR_WINDOW");
    rejects(() => applyGameAction(t.state, roll.playerId, { type: "SEARCH" }, t.now), "WINDOW_OPEN");
  });

  it("spending Fate adds +1 each, costs Fate, and caps at 2", () => {
    const t = fateWindowTable();
    const roll = t.state.roll!;
    const fateBefore = t.state.players[roll.playerId].fate;
    const w = t.state.pending.at(-1)!;
    rejects(() => applyGameAction(t.state, roll.playerId, { type: "RESPOND", windowId: w.id, optionId: "3" }, t.now), "INVALID");
    t.act(roll.playerId, { type: "RESPOND", windowId: w.id, optionId: "1" });
    expect(t.state.roll).toMatchObject({ fateSpent: 1, final: Math.min(6, roll.final + 1), done: true });
    expect(t.state.players[roll.playerId].fate).toBeGreaterThanOrEqual(fateBefore - 1);
    expect(t.state.players[roll.playerId].stats.fateSpentOnDice).toBe(1);
  });

  it("a closed decision can't be answered again", () => {
    const t = fateWindowTable();
    const w = t.state.pending.at(-1)!;
    t.act(w.addressees[0], { type: "RESPOND", windowId: w.id, optionId: "0" });
    rejects(() => applyGameAction(t.state, w.addressees[0], { type: "RESPOND", windowId: w.id, optionId: "0" }, t.now), "NOT_YOUR_WINDOW");
  });

  it("an unanswered Fate window times out to 'keep it'", () => {
    const t = fateWindowTable();
    const roll = t.state.roll!;
    t.tick(16_000);
    expect(t.state.roll).toMatchObject({ id: roll.id, fateSpent: 0, done: true });
  });
});

describe("engine: help, stabilise, trade", () => {
  it("help adds +1 to a carriage-mate's next roll, caps at +2, and is used up by that roll", () => {
    const t = new Table(3);
    const [a, b] = t.state.turnOrder;
    t.act(a, { type: "HELP", targetId: b });
    t.act(a, { type: "HELP", targetId: b });
    expect(t.state.players[b].helpBonus).toBe(2);
    t.act(a, { type: "END_TURN" });
    rejects(() => applyGameAction(t.state, b, { type: "HELP", targetId: b }, t.now), "ILLEGAL_TARGET");
    t.act(b, { type: "SEARCH" });
    expect(t.state.roll!.modifiers).toContainEqual({ source: "Help", delta: 2 });
    expect(t.state.players[b].helpBonus).toBe(0);
  });

  it("help needs the target in your carriage", () => {
    const t = new Table(3);
    const [a, b] = t.state.turnOrder;
    const s = structuredClone(t.state);
    s.players[b].carriageIndex = 3;
    rejects(() => applyGameAction(s, a, { type: "HELP", targetId: b }, t.now), "ILLEGAL_TARGET");
  });

  it("stabilising costs 2 action points and is refused when you're already steady", () => {
    const t = new Table(3);
    const a = t.active!;
    rejects(() => applyGameAction(t.state, a, { type: "STABILIZE", mode: "SANITY" }, t.now), "ILLEGAL_TARGET");
    const s = structuredClone(t.state);
    s.players[a].sanity = 0;
    s.players[a].lost = true;
    const after = applyGameAction(s, a, { type: "STABILIZE", mode: "SANITY" }, t.now).state;
    expect(after.players[a]).toMatchObject({ sanity: 1, lost: false, ap: 0 });
  });

  it("a trade waits for the other side, and moves items and Fate only on accept", () => {
    const t = new Table(2);
    const [a, b] = t.state.turnOrder;
    const item = t.state.players[a].items[0];
    rejects(() => applyGameAction(t.state, a, { type: "TRADE", targetId: b, give: { items: [], fate: 9 }, want: { items: [], fate: 0 } }, t.now), "INVALID");
    t.act(a, { type: "TRADE", targetId: b, give: { items: [item], fate: 0 }, want: { items: [], fate: 1 } });
    const w = t.state.pending.at(-1)!;
    expect(w).toMatchObject({ kind: "TRADE_OFFER", addressees: [b] });
    rejects(() => applyGameAction(t.state, a, { type: "RESPOND", windowId: w.id, optionId: "ACCEPT" }, t.now), "NOT_YOUR_WINDOW");
    const fateA = t.state.players[a].fate;
    t.act(b, { type: "RESPOND", windowId: w.id, optionId: "ACCEPT" });
    expect(t.state.players[b].items).toContain(item);
    expect(t.state.players[a].fate).toBe(fateA + 1);
  });

  it("a declined trade changes nothing but the action point", () => {
    const t = new Table(3);
    const [a, b] = t.state.turnOrder;
    const items = [...t.state.players[a].items];
    t.act(a, { type: "TRADE", targetId: b, give: { items, fate: 0 }, want: { items: [], fate: 0 } });
    t.answerAll("DECLINE");
    expect(t.state.players[a].items).toEqual(items);
    expect(t.state.players[a].ap).toBe(1);
  });
});

describe("engine: abilities", () => {
  it("a burned ability can't be used again; reaction abilities aren't used from the action menu", () => {
    const t = new Table(2, { chars: [["aries", "ENTJ"], ["scorpio", "ENTP"]] });
    const a = t.active!;
    const other = t.state.turnOrder.find((id) => id !== a)!;
    const s = structuredClone(t.state);
    s.players[a].characterId = "aries-entj";
    s.players[a].skill = { usesLeft: 1, state: "READY" };
    s.nightRule = "FULL_MOON";
    const used = applyGameAction(s, a, { type: "USE_SKILL", targets: [other] }, t.now).state;
    expect(used.players[a].skill).toMatchObject({ usesLeft: 0, state: "BURNED" });
    expect(used.players[a].fate).toBe(s.players[a].fate + 1);
    rejects(() => applyGameAction(used, a, { type: "USE_SKILL", targets: [other] }, t.now), "SKILL_ALREADY_USED");
    const r = structuredClone(t.state);
    r.players[a].characterId = "scorpio-entp";
    rejects(() => applyGameAction(r, a, { type: "USE_SKILL" }, t.now), "NOT_YOUR_WINDOW");
  });
});

describe("engine: end of the run", () => {
  it("no action is accepted after the run is over", () => {
    const t = new Table(2);
    const s: GameState = { ...structuredClone(t.state), phase: "RESULTS", outcome: "FAILED" };
    rejects(() => applyGameAction(s, t.active ?? "a", { type: "SEARCH" }, t.now), "GAME_OVER");
    rejects(() => applyGameAction(s, "a", { type: "RESPOND", windowId: "w1", optionId: "x" }, t.now), "GAME_OVER");
  });

  it("Collapse reaching 12 ends the run in failure", () => {
    const t = new Table(2);
    const s = structuredClone(t.state);
    s.collapse = 11;
    const a = t.active!;
    s.players[a].items = ["POCKET_WATCH"];
    // ending the round adds the twelfth point of Collapse
    let st = s;
    for (let i = 0; i < 40 && st.phase !== "ENDING" && st.phase !== "RESULTS"; i++) {
      const active = st.turnOrder[st.activeIndex];
      if (st.pending.length) {
        const w = st.pending.at(-1)!;
        st = applyGameAction(st, w.addressees[0], { type: "RESPOND", windowId: w.id, optionId: w.defaultOptionId }, t.now).state;
      } else if (st.step === "PLAYER_TURNS" && active) st = applyGameAction(st, active, { type: "END_TURN" }, t.now).state;
      else st = tickGame(st, t.now).state;
    }
    expect(st).toMatchObject({ outcome: "FAILED", failReason: "COLLAPSE" });
    expect(st.results).toHaveLength(2);
  });
});

describe("engine: what each player can see", () => {
  it("never sends another player's secrets or hidden statuses", () => {
    const t = new Table(3);
    const [a, b] = t.state.turnOrder;
    const s = structuredClone(t.state);
    s.secrets[b].messages.push({ id: "m1", text: "B's secret", isTrue: true, round: 1 });
    s.players[b].statuses.push({ id: "h1", kind: "MARKED", polarity: "NEGATIVE", sourceId: "SYSTEM", expiresAtRound: null, hidden: true, ordinary: true });
    const view = project(s, a);
    const json = JSON.stringify(view);
    expect(json).not.toContain("B's secret");
    expect(json).not.toContain(s.secrets[b].obsession === s.secrets[a].obsession ? "__never__" : `"obsession":"${s.secrets[b].obsession}"`);
    expect(view.players[b].statuses.find((st) => st.id === "h1")).toBeUndefined();
    expect(json).not.toContain(s.seed);
    expect(view).not.toHaveProperty("eventDeck");
    expect(project(s, b).mySecrets?.messages[0].text).toBe("B's secret");
    expect(project(s, b).players[b].statuses.some((st) => st.id === "h1")).toBe(true);
  });

  it("keeps votes secret until the vote closes", () => {
    const t = new Table(3);
    const s = structuredClone(t.state);
    const [a, b] = s.turnOrder;
    s.pending.push({ id: "v1", kind: "VOTE", title: "t", prompt: "p", addressees: s.turnOrder, options: [{ id: "X", label: "X" }, { id: "Y", label: "Y" }], defaultOptionId: "Y", deadlineAt: t.now + 30_000, answers: { [b]: "X" }, resume: { kind: "BRAKE_VOTE" }, blocksTable: true });
    const view = project(s, a);
    expect(view.pending[0].answeredBy).toEqual([b]);
    expect(view.pending[0].myAnswer).toBeNull();
    expect(view.pending[0]).not.toHaveProperty("answers");
    expect(view.pending[0]).not.toHaveProperty("resume");
    expect(project(s, b).pending[0].myAnswer).toBe("X");
  });

  it("explains every action a player can't take", () => {
    const t = new Table(3);
    const idle = t.state.turnOrder[1];
    const view = project(t.state, idle);
    expect(view.myActions.every((x) => !x.enabled && x.reason)).toBe(true);
    const mine = project(t.state, t.active!).myActions;
    expect(mine.find((x) => x.type === "MOVE")).toMatchObject({ enabled: true, targets: [1] });
    expect(mine.find((x) => x.type === "REPAIR")).toMatchObject({ enabled: false });
    expect(mine.find((x) => x.type === "REPAIR")!.reason).toMatch(/round 4/);
  });
});
