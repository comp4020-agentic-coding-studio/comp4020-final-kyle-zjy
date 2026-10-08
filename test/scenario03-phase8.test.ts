import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { useSkill } from "../src/server/engine/resolver.ts";
import { ROSTER } from "../src/shared/characters/roster/index.ts";
import type { TargetRule } from "../src/shared/characters/types.ts";
import { eventsFor } from "../src/shared/game/events.ts";
import { SKILLS } from "../src/shared/game/scenario01/skills.ts";
import { SKILLS02 } from "../src/shared/game/scenario02/skills.ts";
import { SCENARIO03_SKILLS } from "../src/shared/game/scenario03/skill-adapters.ts";
import { SKILLS03 } from "../src/shared/game/scenario03/skills.ts";
import { characterSkill } from "../src/shared/game/skills.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { characterText } from "../src/shared/i18n/content.ts";
import { format } from "../src/shared/i18n/format.ts";
import { ref } from "../src/shared/i18n/msg.ts";
import { EN_EVENTS03 } from "../src/shared/i18n/scenario03.ts";
import { ZH_EVENTS03 } from "../src/shared/i18n/zh-CN/scenario03.ts";
import { SEED, T0, rigNextDie, seatsFor } from "./helpers.ts";

const HAN = /[一-鿿]/;
const FOREIGN_SETTING = /\b(train|carriage|passenger|ticket|city|zone|inspector|Fixed Anchor|Investigate|Search|Repair|Confront)\b/i;
const FOREIGN_ZH = /列车|车厢|乘客|车票|检票|锚点|调查掷骰/;

function start(chars?: Parameters<typeof seatsFor>[1]): GameState {
  let s = startGame(createGame("s3-skills", seatsFor(3, chars), SEED, T0, "S03_INCIDENT_ZERO"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  return s;
}

describe("Scenario 03 ability catalog", () => {
  it("resolves all 192 Core Skills with English, Chinese, and themed visuals", () => {
    expect(Object.keys(SCENARIO03_SKILLS.adapters)).toHaveLength(192);
    expect(Object.keys(SKILLS03)).toHaveLength(192);
    const enNames = new Set<string>();
    const zhNames = new Set<string>();
    for (const character of ROSTER) {
      const skill = characterSkill(character.id, "S03_INCIDENT_ZERO");
      const en = characterText("en", character.id, "S03_INCIDENT_ZERO");
      const zh = characterText("zh-CN", character.id, "S03_INCIDENT_ZERO");
      expect(skill.coreSkillId, character.id).toBe(character.coreSkillId);
      expect(skill.name, character.id).toBe(en.skillName);
      expect(skill.description, character.id).toBe(en.skillDescription);
      expect(skill.vfx, character.id).toBeTruthy();
      expect(en.skillName, character.id).not.toMatch(FOREIGN_SETTING);
      expect(en.skillDescription, character.id).not.toMatch(FOREIGN_SETTING);
      expect(zh.skillName, character.id).toMatch(HAN);
      expect(zh.skillDescription, character.id).toMatch(HAN);
      expect(zh.skillName + zh.skillDescription, character.id).not.toMatch(FOREIGN_ZH);
      enNames.add(en.skillName);
      zhNames.add(zh.skillName);
    }
    expect(enNames.size).toBe(192);
    expect(zhNames.size).toBe(192);
    expect(characterSkill("pisces-entp", "S03_INCIDENT_ZERO").effects).toEqual([{ kind: "SHIELD", who: "SELF", charges: 1 }]);
    expect(SKILLS["pisces-entp"].effects).not.toEqual(SKILLS03["pisces-entp"].effects);
    expect(SKILLS02["pisces-entp"].effects).toEqual(SKILLS03["pisces-entp"].effects);
  });

  it("localizes every public anomaly and its choices", () => {
    const events = eventsFor("S03_INCIDENT_ZERO");
    expect(events.some((event) => event.kind === "GROUP_ROLL")).toBe(true);
    expect(events.some((event) => event.kind === "EACH_CHOOSE")).toBe(true);
    expect(events.some((event) => event.kind === "VOTE")).toBe(true);
    for (const event of events) {
      expect(EN_EVENTS03[event.id]).toBeDefined();
      expect(ZH_EVENTS03[event.id]).toBeDefined();
      expect(format("zh-CN", ref.event(event.id))).toMatch(HAN);
      expect(format("zh-CN", ref.eventText(event.id))).toMatch(HAN);
      for (const option of event.options ?? []) expect(format("zh-CN", ref.option(event.id, option.id))).toMatch(HAN);
    }
  });
});

const CHOSEN: Partial<Record<TargetRule, string[]>> = { ANY_PLAYER: ["b"], OTHER_PLAYER: ["b"], SAME_CARRIAGE: ["b"], TWO_PLAYERS: ["b", "c"], UP_TO_THREE_PLAYERS: ["b", "c"] };

describe("Scenario 03 ability mechanisms", () => {
  it("fires every adapted skill through the shared resolver without invalid state", () => {
    const base = start();
    for (const character of ROSTER) {
      const s = structuredClone(base);
      s.players.a.characterId = character.id;
      s.players.a.skill = { usesLeft: 1, state: "READY" };
      s.players.b.skill = { usesLeft: 0, state: "BURNED" };
      s.activeIndex = s.turnOrder.indexOf("a");
      s.act = 2;
      s.phase = "ACT_2";
      s.lastSkill = { ownerId: "b", characterId: "pisces-isfj", targets: ["a"], round: s.round };
      const skill = characterSkill(character.id, "S03_INCIDENT_ZERO");
      if (skill.type !== "ACTIVE") {
        s.pendingEffect = { id: "pe", kind: skill.trigger.on === "TARGETED_ABILITY_DECLARED" ? "ABILITY" : "EFFECT", sourceId: "b", targetId: "a", targets: ["a"], label: { k: "test hit" }, effects: [{ kind: "LOSE_FATE", who: "TARGET", amount: 1 }], single: true, reduced: 0, cancelled: false, asked: ["a", "b", "c"], copyBack: [], attack: true, theft: false };
        s.currentEvent = { id: "S3_DUPLICATE_FILE", round: s.round, resolved: false, revealing: true, asked: ["a", "b", "c"], excluded: [] };
        s.roll = { id: "r", playerId: "a", purpose: "S3_SCAN_FIELD", label: { k: "test roll" }, raw: 2, modifiers: [], fateSpent: 0, final: 2, tier: "FAIL", modifiable: true, done: false };
        s.rollContext = { kind: "S3_SCAN_FIELD", carriageIndex: s.players.a.carriageIndex, asked: ["a", "b", "c"] };
      }
      expect(() => useSkill({ s, now: T0 + 10, events: [] }, "a", CHOSEN[skill.target] ?? [], { trigger: { kind: skill.trigger.on, subjectId: "a", sourceId: "b", tier: "SUCCESS", amount: 2, item: "PHASE_BATTERY" } }), character.id).not.toThrow();
      expect(s.players.a.skill.usesLeft, character.id).toBe(0);
      for (const player of Object.values(s.players)) {
        expect(player.fate, character.id).toBeGreaterThanOrEqual(0);
        expect(player.sanity, character.id).toBeGreaterThanOrEqual(0);
      }
      for (const window of s.pending) expect(window.options.some((option) => option.id === window.defaultOptionId), character.id).toBe(true);
    }
  });

  it("uses a server roll, honours once-per-cycle scan limit, and keeps help in one year and room", () => {
    let s = start([["aries", "ESTJ"], ["pisces", "ISFJ"], ["leo", "ESFP"]]);
    const actor = s.turnOrder[s.activeIndex];
    const teammate = s.turnOrder.find((id) => id !== actor)!;
    rigNextDie(s, 6);
    const fate = s.players[actor].fate;
    s = applyGameAction(s, actor, { type: "SCAN", protocol: "ARCHIVE" }, T0 + 2).state;
    expect(s.roll?.purpose).toBe("S3_SCAN_ARCHIVE");
    expect(s.roll?.done).toBe(true);
    expect(s.players[actor].fate).toBe(fate + 2);
    expect(() => applyGameAction(s, actor, { type: "SCAN", protocol: "FIELD" }, T0 + 3)).toThrow(/already run a temporal scan/);
    s = applyGameAction(s, actor, { type: "HELP", targetId: teammate }, T0 + 4).state;
    expect(s.players[teammate].helpBonus).toBe(1);
    expect(s.roundRecord.helps).toContainEqual([actor, teammate]);
    expect(() => applyGameAction(s, actor, { type: "SCAN", protocol: "BOGUS" } as never, T0 + 5)).toThrow();
  });
});
