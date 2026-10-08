// A three or four-client browser path through Scenario 03's numbered relic loop.
// The host selects the public 03 tile through the normal lobby flow.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const base = process.env.APP_URL ?? "http://127.0.0.1:8093";
const dbPath = process.env.S03_TEST_DB ?? "/tmp/fate-s03-phase3-check/fate.db";
const out = process.env.S03_SHOTS ?? "/tmp/fate-s03-phase3";
const playerCount = Number(process.env.S03_PLAYERS ?? "3");
if (playerCount !== 3 && playerCount !== 4) throw new Error("S03_PLAYERS must be 3 or 4");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const configs = [
  { tag: "phone390", width: 390, name: "Kyle", sign: "Scorpio", type: /ENTP/ },
  { tag: "desktop1280", width: 1280, name: "Bea", sign: "Pisces", type: /ISFJ/ },
  { tag: "phone320", width: 320, name: "Ada", sign: "Leo", type: /ESFP/ },
  ...(playerCount === 4 ? [{ tag: "phone390b", width: 390, name: "Cal", sign: "Aries", type: /INTJ/ }] : []),
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
  await host.getByRole("button", { name: /^03\s+CHOOSE$/i }).click();
  await host.getByText("Temporal Administration: Incident Zero").waitFor();
  for (let i = 0; i < pages.length; i++) await pick(pages[i].page, configs[i].sign, configs[i].type);
  await pages[2].page.getByRole("button", { name: "中文" }).click();
  await host.getByRole("button", { name: "Enter the Administration" }).click();
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
  const obligation = state.temporal.bootstrap.find((entry: { instanceId: string }) => entry.instanceId === "relic-2");
  if (!obligation) throw new Error("seeded Authority Card obligation is missing");
  const assignedName = state.players[obligation.assignedTo].nickname as string;
  const assigned = pages.find((entry) => entry.name === assignedName)!;
  const assignedZh = assigned.tag === "phone320";
  const read = () => JSON.parse((db2.prepare("SELECT state_json FROM game_sessions WHERE room_code = ? ORDER BY started_at DESC LIMIT 1").get(code) as { state_json: string }).state_json);
  async function settleWindows() {
    for (let guard = 0; guard < 40; guard++) {
      const current = read();
      const window = current.pending.at(-1);
      if (!window) return;
      const option = window.options.findIndex((entry: { id: string }) => entry.id === "CONTAIN");
      const index = option >= 0 ? option : window.options.length - 1;
      for (const id of window.addressees as string[]) {
        if (read().pending.at(-1)?.id !== window.id || read().pending.at(-1)?.answers[id] !== undefined) continue;
        const actor = pages.find((entry) => entry.name === current.players[id].nickname)!;
        const version = read().version;
        await actor.page.getByRole("dialog").getByRole("button").nth(index).click();
        for (let retry = 0; retry < 30 && read().version === version; retry++) await actor.page.waitForTimeout(100);
      }
    }
    throw new Error("public anomaly did not settle");
  }
  async function endCurrent() {
    const current = read();
    const id = current.turnOrder[current.activeIndex] as string;
    if (!id) throw new Error("no active player after settling a round");
    const actor = pages.find((entry) => entry.name === current.players[id].nickname)!;
    await actor.page.getByRole("button", { name: actor.tag === "phone320" ? "结束回合" : "End turn" }).click();
    for (let retry = 0; retry < 30 && read().version === current.version; retry++) await actor.page.waitForTimeout(100);
    await settleWindows();
  }
  for (let i = 0; i < pages.length && read().turnOrder[read().activeIndex] !== obligation.assignedTo; i++) {
    await endCurrent();
  }
  await assigned.page.getByRole("button", { name: assignedZh ? "拾取 · 1 行动点" : "Pick up · 1 AP" }).click();
  await assigned.page.getByText(assignedZh ? "权限卡 · relic-2" : "Authority Card · relic-2").last().waitFor();
  for (const { page, tag } of pages) await check(page, `${tag}-pickup`);
  await assigned.page.getByRole("button", { name: assignedZh ? "迁跃至1996 · 2 行动点" : "Jump to 1996 · 2 AP" }).click();
  await assigned.page.getByText(assignedZh ? "你在中央大厅 · 1996 · 成立前夜" : "You are in Central Hall · 1996 · Before the founding", { exact: true }).waitFor();
  await endCurrent();
  for (let i = 0; i < pages.length && read().turnOrder[read().activeIndex] !== obligation.assignedTo; i++) {
    await endCurrent();
  }
  await assigned.page.getByRole("button", { name: assignedZh ? "于1996年封存 · 1 行动点" : "Seal in 1996 · 1 AP" }).click();
  await assigned.page.getByText(assignedZh ? "已放置来源：relic-2" : "Source placed: relic-2").waitFor();
  for (const { page, tag } of pages) await check(page, `${tag}-stored`);
  await assigned.page.reload();
  await assigned.page.getByText(assignedZh ? "已放置来源：relic-2" : "Source placed: relic-2").waitFor();
  const after = read();
  if (after.temporal.storedItems["relic-2"].status !== "STORED" || after.temporal.bootstrap.find((entry: { instanceId: string }) => entry.instanceId === "relic-2")?.placedBy !== obligation.assignedTo) issues.push("server did not persist the single stored relic and its source");
  await endCurrent();
  let futureActorId = "";
  for (let i = 0; i < pages.length; i++) {
    const current = read();
    const id = current.turnOrder[current.activeIndex] as string;
    if (current.temporal.locations[id].year === "Y2026") { futureActorId = id; break; }
    await endCurrent();
  }
  if (!futureActorId) throw new Error("no 2026 player can pick up the stored relic");
  const future = read();
  const futureActor = pages.find((entry) => entry.name === future.players[futureActorId].nickname)!;
  const recipientId = future.turnOrder.find((id: string) => id !== futureActorId && future.temporal.locations[id].year === "Y2026") as string;
  if (!recipientId) throw new Error("no co-located future recipient for relic transfer");
  const recipient = pages.find((entry) => entry.name === future.players[recipientId].nickname)!;
  await futureActor.page.getByRole("button", { name: futureActor.tag === "phone320" ? "拾取 · 1 行动点" : "Pick up · 1 AP" }).click();
  await futureActor.page.getByRole("combobox", { name: futureActor.tag === "phone320" ? "选择同处队友" : "Choose teammate here" }).selectOption(recipientId);
  await futureActor.page.getByRole("button", { name: futureActor.tag === "phone320" ? "提出转交" : "Offer transfer" }).click();
  await recipient.page.getByRole("dialog").getByRole("button", { name: recipient.tag === "phone320" ? "接受" : "Accept" }).click();
  await recipient.page.getByText(recipient.tag === "phone320" ? "权限卡 · relic-2" : "Authority Card · relic-2").last().waitFor();
  if (read().temporal.storedItems["relic-2"].ownerId !== recipientId) issues.push("consensual transfer did not move the original instance");
  await recipient.page.reload();
  await recipient.page.getByText(recipient.tag === "phone320" ? "权限卡 · relic-2" : "Authority Card · relic-2").last().waitFor();
  await check(recipient.page, "after-transfer-reload");
  db2.close();
  if (errors.length || issues.length) throw new Error([...errors, ...issues].join("\n"));
  process.stdout.write(`Scenario 03 ${pages.length}-player relic browser path passed: ${out}\n`);
} finally {
  await browser.close();
}
