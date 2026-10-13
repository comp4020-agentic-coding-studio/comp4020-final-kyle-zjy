// Real-time openings in isolated viewers: English/sound at 390px and
// Chinese/reduced/muted at 1280px, with every new scene also checked at 320px.
// node scripts/ui-openings.ts [--scenario 01|02|03|04|all]
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import type { Snapshot } from "../src/shared/protocol.ts";
import { OPENINGS } from "../src/client/game/opening/definitions.ts";
import type { ScenarioId } from "../src/shared/game/state.ts";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const out = "/tmp/fate-openings";
mkdirSync(out, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "fate-openings-"));
const base = "http://localhost:8099";
const browser = await chromium.launch();
const server = spawn(process.execPath, ["src/server/index.ts"], { env: { ...process.env, NODE_ENV: "production", DATA_DIR: data, PORT: "8099" }, stdio: "ignore" });
const errors: string[] = [];
const states = new Map<Page, Snapshot>();
const scenarioArg = process.argv.indexOf("--scenario");
const selected = scenarioArg < 0 ? "all" : process.argv[scenarioArg + 1];
const scenarios = Object.keys(OPENINGS).filter((id) => selected === "all" || id.slice(1, 3) === selected) as ScenarioId[];
assert(scenarios.length, "choose 01, 02, 03, 04 or all");

async function probe(p: Page) {
  p.on("pageerror", (error) => errors.push(String(error)));
  p.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  p.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  p.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => { const msg = JSON.parse(String(payload)); if (msg.snapshot) states.set(p, msg.snapshot); }));
  await p.addInitScript(() => {
    const stats = { contexts: 0, connected: 0, state: "unavailable" };
    Object.assign(window, { openingAudioStats: stats });
    const Native = window.AudioContext;
    if (!Native) return;
    function track<T extends AudioScheduledSourceNode>(source: T): T {
      const connect = source.connect.bind(source);
      const disconnect = source.disconnect.bind(source);
      let connected = false;
      source.connect = ((...args: Parameters<typeof connect>) => { if (!connected) stats.connected++; connected = true; return connect(...args); }) as typeof source.connect;
      source.disconnect = (() => { if (connected) stats.connected--; connected = false; disconnect(); }) as typeof source.disconnect;
      return source;
    }
    window.AudioContext = class extends Native {
      constructor(...args: ConstructorParameters<typeof AudioContext>) { super(...args); stats.contexts++; stats.state = this.state; this.addEventListener("statechange", () => { stats.state = this.state; }); }
      override createOscillator() { return track(super.createOscillator()); }
      override createBufferSource() { return track(super.createBufferSource()); }
    };
  });
}
async function shot(p: Page, name: string) {
  await p.screenshot({ path: `${out}/${name}.png` });
  assert.deepEqual(await clippedElements(p), [], `${name}: clipping`);
  assert.deepEqual(await smallTargets(p), [], `${name}: touch targets`);
  const clips = await p.locator(".s3-film").evaluateAll((films) => films.flatMap((film) => [...film.querySelectorAll("h1,h2,p,li,button")].filter((el) => {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return r.width > 0 && style.visibility !== "hidden" && (r.left < -1 || r.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1);
  }).map((el) => el.textContent)));
  assert.deepEqual(clips, [], `${name}: film text clipped`);
}
async function pick(p: Page, sign: string, type: string) {
  await p.getByRole("button", { name: "Choose character" }).click();
  await p.getByRole("button", { name: sign, exact: true }).click();
  await p.getByRole("button", { name: `Choose ${sign}` }).click();
  await p.getByRole("button", { name: new RegExp(type) }).click();
  await p.getByRole("button", { name: new RegExp(`Reveal ${sign}`) }).click();
  await p.getByRole("button", { name: "Skip", exact: true }).click();
  await p.getByRole("button", { name: "I'm ready" }).click();
}
async function lobby(phone: Page, desk: Page, id: ScenarioId) {
  for (const p of [phone, desk]) { await p.goto(base); await p.evaluate(() => localStorage.setItem("fate:locale", "en")); await p.reload(); }
  await phone.getByRole("button", { name: "Create room", exact: true }).click();
  await phone.getByLabel("Your name on the ticket").fill("Opener A");
  await phone.getByRole("dialog").getByRole("button", { name: "Create room" }).click();
  await phone.waitForURL(/\/room\/[A-Z0-9]{6}$/);
  await desk.goto(`${base}/room/${phone.url().slice(-6)}`);
  await desk.getByLabel("Your name on the ticket").fill("Opener B");
  await desk.getByRole("dialog").getByRole("button", { name: "Join room" }).click();
  const choice = phone.getByRole("button", { name: new RegExp(`^${id.slice(1, 3)}`) }).first();
  if (await choice.getAttribute("aria-pressed") !== "true") await choice.click();
  await pick(phone, "Scorpio", "ENTP"); await pick(desk, "Pisces", "ISFJ");
  await desk.evaluate(() => { localStorage.setItem("fate:locale", "zh-CN"); localStorage.setItem("fate:muted", "true"); });
  await desk.reload();
}
const depart = (scenario: ScenarioId) => scenario === "S03_INCIDENT_ZERO" ? "Enter the Administration" : scenario === "S04_UNDERGROUND_AUCTION" ? "Take your seats" : "Depart";
const audioStats = (p: Page) => p.evaluate(() => (window as unknown as { openingAudioStats: { contexts: number; connected: number; state: string } }).openingAudioStats);

try {
  for (let i = 0; ; i++) {
    if (server.exitCode !== null) throw new Error("test server exited");
    if (await fetch(base).then((r) => r.ok).catch(() => false)) break;
    if (i > 100) throw new Error("test server did not start");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  for (const id of scenarios) {
    const contexts = await Promise.all([browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" })]);
    const [phone, desk] = await Promise.all(contexts.map((context) => context.newPage()));
    await probe(phone); await probe(desk); await lobby(phone, desk, id);
    const definition = OPENINGS[id];
    await phone.getByRole("button", { name: depart(id), exact: true }).click();
    await Promise.all([phone, desk].map((p) => p.locator(`.opening-${definition.variant}`).waitFor()));
    const session = states.get(phone)!.game!.sessionId;
    let skipped = false;
    for (const [index, scene] of definition.scenes.entries()) {
      if (scene.id === "handoff") continue;
      await desk.locator(`[data-scene="${scene.id}"]`).waitFor({ timeout: 16000 });
      await desk.waitForTimeout(["phones", "tickets", "manifest", "memory", "title", "chips", "catalogue", "archive", "route", "protocol", "mission"].includes(scene.id) ? Math.min(scene.duration - 1.7, 5.5) * 1000 : 1700);
      await shot(desk, `${id}-${scene.id}-1280-zh-reduced-muted`);
      const mobile = skipped ? desk : phone;
      await mobile.setViewportSize({ width: 390, height: 844 });
      await shot(mobile, `${id}-${scene.id}-390`);
      await mobile.setViewportSize({ width: 320, height: 740 });
      await shot(mobile, `${id}-${scene.id}-320`);
      await mobile.setViewportSize(skipped ? { width: 1280, height: 800 } : { width: 390, height: 844 });
      if (scene.id === "capacity") {
        const text = await desk.locator(".capacity-terminal").innerText();
        assert(text.includes("尚未确认")); assert(!/\d/.test(text));
      }
      if (id === "S04_UNDERGROUND_AUCTION" && scene.id === "chips") assert.equal(await desk.locator(".chip-deal > i").count(), 8);
      if (index === (id === "S04_UNDERGROUND_AUCTION" ? 3 : 4)) {
        assert.equal(states.get(phone)?.game?.round, 1, "server is running during playback");
        await phone.getByRole("button", { name: "Skip", exact: true }).click();
        await phone.locator(".s3-film").waitFor({ state: "detached" });
        assert.equal(await desk.locator(".s3-film").count(), 1, "one viewer cannot skip another");
        await phone.waitForTimeout(1800);
        const stats = await audioStats(phone);
        assert.equal(stats.contexts, 1);
        assert.equal(stats.connected, id === "S02_SUNKEN_CITY" ? 4 : id === "S04_UNDERGROUND_AUCTION" ? 1 : 3, "no leftover cinematic voices");
        await shot(phone, `${id}-skipped-game-390`);
        await phone.reload(); await phone.locator(".s3-game-entry:not([inert])").waitFor();
        assert.equal(await phone.locator(".s3-film").count(), 0, "refresh resumes the same game");
        skipped = true;
      }
      console.log(`${id}: ${scene.id} verified at 1280 / 390 / 320`);
    }
    await desk.locator(".s3-film").waitFor({ state: "detached", timeout: 15000 });
    assert.equal(await desk.locator("[inert]").count(), 0);
    await shot(desk, `${id}-natural-game-1280`);
    if (id === "S04_UNDERGROUND_AUCTION") assert.equal(await desk.locator('[data-s4-transition="1"]').count(), 1);
    await desk.locator("main header").getByRole("button").last().click();
    await desk.keyboard.press("Escape");
    // Same browser storage, new server session: another film. Reload during
    // playback on one viewer and SPA-unmount on the other.
    await lobby(phone, desk, id);
    await phone.getByRole("button", { name: depart(id), exact: true }).click();
    await phone.locator(".s3-film").waitFor(); await desk.locator(".s3-film").waitFor();
    assert.notEqual(states.get(phone)?.game?.sessionId, session);
    await desk.reload(); await desk.locator(".s3-game-entry:not([inert])").waitFor();
    assert.equal(await desk.locator(".s3-film").count(), 0);
    await phone.evaluate(() => { history.pushState({}, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await phone.locator(".s3-film").waitFor({ state: "detached" }); await phone.waitForTimeout(500);
    assert.equal((await audioStats(phone)).connected, 0);
    assert.equal(await phone.evaluate(() => document.body.style.overflow), "");
    await Promise.all(contexts.map((context) => context.close()));
    console.log(`${id}: complete, Skip, reload, new session and teardown passed`);
  }
  assert.deepEqual(errors, []);
  console.log(`All selected opening walkthroughs passed. Screenshots: ${out}`);
} catch (error) {
  console.error("Browser errors:", errors);
  for (const context of browser.contexts()) for (const p of context.pages()) await p.screenshot({ path: `${out}/failure-${context === browser.contexts()[0] ? "phone" : "desk"}.png` }).catch(() => {});
  throw error;
} finally {
  await browser.close(); server.kill("SIGTERM");
  if (server.exitCode === null) await new Promise<void>((resolve) => server.once("exit", () => resolve()));
  rmSync(data, { recursive: true, force: true });
}
