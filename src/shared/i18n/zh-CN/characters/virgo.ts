// Simplified Chinese text for the Virgo characters (docs/localization.md).
import type { MBTI } from "../../../characters/types.ts";
import type { CharacterText } from "../../content-types.ts";

export const VIRGO: Record<MBTI, CharacterText> = {
  INTJ: { title: "谬误擦除者", skillName: "校准", skillDescription: "你的一次掷骰结算后，将其结果提升一档。" },
  INTP: { title: "漏洞显微镜", skillName: "除错", skillDescription: "当公共事件揭示时，在其生效前将其取消。" },
  ENTJ: { title: "流程总监", skillName: "标准化", skillDescription: "当一名玩家掷骰失败时，令其重做一次同类掷骰。" },
  ENTP: { title: "规则讼棍", skillName: "钻空子", skillDescription: "当其他玩家对某人宣告能力时，该能力必须改为指向另一个合法目标。" },
  INFJ: { title: "秩序神谕", skillName: "预先审阅", skillDescription: "查看接下来的两个公共事件，并决定它们出现的顺序。" },
  INFP: { title: "细节收藏家", skillName: "小确幸", skillDescription: "当你连续两次掷骰都是普通成功时，获得 1 点命运。" },
  ENFJ: { title: "完美导师", skillName: "纠正姿势", skillDescription: "当一名玩家掷骰失败时，将该失败改为一次普通成功。" },
  ENFP: { title: "灵感修补匠", skillName: "差不多得了", skillDescription: "当你掷骰失败时，重掷一次，并保留两次中较好的结果。" },
  ISTJ: { title: "终审稽核员", skillName: "复核", skillDescription: "选择一名玩家，所有将在之后某轮才到来的东西（暂存的收益、预备的护盾）立即到账。" },
  ISFJ: { title: "后勤校对员", skillName: "备选方案", skillDescription: "当一名玩家的能力合法地完全未产生效果时，返还其该次使用次数。" },
  ESTJ: { title: "纪律督察", skillName: "罚单", skillDescription: "选择一名本轮已用能力伤害其他玩家两次的玩家，其失去 1 点命运。" },
  ESFJ: { title: "班主任", skillName: "补作业", skillDescription: "命运最少的玩家进行一次额外的快速掷骰，成功则获得 1 点命运。" },
  ISTP: { title: "精密拆弹专家", skillName: "拆除", skillDescription: "移除任意一名玩家身上的一个普通持续性负面状态。" },
  ISFP: { title: "细节美学家", skillName: "微调", skillDescription: "当你的一次掷骰出现极端结果时，将其向中间移动一档。" },
  ESTP: { title: "压力测试员", skillName: "再来一次", skillDescription: "当一名玩家成功时，令其再掷一次。若再次成功，你和其各获得 1 点命运。" },
  ESFP: { title: "完美主义演员", skillName: "重拍", skillDescription: "发起投票。若多数同意，下一个公共事件被弃掉并替换。" },
};
