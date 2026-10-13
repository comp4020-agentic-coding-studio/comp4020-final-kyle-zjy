import type { PlayerView } from "../../../shared/game/state.ts";

const KEY = "fate:openings";
const memory = new Set<string>();
export const openingKey = (g: Pick<PlayerView, "sessionId" | "viewerId" | "scenarioId">) => JSON.stringify([g.scenarioId, g.sessionId, g.viewerId]);
function saved(key = KEY): string[] {
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(entries) ? entries.filter((x): x is string => typeof x === "string").slice(-40) : [];
  } catch { return []; }
}
export function openingSeen(key: string): boolean {
  if (memory.has(key) || saved().includes(key)) return true;
  // Keep the already-shipped Scenario 03 markers valid across this upgrade.
  const [scenario, session, player] = JSON.parse(key);
  return scenario === "S03_INCIDENT_ZERO" && saved("fate:s03:openings").includes(JSON.stringify([session, player]));
}
export function rememberOpening(key: string): void {
  memory.add(key);
  try { localStorage.setItem(KEY, JSON.stringify([...new Set([...saved(), key])].slice(-40))); }
  catch { /* The current document still remembers if storage is blocked. */ }
}
export function shouldOpen(g: Pick<PlayerView, "scenarioId" | "phase" | "round" | "sessionId" | "viewerId">): boolean {
  return (g.phase === "INTRO" || (g.phase === "ACT_1" && g.round === 1)) && !openingSeen(openingKey(g));
}
