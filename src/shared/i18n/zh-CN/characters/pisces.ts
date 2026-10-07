// Simplified Chinese text for the Pisces characters (docs/localization.md).
import type { MBTI } from "../../../characters/types.ts";
import type { CharacterText } from "../../content-types.ts";

export const PISCES: Record<MBTI, CharacterText> = {
  INTJ: { title: "梦境导演", skillName: "梦之剧本", skillDescription: "决定你的下一个随机事件偏向奖励还是挑战。" },
  INTP: { title: "幻象分析师", skillName: "真的假的", skillDescription: "查看一个隐藏效果，并决定它是否按原文触发。" },
  ENTJ: { title: "梦海君主", skillName: "同眠", skillDescription: "选择两名玩家。他们与你一同进入同一个随机事件。" },
  ENTP: { title: "蜃楼骗术师", skillName: "伪造结果", skillDescription: "向无面检票员出示伪造的结果：无论掷出多少，你的下一次查票都能通过。" },
  INFJ: { title: "深海先知", skillName: "梦之预兆", skillDescription: "查看下一个公共事件的完整内容。" },
  INFP: { title: "观星梦游者", skillName: "再睡五分钟", skillDescription: "当你掷骰失败后，不承受任何惩罚，并在下一轮额外获得 1 点行动点。" },
  ENFJ: { title: "梦境向导", skillName: "共享梦境", skillDescription: "当一名玩家获得增益时，将其一个较弱的副本给予另一名玩家。" },
  ENFP: { title: "泡泡幻想家", skillName: "怪梦", skillDescription: "当一个事件揭晓时，随机改变它的目标、奖励或一项非核心条件。" },
  ISTJ: { title: "梦境档案员", skillName: "梦境日志", skillDescription: "你的第一次成功掷骰会被记录下来。之后，你可以用该结果代替一次掷骰，限一次。" },
  ISFJ: { title: "深海疗愈师", skillName: "安心入眠", skillDescription: "清除一名你选择的玩家身上的一个普通负面状态。" },
  ESTJ: { title: "梦境看守", skillName: "醒来", skillDescription: "终止场上所有规则变化，并清除每名玩家身上的一个普通负面状态。" },
  ESFJ: { title: "共情共鸣者", skillName: "我懂你", skillDescription: "当命运最少的玩家获得奖励时，你也获得 1 点命运。" },
  ISTP: { title: "潜意识潜行者", skillName: "下潜", skillDescription: "跳过当前事件（若可跳过），并隐匿至下一轮开始。" },
  ISFP: { title: "月海画师", skillName: "绘梦", skillDescription: "将你的一次普通成功变为完美。" },
  ESTP: { title: "梦浪冲浪者", skillName: "乘梦而行", skillDescription: "生成两个合法事件，选取潜在奖励更高的那个。你必须承担其风险。" },
  ESFP: { title: "梦境派对精灵", skillName: "全员入梦", skillDescription: "每名玩家获得一个各不相同的随机临时状态。" },
};
