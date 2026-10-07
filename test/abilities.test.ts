import { describe, expect, it } from "vitest";
import { en } from "../src/shared/i18n/format.ts";
import { m } from "../src/shared/i18n/msg.ts";
import type { Ctx } from "../src/server/engine/context.ts";
import { applyEffects } from "../src/server/engine/effects.ts";
import { project } from "../src/server/engine/project.ts";
import { getCharacterById } from "../src/shared/characters/roster/index.ts";
import type { CharacterId } from "../src/shared/characters/types.ts";
import { EVENTS, type EventCard } from "../src/shared/game/scenario01/events.ts";
import type { GameState, PlayerId } from "../src/shared/game/state.ts";
import { rigNextDie, Table } from "./helpers.ts";

// The Skill Resolver's mechanisms, each through abilities that use it
// (docs/skill-mapping-notes.md): parked hits and declared abilities, revealed
// events, after-the-fact triggers, tracked conditions, rewards and bonds,
// rolls an ability shapes, rules and turn order, tasks and hidden information.

/** Players a, b, c… with these characters, at the start of round 1, under a night rule that changes nothing mid-run. */
function table(...chars: CharacterId[]): Table {
  const t = new Table(chars.length, { chars: chars.map((id) => [getCharacterById(id).zodiac, getCharacterById(id).mbti]) });
  edit(t, (s) => {
    s.nightRule = "LUCKY_NIGHT";
    for (const p of Object.values(s.players)) p.skill = { usesLeft: 1, state: "READY" };
  });
  return t;
}

function edit(t: Table, patch: (s: GameState) => void): void {
  const s = structuredClone(t.state);
  patch(s);
  t.state = s;
}

/** Makes `id` the active player, everyone in carriage 2 with 3 Fate and no items. */
function setUp(t: Table, id: PlayerId, patch: (s: GameState) => void = () => {}) {
  edit(t, (s) => {
    s.activeIndex = s.turnOrder.indexOf(id);
    for (const p of Object.values(s.players)) Object.assign(p, { fate: 3, carriageIndex: 2, items: [] });
    patch(s);
  });
}

const use = (t: Table, id: PlayerId, targets: PlayerId[] = []) => t.act(id, { type: "USE_SKILL", targets });
const top = (t: Table) => t.state.pending.at(-1);
/** Answers the top window as `who` (it must be theirs). */
function answer(t: Table, who: PlayerId, option: string) {
  const w = top(t);
  expect(w?.addressees).toContain(who);
  t.act(who, { type: "RESPOND", windowId: w!.id, optionId: option });
}
const drain = (t: Table) => {
  for (let i = 0; i < 40 && t.state.pending.length; i++) t.answerAll();
};
const ctxOf = (t: Table): Ctx => ({ s: t.state, now: t.now, events: [] });

/** Puts a card on top of the deck and plays to its reveal at the end of the round. */
function revealNext(t: Table, card: EventCard) {
  edit(t, (s) => (s.eventDeck = [card.id, ...s.eventDeck.filter((id) => id !== card.id)]));
  t.playUntil((s) => s.currentEvent?.id === card.id || s.currentEvent?.round === s.round);
}
const card = (keep: (c: EventCard) => boolean) => EVENTS.find((c) => c.acts.includes(1) && keep(c))!;

describe("a hit parked for reactions", () => {
  // Requisition (taurus-entj): b takes 1 Fate from each of two players
  it("a dodge cancels the hit on its holder; the other victim still pays", () => {
    const t = table("aries-istp", "taurus-entj", "leo-esfp");
    setUp(t, "b");
    use(t, "b", ["a", "c"]);
    answer(t, "a", "USE");
    drain(t);
    expect([t.state.players.a.fate, t.state.players.b.fate, t.state.players.c.fate]).toEqual([3, 4, 2]);
  });

  it("passing the blame sends it to another legal player", () => {
    const t = table("aries-entp", "taurus-entj", "leo-esfp");
    setUp(t, "b");
    use(t, "b", ["a", "c"]);
    answer(t, "a", "USE");
    drain(t);
    expect([t.state.players.a.fate, t.state.players.c.fate, t.state.players.b.fate]).toEqual([3, 1, 5]);
  });

  it("a passive weakens the hit without asking, and only once", () => {
    const t = table("aries-infp", "taurus-entj", "leo-esfp");
    setUp(t, "b");
    use(t, "b", ["a", "c"]);
    expect(t.state.pending.some((w) => w.addressees.includes("a"))).toBe(false);
    drain(t);
    expect(t.state.players.a.fate).toBe(3);
    expect(t.state.players.a.skill.usesLeft).toBe(0);
  });

  it("on record: the hit lands and the same effect hits the attacker", () => {
    const t = table("scorpio-istj", "taurus-entj", "leo-esfp");
    setUp(t, "b");
    use(t, "b", ["a", "c"]);
    answer(t, "a", "USE");
    drain(t);
    // a pays b 1, then b pays a 1 back; c pays b 1
    expect([t.state.players.a.fate, t.state.players.b.fate, t.state.players.c.fate]).toEqual([3, 4, 2]);
  });

  it("costs you pay yourself and group hits are never parked", () => {
    const t = table("aries-istp", "leo-esfp");
    setUp(t, "a");
    const ctx = ctxOf(t);
    applyEffects(ctx, [{ kind: "LOSE_FATE", who: "SELF", amount: 1 }], { ownerId: "a", targets: [], label: m`a cost` });
    applyEffects(ctx, [{ kind: "LOSE_FATE", who: "ALL", amount: 1 }], { ownerId: "SYSTEM", targets: [], label: m`a storm`, group: true });
    expect(ctx.s.pendingEffect).toBeNull();
    expect(ctx.s.players.a.fate).toBe(1);
  });
});

describe("an ability declared on someone", () => {
  // Do As I Say (leo-entj): the target moves one carriage toward b
  it("access denied refuses it", () => {
    const t = table("aquarius-isfj", "leo-entj", "leo-esfp");
    setUp(t, "b", (s) => (s.players.b.carriageIndex = 4));
    use(t, "b", ["a"]);
    answer(t, "a", "USE");
    drain(t);
    expect(t.state.players.a.carriageIndex).toBe(2);
    expect(t.state.players.b.skill.usesLeft).toBe(0);
  });

  it("a technicality sends it to a different legal target", () => {
    const t = table("leo-esfp", "leo-entj", "virgo-entp");
    setUp(t, "b", (s) => (s.players.b.carriageIndex = 4));
    use(t, "b", ["a"]);
    answer(t, "c", "USE");
    drain(t);
    expect(t.state.players.a.carriageIndex).toBe(2);
    expect(t.state.players.c.carriageIndex).toBe(3);
  });
});

describe("a public event as it is revealed", () => {
  const instantGain = card((c) => c.kind === "INSTANT" && !!c.effects?.some((e) => e.kind === "GAIN_FATE" && e.who === "ALL"));
  const groupRoll = card((c) => c.kind === "GROUP_ROLL");
  const lossyRoll = card((c) => c.kind === "GROUP_ROLL" && Object.values(c.onTier ?? {}).flat().some((e) => e.kind === "LOSE_SANITY" || e.kind === "LOSE_FATE"));
  const eachChoose = card((c) => c.kind === "EACH_CHOOSE");

  it("debug cancels it", () => {
    const t = table("virgo-intp", "leo-esfp");
    revealNext(t, instantGain);
    const fate = t.state.players.b.fate;
    answer(t, "a", "USE");
    drain(t);
    expect(t.state.currentEvent).toMatchObject({ id: instantGain.id, resolved: true, resultText: m`Cancelled before it took effect.` });
    expect(t.state.players.b.fate).toBe(fate);
  });

  it("throw an error softens every loss it causes", () => {
    const run = (soften: boolean) => {
      const t = table("aquarius-entp", "leo-esfp");
      edit(t, (s) => rigNextDie(s, 1)); // the first die of the group roll is a disaster
      revealNext(t, lossyRoll);
      const before = structuredClone(t.state);
      answer(t, "a", soften ? "USE" : "SKIP");
      drain(t);
      const lost = (s: GameState) => Object.values(s.players).reduce((n, p) => n + p.sanity + p.fate, 0) - s.collapse;
      return lost(before) - lost(t.state);
    };
    expect(run(true)).toBeLessThan(run(false));
  });

  it("choose peace steps out of it and gains 1 Fate", () => {
    const t = table("libra-isfp", "leo-esfp");
    revealNext(t, instantGain);
    const [fa, fb] = [t.state.players.a.fate, t.state.players.b.fate];
    answer(t, "a", "USE");
    drain(t);
    expect(t.state.currentEvent?.excluded).toContain("a");
    expect([t.state.players.a.fate, t.state.players.b.fate]).toEqual([fa + 1, fb + 1]); // its +1, not the event's
  });

  it("put it to a vote: an everyone-chooses event becomes one vote for all", () => {
    const t = table("libra-esfp", "leo-esfp");
    revealNext(t, eachChoose);
    answer(t, "a", "USE");
    expect(top(t)).toMatchObject({ kind: "VOTE", addressees: ["a", "b"] });
  });

  it("lead role: the next choice event is decided by its holder alone", () => {
    const t = table("leo-intj", "leo-esfp");
    setUp(t, "a");
    use(t, "a");
    revealNext(t, eachChoose);
    expect(top(t)).toMatchObject({ kind: "VOTE", addressees: ["a"] });
  });

  it("objection: a group roll is rolled again before it counts", () => {
    const t = table("libra-entp", "leo-esfp");
    revealNext(t, groupRoll);
    expect(t.state.currentEvent?.rolling).toBe(true);
    answer(t, "a", "USE");
    drain(t);
    expect(t.state.log.some((l) => l.text.includes("everyone rolls again"))).toBe(true);
    expect(t.state.currentEvent?.resolved).toBe(true);
  });
});

describe("after-the-fact triggers", () => {
  it("emergency rations: Fate hitting 0 gives 1 back, without a question", () => {
    const t = table("taurus-isfj", "leo-esfp");
    setUp(t, "a");
    const ctx = ctxOf(t);
    applyEffects(ctx, [{ kind: "LOSE_FATE", who: "ALL", amount: 9 }], { ownerId: "SYSTEM", targets: [], label: m`a storm`, group: true });
    t.tick(1);
    expect(t.state.players.a.fate).toBe(1);
    expect(t.state.players.b.fate).toBe(0);
  });

  it("quit while ahead wakes only for a gain of 2 or more by someone else", () => {
    const t = table("taurus-estp", "leo-esfp");
    setUp(t, "a");
    const gain = (n: number) => {
      applyEffects(ctxOf(t), [{ kind: "GAIN_FATE", who: "TARGET", amount: n }], { ownerId: "SYSTEM", targets: ["b"], label: m`luck` });
      t.tick(1);
    };
    gain(1);
    expect(top(t)).toBeUndefined();
    gain(2);
    expect(top(t)).toMatchObject({ kind: "REACTION", addressees: ["a"] });
  });

  it("spread the word: a buff someone gains goes, weaker, to the player you choose", () => {
    const t = table("gemini-esfj", "leo-esfp", "pisces-isfj");
    setUp(t, "a");
    applyEffects(ctxOf(t), [{ kind: "ADD_STATUS", who: "TARGET", status: "INVESTIGATE_BONUS", rounds: 3, value: 2 }], { ownerId: "SYSTEM", targets: ["b"], label: m`a flashlight` });
    t.tick(1);
    expect(top(t)?.options.map((o) => o.id)).toEqual(["USE:b", "USE:c", "SKIP"]);
    answer(t, "a", "USE:c");
    expect(t.state.players.c.statuses.find((st) => st.kind === "INVESTIGATE_BONUS")).toMatchObject({ value: 1, expiresAtRound: t.state.round });
  });

  it("plan B wakes only when an ability did nothing, and gives that use back", () => {
    const t = table("virgo-isfj", "virgo-istj", "leo-esfp");
    setUp(t, "b");
    use(t, "b", ["c"]); // Recheck on a player with nothing waiting
    answer(t, "a", "USE");
    expect(t.state.players.b.skill).toMatchObject({ usesLeft: 1, state: "READY" });
    const t2 = table("virgo-isfj", "leo-esfj", "leo-esfp");
    setUp(t2, "b");
    use(t2, "b", ["c"]); // Applause: c gains 1
    expect(top(t2)).toBeUndefined();
  });

  it("soft response: being helped pays you and your helper", () => {
    const t = table("cancer-isfp", "leo-esfp");
    setUp(t, "b");
    t.act("b", { type: "HELP", targetId: "a" });
    expect([t.state.players.a.fate, t.state.players.b.fate]).toEqual([4, 4]);
  });
});

describe("tracked conditions", () => {
  it("record of deeds pays on the third success of the run", () => {
    const t = table("leo-istj", "leo-esfp");
    setUp(t, "a", (s) => {
      s.players.a.stats.successes = 2;
      s.players.a.fate = 0;
      rigNextDie(s, 5);
    });
    t.act("a", { type: "SEARCH" });
    drain(t);
    expect(t.state.players.a.skill.usesLeft).toBe(0);
    expect(t.state.players.a.fate).toBeGreaterThanOrEqual(3);
  });

  it("hidden protagonist pays at round end only if nobody targeted you", () => {
    const end = (targeted: boolean) => {
      const t = table("leo-intp", "leo-esfj");
      setUp(t, "b");
      if (targeted) use(t, "b", ["a"]);
      t.playUntil((s) => s.round === 2);
      return t.state.players.a.skill.usesLeft;
    };
    expect(end(false)).toBe(0);
    expect(end(true)).toBe(1);
  });
});

describe("rewards and bonds", () => {
  it("a marked player's next reward gives 1 extra Fate", () => {
    const t = table("scorpio-isfp", "leo-esfp");
    setUp(t, "a", (s) => {
      s.players.a.carriageIndex = s.carriages.find((c) => c.identity === "LUGGAGE")!.index;
      s.players.a.fate = 0;
      rigNextDie(s, 4);
    });
    use(t, "a", ["a"]);
    t.act("a", { type: "SEARCH" });
    drain(t);
    expect(t.state.players.a.statuses.some((st) => st.kind === "BONUS_NEXT_REWARD")).toBe(false);
    expect(t.state.log.some((l) => l.text.includes("mark pays out"))).toBe(true);
  });

  it("snatch takes the very item another player was rewarded with", () => {
    const t = table("gemini-istp", "leo-esfp");
    setUp(t, "b", (s) => {
      s.players.b.carriageIndex = s.carriages.find((c) => c.identity === "LUGGAGE")!.index;
      s.players.b.fate = 0;
      rigNextDie(s, 5);
    });
    t.act("b", { type: "SEARCH" });
    while (top(t) && !top(t)!.addressees.includes("a")) t.answerAll();
    const item = t.state.players.b.items.at(-1);
    answer(t, "a", "USE");
    expect(t.state.players.a.items).toEqual([item]);
  });

  it("follow me: either partner's gain pays the other, without bouncing back", () => {
    const t = table("aries-enfj", "leo-esfp");
    setUp(t, "a");
    use(t, "a", ["b"]);
    applyEffects(ctxOf(t), [{ kind: "GAIN_FATE", who: "TARGET", amount: 2 }], { ownerId: "SYSTEM", targets: ["a"], label: m`luck` });
    expect([t.state.players.a.fate, t.state.players.b.fate]).toEqual([5, 4]);
  });

  it("blood pact pays once the two have helped each other", () => {
    const t = table("scorpio-enfj", "leo-esfp");
    setUp(t, "a");
    use(t, "a", ["b"]);
    t.act("a", { type: "HELP", targetId: "b" });
    expect(t.state.players.a.fate).toBe(3);
    edit(t, (s) => (s.activeIndex = s.turnOrder.indexOf("b")));
    t.act("b", { type: "HELP", targetId: "a" });
    expect([t.state.players.a.fate, t.state.players.b.fate]).toEqual([5, 5]);
  });

  it("hidden thread pays only one way: their first reward pays you, yours pays nobody", () => {
    const t = table("scorpio-intj", "leo-esfp");
    setUp(t, "a");
    use(t, "a", ["b"]);
    const searchAsReward = (id: PlayerId) =>
      edit(t, (s) => {
        s.activeIndex = s.turnOrder.indexOf(id);
        s.players[id].carriageIndex = s.carriages.find((c) => c.identity === "LUGGAGE")!.index;
        s.players[id].fate = 0;
        rigNextDie(s, 5);
      });
    searchAsReward("a");
    t.act("a", { type: "SEARCH" });
    drain(t);
    expect(t.state.players.b.fate).toBe(3);
    searchAsReward("b");
    const before = t.state.players.a.fate;
    t.act("b", { type: "SEARCH" });
    drain(t);
    expect(t.state.players.a.fate).toBe(before + 1);
  });

  it("a secret bond is invisible to everyone but its members", () => {
    const t = table("scorpio-intj", "leo-esfp", "pisces-isfj");
    setUp(t, "a");
    use(t, "a", ["b"]);
    expect(project(t.state, "c").bonds).toEqual([]);
    expect(project(t.state, "a").bonds).toHaveLength(1);
  });
});

describe("rolls an ability shapes", () => {
  const roll = (t: Table, id: PlayerId, die: number) => {
    edit(t, (s) => {
      s.players[id].fate = Math.min(s.players[id].fate, 0);
      rigNextDie(s, die);
    });
    t.act(id, { type: "SEARCH" });
    drain(t);
  };

  it("double down: a success pays 2 extra, a failure costs 1", () => {
    const after = (die: number) => {
      const t = table("taurus-entp", "leo-esfp");
      setUp(t, "a", (s) => (s.players.a.carriageIndex = 0)); // the boarding car: a success is a clue, +1 Fate
      use(t, "a");
      edit(t, (s) => (s.players.a.fate = 1));
      edit(t, (s) => rigNextDie(s, die));
      t.act("a", { type: "INVESTIGATE" });
      drain(t); // the Fate window keeps the die as rolled
      expect(t.state.players.a.wager).toBeNull();
      return t.state.players.a.fate;
    };
    expect(after(5)).toBe(1 + 1 + 2);
    expect(after(2)).toBe(0);
  });

  it("all in doubles a failure's penalty", () => {
    const t = table("sagittarius-estp", "leo-esfp");
    setUp(t, "a", (s) => (s.players.a.carriageIndex = s.carriages.find((c) => c.identity === "LUGGAGE")!.index));
    use(t, "a");
    roll(t, "a", 1);
    expect(t.state.players.a.sanity).toBe(1);
  });

  it("a recorded result is offered in the next Fate window, once", () => {
    const t = table("gemini-istj", "leo-esfp");
    setUp(t, "a", (s) => (s.players.a.storedResult = 6));
    edit(t, (s) => rigNextDie(s, 2));
    t.act("a", { type: "SEARCH" });
    const w = top(t)!;
    expect(w.options.find((o) => o.id === "STORED")?.label).toEqual(m`Use your recorded ${6}`);
    answer(t, "a", "STORED");
    drain(t);
    expect(t.state.roll?.final).toBe(6);
    expect(t.state.players.a.storedResult).toBeNull();
  });

  it("time cache: the previewed die is the one rolled", () => {
    const t = table("aquarius-infj", "leo-esfp");
    setUp(t, "a");
    use(t, "a");
    const seen = Number(en(t.state.secrets.a.peeks.at(-1)!.text).match(/show (\d)/)![1]);
    edit(t, (s) => (s.players.a.fate = 0));
    t.act("a", { type: "SEARCH" });
    drain(t);
    expect(t.state.roll?.raw).toBe(seen);
  });

  it("safety rope: the next failure costs nothing", () => {
    const t = table("capricorn-isfj", "leo-esfp");
    setUp(t, "a", (s) => (s.players.a.carriageIndex = s.carriages.find((c) => c.identity === "LUGGAGE")!.index));
    use(t, "a", ["a"]);
    roll(t, "a", 1);
    expect(t.state.players.a.sanity).toBe(3);
  });
});

describe("rules, turn order, borrowed abilities", () => {
  it("rewrite the rules: +1 to every roll, for this round only", () => {
    const t = table("aquarius-intj", "leo-esfp");
    setUp(t, "a");
    use(t, "a");
    answer(t, "a", "ROLL_BONUS");
    edit(t, (s) => (s.players.a.fate = 0));
    t.act("a", { type: "SEARCH" });
    drain(t);
    expect(t.state.roll?.modifiers).toContainEqual({ source: m`Rewritten rules`, delta: 1 });
    t.playUntil((s) => s.round === 2 && s.step === "PLAYER_TURNS");
    expect(t.state.ruleMods).toEqual([]);
  });

  it("reorder: the chosen players act first next round, in that order", () => {
    const t = table("gemini-estj", "leo-esfp", "pisces-isfj");
    setUp(t, "a");
    use(t, "a", ["c", "b"]);
    t.playUntil((s) => s.round === 2 && s.step === "PLAYER_TURNS");
    expect(t.state.turnOrder.slice(0, 2)).toEqual(["c", "b"]);
  });

  it("server rave lends unused active abilities out, and they come home next round", () => {
    const t = table("aquarius-esfp", "leo-esfj", "leo-intj");
    setUp(t, "a");
    use(t, "a");
    expect(t.state.players.b.skill.borrowed).toBe("leo-intj");
    expect(t.state.players.c.skill.borrowed).toBe("leo-esfj");
    t.playUntil((s) => s.round === 2);
    expect([t.state.players.b.skill.borrowed, t.state.players.c.skill.borrowed]).toEqual([undefined, undefined]);
  });

  it("dominate: the target's next ability can't touch you", () => {
    const t = table("scorpio-entj", "leo-esfj", "leo-esfp");
    setUp(t, "a");
    use(t, "a", ["b"]);
    edit(t, (s) => (s.activeIndex = s.turnOrder.indexOf("b")));
    expect(() => use(t, "b", ["a"])).toThrow(/can't target A/);
    use(t, "b", ["c"]);
    expect(t.state.players.b.statuses.some((st) => st.kind === "FORBIDDEN_TARGET")).toBe(false);
  });

  it("copy the code repeats the ability someone just used", () => {
    const t = table("gemini-intp", "leo-esfj", "leo-esfp");
    setUp(t, "b");
    use(t, "b", ["c"]);
    answer(t, "a", "USE");
    expect(t.state.players.c.fate).toBe(5);
  });
});

describe("tasks, choices and what only the owner sees", () => {
  it("KPI: a goal met in time pays the setter and the holder", () => {
    const t = table("capricorn-entj", "leo-esfp");
    setUp(t, "a");
    use(t, "a", ["b"]);
    const task = t.state.secrets.b.tasks[0];
    expect(project(t.state, "a").mySecrets!.tasks).toEqual([]);
    edit(t, (s) => {
      const st = s.players.b.stats;
      ({ REPAIR: () => st.repairs++, FRAGMENT: () => st.fragmentsFound++, HELP: () => st.helpsGiven++, NEW_CARRIAGE: () => st.carriagesVisited.push("MIRROR") })[task.goal]();
    });
    t.tick(1);
    expect([t.state.players.a.fate, t.state.players.b.fate]).toEqual([4, 4]);
  });

  it("i never said that: changes its holder's answer before the vote settles", () => {
    const vote = card((c) => c.kind === "VOTE");
    const t = table("gemini-entp", "leo-esfp", "pisces-isfj");
    revealNext(t, vote);
    const [first, second] = vote.options!.map((o) => o.id);
    for (const id of ["a", "b", "c"]) answer(t, id, id === "a" ? second : first);
    answer(t, "a", second === first ? "KEEP" : first); // a joins the majority instead
    drain(t);
    expect(t.state.currentEvent?.choice).toBe(first);
  });

  it("a glimpse goes to its owner only", () => {
    const t = table("aries-infj", "leo-esfp");
    setUp(t, "a");
    use(t, "a");
    expect(project(t.state, "a").mySecrets!.peeks).toHaveLength(1);
    expect(JSON.stringify(project(t.state, "b"))).not.toContain(t.state.secrets.a.peeks[0].text);
  });
});

describe("moments found by the PHASE 11 simulations", () => {
  it("emergency rations also answers Fate spent down to 0 on a roll", () => {
    const t = table("taurus-isfj", "leo-esfp");
    setUp(t, "a", (s) => {
      s.players.a.fate = 1;
      rigNextDie(s, 3);
    });
    t.act("a", { type: "SEARCH" });
    answer(t, "a", "1"); // spend the last Fate to reach a success
    drain(t);
    expect(t.state.players.a.skill.usesLeft).toBe(0);
    expect(t.state.players.a.fate).toBeGreaterThanOrEqual(1);
  });

  it("can't let go: a buff used up comes back for one more round", () => {
    const t = table("taurus-infp", "leo-esfp");
    setUp(t, "a", (s) => {
      s.players.a.statuses = [{ id: "st1", kind: "INVESTIGATE_BONUS", polarity: "POSITIVE", sourceId: "a", expiresAtRound: null, hidden: false, ordinary: true, value: 2 }];
      s.players.a.fate = 0;
      rigNextDie(s, 3);
    });
    t.act("a", { type: "INVESTIGATE" });
    while (top(t) && !top(t)!.addressees.includes("a")) t.answerAll();
    while (top(t)?.kind !== "REACTION") t.answerAll();
    answer(t, "a", "USE");
    expect(t.state.players.a.statuses.find((st) => st.kind === "INVESTIGATE_BONUS")).toMatchObject({ value: 2, expiresAtRound: t.state.round + 1 });
  });
});

describe("counters to a player hurting another (rare at a co-operative table, but they work)", () => {
  /** b uses Requisition (taurus-entj): 1 Fate from each of a and c. The holder sits at a (a victim) or c. */
  const attacked = (holder: CharacterId, seat: "a" | "c" = "a") => {
    const t = seat === "a" ? table(holder, "taurus-entj", "leo-esfp") : table("leo-esfp", "taurus-entj", holder);
    setUp(t, "b");
    use(t, "b", ["a", "c"]);
    return t;
  };

  it("void call cancels the theft as it is declared", () => {
    const t = attacked("libra-istp");
    answer(t, "a", "USE");
    drain(t);
    expect([t.state.players.a.fate, t.state.players.b.fate, t.state.players.c.fate]).toEqual([3, 3, 3]);
  });

  it("come home cancels an ability that moves Fate between players", () => {
    const t = attacked("cancer-estj");
    answer(t, "a", "USE");
    drain(t);
    expect(t.state.players.b.fate).toBe(3);
  });

  it("settle down cancels the theft from one player", () => {
    const t = attacked("libra-isfj", "c");
    // c answers the theft aimed at a (the first victim parked)
    answer(t, "c", "USE");
    drain(t);
    expect(t.state.players.a.fate).toBe(3);
  });

  it("no fighting turns the attack into 1 Fate each", () => {
    const t = attacked("libra-infp");
    answer(t, "a", "USE");
    drain(t);
    expect([t.state.players.a.fate, t.state.players.b.fate]).toEqual([4, 5]); // b still took c's 1
  });

  it("now you feel it sends a weaker copy back (a 1-Fate theft weakens to nothing)", () => {
    const t = attacked("cancer-entp");
    answer(t, "a", "USE");
    drain(t);
    expect(t.state.players.a.fate).toBe(2);
    expect(t.state.players.a.skill.usesLeft).toBe(0);
  });

  it("backbite makes the attacker take a risk roll", () => {
    const t = attacked("scorpio-entp");
    answer(t, "a", "USE");
    drain(t);
    expect(t.state.log.some((l) => l.text.startsWith("Backbite: B rolls"))).toBe(true);
  });

  it("swap shells gives up a buff to shrug the hit off", () => {
    const t = table("cancer-istp", "taurus-entj", "leo-esfp");
    setUp(t, "b", (s) => (s.players.a.statuses = [{ id: "st1", kind: "REPAIR_BONUS", polarity: "POSITIVE", sourceId: "a", expiresAtRound: null, hidden: false, ordinary: true, value: 2 }]));
    use(t, "b", ["a", "c"]);
    answer(t, "a", "USE");
    drain(t);
    expect(t.state.players.a).toMatchObject({ fate: 3, statuses: [] });
  });

  it("hold a grudge pays its holder for helping the first player who attacked them", () => {
    const t = attacked("scorpio-infp");
    drain(t);
    edit(t, (s) => (s.activeIndex = s.turnOrder.indexOf("a")));
    t.act("a", { type: "HELP", targetId: "b" });
    expect(t.state.players.a.skill.usesLeft).toBe(0);
  });

  it("penalty notice and reckoning can only name a player who has been hurting others", () => {
    const t = table("virgo-estj", "taurus-entj", "scorpio-estj");
    setUp(t, "a");
    expect(() => use(t, "a", ["b"])).toThrow(/nothing to act on/);
    edit(t, (s) => (s.activeIndex = s.turnOrder.indexOf("b")));
    use(t, "b", ["a", "c"]);
    drain(t);
    edit(t, (s) => (s.activeIndex = s.turnOrder.indexOf("c")));
    use(t, "c", ["b"]); // Reckoning: b has attacked the most
    expect(t.state.log.some((l) => l.text.startsWith("Reckoning: B rolls"))).toBe(true);
  });
});
