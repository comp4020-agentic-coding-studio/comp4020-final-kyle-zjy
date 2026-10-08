import type { PlayerGameState, TemporalProfile03, TemporalTrace03 } from "../../../shared/game/state.ts";
import type { Ctx } from "../context.ts";

const signature03 = (seed: string, characterId: string, seat: number): string => {
  let hash = 2166136261;
  for (const char of `${seed}:${characterId}:${seat}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `IX-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
};

export const profile03 = (seed: string, p: PlayerGameState): TemporalProfile03 => ({
  signature: signature03(seed, p.characterId, p.seat),
  characterId: p.characterId,
  seat: p.seat,
});

export function recordTrace03(ctx: Ctx, p: PlayerGameState, trace: Omit<TemporalTrace03, "seq" | "signature" | "actorId" | "round">): void {
  const temporal = ctx.s.temporal!;
  const profile = temporal.sealedProfiles.find((entry) => entry.characterId === p.characterId && entry.seat === p.seat);
  if (!profile) throw new Error("missing Scenario 03 sealed profile");
  temporal.surveillance.push({ ...trace, seq: temporal.surveillance.length + 1, signature: profile.signature, actorId: p.playerId, round: ctx.s.round });
}

export function matchProfiles03(ctx: Ctx): void {
  const temporal = ctx.s.temporal!;
  temporal.identityMatches = temporal.sealedProfiles.map((profile) => {
    const player = Object.values(ctx.s.players).find((p) => p.characterId === profile.characterId && p.seat === profile.seat);
    if (!player) throw new Error("Scenario 03 sealed profile has no player");
    return { signature: profile.signature, playerId: player.playerId };
  });
}
