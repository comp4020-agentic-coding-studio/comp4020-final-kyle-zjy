// @vitest-environment jsdom
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { project } from "../src/server/engine/project.ts";
import { openingFrame, OPENING_DURATION, runOpening } from "../src/client/game/scenario03/opening/timeline.ts";
import { openingKey, openingSeen, rememberOpening, shouldOpen } from "../src/client/game/scenario03/opening/memory.ts";
import { seatsFor, SEED, T0 } from "./helpers.ts";
import type { ScenarioId } from "../src/shared/game/state.ts";
import { OPENINGS } from "../src/client/game/opening/definitions.ts";
import { durationOf } from "../src/client/game/opening/timeline.ts";

const mocks = vi.hoisted(() => ({
  game: null as unknown,
  send: vi.fn().mockResolvedValue(true),
  release: vi.fn(),
  audio: { acquire: vi.fn(), setTheme: vi.fn(), tension: vi.fn(), play: vi.fn(), getMuted: () => true, getTrack: () => null, subscribe: () => () => {}, toggleMute: vi.fn() },
}));
vi.hoisted(() => { Object.defineProperty(window, "AnimationEvent", { configurable: true, value: window.Event }); });
// Lifecycle tests own only application timers; real Motion and CSS run in
// the two-browser walkthrough, where animation events and rendering exist.
vi.mock("motion/react", async () => {
  const { createElement } = await import("react");
  return {
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: { div: ({ initial: _i, animate: _a, exit: _e, transition: _t, ...props }: Record<string, unknown>) => createElement("div", props) },
  };
});
vi.mock("../src/client/audio/manager.ts", () => ({ audio: mocks.audio }));
vi.mock("../src/client/store.ts", () => ({
  useGame: () => mocks.game,
  useStore: (select: (s: unknown) => unknown) => select({ status: "online" }),
  sendGame: mocks.send,
}));
vi.mock("../src/client/i18n/index.ts", () => ({ useT: () => (key: string) => key }));
vi.mock("../src/client/screens/Scenario03Screens.tsx", () => ({ Scenario03Game: () => createElement("button", { "data-game": true }, "game") }));
vi.mock("../src/client/game/opening/TrainOpening.tsx", () => ({ TrainOpening: () => createElement("div", null, "train") }));
vi.mock("../src/client/game/opening/FloodOpening.tsx", () => ({ FloodOpening: () => createElement("div", null, "flood") }));
vi.mock("../src/client/game/opening/AuctionOpening.tsx", () => ({ AuctionOpening: () => createElement("div", null, "auction") }));
import { Experience03 } from "../src/client/game/scenario03/opening/Experience03.tsx";
import { ScenarioExperience } from "../src/client/game/opening/ScenarioExperience.tsx";

let serial = 0;
const fixture = (scenario: ScenarioId = "S03_INCIDENT_ZERO") => project(createGame(`opening-${++serial}`, seatsFor(2), SEED, T0, scenario), "a");
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.audio.acquire.mockImplementation(() => mocks.release);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("Scenario 03 opening lifecycle", () => {
  it("keeps playback through StrictMode, snapshot updates and INTRO → ACT_1 without holding the server", async () => {
    const g = fixture();
    mocks.game = g;
    await act(async () => root.render(createElement(StrictMode, null, createElement(Experience03))));
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenCalledWith({ type: "ACK_SEQUENCE" });
    await act(async () => vi.advanceTimersByTime(16000));
    expect(host.querySelector('[data-scene="archive"]')).not.toBeNull();
    mocks.game = { ...g, phase: "ACT_1", round: 1, version: 2, sequence: null };
    await act(async () => root.render(createElement(StrictMode, null, createElement(Experience03))));
    expect(host.querySelector('[data-scene="archive"]')).not.toBeNull();
    expect(host.querySelector("[data-game]")?.closest("[inert]")).not.toBeNull();
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("Skip stops the single clock, crossfades, then releases the overlay and input", async () => {
    mocks.game = fixture();
    await act(async () => root.render(createElement(Experience03)));
    // Skip during the deliberate silent beat immediately before the brief.
    await act(async () => vi.advanceTimersByTime(64700));
    const skip = host.querySelector<HTMLButtonElement>(".s3-film-skip")!;
    await act(async () => skip.click());
    expect(mocks.audio.setTheme).toHaveBeenLastCalledWith("scenario03_2026_ambient");
    expect(mocks.audio.tension).toHaveBeenLastCalledWith(.65);
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => host.querySelector(".s3-film")!.dispatchEvent(new Event("animationend", { bubbles: true })));
    expect(host.querySelector("[role=dialog]")).toBeNull();
    expect(host.querySelector("[inert]")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("naturally finishes, and unmount releases audio and every scheduled callback", async () => {
    const timeouts = vi.spyOn(globalThis, "setTimeout");
    const clear = vi.spyOn(globalThis, "clearTimeout");
    mocks.game = fixture();
    await act(async () => root.render(createElement(Experience03)));
    await act(async () => vi.advanceTimersByTime(OPENING_DURATION * 1000));
    expect(host.querySelector(".s3-film")).toBeNull();
    expect(host.querySelector("[inert]")).toBeNull();
    await act(async () => root.unmount());
    expect(mocks.release).toHaveBeenCalledTimes(1);
    const hintIndex = timeouts.mock.calls.findIndex((call) => call[1] === 12000);
    expect(clear).toHaveBeenCalledWith(timeouts.mock.results[hintIndex].value);
    // React schedules an Immediate to flush act work after the unmount.
    await act(async () => vi.advanceTimersByTime(0));
    expect(vi.getTimerCount()).toBe(0);
    timeouts.mockRestore();
    clear.mockRestore();
    // A fresh root allows afterEach to clean up without unmounting twice.
    root = createRoot(host);
  });

  it("unmounting halfway cancels captions and sounds; remounting this run resumes gameplay", async () => {
    const g = fixture();
    mocks.game = g;
    await act(async () => root.render(createElement(Experience03)));
    await act(async () => vi.advanceTimersByTime(20000));
    await act(async () => root.unmount());
    const sounds = mocks.audio.play.mock.calls.length;
    await act(async () => vi.advanceTimersByTime(90000));
    expect(mocks.audio.play).toHaveBeenCalledTimes(sounds);
    expect(vi.getTimerCount()).toBe(0);
    root = createRoot(host);
    await act(async () => root.render(createElement(Experience03)));
    expect(host.querySelector(".s3-film")).toBeNull();
  });
});

describe("per-player/run memory and centralized timeline", () => {
  it("separates players and runs, including reload during playback and denied storage", () => {
    const g = fixture();
    expect(shouldOpen(g)).toBe(true);
    rememberOpening(openingKey(g));
    expect(shouldOpen(g)).toBe(false);
    expect(shouldOpen({ ...g, viewerId: "another-player" })).toBe(true);
    expect(shouldOpen({ ...g, sessionId: "new-run" })).toBe(true);
    expect(shouldOpen({ ...g, scenarioId: "S01_LAST_TRAIN", sessionId: "train" })).toBe(false);
    expect(shouldOpen({ ...g, scenarioId: "S02_SUNKEN_CITY", sessionId: "city" })).toBe(false);
    expect(shouldOpen({ ...g, phase: "ACT_2", round: 4, sessionId: "late-join" })).toBe(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    rememberOpening("private-mode");
    expect(openingSeen("private-mode")).toBe(true);
    vi.restoreAllMocks();
  });

  it("delivers the founding contradiction before the dual timelines, and completion only once", () => {
    expect(openingFrame(18).caption).toBe("s3.open.narration.founded");
    expect(openingFrame(22).caption).toBe("s3.open.narration.impossible");
    expect(openingFrame(25).id).toBe("dual");
    const finish = vi.fn();
    const update = vi.fn();
    const stop = runOpening(update, finish);
    vi.advanceTimersByTime(OPENING_DURATION * 1000 + 5000);
    expect(finish).toHaveBeenCalledTimes(1);
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe.each(["S01_LAST_TRAIN", "S02_SUNKEN_CITY", "S04_UNDERGROUND_AUCTION"] as const)("shared presentation in %s", (scenario) => {
  const renderExperience = () => root.render(createElement(ScenarioExperience, { children: createElement("button", { "data-game": true }, "game") }));
  it("starts once in StrictMode, survives the server phase change and naturally releases input", async () => {
    const g = fixture(scenario);
    mocks.game = g;
    await act(async () => root.render(createElement(StrictMode, null, createElement(ScenarioExperience, { children: createElement("button", { "data-game": true }, "game") }))));
    expect(mocks.send).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(17000));
    const scene = host.querySelector("[data-scene]")?.getAttribute("data-scene");
    mocks.game = { ...g, phase: "ACT_1", round: 1, version: 2, sequence: null };
    await act(async () => root.render(createElement(StrictMode, null, createElement(ScenarioExperience, { children: createElement("button", { "data-game": true }, "game") }))));
    expect(host.querySelector("[data-scene]")?.getAttribute("data-scene")).toBe(scene);
    await act(async () => vi.advanceTimersByTime((durationOf(OPENINGS[scenario].scenes) - 17) * 1000));
    expect(host.querySelector("[role=dialog]")).toBeNull();
    expect(host.querySelector("[inert]")).toBeNull();
    expect(mocks.audio.setTheme).toHaveBeenLastCalledWith(OPENINGS[scenario].ambientTheme);
  });
  it("Skip cancels playback and unmounting releases resources; the next session plays again", async () => {
    mocks.game = fixture(scenario);
    await act(async () => renderExperience());
    await act(async () => vi.advanceTimersByTime(20000));
    await act(async () => host.querySelector<HTMLButtonElement>(".s3-film-skip")!.click());
    expect(mocks.audio.setTheme).toHaveBeenLastCalledWith(OPENINGS[scenario].ambientTheme);
    await act(async () => host.querySelector(".s3-film")!.dispatchEvent(new Event("animationend", { bubbles: true })));
    expect(host.querySelector("[inert]")).toBeNull();
    await act(async () => root.unmount());
    await act(async () => vi.advanceTimersByTime(0));
    expect(vi.getTimerCount()).toBe(0);
    expect(mocks.release).toHaveBeenCalledTimes(1);
    root = createRoot(host);
    await act(async () => renderExperience());
    expect(host.querySelector(".s3-film")).toBeNull();
    await act(async () => root.unmount());
    mocks.game = fixture(scenario);
    root = createRoot(host);
    await act(async () => renderExperience());
    expect(host.querySelector(".s3-film")).not.toBeNull();
  });
});

it("acquires audio before the first emergency cue, with no missing initial owner", async () => {
  const order: string[] = [];
  mocks.audio.acquire.mockImplementation(() => { order.push("acquire"); return mocks.release; });
  mocks.audio.play.mockImplementation(() => { order.push("sound"); });
  mocks.game = fixture("S02_SUNKEN_CITY");
  await act(async () => root.render(createElement(ScenarioExperience, { children: createElement("button", null, "game") })));
  await act(async () => vi.advanceTimersByTime(300));
  expect(order).toEqual(["acquire", "sound"]);
  expect(mocks.audio.play).toHaveBeenCalledWith("emergency_broadcast");
  mocks.audio.play.mockReset();
});

it("hands Skip to the latest public stage and keeps one audio owner through Ending and Results", async () => {
  const g = fixture("S02_SUNKEN_CITY");
  mocks.game = g;
  const render = () => root.render(createElement(ScenarioExperience, { children: createElement("button", { "data-game": true }, "game") }));
  await act(async () => render());
  await act(async () => vi.advanceTimersByTime(38000));
  expect(mocks.audio.setTheme).toHaveBeenLastCalledWith("s02_rising");
  mocks.audio.setTheme.mockClear();
  mocks.game = { ...g, phase: "ACT_3", round: 8, sequence: null };
  await act(async () => render());
  expect(mocks.audio.setTheme).not.toHaveBeenCalled();
  await act(async () => host.querySelector<HTMLButtonElement>(".s3-film-skip")!.click());
  expect(mocks.audio.setTheme).toHaveBeenLastCalledWith("s02_evacuation");
  await act(async () => host.querySelector(".s3-film")!.dispatchEvent(new Event("animationend", { bubbles: true })));
  mocks.game = { ...g, phase: "ENDING", outcome: "S02_EVACUATED" };
  await act(async () => render());
  expect(mocks.audio.setTheme).toHaveBeenLastCalledWith("s02_ending");
  mocks.game = { ...g, phase: "RESULTS", outcome: "S02_EVACUATED" };
  await act(async () => render());
  expect(mocks.audio.acquire).toHaveBeenCalledTimes(1);
  expect(mocks.release).not.toHaveBeenCalled();
});
