// The scenario 02 endgame in a real browser (two isolated contexts), from the
// scattered start to the results:
//
//   random start (two zones, neither the pier) → act 1: the boat made ready
//   by fitting its last part, no boarding vote → round 6 opens act 2 (the
//   act-2 deadline; the pumps are holding) → boarding: Kyle boards → Kyle is
//   aboard: no more turns, only the "you're aboard" notice → Bea walks to the
//   power station and restarts the generator: the first try fails (rigged),
//   nothing ends, the button comes back next round → she tries again until it
//   catches → the boat leaves → results (Kyle escaped, Bea ran the generator)
//
// It runs its own server on its own port and data directory, and checks the
// process it started is the one answering (never a stale server on another
// port). After both players set out it stops the server and stages the run in
// its SQLite file (round 5, Collapse 4, the boat missing only the navigation
// module that Kyle carries, Kyle at the pier with a pass, Bea next to the power
// station with no Fate, abilities spent, a quiet event deck, Bea's next die a
// 2), restarts it and lets both browsers reconnect, so nothing test-only is
// built into the app.
//
//   pnpm build && node scripts/ui-play02-departure.ts [--out /tmp/fate-departure] [--phone 390] [--port 8097]
//
// Fails on: two players starting in one zone or at the pier, a boarding vote
// in act 1, "Your turn" for a player aboard, a failed restart that ends or
// stalls the run, a scene stacked on an open decision, the wrong results,
// clipped content or targets under 48 px.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { chromium, type Locator, type Page } from "playwright";
import { applyFlood } from "../src/server/engine/scenario02/city.ts";
import { zoneIndex } from "../src/shared/game/scenario02/map.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const out = arg("out", "/tmp/fate-departure");
mkdirSync(out, { recursive: true });
const dataDir = mkdtempSync(join(tmpdir(), "fate-departure-"));
const port = Number(arg("port", "8097"));
const base = `http://localhost:${port}`;

let server: ChildProcess | null = null;
/** Starts this script's own server, and makes sure it is the process listening on the port. */
async function startServer(): Promise<void> {
  server = spawn(process.execPath, ["src/server/index.ts"], { env: { ...process.env, NODE_ENV: "production", DATA_DIR: dataDir, PORT: String(port) }, stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`the server exited (code ${server.exitCode}); is port ${port} already taken?`);
    if (await fetch(base).then((r) => r.ok).catch(() => false)) {
      const owner = execFileSync("ss", ["-ltnpH", `sport = :${port}`]).toString();
      if (!owner.includes(`pid=${server.pid},`)) throw new Error(`port ${port} is answered by another process:\n${owner}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start");
}
async function stopServer(): Promise<void> {
  const s = server;
  server = null;
  if (!s || s.exitCode !== null) return;
  await new Promise<void>((r) => {
    s.once("exit", () => r());
    s.kill("SIGTERM");
  });
}

const failures: string[] = [];
const fail = (why: string) => {
  if (!failures.includes(why)) failures.push(why);
};
const layout: string[] = [];
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
async function tap(l: Locator): Promise<boolean> {
  try {
    await l.click({ timeout: 2500 });
    return true;
  } catch {
    return false;
  }
}
const visible = (l: Locator) => l.first().isVisible().catch(() => false);
const enabled = async (l: Locator) => (await visible(l)) && (await l.first().getAttribute("aria-disabled").catch(() => "true")) !== "true";

await startServer();
const browser = await chromium.launch();
const phone = await (await browser.newContext({ viewport: { width: Number(arg("phone", "390")), height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const desk = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pages: [Page, string][] = [
  [phone, "phone"],
  [desk, "desktop"],
];
const errors: string[] = [];
for (const [p] of pages) p.on("pageerror", (e) => errors.push(String(e)));

try {
  // the lobby: the host picks scenario 02, both choose and set out
  async function pick(p: Page, sign: string, type: RegExp) {
    await p.getByRole("button", { name: "Choose character" }).click();
    await p.getByRole("button", { name: sign, exact: true }).click();
    await p.getByRole("button", { name: `Choose ${sign}` }).click();
    await p.getByRole("button", { name: type }).click();
    await p.getByRole("button", { name: new RegExp(`Reveal ${sign}`) }).click();
    await p.getByRole("button", { name: "Skip" }).click();
    await p.getByRole("button", { name: "I'm ready" }).click();
  }
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
  await pick(phone, "Scorpio", /ENTP/);
  await pick(desk, "Pisces", /ISFJ/);
  await phone.getByRole("button", { name: "Depart" }).click();
  for (const [p] of pages) await p.getByRole("button", { name: "Into the water" }).waitFor({ timeout: 20_000 });
  await phone.waitForTimeout(6000);
  for (const [p] of pages) await tap(p.getByRole("button", { name: "Into the water" }));
  await Promise.race(pages.map(([p]) => p.getByText("Your turn", { exact: true }).waitFor({ timeout: 20_000 })));

  // the scattered start, as each screen shows it: two different zones, neither the pier
  const here = async (p: Page) => ((await p.locator('[role="button"][aria-label*="you are here"]').first().getAttribute("aria-label").catch(() => null)) ?? "").split(",")[0];
  const [kyleAt, beaAt] = [await here(phone), await here(desk)];
  for (const [p, tag] of pages) await shotOnce(p, tag, "start");
  if (!kyleAt || !beaAt || kyleAt === beaAt) fail(`the two players didn't start in two different zones (${kyleAt} / ${beaAt})`);
  if ([kyleAt, beaAt].includes("Evacuation Pier")) fail("a player started at the pier");

  // stage the run
  await stopServer();
  const db = new DatabaseSync(join(dataDir, "fate.db"));
  const row = db.prepare("SELECT s.id, s.state_json FROM rooms r JOIN game_sessions s ON s.id = r.current_session WHERE r.code = ?").get(code) as { id: string; state_json: string };
  const s = JSON.parse(row.state_json) as GameState;
  const city = s.city!;
  const kyle = Object.values(s.players).find((x) => x.nickname === "Kyle")!;
  const bea = Object.values(s.players).find((x) => x.nickname === "Bea")!;
  const [PIER, POWER, MALL] = [zoneIndex("HARBOUR"), zoneIndex("POWER_STATION"), zoneIndex("MALL")];
  Object.assign(s, { round: 5, collapse: 4, eventDeck: Array(12).fill("S2_SALVAGE") });
  for (const z of [POWER, MALL]) Object.assign(city.zones[z], { floodAt: 99, sinkAt: 99 });
  for (const e of city.edges) if ((e.a === MALL && e.b === POWER) || (e.a === POWER && e.b === MALL)) Object.assign(e, { broken: false, breakAt: null });
  applyFlood({ s, now: Date.now(), events: [] });
  city.hold = 9; // round 5's water holds: act 2 comes from the round-6 deadline, not the sea
  city.boat.installed = ["ENGINE", "FUEL"];
  city.facilities.POWER_STATION.done = true;
  city.facilities.HARBOUR_GATE.done = true;
  city.holdings[kyle.playerId] = { parts: ["NAV"], passes: 1 };
  Object.assign(kyle, { carriageIndex: PIER });
  Object.assign(bea, { carriageIndex: MALL, fate: 0, items: [], nextRaw: 2 });
  for (const x of [kyle, bea]) x.skill = { ...x.skill, usesLeft: 0, state: "BURNED" };
  db.prepare("UPDATE game_sessions SET state_json = ? WHERE id = ?").run(JSON.stringify(s), row.id);
  db.close();
  await startServer();
  for (const [p] of pages) await p.reload();

  const header = (p: Page) => p.locator("header").first().innerText().catch(() => "");
  const actOf = async (p: Page) => (await header(p)).match(/\bAct (I+)\b/i)?.[1]?.toUpperCase() ?? "?";
  const roundOf = async (p: Page) => Number((await header(p)).match(/Round (\d+)/)?.[1] ?? NaN);
  let installed = false;
  let sawEarly = false;
  let boarded = false;
  let aboardNotice = false;
  const attempts: number[] = [];
  let failedThenContinued = false;
  let resultsReached = false;

  for (let step = 0; step < 900 && !resultsReached; step++) {
    let acted = false;
    for (const [p, tag] of pages) {
      const mine = p === phone ? "Kyle" : "Bea";
      const act = await actOf(p);
      const decision = p.locator('[role="dialog"][aria-modal="true"]');
      const decisionText = (await visible(decision)) ? await decision.first().innerText().catch(() => "") : "";
      const pill = (await p.getByRole("status").allInnerTexts().catch(() => [] as string[])).join(" ");
      if ((decisionText.includes("Board the boat?") || pill.includes("Board the boat?")) && act === "I") fail(`${tag}: a boarding vote in act I`);
      // the old freeze: a vote open (its "answered" pill, or a second modal) under a scene showing "Waiting for…"
      const waitingScene = await visible(p.getByRole("button", { name: /^Waiting for/ }));
      if (waitingScene && (/answered/.test(pill) || (await decision.count()) > 1)) fail(`${tag}: a scene's "waiting" button over an open decision [${pill.slice(0, 80)}]`);

      // the results
      const results = p.getByRole("button", { name: "See the results" });
      if (await visible(results)) {
        await p.waitForTimeout(3500);
        await shotOnce(p, tag, "ending");
        acted = (await results.isEnabled().catch(() => false)) && (await tap(results));
        continue;
      }
      if (await visible(p.getByRole("button", { name: /Back to the lobby|Leave/ }))) {
        if (p === desk) {
          await shotOnce(p, tag, "results");
          const text = await p.locator("main").innerText();
          if (!text.includes("RAN THE GENERATOR")) fail("the results don't show Bea running the generator");
          if (!text.includes("The Last Engineer")) fail("the results don't give Bea 'The Last Engineer'");
          if (!text.includes("ESCAPED")) fail("the results don't show Kyle escaping");
          resultsReached = true;
        }
        continue;
      }
      const cont = p.getByRole("button", { name: "Continue" });
      if (await visible(cont)) {
        await p.waitForTimeout(1500);
        await shotOnce(p, tag, `scene-${act}`);
        acted = (await cont.isEnabled().catch(() => false)) && (await tap(cont));
        continue;
      }
      const keep = p.getByRole("button", { name: /Keep it/ });
      if (await visible(keep)) {
        acted = await tap(keep);
        continue;
      }
      if (decisionText) {
        if (decisionText.includes("Board the boat?")) {
          await shotOnce(p, tag, "boarding-vote");
          acted = await tap(decision.first().getByRole("button", { name: "Board" }));
          boarded = acted && p === phone;
        } else acted = await tap(decision.first().getByRole("button").first());
        continue;
      }
      const yourTurn = await visible(p.getByText("Your turn", { exact: true }));
      // aboard: the notice, never a turn
      if (p === phone && boarded) {
        if (yourTurn) fail("Kyle is aboard but is shown 'Your turn'");
        if (await visible(p.getByText("You're aboard the escape boat", { exact: false }))) {
          aboardNotice = true;
          await shotOnce(p, tag, "aboard");
        }
      }
      if (act === "I" && (await visible(p.getByText("The evacuation window isn't open yet", { exact: false })))) {
        sawEarly = true;
        await shotOnce(p, tag, "ready-in-act-1");
      }
      if (!yourTurn) continue;
      // Kyle fits the last part in act 1
      if (mine === "Kyle" && !installed && (await enabled(p.locator('[data-action="INSTALL"]')))) {
        await tap(p.locator('[data-action="INSTALL"]'));
        acted = await tap(p.getByText("Fit what to the boat?").locator("xpath=../..").getByRole("button", { name: /Navigation Module/ }));
        installed = acted;
        continue;
      }
      // Bea: to the power station, then the generator once someone is aboard
      if (mine === "Bea") {
        const restart = p.locator('[data-action="RESTART_GENERATOR"]');
        if (await enabled(restart)) {
          const round = await roundOf(p);
          if (attempts.includes(round)) fail("the generator could be tried twice in one round");
          attempts.push(round);
          await shotOnce(p, tag, `restart-${attempts.length === 1 ? "first" : "again"}`);
          acted = await tap(restart);
          await p.waitForTimeout(2500);
          continue;
        }
        if (!(await here(p)).startsWith("Power Station") && (await enabled(p.locator('[data-action="MOVE"]')))) {
          await tap(p.locator('[data-action="MOVE"]'));
          acted = await tap(p.getByText("Move where?").locator("xpath=../..").getByRole("button", { name: /^Power Station/ }));
          continue;
        }
      }
      const end = p.getByRole("button", { name: /End turn/ });
      if (await enabled(end)) {
        await shotOnce(p, tag, `city-act-${act}`);
        acted = await tap(end);
      }
    }
    if (attempts.length >= 2 && !failedThenContinued) failedThenContinued = attempts[1] > attempts[0];
    if (!acted && !resultsReached) await phone.waitForTimeout(300);
  }

  if (!installed) fail("Kyle never fitted the last part");
  if (!sawEarly) fail("never saw 'boarding waits for act 2' while the boat was ready in act 1");
  if (!boarded) fail("Kyle never boarded");
  if (!aboardNotice) fail("Kyle never saw the 'you're aboard' notice");
  if (attempts.length < 2 || !failedThenContinued) fail(`the generator wasn't retried in a later round after the rigged failure (attempts in rounds ${attempts.join(", ") || "none"})`);
  if (!resultsReached) fail("never reached the results");
  console.log(`room ${code}; start ${kyleAt} / ${beaAt}; restarts in rounds ${attempts.join(", ")}; ${resultsReached ? "reached the results" : "did NOT reach the results"}; screenshots in ${out}`);
} finally {
  await browser.close();
  await stopServer();
  rmSync(dataDir, { recursive: true, force: true });
}

if (failures.length) console.error(`failures:\n  ${failures.join("\n  ")}`);
if (layout.length) console.error(`layout problems:\n  ${layout.join("\n  ")}`);
if (errors.length) console.error(`page errors:\n  ${errors.join("\n  ")}`);
if (failures.length || layout.length || errors.length) process.exit(1);
