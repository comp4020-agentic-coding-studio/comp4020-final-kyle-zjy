import { describe, expect, it } from "vitest";
import { m } from "../src/shared/i18n/msg.ts";
import { canUseSkill, playersWokenBy } from "../src/server/engine/skills.ts";
import { getCharacterById, ROSTER } from "../src/shared/characters/roster/index.ts";
import type { CharacterId, TargetRule } from "../src/shared/characters/types.ts";
import type { GameState, PendingWindow } from "../src/shared/game/state.ts";
import { newRun } from "./helpers.ts";

// The generic skill checks, run against every character: an unused skill can
// be used in its proper moment with legal targets, and never twice.

/** Four players a–d; `owner` is a's character. b and c share a's carriage, d is elsewhere. */
function state(owner: CharacterId, extra: Partial<GameState> = {}): GameState {
  const base = newRun(4, { chars: [[getCharacterById(owner).zodiac, getCharacterById(owner).mbti], ["pisces", "ISFJ"], ["leo", "ESFP"], ["aries", "INTJ"]] }).state;
  const s: GameState = { ...base, turnOrder: ["a", "b", "c", "d"], activeIndex: 0, step: "PLAYER_TURNS", phase: "ACT_1", pending: [], sequence: null, ...extra };
  s.players.d.carriageIndex = 5;
  for (const p of Object.values(s.players)) p.skill = { usesLeft: 1, state: "READY" };
  return s;
}

const windowFor = (kind: PendingWindow["kind"], to: string): PendingWindow => ({
  id: "w1",
  kind,
  title: m`test`,
  prompt: m`test`,
  addressees: [to],
  options: [
    { id: "yes", label: m`Use it` },
    { id: "no", label: m`Not now` },
  ],
  defaultOptionId: "no",
  answers: {},
  resume: { kind: "TEST" },
  blocksTable: true,
});

const LEGAL_TARGETS: Record<TargetRule, string[]> = {
  ANY_PLAYER: ["b"],
  OTHER_PLAYER: ["b"],
  SAME_CARRIAGE: ["b"],
  TWO_PLAYERS: ["b", "c"],
  UP_TO_THREE_PLAYERS: ["a", "b", "c"],
  SELF: [],
  ALL_PLAYERS: [],
  LOWEST_FATE: [],
  HIGHEST_FATE: [],
  TRIGGER_SOURCE: [],
  RANDOM_PLAYERS: [],
  NONE: [],
};

/** A state in which `id`'s skill has its proper moment. */
function readyState(id: CharacterId): GameState {
  const { type } = getCharacterById(id).skill;
  if (type === "ACTIVE") return state(id);
  return state(id, { activeIndex: 1, pending: [windowFor(type === "REACTION" ? "REACTION" : "PASSIVE_CONFIRM", "a")] });
}

describe("skill engine: every character", () => {
  it.each(ROSTER.map((c) => [c.id, c.skill.type] as const))("%s (%s) can use its skill once, in its moment", (id) => {
    const s = readyState(id);
    const targets = LEGAL_TARGETS[getCharacterById(id).skill.target];
    expect(canUseSkill(s, "a", targets)).toEqual({ ok: true });

    s.players.a.skill = { usesLeft: 0, state: "BURNED" };
    expect(canUseSkill(s, "a", targets)).toMatchObject({ ok: false, code: "SKILL_ALREADY_USED" });
  });
});

describe("skill engine: timing", () => {
  it("rejects an ACTIVE skill off-turn, while a decision is open, and outside the run", () => {
    expect(canUseSkill(state("aries-entj", { activeIndex: 1 }), "a", ["b"])).toMatchObject({ code: "NOT_YOUR_TURN" });
    expect(canUseSkill(state("aries-entj", { pending: [windowFor("VOTE", "b")] }), "a", ["b"])).toMatchObject({ code: "WINDOW_OPEN" });
    expect(canUseSkill(state("aries-entj", { phase: "INTRO" }), "a", ["b"])).toMatchObject({ code: "WRONG_PHASE" });
  });

  it("rejects a REACTION skill without its window, or with someone else's", () => {
    expect(canUseSkill(state("aries-istp"), "a", [])).toMatchObject({ code: "NOT_YOUR_WINDOW" });
    expect(canUseSkill(state("aries-istp", { pending: [windowFor("REACTION", "b")] }), "a", [])).toMatchObject({ code: "NOT_YOUR_WINDOW" });
  });

  it("rejects a locked skill", () => {
    const s = state("aries-entj");
    s.players.a.skill.state = "LOCKED";
    expect(canUseSkill(s, "a", ["b"])).toMatchObject({ code: "SKILL_LOCKED" });
  });
});

describe("skill engine: targets", () => {
  it("OTHER_PLAYER refuses yourself and absent players", () => {
    expect(canUseSkill(state("aries-entj"), "a", ["a"])).toMatchObject({ code: "ILLEGAL_TARGET" });
    expect(canUseSkill(state("aries-entj"), "a", ["zz"])).toMatchObject({ code: "ILLEGAL_TARGET" });
    expect(canUseSkill(state("aries-entj"), "a", [])).toMatchObject({ code: "ILLEGAL_TARGET" });
  });

  it("TWO_PLAYERS needs two different players", () => {
    expect(canUseSkill(state("aries-esfj"), "a", ["b", "b"])).toMatchObject({ code: "ILLEGAL_TARGET" });
    expect(canUseSkill(state("aries-esfj"), "a", ["b"])).toMatchObject({ code: "ILLEGAL_TARGET" });
  });

  it("server-picked rules refuse a client-chosen target", () => {
    expect(canUseSkill(state("aries-infj"), "a", ["b"])).toMatchObject({ code: "ILLEGAL_TARGET" });
  });

  it("an away player can't be targeted", () => {
    const s = state("aries-entj");
    s.players.b.away = true;
    expect(canUseSkill(s, "a", ["b"])).toMatchObject({ code: "ILLEGAL_TARGET" });
  });
});

describe("skill engine: who a game event wakes", () => {
  it("a self-targeted negative effect wakes the target's own dodge, not anyone else's", () => {
    const s = state("aries-istp"); // Precise Dodge: NEGATIVE_EFFECT_TARGETS_SELF
    expect(playersWokenBy(s, { kind: "NEGATIVE_EFFECT_TARGETS_SELF", subjectId: "a", sourceId: "b" })).toEqual(["a"]);
    expect(playersWokenBy(s, { kind: "NEGATIVE_EFFECT_TARGETS_SELF", subjectId: "b", sourceId: "c" })).toEqual([]);
  });

  it("a guardian wakes when someone else is hit, but not for their own hit", () => {
    const s = state("aries-isfj"); // Take the Hit: NEGATIVE_EFFECT_TARGETS_ANY, others
    expect(playersWokenBy(s, { kind: "NEGATIVE_EFFECT_TARGETS_ANY", subjectId: "b", sourceId: "c" })).toEqual(["a"]);
    expect(playersWokenBy(s, { kind: "NEGATIVE_EFFECT_TARGETS_ANY", subjectId: "a", sourceId: "c" })).toEqual([]);
  });

  it("a burned skill sleeps through its trigger", () => {
    const s = state("aries-istp");
    s.players.a.skill = { usesLeft: 0, state: "BURNED" };
    expect(playersWokenBy(s, { kind: "NEGATIVE_EFFECT_TARGETS_SELF", subjectId: "a", sourceId: "b" })).toEqual([]);
  });

  it("ACTIVE skills are never woken by events", () => {
    const s = state("aries-entj");
    expect(playersWokenBy(s, { kind: "OWN_TURN", subjectId: "a" })).toEqual([]);
  });
});
