// Focused two-context browser check for Scenario 04 lot secrecy, counterfeit
// feedback, and a Blackjack HIT bust. Run after `pnpm build`.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const out = arg("out", "/tmp/fate-feedback04");
const port = Number(arg("port", "8098"));
const base = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "fate-feedback04-"));
mkdirSync(out, { recursive: true });
let server: ChildProcess | null = null;
const errors: string[] = [];
async function capture(page: Page, name: string) {
  await page.screenshot({ path: `${out}/${name}.png` });
  const clipped = await clippedElements(page);
  const small = await smallTargets(page);
  if (clipped.length) errors.push(`${name}: clipped ${clipped.join(", ")}`);
  if (small.length) errors.push(`${name}: small targets ${small.join(", ")}`);
}
async function choose(page: Page, sign: string, mbti: RegExp) {
  await page.getByRole("button", { name: "Choose character" }).click();
  await page.getByRole("button", { name: sign, exact: true }).click();
  await page.getByRole("button", { name: `Choose ${sign}` }).click();
  await page.getByRole("button", { name: mbti }).click();
  await page.getByRole("button", { name: new RegExp(`Reveal ${sign}`) }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "I'm ready" }).click();
}
const browser = await chromium.launch();
try {
  server = spawn(process.execPath, ["src/server/index.ts"], { env: { ...process.env, NODE_ENV: "test", SCENARIO04_TEST_SEED: "0000000000000000000000000000000d", DATA_DIR: dataDir, PORT: String(port) }, stdio: "inherit" });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`server exited: ${server.exitCode}`);
    if (await fetch(base).then((res) => res.ok).catch(() => false)) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const owner = execFileSync("ss", ["-ltnpH", `sport = :${port}`]).toString();
  if (!owner.includes(`pid=${server.pid},`)) throw new Error(`port ${port} is answered by another process`);
  const phone = await (await browser.newContext({ viewport: { width: Number(arg("phone", "390")), height: 844 }, isMobile: true, hasTouch: true })).newPage();
  const desk = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  phone.setDefaultTimeout(5000);
  desk.setDefaultTimeout(5000);
  for (const page of [phone, desk]) page.on("pageerror", (error) => errors.push(String(error)));
  await phone.goto(base);
  await phone.getByRole("button", { name: "Create room" }).click();
  await phone.getByLabel("Your name on the ticket").fill("Kyle");
  await phone.getByRole("dialog").getByRole("button", { name: "Create room" }).click();
  await phone.waitForURL(/\/room\/[A-Z0-9]{6}$/);
  await desk.goto(`${base}/room/${phone.url().slice(-6)}`);
  await desk.getByLabel("Your name on the ticket").fill("Bea");
  await desk.getByRole("dialog").getByRole("button", { name: "Join room" }).click();
  await phone.getByRole("button", { name: /^04/ }).first().click();
  await choose(phone, "Aries", /INFJ/);
  await choose(desk, "Pisces", /ISFJ/);
  await phone.getByRole("button", { name: "Take your seats" }).click();
  await phone.getByRole("button", { name: "Enter the auction" }).click();
  await desk.getByRole("button", { name: "Enter the auction" }).click();
  const lotCard = phone.getByRole("heading", { name: "The Black Die" }).locator("..");
  await lotCard.waitFor();
  if (!await lotCard.locator("svg").count()) errors.push("current lot has no symbol");
  if (/Activate it|next Investigate|COUNTERFEIT|LOT_01_LIMIT|LOT_01_PERFECT/.test(await lotCard.innerText())) errors.push("current lot reveals effect or hidden information");
  await capture(phone, `lot-public-${arg("phone", "390")}`);
  await capture(desk, "lot-public-1280");

  // The phone bids on the counterfeit first lot; the other seat passes.
  for (let step = 0; step < 30 && !await phone.locator('[data-s4-transition="2"]').isVisible(); step++) {
    let acted = false;
    for (const [page, isPhone] of [[phone, true], [desk, false]] as const) {
      if (!await page.getByText("Your turn", { exact: true }).isVisible().catch(() => false)) continue;
      if (isPhone && await page.locator('[data-action="BID"]').getAttribute("aria-disabled") !== "true") {
        await page.locator('[data-action="BID"]').click();
        await page.locator('[data-s4-picker="BID"] button').first().click();
      } else if (await page.locator('[data-action="PASS"]').getAttribute("aria-disabled") !== "true") {
        await page.locator('[data-action="PASS"]').click();
      }
      if (await page.locator('[data-action="END_TURN"]').getAttribute("aria-disabled") !== "true") await page.locator('[data-action="END_TURN"]').click();
      acted = true;
    }
    if (!acted) await phone.waitForTimeout(150);
  }
  await phone.locator('[data-s4-transition="2"]').waitFor();
  const secondLotCard = phone.getByRole("heading", { name: "The Glass Eye" }).locator("..");
  if (!await secondLotCard.locator("svg").count()) errors.push("second lot has no symbol");
  if (/Use once|Black Chips|COUNTERFEIT|LOT_02_READ|LOT_02_PERFECT/.test(await secondLotCard.innerText())) errors.push("second lot reveals effect or hidden information");
  if (await desk.getByText("Your turn", { exact: true }).isVisible().catch(() => false)) {
    await desk.locator('[data-action="PASS"]').click();
    await desk.locator('[data-action="END_TURN"]').click();
  }
  await phone.locator('[data-action="USE_LOT"]').click();
  await phone.locator('[data-s4-item="LOT_01"]').click();
  const fakeAlert = phone.getByRole("alert").filter({ hasText: "COUNTERFEIT" });
  await fakeAlert.waitFor();
  if (!await fakeAlert.getByText(/no effect/i).isVisible()) errors.push("counterfeit alert omits no-effect result");
  if (await desk.getByRole("alert").filter({ hasText: "COUNTERFEIT" }).isVisible().catch(() => false)) errors.push("other bidder saw counterfeit alert");
  if (await phone.locator('[data-s4-effect="black-die"]').isVisible().catch(() => false)) errors.push("counterfeit Black Die activated");
  await capture(phone, `counterfeit-${arg("phone", "390")}`);
  if (await phone.locator('[data-action="USE_LOT"]').getAttribute("aria-disabled") !== "true") errors.push("counterfeit remained in inventory");

  // Advance to Kyle's turn if needed, then challenge Bea and make her HIT.
  for (let step = 0; step < 8 && !await phone.getByText("Your turn", { exact: true }).isVisible().catch(() => false); step++) {
    if (await desk.getByText("Your turn", { exact: true }).isVisible().catch(() => false)) {
      await desk.locator('[data-action="PASS"]').click();
      await desk.locator('[data-action="END_TURN"]').click();
    } else await phone.waitForTimeout(150);
  }
  await phone.locator('[data-action="CHALLENGE"]').click();
  await phone.locator('[data-s4-picker="CHALLENGE"] button').first().click();
  await phone.getByRole("button", { name: "Issue challenge" }).click();
  await desk.getByRole("dialog").getByRole("button", { name: "Accept" }).click();
  await desk.getByRole("dialog").getByRole("button", { name: "Hit" }).waitFor({ state: "visible" });
  let bust = false;
  for (let hit = 0; hit < 10; hit++) {
    const hitButton = desk.getByRole("dialog").getByRole("button", { name: "Hit" });
    await hitButton.click();
    await desk.waitForTimeout(200);
    if (await desk.getByRole("dialog").getByText("BUST", { exact: true }).isVisible().catch(() => false)) { bust = true; break; }
    await hitButton.waitFor({ state: "visible" });
  }
  if (!bust) throw new Error("Blackjack did not bust within ten HIT actions");
  for (const [page, name] of [[phone, "phone"], [desk, "desktop"]] as const) {
    const dialog = page.getByRole("dialog");
    if (!await dialog.getByText(/drew [AJQK0-9]+ · total \d+/).isVisible()) errors.push(`${name}: final card and total absent`);
    if (!await dialog.getByText(name === "phone" ? "Opponent bust · you won" : "You lost").isVisible()) errors.push(`${name}: result absent`);
    await capture(page, `blackjack-bust-${name}-${arg("phone", "390")}`);
  }
  await desk.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
  if (!await phone.getByRole("dialog").getByText("BUST", { exact: true }).isVisible()) errors.push("result closed before winner confirmed");
  await phone.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
  await phone.getByRole("dialog").waitFor({ state: "hidden" });
} finally {
  await browser.close();
  if (server && server.exitCode === null) await new Promise<void>((resolve) => { server!.once("exit", () => resolve()); server!.kill("SIGTERM"); });
  rmSync(dataDir, { recursive: true, force: true });
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(`Scenario 04 feedback walkthrough passed; screenshots in ${out}`);
