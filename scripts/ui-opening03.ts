// Real lobby → opening → game, with two isolated viewers. The first run uses
// the real 81-second clock; the second checks Chinese/reduced/muted at 320px.
// --reduced-only / --lifecycle-only rerun focused paths. No game mutations.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { chromium, type Page } from "playwright";
import type { Snapshot } from "../src/shared/protocol.ts";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const out = "/tmp/fate-opening03";
mkdirSync(out, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "fate-opening03-"));
const port = 8097;
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, ["src/server/index.ts"], { env: { ...process.env, NODE_ENV: "production", DATA_DIR: data, PORT: String(port) }, stdio: "ignore" });
const browser = await chromium.launch();
const contexts = await Promise.all([browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), browser.newContext({ viewport: { width: 1280, height: 800 } })]);
const pages = await Promise.all(contexts.map((context) => context.newPage()));
const [phone, desk] = pages;
const errors: string[] = [];
const snapshots = new Map<Page, Snapshot>();
for (const p of pages) {
  p.on("pageerror", (error) => errors.push(String(error)));
  p.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  p.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  p.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => {
    const msg = JSON.parse(String(payload));
    if (msg.snapshot) snapshots.set(p, msg.snapshot);
  }));
  await p.addInitScript(() => {
    const Native = window.AudioContext;
    const stats = { started: 0, live: 0, connected: 0, contexts: 0, state: "unavailable" };
    Object.assign(window, { openingAudioStats: stats });
    if (!Native) return;
    window.AudioContext = class extends Native {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args); stats.contexts++; stats.state = this.state;
        this.addEventListener("statechange", () => { stats.state = this.state; });
      }
      override createOscillator() {
        const node = super.createOscillator();
        const original = node.start.bind(node);
        const connect = node.connect.bind(node);
        const disconnect = node.disconnect.bind(node);
        let connected = false;
        node.connect = ((...args: Parameters<typeof connect>) => { if (!connected) stats.connected++; connected = true; return connect(...args); }) as typeof node.connect;
        node.disconnect = (() => { if (connected) stats.connected--; connected = false; disconnect(); }) as typeof node.disconnect;
        node.start = (...args) => { stats.started++; stats.live++; original(...args); };
        node.addEventListener("ended", () => stats.live--, { once: true });
        return node;
      }
    };
  });
}

async function shot(p: Page, label: string) {
  await p.screenshot({ path: `${out}/${label}.png` });
  assert.deepEqual(await clippedElements(p), [], `${label}: clipped content`);
  assert.deepEqual(await smallTargets(p), [], `${label}: touch targets`);
  // Measure text within the film too; html/body and the fixed film hide overflow.
  const clipping = await p.locator(".s3-film").evaluateAll((films) => films.flatMap((film) => [...film.querySelectorAll("h1,h2,p,dt,dd,li,button")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1);
  }).map((el) => el.textContent)));
  assert.deepEqual(clipping, [], `${label}: film text clipping`);
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

async function lobby(scenario = "03", chinese = false) {
  for (const p of pages) {
    await p.goto(base);
    await p.evaluate(() => localStorage.setItem("fate:locale", "en"));
    await p.reload();
  }
  await phone.getByRole("button", { name: "Create room", exact: true }).click();
  await phone.getByLabel("Your name on the ticket").fill("Opening A");
  await phone.getByRole("dialog").getByRole("button", { name: "Create room" }).click();
  await phone.waitForURL(/\/room\/[A-Z0-9]{6}$/);
  const code = phone.url().slice(-6);
  await desk.goto(`${base}/room/${code}`);
  await desk.getByLabel("Your name on the ticket").fill("Opening B");
  await desk.getByRole("dialog").getByRole("button", { name: "Join room" }).click();
  const scenarioButton = phone.getByRole("button", { name: new RegExp(`^${scenario}`) }).first();
  if (await scenarioButton.getAttribute("aria-pressed") !== "true") await scenarioButton.click();
  await pick(phone, "Scorpio", "ENTP");
  await pick(desk, "Pisces", "ISFJ");
  if (chinese) {
    await phone.evaluate(() => localStorage.setItem("fate:locale", "zh-CN"));
    await phone.reload();
  }
  console.log(`Lobby ${code}: Scenario ${scenario}`);
}

try {
  for (let i = 0; ; i++) {
    if (server.exitCode !== null) throw new Error("test server exited");
    if (await fetch(base).then((r) => r.ok).catch(() => false)) break;
    if (i > 100) throw new Error("test server did not start");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  let firstSession = "";
  const lifecycleOnly = process.argv.includes("--lifecycle-only");
  if (!process.argv.includes("--reduced-only") && !lifecycleOnly) {
    await lobby();
    await phone.getByRole("button", { name: "Enter the Administration", exact: true }).click();
    await Promise.all(pages.map((p) => p.locator('.s3-film[data-scene="sync"]').waitFor()));
    firstSession = snapshots.get(phone)!.game!.sessionId;
    await shot(phone, "01-sync-390");
    for (const scene of ["lockdown", "archive", "dual", "jump", "causal"] as const) {
      await phone.locator(`.s3-film[data-scene="${scene}"]`).waitFor({ timeout: 15000 });
      await phone.waitForTimeout(scene === "archive" ? 7500 : 2200);
      await shot(phone, `${scene}-390`);
      await shot(desk, `${scene}-1280`);
      console.log(`Real clock: ${scene}`);
    }
    assert.equal(snapshots.get(phone)?.game?.round, 1, "server must reach cycle 1 during playback");
    await phone.getByRole("button", { name: "Skip", exact: true }).click();
    await phone.locator(".s3-film").waitFor({ state: "detached" });
    assert.equal(await desk.locator(".s3-film").count(), 1, "Skip must be local");
    await phone.waitForTimeout(1800);
    await shot(phone, "skip-game-390");
    const stats = await phone.evaluate(() => (window as unknown as { openingAudioStats: { contexts: number; live: number } }).openingAudioStats);
    assert.equal(stats.contexts, 1, "one audio context");
    assert.equal(stats.live, 3, "only three ambient pad voices remain after the crossfade");
    await phone.reload();
    await phone.locator(".s3-map-shell").waitFor();
    assert.equal(await phone.locator(".s3-film").count(), 0, "same-run reload must resume game");
    for (const scene of ["records", "mission", "title"] as const) {
      await desk.locator(`.s3-film[data-scene="${scene}"]`).waitFor({ timeout: 20000 });
      await desk.waitForTimeout(scene === "records" ? 7000 : 2200);
      await shot(desk, `${scene}-1280`);
      console.log(`Real clock: ${scene}`);
    }
    await desk.locator(".s3-film").waitFor({ state: "detached", timeout: 15000 });
    await shot(desk, "natural-game-1280");
    assert.equal(await desk.locator("[inert]").count(), 0);
    await desk.getByRole("button", { name: "Incident log", exact: true }).click();
    await desk.keyboard.press("Escape");
  }

  // New server session with the same devices/localStorage; reduced/muted Chinese.
  if (!lifecycleOnly) {
    await phone.setViewportSize({ width: 320, height: 740 });
    for (const p of pages) await p.emulateMedia({ reducedMotion: "reduce" });
    await lobby("03", true);
    for (const p of pages) {
      await p.evaluate(() => localStorage.setItem("fate:muted", "true"));
      await p.reload();
    }
    await phone.getByRole("button", { name: "进入时间管理局", exact: true }).click();
    await Promise.all(pages.map((p) => p.locator(".s3-film").waitFor()));
    assert.notEqual(snapshots.get(phone)?.game?.sessionId, firstSession);
    await desk.getByRole("button", { name: "Skip", exact: true }).click();
    await desk.locator(".s3-film").waitFor({ state: "detached" });
    assert.equal(await phone.locator(".s3-film").count(), 1);
    for (const scene of ["sync", "lockdown", "archive", "dual", "jump", "causal", "records", "mission", "title"] as const) {
      await phone.locator(`.s3-film[data-scene="${scene}"]`).waitFor({ timeout: 15000 });
      await phone.waitForTimeout(scene === "archive" || scene === "records" ? 7500 : 2200);
      await shot(phone, `${scene}-320-zh-reduced-muted`);
      assert.equal(await phone.locator(".s3-film").getAttribute("data-scene"), scene);
      console.log(`Reduced motion / muted: ${scene}`);
    }
    await phone.locator(".s3-film").waitFor({ state: "detached", timeout: 15000 });
    await shot(phone, "natural-game-320");
    await phone.reload();
    await phone.locator(".s3-map-shell").waitFor();
    assert.equal(await phone.locator(".s3-film").count(), 0);
  }

  if (lifecycleOnly) for (const p of pages) {
    await p.goto(base);
    await p.evaluate(() => localStorage.setItem("fate:muted", "true"));
  }

  // Page navigation while playing must release all oscillators immediately.
  await lobby();
  await phone.getByRole("button", { name: "Enter the Administration", exact: true }).click();
  await phone.locator(".s3-film").waitFor();
  await desk.locator(".s3-film").waitFor();
  await desk.reload();
  await desk.locator(".s3-map-shell").waitFor();
  assert.equal(await desk.locator(".s3-film").count(), 0, "reload during playback resumes game");
  await phone.evaluate(() => { history.pushState({}, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await phone.locator(".s3-film").waitFor({ state: "detached" });
  await phone.waitForTimeout(500);
  const released = await phone.evaluate(() => (window as unknown as { openingAudioStats: { connected: number; state: string } }).openingAudioStats);
  // A suspended context can delay `ended`; disconnection + suspension prove
  // silence and release even when those browser events have not run yet.
  assert.equal(released.connected, 0);
  assert.equal(released.state, "suspended");
  assert.equal(await phone.evaluate(() => document.body.style.overflow), "");

  for (const scenario of ["01", "02"]) {
    await lobby(scenario);
    await phone.getByRole("button", { name: "Depart", exact: true }).click();
    await phone.waitForTimeout(1200);
    assert.equal(await phone.locator(".opening-temporal").count(), 0, `Scenario ${scenario} must retain its own intro`);
  }
  assert.deepEqual(errors, []);
  console.log(`Opening walkthrough passed; screenshots: ${out}`);
} catch (error) {
  console.error("Browser errors:", errors);
  console.error("Current server phase:", snapshots.get(phone)?.game?.phase);
  console.error("Current film:", await phone.locator(".s3-film").evaluateAll((els) => els.map((el) => ({ scene: el.getAttribute("data-scene"), text: el.textContent }))));
  await phone.screenshot({ path: `${out}/failure.png` });
  throw error;
} finally {
  await browser.close();
  server.kill("SIGTERM");
  if (server.exitCode === null) await new Promise<void>((resolve) => server.once("exit", () => resolve()));
  rmSync(data, { recursive: true, force: true });
}
