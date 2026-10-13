// A single, asset-free Web Audio owner. Cinematics and gameplay share mute,
// autoplay recovery, voices and crossfades; no network audio is requested.
export type AudioTheme = "silence" | "intro_train" | "s01_ambient" | "intro_flood" | "s02_city_ambient" | "intro_auction" | "s04_auction_ambient" | "scenario03_intro" | "scenario03_2026_ambient" | "scenario03_1996_ambient";
export type OpeningSfx = keyof typeof SFX;

type Voice = { oscillator: AudioScheduledSourceNode; gain: GainNode; effect: boolean };
export const SFX = {
  temporal_sync_error: [180, 58, .8], security_lock: [92, 42, .3],
  archive_scan: [240, 680, .55], low_impact: [65, 27, 1.1],
  crt_noise: [110, 135, .6], timeline_rewind: [720, 38, 2],
  timeline_shift: [85, 260, 1.2], record_corruption: [155, 48, .7],
  title_reveal: [98, 196, 1.7],
  phone_notification: [660, 880, .32], train_arrival: [44, 65, 3.5],
  train_door: [440, 330, .7], ticket_flip: [310, 100, .2],
  record_glitch: [110, 75, .45], memory_whisper: [180, 300, 1.3], ticket_punch: [160, 40, .12],
  fluorescent_hum: [100, 100, 5], station_announcement: [260, 180, 2.2],
  emergency_broadcast: [440, 280, 1.5], map_alert: [392, 294, .4],
  road_collapse: [63, 29, 1], water_rise: [70, 120, 1.8],
  distress_signal: [540, 470, .7], ship_horn_distant: [98, 92, 2.5], radio_static: [190, 170, 1.3],
  invitation_open: [300, 130, .45], door_unlock: [180, 120, .18], door_close: [78, 35, .5],
  chip_drop: [1500, 830, .12], lot_reveal: [220, 293.7, .8],
  card_flip: [220, 110, .18], chip_slide: [640, 250, .4], auction_gavel: [140, 46, .24],
} as const satisfies Record<string, readonly [number, number, number]>;

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

  private tone(from: number, to: number, duration: number | null, amplitude: number, effect: boolean, wave?: OscillatorType): Voice | null {
    const ctx = this.context;
    if (!ctx || !this.master) return null;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = wave ?? (effect ? "triangle" : "sine");
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

  /** Original deterministic synthesis, with no game RNG and no audio URLs. */
  private texture(kind: "rain" | "lounge" | "paper", effect = false): Voice | null {
    const ctx = this.context;
    if (!ctx || !this.master) return null;
    const duration = kind === "lounge" ? 8 : kind === "paper" ? .6 : 2;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let noiseSeed = 1947;
    let low = 0;
    const chords = [146.83, 174.61, 220, 261.63, 164.81, 196, 246.94, 293.66];
    for (let i = 0; i < samples.length; i++) {
      noiseSeed ^= noiseSeed << 13; noiseSeed ^= noiseSeed >>> 17; noiseSeed ^= noiseSeed << 5;
      const noise = (noiseSeed >>> 0) / 2147483648 - 1;
      low = low * .96 + noise * .04;
      const time = i / ctx.sampleRate;
      if (kind === "lounge") {
        const beat = time % .5;
        const note = chords[Math.floor(time / .5) % chords.length];
        const piano = (Math.sin(2 * Math.PI * note * time) + .22 * Math.sin(4 * Math.PI * note * time)) * Math.exp(-beat * 12);
        const bass = Math.sin(2 * Math.PI * (time < 4 ? 73.415 : 82.405) * time) * Math.exp(-(time % 2) * 2);
        samples[i] = piano * .23 + bass * .3 + noise * Math.exp(-beat * 65) * .045;
      } else samples[i] = kind === "paper" ? noise * Math.exp(-time * 9) * .3 : noise * .14 + low * .8;
    }
    const oscillator = ctx.createBufferSource();
    const gain = ctx.createGain();
    oscillator.buffer = buffer;
    oscillator.loop = !effect;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(effect ? .12 : .055 * this.level, ctx.currentTime + (effect ? .02 : 1.2));
    oscillator.connect(gain); gain.connect(this.master);
    const voice = { oscillator, gain, effect };
    this.voices.add(voice);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    oscillator.start();
    if (effect) oscillator.stop(ctx.currentTime + duration);
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
    const base = theme.includes("train") || theme === "s01_ambient" ? 41.2 : theme.includes("flood") || theme === "s02_city_ambient" ? 55 : theme === "scenario03_intro" ? 49 : theme === "scenario03_1996_ambient" ? 55 : 65.4;
    const auction = theme.includes("auction");
    const flood = theme.includes("flood") || theme === "s02_city_ambient";
    const frequencies = theme === "silence" || auction ? [] : [base, base * 1.5, base * 2.003];
    this.pads = frequencies.map((frequency) => this.tone(frequency, frequency, null, .025 * this.level, false)).filter((v): v is Voice => v !== null);
    if (auction || flood) {
      const texture = this.texture(auction ? "lounge" : "rain");
      if (texture) this.pads.push(texture);
    }
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
    if (["radio_static", "station_announcement", "invitation_open", "ticket_flip", "card_flip", "chip_slide"].includes(cue)) this.texture("paper", true);
    this.tone(from, to, seconds, cue === "low_impact" || cue === "auction_gavel" ? .12 : cue === "fluorescent_hum" ? .014 : .065, true, cue === "chip_drop" ? "sine" : undefined);
  }
}

export const audio = new AudioManager();
