// Scenario 02's re-worded abilities in Simplified Chinese (the English is in
// src/shared/game/scenario02/skill-adapters.ts).
import type { CharacterId } from "../../characters/types.ts";

export const ZH_S02_SKILL_TEXT: Partial<Record<CharacterId, { name: string; description: string }>> = {
  "aries-istj": {
    name: "先手纪律",
    description: "如果你是本轮第一个掷骰成功的玩家，额外获得 1 点命运。"
  },
  "aries-isfp": {
    name: "跟着直觉走",
    description: "城市随机提供两个即时恩惠。选择其中一个。"
  },
  "taurus-istp": {
    name: "坚韧",
    description: "移除你自己或你所在区域一名玩家身上的一个普通负面状态。"
  },
  "leo-entj": {
    name: "照我说的做",
    description: "选择一名玩家。其向你移动一个区域。"
  },
  "capricorn-istp": {
    name: "守住防线",
    description: "锁定你当前的命运。本轮剩余时间内它不会减少。"
  },
  "pisces-entp": {
    name: "强作镇定",
    description: "获得一个护盾，抵挡下一个作用于你的负面效果。"
  }
};
