// Scenario 03 Timeline Dossier in real browsers against APP_URL: a real
// rewrite from the developer fixtures, the dossier opened from the top bar,
// original beside current, the comparison view, and the final archive's
// conditions linking back to their records. Layout checked at 1280/390/320.
//
//   node scripts/ui-dossier03.ts [--out /tmp/fate-dossier]
import { mkdirSync } from "node:fs";
import { chromium, type Locator, type Page } from "playwright";
import type { CheckRun } from "../src/shared/developer.ts";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const base = process.env.APP_URL ?? "http://localhost:8080";
const i = process.argv.indexOf("--out");
const out = i > 0 ? process.argv[i + 1] : "/tmp/fate-dossier";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const problems: string[] = [];

async function room(preset: string, width: number, locale = "en"): Promise<Page> {
  const res = await fetch(`${base}/api/developer/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ presetId: preset }) });
  const run = (await res.json()) as CheckRun;
  const p = await (await browser.newContext(width > 1000 ? { viewport: { width, height: 900 } } : { viewport: { width, height: width === 320 ? 640 : 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on("pageerror", (e) => problems.push(`${preset}@${width}: ${e.message}`));
  await p.goto(base);
  await p.evaluate(({ r, locale }) => { localStorage.setItem("fate:locale", locale); localStorage.setItem("fate:muted", "true"); localStorage.setItem("fate:developer:runs", JSON.stringify([r])); }, { r: run, locale });
  await p.goto(`${base}/developer/room/${run.seats[0].roomCode}/0`);
  await p.waitForTimeout(2500);
  return p;
}
async function layout(p: Page, label: string) {
  const clipped = await clippedElements(p);
  const small = await smallTargets(p);
  if (clipped.length) problems.push(`${label}: clipped ${JSON.stringify(clipped).slice(0, 240)}`);
  if (small.length) problems.push(`${label}: small ${JSON.stringify(small).slice(0, 240)}`);
  if (await p.evaluate(() => { const d = document.querySelector(".dossier"); return !!d && d.scrollWidth > d.clientWidth + 1; })) problems.push(`${label}: dossier overflows sideways`);
}
const text = (p: Page | Locator, sel: string) => p.locator(sel).first().innerText();

for (const width of [1280, 390, 320]) {
  // a real rewrite: the research worker saved in 1996
  const p = await room("s3.dossier-one", width, width === 390 ? "zh-CN" : "en");
  await p.locator(".dossier").waitFor({ timeout: 10_000 });
  const worker = p.locator('[data-record="worker"]');
  const status = await worker.locator(".dossier-status").innerText();
  const original = await text(worker, ".dossier-step.is-original b");
  const current = await text(worker, ".dossier-step.is-current b");
  if (original === current) problems.push(`@${width}: worker original equals current (${original})`);
  if (!/CHANGED|已改写/.test(status)) problems.push(`@${width}: worker not marked changed (${status})`);
  if (!(await worker.locator(".dossier-step.is-1996 .dossier-step-tag").count())) problems.push(`@${width}: intervention not on the chain`);
  // an undecided record names no decision: ??? or not yet reachable, and the same value on both sides
  const ji = p.locator('[data-record="ji"]');
  if (!(await ji.locator(".dossier-step.is-1996 .dossier-unknown").count())) problems.push(`@${width}: undecided record shows a decision`);
  if (await text(ji, ".dossier-step.is-original b") !== await text(ji, ".dossier-step.is-current b")) problems.push(`@${width}: unchanged record differs`);
  await worker.locator(".dossier-chain-head").click();
  await p.locator(".dossier-evidence").waitFor();
  await layout(p, `timeline@${width}`);
  await p.screenshot({ path: `${out}/timeline-${width}.png` });
  await p.getByRole("tab").nth(1).click();
  const first = p.locator(".dossier-diff").first();
  if (!(await first.getAttribute("class"))!.includes("is-changed")) problems.push(`@${width}: compare does not lead with the change`);
  await layout(p, `compare@${width}`);
  await p.screenshot({ path: `${out}/compare-${width}.png` });
  await p.context().close();
  console.log(`dossier@${width}: worker ${original} → ${current} (${status})`);
}

// final archive: conditions come from the server and link back to records
for (const width of [1280, 320]) {
  const p = await room("s3.archive", width);
  // the player's own way in: the Dossier button in the top bar
  await p.getByRole("button", { name: "Incident Zero Dossier" }).first().click();
  await p.locator(".dossier-histories").waitFor({ timeout: 10_000 });
  const cond = p.locator("button.dossier-cond").nth(2);
  await cond.click();
  await p.waitForTimeout(800);
  const focused = await p.locator(".dossier-chain.is-focused").getAttribute("data-record").catch(() => null);
  if (!focused) problems.push(`archive@${width}: a condition did not locate its record`);
  await layout(p, `archive@${width}`);
  await p.screenshot({ path: `${out}/archive-${width}.png` });
  console.log(`archive@${width}: condition located ${focused}`);
  await p.context().close();
}
// contradiction
const c = await room("s3.dossier-contra", 1280);
await c.locator(".dossier").waitFor();
if (!(await c.locator('[data-record="ji"] .dossier-status').innerText()).includes("CONTRADICTED")) problems.push("contradiction not shown");
await c.screenshot({ path: `${out}/contradiction-1280.png` });
await browser.close();
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log(`dossier checks passed; screenshots in ${out}`);
