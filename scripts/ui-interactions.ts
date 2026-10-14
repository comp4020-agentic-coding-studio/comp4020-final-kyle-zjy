// Clicks through the two confirmations that guard irreversible choices, in a
// real browser against the running app: scenario 02's two-step boarding, and
// scenario 04's press-and-hold sealed bid (a short press must not lock).
//
//   node scripts/ui-interactions.ts [--out /tmp/fate-interactions]
//
// Needs the app running (APP_URL) and Playwright's Chromium.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import type { CheckRun } from "../src/shared/developer.ts";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = process.env.APP_URL ?? "http://localhost:8080";
const out = arg("out", "/tmp/fate-interactions");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const errors: string[] = [];

async function open(presetId: string, seatOf: (run: CheckRun) => number): Promise<{ page: Page; run: CheckRun }> {
  const res = await fetch(`${base}/api/developer/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ presetId }) });
  assert.ok(res.ok, `${presetId}: ${res.status}`);
  const run = (await res.json()) as CheckRun;
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  page.on("pageerror", (e) => errors.push(`${presetId}: ${e}`));
  await page.goto(base);
  await page.evaluate((run) => { localStorage.setItem("fate:locale", "en"); localStorage.setItem("fate:muted", "true"); localStorage.setItem("fate:developer:runs", JSON.stringify([run])); }, run);
  await page.goto(`${base}/developer/room/${run.seats[0].roomCode}/${seatOf(run)}`);
  await page.waitForTimeout(2500);
  return { page, run };
}

const only = process.argv.includes("--s4") ? "s4" : process.argv.includes("--s2") ? "s2" : null;
// Scenario 02: Board asks again before it is sent; confirming leaves the city.
if (only !== "s4") {
  const { page, run } = await open("s2.boarding", (r) => r.initialSeat);
  // the boarding window goes to pass holders; find a seat that has it
  let found = false;
  for (let seat = 0; seat < run.seats.length && !found; seat++) {
    await page.goto(`${base}/developer/room/${run.seats[0].roomCode}/${seat}`);
    await page.waitForTimeout(2000);
    const board = page.getByRole("button", { name: /^Board/ }).first();
    if (!(await board.count())) continue;
    found = true;
    await board.click();
    await page.getByRole("button", { name: /Board now|Confirm/ }).first().waitFor({ timeout: 4000 });
    await page.screenshot({ path: `${out}/s2-confirm.png`, fullPage: true });
    // backing out returns to the choice without sending anything
    await page.getByRole("button", { name: /Not yet/ }).first().click();
    await board.waitFor({ timeout: 4000 });
    await board.click();
    await page.getByRole("button", { name: /Board now|Confirm/ }).first().click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/s2-aboard.png`, fullPage: true });
  }
  assert.ok(found, "no seat was offered boarding");
  console.log("s2 boarding: confirm step shown, back-out works, confirm sends");
}

// Scenario 04: a short press doesn't lock the bid; holding does, and it stays locked.
if (only !== "s2") {
  const { page } = await open("s4.final-bid", (r) => r.initialSeat);
  const lock = page.locator("[data-final-submit]").first();
  // the final stage stages its host lines before the form appears
  await lock.waitFor({ timeout: 15000 });
  await lock.scrollIntoViewIfNeeded();
  // real PointerEvents straight on the element: the button re-renders every frame while held
  const fire = (type: string) => lock.evaluate((el, type) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, isPrimary: true, button: 0 })), type);
  const press = async (ms: number) => {
    await fire("pointerdown");
    await page.waitForTimeout(ms);
    if (await lock.count()) await fire("pointerup");
  };
  await press(200);
  await page.waitForTimeout(800);
  assert.equal(await page.locator("[data-final-locked]").count(), 0, "a 200 ms press locked the bid");
  assert.equal(await lock.getAttribute("data-hold-progress"), "0.00", "a released short press left progress behind");
  await press(1100);
  await page.locator("[data-final-locked]").waitFor({ timeout: 5000 });
  await page.screenshot({ path: `${out}/s4-locked.png`, fullPage: true });
  assert.equal(await page.locator("[data-final-submit]").count(), 0, "the bid button is still there after locking");
  console.log("s4 sealed bid: short press ignored, hold locks");
}

await browser.close();
if (errors.length) { console.log("page errors:\n" + errors.join("\n")); process.exitCode = 1; }
console.log(`screenshots in ${out}`);
