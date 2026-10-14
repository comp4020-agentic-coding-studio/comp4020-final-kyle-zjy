// The first-view bubble guide in real browsers against APP_URL: it starts on
// its own in a mid-game room, every note points at a visible region with its
// bubble on screen, notes advance by themselves, Skip clears it, and a reload
// doesn't replay it. S01 desktop, S02 390 px, S03 320 px, S04 desktop.
//
//   node scripts/ui-guide.ts [--out /tmp/fate-guide]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import type { CheckRun } from "../src/shared/developer.ts";
import { smallTargets } from "./lib/layout-check.ts";

const base = process.env.APP_URL ?? "http://localhost:8080";
const i = process.argv.indexOf("--out");
const out = i > 0 ? process.argv[i + 1] : "/tmp/fate-guide";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const problems: string[] = [];

for (const [preset, width, steps] of [["s1.anchors", 1280, 6], ["s2.parts", 390, 6], ["s3.jump", 320, 6], ["s4.auction", 1280, 6]] as const) {
  const run = (await (await fetch(`${base}/api/developer/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ presetId: preset }) })).json()) as CheckRun;
  const p = await (await browser.newContext(width > 1000 ? { viewport: { width, height: 800 } } : { viewport: { width, height: width === 320 ? 640 : 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on("pageerror", (e) => problems.push(`${preset}: ${e.message}`));
  await p.goto(base);
  await p.evaluate((r) => { localStorage.clear(); localStorage.setItem("fate:locale", "en"); localStorage.setItem("fate:muted", "true"); localStorage.setItem("fate:developer:runs", JSON.stringify([r])); }, run);
  await p.goto(`${base}/developer/room/${run.seats[0].roomCode}/0`);
  const seen: string[] = [];
  await p.locator(".bubble-guide-bubble").waitFor({ timeout: 15_000 }).catch(() => problems.push(`${preset}: guide did not start`));
  for (let n = 0; n < steps; n++) {
    const step = await p.locator("[data-guide-step]").getAttribute("data-guide-step").catch(() => null);
    if (!step) break;
    await p.waitForTimeout(500);
    const geo = await p.evaluate(() => {
      const b = document.querySelector(".bubble-guide-bubble")!.getBoundingClientRect();
      const r = document.querySelector(".bubble-guide-ring")?.getBoundingClientRect();
      return { b: [b.left, b.top, b.right, b.bottom], ring: r ? [r.left, r.top, r.width, r.height] : null, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth };
    });
    if (geo.b[0] < 0 || geo.b[2] > geo.vw + 0.5 || geo.b[1] < 0 || geo.b[3] > geo.vh + 0.5) problems.push(`${preset}/${step}: bubble off screen ${geo.b.map(Math.round)}`);
    if (!geo.ring || geo.ring[2] < 4) problems.push(`${preset}/${step}: no highlighted region`);
    if (geo.sw > geo.vw) problems.push(`${preset}/${step}: horizontal overflow`);
    const small = (await smallTargets(p)).filter((s) => /Skip|Next|Got it/.test(JSON.stringify(s)));
    if (small.length) problems.push(`${preset}/${step}: small guide button`);
    if (!seen.includes(step)) { seen.push(step); await p.screenshot({ path: `${out}/${preset}-${width}-${seen.length}-${step}.png` }); }
    if (n === 3 && preset === "s4.auction") break;
    await p.waitForFunction((s) => document.querySelector("[data-guide-step]")?.getAttribute("data-guide-step") !== s, step, { timeout: 4000 }).catch(() => problems.push(`${preset}/${step}: did not advance`));
  }
  // skip clears it; a reload in the same run doesn't bring it back
  const skip = p.getByRole("button", { name: "Skip", exact: true });
  if (await skip.count()) await skip.click();
  await p.waitForTimeout(400);
  if (await p.locator(".bubble-guide").count()) problems.push(`${preset}: overlay left after the end`);
  await p.reload(); await p.waitForTimeout(3500);
  if (await p.locator(".bubble-guide").count()) problems.push(`${preset}: replayed after reload`);
  // the ? button replays it
  await p.getByRole("button", { name: "Replay the screen tour" }).click();
  await p.locator(".bubble-guide-bubble").waitFor({ timeout: 3000 }).catch(() => problems.push(`${preset}: replay button failed`));
  console.log(`${preset}@${width}: ${seen.join(" → ")}`);
  await p.context().close();
}
await browser.close();
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log(`guide checks passed; screenshots in ${out}`);
