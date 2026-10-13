import { itemLotId04, LOTS04 } from "../game/scenario04/lots.ts";
import type { IntelId04, LotId04 } from "../game/scenario04/types.ts";
import type { Locale } from "./types.ts";

const ZH_LOTS: Record<LotId04, { name: string; description: string }> = {
  LOT_01: { name: "黑色骰子", description: "灯下也看不清它的六个面。" },
  LOT_02: { name: "玻璃眼", description: "它追随着圆桌上的每一只手。" },
  LOT_03: { name: "赌徒硬币", description: "在每个故事里，落地的都是同一面。" },
  LOT_04: { name: "红色契约", description: "无人握笔时，签名仍在变干。" },
  LOT_05: { name: "时间钥匙原型", description: "它对应的锁似乎早已关闭。" },
  LOT_06: { name: "无底信用券", description: "发行人的名字一直延伸到纸张之外。" },
  LOT_07: { name: "无名者档案", description: "每一页都属于一个没有名字的人。" },
  LOT_08: { name: "黑色王冠", description: "只有最后的竞买人能试戴。" },
  LOT_09: { name: "恶魔钥匙", description: "齿牙像一排小小的手。" },
  LOT_10: { name: "离席权", description: "一个座位可以离开；债务会跟随。" },
  LOT_11: { name: "沉默铃", description: "据说它响起时，没有人能够提高自己的声音。" },
  LOT_12: { name: "半张船票", description: "目的地已经被撕掉，只剩下一个座位号码。" },
  LOT_13: { name: "空白支票", description: "签名是真的，金额却从未填写。" },
  LOT_14: { name: "红线剪刀", description: "剪断的究竟是线，还是承诺？" },
  LOT_15: { name: "第三只手套", description: "拍卖师从不承认这只手套属于任何人。" },
  LOT_16: { name: "双面镜", description: "镜中人和你做出了不同的选择。" },
  LOT_17: { name: "坏掉的秒表", description: "它每次都停在竞价结束前一秒。" },
  LOT_18: { name: "无主号码牌", description: "号码存在，但座位上从来没有人。" },
  LOT_19: { name: "赦免印章", description: "有人曾用它取消了一笔不该存在的债。" },
  LOT_20: { name: "逆位塔罗牌", description: "牌面朝下时，命运似乎更诚实。" },
  LOT_21: { name: "第二份遗嘱", description: "两份遗嘱都是真的，只是受益人不同。" },
  LOT_22: { name: "黑色请柬", description: "上面写着另一个人的名字。" },
  LOT_23: { name: "玻璃骰盅", description: "你看不见骰子，但有人坚持说它是透明的。" },
  LOT_24: { name: "保险箱残钥", description: "它打不开门，却能判断哪把钥匙是真的。" },
  LOT_25: { name: "夜班账本", description: "每一笔债都有人签过字，只是签名不是自己的。" },
  LOT_26: { name: "空心金币", description: "重量正确，声音却不对。" },
  LOT_27: { name: "烧焦的扑克牌", description: "牌角只剩下一小块黑桃。" },
  LOT_28: { name: "失效的会员卡", description: "过期日期是明天。" },
  LOT_29: { name: "陌生人的欠条", description: "欠款人一栏已经被撕掉。" },
  LOT_30: { name: "最后一根火柴", description: "盒子里只有一根，而且已经被划过一次。" },
};

const EN_EFFECTS: Record<LotId04, string> = {
  LOT_01: "Use: your next Investigate, Read, or Sabotage resolves as Perfect.", LOT_02: "Use: privately see every other bidder's current Black Chips.",
  LOT_03: "Use before Blackjack: adjust one starting card by one, within 1–10.", LOT_04: "Use: begin three full rounds with 2 AP, starting next round.",
  LOT_05: "Use: copy any lot actually offered before this key, including its authenticity.", LOT_06: "Use: clear all current Debt.",
  LOT_07: "Use: hold Sanity at 3/3 for the rest of the run.", LOT_08: "Use: add 2 to your effective Final Bid, paying only the submitted amount.",
  LOT_09: "Use: turn current Sanity into equal Black Chips, then become Lost.", LOT_10: "Final lot: its winner alone may leave.",
  LOT_11: "Use in bidding: after your next raise, each other active bidder cannot raise on their next turn in this lot.",
  LOT_12: "Use in Final Settlement: +2 effective Final Bid, or +3 while holding another unused genuine lot.",
  LOT_13: "Use before settlement: the next ordinary lot you win costs one fewer Black Chip and gives +2 Debt.",
  LOT_14: "Use while a deal involving you awaits acceptance: cancel it without settlement.",
  LOT_15: "Use on a lot won by someone else: privately gain its basic investigation hint, without its authenticity.",
  LOT_16: "Use before Investigate: failure still gives basic intel; success gains the advanced tier.",
  LOT_17: "Use after Pass while this lot remains open: immediately place a legal higher bid to rejoin.",
  LOT_18: "Use on another bidder: privately learn their current Black Chips band (0–3, 4–6, or 7+).",
  LOT_19: "Use while in Debt: remove up to two Debt.", LOT_20: "Use after rolling your own ordinary d6: reverse its raw face and reapply modifiers.",
  LOT_21: "Name another player. If they leave and you do not, your personal ending names a second beneficiary; they alone hold Exit Rights.",
  LOT_22: "Use: open one legal deal during another bidder's turn; acceptance is still required.",
  LOT_23: "Use before Blackjack: privately glimpse the rank of one of the next two real deck cards, without its position.",
  LOT_24: "Use on your own unverified item: privately learn whether it is anomalous.",
  LOT_25: "Passive while held: legal Borrow gives one extra chip and one extra Debt.",
  LOT_26: "Use while leading: add one to your current effective bid and binding payment.",
  LOT_27: "Use after your Blackjack Hit busts: burn that card and accept one replacement.",
  LOT_28: "Use at zero AP: your next otherwise legal AP action costs zero; no more AP actions this round.",
  LOT_29: "Trade only: a voluntary recipient gains two Debt; the sender loses one Debt, minimum zero.",
  LOT_30: "Use in Final Settlement: burn another unused genuine item (forfeit its +2 conversion) for +3 effective Final Bid.",
};

const ZH_EFFECTS: Record<LotId04, string> = {
  LOT_01: "使用：下一次调查、观察或干扰直接获得完美结果。", LOT_02: "使用：私下查看其他所有竞拍者当前的准确黑筹码。",
  LOT_03: "使用：下一次二十一点可将一张起手牌点数增减 1，范围 1–10。", LOT_04: "使用：从下一轮起连续三个完整轮次以 2 AP 开局。",
  LOT_05: "使用：复制此前实际登场过的任一拍品，并继承真伪。", LOT_06: "使用：清除当前全部债务。",
  LOT_07: "使用：本局理智永久保持 3/3。", LOT_08: "使用：最终等效出价 +2，只支付实际提交的出价。",
  LOT_09: "使用：把当前理智转为等量黑筹码，随后陷入迷失。", LOT_10: "最终拍品：只有赢家能够离开。",
  LOT_11: "竞拍中使用：下一次自己加价后，其他活跃玩家各失去一次本拍品加价机会。",
  LOT_12: "最终清算时使用：等效最终出价 +2；若另持未使用真品，则 +3。",
  LOT_13: "成交前使用：下一次普通拍品中标少付一筹码，债务 +2。",
  LOT_14: "自己参与的交易待确认时使用：取消交易，不进行结算。",
  LOT_15: "选择他人获得的拍品：私下获得其基础调查暗示，不知真伪。",
  LOT_16: "调查前使用：失败仍有基础信息，成功提高一个信息等级。",
  LOT_17: "本拍品 Pass 后且拍卖未结束时使用：立即合法加价并重新加入。",
  LOT_18: "选择另一人：私下得知当前黑筹码区间 0–3、4–6 或 7+。",
  LOT_19: "有债务时使用：最多减少两点债务。", LOT_20: "自身普通 d6 掷出后使用：反转原始骰面，再照常计算修正。",
  LOT_21: "指定另一人为受益人。如果其离开而你未离开，你的个人结局会记载第二受益人；离场权仍只属于对方。",
  LOT_22: "使用：可在别人回合发起一次合法交易；仍需对方接受。",
  LOT_23: "二十一点前使用：私下窥见真实牌堆接下来两张之一的牌值，不知位置。",
  LOT_24: "选择自己持有且未确认真伪的拍品：私下得知是否异常。",
  LOT_25: "持有期间被动生效：合法借贷额外 +1 筹码、+1 债务。",
  LOT_26: "自己领跑时使用：当前等效报价和中标实付均 +1。",
  LOT_27: "自己二十一点 HIT 爆牌后使用：烧掉刚抽的牌，必须接受一张补牌。",
  LOT_28: "零 AP 时使用：下一次其他条件合法的 AP 行动免费；本轮不得再进行 AP 行动。",
  LOT_29: "只能交易：自愿接收者债务 +2，原持有人债务 -1，最低为零。",
  LOT_30: "最终清算时使用：烧毁另一件未使用真品（失去其 +2 兑换），等效最终出价 +3。",
};

const EN_FAKE: Record<LotId04, string> = {
  ...Object.fromEntries(LOTS04.map((lot) => [lot.id, "The mechanism falls silent. Nothing happens; you know this lot is counterfeit."])),
  LOT_11: "The bell makes no sound.", LOT_12: "The seat number crumbles from the ticket.", LOT_13: "The bank does not exist.",
  LOT_14: "The blades meet, but no thread parts.", LOT_15: "The glove holds no trace.", LOT_16: "The reflection goes dark.",
  LOT_17: "The second hand moves; the auction does not wait.", LOT_18: "The number points to no account.", LOT_19: "The stamp leaves no mark.",
  LOT_20: "The reversed card reveals a blank face.", LOT_21: "The second signature fades.", LOT_22: "The invitation names nobody.",
  LOT_23: "The cup shows no card.", LOT_24: "The fragment will not enter the lock.", LOT_25: "The ledger adds no extra line.",
  LOT_26: "The coin rings hollow but raises nothing.", LOT_27: "The burned edge will not catch flame.", LOT_28: "The reader rejects the expired card.",
  LOT_29: "The debtors' ink disappears.", LOT_30: "The match will not light.",
};
const ZH_FAKE: Record<LotId04, string> = {
  ...Object.fromEntries(LOTS04.map((lot) => [lot.id, "机关沉默了。什么也没有发生；你现在确定这件拍品是赝品。"])),
  LOT_11: "铃没有发出声音。", LOT_12: "座位号码从船票上碎落。", LOT_13: "银行根本不存在。",
  LOT_14: "剪刀合拢，线却没有断。", LOT_15: "手套没有留下任何痕迹。", LOT_16: "镜中倒影暗了下去。",
  LOT_17: "秒针动了，拍卖却没有等它。", LOT_18: "号码对应不到任何账户。", LOT_19: "印章没有留下痕迹。",
  LOT_20: "翻转的牌面一片空白。", LOT_21: "第二个签名消失了。", LOT_22: "请柬上没有任何名字。",
  LOT_23: "骰盅里看不到牌。", LOT_24: "残钥甚至插不进锁孔。", LOT_25: "账本没有多出一行。",
  LOT_26: "金币空响，报价没有增加。", LOT_27: "烧焦的牌边再也点不着。", LOT_28: "读卡器拒绝了过期会员卡。",
  LOT_29: "欠款人的墨迹消失了。", LOT_30: "火柴没有点燃。",
};

export function auctionLotEffectText(locale: Locale, id: LotId04): string {
  return (locale === "zh-CN" ? ZH_EFFECTS : EN_EFFECTS)[itemLotId04(id)] ?? "";
}

export function auctionFakeUseText(locale: Locale, id: LotId04): string {
  return (locale === "zh-CN" ? ZH_FAKE : EN_FAKE)[itemLotId04(id)] ?? "";
}

const EN_INTEL: Record<IntelId04, string> = {
  LOT_01_LIMIT: "The die makes the next auction roll Perfect.", LOT_01_PERFECT: "The die works only once.",
  LOT_02_READ: "The eye takes a private snapshot of every other bidder's chips.", LOT_02_PERFECT: "It cannot reveal another player's future choice.",
  LOT_03_WAGER: "The coin adjusts one starting card by one point, not the wager.", LOT_03_PERFECT: "A push still returns both stakes.",
  LOT_04_DEAL: "The contract starts on the next round and lasts three full rounds.", LOT_04_PERFECT: "It raises starting AP to two while active.",
  LOT_05_ANOMALY: "The key can reproduce one of the four earlier lots.", LOT_05_PERFECT: "The copy retains the source lot's authenticity.",
  LOT_06_DEBT: "The credit clears existing Debt when used.", LOT_06_PERFECT: "It is consumed after one use.",
  LOT_07_CONNECTION: "The file promises permanent protection for Sanity.", LOT_07_PERFECT: "An authentic file prevents every loss of Sanity after activation.",
  LOT_08_LIMIT: "The crown adds two to one final bid's effective value.", LOT_08_PERFECT: "Only the real bid is paid.",
  LOT_09_RECORD: "The key consumes all current Sanity for equal Black Chips.", LOT_09_SUBJECTS: "Its user becomes Lost at zero Sanity.",
  LOT_10_COST: "Debt is still due after Exit Rights are won.", LOT_10_PERFECT: "Winning may not be the best ending.",
  LOT_11_HINT: "The bell interrupts the next replies to a raised bid.", LOT_11_PERFECT: "After the bearer raises, each rival loses one chance to raise in this lot.",
  LOT_12_HINT: "A missing half may matter beside another authentic lot.", LOT_12_PERFECT: "Activated before final bidding, it adds two effective bid; another unused genuine item adds one more.",
  LOT_13_HINT: "The account book replaces part of a winning payment with debt.", LOT_13_PERFECT: "Arm it before a lot settles: pay one chip less and gain two Debt.",
  LOT_14_HINT: "These blades can interrupt a deal before acceptance.", LOT_14_PERFECT: "The holder can cancel a pending deal involving them.",
  LOT_15_HINT: "The glove knows why a previously sold lot was wanted.", LOT_15_PERFECT: "Choose a rival's acquired lot to receive its basic investigation hint, without authenticity.",
  LOT_16_HINT: "A failed investigation may still leave a reflection.", LOT_16_PERFECT: "The next investigation gains at least basic intel; success also gains perfect intel.",
  LOT_17_HINT: "Passing need not be the end of a bid.", LOT_17_PERFECT: "Use after passing while this lot is open, and immediately place a legal higher bid.",
  LOT_18_HINT: "It classifies another bidder's purse without counting it exactly.", LOT_18_PERFECT: "Choose a rival to learn whether their chips are 0–3, 4–6, or 7+.",
  LOT_19_HINT: "The seal alters an existing debt.", LOT_19_PERFECT: "Use once to remove up to two Debt; unusable at zero Debt.",
  LOT_20_HINT: "The card turns a die to its opposite face.", LOT_20_PERFECT: "It reverses one own ordinary d6 raw face, then reapplies ordinary modifiers.",
  LOT_21_HINT: "A beneficiary may be named, but cannot inherit Exit Rights.", LOT_21_PERFECT: "If that beneficiary exits without you, your personal recap notes a second beneficiary.",
  LOT_22_HINT: "The invitation opens a narrow trading opportunity.", LOT_22_PERFECT: "It permits one legal deal while another bidder has the turn.",
  LOT_23_HINT: "A card ahead in the real deck can be glimpsed without its place.", LOT_23_PERFECT: "Before an accepted Blackjack hand, learn the rank of one of the next two cards, not which position.",
  LOT_24_HINT: "The fragment reacts only to something already in your bag.", LOT_24_PERFECT: "Choose your own unverified item to learn whether it has an anomaly.",
  LOT_25_HINT: "The book rewards borrowing and writes an equal extra obligation.", LOT_25_PERFECT: "While held, each legal Borrow gains one extra chip and one extra Debt.",
  LOT_26_HINT: "A bid can sound higher than its binding number.", LOT_26_PERFECT: "The holder can add one to a current effective bid, then owes one more chip if they win.",
  LOT_27_HINT: "One just-drawn card can be discarded before a bust settles.", LOT_27_PERFECT: "Replace one bust-causing Hit card with the next card; the replacement must stand.",
  LOT_28_HINT: "The card excuses one action point at an exhausted moment.", LOT_28_PERFECT: "One normal AP action may be made at zero AP, provided all its other conditions hold.",
  LOT_29_HINT: "Accepting the note transfers more than paper.", LOT_29_PERFECT: "An accepted transfer gives its recipient two Debt and removes one from its sender.",
  LOT_30_HINT: "A final bid can be raised by destroying another true item.", LOT_30_PERFECT: "Burn one other unused authentic lot before locking the final bid: lose its +2 conversion, gain +3 effective bid.",
};

const ZH_INTEL: Record<IntelId04, string> = {
  LOT_01_LIMIT: "骰子令下一次拍卖行动判定直接完美。", LOT_01_PERFECT: "骰子只能使用一次。",
  LOT_02_READ: "玻璃眼私下记录其他所有竞拍者当前的筹码。", LOT_02_PERFECT: "它无法揭露其他玩家未来的选择。",
  LOT_03_WAGER: "硬币将一张起手牌点数调整 1，不改变赌注。", LOT_03_PERFECT: "平局时双方仍取回赌注。",
  LOT_04_DEAL: "契约从下一轮开始，持续三个完整轮次。", LOT_04_PERFECT: "生效期间每轮初始 AP 为 2。",
  LOT_05_ANOMALY: "钥匙可以复制前四件拍品中的一件。", LOT_05_PERFECT: "复制品保留原拍品的真伪。",
  LOT_06_DEBT: "信用券使用时清除现有债务。", LOT_06_PERFECT: "使用一次后即耗尽。",
  LOT_07_CONNECTION: "档案承诺永久保护理智。", LOT_07_PERFECT: "真正的档案在激活后可阻止任何理智损失。",
  LOT_08_LIMIT: "王冠令最终出价的等效值增加 2。", LOT_08_PERFECT: "只支付实际出价。",
  LOT_09_RECORD: "钥匙消耗全部当前理智，换取等量黑筹码。", LOT_09_SUBJECTS: "理智归零后使用者陷入迷失。",
  LOT_10_COST: "赢得离席权后债务仍需偿付。", LOT_10_PERFECT: "获胜未必是最好的结局。",
  LOT_11_HINT: "铃声会打断下一次加价后的回应。", LOT_11_PERFECT: "持有者加价后，其他竞买人在本拍品中各失去一次加价机会。",
  LOT_12_HINT: "如果还有一件真正的拍品，另一半船票可能更值钱。", LOT_12_PERFECT: "最终竞价前激活，等效出价 +2；若另有未使用真品，再 +1。",
  LOT_13_HINT: "账本会把部分中标付款改记成债务。", LOT_13_PERFECT: "成交前激活，下一次中标少付一筹码，债务 +2。",
  LOT_14_HINT: "剪刀可以在交易接受前切断它。", LOT_14_PERFECT: "持有者可取消自己参与的待确认交易。",
  LOT_15_HINT: "手套知道已售拍品为何被看中。", LOT_15_PERFECT: "选择他人所得拍品，获得其基础调查暗示，但不知真伪。",
  LOT_16_HINT: "即使调查失败，镜中仍可能留下影子。", LOT_16_PERFECT: "下一次调查至少得到基础信息；成功时还会获得完美信息。",
  LOT_17_HINT: "出局并不意味着不能再次竞价。", LOT_17_PERFECT: "本拍品仍开放时，Pass 后使用并立即合法加价，可重新加入。",
  LOT_18_HINT: "号码牌只把他人的钱袋划为区间。", LOT_18_PERFECT: "选择一人，私下得知其筹码为 0–3、4–6 或 7+。",
  LOT_19_HINT: "印章改变已经存在的负债。", LOT_19_PERFECT: "使用后最多消除两点债务；债务为零不可使用。",
  LOT_20_HINT: "塔罗牌会把骰子翻到相对的一面。", LOT_20_PERFECT: "将一次自身普通 d6 的原始骰点反转，再照常应用修正。",
  LOT_21_HINT: "可以指定受益人，但不能继承离席权。", LOT_21_PERFECT: "若指定者离席而你没有离席，你的个人结局会记录第二受益人。",
  LOT_22_HINT: "请柬能在有限时机打开交易机会。", LOT_22_PERFECT: "别人的回合中可发起一次仍须合法并被接受的交易。",
  LOT_23_HINT: "可以窥见真实牌堆接下来两张牌之一的牌值，却不知道位置。", LOT_23_PERFECT: "已接受的二十一点开始前，可私下获知接下来两张牌之一的点数。",
  LOT_24_HINT: "残钥只对自己已经持有的物品有反应。", LOT_24_PERFECT: "选择自己尚未确认真伪的物品，得知是否存在异常。",
  LOT_25_HINT: "账本使借款多一枚筹码，也多一笔义务。", LOT_25_PERFECT: "持有期间，每次合法借贷额外得到一筹码和一点债务。",
  LOT_26_HINT: "报价听起来比实付数更高。", LOT_26_PERFECT: "当前有效报价可增加一点；若胜出，还需额外支付一筹码。",
  LOT_27_HINT: "爆牌结算前，可以弃掉刚抽到的一张牌。", LOT_27_PERFECT: "将一次造成爆牌的 HIT 牌换为下一张牌；必须接受新牌。",
  LOT_28_HINT: "精疲力尽时，这张卡可以免去一次行动点消耗。", LOT_28_PERFECT: "零 AP 时仍可进行一次普通 AP 行动，但其他合法条件照常适用。",
  LOT_29_HINT: "接受欠条，转移的不只是纸张。", LOT_29_PERFECT: "接受此物的交易完成后，接收者债务 +2，原持有者债务 -1。",
  LOT_30_HINT: "焚毁另一件真品可以抬高最终竞价。", LOT_30_PERFECT: "锁定最终出价前牺牲另一件未使用真品：失去其 +2 转换，等效出价 +3。",
};

export function auctionLotText(locale: Locale, id: LotId04): { name: string; description: string } {
  const base = itemLotId04(id);
  const lot = LOTS04.find((entry) => entry.id === base);
  if (!lot) return { name: id, description: "" };
  const words = locale === "zh-CN" ? ZH_LOTS[base] : { name: lot.name, description: lot.publicDescription };
  return id === base || id.startsWith("LOT_DEV_") ? words : { ...words, name: locale === "zh-CN" ? `复制品：${words.name}` : `Copy of ${words.name}` };
}

export function auctionIntelText(locale: Locale, id: IntelId04): string {
  const authenticity = id.match(/^(LOT_\d{2})_(COUNTERFEIT|AUTHENTIC)$/);
  if (authenticity) {
    const name = auctionLotText(locale, authenticity[1] as LotId04).name;
    return locale === "zh-CN"
      ? `${name}经确认是${authenticity[2] === "COUNTERFEIT" ? "赝品，没有真实效果" : "真品，效果有效"}。`
      : `${name} is confirmed ${authenticity[2] === "COUNTERFEIT" ? "counterfeit and has no effect" : "authentic and functional"}.`;
  }
  return (locale === "zh-CN" ? ZH_INTEL : EN_INTEL)[id] ?? id;
}
