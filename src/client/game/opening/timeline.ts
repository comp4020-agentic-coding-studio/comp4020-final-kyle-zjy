import type { MessageKey } from "../../i18n/index.ts";
import type { AudioTheme, OpeningSfx } from "../../audio/manager.ts";

export type Scene = {
  id: string;
  duration: number;
  captions: readonly (readonly [number, MessageKey])[];
  sounds?: readonly (readonly [number, OpeningSfx])[];
};
export type OpeningDefinition = {
  variant: "train" | "flood" | "temporal" | "auction";
  scenes: readonly Scene[];
  introTheme: AudioTheme;
  ambientTheme: AudioTheme;
  label: MessageKey;
  hint: MessageKey;
  mix: (id: string, elapsed: number) => { level: number; theme?: AudioTheme };
};
export const durationOf = (scenes: readonly Scene[]) => scenes.reduce((n, scene) => n + scene.duration, 0);
export function frameAt(scenes: readonly Scene[], seconds: number) {
  let elapsed = Math.max(0, seconds);
  for (const [index, scene] of scenes.entries()) {
    if (elapsed < scene.duration) return { id: scene.id, index, elapsed, caption: scene.captions.findLast(([at]) => elapsed >= at)?.[1], done: false };
    elapsed -= scene.duration;
  }
  return { id: "handoff", index: scenes.length - 1, elapsed: 2, caption: undefined, done: true };
}

/** One clock per mounted film, cancelled before completion is delivered. */
export function runTimeline(duration: number, update: (seconds: number) => void, complete: () => void) {
  const started = performance.now();
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) return;
    const seconds = (performance.now() - started) / 1000;
    if (seconds >= duration) { stop(); complete(); }
    else update(seconds);
  }, 100);
  function stop() { stopped = true; clearInterval(timer); }
  return stop;
}
