// Plays Scenario 04 in two isolated browser contexts through all ten lots.
// Usage: node scripts/ui-play04.ts [--phone 390|320] [--out /tmp/fate-play04]
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const out = arg("out", "/tmp/fate-play04");
const port = Number(arg("port", "8097"));
const base = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "fate-play04-"));
mkdirSync(out, { recursive: true });
let server: ChildProcess | null = null;
const problems: string[] = [];
const errors: string[] = [];
const seen = new Set<string>();
let readPerfect = false;
async function shot(page: Page, tag: string, name: string) {
  const key = `${name}-${tag}`;
  if (seen.has(key)) return;
  seen.add(key);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${out}/${key}.png` });
  const clipped = await clippedElements(page);
  const small = await smallTargets(page);
  if (clipped.length) problems.push(`${key}: clipped ${clipped.join(", ")}`);
  if (small.length) problems.push(`${key}: small targets ${small.join(", ")}`);
}
async function tap(locator: Locator) { try { await locator.first().click({ timeout: 1500 }); return true; } catch { return false; } }
async function visible(locator: Locator) { return locator.first().isVisible().catch(() => false); }
async function enabled(locator: Locator) { return await visible(locator) && await locator.first().getAttribute("aria-disabled") !== "true"; }
async function pick(page: Page, sign: string, mbti: RegExp) {
  await page.getByRole("button", { name: "Choose character" }).click();
  await page.getByRole("button", { name: sign, exact: true }).click();
  await page.getByRole("button", { name: `Choose ${sign}` }).click();
  await page.getByRole("button", { name: mbti }).click();
  await page.getByRole("button", { name: new RegExp(`Reveal ${sign}`) }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "I'm ready" }).click();
}

server = spawn(process.execPath, ["src/server/index.ts"], { env: { ...process.env, NODE_ENV: "test", SCENARIO04_TEST_SEED: "00000000000000000000000000000001", DATA_DIR: dataDir, PORT: String(port) }, stdio: "inherit" });
for (let i = 0; i < 100; i++) {
  if (server.exitCode !== null) throw new Error(`server exited: ${server.exitCode}`);
  if (await fetch(base).then((res) => res.ok).catch(() => false)) break;
  await new Promise((resolve) => setTimeout(resolve, 100));
}
const owner = execFileSync("ss", ["-ltnpH", `sport = :${port}`]).toString();
if (!owner.includes(`pid=${server.pid},`)) throw new Error(`port ${port} is answered by another process`);
const browser = await chromium.launch();
const phone = await (await browser.newContext({ viewport: { width: Number(arg("phone", "390")), height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const desk = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
for (const page of [phone, desk]) {
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("websocket", (socket) => socket.on("framereceived", (frame) => {
    try {
      const roll = JSON.parse(String(frame.payload)).snapshot?.game?.roll;
      if (roll?.purpose === "S4_READ" && roll.done && roll.tier === "PERFECT") readPerfect = true;
    } catch { /* Ignore protocol frames without a game snapshot. */ }
  }));
}
let reached = 0;
const done = new Set<string>();
let declinedChallenge = false;
let acceptedChallenge = false;
let acceptedDeal = false;
let bidKeptTurn = false;
let usedCredit = false;
let usedDevil = false;
let sawNextRoundOrder = false;
let sawFakeItem = false;
try {
  await phone.goto(base);
  await phone.getByRole("button", { name: "Create room" }).click();
  await phone.getByLabel("Your name on the ticket").fill("Kyle");
  await phone.getByRole("dialog").getByRole("button", { name: "Create room" }).click();
  await phone.waitForURL(/\/room\/[A-Z0-9]{6}$/);
  await desk.goto(`${base}/room/${phone.url().slice(-6)}`);
  await desk.getByLabel("Your name on the ticket").fill("Bea");
  await desk.getByRole("dialog").getByRole("button", { name: "Join room" }).click();
  await phone.getByRole("button", { name: /^04/ }).first().click();
  await pick(phone, "Aries", /INFJ/);
  await pick(desk, "Pisces", /ISFJ/);
  await phone.getByRole("button", { name: "Take your seats" }).click();
  await shot(phone, "phone", "intro");
  await shot(desk, "desktop", "intro");
  await phone.getByRole("button", { name: "Enter the auction" }).click();
  await desk.getByRole("button", { name: "Enter the auction" }).click();
  await phone.locator('[data-action="USE_LOT"]').waitFor({ state: "visible" });
  if (!await visible(phone.getByText(/1 AP/).first())) problems.push("Scenario 04 did not start with 1 AP");
  if (!await visible(phone.locator('[data-action="USE_LOT"]'))) problems.push("the shared item entry is missing");
  if ((await phone.locator('[data-action="USE_SKILL"]').innerText()).trim() === "Ability") problems.push("ability button has no character-specific name");
  const pages: [Page, string][] = [[phone, "phone"], [desk, "desktop"]];
  for (let step = 0; step < 500 && reached < 10; step++) {
    let acted = false;
    for (const [page, tag] of pages) {
      if (await visible(page.getByRole("heading", { name: /Exit Rights claimed|The debt follows|No one leaves/ }))) { reached = 10; break; }
      const text = await page.locator("header").first().innerText().catch(() => "");
      const round = Number(text.match(/ROUND\s+(\d+)\s*\/\s*10/i)?.[1] ?? 0);
      if (round > 0) { reached = Math.max(reached, round - 1); await shot(page, tag, `round-${round}`); }
      if (round === 2 && await visible(page.getByText("First lap: Bea → Kyle", { exact: true }))) sawNextRoundOrder = true;
      const decision = page.locator('[role="dialog"][aria-modal="true"]');
      if (await visible(decision)) {
        await shot(page, tag, "decision");
        if (await visible(decision.getByRole("button", { name: "Stand" }))) acted = await tap(decision.getByRole("button", { name: "Stand" }));
        else if (round === 3 && !declinedChallenge && await visible(decision.getByRole("button", { name: "Decline" }))) {
          acted = await tap(decision.getByRole("button", { name: "Decline" }));
          if (acted) declinedChallenge = true;
        }
        else if (await visible(decision.getByRole("button", { name: "Accept" }))) {
          const isChallenge = await visible(decision.getByRole("button", { name: "Decline" }));
          acted = await tap(decision.getByRole("button", { name: "Accept" }));
          if (acted) { if (isChallenge) acceptedChallenge = true; else acceptedDeal = true; }
        }
        else acted = await tap(decision.getByRole("button").first());
        continue;
      }
      const keep = page.getByRole("button", { name: /Keep it/ });
      if (await visible(keep)) { await shot(page, tag, "dice"); acted = await tap(keep); continue; }
      if (await visible(page.locator('[role="dialog"]:not([aria-modal])'))) { await page.waitForTimeout(250); acted = true; continue; }
      if (!await visible(page.getByText("Your turn", { exact: true }))) continue;
      const action = (id: string) => page.locator(`[data-action="${id}"]`);
      if (await visible(page.locator('[data-s4-picker="EXPOSE"] button'))) {
        await shot(page, tag, "expose-picker");
        acted = await tap(page.locator('[data-s4-picker="EXPOSE"] button'));
        if (acted) {
          await page.locator('[data-s4-picker="EXPOSE"]').waitFor({ state: "hidden" });
          await desk.getByText("EXPOSED INTEL").waitFor();
        }
        continue;
      }
      if (await visible(page.locator('[data-s4-picker="USE_LOT"]'))) {
        await shot(page, tag, "item-picker");
        if (tag === "desktop" && await visible(page.getByText(/Prototype Chrono Key/))) sawFakeItem = true;
        const item = round === 10 && tag === "desktop"
          ? page.locator('[data-s4-picker="USE_LOT"] button').filter({ hasText: "The Devil's Key" })
          : page.locator('[data-s4-picker="USE_LOT"] button:not([disabled])');
        acted = await tap(item);
        if (acted && round === 7 && tag === "phone") usedCredit = true;
        if (acted && round === 10 && tag === "desktop") usedDevil = true;
        continue;
      }
      if (await visible(page.locator('[data-skill-confirm]'))) { acted = await tap(page.locator('[data-skill-confirm]')); continue; }
      if (await visible(page.locator('[data-s4-picker="SABOTAGE"] button'))) { acted = await tap(page.locator('[data-s4-picker="SABOTAGE"] button')); continue; }
      if (await visible(page.locator('[data-s4-picker="READ"] button'))) { acted = await tap(page.locator('[data-s4-picker="READ"] button')); continue; }
      if (await visible(page.locator('[data-s4-picker="CHALLENGE"]'))) {
        await shot(page, tag, "challenge-picker");
        await page.locator('[data-s4-picker="CHALLENGE"] button').first().click();
        await page.getByRole("button", { name: "Issue challenge" }).click();
        acted = true;
        continue;
      }
      if (await visible(page.locator('[data-s4-picker="DEAL"]'))) {
        await shot(page, tag, "deal-picker");
        await page.locator('[data-s4-picker="DEAL"] button').first().click();
        await page.getByRole("button", { name: "Offer this deal" }).click();
        acted = true;
        continue;
      }
      const key = (what: string) => `${tag}:${round}:${what}`;
      if (round === 1 && !done.has(key("bid")) && await enabled(action("BID"))) {
        if (!await tap(action("BID"))) continue;
        await shot(page, tag, "bid-picker");
        acted = await tap(page.locator('[data-s4-picker="BID"] button').first());
        if (acted) { done.add(key("bid")); if (tag === "phone") bidKeptTurn = await visible(page.getByText("Your turn", { exact: true })); }
        continue;
      }
      if (round === 1 && tag === "phone" && done.has("desktop:1:bid") && !done.has(key("rebid")) && await enabled(action("BID"))) {
        if (!await tap(action("BID"))) continue;
        acted = await tap(page.locator('[data-s4-picker="BID"] button').first());
        if (acted) done.add(key("rebid"));
        continue;
      }
      if (round === 2 && tag === "desktop" && !done.has(key("investigate")) && await enabled(action("INVESTIGATE"))) { acted = await tap(action("INVESTIGATE")); if (acted) done.add(key("investigate")); continue; }
      if (round === 2 && tag === "phone" && !done.has(key("read")) && await enabled(action("READ"))) { acted = await tap(action("READ")); if (acted) { done.add(key("read")); await page.locator('[data-s4-picker="READ"]').waitFor(); } continue; }
      if ((tag === "phone" && [2, 3, 8, 10].includes(round) || tag === "desktop" && [3, 9].includes(round)) && !done.has(key("borrow")) && await enabled(action("BORROW"))) { acted = await tap(action("BORROW")); if (acted) done.add(key("borrow")); continue; }
      if ((round === 3 || round === 5 && tag === "phone") && !done.has(key("challenge")) && await enabled(action("CHALLENGE"))) { acted = await tap(action("CHALLENGE")); if (acted) { done.add(key("challenge")); await page.locator('[data-s4-picker="CHALLENGE"]').waitFor(); } continue; }
      if (round === 4 && !done.has(key("deal")) && await enabled(action("DEAL"))) { acted = await tap(action("DEAL")); if (acted) { done.add(key("deal")); await page.locator('[data-s4-picker="DEAL"]').waitFor(); } continue; }
      if (round === 7 && tag === "phone" && !done.has(key("item")) && await enabled(action("USE_LOT"))) { acted = await tap(action("USE_LOT")); if (acted) { done.add(key("item")); await page.locator('[data-s4-picker="USE_LOT"]').waitFor(); } continue; }
      if (round === 7 && tag === "phone" && !done.has(key("ability")) && await enabled(action("USE_SKILL"))) { acted = await tap(action("USE_SKILL")); if (acted) { done.add(key("ability")); await page.locator('[data-skill-confirm]').waitFor(); } continue; }
      if (round === 7 && tag === "phone" && done.has(key("ability")) && !done.has(key("expose")) && await enabled(action("EXPOSE"))) { acted = await tap(action("EXPOSE")); if (acted) { done.add(key("expose")); await page.locator('[data-s4-picker="EXPOSE"]').waitFor(); } continue; }
      if (round === 8 && !done.has(key("sabotage")) && await enabled(action("SABOTAGE"))) {
        if (!await tap(action("SABOTAGE"))) continue;
        await page.locator('[data-s4-picker="SABOTAGE"]').waitFor();
        acted = await tap(page.locator('[data-s4-picker="SABOTAGE"] button'));
        if (acted) done.add(key("sabotage"));
        continue;
      }
      if (round === 10 && tag === "desktop" && !done.has(key("devil")) && await enabled(action("USE_LOT"))) { acted = await tap(action("USE_LOT")); if (acted) { done.add(key("devil")); await page.locator('[data-s4-picker="USE_LOT"]').waitFor(); } continue; }
      if (round === 10 && tag === "desktop" && done.has(key("devil")) && !done.has(key("recover")) && await enabled(action("RECOVER"))) { acted = await tap(action("RECOVER")); if (acted) done.add(key("recover")); continue; }
      if (round === 10 && tag === "phone" && !done.has("finalBid") && await enabled(action("BID"))) {
        if (!await tap(action("BID"))) continue;
        acted = await tap(page.locator('[data-s4-picker="BID"] button').first());
        if (acted) done.add("finalBid");
        continue;
      }
      if (round === 2 && tag === "desktop" && !done.has(key("bid")) && await enabled(action("BID"))) {
        await tap(action("BID")); acted = await tap(page.locator('[data-s4-picker="BID"] button').first()); if (acted) done.add(key("bid")); continue;
      }
      if (round === 5 && tag === "desktop" && !done.has(key("bid")) && await enabled(action("BID"))) {
        await tap(action("BID")); acted = await tap(page.locator('[data-s4-picker="BID"] button').first()); if (acted) done.add(key("bid")); continue;
      }
      if (round === 6 && tag === "phone" && !done.has(key("bid")) && await enabled(action("BID"))) {
        await tap(action("BID")); acted = await tap(page.locator('[data-s4-picker="BID"] button').first()); if (acted) done.add(key("bid")); continue;
      }
      if (round === 9 && tag === "desktop" && !done.has(key("bid")) && await enabled(action("BID"))) {
        await tap(action("BID")); acted = await tap(page.locator('[data-s4-picker="BID"] button').first()); if (acted) done.add(key("bid")); continue;
      }
      if (await enabled(action("PASS"))) acted = await tap(action("PASS"));
      else if (await enabled(action("END_TURN"))) acted = await tap(action("END_TURN"));
    }
    if (!acted) await phone.waitForTimeout(200);
  }
  console.log(`attempted actions: ${[...done].join(", ")}`);
  await shot(phone, "phone", "last");
  await shot(desk, "desktop", "last");
  if (reached === 10) {
    await phone.getByRole("button", { name: "Results" }).click();
    await desk.getByRole("button", { name: "Results" }).click();
    await shot(phone, "phone", "results");
    await shot(desk, "desktop", "results");
  }
} finally {
  await browser.close();
  if (server && server.exitCode === null) await new Promise<void>((resolve) => { server!.once("exit", () => resolve()); server!.kill("SIGTERM"); });
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(`Scenario 04 reached ${reached}/10 rounds; screenshots in ${out}`);
if (!seen.has("challenge-picker-phone") && !seen.has("challenge-picker-desktop")) problems.push("Blackjack picker was never opened");
if (!seen.has("deal-picker-phone") && !seen.has("deal-picker-desktop")) problems.push("Deal picker was never opened");
if (!seen.has("expose-picker-phone")) problems.push("EXPOSE picker was never opened");
if (!seen.has("decision-phone") && !seen.has("decision-desktop")) problems.push("no shared Decision window was reached");
if (!done.has("phone:1:rebid")) problems.push("round one never made a second bidding lap");
if (!declinedChallenge || !acceptedChallenge) problems.push("Blackjack accept and decline were not both exercised");
if (!acceptedDeal) problems.push("Deal was never accepted");
if (!done.has("finalBid")) problems.push("Exit Rights were never bid on");
if (!seen.has("item-picker-phone") || !seen.has("item-picker-desktop")) problems.push("an owned item was not inspected in both contexts");
if (!bidKeptTurn) problems.push("BID did not keep the bidder's turn");
if (!sawNextRoundOrder) problems.push("the winner was not last in the next round's first lap");
if (!sawFakeItem) problems.push("the counterfeit lot was not seen in inventory");
if (!usedCredit || !usedDevil) problems.push("Bottomless Credit or Devil's Key was not used");
if (!done.has("desktop:10:recover")) problems.push("RECOVER was not exercised after Devil's Key");
if (!readPerfect) problems.push("Black Die did not resolve READ as Perfect");
if (problems.length) console.error(problems.join("\n"));
if (errors.length) console.error(errors.join("\n"));
if (reached < 10 || problems.length || errors.length) process.exit(1);
