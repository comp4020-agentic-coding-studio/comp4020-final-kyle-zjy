// Simplified Chinese text for the Libra characters (docs/localization.md).
import type { MBTI } from "../../../characters/types.ts";
import type { CharacterText } from "../../content-types.ts";

export const LIBRA: Record<MBTI, CharacterText> = {
  INTJ: { title: "均衡仲裁者", skillName: "拉平", skillDescription: "选择两名玩家，将两人的命运差距缩小至多 2 点。" },
  INTP: { title: "天平计算师", skillName: "取均值", skillDescription: "你的一次掷骰后，再掷一次，取两次结果的平均值（向上取整）。" },
  ENTJ: { title: "和平代言人", skillName: "再分配", skillDescription: "从命运最多的玩家处转移 1 点命运给命运最少的玩家。" },
  ENTP: { title: "公平辩护人", skillName: "异议", skillDescription: "一次公共集体掷骰后，在其生效前所有人重掷。" },
  INFJ: { title: "银秤调停者", skillName: "和解", skillDescription: "选择两名玩家，各清除其一个普通负面状态。" },
  INFP: { title: "月白和事佬", skillName: "别打了", skillDescription: "当其他玩家的能力将要伤害你时，该能力被取消，改为你与其各获得 1 点命运。" },
  ENFJ: { title: "羁绊协调人", skillName: "重新配对", skillDescription: "交换玩家之间的两条合法羁绊。" },
  ENFP: { title: "火花红娘", skillName: "随机配对", skillDescription: "令两名随机玩家结成羁绊。本轮中，两人任一方首次成功时，另一方获得 1 点命运。" },
  ISTJ: { title: "法典评估官", skillName: "同等奖励", skillDescription: "当一名玩家获得奖励时，命运最少的玩家获得同样的奖励（至多 2 点命运，或同样的道具）。" },
  ISFJ: { title: "白羽守和人", skillName: "冷静点", skillDescription: "取消一次玩家夺取其他玩家命运的企图。" },
  ESTJ: { title: "平衡执法者", skillName: "强制平衡", skillDescription: "命运最多的玩家失去 1 点命运，命运最少的玩家获得 1 点命运。" },
  ESFJ: { title: "人际主持人", skillName: "说句好话", skillDescription: "选择两名玩家。若本轮两人都成功协助了对方，两人各获得 1 点命运。" },
  ISTP: { title: "沉默裁判", skillName: "判罚无效", skillDescription: "当一个将从玩家处夺取命运、理智或道具的能力被宣告时，将其取消。" },
  ISFP: { title: "白玫瑰旅人", skillName: "选择和平", skillDescription: "当公共事件揭示时，退出该事件并获得 1 点命运。" },
  ESTP: { title: "竞技场公证人", skillName: "公平决斗", skillDescription: "选择两名玩家同时掷骰，结果较高者获得 2 点命运；平局则各获得 1 点。" },
  ESFP: { title: "社交天平女王", skillName: "付诸表决", skillDescription: "当一个「所有人各自抉择」的事件揭示时，改为投票决定：多数人的选择适用于所有人。" },
};
