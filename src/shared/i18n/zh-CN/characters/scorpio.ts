// Simplified Chinese text for the Scorpio characters (docs/localization.md).
import type { MBTI } from "../../../characters/types.ts";
import type { CharacterText } from "../../content-types.ts";

export const SCORPIO: Record<MBTI, CharacterText> = {
  INTJ: { title: "深渊傀儡师", skillName: "暗线", skillDescription: "秘密选择另一名玩家。其下一次获得奖励时，你获得 1 点命运。" },
  INTP: { title: "禁区解码者", skillName: "破译", skillDescription: "查看下一个公共事件的全部内容。" },
  ENTJ: { title: "黑曜霸主", skillName: "支配", skillDescription: "选择另一名玩家，其下一个主动能力不能以你为目标。" },
  ENTP: { title: "毒舌谋士", skillName: "反咬", skillDescription: "当其他玩家对你施加负面效果后，令该玩家进行一次风险掷骰。" },
  INFJ: { title: "冥河先知", skillName: "死亡预兆", skillDescription: "预先查看本局下一个重大惩罚公共事件。" },
  INFP: { title: "暗流守梦人", skillName: "记仇", skillDescription: "记住第一个攻击你的玩家。若你之后协助该玩家，获得 2 点命运。" },
  ENFJ: { title: "秘密祭司", skillName: "血契", skillDescription: "秘密指定一名盟友。你们首次互相协助后，各获得 2 点命运。" },
  ENFP: { title: "夜行魅惑者", skillName: "交换秘密", skillDescription: "两名随机玩家交换一个可交换的隐藏状态。" },
  ISTJ: { title: "黑匣记录仪", skillName: "记录在案", skillDescription: "当其他玩家的能力伤害你时，该效果照常生效，且同样的效果也会作用于对方。" },
  ISFJ: { title: "毒尾守护者", skillName: "荆棘守卫", skillDescription: "保护一名玩家。本轮中，第一个攻击其的玩家失去 1 点命运。" },
  ESTJ: { title: "地下审判官", skillName: "清算", skillDescription: "本局中攻击其他玩家次数最多的玩家，进行一次额外的风险掷骰。" },
  ESFJ: { title: "隐秘盛宴主人", skillName: "秘密同盟", skillDescription: "随机两对玩家秘密结成羁绊，持续 3 轮。同伴首次掷骰成功时，另一方获得 1 点命运。" },
  ISTP: { title: "影刃潜伏者", skillName: "消失", skillDescription: "本轮剩余时间内，其他玩家的主动能力不能以你为目标。" },
  ISFP: { title: "夜墨纹身师", skillName: "留下印记", skillDescription: "标记一名玩家，其下一次合法奖励额外提供 1 点命运。" },
  ESTP: { title: "黑市劫掠者", skillName: "拦截", skillDescription: "当其他玩家获得奖励时，你获得同样的奖励（至多 2 点命运，或同样的道具）。" },
  ESFP: { title: "午夜魅影", skillName: "反转派对", skillDescription: "命运最多与最少的玩家交换一个临时状态。" },
};
