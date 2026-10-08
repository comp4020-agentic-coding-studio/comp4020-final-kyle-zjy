// A short browser path to Scenario 03's closed PHASE 2 causal development run.
// The public lobby keeps its 03 tile closed; only this local test updates the
// temporary test room's scenario_id directly before the host starts.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const base = process.env.APP_URL ?? "http://127.0.0.1:8093";
const dbPath = process.env.S03_TEST_DB ?? "/tmp/fate-s03-phase2-check/fate.db";
const out = process.env.S03_SHOTS ?? "/tmp/fate-s03-phase2";
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
    if (tag !== "phone320") await check(page, `${tag}-intro`);
    await page.getByRole("button", { name: begin }).click();
  }
  for (const { page, tag } of pages) {
    await page.getByRole("region", { name: tag === "phone320" ? "时间管理局八房间地图" : "Eight-room Administration map" }).waitFor();
    await check(page, `${tag}-map`);
  }
  const db2 = new DatabaseSync(dbPath);
  const row = db2.prepare("SELECT state_json FROM game_sessions WHERE room_code = ? ORDER BY started_at DESC LIMIT 1").get(code) as { state_json: string };
  const state = JSON.parse(row.state_json);
  const activeName = state.players[state.turnOrder[state.activeIndex]].nickname as string;
  const active = pages.find((x) => x.name === activeName)!;
  const activePage = active.page;
  const activeZh = active.tag === "phone320";
  const location = activeZh ? "你在档案区 · 1996 · 成立前夜" : "You are in Archives · 1996 · Before the founding";
  await activePage.getByRole("button", { name: activeZh ? "移动至档案区 · 1 行动点" : "Move to Archives · 1 AP" }).click();
  await activePage.getByRole("button", { name: activeZh ? "迁跃至1996 · 2 行动点" : "Jump to 1996 · 2 AP" }).click();
  await activePage.getByText(location, { exact: true }).waitFor();
  await check(activePage, "after-jump");
  for (const { page, tag } of pages) {
    if (page === activePage) continue;
    await page.getByText(tag === "phone320" ? `${activeName}：档案区，1996` : `${activeName}: Archives, 1996`, { exact: true }).waitFor();
  }
  await activePage.reload();
  await activePage.getByText(location, { exact: true }).waitFor();
  const after = JSON.parse((db2.prepare("SELECT state_json FROM game_sessions WHERE room_code = ? ORDER BY started_at DESC LIMIT 1").get(code) as { state_json: string }).state_json);
  if (after.temporal.locations[state.turnOrder[state.activeIndex]].roomId !== "ARCHIVES" || after.temporal.locations[state.turnOrder[state.activeIndex]].year !== "Y1996") issues.push("server position did not match browser move and jump");
  await activePage.getByRole("button", { name: activeZh ? "结束回合" : "End turn" }).click();
  for (let i = 0; i < pages.length - 1; i++) {
    const current = JSON.parse((db2.prepare("SELECT state_json FROM game_sessions WHERE room_code = ? ORDER BY started_at DESC LIMIT 1").get(code) as { state_json: string }).state_json);
    const name = current.players[current.turnOrder[current.activeIndex]].nickname as string;
    const actor = pages.find((x) => x.name === name)!;
    await actor.page.getByRole("button", { name: actor.tag === "phone320" ? "结束回合" : "End turn" }).click();
  }
  await activePage.getByRole("button", { name: activeZh ? "打开闸门" : "Open the gate" }).waitFor();
  await activePage.getByRole("button", { name: activeZh ? "打开闸门" : "Open the gate" }).click();
  for (const { page, tag } of pages) {
    await page.getByText(tag === "phone320" ? "秘密档案室：已开放" : "Secret Archive access: open").waitFor();
    await check(page, `${tag}-rewrite`);
  }
  await activePage.reload();
  await activePage.getByText(activeZh ? "秘密档案室：已开放" : "Secret Archive access: open").waitFor();
  const rewritten = JSON.parse((db2.prepare("SELECT state_json FROM game_sessions WHERE room_code = ? ORDER BY started_at DESC LIMIT 1").get(code) as { state_json: string }).state_json);
  if (rewritten.temporal.causalRevision !== 1 || !rewritten.temporal.present.secretArchiveOpen) issues.push("causal revision or 2026 gate state was not persisted");
  db2.close();
  if (errors.length || issues.length) throw new Error([...errors, ...issues].join("\n"));
  process.stdout.write(`Scenario 03 Phase 2 browser path passed: ${out}\n`);
} finally {
  await browser.close();
}
