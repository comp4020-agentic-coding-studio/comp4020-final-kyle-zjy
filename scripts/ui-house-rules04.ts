// Full Scenario 04 House Rule journey through the real developer room and browser.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import type { CheckRun } from "../src/shared/developer.ts";
import type { Snapshot } from "../src/shared/protocol.ts";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const base = process.env.APP_URL ?? "http://127.0.0.1:8080";
const out = "/tmp/fate-house-rules-ui";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const [desktopContext, phoneContext] = await Promise.all([
  browser.newContext({ viewport: { width: 1280, height: 900 } }),
  browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" }),
]);
const desktop = await desktopContext.newPage();
const phone = await phoneContext.newPage();
const views = new Map<Page, Snapshot>();
const errors: string[] = [];
for (const page of [desktop, phone]) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => {
    try { const message = JSON.parse(String(payload)); if (message.snapshot) views.set(page, message.snapshot); }
    catch { /* Ignore non-snapshot frames. */ }
  }));
}
async function waitFor(page: Page, predicate: (snapshot: Snapshot) => boolean) {
  for (let i = 0; i < 100; i++) {
    const snapshot = views.get(page);
    if (snapshot && predicate(snapshot)) return snapshot;
    await page.waitForTimeout(100);
  }
  throw new Error("Timed out waiting for the projected game state");
}
async function shot(page: Page, label: string) {
  await page.screenshot({ path: `${out}/${label}.png`, fullPage: true });
  assert.deepEqual(await clippedElements(page), [], `${label}: clipped content`);
  assert.deepEqual(await smallTargets(page), [], `${label}: small targets`);
}
try {
  const response = await fetch(`${base}/api/developer/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ presetId: "s4.start" }) });
  assert.equal(response.status, 201);
  const run = await response.json() as CheckRun;
  const other = (run.initialSeat + 1) % 3;
  for (const [page, seat] of [[desktop, run.initialSeat], [phone, other]] as const) {
    await page.goto(base);
    await page.evaluate(({ run, seat }) => {
      localStorage.setItem("fate:developer:runs", JSON.stringify([run]));
      localStorage.setItem("fate:locale", "en");
      localStorage.setItem("fate:muted", "true");
      localStorage.setItem("fate:openings", JSON.stringify([JSON.stringify([run.scenarioId, run.sessionId, run.seats[seat].playerId])]));
    }, { run, seat });
    await page.goto(`${base}/developer/room/${run.seats[0].roomCode}/${seat}`);
    await waitFor(page, (snapshot) => snapshot.game?.sessionId === run.sessionId);
    const skip = page.getByRole("button", { name: "Skip", exact: true });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await page.locator(".s3-film").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  }
  const seen = new Set<number>();
  let advances = 0;
  while (seen.size < 10 && advances < 100) {
    const game = views.get(desktop)?.game;
    assert(game?.auction);
    const round = game.round;
    if (round >= 1 && round <= 10 && !seen.has(round)) {
      await desktop.locator(`[data-s4-transition="${round}"]`).waitFor();
      await phone.locator(`[data-s4-transition="${round}"]`).waitFor();
      assert.equal(await desktop.locator(`[data-house-rule="${game.auction.houseRule}"]`).count(), 1);
      assert.equal(await phone.locator(`[data-house-rule="${game.auction.houseRule}"]`).count(), 1);
      assert.equal(await desktop.locator(`[data-s4-transition="${round}"] summary`).count(), 1);
      if (round === 4) {
        for (const page of [desktop, phone]) {
          const card = page.locator(`[data-house-rule="${game.auction.houseRule}"] details`);
          assert.equal(await card.evaluate((element) => (element as HTMLDetailsElement).open), false);
          await card.getByText("View full rule").click();
          assert.equal(await card.evaluate((element) => (element as HTMLDetailsElement).open), true);
          assert.equal(await card.getByText("Collapse rule").isVisible(), true);
          await card.getByText("Collapse rule").click();
          assert.equal(await card.evaluate((element) => (element as HTMLDetailsElement).open), false);
        }
      }
      seen.add(round);
      if ([1, 4, 9, 10].includes(round)) {
        await shot(desktop, `round-${round}-1280`);
        await shot(phone, `round-${round}-390`);
        await phone.setViewportSize({ width: 320, height: 740 });
        await shot(phone, `round-${round}-320`);
        await phone.setViewportSize({ width: 390, height: 844 });
      }
      if (round === 9) {
        assert.equal(await desktop.locator("[data-s4-preliminary]").count(), 1);
        assert.equal(await phone.locator("[data-s4-preliminary]").count(), 1);
      }
      if (round === 4) {
        const tools = desktop.locator(".developer-tools");
        await tools.locator("summary").click();
        const before = views.get(desktop)!.game!.version;
        await desktop.locator("[data-house-rule-generate]").click();
        await waitFor(desktop, (snapshot) => !!snapshot.game && snapshot.game.version > before);
        assert.equal(views.get(desktop)!.game!.auction!.debugHouseRules?.preview?.order.length, 10);
        await desktop.locator("[data-house-rule-select]").selectOption(game.auction.houseRule!);
        await desktop.locator("[data-house-rule-activate]").click();
        await tools.locator("summary").click();
      }
    }
    if (seen.size === 10) break;
    const version = game.version;
    const advance = await fetch(`${base}/api/developer/rooms/${run.seats[0].roomCode}/advance`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionToken: run.seats[run.initialSeat].sessionToken }) });
    assert.equal(advance.status, 200, `advance at round ${round}: ${await advance.text()}`);
    await waitFor(desktop, (snapshot) => !!snapshot.game && snapshot.game.version > version);
    advances++;
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [1,2,3,4,5,6,7,8,9,10]);
  assert.deepEqual(errors, []);
  console.log(`House Rules R1–R10 browser walkthrough passed in ${advances} advances. Screenshots: ${out}`);
} finally {
  await browser.close();
}
