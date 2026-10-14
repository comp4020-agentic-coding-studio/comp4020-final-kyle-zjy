// One shared owner for streamed authored music and short synthesized foley.
import { MUSIC_CUES, type AudioTheme } from "./catalog.ts";
import { MusicPlayer } from "./music-player.ts";
export type { AudioTheme } from "./catalog.ts";
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
  // gameplay: interface clicks stay quiet, story beats carry weight (GAIN below)
  ui_click: [520, 480, .05], ui_open: [330, 440, .12], ui_close: [440, 330, .1], ui_confirm: [392, 587, .16],
  ui_lock: [196, 98, .22], ui_error: [180, 140, .2], ui_warning: [300, 220, .35], private_message: [740, 988, .4],
  dice_roll: [260, 180, .5], dice_land: [150, 90, .12], roll_perfect: [523, 1047, .9], roll_success: [392, 523, .45],
  roll_fail: [220, 165, .45], roll_disaster: [90, 36, 1.1], item_gain: [587, 880, .3], item_use: [440, 220, .3],
  help_link: [349, 466, .4], trade_offer: [494, 392, .25], trade_done: [392, 659, .4],
  turn_start: [330, 392, .2], turn_end: [392, 294, .2], danger_rise: [80, 52, 1.2], fanfare: [262, 523, 1.6],
} as const satisfies Record<string, readonly [number, number, number]>;

const GAIN: Partial<Record<keyof typeof SFX, number>> = {
  low_impact: .12, auction_gavel: .12, fluorescent_hum: .014,
  ui_click: .02, ui_open: .025, ui_close: .02, ui_confirm: .035, ui_lock: .05, ui_error: .04, ui_warning: .045,
  dice_land: .08, roll_perfect: .08, roll_disaster: .11, danger_rise: .1, fanfare: .08,
};
const TEXTURED = new Set<keyof typeof SFX>(["radio_static", "station_announcement", "invitation_open", "ticket_flip", "card_flip", "chip_slide", "dice_roll", "trade_offer"]);
const SINE = new Set<keyof typeof SFX>(["chip_drop", "private_message", "roll_perfect", "item_gain", "help_link", "fanfare"]);

function readMute() {
  try { return localStorage.getItem("fate:muted") === "true"; } catch { return false; }
}

class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Set<Voice>();
  private music: MusicPlayer | null = null;
  private listeners = new Set<() => void>();
  private theme: AudioTheme | null = null;
  private level = .65;
  private owners = 0;
  private muted = readMute();

  getMuted = () => this.muted;
  getTrack = () => this.music?.getTrack() ?? null;
  private notify = () => this.listeners.forEach((listener) => listener());
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  toggleMute = () => {
    this.muted = !this.muted;
    try { localStorage.setItem("fate:muted", String(this.muted)); } catch { /* device preference remains in memory */ }
    if (!this.muted) this.unlock();
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : .75, this.context.currentTime, .03);
    this.syncMusic();
    this.notify();
  };

  acquire() {
    this.owners++;
    if (this.owners === 1) {
      document.addEventListener("pointerdown", this.unlock);
      document.addEventListener("keydown", this.unlock);
      document.addEventListener("visibilitychange", this.visibility);
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
      document.removeEventListener("visibilitychange", this.visibility);
      this.music?.stop();
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
      this.master.gain.value = this.muted ? 0 : .75;
      this.master.connect(this.context.destination);
      this.music = new MusicPlayer(this.context, this.master, this.notify);
      this.context.addEventListener("statechange", this.syncMusic);
    } catch { /* Audio unavailable: captions and the clock still run. */ }
  }

  private unlock = () => {
    if (!this.owners || this.muted) return;
    this.ensure();
    void this.context?.resume().then(this.syncMusic).catch(() => {});
  };

  private syncMusic = () => this.music?.enable(this.owners > 0 && !this.muted && !document.hidden && this.context?.state === "running");
  private visibility = () => {
    if (document.hidden) { this.stopVoices(true); this.syncMusic(); }
    else this.unlock();
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

  /** Short original paper/radio foley; musical beds are mastered recordings. */
  private texture(kind: "paper", effect = true): Voice | null {
    const ctx = this.context;
    if (!ctx || !this.master) return null;
    const duration = .6;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let noiseSeed = 1947;
    for (let i = 0; i < samples.length; i++) {
      noiseSeed ^= noiseSeed << 13; noiseSeed ^= noiseSeed >>> 17; noiseSeed ^= noiseSeed << 5;
      const noise = (noiseSeed >>> 0) / 2147483648 - 1;
      const time = i / ctx.sampleRate;
      samples[i] = noise * Math.exp(-time * 9) * .3;
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
  }

  setTheme(theme: AudioTheme) {
    if (this.theme === theme || !this.owners) return;
    this.theme = theme;
    this.stopVoices(true);
    this.music?.select(theme === "silence" ? null : MUSIC_CUES[theme]);
    this.syncMusic();
  }

  tension(level: number, seconds?: number) {
    if (level === this.level) return;
    this.level = level;
    this.music?.levelTo(level, seconds);
  }

  /** Cuts any short effect still sounding, so a closed cinematic leaves no foley behind. */
  hush() { this.stopVoices(true); }

  play(cue: OpeningSfx) {
    // Never queue muted/blocked effects to play unexpectedly after unmuting.
    if (this.muted || document.hidden || !this.owners || this.context?.state !== "running") return;
    const [from, to, seconds] = SFX[cue];
    if (TEXTURED.has(cue)) this.texture("paper", true);
    this.tone(from, to, seconds, GAIN[cue] ?? .065, true, SINE.has(cue) ? "sine" : undefined);
  }
}

export const audio = new AudioManager();
