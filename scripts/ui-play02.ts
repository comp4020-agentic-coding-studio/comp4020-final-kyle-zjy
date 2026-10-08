// Plays a two-browser scenario 02 run (the sinking city) from the lobby to
// the results, for checking its screens in a real browser.
//
//   node scripts/ui-play02.ts [--out /tmp/fate-play02] [--phone 390]
//
// The host picks scenario 02 in the lobby; both choose characters and set
// out. On each turn a player moves once (from the dock's picker), searches
// once, then ends the turn; decisions take their first option; scenes are
// acknowledged. Nobody fixes the boat, so the run ends when the water takes
// the city. Each kind of screen is photographed once and checked for content
// clipped past the edge and touch targets under 48 px; the run fails on any.
import { mkdirSync } from "node:fs";
import { chromium, type Locator, type Page } from "playwright";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = process.env.APP_URL ?? "http://localhost:8080";
const out = arg("out", "/tmp/fate-play02");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const phone = await (await browser.newContext({ viewport: { width: Number(arg("phone", "390")), height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const desk = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pages: [Page, string][] = [
  [phone, "phone"],
  [desk, "desktop"],
];
const errors: string[] = [];
for (const [p] of pages) p.on("pageerror", (e) => errors.push(String(e)));
const layout: string[] = [];

async function tap(l: Locator): Promise<boolean> {
  try {
    await l.click({ timeout: 2500 });
    return true;
  } catch {
    return false;
  }
}

const seen = new Set<string>();
async function shotOnce(p: Page, tag: string, label: string) {
  const key = `${label}-${tag}`;
  if (seen.has(key)) return;
  seen.add(key);
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/${key}.png` });
  const clipped = await clippedElements(p);
  if (clipped.length) layout.push(`${key}: clipped ${clipped.join(", ")}`);
  const small = await smallTargets(p);
  if (small.length) layout.push(`${key}: small targets ${small.join(", ")}`);
}

async function pick(p: Page, sign: string, type: RegExp) {
  await p.getByRole("button", { name: "Choose character" }).click();
  await p.getByRole("button", { name: sign, exact: true }).click();
  await p.getByRole("button", { name: `Choose ${sign}` }).click();
  await p.getByRole("button", { name: type }).click();
  await p.getByRole("button", { name: new RegExp(`Reveal ${sign}`) }).click();
  await p.getByRole("button", { name: "Skip" }).click();
  await p.getByRole("button", { name: "I'm ready" }).click();
}

// the lobby: create, join, the host picks scenario 02
await phone.goto(base);
await phone.getByRole("button", { name: "Create room" }).click();
await phone.getByLabel("Your name on the ticket").fill("Kyle");
await phone.getByRole("dialog").getByRole("button", { name: "Create room" }).click();
await phone.waitForURL(/\/room\/[A-Z0-9]{6}$/);
const code = phone.url().slice(-6);
await desk.goto(`${base}/room/${code}`);
await desk.getByLabel("Your name on the ticket").fill("Bea");
await desk.getByRole("dialog").getByRole("button", { name: "Join room" }).click();
await phone.getByRole("button", { name: /^02/ }).click();
await desk.getByText("The Sunken City", { exact: false }).first().waitFor({ timeout: 10_000 });
await shotOnce(phone, "phone", "lobby-02");
await shotOnce(desk, "desktop", "lobby-02");
await pick(phone, "Scorpio", /ENTP/);
await pick(desk, "Pisces", /ISFJ/);
await phone.getByRole("button", { name: "Depart" }).click();
await Promise.all(pages.map(([p]) => p.getByRole("button", { name: "Into the water" }).waitFor({ timeout: 20_000 })));
await phone.waitForTimeout(6000);
for (const [p, tag] of pages) await shotOnce(p, tag, "intro");
for (const [p] of pages) await tap(p.getByRole("button", { name: "Into the water" }));

const done = async (p: Page) => (await p.getByRole("button", { name: "Leave for the platform" }).count()) > 0;
const turnDone = new Map<string, string>();
for (let step = 0; step < 900; step++) {
  if (await done(phone)) break;
  let acted = false;
  for (const [p, tag] of pages) {
    const results = p.getByRole("button", { name: "See the results" });
    if (await results.isVisible().catch(() => false)) {
      await p.waitForTimeout(4000);
      await shotOnce(p, tag, "ending");
      acted = (await results.isEnabled({ timeout: 1000 }).catch(() => false)) && (await tap(results));
      continue;
    }
    const cont = p.getByRole("button", { name: "Continue" });
    if (await cont.isVisible().catch(() => false)) {
      const scene = (await p.getByRole("dialog").first().getAttribute("aria-label").catch(() => "")) ?? "scene";
      await p.waitForTimeout(2500);
      await shotOnce(p, tag, `scene-${scene.slice(0, 24).replace(/\W+/g, "_")}`);
      acted = (await cont.isEnabled({ timeout: 1000 }).catch(() => false)) && (await tap(cont));
      continue;
    }
    const keep = p.getByRole("button", { name: /Keep it/ });
    if (await keep.isVisible().catch(() => false)) {
      acted = await tap(keep);
      continue;
    }
    const decision = p.locator('[role="dialog"][aria-modal="true"]');
    if (await decision.first().isVisible().catch(() => false)) {
      await shotOnce(p, tag, "decision");
      acted = await tap(decision.first().getByRole("button").first());
      continue;
    }
    if (await p.getByText("Your turn", { exact: true }).isVisible().catch(() => false)) {
      const round = (await p.locator("header").first().innerText()).match(/Round (\d+)/)?.[1] ?? "?";
      const did = turnDone.get(tag) ?? "";
      // first: move once (the picker, with the map's targets lit)
      if (!did.startsWith(`${round}:`)) {
        turnDone.set(tag, `${round}:moved`);
        const move = p.locator('[data-action="MOVE"]');
        if ((await move.getAttribute("aria-disabled")) !== "true" && (await tap(move))) {
          await shotOnce(p, tag, "move-picker");
          const choice = p.getByText("Move where?").locator("xpath=../..").getByRole("button").nth(1);
          acted = await tap(choice);
          continue;
        }
      }
      if (did === `${round}:moved`) {
        turnDone.set(tag, `${round}:searched`);
        const search = p.locator('[data-action="SEARCH"]');
        if ((await search.getAttribute("aria-disabled")) !== "true") {
          acted = await tap(search);
          continue;
        }
      }
      const end = p.getByRole("button", { name: /End turn/ });
      if ((await end.getAttribute("aria-disabled")) !== "true") {
        await shotOnce(p, tag, "city");
        acted = await tap(end);
        continue;
      }
    }
    const secrets = p.getByRole("button", { name: /^Your secrets \(/ });
    if (!seen.has(`secrets-${tag}`) && (await secrets.isVisible().catch(() => false)) && (await tap(secrets))) {
      await shotOnce(p, tag, "secrets");
      await p.keyboard.press("Escape");
      continue;
    }
    // look at another zone on the map once
    if (!seen.has(`zone-${tag}`)) {
      const hex = p.locator('[role="button"][aria-label*="high ground"]').first();
      if (await tap(hex)) {
        await shotOnce(p, tag, "zone");
        await tap(p.getByRole("button", { name: "Back to my zone" }));
      }
    }
    if (await p.locator("article.tarot").isVisible().catch(() => false)) await shotOnce(p, tag, "event-card");
  }
  if (!acted) await phone.waitForTimeout(400);
}

const ok = await done(phone);
for (const [p, tag] of pages) await p.screenshot({ path: `${out}/results-${tag}.png`, fullPage: true });
if (ok) {
  for (const [p, tag] of pages) await shotOnce(p, tag, "results");
  await phone.getByRole("button", { name: /Back to the lobby/ }).click();
  for (const [p] of pages) await p.getByRole("button", { name: /I'm ready/ }).waitFor({ timeout: 10_000 });
  console.log("back in the lobby on both screens");
}
await browser.close();
console.log(`room ${code}; ${ok ? "reached the results" : "did NOT reach the results"}; screenshots in ${out}`);
if (layout.length) console.error(`layout problems:\n  ${layout.join("\n  ")}`);
if (errors.length) console.error(`page errors:\n  ${errors.join("\n  ")}`);
if (!ok || layout.length || errors.length) process.exit(1);
