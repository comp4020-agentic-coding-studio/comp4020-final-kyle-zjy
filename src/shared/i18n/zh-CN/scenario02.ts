// Scenario 02's content in Simplified Chinese, keyed like EN_SCENARIO02
// (test/localization.test.ts checks every id is covered). Terminology:
// docs/localization.md.
import type { Scenario02Text } from "../scenario02.ts";

export const ZH_SCENARIO02: Scenario02Text = {
  scenario: {
    title: "沉没都市：最后的高地",
    tagline: "水要来了。船坐不下所有人。"
  },
  zones: {
    BROADCAST_TOWER: {
      name: "山顶广播塔",
      text: "天线仍在嗡嗡作响。有人一直在念名字。"
    },
    RESERVOIR: {
      name: "山顶水库",
      text: "满到了边沿，水面纹丝不动。"
    },
    OBSERVATORY: {
      name: "旧天文台",
      text: "星图、六分仪，还有一本记录着海岸线如何移动的日志。"
    },
    HOSPITAL: {
      name: "圣阿格尼丝医院",
      text: "发电机还撑着。病人却不都在该在的地方。"
    },
    SCHOOL: {
      name: "山坡学校",
      text: "课桌堆在门后。黑板上还留着一堂课。"
    },
    CEMETERY: {
      name: "山脊墓园",
      text: "最新的几块墓碑上还没有刻名字。"
    },
    QUARRY: {
      name: "采石场路",
      text: "柴油桶，还有一台多年没人爬上去过的起重机。"
    },
    TERRACES: {
      name: "上层梯屋",
      text: "阳台之间还晾着衣服。"
    },
    FIRE_STATION: {
      name: "第九消防站",
      text: "留下了一辆消防车，油箱还有半箱。"
    },
    CITY_HALL: {
      name: "市政厅控制中心",
      text: "每块屏幕都显示着同一张潮汐图，比大海早一天。"
    },
    MALL: {
      name: "拱廊商场",
      text: "扶梯空转，没有人乘坐。"
    },
    POWER_STATION: {
      name: "发电站",
      text: "两台涡轮机，其中一台还在转。"
    },
    RAIL_YARD: {
      name: "铁路货场",
      text: "一节节装满机器零件的货车厢，封好了，贴着运往港口的标签。"
    },
    ESTATE: {
      name: "柳树住宅区",
      text: "家家大门敞开。路灯依次闪烁。"
    },
    PARK: {
      name: "纪念公园",
      text: "喷泉在倒着流。"
    },
    CIVIC_SQUARE: {
      name: "市政广场",
      text: "撤离警报从这里响起。大家都在这里集合。"
    },
    METRO: {
      name: "中央地铁站",
      text: "台阶通向漆黑的水里，水面没有一丝涟漪。"
    },
    WAREHOUSES: {
      name: "保税仓库",
      text: "一座高起的装卸台，燃料罐和罐头食品堆到了屋顶。"
    },
    WEST_MARINA: {
      name: "西码头游艇港",
      text: "游艇系在如今已沉入水下的系泊桩上。"
    },
    NIGHT_MARKET: {
      name: "夜市",
      text: "空荡荡的摊位上方，灯笼还亮着。"
    },
    RIVERSIDE: {
      name: "河畔公寓",
      text: "河水最先是从楼梯间涨上来的。"
    },
    VIADUCT: {
      name: "高架桥",
      text: "一条横跨低地的高架路，直通港口。"
    },
    INDUSTRIAL: {
      name: "工业园",
      text: "车间、托盘上的发动机缸体，还有一台钥匙插着的叉车。"
    },
    PUMP_STATION: {
      name: "抽水泵站",
      text: "六台巨大的水泵。只有一台还听拉杆的指挥。"
    },
    SEA_WALL: {
      name: "海堤步道",
      text: "海堤还立着。它的两边都是海。"
    },
    FISH_MARKET: {
      name: "鱼市",
      text: "箱子里的冰在融化。摊位底下有东西在动。"
    },
    OLD_HARBOUR: {
      name: "旧港",
      text: "腐朽的栈桥，还有一座旧救生艇棚。"
    },
    HARBOUR: {
      name: "撤离码头",
      text: "最后一座闸门还能用的码头。船就停在这里。"
    },
    SHIPYARD: {
      name: "造船厂",
      text: "干船坞、起重机，还有等着装上船体的发动机。"
    },
    LIGHTHOUSE: {
      name: "防波堤灯塔",
      text: "灯在旋转，光束落在并不存在的东西上。"
    },
    BREAKWATER: {
      name: "防波堤",
      text: "一条伸入海中的石臂，已经有一半没入水下。"
    }
  },
  items: {
    LIFE_JACKET: {
      name: "救生衣",
      text: "你的下一次涉水不会失败。"
    },
    ROPE: {
      name: "绳索",
      text: "你的下一次涉水或救援掷骰 +2。"
    },
    WATERPROOF_TORCH: {
      name: "防水手电",
      text: "你的下一次搜索或调查掷骰 +2。"
    },
    FIRST_AID_KIT: {
      name: "急救包",
      text: "为你自己或你所在区域的一人恢复 1 点理智。"
    },
    SEDATIVE: {
      name: "镇静剂",
      text: "恢复 1 点理智，并清除一个普通负面状态。"
    },
    TOOLKIT: {
      name: "工具箱",
      text: "你的下一次修复掷骰 +2。"
    },
    EMERGENCY_BATTERY: {
      name: "应急电池",
      text: "本回合 +1 行动点。"
    },
    CROWBAR: {
      name: "撬棍",
      text: "你的下一次抢救物资掷骰 +2。"
    },
    INFLATABLE_RAFT: {
      name: "充气筏",
      text: "携带即可，无需使用：让你的一次移动穿过一个沉没区域，抵达其后的干燥区域。生效后消耗。"
    }
  },
  parts: {
    ENGINE: {
      name: "发动机",
      text: "沉重，满是油污，是全城唯一还能发动的一台。"
    },
    FUEL: {
      name: "燃料桶",
      text: "柴油足够让一艘船驶出防波堤。"
    },
    NAV: {
      name: "导航模块",
      text: "在已成汪洋的街道间标出出路。"
    },
    CHIP: {
      name: "自动控制芯片",
      text: "可在甲板上直接启动船的引擎。并非每局都有。装上它，就没有人需要回去重启发电机。"
    }
  },
  npcs: {
    NURSE: {
      name: "奥卡福护士",
      text: "仍在查房。她知道哪些病房是干的。"
    },
    FERRYMAN: {
      name: "老船夫",
      text: "坚称那不是水。不过他照样熟悉水流。"
    },
    CHILD: {
      name: "拿手电的孩子",
      text: "在等说好马上回来的父母。"
    },
    ENGINEER: {
      name: "港口工程师",
      text: "被倒下的货架压住，正大声指路。身上有一份多余的撤离资格。"
    },
    COURIER: {
      name: "自行车快递员",
      text: "浑身湿透，怒气冲冲，还抱着包裹。"
    },
    TEACHER: {
      name: "瓦尔加老师",
      text: "留着全班的点名册。除了一个名字，其余都打了勾。她有一份不打算用的撤离资格。"
    }
  },
  statuses: {
    BUOYANT: {
      short: "救生衣",
      long: "救生衣（你的下一次涉水不会失败）"
    },
    ROPE_BONUS: {
      short: "绳索 +2",
      long: "绳索（你的下一次涉水或救援 +2）"
    },
    RISK_BONUS: {
      short: "撬棍 +2",
      long: "撬棍（你的下一次抢救物资 +2）"
    }
  },
  events: {
    S2_AFTERSHOCK: {
      title: "余震",
      text: "大地抖了一下。某处有条路塌陷了下去。"
    },
    S2_STORM: {
      title: "风暴锋面",
      text: "雨像砸下来的碎石。今晚水涨得更快，站在水里的人都能感觉到。"
    },
    S2_BROADCAST: {
      title: "紧急广播",
      text: "全城的收音机同时响起，报出下一条要沉没的街道。"
    },
    S2_DISTRESS: {
      title: "求救信号",
      text: "一扇窗里有手电在闪：三短，三长，三短。"
    },
    S2_FIGURE: {
      title: "水下的人影",
      text: "它在水面下与你并肩而行。它长着你的一张脸。"
    },
    S2_LOW_TIDE: {
      title: "退潮",
      text: "有一轮，大海退去，一条淹没的街道从水中露了出来。"
    },
    S2_SALVAGE: {
      title: "物资冲上岸",
      text: "一个货运集装箱撞在墙上裂开了。得有人先赶过去。"
    },
    S2_BREACH: {
      title: "防洪墙决口",
      text: "一声巨响，像一扇街道那么大的门被猛地摔上。海水涌了进来。"
    },
    S2_SCHOOL_LIGHTS: {
      title: "学校的灯亮着",
      text: "学校两天前就沉没了。它的窗户亮着灯，有人在黑板上写字。",
      options: {
        LOOK: {
          label: "凑近看",
          detail: "获得 1 点命运，失去 1 点理智。"
        },
        AWAY: {
          label: "移开视线",
          detail: "什么也不会发生。"
        }
      }
    },
    S2_NAMES: {
      title: "广播里有你的名字",
      text: "广播念出一份溺亡者名单。其中一个名字是你的，而你还在这里。"
    },
    S2_STILL_WATER: {
      title: "静水",
      text: "水停了。就这么停了一阵，仿佛在倾听。"
    },
    S2_VOICE: {
      title: "熟悉的声音",
      text: "积水的楼梯间里，一个本该远在他方的人在喊你的名字。",
      options: {
        FOLLOW: {
          label: "循声而去",
          detail: "找到一件道具，失去 1 点理智。"
        },
        STAY: {
          label: "留在原地",
          detail: "什么也不会发生。"
        }
      }
    }
  },
  goals: {
    REPAIR: "进行一次修复",
    FRAGMENT: "找到一个船只部件或一份撤离资格",
    HELP: "协助某人",
    NEW_CARRIAGE: "抵达一个你没去过的区域"
  }
};
