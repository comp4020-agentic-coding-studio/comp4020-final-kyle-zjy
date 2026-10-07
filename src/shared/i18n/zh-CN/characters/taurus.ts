// Simplified Chinese text for the Taurus characters (docs/localization.md).
import type { MBTI } from "../../../characters/types.ts";
import type { CharacterText } from "../../content-types.ts";

export const TAURUS: Record<MBTI, CharacterText> = {
  INTJ: { title: "黑金庄园主", skillName: "长线投资", skillDescription: "先存下一笔：下一轮开始时，获得 2 点命运。" },
  INTP: { title: "慢火炼金师", skillName: "掂量价值", skillDescription: "查看两个随机恩惠，并拿取其中一个。" },
  ENTJ: { title: "镀金总管", skillName: "征用", skillDescription: "从两名持有命运的玩家处各拿走 1 点命运。任何人的命运都不会被拿到 0 以下。" },
  ENTP: { title: "牛市投机客", skillName: "加倍下注", skillDescription: "押注你的下一次掷骰：若成功，额外获得 2 点命运；若失败，失去 1 点命运。" },
  INFJ: { title: "古根守护者", skillName: "根系庇护", skillDescription: "你和一名选定的玩家各自对下一个负面效果免疫。" },
  INFP: { title: "天鹅绒收藏家", skillName: "舍不得放手", skillDescription: "当你的一个增益即将结束时，使其多持续一轮。" },
  ENFJ: { title: "丰收宴主人", skillName: "共享丰收", skillDescription: "当你获得奖励时，给另一名玩家 1 点命运，你自己额外获得 1 点命运。" },
  ENFP: { title: "甜点囤积者", skillName: "惊喜存货", skillDescription: "获得一个随机的一次性道具。" },
  ISTJ: { title: "石库看守", skillName: "稳健储备", skillDescription: "连续两轮未受到负面效果后，获得 2 点命运。" },
  ISFJ: { title: "暖仓守望人", skillName: "应急口粮", skillDescription: "当你的命运降到 0 时，恢复 1 点命运。" },
  ESTJ: { title: "国库监察官", skillName: "结算日", skillDescription: "选择一名玩家。对方所有已经到期的延迟奖励立即兑现。" },
  ESFJ: { title: "金桌管家", skillName: "人人有份", skillDescription: "当你获得奖励时，命运最少的玩家获得 1 点命运。" },
  ISTP: { title: "岩壁修补匠", skillName: "硬化", skillDescription: "移除你自己或同车厢一名玩家身上的一个普通负面状态。" },
  ISFP: { title: "蜜糖园丁", skillName: "慢慢生长", skillDescription: "立即获得 1 点命运，并在下一轮开始时再获得 1 点。" },
  ESTP: { title: "金币猎手", skillName: "见好就收", skillDescription: "当另一名玩家一次获得 2 点或更多命运时，你获得 1 点命运。" },
  ESFP: { title: "丰饶之王", skillName: "开仓放粮", skillDescription: "你和另外两名随机玩家各获得 1 点命运。" },
};
