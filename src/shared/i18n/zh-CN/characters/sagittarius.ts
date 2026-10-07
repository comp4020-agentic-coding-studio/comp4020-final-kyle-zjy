// Simplified Chinese text for the Sagittarius characters (docs/localization.md).
import type { MBTI } from "../../../characters/types.ts";
import type { CharacterText } from "../../content-types.ts";

export const SAGITTARIUS: Record<MBTI, CharacterText> = {
  INTJ: { title: "星轨猎手", skillName: "长线谋划", skillDescription: "为本轮和下一轮抽取一个目标。若达成，获得 2 点命运。" },
  INTP: { title: "宇宙制图师", skillName: "踏入未知", skillDescription: "从三个隐藏的随机事件中选择一个并揭开。" },
  ENTJ: { title: "远征领队", skillName: "全员出发", skillDescription: "选择两名玩家，与你一同进入一个额外的多人事件。" },
  ENTP: { title: "宇宙赌徒", skillName: "买大买小", skillDescription: "为你的下一次掷骰下注：若成功，额外获得 3 点命运；若失败，失去 1 点命运。" },
  INFJ: { title: "星途先知", skillName: "望得更远", skillDescription: "查看接下来三个公共事件的类型。" },
  INFP: { title: "流浪星诗人", skillName: "自由航线", skillDescription: "当一个公共事件揭晓时，你退出该事件，改为为自己额外抽取一个事件。" },
  ENFJ: { title: "征途号召者", skillName: "一起来吧", skillDescription: "当你获得奖励时，令一名你选择的玩家获得相同的奖励（至多 2 点命运，或同样的道具）。" },
  ENFP: { title: "无界冒险家", skillName: "随机跃迁", skillDescription: "为自己额外抽取一个集体掷骰事件。" },
  ISTJ: { title: "远征记录员", skillName: "打卡签到", skillDescription: "在三种不同的掷骰（调查、搜索、修复、对抗）中各成功一次后，获得 2 点命运。" },
  ISFJ: { title: "驼队军需官", skillName: "补给包", skillDescription: "给予你自己或一名队友一个随机的一次性增益。" },
  ESTJ: { title: "边疆指挥官", skillName: "新地图", skillDescription: "将当前的公共事件（若可替换）替换为另一类别的事件。" },
  ESFJ: { title: "旅行团领队", skillName: "跟团游", skillDescription: "选择至多三名玩家一同掷骰。若点数总和达到每人 4 点，他们各获得 1 点命运。" },
  ISTP: { title: "荒野脱逃者", skillName: "跳车脱身", skillDescription: "当你掷骰失败时，不承受任何惩罚。" },
  ISFP: { title: "银河摄影师", skillName: "定格瞬间", skillDescription: "每当你掷出极端的 1 或 6 时，获得 1 点命运。" },
  ESTP: { title: "蹦极狂人", skillName: "孤注一掷", skillDescription: "你的下一次掷骰效果翻倍：奖励与惩罚皆然。" },
  ESFP: { title: "宇宙观光巴士", skillName: "神秘目的地", skillDescription: "将所有玩家随机分为两组，各自进入一个不同的小型公共事件。" },
};
