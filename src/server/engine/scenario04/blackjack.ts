import type { GameAction } from "../../../shared/game/actions.ts";
import type { AuctionState04 } from "../../../shared/game/scenario04/types.ts";
import type { GameState, PlayerGameState, PlayerId } from "../../../shared/game/state.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { fail, type Spec } from "../actions.ts";
import { cue, log, type Ctx } from "../context.ts";
import { shuffle } from "../rng.ts";
import { onResume, openWindow } from "../windows.ts";
import { AUCTION_CONFIG04 } from "../../../shared/game/scenario04/config.ts";

type Challenge = NonNullable<AuctionState04["challenge"]>;

export function blackjackTotal04(hand: number[]): number {
  let total = hand.reduce((sum, card) => sum + (card === 1 ? 1 : Math.min(card, 10)), 0);
  let aces = hand.filter((card) => card === 1).length;
  while (aces > 0 && total + 10 <= 21) { total += 10; aces--; }
  return total;
}

function offerLegal(s: GameState, p: PlayerGameState, action: Extract<GameAction, { type: "CHALLENGE" }>) {
  if (action.targetId === p.playerId || !s.auction!.players[action.targetId]) return fail("ILLEGAL_TARGET", m`Choose another bidder to challenge.`);
  if (!Number.isSafeInteger(action.wager) || action.wager <= 0) return fail("INVALID", m`Choose a positive whole-number wager.`);
  if (action.wager > s.auction!.players[p.playerId].blackChips) return fail("ILLEGAL_TARGET", m`You cannot wager more Black Chips than you hold.`);
  return null;
}

export const CHALLENGE04: Spec<Extract<GameAction, { type: "CHALLENGE" }>> = {
  targets: (s, p) => s.auction!.seatOrder.filter((id) => id !== p.playerId),
  check: (s, p, action) => action ? offerLegal(s, p, action) : null,
  apply: (ctx, p, action) => {
    ctx.s.auction!.challenge = { challenger: p.playerId, target: action.targetId, wager: action.wager, effectiveWager: 0, deck: [], challengerHand: [], targetHand: [], turn: action.targetId, stood: [], coinAsked: [] };
    openWindow(ctx, {
      kind: "S4_CHALLENGE", title: m`Blackjack challenge`, prompt: m`Accept the Blackjack wager or decline?`,
      addressees: [action.targetId], options: [{ id: "ACCEPT", label: m`Accept` }, { id: "DECLINE", label: m`Decline` }],
      defaultOptionId: "DECLINE", resume: { kind: "S4_CHALLENGE" }, blocksTable: true, ownerId: p.playerId,
    });
  },
};

function turnWindow(ctx: Ctx, challenge: Challenge): void {
  openWindow(ctx, {
    kind: "S4_BLACKJACK", title: m`Blackjack`, prompt: m`Hit or stand?`,
    addressees: [challenge.turn], options: [{ id: "HIT", label: m`Hit` }, { id: "STAND", label: m`Stand` }],
    defaultOptionId: "STAND", resume: { kind: "S4_BLACKJACK" }, blocksTable: true, ownerId: challenge.turn,
  });
}

function coinStage(ctx: Ctx, challenge: Challenge): void {
  const a = ctx.s.auction!;
  const id = [challenge.target, challenge.challenger].find((playerId) =>
    !challenge.coinAsked.includes(playerId) && a.players[playerId].items.includes("LOT_03") &&
    !Object.values(a.players).some((holder) => holder.usedLotEffects.includes("LOT_03")));
  if (!id) return turnWindow(ctx, challenge);
  challenge.coinAsked.push(id);
  const hand = id === challenge.target ? challenge.targetHand : challenge.challengerHand;
  const options = [{ id: "KEEP", label: m`Keep both starting cards` }];
  for (const [index, card] of hand.entries()) {
    const base = Math.min(card, 10);
    for (const delta of [-AUCTION_CONFIG04.coinCardAdjustment, AUCTION_CONFIG04.coinCardAdjustment]) {
      const value = base + delta;
      if (value < AUCTION_CONFIG04.coinMinValue || value > AUCTION_CONFIG04.coinMaxValue) continue;
      options.push({ id: `${index}:${value}`, label: m`Change starting card ${index + 1} from ${base} to ${value}` });
    }
  }
  openWindow(ctx, { kind: "S4_COIN", title: m`Gambler's Coin`, prompt: m`Adjust one starting card by one point?`,
    addressees: [id], options, defaultOptionId: "KEEP", resume: { kind: "S4_COIN" }, blocksTable: true, ownerId: id });
}

function settle(ctx: Ctx, winner: PlayerId | null): void {
  const a = ctx.s.auction!;
  const challenge = a.challenge!;
  const amount = challenge.effectiveWager;
  if (winner) {
    a.players[winner].blackChips += amount * 2;
    a.stats.challengesWon[winner] = (a.stats.challengesWon[winner] ?? 0) + 1;
    log(ctx, m`${ctx.s.players[winner].nickname} wins the Blackjack pot.`, "S4_CHALLENGE", winner);
  } else {
    a.players[challenge.challenger].blackChips += amount;
    a.players[challenge.target].blackChips += amount;
    log(ctx, m`Blackjack is a push. Both stakes return.`, "S4_CHALLENGE");
  }
  cue(ctx, "S4_CHALLENGE_END", { winnerId: winner, pot: amount * 2 });
  a.challenge = null;
}

onResume("S4_CHALLENGE", (ctx, _window, answers) => {
  const a = ctx.s.auction!;
  const challenge = a.challenge;
  if (!challenge) return;
  if (answers[challenge.target] !== "ACCEPT") {
    const p = ctx.s.players[challenge.target];
    if (p.ap > 0) p.ap--;
    else a.players[challenge.target].debt++;
    log(ctx, m`${p.nickname} declines the Blackjack challenge.`, "S4_CHALLENGE", p.playerId);
    a.challenge = null;
    return;
  }
  challenge.effectiveWager = Math.min(challenge.wager, a.players[challenge.target].blackChips);
  a.players[challenge.challenger].blackChips -= challenge.effectiveWager;
  a.players[challenge.target].blackChips -= challenge.effectiveWager;
  challenge.deck = shuffle(ctx.s, Array.from({ length: 52 }, (_, i) => i % 13 + 1));
  challenge.targetHand = [challenge.deck.pop()!, challenge.deck.pop()!];
  challenge.challengerHand = [challenge.deck.pop()!, challenge.deck.pop()!];
  challenge.turn = challenge.target;
  cue(ctx, "S4_BLACKJACK_START", { challenger: challenge.challenger, target: challenge.target, wager: challenge.effectiveWager });
  coinStage(ctx, challenge);
});

onResume("S4_COIN", (ctx, window, answers) => {
  const challenge = ctx.s.auction!.challenge;
  if (!challenge) return;
  const id = window.addressees[0];
  const choice = answers[id];
  if (choice !== "KEEP") {
    const [index, value] = choice.split(":").map(Number);
    const hand = id === challenge.target ? challenge.targetHand : challenge.challengerHand;
    const base = Math.min(hand[index], 10);
    if (index >= 0 && index < 2 && Math.abs(value - base) === AUCTION_CONFIG04.coinCardAdjustment && value >= AUCTION_CONFIG04.coinMinValue && value <= AUCTION_CONFIG04.coinMaxValue) {
      hand[index] = value;
      ctx.s.auction!.players[id].usedLotEffects.push("LOT_03");
      cue(ctx, "S4_COIN_USED", { playerId: id, cardIndex: index });
    }
  }
  coinStage(ctx, challenge);
});

onResume("S4_BLACKJACK", (ctx, _window, answers) => {
  const challenge = ctx.s.auction!.challenge;
  if (!challenge) return;
  const actor = challenge.turn;
  const hand = actor === challenge.target ? challenge.targetHand : challenge.challengerHand;
  if (answers[actor] === "HIT") {
    hand.push(challenge.deck.pop()!);
    cue(ctx, "S4_BLACKJACK_CARD", { playerId: actor, total: blackjackTotal04(hand) });
    if (blackjackTotal04(hand) > 21) return settle(ctx, actor === challenge.target ? challenge.challenger : challenge.target);
    return turnWindow(ctx, challenge);
  }
  challenge.stood.push(actor);
  if (actor === challenge.target) {
    challenge.turn = challenge.challenger;
    return turnWindow(ctx, challenge);
  }
  const target = blackjackTotal04(challenge.targetHand);
  const challenger = blackjackTotal04(challenge.challengerHand);
  settle(ctx, target === challenger ? null : target > challenger ? challenge.target : challenge.challenger);
});
