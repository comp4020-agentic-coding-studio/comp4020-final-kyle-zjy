import type { GameAction } from "../../../shared/game/actions.ts";
import type { IntelId04, LotId04 } from "../../../shared/game/scenario04/types.ts";
import { LOTS04 } from "../../../shared/game/scenario04/lots.ts";
import type { GameState, PlayerGameState } from "../../../shared/game/state.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { fail, type Spec } from "../actions.ts";
import { cue, log } from "../context.ts";
import { onResume, openWindow } from "../windows.ts";

type Offer = Extract<GameAction, { type: "DEAL" }>;

function legal(s: GameState, p: PlayerGameState, offer: Offer): ReturnType<typeof fail> | null {
  const a = s.auction!;
  if (offer.targetId === p.playerId || !a.players[offer.targetId]) return fail("ILLEGAL_TARGET", m`Choose another bidder for the deal.`);
  if (!Number.isSafeInteger(offer.chips) || offer.chips < 0 || !Number.isSafeInteger(offer.receiveChips ?? 0) || (offer.receiveChips ?? 0) < 0) return fail("INVALID", m`Deal chip amounts must be whole and nonnegative.`);
  if (offer.chips > a.players[p.playerId].blackChips) return fail("ILLEGAL_TARGET", m`A deal cannot spend chips its parties do not hold.`);
  if (offer.giveIntel && !a.players[p.playerId].privateIntel.includes(offer.giveIntel as IntelId04)) return fail("ILLEGAL_TARGET", m`You cannot sell intel you do not know.`);
  if (offer.giveItem && !a.players[p.playerId].items.includes(offer.giveItem as LotId04)) return fail("ILLEGAL_TARGET", m`You cannot sell an item you do not hold.`);
  if (offer.giveItem && !LOTS04.find((lot) => lot.id === offer.giveItem)?.transferable) return fail("ILLEGAL_TARGET", m`That item cannot be transferred.`);
  if (offer.forItem && !a.players[offer.targetId].items.includes(offer.forItem as LotId04)) return fail("ILLEGAL_TARGET", m`The seller does not hold that item.`);
  if (offer.forItem && !LOTS04.find((lot) => lot.id === offer.forItem)?.transferable) return fail("ILLEGAL_TARGET", m`That item cannot be transferred.`);
  if (offer.forPass && (a.passedPlayers.includes(offer.targetId) || a.currentBidder === offer.targetId)) return fail("ILLEGAL_TARGET", m`That bidder cannot pass the current lot.`);
  if (!offer.chips && !offer.receiveChips && !offer.giveIntel && !offer.giveItem && !offer.forIntel && !offer.forItem && !offer.forPass) return fail("INVALID", m`Choose real terms for the deal.`);
  return null;
}

/** Only the recipient can test whether their private assets cover an offer. */
export function acceptDealError04(s: GameState, actorId: string): ReturnType<typeof fail> | null {
  const deal = s.auction?.deal;
  if (!deal || deal.to !== actorId) return null;
  const recipient = s.auction!.players[actorId];
  if ((deal.receiveChips ?? 0) > recipient.blackChips) return fail("ILLEGAL_TARGET", m`A deal cannot spend chips its parties do not hold.`);
  if (deal.forIntel && !recipient.privateIntel.includes(deal.forIntel)) return fail("ILLEGAL_TARGET", m`The seller does not know that certified intel.`);
  return null;
}

export const DEAL04: Spec<Offer> = {
  targets: (s, p) => s.auction!.seatOrder.filter((id) => id !== p.playerId),
  check: (s, p, offer) => offer ? legal(s, p, offer) : null,
  apply: (ctx, p, offer) => {
    const a = ctx.s.auction!;
    const contractDiscount = offer.chips > 0 && a.players[p.playerId].items.includes("LOT_04") && !Object.values(a.players).some((player) => player.usedLotEffects.includes("LOT_04"));
    a.deal = { from: p.playerId, to: offer.targetId, chips: offer.chips - (contractDiscount ? 1 : 0), contractDiscount, receiveChips: offer.receiveChips, giveIntel: offer.giveIntel as IntelId04 | undefined, giveItem: offer.giveItem as LotId04 | undefined, forIntel: offer.forIntel as IntelId04 | undefined, forItem: offer.forItem as LotId04 | undefined, forPass: offer.forPass };
    openWindow(ctx, {
      kind: "S4_DEAL", title: m`Deal offer`, prompt: m`Accept these enforceable terms?`,
      addressees: [offer.targetId],
      options: [{ id: "ACCEPT", label: m`Accept` }, { id: "REJECT", label: m`Reject` }],
      defaultOptionId: "REJECT", resume: { kind: "S4_DEAL" }, blocksTable: true, ownerId: p.playerId,
    });
  },
};

onResume("S4_DEAL", (ctx, _window, answers) => {
  const a = ctx.s.auction!;
  const deal = a.deal;
  a.deal = null;
  if (!deal || answers[deal.to] !== "ACCEPT") return;
  const buyer = a.players[deal.from];
  const seller = a.players[deal.to];
  const offer: Offer = { type: "DEAL", targetId: deal.to, chips: deal.chips, receiveChips: deal.receiveChips, giveIntel: deal.giveIntel, giveItem: deal.giveItem, forIntel: deal.forIntel, forItem: deal.forItem, forPass: deal.forPass };
  if (legal(ctx.s, ctx.s.players[deal.from], offer) || acceptDealError04(ctx.s, deal.to)) return;
  buyer.blackChips -= deal.chips;
  seller.blackChips += deal.chips;
  if (deal.contractDiscount) buyer.usedLotEffects.push("LOT_04");
  const returnChips = deal.receiveChips ?? 0;
  seller.blackChips -= returnChips;
  buyer.blackChips += returnChips;
  if (deal.forIntel && !buyer.privateIntel.includes(deal.forIntel)) buyer.privateIntel.push(deal.forIntel);
  if (deal.giveIntel && !seller.privateIntel.includes(deal.giveIntel)) seller.privateIntel.push(deal.giveIntel);
  if (deal.giveItem) {
    buyer.items.splice(buyer.items.indexOf(deal.giveItem), 1);
    seller.items.push(deal.giveItem);
  }
  if (deal.forItem) {
    seller.items.splice(seller.items.indexOf(deal.forItem), 1);
    buyer.items.push(deal.forItem);
  }
  if (deal.forPass) a.passedPlayers.push(deal.to);
  a.stats.deals++;
  log(ctx, m`The accepted deal settles in full.`, "S4_DEAL", deal.from);
  cue(ctx, "S4_DEAL", { from: deal.from, to: deal.to, pass: !!deal.forPass });
});
