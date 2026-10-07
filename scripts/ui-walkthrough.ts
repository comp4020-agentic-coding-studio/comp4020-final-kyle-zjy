// Drives the real UI in two isolated browser contexts (two "people"): create,
// join by code, pick characters, ready, refresh, depart. Saves screenshots and
// fails on horizontal overflow at phone widths. Needs the app running
// (APP_URL, default http://localhost:8080) and Playwright's Chromium.
//
//   node scripts/ui-walkthrough.ts [outDir]
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { clippedElements } from "./lib/layout-check.ts";

const base = process.env.APP_URL ?? "http://localhost:8080";
const out = process.argv[2] ?? "/tmp/fate-shots";
mkdirSync(out, { recursive: true });

const problems: string[] = [];
const shot = async (page: Page, name: string) => {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  const clipped = await clippedElements(page);
  if (clipped.length) problems.push(`${name}: content past the right edge: ${clipped.join(", ")}`);
};

const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const narrow = { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const a = await (await browser.newContext(phone)).newPage();
const b = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors: string[] = [];
for (const p of [a, b]) p.on("pageerror", (e) => errors.push(String(e)));

// A: landing → create
await a.goto(base);
await a.waitForTimeout(2500);
await shot(a, "01-landing-phone");
await a.getByRole("button", { name: "Create room" }).click();
await a.getByLabel("Your name on the ticket").fill("Kyle");
await shot(a, "02-create-sheet-phone");
await a.getByRole("dialog").getByRole("button", { name: "Create room" }).click();
await a.waitForURL(/\/room\/[A-Z0-9]{6}$/);
const code = a.url().slice(-6);
await a.getByText("Who are you tonight?").waitFor();
await shot(a, "03-lobby-alone-phone");

// B: landing → join with the code (desktop)
await b.goto(base);
await b.waitForTimeout(1800);
await shot(b, "04-landing-desktop");
await b.getByRole("button", { name: "Join room" }).click();
await b.getByLabel("Room code, 6 characters").fill(code.toLowerCase());
await b.getByLabel("Your name on the ticket").fill("Bea");
await shot(b, "05-join-sheet-desktop");
await b.getByRole("dialog").getByRole("button", { name: "Join room" }).click();
await b.waitForURL(`**/room/${code}`);

// realtime: A sees B without reloading
await a.getByRole("button", { name: /^Bea/ }).waitFor({ timeout: 2000 });

// A picks Scorpio ENTP through the wheel and grid
await a.getByRole("button", { name: "Choose character" }).click();
await a.getByRole("button", { name: "Scorpio", exact: true }).click();
await a.waitForTimeout(900);
await shot(a, "06-zodiac-wheel-phone");
await a.getByRole("button", { name: "Choose Scorpio" }).click();
await a.getByRole("button", { name: /ENTP/ }).click();
await shot(a, "07-mbti-grid-phone");
await a.getByRole("button", { name: /Reveal Scorpio/ }).click();
await a.waitForTimeout(4500);
await a.getByRole("dialog").getByRole("heading", { name: "The Venom-Tongued Schemer" }).waitFor();
await a.getByText("Backbite", { exact: false }).first().waitFor();
await shot(a, "08-reveal-phone");
await a.getByRole("button", { name: "Take my ticket" }).click();
await a.getByRole("button", { name: "I'm ready" }).click();

// B picks Capricorn ESTP: any of the 192 pairs reveals its roster character
await b.getByRole("button", { name: "Choose character" }).click();
await b.getByRole("button", { name: "Capricorn", exact: true }).click();
await b.getByRole("button", { name: "Choose Capricorn" }).click();
await b.getByRole("button", { name: /ESTP/ }).click();
await b.getByRole("button", { name: /Reveal Capricorn/ }).click();
await b.getByRole("dialog").getByRole("heading", { name: "Peak Challenger" }).waitFor({ timeout: 4000 });
await b.getByRole("button", { name: "Skip" }).click();
await b.waitForTimeout(600);
await shot(b, "09-lobby-desktop");

// refresh B: same seat, no duplicate player
await b.reload();
await b.getByRole("button", { name: "I'm ready" }).waitFor();
const seats = await a.locator('[aria-label*="ready"]').count();
if (seats !== 2) problems.push(`after refresh A sees ${seats} passengers, expected 2`);
await b.getByRole("button", { name: "I'm ready" }).click();

await a.waitForTimeout(700);
await shot(a, "10-lobby-both-ready-phone");
// both seated portraits are real, loaded images
const portraits = await a.evaluate(() =>
  [...document.querySelectorAll<HTMLImageElement>('img[src^="/avatars/"]')].map((i) => [i.getAttribute("src"), i.complete && i.naturalWidth > 0]),
);
if (!portraits.some(([src]) => src === "/avatars/scorpio-entp.svg") || !portraits.some(([src]) => src === "/avatars/capricorn-estp.svg")) {
  problems.push(`lobby is missing a seated portrait: ${JSON.stringify(portraits)}`);
}
if (portraits.some(([, ok]) => !ok)) problems.push(`a portrait failed to load: ${JSON.stringify(portraits)}`);

// narrow phone check on the lobby
const c = await (await browser.newContext(narrow)).newPage();
await c.goto(base);
await c.waitForTimeout(2000);
await shot(c, "11-landing-320");
await c.getByRole("button", { name: "Join room" }).click();
await c.getByLabel("Room code, 6 characters").fill(code);
await c.getByLabel("Your name on the ticket").fill("Narrow Nell");
await c.getByRole("dialog").getByRole("button", { name: "Join room" }).click();
await c.getByText("Who are you tonight?").waitFor();
await c.waitForTimeout(800);
await shot(c, "11b-lobby-320");
c.on("dialog", (d) => d.accept());
await c.getByRole("button", { name: "Leave room" }).click();
await c.waitForURL(base + "/");

// A (host) departs → both see the intro, both board
await a.getByRole("button", { name: "Depart" }).click();
await b.getByText("Scenario 01 · Route N13").waitFor({ timeout: 3000 });
await a.waitForTimeout(8000);
await shot(a, "12-intro-phone");
for (const p of [a, b]) await p.getByRole("button", { name: "Board the train" }).click();

// the run: both see round 1 on the train
for (const p of [a, b]) await p.getByRole("region", { name: "The train" }).waitFor({ timeout: 5000 });
await a.waitForTimeout(800);
await shot(a, "13-game-phone");
await shot(b, "14-game-desktop");

// whoever is active investigates; the other sees the roll
const aTurn = await a.getByText("Your turn").isVisible();
const [me, other] = aTurn ? [a, b] : [b, a];
await me.getByRole("button", { name: /Investigate/ }).click();
await other.getByRole("dialog", { name: /investigation/ }).waitFor({ timeout: 3000 });
await me.waitForTimeout(1200);
await shot(me, aTurn ? "15-roll-phone" : "15-roll-desktop");
const keep = me.getByRole("button", { name: /Keep it/ });
if (await keep.isVisible().catch(() => false)) await keep.click();
await me.waitForTimeout(3200);

// move, then end the turn: the other browser gets it
const move = me.getByRole("button", { name: /^Move/ });
if (!(await move.getAttribute("aria-disabled"))) await move.click();
await me.waitForTimeout(600);
await me.getByRole("button", { name: /End turn/ }).click();
await other.getByText("Your turn").waitFor({ timeout: 3000 });
await other.waitForTimeout(600);
await shot(other, aTurn ? "16-other-turn-desktop" : "16-other-turn-phone");

// log and secrets drawers
await other.getByRole("button", { name: "Train log" }).click();
await other.waitForTimeout(500);
await shot(other, "17-log");
await other.keyboard.press("Escape");
await other.getByRole("button", { name: /Your secrets/ }).click();
await other.waitForTimeout(500);
await shot(other, "18-secrets");
await other.keyboard.press("Escape");

// refresh mid-run: same seat, still in the game
await other.reload();
await other.getByRole("region", { name: "The train" }).waitFor({ timeout: 5000 });

// the network drops mid-run: a notice on screen, then back to the table
await other.context().setOffline(true);
await other.getByText(/offline|reconnecting/i).waitFor({ timeout: 8000 }).catch(() => problems.push("no connection notice while offline"));
await shot(other, "19-offline");
await other.context().setOffline(false);
await other.getByText(/offline|reconnecting/i).waitFor({ state: "hidden", timeout: 15_000 }).catch(() => problems.push("connection notice stayed after the network came back"));
await other.getByRole("region", { name: "The train" }).waitFor({ timeout: 5000 });

await browser.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
console.log(`room ${code}; screenshots in ${out}`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("walkthrough passed");
