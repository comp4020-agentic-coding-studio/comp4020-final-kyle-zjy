// Browser integration against the real HTTP/WebSocket/projection stack.
// Public-stage fixtures isolate score/UI behavior; they are never production routes.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { chromium, type Page } from "playwright";
import { openDb } from "../src/server/db/db.ts";
import { GameStore } from "../src/server/game/store.ts";
import { GameRunner } from "../src/server/game/runner.ts";
import { RoomService } from "../src/server/rooms/service.ts";
import { Hub } from "../src/server/rooms/hub.ts";
import { createApp } from "../src/server/http.ts";
import { startGame, applyGameAction } from "../src/server/engine/engine.ts";
import { startEnding } from "../src/server/engine/ending.ts";
import { openFinal04 } from "../src/server/engine/scenario04/final.ts";
import { MUSIC_CUES, MUSIC_TRACKS, type AudioTheme } from "../src/client/audio/catalog.ts";
import type { GameState, Outcome, ScenarioId } from "../src/shared/game/state.ts";
import { clippedElements, smallTargets } from "./lib/layout-check.ts";

const out = "/tmp/fate-music-ui";
mkdirSync(out, { recursive: true });
const now = Date.now() + 86400000;
const db = openDb(":memory:");
const games = new GameStore(db);
const rooms = new RoomService(db, games);
const runner = new GameRunner(db, games, () => now);
const hub = new Hub(rooms, runner);
const server = serve({ fetch: createApp(rooms, hub).fetch, hostname: "127.0.0.1", port: 8098 });
const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (request, socket, head) => wss.handleUpgrade(request, socket, head, (ws) => hub.attach(ws, request)));
const base = "http://127.0.0.1:8098";
const browser = await chromium.launch();
const errors: string[] = [];
type ProbeWindow = Window & { musicMedia: HTMLAudioElement[] };
async function probe(page: Page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => {
    const Native = window.Audio;
    const media: HTMLAudioElement[] = [];
    Object.assign(window, { musicMedia: media });
    window.Audio = class extends Native { constructor() { super(); media.push(this); } };
  });
}
async function verify(page: Page, cue: AudioTheme, label: string) {
  assert(cue !== "silence");
  const file = MUSIC_TRACKS[MUSIC_CUES[cue]].file;
  await page.waitForFunction((path) => (window as unknown as ProbeWindow).musicMedia.some((media) => media.currentSrc.endsWith(path) && !media.paused && media.currentTime > .1), file, { timeout: 15000 });
  await page.waitForTimeout(2600);
  const media = await page.evaluate(() => (window as unknown as ProbeWindow).musicMedia.map((m) => ({ src: m.currentSrc, paused: m.paused, time: m.currentTime, duration: m.duration, error: m.error?.code })));
  assert.equal(media.length, 2, `${label}: two reusable decks`);
  assert.equal(media.filter((m) => !m.paused).length, 1, `${label}: old recording stopped`);
  assert(media.filter((m) => !m.paused).every((m) => m.duration > 30 && !m.error));
  assert.deepEqual(await clippedElements(page), [], label);
  assert.deepEqual(await smallTargets(page), [], label);
  console.log(`${label}: ${MUSIC_TRACKS[MUSIC_CUES[cue]].title}`);
}
const scenarios: ScenarioId[] = ["S01_LAST_TRAIN", "S02_SUNKEN_CITY", "S03_INCIDENT_ZERO", "S04_UNDERGROUND_AUCTION"];
try {
  for (const scenario of scenarios) {
    const first = rooms.createRoom("Score A", undefined);
    const second = rooms.joinRoom(first.roomCode, "Score B", undefined);
    const ids = [first.playerId, second.playerId];
    ids.forEach((id, i) => db.prepare("UPDATE room_members SET zodiac=?, mbti=?, stage='READY' WHERE room_code=? AND player_id=?").run(i ? "pisces" : "scorpio", i ? "ISFJ" : "ENTP", first.roomCode, id));
    db.prepare("UPDATE rooms SET scenario_id=? WHERE code=?").run(scenario, first.roomCode);
    const seats = ids.map((playerId, seat) => ({ playerId, seat, nickname: `Score ${seat}`, zodiac: seat ? "pisces" as const : "scorpio" as const, mbti: seat ? "ISFJ" as const : "ENTP" as const }));
    let g = startGame(games.create(first.roomCode, seats, now, undefined, scenario), now).state;
    for (const id of ids) g = applyGameAction(g, id, { type: "ACK_SEQUENCE" }, now).state;
    g.round = 2;
    games.save(first.roomCode, g, { kind: "TICK", at: now });
    const active = runner.state(first.roomCode)!;
    const contexts = await Promise.all([browser.newContext({ viewport: { width: 1280, height: 800 } }), browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" })]);
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    for (const [i, page] of pages.entries()) {
      await probe(page);
      await page.goto(base);
      await page.evaluate(({ token, locale, muted }) => { localStorage.setItem("fate:token", token); localStorage.setItem("fate:locale", locale); localStorage.setItem("fate:muted", String(muted)); }, { token: i ? second.sessionToken : first.sessionToken, locale: i ? "zh-CN" : "en", muted: !!i });
      await page.goto(`${base}/room/${first.roomCode}`);
      await page.locator(".audio-controls").waitFor();
    }
    const [desk, phone] = pages;
    // A real user gesture grants autoplay, independent of browser defaults.
    await desk.getByRole("button", { name: "Sound on", exact: true }).click();
    await desk.getByRole("button", { name: "Sound off", exact: true }).click();
    const publish = (mutate: (s: GameState) => void) => { mutate(active); active.version++; games.save(first.roomCode, active, { kind: "TICK", at: now }); hub.broadcast(first.roomCode); };
    const stages: [string, AudioTheme, (s: GameState) => void][] = scenario === "S01_LAST_TRAIN" ? [
      ["investigation", "s01_ambient", () => {}], ["anomaly", "s01_anomaly", (s) => { s.phase = "ACT_2"; s.act = 2; }], ["escape", "s01_escape", (s) => { s.phase = "ACT_3"; s.act = 3; }],
    ] : scenario === "S02_SUNKEN_CITY" ? [
      ["rescue", "s02_city_ambient", () => {}], ["rising", "s02_rising", (s) => { s.phase = "ACT_2"; s.act = 2; }], ["evacuation", "s02_evacuation", (s) => { s.phase = "ACT_3"; s.act = 3; }],
    ] : scenario === "S03_INCIDENT_ZERO" ? [
      ["present", "scenario03_2026_ambient", () => {}], ["past", "scenario03_1996_ambient", (s) => { s.temporal!.locations[ids[0]].year = "Y1996"; }], ["past-paradox", "s03_past_paradox", (s) => { s.phase = "ACT_2"; s.act = 2; }], ["present-paradox", "s03_paradox", (s) => { s.temporal!.locations[ids[0]].year = "Y2026"; }], ["rewrite", "s03_rewrite", (s) => { s.phase = "ACT_3"; s.act = 3; }], ["decision", "s03_resolution", (s) => { s.phase = "ACT_4"; s.act = 4; }],
    ] : [
      ["early", "s04_auction_ambient", () => {}], ["negotiation", "s04_bargains", (s) => { s.round = 4; }], ["stakes", "s04_highstakes", (s) => { s.round = 7; }], ["settlement", "s04_settlement", (s) => { s.round = 10; s.auction!.currentLot = "LOT_10"; openFinal04({ s, now, events: [] }); }], ["sealed", "s04_sealed", (s) => { s.auction!.final!.stage = "AUCTION"; }], ["reveal", "s04_reveal", (s) => { s.auction!.final!.stage = "REVEAL"; }],
    ];
    for (const [label, cue, mutate] of stages) { publish(mutate); await verify(desk, cue, `${scenario}/${label}`); }
    // The incoming score is a full recording, and its native loop crosses the seam.
    await desk.evaluate(() => { const m = (window as unknown as ProbeWindow).musicMedia.find((m) => !m.paused)!; m.currentTime = m.duration - .3; });
    await desk.waitForFunction(() => (window as unknown as ProbeWindow).musicMedia.some((m) => !m.paused && m.currentTime < 3));
    assert((await phone.evaluate(() => (window as unknown as ProbeWindow).musicMedia)).length === 2);
    assert(await phone.evaluate(() => (window as unknown as ProbeWindow).musicMedia.every((m) => m.paused && !m.getAttribute("src"))));
    for (const [page, name] of [[desk, "desktop"], [phone, "phone"]] as const) {
      await page.locator(".music-credits > summary").click();
      await page.screenshot({ path: `${out}/${scenario}-${name}-credits.png` });
      assert.deepEqual(await smallTargets(page), []);
      assert.deepEqual(await clippedElements(page), []);
      if (page === phone) { await page.setViewportSize({ width: 320, height: 740 }); await page.screenshot({ path: `${out}/${scenario}-320-credits.png` }); assert.deepEqual(await clippedElements(page), []); }
      await page.locator(".music-credits > summary").click();
    }
    const outcome: Outcome = scenario === "S01_LAST_TRAIN" ? "NORMAL" : scenario === "S02_SUNKEN_CITY" ? "S02_EVACUATED" : scenario === "S03_INCIDENT_ZERO" ? "S03_OFFICIAL_HISTORY" : "S04_EXIT";
    publish((s) => startEnding({ s, now, events: [] }, outcome));
    const ending: AudioTheme = scenario === "S01_LAST_TRAIN" ? "s01_ending" : scenario === "S02_SUNKEN_CITY" ? "s02_ending" : scenario === "S03_INCIDENT_ZERO" ? "s03_ending" : "s04_ending";
    await verify(desk, ending, `${scenario}/ending`);
    publish((s) => { s.phase = "RESULTS"; s.sequence = null; });
    await verify(desk, ending, `${scenario}/results`);
    await desk.evaluate(() => { history.pushState({}, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); });
    assert(await desk.evaluate(() => (window as unknown as ProbeWindow).musicMedia.every((m) => m.paused && !m.getAttribute("src"))));
    await Promise.all(contexts.map((context) => context.close()));
  }
  assert.deepEqual(errors, []);
  console.log(`Public stages, real recordings, loops, mute, credits, ending/results and cleanup passed: ${out}`);
} catch (error) {
  console.error(errors);
  for (const [i, context] of browser.contexts().entries()) for (const page of context.pages()) await page.screenshot({ path: `${out}/failure-${i}.png` }).catch(() => {});
  throw error;
} finally {
  await browser.close(); hub.close(); runner.close(); wss.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  db.close();
}
