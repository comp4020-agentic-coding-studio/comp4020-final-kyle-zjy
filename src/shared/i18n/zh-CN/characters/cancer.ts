// Simplified Chinese text for the Cancer characters (docs/localization.md).
import type { MBTI } from "../../../characters/types.ts";
import type { CharacterText } from "../../content-types.ts";

export const CANCER: Record<MBTI, CharacterText> = {
  INTJ: { title: "月堡规划师", skillName: "安全屋", skillDescription: "选择一名玩家。本轮中，对方不能成为其他玩家负面主动能力的目标。" },
  INTP: { title: "贝壳学者", skillName: "缩进壳里", skillDescription: "放弃本轮剩余的行动。直到本轮结束，你对负面效果免疫。" },
  ENTJ: { title: "家族舵手", skillName: "抱团", skillDescription: "当一名队友受到负面效果时，抵消该效果。你获得 1 点命运。" },
  ENTP: { title: "情绪反弹者", skillName: "你也尝尝", skillDescription: "当一名玩家给予你负面状态时，对方也会受到该状态的弱化版本。" },
  INFJ: { title: "潮汐守望者", skillName: "心情预报", skillDescription: "得知下一轮的公共事件偏向奖励、危机还是两者兼有。" },
  INFP: { title: "月湾捕梦人", skillName: "抱一抱", skillDescription: "你和命运最少的玩家各获得 1 点命运。" },
  ENFJ: { title: "月下宴主", skillName: "一家人", skillDescription: "组成一个至多三名玩家的临时小组。本轮中，每名组员获得的第一份奖励 +1。" },
  ENFP: { title: "泡泡安慰师", skillName: "打起精神", skillDescription: "清除一名随机玩家身上的一个普通负面状态。" },
  ISTJ: { title: "老宅守门人", skillName: "家规", skillDescription: "连续两轮未主动攻击其他玩家后，获得 2 点命运。" },
  ISFJ: { title: "被褥守护者", skillName: "掖好被角", skillDescription: "给予一名玩家一层护盾。" },
  ESTJ: { title: "家规执法者", skillName: "给我回家", skillDescription: "当一个会在玩家之间转移命运、道具或状态的能力被宣告时，取消它。" },
  ESFJ: { title: "餐桌之母", skillName: "一个不落", skillDescription: "命运最少的两名玩家各获得 1 点命运。" },
  ISTP: { title: "寄居蟹工匠", skillName: "换壳", skillDescription: "当一个负面效果指向你时，放弃你的一个增益来抵消它。" },
  ISFP: { title: "月光枕兽", skillName: "温柔回应", skillDescription: "当另一名玩家协助你时，你和该玩家各获得 1 点命运。" },
  ESTP: { title: "冲浪救生员", skillName: "拉你回来", skillDescription: "当另一名玩家掷骰失败时，让对方立即重掷。" },
  ESFP: { title: "海边派对王", skillName: "涨潮", skillDescription: "随机选择三名玩家。本轮中，他们各自获得的第一份奖励 +1。" },
};
