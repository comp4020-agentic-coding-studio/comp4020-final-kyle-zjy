// Scenario 03's Chinese ability dress. Unchanged Core Skill wording comes
// from the complete 192-character Chinese catalog; these entries replace
// terms that refer to the train or to another scenario's action.
import type { CharacterId } from "../../characters/types.ts";

export const ZH_S03_SKILL_TEXT: Partial<Record<CharacterId, { name: string; description: string }>> = {
  "aries-isfp": { name: "跟着感觉走", description: "管理局提供两个随机的即时恩惠，选择其中一个。" },
  "aries-estj": { name: "强行推进", description: "选择一名玩家。对方立即在所在位置进行一次免费的时间扫描掷骰。" },
  "gemini-entj": { name: "并行任务", description: "选定的两名玩家各进行一次快速掷骰。你选择采用哪个结果；该结果按该玩家所在位置的一次时间扫描结算。" },
  "taurus-istp": { name: "坚韧", description: "移除你自己或与你处于同一房间、同一年份的一名玩家身上的一个普通负面状态。" },
  "leo-entj": { name: "照我说的做", description: "选择一名玩家。其在所在年份移动一间开放的房间；若你们处于同一年份，则向你移动。" },
  "capricorn-estj": { name: "两条路径", description: "选择两名玩家。每人立即进行一次免费的时间扫描掷骰；成功者额外获得 1 点命运。" },
  "pisces-entp": { name: "强作镇定", description: "获得一个护盾，抵挡下一个作用于你的负面效果。" },
  "sagittarius-istj": { name: "多条道路", description: "使用全部三种时间扫描协议成功后，获得 2 点命运。" },
};
