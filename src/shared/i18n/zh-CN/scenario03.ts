import type { S03ItemId } from "../../game/scenario03/items.ts";

export const ZH_ITEMS03: Record<S03ItemId, { name: string; text: string }> = {
  TIME_MARKER: { name: "时间标记器", text: "带编号的遗物，必须在1996年的档案区放置其来源。" },
  AUTHORITY_CARD: { name: "权限卡", text: "带编号的遗物，必须在1996年的中央大厅放置其来源。" },
  OLD_BADGE: { name: "旧徽章", text: "保存在研究区收容柜中的徽章。" },
  PHASE_BATTERY: { name: "相位电池", text: "本回合获得1点行动点。" },
  SEDATIVE03: { name: "镇静剂", text: "恢复1点理智。" },
};

export const ZH_EVENTS03: Record<string, { title: string; text: string; options?: Record<string, { label: string; detail: string }> }> = {
  S3_CLOCK_ECHO: { title: "时钟回响", text: "每一只钟都重复同一分钟。循环中似乎落出了一秒可用的时间。" },
  S3_MISSING_MINUTE: { title: "消失的一分钟", text: "值班记录少了一分钟，而这道空白跟着你们中的一人。" },
  S3_PHASE_SURGE: { title: "相位涌动", text: "研究区的探测器短暂地同时读到了两个年份。" },
  S3_DUPLICATE_FILE: { title: "重复档案", text: "同一份事故报告出现了两份签名不同的副本。", options: {
    KEEP: { label: "留下副本", detail: "获得 1 点命运，失去 1 点理智。" },
    SEAL: { label: "封存两份", detail: "避开这处矛盾。" },
  } },
  S3_ALARM_PROTOCOL: { title: "警报协议", text: "警报要求所有人在收容异常和快速重置之间做出选择。", options: {
    CONTAIN: { label: "收容异常", detail: "所有人获得 1 点命运。" },
    RESET: { label: "强制重置", detail: "坍塌降低 1 点；一名随机玩家失去 1 点理智。" },
  } },
};

export const ZH_GOALS03: Record<string, string> = {
  REPAIR: "记录一次因果干预",
  FRAGMENT: "找到一条新证据",
  HELP: "协助队友准备时间扫描",
  NEW_CARRIAGE: "进入尚未到过的房间和年份",
};
