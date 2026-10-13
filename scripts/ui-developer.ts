// Launch every checkpoint through the real page/API, then compare isolated
// English/Chinese viewer projections and exercise the return/seat controls.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { CHECK_PRESETS, type CheckRun } from "../src/shared/developer.ts";
import type { Snapshot } from "../src/shared/protocol.ts";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const base = process.env.APP_URL ?? "http://127.0.0.1:8080";
const out = "/tmp/fate-developer-ui";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const contexts = await Promise.all([browser.newContext({ viewport: { width: 1280, height: 900 } }), browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" })]);
const [desk, phone] = await Promise.all(contexts.map((c) => c.newPage()));
const views = new Map<Page, Snapshot>();
const errors: string[] = [];
let launched: CheckRun | null = null;
for (const page of [desk, phone]) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", async (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    if (page === desk && response.url().endsWith("/api/developer/runs") && response.ok()) launched = await response.json();
  });
  page.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => { const message = JSON.parse(String(payload)); if (message.snapshot) views.set(page, message.snapshot); }));
}
async function shot(page: Page, label: string) {
  await page.screenshot({ path: `${out}/${label}.png`, fullPage: true });
  assert.deepEqual(await clippedElements(page), [], `${label}: clipping`);
  assert.deepEqual(await smallTargets(page), [], `${label}: touch targets`);
}
async function online(page: Page, run: CheckRun, seat: number) {
  for (let i = 0; i < 100; i++) {
    const game = views.get(page)?.game;
    if (game?.sessionId === run.sessionId && game.viewerId === run.seats[seat].playerId) return game;
    await page.waitForTimeout(100);
  }
  throw new Error(`No authenticated view for ${run.presetId}/${seat}`);
}
try {
  const normal = await fetch(`${base}/api/rooms`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nickname: "Ordinary" }) }).then((r) => r.json());
  for (const [i, page] of [desk, phone].entries()) {
    await page.goto(base);
    await page.evaluate(({ locale, token, code }) => { localStorage.setItem("fate:locale", locale); localStorage.setItem("fate:muted", "true"); if (token) { localStorage.setItem("fate:token", token); localStorage.setItem("fate:lastRoom", code); } }, { locale: i ? "zh-CN" : "en", token: i ? "" : normal.sessionToken, code: normal.roomCode });
    await page.reload();
    await page.getByRole("button", { name: i ? /^开发者 \/ 作业检查/ : /^Developer \/ Assignment Check/ }).click();
    await page.waitForURL(/\/developer$/);
    await page.locator(".developer-card").first().waitFor();
    await shot(page, i ? "checks-390-zh" : "checks-1280-en");
  }
  await phone.setViewportSize({ width: 320, height: 740 }); await shot(phone, "checks-320-zh"); await phone.setViewportSize({ width: 390, height: 844 });
  for (const preset of CHECK_PRESETS) {
    launched = null;
    await desk.locator(`#checkpoint-${preset.scenarioId}`).selectOption(preset.id);
    await desk.locator(".developer-card").filter({ has: desk.locator(`#checkpoint-${preset.scenarioId}`) }).getByRole("button", { name: "Launch checkpoint", exact: true }).click();
    await desk.waitForURL(/\/developer\/room\/[A-Z0-9]{6}\/[0-2]$/);
    for (let i = 0; !launched && i < 50; i++) await desk.waitForTimeout(100);
    assert(launched);
    const run = launched as CheckRun;
    const other = (run.initialSeat + 1) % 3;
    const data = await desk.evaluate(() => ({ runs: localStorage.getItem("fate:developer:runs")!, seen: localStorage.getItem("fate:openings") }));
    await phone.evaluate(({ runs, seen }) => { localStorage.setItem("fate:developer:runs", runs); if (seen) localStorage.setItem("fate:openings", seen); }, data);
    await phone.goto(`${base}/developer/room/${run.seats[0].roomCode}/${other}`);
    const [firstView, otherView] = await Promise.all([online(desk, run, run.initialSeat), online(phone, run, other)]);
    assert.equal(firstView.flags.developerCheck, 1);
    assert.notEqual(firstView.viewerId, otherView.viewerId);
    await desk.waitForTimeout(350);
    if (preset.id.endsWith(".start")) {
      await Promise.all([desk, phone].map((p) => p.locator(".s3-film").waitFor()));
      await shot(desk, `${preset.id}-opening-1280`);
      await shot(phone, `${preset.id}-opening-390`);
      await desk.getByRole("button", { name: "Skip", exact: true }).click();
      await phone.getByRole("button", { name: "跳过", exact: true }).click();
      await Promise.all([desk, phone].map((p) => p.locator(".s3-film").waitFor({ state: "detached" })));
    } else assert.equal(await desk.locator(".s3-film").count(), 0);
    if (preset.id === "s3.recap" || preset.id === "s4.private") {
      await desk.locator("aside[role=dialog]").waitFor();
      await shot(desk, `${preset.id}-inspection-1280`);
      await shot(phone, `${preset.id}-inspection-390`);
      await desk.keyboard.press("Escape"); await phone.keyboard.press("Escape");
    }
    await shot(desk, `${preset.id}-1280`);
    await shot(phone, `${preset.id}-390`);
    if (["s1.fold", "s2.generator", "s3.archive", "s4.final-bid", "s4.showdown"].includes(preset.id)) {
      await phone.setViewportSize({ width: 320, height: 740 }); await shot(phone, `${preset.id}-320`); await phone.setViewportSize({ width: 390, height: 844 });
    }
    if (preset.id === "s4.private") {
      assert(firstView.auction!.players[firstView.viewerId].privateIntel!.length > 0);
      assert.equal(otherView.auction!.players[firstView.viewerId].privateIntel, null);
    }
    if (preset.id === "s4.final-bid") {
      const version = firstView.version;
      await desk.locator(".developer-tools > summary").click();
      await desk.getByRole("button", { name: "Advance defaults", exact: true }).click();
      await desk.locator(".developer-tools > summary").click();
      for (let i = 0; views.get(desk)!.game!.version <= version && i < 50; i++) await desk.waitForTimeout(100);
      assert(views.get(desk)!.game!.version > version);
    }
    if (preset.id === "s4.auction") {
      const select = desk.locator(".developer-bar select");
      await select.selectOption(String(other)); await online(desk, run, other);
      assert.equal(views.get(desk)!.game!.viewerId, run.seats[other].playerId);
      await desk.reload(); await online(desk, run, other);
      assert.equal(await desk.locator(".developer-bar select").inputValue(), String(other));
    }
    assert.equal(await desk.evaluate(() => localStorage.getItem("fate:token")), normal.sessionToken);
    assert.equal(await desk.evaluate(() => localStorage.getItem("fate:lastRoom")), normal.roomCode);
    await desk.getByRole("button", { name: "Back to checks", exact: true }).click();
    await phone.getByRole("button", { name: "返回检查页", exact: true }).click();
    await Promise.all([desk, phone].map((p) => p.waitForURL(/\/developer$/)));
    console.log(`${preset.id}: real checkpoint, two private views, layout and return passed`);
  }
  await desk.getByRole("button", { name: "Back to home", exact: true }).click(); await desk.waitForURL(base + "/");
  await desk.waitForTimeout(2500); await shot(desk, "home-1280-en");
  await phone.getByRole("button", { name: "返回首页", exact: true }).click(); await phone.setViewportSize({ width: 320, height: 740 }); await phone.waitForTimeout(2500); await shot(phone, "home-320-zh");
  await desk.getByRole("button", { name: "Create room", exact: true }).click(); await desk.getByRole("dialog").waitFor(); await desk.keyboard.press("Escape");
  await desk.getByRole("button", { name: "Join room", exact: true }).click(); await desk.getByRole("dialog").waitFor();
  assert.deepEqual(errors, []);
  console.log(`All developer checks passed. Screenshots: ${out}`);
} catch (error) {
  console.error("Browser errors:", errors);
  await desk.screenshot({ path: `${out}/failure-desk.png`, fullPage: true }).catch(() => {});
  await phone.screenshot({ path: `${out}/failure-phone.png`, fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
