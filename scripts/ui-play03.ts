// Plays a two-browser scenario 03 run (Incident Zero) on its scenario-02
// layout, for checking its screens in a real browser:
//
//   node scripts/ui-play03.ts [--out /tmp/fate-play03] [--phone 390] [--port 8096] [--rounds 5]
//
// It runs its own server on its own port and data directory and checks the
// process it started is the one answering. The host picks scenario 03; both
// set out. Each turn a player uses the dock: a 1996 intervention if one is
// open (its picker, first choice), else Investigate, else a time jump once a
// round, else a move (the Move picker), then ends the turn. Decisions take
// their first option; scenes are acknowledged. Once each, it opens the log
// and "Only you know" drawers and looks at another room on the map. Each kind
// of screen is photographed once and checked for content clipped past the
// edge and touch targets under 48 px; the run fails on any, on a page error,
// or if it doesn't get through `--rounds` rounds.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const out = arg("out", "/tmp/fate-play03");
mkdirSync(out, { recursive: true });
const dataDir = mkdtempSync(join(tmpdir(), "fate-play03-"));
const port = Number(arg("port", "8096"));
const rounds = Number(arg("rounds", "5"));
const base = `http://localhost:${port}`;

let server: ChildProcess | null = null;
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
    await l.first().click({ timeout: 2500 });
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
let reached = 0;
let code = "";

try {
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
  code = phone.url().slice(-6);
  await desk.goto(`${base}/room/${code}`);
  await desk.getByLabel("Your name on the ticket").fill("Bea");
  await desk.getByRole("dialog").getByRole("button", { name: "Join room" }).click();
  await phone.getByRole("button", { name: /^03/ }).first().click();
  await pick(phone, "Scorpio", /ENTP/);
  await pick(desk, "Pisces", /ISFJ/);
  await phone.getByRole("button", { name: "Enter the Administration" }).click();
  for (const [p] of pages) await p.getByRole("button", { name: "Enter the Administration" }).waitFor({ timeout: 20_000 });
  for (const [p, tag] of pages) await shotOnce(p, tag, "intro");
  for (const [p] of pages) await tap(p.getByRole("button", { name: "Enter the Administration" }));

  const header = (p: Page) => p.locator("header").first().innerText().catch(() => "");
  // the top bar reads "ACT I · CYCLE", then the cycle "n / 12", then the collapse gauge
  const roundOf = async (p: Page) => Number((await header(p)).match(/(\d+) \/ 12/)?.[1] ?? 0);
  const did = new Map<string, Set<string>>();
  const once = (tag: string, round: number, what: string) => {
    const k = `${tag}:${round}`;
    const set = did.get(k) ?? new Set<string>();
    did.set(k, set);
    if (set.has(what)) return false;
    set.add(what);
    return true;
  };

  for (let step = 0; step < 900 && reached < rounds; step++) {
    let acted = false;
    for (const [p, tag] of pages) {
      const round = await roundOf(p);
      reached = Math.max(reached, round - 1);
      const cont = p.getByRole("button", { name: /^Continue/ });
      if (await visible(cont)) {
        await p.waitForTimeout(1200);
        await shotOnce(p, tag, "scene");
        acted = await tap(cont);
        continue;
      }
      const keep = p.getByRole("button", { name: /Keep it/ });
      if (await visible(keep)) {
        await shotOnce(p, tag, "dice");
        if (tag === "desktop" && !seen.has("dice-reload-desktop")) {
          seen.add("dice-reload-desktop");
          await p.reload();
          await keep.waitFor({ timeout: 10_000 });
          await shotOnce(p, tag, "dice-reconnected");
        }
        acted = await tap(keep);
        continue;
      }
      const decision = p.locator('[role="dialog"][aria-modal="true"]');
      if (await visible(decision)) {
        await shotOnce(p, tag, "decision");
        acted = await tap(decision.first().getByRole("button"));
        continue;
      }
      // once each: the drawers and another room on the map
      if (!seen.has(`secrets-${tag}`) && (await tap(p.getByRole("button", { name: /^Your secrets \(/ })))) {
        await shotOnce(p, tag, "secrets");
        await p.keyboard.press("Escape");
        continue;
      }
      if (!seen.has(`log-${tag}`) && (await tap(p.getByRole("button", { name: "Incident log" })))) {
        await shotOnce(p, tag, "log");
        await p.keyboard.press("Escape");
        continue;
      }
      if (!seen.has(`room-${tag}`) && (await tap(p.locator(".s3-room-node[aria-pressed=false]")))) {
        await shotOnce(p, tag, "room");
        await tap(p.getByRole("button", { name: "Back to my room" }));
        continue;
      }
      if (!(await visible(p.getByText("Your turn", { exact: true })))) continue;
      await shotOnce(p, tag, `turn-act-${(await header(p)).match(/Act (I+V?|IV)/i)?.[1] ?? "?"}`);
      const dockAction = (type: string) => p.locator(`[data-action="${type}"]`);
      const firstChoice = (title: RegExp) => p.getByText(title).locator("xpath=../..").getByRole("button").nth(1);
      if ((await enabled(dockAction("INTERVENE"))) && once(tag, round, "intervene")) {
        await tap(dockAction("INTERVENE"));
        await shotOnce(p, tag, "picker-intervene");
        acted = await tap(firstChoice(/Which decision/));
        continue;
      }
      if ((await enabled(dockAction("INVESTIGATE"))) && once(tag, round, "investigate")) {
        acted = await tap(dockAction("INVESTIGATE"));
        continue;
      }
      if ((await enabled(dockAction("TIME_JUMP"))) && once(tag, round, "jump")) {
        acted = await tap(dockAction("TIME_JUMP"));
        continue;
      }
      if ((await enabled(dockAction("MOVE"))) && once(tag, round, "move")) {
        await tap(dockAction("MOVE"));
        await shotOnce(p, tag, "picker-move");
        acted = await tap(firstChoice(/Move where/));
        continue;
      }
      const end = p.getByRole("button", { name: /End turn/ });
      if (await enabled(end)) acted = await tap(end);
    }
    if (!acted) await phone.waitForTimeout(300);
  }
  for (const [p, tag] of pages) await shotOnce(p, tag, "last");
} finally {
  await browser.close();
  await stopServer();
  rmSync(dataDir, { recursive: true, force: true });
}

const ok = reached >= rounds;
console.log(`room ${code}; played ${reached} full rounds; screenshots in ${out}`);
if (!ok) console.error(`did NOT get through ${rounds} rounds`);
if (layout.length) console.error(`layout problems:\n  ${layout.join("\n  ")}`);
if (errors.length) console.error(`page errors:\n  ${errors.join("\n  ")}`);
if (!ok || layout.length || errors.length) process.exit(1);
