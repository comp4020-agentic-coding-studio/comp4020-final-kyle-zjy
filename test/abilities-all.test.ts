import { describe, expect, it } from "vitest";
import { m } from "../src/shared/i18n/msg.ts";
import type { Ctx } from "../src/server/engine/context.ts";
import { useSkill } from "../src/server/engine/resolver.ts";
import { tickGame } from "../src/server/engine/engine.ts";
import { ROSTER } from "../src/shared/characters/roster/index.ts";
import type { TargetRule } from "../src/shared/characters/types.ts";
import { MAX_SANITY } from "../src/shared/game/scenario01/content.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { Table } from "./helpers.ts";
import { characterSkill } from "../src/shared/game/scenario01/skills.ts";

// Every one of the 192 abilities, fired once through the real resolver in a
// busy act-2 table: it must not throw, must leave the table in a legal state,
// and must leave every decision it opened answerable. (Behaviour is tested per
// effect and trigger in abilities.test.ts.)

const base = (() => {
  const t = new Table(3);
  t.playUntil((s) => s.round === 4 && s.step === "PLAYER_TURNS" && !s.sequence && !s.pending.length);
  const s = t.state;
  for (const p of Object.values(s.players)) {
    p.fate = 3;
    p.carriageIndex = 2;
    p.items = ["FLASHLIGHT", "MEDKIT"];
  }
  const st = (kind: string, polarity: "POSITIVE" | "NEGATIVE", hidden = false) => ({ id: `st_${kind}`, kind, polarity, sourceId: "b", expiresAtRound: s.round, hidden, ordinary: true, value: 1 });
  s.players.a.statuses = [st("INVESTIGATE_BONUS", "POSITIVE")];
  s.players.b.statuses = [st("REPAIR_BONUS", "POSITIVE"), st("WATCHED", "NEGATIVE", true)];
  s.players.c.statuses = [st("STATIC", "NEGATIVE")];
  s.players.b.skill = { usesLeft: 0, state: "BURNED" };
  s.lastSkill = { ownerId: "b", characterId: "pisces-isfj", targets: ["a"], round: s.round };
  s.delayed = [{ dueRound: s.round + 1, ownerId: "a", targets: [], effects: [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }], label: m`set aside` }];
  s.roundRecord.succeeded = ["c"];
  s.roundRecord.lastSuccess = "c";
  s.roundRecord.bestRoll = 5;
  return { state: s, now: t.now };
})();

const CHOSEN: Partial<Record<TargetRule, string[]>> = { ANY_PLAYER: ["b"], OTHER_PLAYER: ["b"], SAME_CARRIAGE: ["b"], TWO_PLAYERS: ["b", "c"], UP_TO_THREE_PLAYERS: ["b", "c"] };

function legal(s: GameState): string[] {
  const problems: string[] = [];
  for (const p of Object.values(s.players)) {
    if (!Number.isInteger(p.fate) || p.fate < 0) problems.push(`${p.playerId} fate ${p.fate}`);
    if (!Number.isInteger(p.sanity) || p.sanity < 0 || p.sanity > MAX_SANITY) problems.push(`${p.playerId} sanity ${p.sanity}`);
    if (!Number.isInteger(p.ap) || p.ap < 0) problems.push(`${p.playerId} ap ${p.ap}`);
  }
  if (!Number.isInteger(s.collapse) || s.collapse < 0 || s.collapse > s.collapseMax) problems.push(`collapse ${s.collapse}`);
  for (const w of s.pending) if (!w.options.some((o) => o.id === w.defaultOptionId)) problems.push(`window ${w.kind} has no default`);
  return problems;
}

describe("all 192 abilities fire cleanly", () => {
  it.each(ROSTER.map((c) => [c.id, c] as const))("%s", (_, c) => {
    const s = structuredClone(base.state);
    s.players.a.characterId = c.id;
    s.players.a.skill = { usesLeft: 1, state: "READY" };
    s.activeIndex = s.turnOrder.indexOf("a");
    const targets = CHOSEN[characterSkill(c.id).target] ?? [];
    // reactions answer a parked hit on a, from b; event reactions answer a revealed event
    if (characterSkill(c.id).type !== "ACTIVE") {
      s.pendingEffect = { id: "pe1", kind: characterSkill(c.id).trigger.on === "TARGETED_ABILITY_DECLARED" ? "ABILITY" : "EFFECT", sourceId: "b", targetId: "a", targets: ["a"], label: m`a test hit`, effects: [{ kind: "LOSE_FATE", who: "TARGET", amount: 1 }], single: true, reduced: 0, cancelled: false, asked: ["a", "b", "c"], copyBack: [], attack: true, theft: false };
      s.currentEvent = { id: "DINNER_BELL", round: s.round, resolved: false, revealing: true, asked: ["a", "b", "c"], excluded: [] };
      s.roll = { id: "r1", playerId: "a", purpose: "INVESTIGATE", label: m`test roll`, raw: 2, modifiers: [], fateSpent: 0, final: 2, tier: "FAIL", modifiable: true, done: false };
      s.rollContext = { kind: "INVESTIGATE", carriageIndex: 2, asked: ["a", "b", "c"] };
    }
    const ctx: Ctx = { s, now: base.now + 1000, events: [] };
    useSkill(ctx, "a", targets, { trigger: { kind: characterSkill(c.id).trigger.on, subjectId: "a", sourceId: "b", tier: "SUCCESS", amount: 2, status: s.players.a.statuses[0], item: "MEDKIT" } });
    expect(s.players.a.skill.usesLeft).toBeLessThanOrEqual(0);
    expect(legal(s)).toEqual([]);
    // let the table settle: every window it opened takes its default answer
    let state = s;
    let now = ctx.now;
    for (let i = 0; i < 30 && (state.pending.length || state.pendingEffect || state.currentEvent?.revealing || state.triggerQueue.length); i++) {
      now += 60_000;
      state = tickGame(state, now).state;
    }
    expect(legal(state)).toEqual([]);
    expect(() => JSON.stringify(state)).not.toThrow();
  });
});
