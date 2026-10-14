// Scenario 02's private ties: one small personal stake per player, derived from
// the seed and the player's id without touching the run's generator (so every
// kept replay is unchanged). A tie is judged at the results from public facts
// of the run and never changes the shared outcome.
import type { GameState, PlayerId, Tie02 } from "../../../shared/game/state.ts";

export const TIE_FACILITIES = ["POWER_STATION", "PUMP_STATION", "HARBOUR_GATE"] as const;

/** FNV-1a, enough to spread a seed and a player id over a small table. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** The tie table: each person placed this run to see rescued, being aboard, every job to put a hand to. */
const table = (npcIds: string[]): Tie02[] => [
  ...npcIds.map((id): Tie02 => ({ kind: "RESCUE", target: id })),
  { kind: "ABOARD", target: null },
  ...TIE_FACILITIES.map((f): Tie02 => ({ kind: "RESTORE", target: f })),
];

export const tieFor = (seed: string, playerId: PlayerId, npcIds: string[]): Tie02 => {
  const t = table(npcIds);
  return { ...t[hash(`${seed}:tie02:${playerId}`) % t.length] };
};

/** Judged from the finished run. */
export function tieMet(s: GameState, playerId: PlayerId, tie: Tie02): boolean {
  const city = s.city!;
  switch (tie.kind) {
    case "RESCUE":
      return city.npcs.some((n) => n.id === tie.target && n.state === "RESCUED");
    case "ABOARD":
      return city.boat.launched && city.boat.aboard.includes(playerId);
    case "RESTORE": {
      const fac = city.facilities[tie.target as (typeof TIE_FACILITIES)[number]];
      return !!fac && fac.done && (fac.contributors[playerId] ?? 0) > 0;
    }
  }
}
