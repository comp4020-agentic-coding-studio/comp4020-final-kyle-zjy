// A three-client Act III path through ZERO, prototype shutdown, historical
// collapse, the founding paradox and the third-route reveal.
// The public lobby keeps its 03 tile closed; only this local test updates the
// temporary test room's scenario_id directly before the host starts.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const base = process.env.APP_URL ?? "http://127.0.0.1:8093";
const dbPath = process.env.S03_TEST_DB ?? "/tmp/fate-s03-phase6-check/fate.db";
const out = process.env.S03_SHOTS ?? "/tmp/fate-s03-phase6";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const configs = [
  { tag: "phone390", width: 390, name: "Kyle", sign: "Scorpio", type: /ENTP/ },
  { tag: "desktop1280", width: 1280, name: "Bea", sign: "Pisces", type: /ISFJ/ },
  { tag: "phone320", width: 320, name: "Ada", sign: "Leo", type: /ESFP/ },
];
const pages: { tag: string; name: string; page: Page }[] = [];
const errors: string[] = [];
const issues: string[] = [];

async function check(page: Page, tag: string) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/${tag}.png` });
  for (const item of await clippedElements(page)) issues.push(`${tag}: clipped ${item}`);
  for (const item of await smallTargets(page)) issues.push(`${tag}: small target ${item}`);
}

async function pick(page: Page, sign: string, type: RegExp) {
  await page.getByRole("button", { name: "Choose character" }).click();
  await page.getByRole("button", { name: sign, exact: true }).click();
  await page.getByRole("button", { name: `Choose ${sign}` }).click();
  await page.getByRole("button", { name: type }).click();
  await page.getByRole("button", { name: new RegExp(`Reveal ${sign}`) }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "I'm ready" }).click();
}

try {
  for (const cfg of configs) {
    const context = await browser.newContext({ viewport: { width: cfg.width, height: 844 }, deviceScaleFactor: 1, isMobile: cfg.width < 600, hasTouch: cfg.width < 600 });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(`${cfg.tag}: ${e}`));
    pages.push({ tag: cfg.tag, name: cfg.name, page });
  }
  const host = pages[0].page;
  await host.goto(base);
  await host.getByRole("button", { name: "Create room" }).click();
  await host.getByLabel("Your name on the ticket").fill(configs[0].name);
  await host.getByRole("dialog").getByRole("button", { name: "Create room" }).click();
  await host.waitForURL(/\/room\/[A-Z0-9]{6}$/);
  const code = host.url().slice(-6);
  for (let i = 1; i < pages.length; i++) {
    const page = pages[i].page;
    await page.goto(`${base}/room/${code}`);
    await page.getByLabel("Your name on the ticket").fill(configs[i].name);
    await page.getByRole("dialog").getByRole("button", { name: "Join room" }).click();
  }
  const db = new DatabaseSync(dbPath);
  db.prepare("UPDATE rooms SET scenario_id = ? WHERE code = ?").run("S03_INCIDENT_ZERO", code);
  db.close();
  for (let i = 0; i < pages.length; i++) await pick(pages[i].page, configs[i].sign, configs[i].type);
  await pages[2].page.getByRole("button", { name: "中文" }).click();
  await host.getByRole("button", { name: "Depart" }).click();
  for (const { page, tag } of pages) {
    const begin = tag === "phone320" ? "进入时间管理局" : "Enter the Administration";
    await page.getByRole("button", { name: begin }).waitFor();
    await page.getByRole("button", { name: begin }).click();
  }
  for (const { page, tag } of pages) {
    await page.getByRole("region", { name: tag === "phone320" ? "时间管理局八房间地图" : "Eight-room Administration map" }).waitFor();
    await page.getByText(tag === "phone320" ? "2026年 · 所有时钟停在23:47，管理局大门封锁。第一条线索在第零号事故档案中。" : "2026 · Every clock stops at 23:47. The Administration seals its doors. Your first lead is the Incident Zero archive.").waitFor();
  }
  const db2 = new DatabaseSync(dbPath);
  const readState = () => JSON.parse((db2.prepare("SELECT state_json FROM game_sessions WHERE room_code = ? ORDER BY started_at DESC LIMIT 1").get(code) as { state_json: string }).state_json);
  async function endCurrent() {
    const before = readState();
    const actorName = before.players[before.turnOrder[before.activeIndex]].nickname as string;
    const actor = pages.find((entry) => entry.name === actorName)!;
    await actor.page.getByRole("button", { name: actor.tag === "phone320" ? "结束回合" : "End turn" }).click();
    for (let retry = 0; retry < 30 && readState().version === before.version; retry++) await actor.page.waitForTimeout(100);
    if (readState().version === before.version) throw new Error("turn did not advance");
  }
  const row = db2.prepare("SELECT state_json FROM game_sessions WHERE room_code = ? ORDER BY started_at DESC LIMIT 1").get(code) as { state_json: string };
  const state = JSON.parse(row.state_json);
  const activeName = state.players[state.turnOrder[state.activeIndex]].nickname as string;
  const active = pages.find((x) => x.name === activeName)!;
  const activePage = active.page;
  const activeZh = active.tag === "phone320";
  const location = activeZh ? "你在档案区 · 1996 · 成立前夜" : "You are in Archives · 1996 · Before the founding";
  await activePage.getByRole("button", { name: activeZh ? "移动至档案区 · 1 行动点" : "Move to Archives · 1 AP" }).click();
  await activePage.getByRole("button", { name: activeZh ? "询问1996年记录 · 1 行动点" : "Ask about 1996 · 1 AP" }).click();
  await activePage.getByRole("button", { name: activeZh ? "阅读密封案卷 · 1 行动点" : "Read sealed case file · 1 AP" }).click();
  await activePage.getByText(activeZh ? "官方档案：1996年23:59，原型机发生事故。创始人纪临川被记录为死亡，多名职员死亡或失踪。报告提到身份不明的闯入者。" : "Official file: a prototype accident occurred at 23:59 in 1996. Founder Ji Linchuan was recorded dead. Staff were killed or disappeared. The report mentions unidentified intruders.").waitFor();
  for (let i = 0; i < pages.length; i++) await endCurrent();
  await activePage.getByRole("button", { name: activeZh ? "迁跃至1996 · 2 行动点" : "Jump to 1996 · 2 AP" }).click();
  await activePage.getByText(location, { exact: true }).waitFor();
  for (const { page, tag } of pages) {
    if (page === activePage) continue;
    await page.getByText(tag === "phone320" ? `${activeName}：档案区，1996` : `${activeName}: Archives, 1996`, { exact: true }).waitFor();
  }
  await activePage.reload();
  await activePage.getByText(location, { exact: true }).waitFor();
  const after = JSON.parse((db2.prepare("SELECT state_json FROM game_sessions WHERE room_code = ? ORDER BY started_at DESC LIMIT 1").get(code) as { state_json: string }).state_json);
  if (after.temporal.locations[state.turnOrder[state.activeIndex]].roomId !== "ARCHIVES" || after.temporal.locations[state.turnOrder[state.activeIndex]].year !== "Y1996") issues.push("server position did not match browser move and jump");
  await activePage.getByRole("button", { name: activeZh ? "打开闸门" : "Open the gate" }).waitFor();
  await activePage.getByRole("button", { name: activeZh ? "打开闸门" : "Open the gate" }).click();
  for (const { page, tag } of pages) {
    await page.getByText(tag === "phone320" ? "秘密档案室：已开放" : "Secret Archive access: open").waitFor();
  }
  await activePage.reload();
  await activePage.getByText(activeZh ? "秘密档案室：已开放" : "Secret Archive access: open").waitFor();
  const rewritten = JSON.parse((db2.prepare("SELECT state_json FROM game_sessions WHERE room_code = ? ORDER BY started_at DESC LIMIT 1").get(code) as { state_json: string }).state_json);
  if (rewritten.temporal.causalRevision !== 1 || !rewritten.temporal.present.secretArchiveOpen) issues.push("causal revision or 2026 gate state was not persisted");
  for (let guard = 0; readState().round < 4 && guard < 8; guard++) await endCurrent();
  if (readState().round !== 4) issues.push("did not reach Act II");
  for (const { page, tag } of pages) {
    await page.getByText(tag === "phone320" ? "局长办公室与主实验室在两个年份开放。寻找身份不明的闯入者。" : "The Director's Office and Main Laboratory open in both years. Search for the unknown intruders.").waitFor();
  }
  await activePage.getByRole("button", { name: activeZh ? "移动至局长办公室 · 1 行动点" : "Move to Director's Office · 1 AP" }).click();
  await activePage.getByRole("button", { name: activeZh ? "阅读出入簿 · 1 行动点" : "Read access ledger · 1 AP" }).click();
  await endCurrent();
  const surveillanceState = readState();
  const investigatorName = surveillanceState.players[surveillanceState.turnOrder[surveillanceState.activeIndex]].nickname as string;
  const investigator = pages.find((entry) => entry.name === investigatorName)!;
  const investigatorZh = investigator.tag === "phone320";
  await investigator.page.getByRole("button", { name: investigatorZh ? "移动至档案区 · 1 行动点" : "Move to Archives · 1 AP" }).click();
  await investigator.page.getByRole("button", { name: investigatorZh ? "移动至局长办公室 · 1 行动点" : "Move to Director's Office · 1 AP" }).click();
  await investigator.page.getByRole("button", { name: investigatorZh ? "查看监控记录 · 1 行动点" : "Review surveillance · 1 AP" }).click();
  for (const { page, tag } of pages) {
    await page.getByText(tag === "phone320" ? /IX-[0-9A-F]{8} · 到达档案区/ : /IX-[0-9A-F]{8} · arrived in Archives/).waitFor();
  }
  for (let i = 0; i < pages.length - 1; i++) await endCurrent();
  if (readState().round !== 5) issues.push("did not reach round 5");
  for (let guard = 0; readState().sequence?.kind !== "S3_IDENTITY" && guard < 8; guard++) await endCurrent();
  const revealed = readState();
  if (revealed.round !== 6 || revealed.temporal.identityMatches.length !== pages.length) issues.push("round-6 identity match was incomplete");
  for (const { page, tag } of pages) {
    const dialog = page.getByRole("dialog", { name: tag === "phone320" ? "未知闯入者 = 玩家" : "UNKNOWN INTRUDERS = PLAYERS" });
    await dialog.waitFor();
  }
  for (const { page, tag } of pages) await page.getByRole("dialog", { name: tag === "phone320" ? "未知闯入者 = 玩家" : "UNKNOWN INTRUDERS = PLAYERS" }).getByRole("button", { name: tag === "phone320" ? "进入第三幕" : "Continue to Act III" }).click();
  for (const { page, tag } of pages) await page.getByRole("dialog", { name: tag === "phone320" ? "未知闯入者 = 玩家" : "UNKNOWN INTRUDERS = PLAYERS" }).waitFor({ state: "hidden" });
  if (readState().round !== 7) issues.push("identity scene did not advance to round 7");
  for (const { page, tag } of pages) {
    await page.getByText(tag === "phone320" ? "管理员 ZERO 命令你们恢复第零号事故的官方记录。它称事故促成了时间管理局的成立。" : "Administrator ZERO orders you to restore the official Incident Zero account. It says the accident founded the Administration.").waitFor();
    await check(page, `${tag}-act3`);
  }
  const centralId = readState().turnOrder.find((id: string) => {
    const loc = readState().temporal.locations[id];
    return loc.roomId === "CENTRAL_HALL" && loc.year === "Y2026";
  });
  if (!centralId) throw new Error("no 2026 Central Hall player for ZERO path");
  for (let guard = 0; readState().turnOrder[readState().activeIndex] !== centralId && guard < 3; guard++) await endCurrent();
  const zeroName = readState().players[centralId].nickname as string;
  const zeroActor = pages.find((entry) => entry.name === zeroName)!;
  const zeroZh = zeroActor.tag === "phone320";
  await zeroActor.page.getByRole("button", { name: zeroZh ? "询问 ZERO · 1 行动点" : "Question ZERO · 1 AP" }).click();
  await zeroActor.page.getByText(zeroZh ? "私人记录：ZERO 将事故、成立文件与队伍的任务连成一个因果闭环。" : "Private transcript: ZERO links the accident, founding charter and your own mission in one causal loop.").waitFor();
  await zeroActor.page.getByRole("button", { name: zeroZh ? "移动至研究区 · 1 行动点" : "Move to Research Wing · 1 AP" }).click();
  await zeroActor.page.getByRole("button", { name: zeroZh ? "移动至原型机房 · 1 行动点" : "Move to Prototype Room · 1 AP" }).click();
  for (let guard = 0; (readState().round < 8 || readState().turnOrder[readState().activeIndex] !== centralId) && guard < 6; guard++) await endCurrent();
  if (readState().round !== 8) throw new Error("ZERO player did not reach round 8");
  await zeroActor.page.getByRole("button", { name: zeroZh ? "迁跃至1996 · 2 行动点" : "Jump to 1996 · 2 AP" }).click();
  await zeroActor.page.getByRole("button", { name: zeroZh ? "关闭核心" : "Shut down the core" }).click();
  for (const { page, tag } of pages) {
    await page.getByText(tag === "phone320" ? "2026年动力室：从可进入地图中消失" : "2026 Power Room: erased from the accessible map").waitFor();
    await page.getByText(tag === "phone320" ? "2026年时间管理局：原型机停机后正在消退" : "2026 Administration: fading after the prototype shutdown").waitFor();
    await check(page, `${tag}-shutdown`);
  }
  const shutdownState = readState();
  if (shutdownState.temporal.present.powerRoomExists || shutdownState.temporal.present.administrationIntegrity !== "FADING") issues.push("prototype shutdown did not persist the 2026 collapse");
  for (let guard = 0; readState().sequence?.kind !== "S3_THIRD_ROUTE" && guard < 10; guard++) await endCurrent();
  if (readState().round !== 9 || readState().temporal.story.availableRoutes.length !== 3) issues.push("third route did not unlock after round 9");
  for (const { page, tag } of pages) {
    const dialog = page.getByRole("dialog", { name: tag === "phone320" ? "历史可以被欺骗" : "HISTORY CAN BE DECEIVED" });
    await dialog.waitFor();
    await page.waitForTimeout(700);
    await check(page, `${tag}-third-route`);
    await dialog.getByRole("button", { name: tag === "phone320" ? "进入第四幕" : "Continue to Act IV" }).click();
  }
  for (const { page, tag } of pages) await page.getByRole("dialog", { name: tag === "phone320" ? "历史可以被欺骗" : "HISTORY CAN BE DECEIVED" }).waitFor({ state: "hidden" });
  if (readState().round !== 10) issues.push("third-route scene did not advance to round 10");
  db2.close();
  if (errors.length || issues.length) throw new Error([...errors, ...issues].join("\n"));
  process.stdout.write(`Scenario 03 Phase 6 browser path passed: ${out}\n`);
} finally {
  await browser.close();
}
