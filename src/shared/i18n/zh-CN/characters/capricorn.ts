// Simplified Chinese text for the Capricorn characters (docs/localization.md).
import type { MBTI } from "../../../characters/types.ts";
import type { CharacterText } from "../../content-types.ts";

export const CAPRICORN: Record<MBTI, CharacterText> = {
  INTJ: { title: "登顶规划师", skillName: "长期目标", skillDescription: "秘密抽取一个持续接下来三轮的目标。若达成，获得 3 点命运。" },
  INTP: { title: "山脊演算者", skillName: "最优路线", skillDescription: "在决定行动之前，先看到你下一次掷骰的点数。" },
  ENTJ: { title: "巅峰执行官", skillName: "绩效指标", skillDescription: "为另一名玩家设定一个目标。若其在下一轮结束前达成，你与其各获得 1 点命运。" },
  ENTP: { title: "资本攀登者", skillName: "杠杆", skillDescription: "花费 1 点命运，恢复另一名玩家已使用过的能力。" },
  INFJ: { title: "峰顶守望者", skillName: "未雨绸缪", skillDescription: "为自己放置一个一次性护盾，从下一轮起生效。" },
  INFP: { title: "雪线漫游者", skillName: "稳扎稳打", skillDescription: "若你连续两轮没有使用主动能力，获得 2 点命运。" },
  ENFJ: { title: "结绳领攀人", skillName: "拉一把", skillDescription: "当命运最少的玩家掷骰成功时，你与其各额外获得 1 点命运。" },
  ENFP: { title: "峰顶梦想家", skillName: "转行", skillDescription: "随机抽取一名其他星座角色的主动能力，并立即使用。" },
  ISTJ: { title: "时光账房", skillName: "复利", skillDescription: "连续两次成功后，你的下一次成功额外获得 1 点命运。" },
  ISFJ: { title: "大本营看守", skillName: "安全绳", skillDescription: "选择一名玩家。其下一次失败不会损失任何资源。" },
  ESTJ: { title: "项目负责人", skillName: "截止日期", skillDescription: "选择两名玩家，各自立即进行一次免费的调查掷骰；成功者额外获得 1 点命运。" },
  ESFJ: { title: "团队后勤官", skillName: "团建", skillDescription: "本轮一旦有三名不同的玩家掷骰成功，获得 1 点命运。" },
  ISTP: { title: "冰壁工程师", skillName: "固定锚点", skillDescription: "锁定你当前的命运，本轮剩余时间内不会减少。" },
  ISFP: { title: "雪雕艺人", skillName: "拿得出手", skillDescription: "当你的一个临时增益自然结束时，将其转化为 1 点命运。" },
  ESTP: { title: "巅峰挑战者", skillName: "冲顶", skillDescription: "向命运最多的玩家发起对抗掷骰。若你获胜，获得 2 点命运。" },
  ESFP: { title: "登顶庆功者", skillName: "庆功派对", skillDescription: "在本轮结束时，最后一名掷骰成功的玩家与你各获得 1 点命运。" },
};
