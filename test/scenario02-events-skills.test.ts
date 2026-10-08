import { describe, expect, it } from "vitest";
import { activePlayerId, type Ctx } from "../src/server/engine/context.ts";
import { createGame } from "../src/server/engine/create.ts";
import { applyEffects } from "../src/server/engine/effects.ts";
import { applyGameAction, startGame, tickGame } from "../src/server/engine/engine.ts";
import { useSkill } from "../src/server/engine/resolver.ts";
import { neighbours, solvable } from "../src/server/engine/scenario02/city.ts";
import { ROSTER, getCharacter } from "../src/shared/characters/roster/index.ts";
import type { TargetRule } from "../src/shared/characters/types.ts";
import { EVENTS } from "../src/shared/game/scenario01/events.ts";
import { MAX_SANITY } from "../src/shared/game/scenario01/content.ts";
import { EVENT_IDS02 } from "../src/shared/game/scenario02/events.ts";
import { HARBOUR_ZONE, hexDistance, zoneIndex } from "../src/shared/game/scenario02/map.ts";
import { CORE_SKILLS } from "../src/shared/skills/core/index.ts";
import { characterSkill } from "../src/shared/game/skills.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { en, format } from "../src/shared/i18n/format.ts";
import { m, ref } from "../src/shared/i18n/msg.ts";
import { playRun02 } from "./bot02.ts";
import { SEED, seatsFor, T0 } from "./helpers.ts";

// PHASE S2-5: the city's own events, its abilities, and whole runs played by
// a sensible team (test/bot02.ts) on many seeds and table sizes.

const at = (id: string) => zoneIndex(id);
const ack = (s: GameState) => s.turnOrder.reduce((x, id) => applyGameAction(x, id, { type: "ACK_SEQUENCE" }, T0 + 1).state, s);
const city = (n = 3, seed = SEED) => ack(startGame(createGame("g", seatsFor(n), seed, T0, "S02_SUNKEN_CITY"), T0).state);
const fire = (s: GameState, what: Parameters<typeof cityEvent>[1]) => cityEvent(s, what);
function cityEvent(s: GameState, what: "AFTERSHOCK" | "STORM" | "BROADCAST" | "DISTRESS" | "LOW_TIDE" | "SALVAGE" | "BREACH" | "NAME" | "HOLD") {
  const ctx: Ctx = { s, now: T0, events: [] };
  applyEffects(ctx, [{ kind: "CITY_EVENT", what }], { ownerId: "SYSTEM", targets: [], label: m`test` });
  return ctx;
}
const seedFor = (i: number) => ((i + 1) * 2654435761 >>> 0).toString(16).padStart(8, "0").repeat(4);

describe("the city's events", () => {
  it("a run draws only its own scenario's cards", () => {
    expect(city().eventDeck.every((id) => EVENT_IDS02.includes(id))).toBe(true);
    const s01 = startGame(createGame("g", seatsFor(3), SEED, T0), T0).state;
    expect(s01.eventDeck.every((id) => EVENTS.some((e) => e.id === id))).toBe(true);
  });

  it("an aftershock breaks a standing road, never one onto the pier", () => {
    for (let i = 0; i < 20; i++) {
      const s = city(3, seedFor(i));
      const before = s.city!.edges.filter((e) => e.broken).length;
      fire(s, "AFTERSHOCK");
      const broken = s.city!.edges.filter((e) => e.broken);
      expect(broken).toHaveLength(before + 1);
      expect(broken.some((e) => e.a === at(HARBOUR_ZONE) || e.b === at(HARBOUR_ZONE))).toBe(false);
    }
  });

  it("a storm makes the next rise bigger and hurts whoever stands in water", () => {
    const s = city();
    const [a, b] = s.turnOrder;
    s.city!.zones[at("METRO")].status = "FLOODED";
    s.players[a].carriageIndex = at("METRO");
    fire(s, "STORM");
    expect(s.city!.surge).toBe(1);
    expect([s.players[a].sanity, s.players[b].sanity]).toEqual([2, 3]);
  });

  it("the broadcast names exactly the zones that go under next", () => {
    const s = city();
    const ctx = fire(s, "BROADCAST");
    const live = s.city!.zones.filter((z) => z.status !== "SUBMERGED" && z.sinkAt < 50);
    const next = Math.min(...live.map((z) => z.sinkAt));
    const named = s.city!.zones.map((z, i) => (z.status !== "SUBMERGED" && z.sinkAt === next ? i : -1)).filter((i) => i >= 0);
    expect(s.log.at(-1)!.msg.k).toBe("The broadcast names the next to go under: {0}.");
    expect((s.log.at(-1)!.msg.p![0] as { p: unknown[] }).p).toHaveLength(named.length);
    void ctx;
  });

  it("a distress call puts someone new on the map; low tide lifts a drowned zone until the next rise", () => {
    const s = city();
    const npcs = s.city!.npcs.length;
    fire(s, "DISTRESS");
    expect(s.city!.npcs).toHaveLength(npcs + 1);
    s.collapse = 6;
    s.city!.zones[at("METRO")].status = "SUBMERGED";
    fire(s, "LOW_TIDE");
    const up = s.city!.zones.findIndex((z, i) => z.status === "FLOODED" && z.sinkAt === 7 && i !== -1);
    expect(up).toBeGreaterThanOrEqual(0);
    expect(neighbours(s.city!, up).some((n) => s.city!.zones[n].status !== "SUBMERGED")).toBe(true);
  });

  it("supplies wash up somewhere searchable; the breach floods zones and raises Collapse; still water holds a rise", () => {
    const s = city();
    fire(s, "SALVAGE");
    expect(s.city!.zones.some((z) => !z.searched && z.caches.length >= 2)).toBe(true);
    const flooded = s.city!.zones.filter((z) => z.status === "FLOODED").length;
    const collapse = s.collapse;
    fire(s, "BREACH");
    expect(s.collapse).toBe(collapse + 1);
    expect(s.city!.zones.filter((z) => z.status === "FLOODED").length).toBeGreaterThanOrEqual(flooded + 1);
    fire(s, "HOLD");
    expect(s.city!.hold).toBe(1);
  });
});

describe("abilities in the city", () => {
  const TRAIN = /\b(N13|train|carriages?|inspector|ticket|conductor|cab|anchors?|escape locks?|echo(es)?|passengers?|night rules?|memory fragments?|core memor(y|ies)|shadow)\b/i;

  it("all 192 have an ability in the city with no train words, and every name is distinct", () => {
    const names = new Set<string>();
    for (const c of ROSTER) {
      const s = characterSkill(c.id, "S02_SUNKEN_CITY");
      expect(`${s.name} ${s.description}`, c.id).not.toMatch(TRAIN);
      names.add(s.name.toLowerCase());
    }
    expect(names.size).toBe(192);
  });

  it("Pisces ENTP's ticket pass belongs to the train: in the city it is its plain core, a shield, and says so", () => {
    const s = characterSkill("pisces-entp", "S02_SUNKEN_CITY");
    expect(s.effects).toEqual(CORE_SKILLS[getCharacter("pisces", "ENTP").coreSkillId].effects);
    expect(s.description).toBe("Gain a shield that blocks the next negative effect on you.");
    expect(format("en", ref.skill("pisces-entp", "S02_SUNKEN_CITY"))).toBe("Brave Face");
    expect(format("en", ref.skill("pisces-entp"))).toBe(characterSkill("pisces-entp").name);
  });

  it("an ability that pulls someone closer moves them one walkable zone toward its user", () => {
    const s = city();
    const [a, b] = s.turnOrder;
    s.players[a].characterId = "leo-entj";
    s.players[a].skill = { usesLeft: 1, state: "READY" };
    s.players[a].carriageIndex = at("CITY_HALL");
    s.players[b].carriageIndex = at("ESTATE"); // two zones from City Hall
    s.activeIndex = s.turnOrder.indexOf(a);
    const ctx: Ctx = { s, now: T0, events: [] };
    useSkill(ctx, a, [b]);
    let x = ctx.s;
    for (let i = 0; i < 20 && x.pending.length; i++) {
      const w = x.pending.at(-1)!;
      const who = w.addressees.find((p) => !(p in w.answers));
      x = who ? applyGameAction(x, who, { type: "RESPOND", windowId: w.id, optionId: w.defaultOptionId }, T0 + 10 + i).state : tickGame(x, T0 + 10 + i).state;
    }
    expect(hexDistance(x.players[b].carriageIndex, at("CITY_HALL"))).toBe(1);
    expect(neighbours(x.city!, at("ESTATE"))).toContain(x.players[b].carriageIndex);
    expect(x.log.some((l) => en(l.msg).includes("moves one zone closer"))).toBe(true);
  });

  const CHOSEN: Partial<Record<TargetRule, string[]>> = { ANY_PLAYER: ["b"], OTHER_PLAYER: ["b"], SAME_CARRIAGE: ["b"], TWO_PLAYERS: ["b", "c"], UP_TO_THREE_PLAYERS: ["b", "c"] };
  const base = (() => {
    const s = city(3);
    for (const p of Object.values(s.players)) {
      p.fate = 3;
      p.carriageIndex = at("CIVIC_SQUARE");
      p.items = ["ROPE", "FIRST_AID_KIT"];
    }
    s.activeIndex = s.turnOrder.indexOf("a");
    return s;
  })();

  it.each(ROSTER.map((c) => [c.id] as const))("%s fires in a city run and leaves it legal", (id) => {
    const s = structuredClone(base);
    s.players.a.characterId = id;
    s.players.a.skill = { usesLeft: 1, state: "READY" };
    const skill = characterSkill(id, "S02_SUNKEN_CITY");
    const ctx: Ctx = { s, now: T0 + 1000, events: [] };
    useSkill(ctx, "a", CHOSEN[skill.target] ?? [], { trigger: { kind: skill.trigger.on, subjectId: "a", sourceId: "b", tier: "SUCCESS", amount: 2, item: "ROPE" } });
    let x = ctx.s;
    for (let i = 0; i < 30 && x.pending.length; i++) {
      const w = x.pending.at(-1)!;
      const who = w.addressees.find((p) => !(p in w.answers));
      x = who ? applyGameAction(x, who, { type: "RESPOND", windowId: w.id, optionId: w.defaultOptionId }, T0 + 2000 + i).state : tickGame(x, T0 + 2000 + i).state;
    }
    for (const p of Object.values(x.players)) {
      expect(p.fate, id).toBeGreaterThanOrEqual(0);
      expect(p.sanity).toBeLessThanOrEqual(MAX_SANITY);
      expect(x.city!.zones[p.carriageIndex], `${id} put ${p.playerId} off the map`).toBeDefined();
    }
    expect(x.collapse).toBeLessThanOrEqual(x.collapseMax);
  });
});

describe("whole runs", () => {
  it("random cities on 2 to 10 players always play through to the end; the boat leaves on some at every size", () => {
    for (const n of [2, 4, 6, 8, 10]) {
      let left = 0;
      for (let i = 0; i < 4; i++) {
        const chars = ROSTER.slice(i * 11, i * 11 + n).map((c) => [c.zodiac, c.mbti] as [typeof c.zodiac, typeof c.mbti]);
        const run = playRun02({ seed: seedFor(n * 10 + i), chars });
        expect(solvable(run.initial.city!), `${n}p seed ${i}`).toEqual([]);
        expect(run.state.phase, `${n}p seed ${i}`).toBe("RESULTS");
        if (run.state.outcome === "S02_EVACUATED") {
          left++;
          const aboard = run.state.results!.filter((r) => r.escape === "ESCAPED").length;
          expect(aboard).toBeLessThanOrEqual(run.state.city!.boat.capacity);
          expect(aboard).toBeLessThan(n);
        }
      }
      expect(left, `${n} players`).toBeGreaterThan(0);
    }
  }, 30_000); // 20 whole runs

  it("a city run's turn order and actions are the shared ones: 3 AP, END_TURN passes", () => {
    const s = city(3);
    const id = activePlayerId(s)!;
    expect(s.players[id].ap).toBe(3);
    expect(activePlayerId(applyGameAction(s, id, { type: "END_TURN" }, T0 + 5).state)).not.toBe(id);
  });
});
