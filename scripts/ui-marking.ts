// The marking setup in real browsers against APP_URL: one session at
// 1920×1080 and one at 390×844, on screen at the same time, in separate
// contexts (no shared cookies or storage). For each scenario a prepared room
// opens in both; a move made in the desktop session must show in the phone
// session within about a second, with no clipped content or targets under
// 48 px at either size. Screenshots of every screen land in --out.
//
//   node scripts/ui-marking.ts [--out /tmp/fate-marking]
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import type { CheckRun } from "../src/shared/developer.ts";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const base = process.env.APP_URL ?? "http://localhost:8080";
const i = process.argv.indexOf("--out");
const out = i > 0 ? process.argv[i + 1] : "/tmp/fate-marking";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const problems: string[] = [];

async function open(viewport: { width: number; height: number }, mobile: boolean, run: CheckRun, seat: number): Promise<Page> {
  const p = await (await browser.newContext({ viewport, ...(mobile ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) })).newPage();
  p.on("pageerror", (e) => problems.push(`${viewport.width}: ${e.message}`));
  await p.goto(base);
  // the guide has its own check (ui-guide.ts); mark it seen so it doesn't cover the screen
  await p.evaluate((r) => {
    localStorage.clear();
    localStorage.setItem("fate:locale", "en");
    localStorage.setItem("fate:muted", "true");
    for (const s of ["S01_LAST_TRAIN", "S02_SUNKEN_CITY", "S03_INCIDENT_ZERO", "S04_UNDERGROUND_AUCTION"]) localStorage.setItem(`fate:guide:${s}`, "1");
    localStorage.setItem("fate:developer:runs", JSON.stringify([r]));
  }, run);
  await p.goto(`${base}/developer/room/${run.seats[seat].roomCode}/${seat}`);
  await p.locator('[data-action="END_TURN"]').first().waitFor({ timeout: 20_000 });
  await p.waitForTimeout(800);
  return p;
}

async function layout(p: Page, label: string) {
  const clipped = await clippedElements(p);
  if (clipped.length) problems.push(`${label}: clipped ${clipped.join(", ")}`);
  const small = await smallTargets(p);
  if (small.length) problems.push(`${label}: small targets ${small.join(", ")}`);
}

/** The text of the turn banner, which names whose turn it is. */
const banner = (p: Page) => p.evaluate(() => document.body.innerText.match(/(\w+)'s turn|Your turn/)?.[0] ?? "");

for (const preset of ["s1.anchors", "s2.parts", "s3.jump", "s4.auction"] as const) {
  const run = (await (await fetch(`${base}/api/developer/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ presetId: preset }) })).json()) as CheckRun;
  // the desktop takes the seat whose turn it is; the phone watches from another
  const active = run.initialSeat;
  const desk = await open({ width: 1920, height: 1080 }, false, run, active);
  const phone = await open({ width: 390, height: 844 }, true, run, (active + 1) % run.seats.length);
  await desk.screenshot({ path: `${out}/${preset}-1920.png` });
  await phone.screenshot({ path: `${out}/${preset}-390.png` });
  await layout(desk, `${preset}@1920`);
  await layout(phone, `${preset}@390`);

  // the desktop player ends their turn; the phone sees the turn hand over without a reload
  const before = await banner(phone);
  const t0 = Date.now();
  await desk.locator('[data-action="END_TURN"]').first().click();
  const changed = await phone.waitForFunction((b) => {
    const now = document.body.innerText.match(/(\w+)'s turn|Your turn/)?.[0] ?? "";
    return now !== b;
  }, before, { timeout: 3000 }).then(() => true).catch(() => false);
  const ms = Date.now() - t0;
  if (!changed) problems.push(`${preset}: the phone did not see the turn change`);
  else if (ms > 1500) problems.push(`${preset}: the phone saw the turn change after ${ms} ms`);
  await phone.screenshot({ path: `${out}/${preset}-390-after.png` });
  console.log(`${preset}: 1920 + 390 open together; turn change reached the phone in ${ms} ms (from "${before}" to "${await banner(phone)}")`);
  await desk.context().close();
  await phone.context().close();
}

await browser.close();
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`marking checks passed; screenshots in ${out}`);
