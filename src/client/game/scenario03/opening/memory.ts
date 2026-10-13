import type { PlayerView } from "../../../../shared/game/state.ts";

const KEY = "fate:s03:openings";
const memory = new Set<string>();
export const openingKey = (g: Pick<PlayerView, "sessionId" | "viewerId">) => JSON.stringify([g.sessionId, g.viewerId]);

function saved(): string[] {
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(entries) ? entries.filter((x): x is string => typeof x === "string").slice(-40) : [];
  } catch { return []; }
}

export function openingSeen(key: string): boolean {
  return memory.has(key) || saved().includes(key);
}

/** Remember at entry: a reload during playback should resume the game too. */
export function rememberOpening(key: string): void {
  memory.add(key);
  try { localStorage.setItem(KEY, JSON.stringify([...new Set([...saved(), key])].slice(-40))); }
  catch { /* Private storage: the current document still remembers. */ }
}

export function shouldOpen(g: Pick<PlayerView, "scenarioId" | "phase" | "round" | "sessionId" | "viewerId">): boolean {
  return g.scenarioId === "S03_INCIDENT_ZERO" && (g.phase === "INTRO" || (g.phase === "ACT_1" && g.round === 1)) && !openingSeen(openingKey(g));
}
