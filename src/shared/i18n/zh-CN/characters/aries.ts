// Simplified Chinese text for the Aries characters (docs/localization.md).
import type { MBTI } from "../../../characters/types.ts";
import type { CharacterText } from "../../content-types.ts";

export const ARIES: Record<MBTI, CharacterText> = {
  INTJ: { title: "赤焰谋略家", skillName: "预谋冲锋", skillDescription: "看到自己的掷骰结果后，将结果向有利方向调整一档。" },
  INTP: { title: "火花拆解者", skillName: "复燃", skillDescription: "你的一次掷骰结算后，重掷一次。你必须保留第二次的结果。" },
  ENTJ: { title: "先锋元帅", skillName: "全军突击", skillDescription: "选择另一名玩家。你和对方各获得 1 点命运。" },
  ENTP: { title: "纵火诡辩家", skillName: "甩锅", skillDescription: "当一个单体负面效果指向你时，将其转给另一名随机的合法玩家。" },
  INFJ: { title: "静焰先知", skillName: "焰中预兆", skillDescription: "在下一个公共事件出现前，查看它的类型。" },
  INFP: { title: "赤心流浪者", skillName: "热血之心", skillDescription: "你第一次受到负面效果时，将其强度降低一级。" },
  ENFJ: { title: "烈焰号召者", skillName: "跟我上", skillDescription: "与另一名玩家结成羁绊。本轮中，你们任意一方获得命运时，另一方获得 1 点命运。" },
  ENFP: { title: "野火点子王", skillName: "突然冲刺", skillDescription: "立即为自己额外抽取一个小事件。" },
  ISTJ: { title: "铁律先锋", skillName: "先手纪律", skillDescription: "如果你是本轮第一个掷骰成功的乘客，额外获得 1 点命运。" },
  ISFJ: { title: "炉火守门人", skillName: "挺身挡下", skillDescription: "代替任意一名玩家承受一个负面效果，并降低其强度。" },
  ESTJ: { title: "战旗执行官", skillName: "强行推进", skillDescription: "选择一名玩家。对方立即在所在位置进行一次免费的调查掷骰。" },
  ESFJ: { title: "篝火队长", skillName: "温暖大家", skillDescription: "选择两名玩家。他们各获得 1 点命运。" },
  ISTP: { title: "熔刃独行者", skillName: "精准闪避", skillDescription: "完全抵消一个指向你的单体负面效果。" },
  ISFP: { title: "红焰自由魂", skillName: "跟着感觉走", skillDescription: "列车提供两个随机的即时恩惠，选择其中一个。" },
  ESTP: { title: "亡命疾行者", skillName: "抢跑", skillDescription: "在另一名玩家使用能力后，立即获得 1 个行动点。" },
  ESFP: { title: "派对点火人", skillName: "炒热气氛", skillDescription: "每名玩家进行一次快速掷骰。点数最高者和你各获得 1 点命运。" },
};
