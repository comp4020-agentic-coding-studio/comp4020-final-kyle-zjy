// @vitest-environment jsdom
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { project } from "../src/server/engine/project.ts";
import { openingFrame, OPENING_DURATION, runOpening } from "../src/client/game/scenario03/opening/timeline.ts";
import { openingKey, openingSeen, rememberOpening, shouldOpen } from "../src/client/game/scenario03/opening/memory.ts";
import { seatsFor, SEED, T0 } from "./helpers.ts";

const mocks = vi.hoisted(() => ({
  game: null as unknown,
  send: vi.fn().mockResolvedValue(true),
  release: vi.fn(),
  audio: { acquire: vi.fn(), setTheme: vi.fn(), tension: vi.fn(), play: vi.fn(), getMuted: () => true, subscribe: () => () => {}, toggleMute: vi.fn() },
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
import { Experience03 } from "../src/client/game/scenario03/opening/Experience03.tsx";

let serial = 0;
const fixture = () => project(createGame(`opening-${++serial}`, seatsFor(2), SEED, T0, "S03_INCIDENT_ZERO"), "a");
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
