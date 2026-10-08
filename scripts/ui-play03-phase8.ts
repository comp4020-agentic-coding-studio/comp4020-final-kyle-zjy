// Three isolated browsers exercise the new ability and ordinary-roll UI at
// 320, 390 and 1280 px. Scenario 03 is still closed in the public lobby, so
// this local walkthrough selects it in its temporary test room before start.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const base = process.env.APP_URL ?? "http://127.0.0.1:8093";
const dbPath = process.env.S03_TEST_DB ?? "/tmp/fate-s03-phase8-check/fate.db";
const out = process.env.S03_SHOTS ?? "/tmp/fate-s03-phase8-ui";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const clients = [
  { tag: "phone390", width: 390, name: "Bea", sign: "Pisces", type: /ENTP/, zh: false },
  { tag: "phone320", width: 320, name: "Ada", sign: "Aries", type: /ESTJ/, zh: true },
  { tag: "desktop1280", width: 1280, name: "Cal", sign: "Gemini", type: /ENTJ/, zh: false },
] as const;
const pages: { tag: string; name: string; zh: boolean; page: Page }[] = [];
const errors: string[] = [];
const issues: string[] = [];

async function pick(page: Page, sign: string, type: RegExp) {
  await page.getByRole("button", { name: "Choose character" }).click();
  await page.getByRole("button", { name: sign, exact: true }).click();
  await page.getByRole("button", { name: `Choose ${sign}` }).click();
  await page.getByRole("button", { name: type }).click();
  await page.getByRole("button", { name: new RegExp(`Reveal ${sign}`) }).click();
  if (sign === "Pisces") {
    await page.getByText("Brave Face", { exact: true }).waitFor();
    await page.getByText("Gain a shield that blocks the next negative effect on you.", { exact: true }).waitFor();
  }
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "I'm ready" }).click();
}

try {
  for (const client of clients) {
    const context = await browser.newContext({ viewport: { width: client.width, height: 844 }, deviceScaleFactor: 1, isMobile: client.width < 600, hasTouch: client.width < 600 });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${client.tag}: ${error.message}`));
    pages.push({ tag: client.tag, name: client.name, zh: client.zh, page });
  }
  const host = pages[0].page;
  await host.goto(base);
  await host.getByRole("button", { name: "Create room" }).click();
  await host.getByLabel("Your name on the ticket").fill(clients[0].name);
  await host.getByRole("dialog").getByRole("button", { name: "Create room" }).click();
  await host.waitForURL(/\/room\/[A-Z0-9]{6}$/);
  const code = host.url().slice(-6);
  for (let i = 1; i < pages.length; i++) {
    const page = pages[i].page;
    await page.goto(`${base}/room/${code}`);
    await page.getByLabel("Your name on the ticket").fill(pages[i].name);
    await page.getByRole("dialog").getByRole("button", { name: "Join room" }).click();
  }
  await host.getByRole("button", { name: /^03\s+CHOOSE$/i }).click();
  const db = new DatabaseSync(dbPath);
  for (let i = 0; i < pages.length; i++) await pick(pages[i].page, clients[i].sign, clients[i].type);
  await pages[1].page.getByRole("button", { name: "中文" }).click();
  await host.getByRole("button", { name: "Enter the Administration" }).click();
  for (const client of pages) await client.page.getByRole("button", { name: client.zh ? "进入时间管理局" : "Enter the Administration" }).click();
  const read = () => JSON.parse((db.prepare("SELECT state_json FROM game_sessions WHERE room_code = ? ORDER BY started_at DESC LIMIT 1").get(code) as { state_json: string }).state_json);
  const state = read();
  const actorId = state.turnOrder[state.activeIndex] as string;
  const actor = pages.find((client) => client.name === state.players[actorId].nickname)!;
  for (const client of pages) {
    const section = client.page.getByRole("region", { name: client.zh ? "你的能力" : "Your ability" });
    await section.waitFor();
    await section.scrollIntoViewIfNeeded();
    await section.screenshot({ path: `${out}/${client.tag}-skill.png` });
    if (!(await section.locator("h2").innerText())) issues.push(`${client.tag}: empty ability name`);
    for (const item of await clippedElements(client.page)) issues.push(`${client.tag}: clipped ${item}`);
    for (const item of await smallTargets(client.page)) issues.push(`${client.tag}: small target ${item}`);
  }
  const section = actor.page.getByRole("region", { name: actor.zh ? "你的能力" : "Your ability" });
  const targets = section.locator("button[aria-pressed]");
  const targetCount = await targets.count();
  const needed = actor.name === "Cal" ? 2 : actor.name === "Ada" ? 1 : 0;
  if (needed > targetCount) issues.push("ability target options missing");
  for (let i = 0; i < needed; i++) await targets.nth(i).click();
  await section.getByRole("button", { name: actor.zh ? "使用能力" : "Use ability" }).click();
  for (let guard = 0; read().pending.length && guard < 8; guard++) {
    const window = read().pending.at(-1);
    for (const id of window.addressees as string[]) {
      if (window.answers[id] !== undefined) continue;
      const client = pages.find((item) => item.name === read().players[id].nickname)!;
      await client.page.getByRole("dialog").getByRole("button").last().click();
    }
  }
  if (read().players[actorId].skill.usesLeft !== 0) issues.push("ability was not consumed on the server");
  await actor.page.getByRole("button", { name: actor.zh ? "档案扫描" : "Archive scan" }).click();
  const die = actor.page.getByRole("dialog", { name: actor.zh ? /档案扫描/ : /archive scan/ });
  await die.waitFor();
  const rolling = read();
  if (rolling.roll?.purpose !== "S3_SCAN_ARCHIVE") issues.push("server did not start an archive scan");
  await die.screenshot({ path: `${out}/${actor.tag}-scan.png` });
  if (rolling.pending.at(-1)?.kind === "FATE_SPEND") await die.getByRole("button").first().click();
  for (let retry = 0; retry < 30 && !read().roll?.done; retry++) await actor.page.waitForTimeout(100);
  if (!read().roll?.done) issues.push("scan did not settle");
  for (const item of await clippedElements(actor.page)) issues.push(`${actor.tag} scan: clipped ${item}`);
  for (const item of await smallTargets(actor.page)) issues.push(`${actor.tag} scan: small target ${item}`);
  db.close();
} finally {
  await browser.close();
}
if (errors.length || issues.length) throw new Error([...errors, ...issues].join("\n"));
console.log(`Scenario 03 Phase 8 browser path passed: ${out}`);
