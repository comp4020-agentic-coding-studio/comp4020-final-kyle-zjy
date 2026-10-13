// Focused real-browser walkthrough of the Scenario 04 item sandbox and private effects.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import type { CheckRun } from "../src/shared/developer.ts";
import type { Snapshot } from "../src/shared/protocol.ts";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const base = process.env.APP_URL ?? "http://127.0.0.1:8080";
const out = "/tmp/fate-s04-pool-ui";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const contexts = await Promise.all([
  browser.newContext({ viewport: { width: 1280, height: 900 } }),
  browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" }),
]);
const [desk, phone] = await Promise.all(contexts.map((context) => context.newPage()));
const views = new Map<Page, Snapshot>();
const errors: string[] = [];
for (const page of [desk, phone]) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => {
    try { const message = JSON.parse(String(payload)); if (message.snapshot) views.set(page, message.snapshot); }
    catch { /* Ignore non-snapshot protocol frames. */ }
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
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  assert.deepEqual(await clippedElements(page), [], `${name}: clipped content`);
  assert.deepEqual(await smallTargets(page), [], `${name}: small touch targets`);
}
async function launch(presetId: CheckRun["presetId"]) {
  const response = await fetch(`${base}/api/developer/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ presetId }) });
  assert.equal(response.status, 201);
  const run = await response.json() as CheckRun;
  const other = presetId === "s4.blackjack" ? (run.initialSeat === 0 ? 1 : 0) : (run.initialSeat + 1) % 3;
  for (const [page, seat] of [[desk, run.initialSeat], [phone, other]] as const) {
    await page.goto(base);
    await page.evaluate((data) => {
      localStorage.setItem("fate:developer:runs", JSON.stringify([data.run]));
      localStorage.setItem("fate:locale", "en");
      localStorage.setItem("fate:muted", "true");
      localStorage.setItem("fate:openings", JSON.stringify([JSON.stringify([data.run.scenarioId, data.run.sessionId, data.run.seats[data.seat].playerId])]));
    }, { run, seat });
    await page.goto(`${base}/developer/room/${run.seats[0].roomCode}/${seat}`);
    await waitFor(page, (snapshot) => snapshot.game?.sessionId === run.sessionId && snapshot.game.viewerId === run.seats[seat].playerId);
    const skip = page.getByRole("button", { name: "Skip", exact: true });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await page.locator(".s3-film").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  }
  return run;
}
async function grant(lotId: string, fake: boolean) {
  const prior = views.get(desk)!.game!.version;
  const tools = desk.locator(".developer-tools");
  if (!await tools.getAttribute("open")) await tools.locator("summary").click();
  await tools.locator("select").selectOption(lotId);
  await tools.getByRole("button", { name: fake ? "Fake" : "Genuine", exact: true }).click();
  await tools.getByRole("button", { name: /Add to my inventory/i }).click();
  await waitFor(desk, (snapshot) => snapshot.game!.version > prior);
  await tools.locator("summary").click();
  const items = views.get(desk)!.game!.auction!.players[views.get(desk)!.game!.viewerId].items;
  return items.at(-1)!;
}
async function use(itemId: string) {
  await desk.locator('[data-action="USE_LOT"]').click();
  await desk.locator(`[data-s4-item="${itemId}"]`).click();
}

try {
  const run = await launch("s4.auction");
  const own = run.seats[run.initialSeat].playerId;
  const other = run.seats[(run.initialSeat + 1) % 3].playerId;
  const first = views.get(desk)!.game!;
  assert.equal(Object.hasOwn(first.auction!, "lotOrder"), false);
  assert.equal(Object.hasOwn(first.auction!, "counterfeitLots"), false);
  assert.equal(first.auction!.debugPool!.order.length, 9);
  assert.equal(new Set(first.auction!.debugPool!.order).size, 9);
  assert.equal(first.auction!.debugPool!.counterfeit.length, 2);
  assert.equal(first.auction!.debugPool!.order.includes("LOT_10"), false);
  assert.equal(views.get(phone)!.game!.auction!.players[own].privateObservations, null);
  await shot(desk, "auction-1280");
  await shot(phone, "auction-390");
  await phone.setViewportSize({ width: 320, height: 740 });
  await shot(phone, "auction-320");
  await phone.setViewportSize({ width: 390, height: 844 });

  await desk.locator(".developer-tools > summary").click();
  await shot(desk, "sandbox-1280");
  await phone.locator(".developer-tools > summary").click();
  await shot(phone, "sandbox-390");
  await phone.setViewportSize({ width: 320, height: 740 });
  await shot(phone, "sandbox-320");
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.locator(".developer-tools > summary").click();
  await desk.locator(".developer-tools > summary").click();

  const fake = await grant("LOT_11", true);
  const before = views.get(desk)!.game!.version;
  await use(fake);
  await waitFor(desk, (snapshot) => snapshot.game!.version > before);
  assert.equal(views.get(desk)!.game!.auction!.players[own].itemNotice?.result, "COUNTERFEIT");
  assert.equal(views.get(phone)!.game!.auction!.players[own].itemNotice, null);
  await desk.getByRole("alert").filter({ hasText: /counterfeit/i }).waitFor();
  await shot(desk, "counterfeit-private-1280");
  assert.equal(await phone.getByRole("alert").filter({ hasText: /counterfeit/i }).count(), 0);

  const number = await grant("LOT_18", false);
  await desk.locator('[data-action="USE_LOT"]').click();
  await desk.setViewportSize({ width: 390, height: 844 }); await shot(desk, "item-picker-390");
  await desk.setViewportSize({ width: 320, height: 740 }); await shot(desk, "item-picker-320");
  await desk.setViewportSize({ width: 1280, height: 900 });
  await desk.locator(`[data-s4-picker="USE_LOT"]`).getByRole("button", { name: run.seats[(run.initialSeat + 1) % 3].nickname }).first().click();
  await waitFor(desk, (snapshot) => !snapshot.game!.auction!.players[own].items.includes(number));
  assert.equal(views.get(desk)!.game!.auction!.players[own].privateObservations?.at(-1)?.kind, "CHIP_BAND");
  assert.equal(views.get(phone)!.game!.auction!.players[own].privateObservations, null);
  assert.equal(views.get(phone)!.game!.auction!.players[other].privateObservations?.length ?? 0, 0);
  await desk.locator(".developer-tools > summary").click();
  await desk.getByRole("button", { name: "Inspect private cards" }).click();
  await desk.setViewportSize({ width: 390, height: 844 }); await shot(desk, "private-intel-390");
  await desk.setViewportSize({ width: 320, height: 740 }); await shot(desk, "private-intel-320");
  await desk.setViewportSize({ width: 1280, height: 900 });
  await desk.keyboard.press("Escape");
  await desk.getByRole("button", { name: "Generate Random 9 Lots" }).click();
  await waitFor(desk, (snapshot) => !!snapshot.game!.auction!.debugPool?.preview);
  await shot(desk, "pool-preview-1280");

  const ledgerRun = await launch("s4.auction");
  const ledgerOwner = ledgerRun.seats[ledgerRun.initialSeat].playerId;
  await grant("LOT_25", false);
  const ledgerBefore = views.get(desk)!.game!.auction!.players[ledgerOwner];
  await desk.locator('[data-action="BORROW"]').click();
  await waitFor(desk, (snapshot) => snapshot.game!.auction!.players[ledgerOwner].debt > ledgerBefore.debt);
  const ledgerAfter = views.get(desk)!.game!.auction!.players[ledgerOwner];
  assert.equal(ledgerAfter.blackChips! - ledgerBefore.blackChips!, 3);
  assert.equal(ledgerAfter.debt - ledgerBefore.debt, 2);
  await shot(desk, "night-ledger-1280");

  const watchRun = await launch("s4.auction");
  const watchOwner = watchRun.seats[watchRun.initialSeat].playerId;
  const watch = await grant("LOT_17", false);
  await desk.locator('[data-action="PASS"]').click();
  await waitFor(desk, (snapshot) => snapshot.game!.auction!.passedPlayers.includes(watchOwner));
  await desk.locator('[data-action="END_TURN"]').click();
  await waitFor(desk, (snapshot) => snapshot.game!.auction!.turnPlayerId !== watchOwner);
  await desk.locator('[data-action="USE_LOT"]').click();
  await desk.locator('[data-s4-picker="USE_LOT"]').getByRole("button", { name: "1", exact: true }).click();
  await waitFor(desk, (snapshot) => snapshot.game!.auction!.currentBidder === watchOwner);
  assert.equal(views.get(desk)!.game!.auction!.passedPlayers.includes(watchOwner), false);
  assert.equal(views.get(desk)!.game!.auction!.players[watchOwner].items.includes(watch), false);
  await shot(desk, "stopwatch-rejoin-1280");

  const matchRun = await launch("s4.exit");
  const matchOwner = matchRun.seats[matchRun.initialSeat].playerId;
  const match = await grant("LOT_30", false);
  const sacrifice = await grant("LOT_02", false);
  await desk.locator(`[data-final-item="${match}"]`).getByRole("button", { name: "USE" }).click();
  await desk.locator(`[data-final-item="${match}"]`).getByRole("button", { name: /Glass Eye/ }).click();
  await waitFor(desk, (snapshot) => !!snapshot.game!.auction!.players[matchOwner].finalItemModifiers?.length);
  const final = views.get(desk)!.game!.auction!;
  assert.equal(final.players[matchOwner].items.includes(sacrifice), false);
  assert.equal(final.players[matchOwner].finalItemModifiers?.[0].amount, 3);
  await shot(desk, "last-match-1280");
  await desk.setViewportSize({ width: 390, height: 844 }); await shot(desk, "last-match-390");
  await desk.setViewportSize({ width: 320, height: 740 }); await shot(desk, "last-match-320");
  await desk.setViewportSize({ width: 1280, height: 900 });

  const cardsRun = await launch("s4.blackjack");
  const cardOwner = cardsRun.seats[cardsRun.initialSeat].playerId;
  const burnt = await grant("LOT_27", false);
  for (let hit = 0; hit < 12 && !views.get(desk)!.game!.auction!.challenge?.bust; hit++) {
    const previous = views.get(desk)!.game!.version;
    await desk.getByRole("button", { name: /^hit$/i }).first().click();
    await waitFor(desk, (snapshot) => snapshot.game!.version > previous);
  }
  assert.equal(views.get(desk)!.game!.auction!.challenge!.bust?.playerId, cardOwner);
  await shot(desk, "burnt-card-bust-1280");
  await phone.setViewportSize({ width: 390, height: 844 }); await shot(phone, "burnt-card-bust-390");
  await desk.getByRole("button", { name: /Burn the last card/i }).first().click();
  await phone.getByRole("button", { name: /^continue$/i }).first().click();
  await waitFor(desk, (snapshot) => !snapshot.game!.auction!.players[cardOwner].items.includes(burnt));
  const replacement = views.get(desk)!.game!.auction!.challenge?.burntReplacement;
  assert(replacement);
  assert.notEqual(replacement.discarded, undefined);
  assert.notEqual(replacement.replacement, undefined);
  await shot(desk, "burnt-card-replacement-1280");
  await phone.setViewportSize({ width: 320, height: 740 }); await shot(phone, "burnt-card-replacement-320");

  assert.deepEqual(errors, []);
  console.log(`Scenario 04 pool browser walkthrough passed. Screenshots: ${out}`);
} catch (error) {
  console.error(errors);
  await desk.screenshot({ path: `${out}/failure-1280.png`, fullPage: true }).catch(() => {});
  await phone.screenshot({ path: `${out}/failure-390.png`, fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
