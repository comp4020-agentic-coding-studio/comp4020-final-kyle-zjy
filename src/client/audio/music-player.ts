import { MUSIC_TRACKS, type MusicTrackId } from "./catalog.ts";

type Deck = { element: HTMLAudioElement; source: MediaElementAudioSourceNode; gain: GainNode; track: MusicTrackId | null };

/** Two streaming decks bound memory use regardless of the number of recordings. */
export class MusicPlayer {
  private decks: Deck[];
  private active: number | null = null;
  private pending: number | null = null;
  private desired: MusicTrackId | null = null;
  private enabled = false;
  private level = .65;
  private generation = 0;
  private connected = true;
  private output: GainNode;
  private retiring = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(context: AudioContext, output: GainNode, notify: () => void) {
    this.context = context;
    this.output = output;
    this.notify = notify;
    this.decks = Array.from({ length: 2 }, () => {
      const element = new Audio();
      element.preload = "none";
      element.loop = true;
      const source = context.createMediaElementSource(element);
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(output);
      return { element, source, gain, track: null };
    });
  }
  private context: AudioContext;
  private notify: () => void;
  getTrack = () => this.active === null ? null : this.decks[this.active].track;

  select(track: MusicTrackId | null) {
    if (track === this.desired) return;
    this.desired = track;
    this.reconcile();
  }

  /** Also retries a rejected autoplay promise on the next real user gesture. */
  enable(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      if (!this.connected) {
        for (const deck of this.decks) { deck.source.connect(deck.gain); deck.gain.connect(this.output); }
        this.connected = true;
      }
      this.reconcile();
    }
    else {
      this.generation++;
      this.pending = null;
      for (let i = 0; i < this.decks.length; i++) {
        this.cancelRetirement(i);
        this.decks[i].element.pause();
        this.ramp(i, 0, 0);
        if (i !== this.active) this.clear(i);
      }
    }
  }

  /** `seconds` lets a cinematic fade the score out slowly instead of the default ramp. */
  levelTo(level: number, seconds?: number) {
    this.level = Math.max(0, Math.min(1.3, level));
    if (this.active !== null && this.enabled) this.ramp(this.active, this.level, seconds ?? (level === 0 ? .08 : .7));
  }

  private reconcile() {
    if (!this.enabled) return;
    if (this.desired === null) {
      this.generation++;
      if (this.pending !== null) this.clear(this.pending);
      this.pending = null;
      if (this.active !== null) this.retire(this.active, 1.2);
      this.active = null;
      this.notify();
      return;
    }
    if (this.active !== null && this.decks[this.active].track === this.desired) {
      // Returning to the current cue cancels an unfinished load of another cue.
      if (this.pending !== null) { this.generation++; this.clear(this.pending); this.pending = null; }
      const i = this.active;
      if (this.decks[i].element.paused) void this.start(i, ++this.generation, .8);
      return;
    }
    if (this.pending !== null && this.decks[this.pending].track === this.desired && !this.decks[this.pending].element.paused) return;
    const i = this.active === 0 ? 1 : 0;
    this.clear(i);
    const deck = this.decks[i];
    deck.track = this.desired;
    this.pending = i;
    deck.element.preload = "auto";
    deck.element.src = MUSIC_TRACKS[this.desired].file;
    deck.element.load();
    void this.start(i, ++this.generation, 2.4);
  }

  private async start(i: number, generation: number, fade: number) {
    const deck = this.decks[i];
    try {
      await deck.element.play();
      if (generation !== this.generation || !this.enabled) return;
      const previous = this.active;
      this.active = i;
      this.pending = null;
      // Keep the previous recording audible until the incoming one can play.
      if (previous !== null && previous !== i) this.retire(previous, fade);
      this.ramp(i, this.level, fade);
      this.notify();
    } catch {
      // Autoplay/network/decode failure never interrupts the game or removes
      // the previous score. The next gesture/selection can retry this deck.
      if (generation === this.generation) {
        this.pending = null;
        if (i !== this.active) this.clear(i);
      }
    }
  }

  private ramp(i: number, to: number, seconds: number) {
    const param = this.decks[i].gain.gain;
    const now = this.context.currentTime;
    if (typeof param.cancelAndHoldAtTime === "function") param.cancelAndHoldAtTime(now);
    else {
      const current = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(current, now);
    }
    if (seconds === 0) param.setValueAtTime(to, now);
    else param.linearRampToValueAtTime(to, now + seconds);
  }
  private cancelRetirement(i: number) {
    const timer = this.retiring.get(i);
    if (timer !== undefined) clearTimeout(timer);
    this.retiring.delete(i);
  }
  private retire(i: number, seconds: number) {
    this.cancelRetirement(i);
    this.ramp(i, 0, seconds);
    this.retiring.set(i, setTimeout(() => { this.retiring.delete(i); this.clear(i); }, seconds * 1000 + 50));
  }
  private clear(i: number) {
    this.cancelRetirement(i);
    const deck = this.decks[i];
    this.ramp(i, 0, 0);
    deck.element.pause();
    deck.element.removeAttribute("src");
    deck.element.load();
    deck.track = null;
  }
  stop() {
    this.generation++;
    this.enabled = false;
    this.desired = null;
    this.pending = null;
    this.active = null;
    for (let i = 0; i < this.decks.length; i++) {
      this.clear(i);
      this.decks[i].source.disconnect();
      this.decks[i].gain.disconnect();
    }
    this.connected = false;
    this.notify();
  }
}
