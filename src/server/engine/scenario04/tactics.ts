import type { GameAction } from "../../../shared/game/actions.ts";
import { AUCTION_CONFIG04 } from "../../../shared/game/scenario04/config.ts";
import { lotForRound04 } from "../../../shared/game/scenario04/lots.ts";
import type { IntelId04 } from "../../../shared/game/scenario04/types.ts";
import type { GameState, PlayerGameState } from "../../../shared/game/state.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { fail, type Spec } from "../actions.ts";
import { cue, log } from "../context.ts";
import { onRollOutcome, startRoll } from "../dice.ts";
import { gainSanity, loseSanity } from "../players.ts";
import { MAX_SANITY } from "../../../shared/game/scenario01/content.ts";

const otherPlayers = (s: GameState, p: PlayerGameState) => s.auction!.seatOrder.filter((id) => id !== p.playerId);

export const INVESTIGATE04: Spec<Extract<GameAction, { type: "INVESTIGATE" }>> = {
  check: (s) => s.auction!.auctionOpen ? null : fail("ILLEGAL_TARGET", m`The lot is no longer open for investigation.`),
  apply: (ctx, p) => {
    startRoll(ctx, p, "S4_INVESTIGATE", m`auction investigation`, { kind: "S4_INVESTIGATE", carriageIndex: 0 });
  },
};

export const READ04: Spec<Extract<GameAction, { type: "READ" }>> = {
  targets: otherPlayers,
  check: (s, p, action) => !action || otherPlayers(s, p).includes(action.targetId)
    ? null : fail("ILLEGAL_TARGET", m`Choose another bidder to read.`),
  apply: (ctx, p, action) => {
    startRoll(ctx, p, "S4_READ", m`reading a bidder`, { kind: "S4_READ", carriageIndex: 0, scenario04: { targetId: action.targetId } });
  },
};

export const SABOTAGE04: Spec<Extract<GameAction, { type: "SABOTAGE" }>> = {
  targets: otherPlayers,
  check: (s, p, action) => !action || otherPlayers(s, p).includes(action.targetId)
    ? null : fail("ILLEGAL_TARGET", m`Choose another bidder to sabotage.`),
  apply: (ctx, p, action) => {
    startRoll(ctx, p, "S4_SABOTAGE", m`sabotaging a bidder`, { kind: "S4_SABOTAGE", carriageIndex: 0, scenario04: { targetId: action.targetId } });
  },
};

export const BORROW04: Spec<Extract<GameAction, { type: "BORROW" }>> = {
  check: (s, p) => {
    const a = s.auction!.players[p.playerId];
    if (p.counters.s4BorrowedRound === s.round) return fail("ILLEGAL_TARGET", m`You have already borrowed this round.`);
    if (a.debt + AUCTION_CONFIG04.borrowDebt > AUCTION_CONFIG04.maxDebt) return fail("ILLEGAL_TARGET", m`Your debt limit has been reached.`);
    return null;
  },
  apply: (ctx, p) => {
    const a = ctx.s.auction!;
    a.players[p.playerId].blackChips += AUCTION_CONFIG04.borrowChips;
    a.players[p.playerId].debt += AUCTION_CONFIG04.borrowDebt;
    a.stats.borrows[p.playerId] = (a.stats.borrows[p.playerId] ?? 0) + 1;
    p.counters.s4BorrowedRound = ctx.s.round;
    log(ctx, m`${p.nickname} borrows ${AUCTION_CONFIG04.borrowChips} Black Chips and gains ${AUCTION_CONFIG04.borrowDebt} Debt.`, "S4_BORROW", p.playerId);
    cue(ctx, "S4_BORROW", { playerId: p.playerId });
  },
};

export const RECOVER04: Spec<Extract<GameAction, { type: "RECOVER" }>> = {
  check: (_s, p) => p.sanity < MAX_SANITY ? null : fail("ILLEGAL_TARGET", m`Your Sanity is already full.`),
  apply: (ctx, p) => { gainSanity(ctx, p, 1, m`recovering at the auction table`); },
};

export const EXPOSE04: Spec<Extract<GameAction, { type: "EXPOSE" }>> = {
  targets: (s, p) => s.auction!.players[p.playerId].privateIntel.filter((id) => !s.auction!.publicIntel.includes(id)),
  check: (s, p, action) => {
    if (s.round < 7) return fail("ILLEGAL_TARGET", m`Exposure opens in round 7.`);
    const held = s.auction!.players[p.playerId].privateIntel.filter((id) => !s.auction!.publicIntel.includes(id));
    if (!held.length) return fail("ILLEGAL_TARGET", m`You hold no private intel to expose.`);
    if (action && !held.includes(action.intelId as IntelId04)) return fail("ILLEGAL_TARGET", m`You can only expose intel you actually know.`);
    return null;
  },
  apply: (ctx, p, action) => {
    ctx.s.auction!.publicIntel.push(action.intelId as IntelId04);
    log(ctx, m`${p.nickname} exposes certified intel to the table.`, "S4_EXPOSE", p.playerId);
    cue(ctx, "S4_EXPOSE", { playerId: p.playerId, intelId: action.intelId });
  },
};

onRollOutcome("S4_INVESTIGATE", (ctx, p, roll) => {
  const a = ctx.s.auction!;
  a.stats.investigations[p.playerId] = (a.stats.investigations[p.playerId] ?? 0) + 1;
  if (roll.tier === "DISASTER") loseSanity(ctx, p, 1, m`a failed auction investigation`);
  if (roll.tier === "SUCCESS" || roll.tier === "PERFECT") {
    const lot = lotForRound04(ctx.s.round);
    const intel = a.players[p.playerId].privateIntel;
    if (!intel.includes(lot.hiddenInfo)) intel.push(lot.hiddenInfo);
    if (roll.tier === "PERFECT" && !intel.includes(lot.perfectInfo)) intel.push(lot.perfectInfo);
    cue(ctx, "S4_PRIVATE_INTEL", { playerId: p.playerId });
  }
});

onRollOutcome("S4_READ", (ctx, p, roll, rc) => {
  if (roll.tier === "DISASTER") loseSanity(ctx, p, 1, m`a failed reading`);
  if (roll.tier !== "SUCCESS" && roll.tier !== "PERFECT") return;
  const a = ctx.s.auction!;
  const targetId = rc.scenario04!.targetId!;
  const target = a.players[targetId];
  const mine = a.players[p.playerId];
  const targetIntel = target.privateIntel.filter((id) => id.startsWith(a.currentLot));
  mine.reads.push({ targetId, round: ctx.s.round, blackChips: target.blackChips, hasCurrentIntel: targetIntel.length > 0 });
  if (roll.tier === "PERFECT") for (const id of targetIntel) if (!mine.privateIntel.includes(id)) mine.privateIntel.push(id);
  cue(ctx, "S4_PRIVATE_READ", { playerId: p.playerId });
});

onRollOutcome("S4_SABOTAGE", (ctx, p, roll, rc) => {
  if (roll.tier === "DISASTER") loseSanity(ctx, p, 1, m`a failed sabotage`);
  if (roll.tier !== "SUCCESS" && roll.tier !== "PERFECT") return;
  const targetId = rc.scenario04!.targetId!;
  ctx.s.auction!.players[targetId].nextRollPenalty = roll.tier === "PERFECT" ? -2 : -1;
  log(ctx, m`${p.nickname} places a short-lived penalty on another bidder's next auction roll.`, "S4_SABOTAGE", p.playerId);
});
