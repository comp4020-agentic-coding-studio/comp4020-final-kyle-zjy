import type { MessageKey } from "../../../i18n/index.ts";

type Caption = readonly [number, MessageKey];
export const OPENING_SCENES = [
  { id: "sync", duration: 6, captions: [[2, "s3.open.syncFailure"]] },
  { id: "lockdown", duration: 8, captions: [[0, "s3.open.narration.time"], [3, "s3.open.narration.lockdown"]] },
  { id: "archive", duration: 11, captions: [[0, "s3.open.narration.incident"], [4, "s3.open.narration.founded"], [8, "s3.open.narration.impossible"]] },
  { id: "dual", duration: 10, captions: [[0, "s3.open.narration.dual"], [3, "s3.open.narration.evidence"], [7, "s3.open.narration.missing"]] },
  { id: "jump", duration: 9, captions: [[0, "s3.open.narration.return"], [3, "s3.open.narration.observe"], [6, "s3.open.narration.change"]] },
  { id: "causal", duration: 11, captions: [[0, "s3.open.narration.recalculate"], [3, "s3.open.narration.small"], [7, "s3.open.narration.different"]] },
  { id: "records", duration: 10, captions: [[0, "s3.open.narration.incomplete"], [2.5, "s3.open.narration.tampered"], [4.5, "s3.open.narration.names"], [6.5, "s3.open.narration.knew"]] },
  { id: "mission", duration: 7, captions: [[0, "s3.open.narration.investigate"], [2.3, "s3.open.narration.cross"], [4.6, "s3.open.narration.history"]] },
  { id: "title", duration: 7, captions: [[0, "s3.open.tagline1"], [3, "s3.open.tagline2"]] },
  { id: "handoff", duration: 2, captions: [] },
] as const satisfies readonly { id: string; duration: number; captions: readonly Caption[] }[];

export type OpeningScene = typeof OPENING_SCENES[number]["id"];
export const OPENING_DURATION = OPENING_SCENES.reduce((n, scene) => n + scene.duration, 0);

export function openingFrame(seconds: number) {
  let elapsed = Math.max(0, seconds);
  for (const [index, scene] of OPENING_SCENES.entries()) {
    if (elapsed < scene.duration) {
      const caption = (scene.captions as readonly Caption[]).findLast(([at]) => elapsed >= at)?.[1];
      return { id: scene.id, index, elapsed, caption, done: false };
    }
    elapsed -= scene.duration;
  }
  return { id: "handoff" as const, index: OPENING_SCENES.length - 1, elapsed: 2, caption: undefined, done: true };
}

/** One clock owns every scene/caption. Stop before delivering completion. */
export function runOpening(update: (seconds: number) => void, complete: () => void) {
  const started = performance.now();
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) return;
    const seconds = (performance.now() - started) / 1000;
    if (seconds >= OPENING_DURATION) {
      stop();
      complete();
    } else update(seconds);
  }, 100);
  function stop() {
    stopped = true;
    clearInterval(timer);
  }
  return stop;
}
