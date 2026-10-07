// Simplified Chinese text for the Leo characters (docs/localization.md).
import type { MBTI } from "../../../characters/types.ts";
import type { CharacterText } from "../../content-types.ts";

export const LEO: Record<MBTI, CharacterText> = {
  INTJ: { title: "日冕策展人", skillName: "主角登场", skillDescription: "下一个需要抉择的公共事件，由你一人决定。" },
  INTP: { title: "王座守望者", skillName: "幕后主角", skillDescription: "若本轮没有其他玩家以你为目标，轮末获得 2 点命运。" },
  ENTJ: { title: "黄金暴君", skillName: "听我号令", skillDescription: "选择一名玩家，其向你所在方向移动一节车厢。" },
  ENTP: { title: "王冠挑衅者", skillName: "放马过来", skillDescription: "挑战任意一名玩家与你同时掷骰，结果较高者获得 2 点命运。" },
  INFJ: { title: "圣焰导师", skillName: "聚光预言", skillDescription: "选择一名玩家，其下一次掷骰的奖励翻倍。" },
  INFP: { title: "孤独的小太阳", skillName: "独自闪耀", skillDescription: "当你是唯一从公共事件中获益的玩家时，额外获得 1 点命运。" },
  ENFJ: { title: "召日者", skillName: "看向我", skillDescription: "本轮中，可以以你为目标的敌对效果会优先指向你。你还获得 1 层护盾。" },
  ENFP: { title: "耀眼造势之星", skillName: "安可", skillDescription: "当你连续两轮掷骰成功后，为自己额外抽取一个奖励事件。" },
  ISTJ: { title: "王室书记官", skillName: "功绩录", skillDescription: "本局中你第三次掷骰成功时，额外获得 3 点命运。" },
  ISFJ: { title: "近卫队长", skillName: "护卫王冠", skillDescription: "抵消其他玩家所受的一个负面效果，你获得 1 点命运。" },
  ESTJ: { title: "荣耀统帅", skillName: "列队", skillDescription: "本轮所有尚未行动的玩家，按命运从少到多的顺序依次行动。" },
  ESFJ: { title: "红毯主持人", skillName: "掌声", skillDescription: "选定的一名玩家获得 1 点命运。若本轮另有玩家也协助过其，你也获得 1 点命运。" },
  ISTP: { title: "金鬃游侠", skillName: "盛大登场", skillDescription: "本局中你的第一次失败改为视为一次普通成功。" },
  ISFP: { title: "日落画家", skillName: "优雅退场", skillDescription: "当你获得奖励时，交还 1 点命运。你下一次掷骰的奖励翻倍。" },
  ESTP: { title: "竞技场明星", skillName: "决斗", skillDescription: "点名一名玩家与你进行对抗掷骰，胜者获得 2 点命运。" },
  ESFP: { title: "宇宙巨星", skillName: "万众瞩目", skillDescription: "所有玩家投票选出一名玩家，该玩家与你各获得 2 点命运。" },
};
