// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MusicPlayer } from "../src/client/audio/music-player.ts";

const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn(), cancelAndHoldAtTime: vi.fn() });
class TestSource {
  frequency = param();
  type = "sine";
  started = false;
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn(() => { this.started = true; });
  stop = vi.fn((at?: number) => {
    if (!this.started) throw new Error("stop before start");
    if (at === undefined) this.onended?.();
  });
}
class TestAudio {
  static instances: TestAudio[] = [];
  src = "";
  preload = "none";
  loop = false;
  paused = true;
  currentTime = 12;
  constructor() { TestAudio.instances.push(this); }
  load = vi.fn();
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  removeAttribute = vi.fn(() => { this.src = ""; });
}
const testGain = () => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() });
class TestContext {
  static instances: TestContext[] = [];
  currentTime = 1;
  sampleRate = 1000;
  state = "running";
  destination = {};
  oscillators: TestSource[] = [];
  media: TestSource[] = [];
  gains: ReturnType<typeof testGain>[] = [];
  constructor() { TestContext.instances.push(this); }
  createGain = () => { const gain = testGain(); this.gains.push(gain); return gain; };
  createOscillator = () => { const node = new TestSource(); this.oscillators.push(node); return node; };
  createBuffer = (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) });
  createBufferSource = () => this.createOscillator();
  createMediaElementSource = () => { const node = new TestSource(); this.media.push(node); return node; };
  addEventListener = vi.fn();
  suspend = vi.fn(async () => { this.state = "suspended"; });
  resume = vi.fn(async () => { this.state = "running"; });
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const player = () => {
  const ctx = new TestContext();
  const changed = vi.fn();
  const music = new MusicPlayer(ctx as unknown as AudioContext, ctx.createGain() as unknown as GainNode, changed);
  music.enable(true);
  return { music, ctx, changed, decks: TestAudio.instances };
};
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  localStorage.clear();
  TestContext.instances = [];
  TestAudio.instances = [];
  vi.stubGlobal("AudioContext", TestContext);
  vi.stubGlobal("Audio", TestAudio);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("streams two recordings, waits for the incoming audio, then fades and releases the old recording", async () => {
  const { music, ctx, decks } = player();
  music.select("darkWalk"); await settle();
  let resolve!: () => void;
  decks[1].play.mockImplementationOnce(() => new Promise<void>((done) => { resolve = () => { decks[1].paused = false; done(); }; }));
  music.select("lightlessDawn");
  expect(music.getTrack()).toBe("darkWalk");
  expect(decks[0].paused).toBe(false);
  expect(ctx.gains[1].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(.65, 3.4);
  resolve(); await settle();
  expect(music.getTrack()).toBe("lightlessDawn");
  expect(ctx.gains[1].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 3.4);
  vi.advanceTimersByTime(2500);
  expect(decks[0].src).toBe("");
  expect(decks[1].paused).toBe(false);
  const starts = decks[1].play.mock.calls.length;
  music.select("lightlessDawn"); music.levelTo(.8);
  expect(decks[1].play).toHaveBeenCalledTimes(starts);
  expect(ctx.gains[2].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(.8, 1.7);
  music.stop();
  expect(vi.getTimerCount()).toBe(0);
  expect(decks.every((deck) => deck.paused && !deck.src)).toBe(true);
  expect(ctx.media.every((source) => source.disconnect.mock.calls.length)).toBe(true);
});

it("discards stale loads during rapid phase changes and cannot revive music after teardown", async () => {
  const { music, decks } = player();
  let resolve!: () => void;
  decks[0].play.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
  music.select("darkWalk");
  music.select("crypto"); await settle();
  expect(music.getTrack()).toBe("crypto");
  resolve(); await settle();
  expect(music.getTrack()).toBe("crypto");
  let late!: () => void;
  decks[1].play.mockImplementationOnce(() => new Promise<void>((done) => { late = done; }));
  music.select("decisions"); music.stop(); late(); await settle();
  expect(music.getTrack()).toBeNull();
  expect(decks.every((deck) => deck.paused && !deck.src)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("retries blocked playback, preserves mute position, and never downloads a muted initial score", async () => {
  const { music, decks } = player();
  music.enable(false); music.select("docks");
  expect(decks.every((deck) => !deck.src)).toBe(true);
  decks[0].play.mockRejectedValueOnce(new DOMException("gesture required", "NotAllowedError"));
  music.enable(true); await settle();
  expect(music.getTrack()).toBeNull();
  music.enable(true); await settle();
  expect(music.getTrack()).toBe("docks");
  music.enable(false);
  expect(decks[0].paused).toBe(true);
  const loads = decks[0].load.mock.calls.length;
  music.enable(true); await settle();
  expect(decks[0].currentTime).toBe(12);
  expect(decks[0].load).toHaveBeenCalledTimes(loads);
  music.stop();
});

it("keeps the previous score after a failed incoming recording, and a silent beat cancels all playback", async () => {
  const { music, decks } = player();
  music.select("covert"); await settle();
  decks[1].play.mockRejectedValueOnce(new DOMException("decode failed", "NotSupportedError"));
  music.select("roulette"); await settle();
  expect(music.getTrack()).toBe("covert");
  expect(decks[0].paused).toBe(false);
  music.select(null); vi.advanceTimersByTime(1300);
  expect(music.getTrack()).toBeNull();
  expect(decks.every((deck) => deck.paused && !deck.src)).toBe(true);
  music.stop();
});

it("shares one context/two decks through StrictMode and cleans up foley, music and timers", async () => {
  const { audio, SFX } = await import("../src/client/audio/manager.ts");
  const release = audio.acquire();
  audio.setTheme("scenario03_intro"); await settle();
  const ctx = TestContext.instances[0];
  for (const cue of Object.keys(SFX) as (keyof typeof SFX)[]) expect(() => audio.play(cue)).not.toThrow();
  expect(ctx.oscillators.length).toBeGreaterThan(20);
  release(); release();
  expect(ctx.oscillators.every((voice) => voice.disconnect.mock.calls.length)).toBe(true);
  expect(TestAudio.instances.every((deck) => deck.paused && !deck.src)).toBe(true);
  const again = audio.acquire(); audio.setTheme("s01_escape"); await settle();
  expect(TestContext.instances).toHaveLength(1);
  expect(TestAudio.instances).toHaveLength(2);
  expect(audio.getTrack()).toBe("unseenHorrors");
  again();
  expect(ctx.suspend).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it("drops muted/blocked short effects, and backgrounding pauses music until visible", async () => {
  const { audio } = await import("../src/client/audio/manager.ts");
  const release = audio.acquire(); audio.setTheme("intro_train"); await settle();
  const ctx = TestContext.instances[0];
  audio.toggleMute();
  const count = ctx.oscillators.length;
  audio.play("timeline_rewind");
  expect(ctx.oscillators).toHaveLength(count);
  audio.toggleMute(); await settle();
  expect(ctx.oscillators).toHaveLength(count);
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(TestAudio.instances.every((deck) => deck.paused)).toBe(true);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  document.dispatchEvent(new Event("visibilitychange")); await settle();
  expect(TestAudio.instances.some((deck) => !deck.paused)).toBe(true);
  ctx.state = "suspended"; audio.play("title_reveal");
  expect(ctx.oscillators).toHaveLength(count);
  release();
});

it("keeps the presentation usable when Web Audio is unavailable", async () => {
  vi.stubGlobal("AudioContext", undefined);
  const { audio } = await import("../src/client/audio/manager.ts");
  const release = audio.acquire();
  expect(() => { audio.setTheme("scenario03_intro"); audio.play("low_impact"); audio.toggleMute(); }).not.toThrow();
  expect(audio.getTrack()).toBeNull();
  release();
});

it("crossfades on implementations without cancelAndHoldAtTime", async () => {
  const { music, ctx } = player();
  for (const gain of ctx.gains) Object.assign(gain.gain, { cancelAndHoldAtTime: undefined });
  music.select("darkWalk"); await settle();
  expect(music.getTrack()).toBe("darkWalk");
  music.select("crypto"); await settle();
  expect(music.getTrack()).toBe("crypto");
  expect(ctx.gains[1].gain.cancelScheduledValues).toHaveBeenCalledWith(1);
  music.stop();
});
