// Who the table is waiting for in a scene: nothing has a time limit, so the
// screen says whose Continue is still missing instead of counting down.
import type { PlayerView } from "../../shared/game/state.ts";

export function notYet(g: PlayerView): string {
  const acks = g.sequence?.acks ?? [];
  const names = g.turnOrder.filter((id) => !acks.includes(id) && !g.players[id]?.away).map((id) => g.players[id].nickname);
  return names.length ? names.join(", ") : "the others";
}
