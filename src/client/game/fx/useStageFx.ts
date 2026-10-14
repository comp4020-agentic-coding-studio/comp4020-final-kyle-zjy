// Plays each fresh server cue's sound once, mounted once per run screen.
// Cues already seen (a remount, a reconnect replaying the store) stay silent.
import { useEffect, useRef } from "react";
import { audio } from "../../audio/manager.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { useStore, type Cue } from "../../store.ts";
import { sfxFor } from "./stageFx.ts";

/** At most this many sounds from one burst of cues, so a busy step doesn't become noise. */
const PER_BURST = 3;
const NONE: Cue[] = [];

export function useStageFx(g: PlayerView) {
  const cues = useStore((s) => s.cues) ?? NONE;
  const seen = useRef<string | null>(cues.at(-1)?.key ?? null);
  const view = useRef(g);
  view.current = g;
  useEffect(() => {
    const from = seen.current ? cues.findIndex((c) => c.key === seen.current) + 1 : 0;
    const fresh = cues.slice(from);
    if (!fresh.length) return;
    seen.current = fresh.at(-1)!.key;
    const sounds = [...new Set(fresh.map((c) => sfxFor(c, view.current)).filter((s) => s !== null))].slice(0, PER_BURST);
    const timers = sounds.map((s, i) => setTimeout(() => audio.play(s), i * 140));
    return () => timers.forEach(clearTimeout);
  }, [cues]);
}
