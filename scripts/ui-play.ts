// Plays a two-browser run up to a milestone, for checking in-game screens in
// a real browser without walking the whole product each time.
//
//   node scripts/ui-play.ts --until act2|act3|end [--out /tmp/fate-play]
//                           [--kyle Scorpio/ENTP] [--bea Pisces/ISFJ] [--skills] [--phone 390]
//
// Every screenshot is also checked for content clipped past the right edge
// and for touch targets under 48 px; the run fails if any are found.
//
// Each player investigates once per turn when they can, then ends the turn;
// decisions take the first option; cinematics are acknowledged. Screenshots
// are taken the first time each kind of screen appears. Needs the app
// running (APP_URL) and Playwright's Chromium.
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = process.env.APP_URL ?? "http://localhost:8080";
const until = arg("until", "act2");
const out = arg("out", "/tmp/fate-play");
const [kyleSign, kyleType] = arg("kyle", "Scorpio/ENTP").split("/");
const [beaSign, beaType] = arg("bea", "Pisces/ISFJ").split("/");
// --skills: each player uses their active ability on their first turn that allows it
const useSkills = process.argv.includes("--skills");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const phoneWidth = Number(arg("phone", "390"));
const phone = await (await browser.newContext({ viewport: { width: phoneWidth, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const desk = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pages: [Page, string][] = [
  [phone, "phone"],
  [desk, "desktop"],
];
const errors: string[] = [];
for (const [p] of pages) p.on("pageerror", (e) => errors.push(String(e)));

/** Clicks if possible within a moment; overlays animate out, so a miss just means "try next loop". */
async function tap(l: import("playwright").Locator): Promise<boolean> {
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
  // clicks scroll the page; the top (banner, objective, Inspector line) matters most
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/${key}.png` });
  const clipped = await clippedElements(p);
  if (clipped.length) layout.push(`${key}: clipped ${clipped.join(", ")}`);
  const small = await smallTargets(p);
  if (small.length) layout.push(`${key}: small targets ${small.join(", ")}`);
}
const layout: string[] = [];

async function pick(p: Page, tag: string, sign: string, type: RegExp) {
  await p.getByRole("button", { name: "Choose character" }).click();
  await shotOnce(p, tag, "pick-sign");
  await p.getByRole("button", { name: sign, exact: true }).click();
  await p.getByRole("button", { name: `Choose ${sign}` }).click();
  await shotOnce(p, tag, "pick-type");
  await p.getByRole("button", { name: type }).click();
  await p.getByRole("button", { name: new RegExp(`Reveal ${sign}`) }).click();
  await p.getByRole("button", { name: "Skip" }).click();
  await shotOnce(p, tag, "revealed");
  await p.getByRole("button", { name: "I'm ready" }).click();
}

// set up: create, join, characters, depart, board
await phone.goto(base);
await shotOnce(phone, "phone", "landing");
await phone.getByRole("button", { name: "Create room" }).click();
await shotOnce(phone, "phone", "create-room");
await phone.getByLabel("Your name on the ticket").fill("Kyle");
await phone.getByRole("dialog").getByRole("button", { name: "Create room" }).click();
await phone.waitForURL(/\/room\/[A-Z0-9]{6}$/);
const code = phone.url().slice(-6);
await desk.goto(`${base}/room/${code}`);
await desk.getByLabel("Your name on the ticket").fill("Bea");
await desk.getByRole("dialog").getByRole("button", { name: "Join room" }).click();
await shotOnce(phone, "phone", "lobby");
await pick(phone, "phone", kyleSign, new RegExp(kyleType));
await pick(desk, "desktop", beaSign, new RegExp(beaType));
await shotOnce(phone, "phone", "lobby-ready");
await phone.getByRole("button", { name: "Depart" }).click();
// the broadcast types itself out, then both board (it ends on its own after 14 s)
await Promise.all(pages.map(([p]) => p.getByRole("button", { name: "Board the train" }).waitFor({ timeout: 15_000 })));
await phone.waitForTimeout(6000);
await Promise.all(pages.map(([p, tag]) => shotOnce(p, tag, "intro")));
for (const [p] of pages) await tap(p.getByRole("button", { name: "Board the train" }));
// the drawers and a passenger's sheet, once, on the first quiet moment
for (const [p, tag] of pages) {
  await p.getByRole("button", { name: "Train log" }).click({ timeout: 15_000 });
  await shotOnce(p, tag, "log");
  await p.keyboard.press("Escape");
  await p.getByRole("list", { name: "Passengers" }).getByRole("button").first().click();
  await shotOnce(p, tag, "player-sheet");
  await p.keyboard.press("Escape");
}

const reached = async (p: Page) => {
  const text = (await p.locator("header").first().innerText().catch(() => "")).toUpperCase();
  if (until === "act2") return text.includes("ACT II");
  if (until === "act3") return text.includes("ACT III");
  return (await p.getByRole("button", { name: "Leave for the platform" }).count()) > 0;
};

const investigatedRound = new Map<string, string>();
for (let step = 0; step < 600; step++) {
  if (await reached(phone)) break;
  let acted = false;
  for (const [p, tag] of pages) {
    // the ending scene, then the results
    const results = p.getByRole("button", { name: "See the results" });
    if (await results.isVisible().catch(() => false)) {
      await p.waitForTimeout(3000); // let the lines finish appearing
      await shotOnce(p, tag, "ending");
      acted = (await results.isEnabled({ timeout: 1000 }).catch(() => false)) && (await tap(results));
      continue;
    }
    // cinematics
    const cont = p.getByRole("button", { name: "Continue" });
    if (await cont.isVisible().catch(() => false)) {
      const scene = (await p.getByRole("dialog").first().getAttribute("aria-label").catch(() => "")) ?? "scene";
      await shotOnce(p, tag, `scene-${scene.slice(0, 20).replace(/\W+/g, "_")}`);
      acted = (await cont.isEnabled({ timeout: 1000 }).catch(() => false)) && (await tap(cont));
      continue;
    }
    // decisions addressed to this player
    const fate = p.getByRole("button", { name: /Keep it/ });
    if (await fate.isVisible().catch(() => false)) {
      acted = await tap(fate);
      continue;
    }
    const decision = p.locator('[role="dialog"][aria-modal="true"]').filter({ hasText: /Vote|Everyone chooses|Your ability|Trade offer|The last choice/ });
    if (await decision.isVisible().catch(() => false)) {
      const kind = (await decision.locator(".label").first().innerText().catch(() => "decision")).replace(/\W+/g, "_");
      await shotOnce(p, tag, `decision-${kind}`);
      acted = await tap(decision.getByRole("button").first());
      continue;
    }
    // my turn: maybe the ability, then investigate once per round, then end the turn
    if (await p.getByText("Your turn", { exact: true }).isVisible().catch(() => false)) {
      const burn = p.getByRole("button", { name: /^Burn it/ });
      if (useSkills && !seen.has(`skilled-${tag}`)) {
        const skill = p.locator('[data-action="USE_SKILL"]');
        if ((await skill.count()) && (await skill.getAttribute("aria-disabled")) !== "true" && (await tap(skill))) {
          seen.add(`skilled-${tag}`);
          await shotOnce(p, tag, "skill-picker");
          acted = (await burn.isEnabled().catch(() => false)) && (await tap(burn));
          continue;
        }
      }
      const round = (await p.locator("header").first().innerText()).match(/R(\d+)/)?.[1] ?? "?";
      const inv = p.getByRole("button", { name: /^Investigate/ });
      if (investigatedRound.get(tag) !== round && (await inv.getAttribute("aria-disabled")) !== "true") {
        investigatedRound.set(tag, round);
        acted = await tap(inv);
        await p.waitForTimeout(400);
        continue;
      }
      const end = p.getByRole("button", { name: /End turn/ });
      if ((await end.getAttribute("aria-disabled")) !== "true") {
        acted = await tap(end);
        continue;
      }
    }
    // act 2: the Inspector on the train, and the round-5 message in the secrets drawer
    if (await p.locator('[aria-label^="Inspector, distortion"]').first().isVisible().catch(() => false)) await shotOnce(p, tag, "inspector");
    const secrets = p.getByRole("button", { name: /^Your secrets \([1-9]/ });
    if (!seen.has(`secrets-${tag}`) && (await secrets.isVisible().catch(() => false)) && (await tap(secrets))) {
      await shotOnce(p, tag, "secrets");
      await p.keyboard.press("Escape");
      continue;
    }
    // a freshly drawn event card, and the objective + cue feed after a roll
    if (await p.locator("article.tarot").isVisible().catch(() => false)) await shotOnce(p, tag, "event-card");
    if (await p.locator('[aria-live="polite"] .rounded-full').first().isVisible().catch(() => false)) await shotOnce(p, tag, "cue-feed");
  }
  if (!acted) await phone.waitForTimeout(500);
}

const ok = await reached(phone);
for (const [p, tag] of pages) await shotOnce(p, tag, `reached-${until}`);
if (until === "end" && ok) {
  for (const [p, tag] of pages) await p.screenshot({ path: `${out}/results-full-${tag}.png`, fullPage: true });
  // the host (phone) takes the room back; both should land in the lobby with their characters
  await phone.getByRole("button", { name: /Back to the lobby/ }).click();
  for (const [p] of pages) await p.getByRole("button", { name: /I'm ready/ }).waitFor({ timeout: 10_000 });
  console.log("back in the lobby on both screens");
}
await browser.close();
console.log(`room ${code}; ${ok ? "reached" : "did NOT reach"} ${until}; screenshots in ${out}`);
if (errors.length) console.error(errors.join("\n"));
if (layout.length) console.error(`layout problems:\n${layout.join("\n")}`);
if (!ok || errors.length || layout.length) process.exit(1);
