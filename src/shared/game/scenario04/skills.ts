import { ROSTER } from "../../characters/roster/index.ts";
import type { CharacterId, Skill } from "../../characters/types.ts";
import { CORE_SKILLS } from "../../skills/core/index.ts";
import type { CoreSkillCategory } from "../../skills/core/types.ts";
import { skillTable } from "../../skills/resolver.ts";
import type { ScenarioSkillSet } from "../../skills/types.ts";
import { SCENARIO03_SKILLS } from "../scenario03/skill-adapters.ts";

type Mode = Extract<import("../effects.ts").Effect, { kind: "AUCTION_ABILITY" }>["mode"];
type AuctionAdapter = { mode: Mode; en: string; zh: string; target: "SELF" | "OTHER_PLAYER" };

// Every core family keeps the character's skill name and role, while its
// effect resolves through the auction's live server state.
export const AUCTION_SKILL04: Record<CoreSkillCategory, AuctionAdapter> = {
  REROLL: { mode: "LUCK", en: "Give your next auction action roll +1.", zh: "你的下一次拍卖行动掷骰 +1。", target: "SELF" },
  MODIFY_RESULT: { mode: "ROLL", en: "Give your next auction action roll +2.", zh: "你的下一次拍卖行动掷骰 +2。", target: "SELF" },
  PREVIEW_EVENT: { mode: "INTEL", en: "Learn the current lot's hidden information.", zh: "获知当前拍品的隐藏情报。", target: "SELF" },
  CONTROL_EVENT: { mode: "EXPOSE", en: "From round 7, reveal one piece of your current-lot intel to everyone.", zh: "从第 7 轮起，向所有人公开你掌握的一条当前拍品情报。", target: "SELF" },
  SHIELD: { mode: "GUARD", en: "Recover 1 Sanity and clear your next roll penalty.", zh: "恢复 1 点理智，并清除下一次掷骰惩罚。", target: "SELF" },
  REDIRECT: { mode: "CLEANSE", en: "Clear another bidder's next roll penalty.", zh: "清除另一位竞拍者的下一次掷骰惩罚。", target: "OTHER_PLAYER" },
  COPY_EFFECT: { mode: "COPY_INTEL", en: "Copy another bidder's current-lot intel, if they have any.", zh: "若另一位竞拍者掌握当前拍品情报，复制其情报。", target: "OTHER_PLAYER" },
  SWAP_STATE: { mode: "SHARE", en: "Give another bidder 1 Black Chip; gain 1 Fate.", zh: "给另一位竞拍者 1 枚黑筹码，并获得 1 点命运。", target: "OTHER_PLAYER" },
  GAIN_RESOURCE: { mode: "CHIPS", en: "Gain 2 Black Chips.", zh: "获得 2 枚黑筹码。", target: "SELF" },
  RESTORE_SKILL: { mode: "RESET", en: "Restore 1 Fate and clear your next roll penalty.", zh: "恢复 1 点命运，并清除下一次掷骰惩罚。", target: "SELF" },
  CHANGE_TURN_ORDER: { mode: "BID", en: "Gain 1 Black Chip for this auction.", zh: "在本场拍卖中获得 1 枚黑筹码。", target: "SELF" },
  REMOVE_STATUS: { mode: "DEBT", en: "Pay off 1 Debt.", zh: "偿还 1 点债务。", target: "SELF" },
  BIND: { mode: "READ", en: "Learn another bidder's exact current Black Chips.", zh: "获知另一位竞拍者当前准确的黑筹码数量。", target: "OTHER_PLAYER" },
  CHALLENGE: { mode: "WAGER", en: "Gain 1 Black Chip, which you can wager in Blackjack.", zh: "获得 1 枚黑筹码，可用作二十一点赌注。", target: "SELF" },
  RETALIATE: { mode: "DRAIN", en: "Take 1 Black Chip from another bidder who has one.", zh: "从持有黑筹码的另一位竞拍者手中拿走 1 枚。", target: "OTHER_PLAYER" },
  EMPOWER: { mode: "BOOST", en: "Gain 1 Fate and 1 Black Chip.", zh: "获得 1 点命运和 1 枚黑筹码。", target: "SELF" },
  HINDER: { mode: "SABOTAGE", en: "Give another bidder -1 on their next auction action roll.", zh: "另一位竞拍者的下一次拍卖行动掷骰 -1。", target: "OTHER_PLAYER" },
  MOVE: { mode: "AP", en: "Gain 1 action point this round.", zh: "本轮获得 1 点行动点。", target: "SELF" },
  TASK: { mode: "SANITY", en: "Recover 1 Sanity and gain 1 Black Chip.", zh: "恢复 1 点理智并获得 1 枚黑筹码。", target: "SELF" },
  RULE: { mode: "FATE", en: "Gain 2 Fate.", zh: "获得 2 点命运。", target: "SELF" },
};

const adapters = Object.fromEntries(ROSTER.map((character) => {
  const core = CORE_SKILLS[character.coreSkillId];
  const rule = AUCTION_SKILL04[core.category];
  const prior = SCENARIO03_SKILLS.adapters[character.coreSkillId];
  const requires = ({ EXPOSE: "S4_HAS_CURRENT_INTEL", COPY_INTEL: "S4_TARGET_HAS_CURRENT_INTEL", SHARE: "S4_HAS_CHIPS", DEBT: "S4_HAS_DEBT", DRAIN: "S4_TARGET_HAS_CHIPS", CLEANSE: "S4_TARGET_PENALIZED" } as Partial<Record<Mode, string>>)[rule.mode];
  return [character.coreSkillId, {
    name: prior.name,
    description: rule.en,
    vfx: prior.vfx,
    behaviour: { type: "ACTIVE" as const, trigger: { on: "OWN_TURN" as const }, target: rule.target, effects: [{ kind: "AUCTION_ABILITY" as const, mode: rule.mode }], requires },
  }];
}));

export const SCENARIO04_SKILLS: ScenarioSkillSet = { scenario: "04", adapters, vfxByCategory: SCENARIO03_SKILLS.vfxByCategory };
export const SKILLS04: Record<CharacterId, Skill> = skillTable(ROSTER, SCENARIO04_SKILLS);
