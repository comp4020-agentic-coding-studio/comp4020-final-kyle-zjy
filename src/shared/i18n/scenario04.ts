import { LOTS04 } from "../game/scenario04/lots.ts";
import type { IntelId04, LotId04 } from "../game/scenario04/types.ts";
import type { Locale } from "./types.ts";

const ZH_LOTS: Record<LotId04, { name: string; description: string }> = {
  LOT_01: { name: "黑色骰子", description: "你下一次拍卖行动掷骰 +1，仅生效一次。" },
  LOT_02: { name: "玻璃眼", description: "下一次成功观察还会识别一条当前拍品情报。" },
  LOT_03: { name: "赌徒硬币", description: "首次二十一点开局时额外抽一张牌；若能改善手牌，则自动替换一张起手牌。" },
  LOT_04: { name: "红色契约", description: "一次使已接受交易中支付的筹码减少 1。" },
  LOT_05: { name: "时间钥匙原型", description: "据说能开启不可能发生的瞬间。" },
  LOT_06: { name: "无底信用券", description: "一次以较低债务代价借贷。" },
  LOT_07: { name: "无名者档案", description: "属于当前一名竞拍者。" },
  LOT_08: { name: "黑色王冠", description: "最终拍卖可比持有筹码多出价 2，获胜时少支付 2。" },
  LOT_09: { name: "拍卖记录", description: "如实记录这张桌上的出价、债务、交易与挑战。" },
  LOT_10: { name: "离席权", description: "一个座位可以离开；债务会跟随。" },
};

const EN_INTEL: Record<IntelId04, string> = {
  LOT_01_LIMIT: "The die can change one auction action roll by one.", LOT_01_PERFECT: "The die works only once.",
  LOT_02_READ: "The eye responds to reliable observation.", LOT_02_PERFECT: "It cannot reveal another player's future choice.",
  LOT_03_WAGER: "The coin changes one card, not the wager.", LOT_03_PERFECT: "A push still returns both stakes.",
  LOT_04_DEAL: "The contract applies only to a completed, enforced deal.", LOT_04_PERFECT: "No future promise can be written into it.",
  LOT_05_ANOMALY: "The mechanism has no working core.", LOT_05_COUNTERFEIT: "COUNTERFEIT: this lot has no real effect.",
  LOT_06_DEBT: "Borrowing raises the debt recorded against you.", LOT_06_PERFECT: "The credit does not erase old debt.",
  LOT_07_CONNECTION: "The file identifies someone seated at this table.", LOT_07_PERFECT: "The current bidders are the subjects.",
  LOT_08_LIMIT: "The crown grants a limited final advantage.", LOT_08_PERFECT: "It cannot guarantee Exit Rights.",
  LOT_09_RECORD: "Every entry in the record reflects a real action.", LOT_09_SUBJECTS: "FINAL LOT PREPARED. SUBJECTS: CURRENT BIDDERS.",
  LOT_10_COST: "Debt is still due after Exit Rights are won.", LOT_10_PERFECT: "Winning may not be the best ending.",
};

const ZH_INTEL: Record<IntelId04, string> = {
  LOT_01_LIMIT: "骰子可将一次拍卖行动判定调整 1 点。", LOT_01_PERFECT: "骰子只能使用一次。",
  LOT_02_READ: "玻璃眼响应可靠的观察。", LOT_02_PERFECT: "它无法揭露其他玩家未来的选择。",
  LOT_03_WAGER: "硬币改变一张牌，不改变赌注。", LOT_03_PERFECT: "平局时双方仍取回赌注。",
  LOT_04_DEAL: "契约仅对已经完成的强制交易生效。", LOT_04_PERFECT: "不能用它写入未来承诺。",
  LOT_05_ANOMALY: "装置没有可运作的核心。", LOT_05_COUNTERFEIT: "赝品：这件拍品没有真实效果。",
  LOT_06_DEBT: "借贷会增加记在你名下的债务。", LOT_06_PERFECT: "信用券不会抹去旧债。",
  LOT_07_CONNECTION: "档案指向在场的一名竞拍者。", LOT_07_PERFECT: "当前竞拍者就是调查对象。",
  LOT_08_LIMIT: "王冠提供有限的最终优势。", LOT_08_PERFECT: "它无法保证拍得离席权。",
  LOT_09_RECORD: "记录中的每条都对应真实行动。", LOT_09_SUBJECTS: "最终拍品已备妥。对象：当前竞拍者。",
  LOT_10_COST: "赢得离席权后债务仍需偿付。", LOT_10_PERFECT: "获胜未必是最好的结局。",
};

export function auctionLotText(locale: Locale, id: LotId04): { name: string; description: string } {
  const lot = LOTS04.find((entry) => entry.id === id);
  if (!lot) return { name: id, description: "" };
  return locale === "zh-CN" ? ZH_LOTS[id] : { name: lot.name, description: lot.publicDescription };
}

export const auctionIntelText = (locale: Locale, id: IntelId04): string => (locale === "zh-CN" ? ZH_INTEL : EN_INTEL)[id] ?? id;
