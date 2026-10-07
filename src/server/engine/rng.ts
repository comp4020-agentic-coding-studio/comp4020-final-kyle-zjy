// Seeded sfc32. The generator state lives in GameState.rng, so every random
// draw is part of the persisted state: replaying the action log from the same
// seed reproduces the run exactly (test/replay.test.ts).
import { randomBytes } from "node:crypto";
import type { GameState } from "../../shared/game/state.ts";

export function newSeed(): string {
  return randomBytes(16).toString("hex");
}

export function seedState(seed: string): [number, number, number, number] {
  const words = [0, 1, 2, 3].map((i) => parseInt(seed.slice(i * 8, i * 8 + 8).padEnd(8, "0"), 16) >>> 0) as [number, number, number, number];
  // warm up so similar seeds diverge
  const s = { rng: words, rngCalls: 0 };
  for (let i = 0; i < 12; i++) next(s);
  return s.rng;
}

type RngHolder = Pick<GameState, "rng" | "rngCalls">;

/** Uniform float in [0, 1). Mutates the holder's generator state. */
export function next(holder: RngHolder): number {
  let [a, b, c, d] = holder.rng;
  a >>>= 0;
  b >>>= 0;
  c >>>= 0;
  d >>>= 0;
  const t = (((a + b) >>> 0) + d) >>> 0;
  d = (d + 1) >>> 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) >>> 0;
  c = ((c << 21) | (c >>> 11)) >>> 0;
  c = (c + t) >>> 0;
  holder.rng = [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
  holder.rngCalls++;
  return t / 4294967296;
}

export const int = (h: RngHolder, maxExclusive: number): number => Math.floor(next(h) * maxExclusive);
export const d6 = (h: RngHolder): number => 1 + int(h, 6);
export const pick = <T>(h: RngHolder, list: readonly T[]): T => list[int(h, list.length)];

export function shuffle<T>(h: RngHolder, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(h, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
