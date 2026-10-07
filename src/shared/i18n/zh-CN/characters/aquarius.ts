// Simplified Chinese text for the Aquarius characters (docs/localization.md).
import type { MBTI } from "../../../characters/types.ts";
import type { CharacterText } from "../../content-types.ts";

export const AQUARIUS: Record<MBTI, CharacterText> = {
  INTJ: { title: "系统架构师", skillName: "改写规则", skillDescription: "为本轮选择一项规则变化：所有掷骰 +1、每人 +1 行动点，或命运最多可为一次掷骰加 3。" },
  INTP: { title: "量子隐士", skillName: "叠加态", skillDescription: "你的一次掷骰产生两个结果。在结算前选择以哪一个为准。" },
  ENTJ: { title: "未来独裁者", skillName: "系统更新", skillDescription: "下一轮，一项随机规则变化对所有人生效。" },
  ENTP: { title: "漏洞制造者", skillName: "抛出异常", skillDescription: "当一个公共事件揭晓时，它造成的每一项损失或崩坏度上升都减少 1。" },
  INFJ: { title: "未来观测者", skillName: "时间缓存", skillDescription: "提前看到你下一次掷骰的点数。" },
  INFP: { title: "银河异类", skillName: "非此间人", skillDescription: "你将无视下一个波及大多数玩家的负面效果。" },
  ENFJ: { title: "人类升级师", skillName: "打补丁", skillDescription: "给予一名你选择的玩家一个随机的小型正面状态。" },
  ENFP: { title: "宇宙头脑风暴者", skillName: "百无禁忌", skillDescription: "从全部 192 名角色的可复制能力池中，随机抽取一个合法能力并立即使用。" },
  ISTJ: { title: "协议管理员", skillName: "版本回滚", skillDescription: "将你的普通状态恢复为上一轮结束时的样子。" },
  ISFJ: { title: "人肉防火墙", skillName: "拒绝访问", skillDescription: "拒绝另一名玩家直接对你使用的一个普通能力。" },
  ESTJ: { title: "服务器管理员", skillName: "强制重启", skillDescription: "清除场上所有允许被清除的持续状态。" },
  ESFJ: { title: "社交操作系统", skillName: "自动组网", skillDescription: "本轮随机三名玩家结成羁绊。其中任何人获得的第一份奖励，会让其余每人获得 1 点命运。" },
  ISTP: { title: "机器中的幽灵", skillName: "下线", skillDescription: "本轮剩余时间内，其他玩家的普通效果无法影响你。" },
  ISFP: { title: "霓虹漂流者", skillName: "随机皮肤", skillDescription: "复制一名你选择的玩家拥有的一个增益，持续一轮。" },
  ESTP: { title: "系统入侵者", skillName: "骇入", skillDescription: "强制一名玩家重掷其一次常规掷骰。" },
  ESFP: { title: "赛博派对机", skillName: "服务器狂欢", skillDescription: "本轮，数名玩家未使用的主动能力被随机重新分配。下一轮归还原主。" },
};
