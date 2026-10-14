// Plays ending cinematics in real browsers against the running app (APP_URL),
// from developer checkpoints that end a run through the real rules. For each
// film: it appears on its own, the score is a real recording (two decks, one
// audible), it reaches its card, hands over to the recap, and a refresh after
// watching goes straight to the recap. Phone widths check skip and the card.
//
//   node scripts/ui-endings.ts [--out /tmp/fate-endings] [--watch] [--phone 390]
//
// --watch lets each film run to its card instead of skipping after the check.
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import type { CheckRun } from "../src/shared/developer.ts";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const base = process.env.APP_URL ?? "http://localhost:8080";
const out = arg("out", "/tmp/fate-endings");
const watch = process.argv.includes("--watch");
const phoneWidths = [390, 320];
mkdirSync(out, { recursive: true });

/** preset → the seat whose film to watch (the first seat that gets it) */
const FILMS = [
  { preset: "s1.ending", film: "s01_ticket_true_end", phone: false },
  { preset: "s2.ending", film: "s02_last_light", phone: true },
  { preset: "s3.deceive", film: "s03_deceive_history", phone: false },
  { preset: "s4.debt", film: "s04_debt_follows", phone: true },
] as const;

const browser = await chromium.launch();
const problems: string[] = [];
type Probe = Window & { musicMedia: HTMLAudioElement[] };

async function open(run: CheckRun, seat: number, width: number): Promise<Page> {
  const context = await browser.newContext(width >= 1000 ? { viewport: { width, height: 800 } } : { viewport: { width, height: width === 320 ? 640 : 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await context.newPage();
  p.on("pageerror", (e) => problems.push(`${run.presetId}@${width}: ${e.message}`));
  await p.addInitScript(() => {
    const Native = window.Audio;
    const media: HTMLAudioElement[] = [];
    Object.assign(window, { musicMedia: media });
    window.Audio = class extends Native { constructor() { super(); media.push(this); } };
  });
  await p.goto(base);
  await p.evaluate((r) => { localStorage.setItem("fate:locale", "en"); localStorage.setItem("fate:muted", "false"); localStorage.setItem("fate:developer:runs", JSON.stringify([r])); }, run);
  await p.goto(`${base}/developer/room/${run.seats[0].roomCode}/${seat}`);
  return p;
}
async function layout(p: Page, label: string) {
  const clipped = await clippedElements(p);
  const small = await smallTargets(p);
  if (clipped.length) problems.push(`${label}: clipped ${JSON.stringify(clipped).slice(0, 240)}`);
  if (small.length) problems.push(`${label}: small targets ${JSON.stringify(small).slice(0, 240)}`);
  const overflow = await p.evaluate(() => document.querySelector(".end-film")!.scrollWidth > window.innerWidth + 1);
  if (overflow) problems.push(`${label}: horizontal overflow in the film`);
}

for (const { preset, film, phone } of FILMS) {
  const res = await fetch(`${base}/api/developer/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ presetId: preset }) });
  if (!res.ok) throw new Error(`${preset}: ${res.status}`);
  const run = (await res.json()) as CheckRun;
  // find a seat whose own ending is this film
  let seat = -1;
  let p: Page | null = null;
  for (let i = 0; i < run.seats.length && seat < 0; i++) {
    const page = await open(run, i, 1280);
    const el = page.locator("[data-ending]");
    await el.waitFor({ timeout: 15_000 }).catch(() => {});
    if ((await el.getAttribute("data-ending").catch(() => null)) === film) { seat = i; p = page; }
    else await page.context().close();
  }
  if (!p) { problems.push(`${preset}: no seat played ${film}`); continue; }
  const label = `${film}@1280`;
  // a gesture unlocks audio, as a player's earlier clicks would
  await p.mouse.click(5, 400);
  const t0 = Date.now();
  await p.waitForFunction(() => (window as unknown as Probe).musicMedia.some((m) => !m.paused && m.currentTime > .1), undefined, { timeout: 15_000 }).catch(() => problems.push(`${label}: no music playing`));
  await p.waitForTimeout(3000);
  const decks = await p.evaluate(() => (window as unknown as Probe).musicMedia.map((m) => ({ src: m.currentSrc.split("/").pop(), playing: !m.paused })));
  if (decks.length !== 2 || decks.filter((d) => d.playing).length !== 1) problems.push(`${label}: decks ${JSON.stringify(decks)}`);
  await p.screenshot({ path: `${out}/${film}-desktop-scene.png` });
  await layout(p, label);
  if (await p.locator("[data-ending-poster]").count()) problems.push(`${label}: the recap showed before the film ended`);
  if (watch) {
    await p.locator('[data-scene="card"]').waitFor({ timeout: 60_000 });
    console.log(`${film}: card after ${((Date.now() - t0) / 1000).toFixed(1)} s · music ${decks.find((d) => d.playing)?.src}`);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/${film}-desktop-card.png` });
    await p.locator("[data-ending]").waitFor({ state: "detached", timeout: 20_000 });
    console.log(`${film}: handed over after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } else {
    await p.getByRole("button", { name: "Skip Ending" }).click();
    await p.locator("[data-ending]").waitFor({ state: "detached", timeout: 5000 });
    console.log(`${film}: skipped · music ${decks.find((d) => d.playing)?.src}`);
  }
  await p.locator("[data-ending-poster]").waitFor({ timeout: 10_000 }).catch(() => problems.push(`${label}: no recap after the film`));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${film}-desktop-recap.png`, fullPage: true });
  if (await p.locator("[data-ending]").count()) problems.push(`${label}: film still mounted after handoff`);
  // a refresh after watching goes straight to the recap
  await p.reload();
  await p.waitForTimeout(4000);
  if (await p.locator("[data-ending]").count()) problems.push(`${label}: film replayed after refresh`);
  if (!(await p.locator("[data-ending-poster]").count())) problems.push(`${label}: refresh did not land on the recap`);
  await p.context().close();

  if (phone) for (const width of phoneWidths) {
    const q = await open(run, seat, width);
    // a fresh browser: this viewer hasn't watched it here, so it plays
    await q.locator("[data-ending]").waitFor({ timeout: 15_000 });
    await q.waitForTimeout(2600);
    await layout(q, `${film}@${width}`);
    const skip = q.getByRole("button", { name: "Skip Ending" });
    const box = await skip.boundingBox();
    if (!box || box.y < 0 || box.x + box.width > width) problems.push(`${film}@${width}: skip off screen`);
    await q.screenshot({ path: `${out}/${film}-phone${width}-scene.png` });
    await q.locator('[data-scene="card"]').waitFor({ timeout: 60_000 });
    await q.waitForTimeout(2500);
    await layout(q, `${film}@${width} card`);
    await q.screenshot({ path: `${out}/${film}-phone${width}-card.png` });
    await skip.click();
    await q.context().close();
  }
}
await browser.close();
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log(`ending films played; screenshots in ${out}`);
