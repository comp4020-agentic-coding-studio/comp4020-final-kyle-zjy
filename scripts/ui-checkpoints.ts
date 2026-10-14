// Opens developer checkpoints (src/shared/developer.ts) in two isolated
// browsers, a 390 px phone and a 1280 px desktop on different seats, and
// screenshots each one, failing on clipped content or touch targets under
// 48 px. For checking a scenario's late screens without playing up to them.
//
//   node scripts/ui-checkpoints.ts s1.locks s1.nameless [--out /tmp/fate-cp] [--phone 320] [--zh]
//
// Needs the app running (APP_URL) and Playwright's Chromium.
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import type { CheckRun } from "../src/shared/developer.ts";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = process.env.APP_URL ?? "http://localhost:8080";
const out = arg("out", "/tmp/fate-checkpoints");
const phoneWidth = Number(arg("phone", "390"));
const locale = process.argv.includes("--zh") ? "zh-CN" : "en";
const presets = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && !all[i - 1]?.startsWith("--"));
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const phone = await (await browser.newContext({ viewport: { width: phoneWidth, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const desk = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors: string[] = [];
for (const p of [phone, desk]) p.on("pageerror", (e) => errors.push(String(e)));
const problems: string[] = [];

async function check(p: Page, label: string) {
  await p.screenshot({ path: `${out}/${label}.png`, fullPage: true });
  const clipped = await clippedElements(p);
  const small = await smallTargets(p);
  if (clipped.length) problems.push(`${label}: clipped ${JSON.stringify(clipped).slice(0, 300)}`);
  if (small.length) problems.push(`${label}: small targets ${JSON.stringify(small).slice(0, 300)}`);
}

for (const id of presets) {
  const res = await fetch(`${base}/api/developer/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ presetId: id }) });
  if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
  const run = (await res.json()) as CheckRun;
  const seats: [Page, number, string][] = [[desk, run.initialSeat, "desktop"], [phone, (run.initialSeat + 1) % run.seats.length, `phone${phoneWidth}`]];
  for (const [p, seat, tag] of seats) {
    await p.goto(base);
    await p.evaluate(({ run, locale }) => {
      localStorage.setItem("fate:locale", locale);
      localStorage.setItem("fate:muted", "true");
      localStorage.setItem("fate:developer:runs", JSON.stringify([run]));
    }, { run, locale });
    await p.goto(`${base}/developer/room/${run.seats[0].roomCode}/${seat}`);
    await p.waitForTimeout(1500);
    // an opening film on a .start checkpoint: skip it
    const skip = p.getByRole("button", { name: /^(Skip|跳过)/ });
    if (await skip.count()) { await p.waitForTimeout(2200); await skip.first().click().catch(() => {}); await p.waitForTimeout(2200); }
    await p.waitForTimeout(1800);
    await check(p, `${id}-${tag}`);
  }
}
await browser.close();
if (errors.length) console.log("page errors:\n" + errors.join("\n"));
if (problems.length) { console.log(problems.join("\n")); process.exitCode = 1; }
console.log(`checked ${presets.join(", ")}; screenshots in ${out}`);
