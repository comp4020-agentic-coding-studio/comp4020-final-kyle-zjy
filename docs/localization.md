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
| Scenario and character text (carriages, items, events, endings, 192 titles / skills…) | English from the game data itself; `src/shared/i18n/zh-CN/{scenario.ts,characters/*}` | the content's stable id |
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
| escape lock (Power / Route / Drive) | 逃离锁（动力 / 路线 / 驾驶） | |
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
