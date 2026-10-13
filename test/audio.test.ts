// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
class TestOscillator {
  frequency = param();
  type = "sine";
  started = false;
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn(() => { this.started = true; });
  stop = vi.fn((at?: number) => {
    // Browsers reject stop-before-start, even for a future scheduled stop.
    if (!this.started) throw new Error("stop before start");
    if (at === undefined) this.onended?.();
  });
}
class TestContext {
  static instances: TestContext[] = [];
  currentTime = 1;
  sampleRate = 1000;
  state = "running";
  destination = {};
  oscillators: TestOscillator[] = [];
  constructor() { TestContext.instances.push(this); }
  createGain = () => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() });
  createOscillator = () => { const node = new TestOscillator(); this.oscillators.push(node); return node; };
  createBuffer = (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) });
  createBufferSource = () => this.createOscillator();
  suspend = vi.fn(async () => { this.state = "suspended"; });
  resume = vi.fn(async () => { this.state = "running"; });
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  TestContext.instances = [];
  vi.stubGlobal("AudioContext", TestContext);
});
afterEach(() => vi.unstubAllGlobals());

it("starts every short cue before scheduling its stop and crossfades old pads", async () => {
  const { audio } = await import("../src/client/audio/manager.ts");
  const release = audio.acquire();
  audio.setTheme("scenario03_intro");
  for (const cue of ["temporal_sync_error", "security_lock", "archive_scan", "low_impact", "crt_noise", "timeline_rewind", "timeline_shift", "record_corruption", "title_reveal"] as const) expect(() => audio.play(cue)).not.toThrow();
  const ctx = TestContext.instances[0];
  const pads = ctx.oscillators.slice(0, 3);
  const effects = ctx.oscillators.slice(3);
  audio.setTheme("scenario03_2026_ambient");
  for (const effect of effects) expect(effect.disconnect).toHaveBeenCalled();
  for (const pad of pads) expect(pad.stop).toHaveBeenLastCalledWith(2.2);
  release();
  for (const voice of ctx.oscillators) expect(voice.disconnect).toHaveBeenCalled();
  expect(ctx.suspend).toHaveBeenCalledTimes(1);
});

it("shares one context across StrictMode release/reacquire and forgets blocked/muted effects", async () => {
  const { audio } = await import("../src/client/audio/manager.ts");
  const release = audio.acquire();
  audio.setTheme("scenario03_intro");
  release();
  const releaseAgain = audio.acquire();
  audio.setTheme("scenario03_intro");
  const ctx = TestContext.instances[0];
  expect(TestContext.instances).toHaveLength(1);
  audio.toggleMute();
  const count = ctx.oscillators.length;
  audio.play("timeline_rewind");
  expect(ctx.oscillators).toHaveLength(count);
  audio.toggleMute();
  expect(ctx.oscillators).toHaveLength(count);
  ctx.state = "suspended";
  audio.play("title_reveal");
  expect(ctx.oscillators).toHaveLength(count);
  releaseAgain();
  releaseAgain();
  expect(ctx.suspend).toHaveBeenCalledTimes(2);
});

it("keeps the complete presentation usable when Web Audio is unavailable", async () => {
  vi.stubGlobal("AudioContext", undefined);
  const { audio } = await import("../src/client/audio/manager.ts");
  const release = audio.acquire();
  expect(() => { audio.setTheme("scenario03_intro"); audio.play("low_impact"); audio.toggleMute(); }).not.toThrow();
  release();
});

it("gives the new worlds distinct textures and releases every synthesized source", async () => {
  const { audio, SFX } = await import("../src/client/audio/manager.ts");
  const release = audio.acquire();
  audio.setTheme("silence");
  const ctx = TestContext.instances[0];
  expect(ctx.oscillators).toHaveLength(0);
  for (const theme of ["intro_train", "s01_ambient", "intro_flood", "s02_city_ambient", "intro_auction", "s04_auction_ambient"] as const) expect(() => audio.setTheme(theme)).not.toThrow();
  for (const cue of Object.keys(SFX) as (keyof typeof SFX)[]) expect(() => audio.play(cue)).not.toThrow();
  release();
  expect(ctx.oscillators.length).toBeGreaterThan(20);
  for (const voice of ctx.oscillators) expect(voice.disconnect).toHaveBeenCalled();
});
