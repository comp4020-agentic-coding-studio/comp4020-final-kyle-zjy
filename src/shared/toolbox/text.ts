// This standalone toolbox intentionally has a Chinese-only interface.
export const T = {
  title: "桌游工具箱", chips: "筹码台", dice: "五骰", room: "房间", back: "返回大厅",
  intro: "实体牌在线下，筹码在这里。房主可随时切换工具。", join: "加入工具箱", nickname: "你的称呼",
  connecting: "正在连接房间…", network: "连接失败，请稍后重试。", auth: "请先加入这个房间。",
  invalid: "操作无效，请刷新后重试。", stale: "桌面已更新，请确认最新状态后再操作。", host: "只有房主可以进行这项操作。",
  switchConfirm: "切换工具？当前筹码进度和私人骰子记录都会保留。", hostHint: "工具由房主切换，当前进度会保留。",
  config: "开桌设置", buyIn: "每人初始筹码", small: "小盲", big: "大盲", dealer: "庄家", players: "参与者（按座位顺序）",
  reset: "重置筹码台", resetConfirm: "重新开桌会清除当前手牌和全部筹码进度，确认继续？", save: "确认开桌", start: "开始下一手", next: "已发实体牌，进入下一轮",
  fold: "弃牌", check: "过牌", call: "跟注", raise: "下注 / 加注", allIn: "全下", to: "本轮下注总额", confirm: "确认", cancel: "取消",
  waiting: "等待房主开局", between: "本轮下注结束，等待实体牌", settlement: "请房主按实体牌分配底池", thinking: "正在行动", folded: "已弃牌", allInState: "已全下",
  stack: "剩余", bet: "本轮", total: "本手投入", pot: "底池", mainPot: "主池", sidePot: "边池", award: "确认分配", winners: "选择赢家（可多选平分）", paid: "已分配",
  price: "当前下注", owe: "需要跟注", minRaise: "最低加注至", hand: "手牌", hostTag: "房主", me: "你", logs: "本手动态", noCards: "不发牌、不判断牌型；摊牌由房主根据实体牌确认。",
  roll: "摇五个骰子", rolling: "摇骰中…", private: "只有你能看见自己的骰子，其他人及房主都看不到。", noRoll: "点击按钮，摇出你的第一组骰子。", history: "最近的私人记录", sum: "合计", diceLabel: "骰子",
  badConfig: "请选择至少两人，大小盲及初始筹码需为合理的正整数。", turn: "还没轮到你。", stage: "当前阶段无法进行这项操作。", insufficient: "筹码不足。", checkError: "尚未跟齐下注，不能过牌。", raiseError: "加注金额不合法，或本轮加注权尚未重新开放。", potError: "请选择该底池中至少一位有效赢家。",
  streets: { preflop: "翻牌前", flop: "翻牌", turn: "转牌", river: "河牌" },
} as const;
