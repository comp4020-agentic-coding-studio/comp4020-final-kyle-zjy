// A single, asset-free Web Audio owner. Cinematics and gameplay share mute,
// autoplay recovery, voices and crossfades; no network audio is requested.
export type AudioTheme = "scenario03_intro" | "scenario03_2026_ambient" | "scenario03_1996_ambient";
export type OpeningSfx = "temporal_sync_error" | "security_lock" | "archive_scan" | "low_impact" | "crt_noise" | "timeline_rewind" | "timeline_shift" | "record_corruption" | "title_reveal";

type Voice = { oscillator: OscillatorNode; gain: GainNode; effect: boolean };
const SFX: Record<OpeningSfx, readonly [number, number, number]> = {
  temporal_sync_error: [180, 58, .8], security_lock: [92, 42, .3],
  archive_scan: [240, 680, .55], low_impact: [65, 27, 1.1],
  crt_noise: [110, 135, .6], timeline_rewind: [720, 38, 2],
  timeline_shift: [85, 260, 1.2], record_corruption: [155, 48, .7],
  title_reveal: [98, 196, 1.7],
};

function readMute() {
  try { return localStorage.getItem("fate:muted") === "true"; } catch { return false; }
}

class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Set<Voice>();
  private pads: Voice[] = [];
  private listeners = new Set<() => void>();
  private theme: AudioTheme | null = null;
  private level = .65;
  private owners = 0;
  private muted = readMute();

  getMuted = () => this.muted;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  toggleMute = () => {
    this.muted = !this.muted;
    try { localStorage.setItem("fate:muted", String(this.muted)); } catch { /* device preference remains in memory */ }
    if (!this.muted) this.unlock();
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : .45, this.context.currentTime, .03);
    this.listeners.forEach((listener) => listener());
  };

  acquire() {
    this.owners++;
    if (this.owners === 1) {
      document.addEventListener("pointerdown", this.unlock);
      document.addEventListener("keydown", this.unlock);
      this.ensure();
      this.unlock();
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--this.owners > 0) return;
      document.removeEventListener("pointerdown", this.unlock);
      document.removeEventListener("keydown", this.unlock);
      this.stopVoices();
      this.theme = null;
      // Keep one suspended context for the next run rather than accumulating contexts.
      void this.context?.suspend().catch(() => {});
    };
  }

  private ensure() {
    if (this.context || typeof AudioContext === "undefined") return;
    try {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : .45;
      this.master.connect(this.context.destination);
    } catch { /* Audio unavailable: captions and the clock still run. */ }
  }

  private unlock = () => {
    if (!this.owners || this.muted) return;
    this.ensure();
    void this.context?.resume().catch(() => {});
  };

  private tone(from: number, to: number, duration: number | null, amplitude: number, effect: boolean): Voice | null {
    const ctx = this.context;
    if (!ctx || !this.master) return null;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = effect ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(from, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(amplitude, ctx.currentTime + (effect ? .03 : 1.2));
    oscillator.connect(gain);
    gain.connect(this.master);
    const voice = { oscillator, gain, effect };
    this.voices.add(voice);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    oscillator.start();
    if (duration !== null) {
      oscillator.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + duration);
      gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
      oscillator.stop(ctx.currentTime + duration + .05);
    }
    return voice;
  }

  private stopVoice(voice: Voice) {
    voice.oscillator.onended = null;
    try { voice.oscillator.stop(); } catch { /* already ended */ }
    voice.oscillator.disconnect();
    voice.gain.disconnect();
    this.voices.delete(voice);
  }

  private stopVoices(effectsOnly = false) {
    for (const voice of this.voices) if (!effectsOnly || voice.effect) this.stopVoice(voice);
    if (!effectsOnly) this.pads = [];
  }

  setTheme(theme: AudioTheme, fade = 1.2) {
    if (this.theme === theme || !this.owners) return;
    this.theme = theme;
    this.stopVoices(true);
    const ctx = this.context;
    if (!ctx) return;
    for (const voice of this.pads) {
      voice.gain.gain.cancelScheduledValues(ctx.currentTime);
      voice.gain.gain.setTargetAtTime(0, ctx.currentTime, Math.max(.03, fade / 4));
      voice.oscillator.stop(ctx.currentTime + fade);
    }
    const base = theme === "scenario03_intro" ? 49 : theme === "scenario03_1996_ambient" ? 55 : 65.4;
    this.pads = [base, base * 1.5, base * 2.003].map((frequency) => this.tone(frequency, frequency, null, .025 * this.level, false)).filter((v): v is Voice => v !== null);
  }

  tension(level: number) {
    if (level === this.level) return;
    this.level = level;
    if (this.context) for (const voice of this.pads) voice.gain.gain.setTargetAtTime(.025 * level, this.context.currentTime, level === 0 ? .03 : .6);
  }

  play(cue: OpeningSfx) {
    // Never queue muted/blocked effects to play unexpectedly after unmuting.
    if (this.muted || this.context?.state !== "running") return;
    const [from, to, seconds] = SFX[cue];
    this.tone(from, to, seconds, cue === "low_impact" ? .12 : .065, true);
  }
}

export const audio = new AudioManager();
