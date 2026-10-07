// A "reward" (docs/skill-mapping-notes.md) is Fate, Sanity or an item gained
// from a roll's outcome, a public event or a clue. Whatever produced it calls
// `measureRewards` around the change; each player who came out ahead gets
// their one-shot bonuses, wakes reward abilities and pays reward bonds.
import { isKeyItem } from "../../shared/game/scenario01/content.ts";
import type { ItemId, PlayerId } from "../../shared/game/state.ts";
import { log, type Ctx } from "./context.ts";
import { gainFate, payBonds, present, removeStatus, statusOf } from "./players.ts";
import { queueTrigger } from "./trigger-queue.ts";
import type { Msg } from "../../shared/i18n/types.ts";
import { m, ref } from "../../shared/i18n/msg.ts";

type Gain = { playerId: PlayerId; fate: number; item?: ItemId };

// a key is an objective, not a reward: nothing that doubles, copies or bonds on rewards ever sees one
const ordinary = (items: ItemId[]) => items.filter((i) => !isKeyItem(i));

/** Runs `fn` and treats whatever the players in `pool` gained during it as rewards. Returns who gained. */
export function measureRewards(ctx: Ctx, pool: PlayerId[], label: Msg, fn: () => void): Gain[] {
  const before = new Map(pool.map((id) => {
    const p = ctx.s.players[id];
    return [id, { fate: p.fate, sanity: p.sanity, items: ordinary(p.items).length }];
  }));
  fn();
  const gains: Gain[] = [];
  for (const [id, b] of before) {
    const p = ctx.s.players[id];
    const items = p ? ordinary(p.items) : [];
    if (!p || (p.fate <= b.fate && p.sanity <= b.sanity && items.length <= b.items)) continue;
    gains.push({ playerId: id, fate: Math.max(0, p.fate - b.fate), item: items.length > b.items ? items[items.length - 1] : undefined });
  }
  for (const g of gains) rewarded(ctx, g, label);
  return gains;
}

function rewarded(ctx: Ctx, g: Gain, label: Msg): void {
  const p = ctx.s.players[g.playerId];
  const bonus = statusOf(p, "BONUS_NEXT_REWARD");
  if (bonus) {
    removeStatus(p, bonus.id);
    log(ctx, m`${p.nickname}'s mark pays out (${label}).`, "FATE", p.playerId);
    gainFate(ctx, p, bonus.value ?? 1, m`a marked reward`);
  }
  queueTrigger(ctx, { kind: "SELF_GAINS_REWARD", subjectId: g.playerId, amount: g.fate, item: g.item });
  queueTrigger(ctx, { kind: "PLAYER_GAINS_REWARDS", subjectId: g.playerId, sourceId: "SYSTEM", amount: g.fate, item: g.item });
  payBonds(ctx, g.playerId, "onFirstReward");
}

export const presentIds = (ctx: Ctx): PlayerId[] => present(ctx).map((p) => p.playerId);
