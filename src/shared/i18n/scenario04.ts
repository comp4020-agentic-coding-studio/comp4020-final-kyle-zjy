import { LOTS04 } from "../game/scenario04/lots.ts";
import type { IntelId04, LotId04 } from "../game/scenario04/types.ts";
import type { Locale } from "./types.ts";

const ZH_LOTS: Record<LotId04, { name: string; description: string }> = {
  LOT_01: { name: "黑色骰子", description: "下一次调查、观察或干扰直接获得完美结果；仅生效一次。" },
  LOT_02: { name: "玻璃眼", description: "使用一次，私下查看所有其他玩家当前的准确黑筹码。" },
  LOT_03: { name: "赌徒硬币", description: "参与二十一点时，可将一张起手牌点数增减 1，范围为 1–10；仅一次。" },
  LOT_04: { name: "红色契约", description: "接下来三个完整轮次，每轮初始 AP 从 1 提升为 2。" },
  LOT_05: { name: "时间钥匙原型", description: "据说能开启不可能发生的瞬间。" },
  LOT_06: { name: "无底信用券", description: "使用一次，将当前债务全部清零。" },
  LOT_07: { name: "无名者档案", description: "拍卖师提供的一份密封档案。" },
  LOT_08: { name: "黑色王冠", description: "最终拍卖时，实际出价的等效值 +2；获胜只支付实际出价。" },
  LOT_09: { name: "恶魔钥匙", description: "使用一次，将当前全部理智转化为等量黑筹码，随后陷入迷失。" },
  LOT_10: { name: "离席权", description: "一个座位可以离开；债务会跟随。" },
};

const EN_INTEL: Record<IntelId04, string> = {
  LOT_01_LIMIT: "The die makes the next auction roll Perfect.", LOT_01_PERFECT: "The die works only once.",
  LOT_02_READ: "The eye takes a private snapshot of every other bidder's chips.", LOT_02_PERFECT: "It cannot reveal another player's future choice.",
  LOT_03_WAGER: "The coin adjusts one starting card by one point, not the wager.", LOT_03_PERFECT: "A push still returns both stakes.",
  LOT_04_DEAL: "The contract starts on the next round and lasts three full rounds.", LOT_04_PERFECT: "It raises starting AP to two while active.",
  LOT_05_ANOMALY: "The mechanism has no working core.", LOT_05_COUNTERFEIT: "COUNTERFEIT: this lot has no real effect.",
  LOT_06_DEBT: "The credit clears existing Debt when used.", LOT_06_PERFECT: "It is consumed after one use.",
  LOT_07_CONNECTION: "There is no real subject inside the file.", LOT_07_PERFECT: "COUNTERFEIT: this lot has no real effect.",
  LOT_08_LIMIT: "The crown adds two to one final bid's effective value.", LOT_08_PERFECT: "Only the real bid is paid.",
  LOT_09_RECORD: "The key consumes all current Sanity for equal Black Chips.", LOT_09_SUBJECTS: "Its user becomes Lost at zero Sanity.",
  LOT_10_COST: "Debt is still due after Exit Rights are won.", LOT_10_PERFECT: "Winning may not be the best ending.",
};

const ZH_INTEL: Record<IntelId04, string> = {
  LOT_01_LIMIT: "骰子令下一次拍卖行动判定直接完美。", LOT_01_PERFECT: "骰子只能使用一次。",
  LOT_02_READ: "玻璃眼私下记录其他所有竞拍者当前的筹码。", LOT_02_PERFECT: "它无法揭露其他玩家未来的选择。",
  LOT_03_WAGER: "硬币将一张起手牌点数调整 1，不改变赌注。", LOT_03_PERFECT: "平局时双方仍取回赌注。",
  LOT_04_DEAL: "契约从下一轮开始，持续三个完整轮次。", LOT_04_PERFECT: "生效期间每轮初始 AP 为 2。",
  LOT_05_ANOMALY: "装置没有可运作的核心。", LOT_05_COUNTERFEIT: "赝品：这件拍品没有真实效果。",
  LOT_06_DEBT: "信用券使用时清除现有债务。", LOT_06_PERFECT: "使用一次后即耗尽。",
  LOT_07_CONNECTION: "档案里没有真正的对象。", LOT_07_PERFECT: "赝品：这件拍品没有真实效果。",
  LOT_08_LIMIT: "王冠令最终出价的等效值增加 2。", LOT_08_PERFECT: "只支付实际出价。",
  LOT_09_RECORD: "钥匙消耗全部当前理智，换取等量黑筹码。", LOT_09_SUBJECTS: "理智归零后使用者陷入迷失。",
  LOT_10_COST: "赢得离席权后债务仍需偿付。", LOT_10_PERFECT: "获胜未必是最好的结局。",
};

export function auctionLotText(locale: Locale, id: LotId04): { name: string; description: string } {
  const lot = LOTS04.find((entry) => entry.id === id);
  if (!lot) return { name: id, description: "" };
  return locale === "zh-CN" ? ZH_LOTS[id] : { name: lot.name, description: lot.publicDescription };
}

export const auctionIntelText = (locale: Locale, id: IntelId04): string => (locale === "zh-CN" ? ZH_INTEL : EN_INTEL)[id] ?? id;
