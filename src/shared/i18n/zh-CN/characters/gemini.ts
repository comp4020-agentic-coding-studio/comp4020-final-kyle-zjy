// Simplified Chinese text for the Gemini characters (docs/localization.md).
import type { MBTI } from "../../../characters/types.ts";
import type { CharacterText } from "../../content-types.ts";

export const GEMINI: Record<MBTI, CharacterText> = {
  INTJ: { title: "双面棋手", skillName: "身份互换", skillDescription: "与一名选定的玩家交换一个可交换的临时状态。" },
  INTP: { title: "内线频道主宰", skillName: "复制代码", skillDescription: "复制上一名玩家刚刚成功使用的能力效果（若该能力可被复制）。" },
  ENTJ: { title: "双线指挥官", skillName: "并行任务", skillDescription: "两名选定的玩家各进行一次快速掷骰。由你选择采用哪个结果；它将作为该玩家所在位置的一次调查来结算。" },
  ENTP: { title: "量子巧舌者", skillName: "我可没说过", skillDescription: "当所有人都已回答一次投票或抉择后，你可以在结算前更改自己的答案。" },
  INFJ: { title: "镜语占卜师", skillName: "窥探频道", skillDescription: "查看一名选定玩家的一个隐藏状态。" },
  INFP: { title: "双面梦游者", skillName: "另一条路", skillDescription: "当一个二选一事件揭晓时，由你替所有人做出决定。" },
  ENFJ: { title: "社交路由者", skillName: "重新连线", skillDescription: "交换两名合法玩家当前的羁绊。" },
  ENFP: { title: "频道跳跃者", skillName: "换个频道", skillDescription: "当一个可替换的随机事件出现时，重新生成它。" },
  ISTJ: { title: "双账簿书记", skillName: "备份存档", skillDescription: "记录你的一次成功掷骰。之后，你可以用该结果替换你的一次常规掷骰。" },
  ISFJ: { title: "秘密信使", skillName: "悄声警告", skillDescription: "选择一名玩家。对方下一次失败时，可以重掷一次。" },
  ESTJ: { title: "情报调度员", skillName: "重新排序", skillDescription: "选择至多三名玩家。下一轮他们按你选择的顺序最先行动。" },
  ESFJ: { title: "八卦中继站", skillName: "口口相传", skillDescription: "当一名玩家获得增益时，另一名合法玩家获得该增益的弱化版本。" },
  ISTP: { title: "信号劫持者", skillName: "截胡", skillDescription: "当另一名玩家获得道具作为奖励时，从对方手中夺走它。" },
  ISFP: { title: "镜中漂流者", skillName: "变成你", skillDescription: "复制一名选定玩家身上的一个可复制增益，持续一轮。" },
  ESTP: { title: "银舌调包手", skillName: "偷梁换柱", skillDescription: "当一次掷骰即将结算时，使其采用本轮任何人掷出的最佳结果。" },
  ESFP: { title: "行走的弹幕", skillName: "全频广播", skillDescription: "所有玩家同时进行一次快速秘密选择。选择属于少数方的玩家获得奖励。" },
};
