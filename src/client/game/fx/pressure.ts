// How far gone the world is, 0 (calm) to 1 (the end), from public state only.
// Every scenario's atmosphere (flicker, water, time ghosting, a darkening
// hall) reads this; the exact numbers stay on screen for precise decisions.
import type { PlayerView } from "../../../shared/game/state.ts";

export type Pressure = { level: number; band: "calm" | "uneasy" | "critical" };

export function worldPressure(g: PlayerView): Pressure {
  const clock = g.scenarioId === "S04_UNDERGROUND_AUCTION" ? Math.max(0, g.round - 1) / 9 : g.collapse / Math.max(1, g.collapseMax);
  const level = Math.min(1, Math.max(0, g.phase === "LOBBY" || g.phase === "INTRO" || g.phase === "RESULTS" ? 0 : clock));
  return { level, band: level >= .7 ? "critical" : level >= .4 ? "uneasy" : "calm" };
}
