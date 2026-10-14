// Secret commissions: one private goal per player. Chosen by hashing the room seed
// with the player id (never the seeded RNG, so no existing draw or replay shifts)
// and judged from state the game already keeps. A commission is only a story
// verdict at the results; it never changes the Exit Rights outcome.
import type { CommissionId04 } from "../../../shared/game/scenario04/types.ts";
import type { GameState, PlayerId } from "../../../shared/game/state.ts";

export const COMMISSIONS04: readonly CommissionId04[] = ["COLLECTOR", "EXPOSER", "GAMBLER", "DEBTOR", "DEALER"];

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

export function commissionFor04(seed: string, playerId: PlayerId): CommissionId04 {
  return COMMISSIONS04[fnv1a(`${seed}:commission04:${playerId}`) % COMMISSIONS04.length];
}

/** Genuine lots the player won at auction (rounds 1-9), whatever became of them since. */
function genuineLotsWon(s: GameState, playerId: PlayerId): number {
  const a = s.auction!;
  return a.auctionHistory.filter((entry) => entry.winnerId === playerId && entry.round < 10 && !a.itemInstances[entry.itemInstanceId]?.counterfeit).length;
}

export function commissionMet04(s: GameState, playerId: PlayerId): boolean {
  const a = s.auction!;
  const held = a.players[playerId];
  switch (s.secrets[playerId].commission04?.id) {
    case "COLLECTOR": return genuineLotsWon(s, playerId) >= 2;
    case "EXPOSER": return held.privateIntel.some((id) => id.endsWith("_COUNTERFEIT"));
    case "GAMBLER": return (a.stats.challengesWon[playerId] ?? 0) >= 1;
    case "DEBTOR": return held.debt >= 2;
    case "DEALER": return (s.secrets[playerId].commission04?.deals ?? 0) >= 1;
    default: return false;
  }
}
