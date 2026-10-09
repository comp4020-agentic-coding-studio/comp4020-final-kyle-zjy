# Localization

Two locales: `en` (canonical, default) and `zh-CN` (Simplified Chinese).
A player picks one on the landing page or in the lobby; it is stored per
browser (`localStorage["fate:locale"]`) and locked for the run once the room
departs. Rooms and the server have no locale: two players at one table can
read the same state in different languages.

## Layers

| What | Where | Key |
| --- | --- | --- |
| Client UI copy (buttons, labels, notices) | `src/client/i18n/{en,zh-CN}.ts`, `t("lobby.ready")` | dotted key; `en.ts` is the source |
| Scenario and character text (rooms, items, events, endings, 192 titles / skills…) | English from game data and `src/shared/i18n/`; Chinese in `src/shared/i18n/zh-CN/` | the content's stable id |
| Engine messages in game state (log lines, decision windows, results, secrets, rejections) | `m` tag at the call site (`src/shared/i18n/msg.ts`); `src/shared/i18n/zh-CN/messages.ts` | the English template, e.g. `"{0} gains {1} Fate ({2})."` |

Game state carries `Msg` values (`{ k, p }`), never sentences: the server
sends stable keys and parameters; each client renders them with
`format(locale, msg)`. Content goes into a message as a reference
(`ref.item("FLASHLIGHT")`), so a Chinese sentence never holds English words.
Nicknames are parameters and are shown exactly as entered.

Each variant of a sentence is its own whole template (`n > 1 ? m\`… rounds\` :
m\`… this round\``); never pass an English word or fragment as a parameter.
`scripts/i18n/message-keys.ts` lists every template in `src/`;
`test/localization.test.ts` checks the zh-CN table against it and renders
every message of the kept simulations in both languages.

## Terminology (zh-CN)

One translation per concept, everywhere: UI, skills, events, log.

| English | 中文 | Notes |
| --- | --- | --- |
| Fate | 命运 | "2 Fate" → 2 点命运 |
| Sanity | 理智 | "lose 1 Sanity" → 失去 1 点理智 |
| Collapse | 崩坏度 | the train's clock, "Collapse 4 / 12" → 崩坏度 4 / 12 |
| action point (AP) | 行动点 | |
| turn / round | 回合 / 轮 | "Round 3 of 12" → 第 3 / 12 轮 |
| ability (character skill) | 能力 | |
| Active / Reaction / Passive | 主动 / 反应 / 被动 | ability types |
| once per run | 每局一次 | |
| reaction window / decision | 反应时机 / 抉择 | |
| roll; Success / Perfect / Failure / Disaster | 掷骰；成功 / 完美 / 失败 / 大失败 | |
| ordinary roll / quick roll / risk roll / contest roll | 常规掷骰 / 快速掷骰 / 风险掷骰 / 对抗掷骰 | |
| Investigate / Search / Repair / Help / Trade / Steady (Stabilize) / Confront / Move | 调查 / 搜索 / 修复 / 协助 / 交易 / 稳定 / 对抗 / 移动 | action names |
| item | 道具 | |
| clue | 线索 | |
| memory fragment / core memory | 记忆碎片 / 核心记忆 | |
| reality anchor | 现实锚点 | |
| escape lock (Power / Identity / Memory) | 逃生锁（动力 / 身份 / 记忆） | |
| key item (Power / Identity / Memory Key) | 关键道具（动力 / 身份 / 记忆钥匙） | made by restoring an anchor; trade only |
| carriage | 车厢 | |
| Driver's Cab | 驾驶室 | |
| the Faceless Inspector / ticket check | 无面检票员 / 查票 | |
| passenger echo | 回声乘客 | |
| shadow passenger | 影子乘客 | |
| seat neighbour | 邻座 | |
| night rule | 夜间规则 | |
| obsession | 执念 | |
| secret message / dream card / glimpse | 密信 / 梦境卡 / 预见 | |
| buff / negative status | 增益 / 负面状态 | |
| shield / immunity | 护盾 / 免疫 | |
| bond | 羁绊 | |
| reward / penalty | 奖励 / 惩罚 | |
| host / lobby / room code | 房主 / 大厅 / 房间码 | |
| Reality Fold | 现实折叠 | |
| boon | 恩惠 | |
| small event | 小事件 | an extra INSTANT or GROUP_ROLL card |
| small roll | 快速掷骰 | the same thing as a quick roll |
| Act I / II / III | 第一幕 / 第二幕 / 第三幕 | |

Chinese text uses full-width punctuation (，。：？！「」), and numbers stay
Arabic digits. Translations must describe exactly the same mechanic as the
English: timing, targets, amounts, and "once per run" carry over word for word.

## Scenario 02 terms (zh-CN)

| English | 中文 | Notes |
| --- | --- | --- |
| Sunken City: The Last High Ground | 沉没都市：最后的高地 | |
| Act I · The Water Came / II · Not Everyone Fits / III · The Last High Ground | 第一幕 · 水来了 / 第二幕 · 船坐不下所有人 / 第三幕 · 最后的高地 | |
| zone | 区域 | |
| flooded / under water / blocked / dry | 积水 / 沉没 / 被封堵 / 干燥 | zone states |
| low / mid / high ground | 低地 / 中地 / 高地 | |
| wade | 涉水 | |
| evacuation boat / pier / pier gate | 逃生船 / 码头 / 码头闸门 | |
| evacuation pass / seat / capacity | 撤离资格 / 船位 / 容量 | "a pass is not a seat": 撤离资格不等于船位 |
| boat part (Engine Block, Fuel Drums, Navigation Module, Auto-Control Chip) | 船只部件（发动机、燃料桶、导航模块、自动控制芯片） | |
| power station / pump station | 发电站 / 抽水泵站 | |
| rescue / operate / salvage / install / register / share intel | 救援 / 操作 / 抢救物资 / 安装 / 登记 / 分享情报 | actions |
| intel | 情报 | |
| aboard / despair (lost) | 已登船 / 绝望 | |
| escaped / held the gate / left behind / drowned | 已逃离 / 守住闸门 / 被留下 / 溺亡 | per-player endings |
| The Last Gatekeeper, The Betrayer, The Last Survivor, The Unsung Hero, The Rescuer, Companion in the Deep, Fate's Gambler, The Hoarder | 最后守门人、背叛者、最后幸存者、无名英雄、救援者、绝境同行者、命运赌徒、囤积者 | titles |

## Scenario 03 foundation terms (zh-CN)

Act I and II story text uses stable `s3.story.<ID>` UI keys in both locales, with
matching engine log templates in the shared message catalog. Archivist 00's
name, prompt and private note use `s3.npc.*` keys. The official file is always
presented as a claim in the archive, preserving later distinctions between
recorded history and fixed facts.

Act II surveillance entries use `s3.intruders.trace.<KIND>` plus keyed node
and choice names; the matching cinematic uses `s3.identity.*`. The server
stores only IDs, signature tokens, player IDs and action provenance, so each
browser renders the same state in its own locked locale.

PHASES 1–7 use localized UI keys in `s3-en.ts` and `s3-zh-CN.ts`, plus shared
message templates. Act III uses `s3.paradox.*`, `s3.fact.*` and `s3.route.*`
for ZERO, claim/evidence pairs, the fading 2026 room state and third-route
scene. Ji Linchuan is 纪临川 in Chinese throughout. Item names and descriptions
use `scenario03.ts` and `zh-CN/scenario03.ts`. Act IV uses `s3.final.*`, `s3.ending.*` and `s3.results.*` for the
causal checklist, three outcomes and failure. The true ending's identity
reveal and seven-minute line have matching engine templates in both locales.
PHASE 8 resolves all 192 skill names and descriptions through
`characterText(locale, id, "S03_INCIDENT_ZERO")`; its setting-specific
revisions are in `scenario03/skill-adapters.ts` and `zh-CN/skills03.ts`.
The public anomaly deck uses event IDs in `scenario03/events.ts` with English
and Chinese text in the matching i18n modules. Three scan protocols and
co-located help have parallel client keys and engine templates. The action
rolls add bilingual tier and outcome cues under `s3.cue.*`, a supply-choice
window, and whole engine message templates. Outcome IDs remain independent
of locale.

| English | 中文 | Notes |
| --- | --- | --- |
| Temporal Administration: Incident Zero | 时间管理局：第零号事故 | scenario title |
| 1996 / 2026 | 1996 年 / 2026 年 | two versions of the same physical room |
| Central Hall | 中央大厅 | starting room |
| Research Wing | 研究区 | `TEMPORAL_CONTAINMENT` is a 2026 facility here, not a room |
| time jump | 时间迁跃 | costs 2 AP and keeps the room |
| cycle | 轮 | round label for the foundation |
| causal revision | 因果改写 | counts material changes to the 2026 state |
| sealed case file | 密封案卷 | owner-only evidence until shared by a later rule |
| intervention | 干预 | a 1996 decision resolved by the server |
| official account / corrected report | 官方版本 / 已更正报告 | separate from fixed facts |
| numbered relic / source obligation | 编号遗物 / 来源义务 | one conserved item instance across years |
| protected storage / Temporal Containment | 保护存放处 / 时间收容设施 | facilities inside existing rooms |
| Phase Battery / Sedative | 相位电池 / 镇静剂 | ordinary consumables in the Scenario 03 pool |
| Archive / Field / Stabilization scan | 档案扫描 / 现场扫描 / 稳定扫描 | one ordinary server roll per cycle, with distinct success-kind bits |
| public anomaly | 公共异常事件 | Scenario 03's own five-card event deck |
