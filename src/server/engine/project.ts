// What one player may see of the run. Everything owner-only (obsession,
// messages, allies, dream cards, peeks, tasks, hidden statuses, other players'
// votes before a vote closes) is removed here, on the server, before anything
// is sent. A client never receives another player's secret, and the owner
// doesn't learn whether their own message or dream is true until the end.
import type { GameState, PlayerId, PlayerSecrets, PlayerView, PublicPlayerState, PublicWindow, ViewerSecrets } from "../../shared/game/state.ts";
import { availableActions } from "./actions.ts";
import { publicCity } from "./scenario02/city.ts";

export function project(s: GameState, viewerId: PlayerId): PlayerView {
  const {
    secrets,
    seed: _seed,
    rng: _rng,
    rngCalls: _rngCalls,
    eventDeck,
    players,
    pending,
    rollContext: _rollContext,
    pendingEffect,
    delayed: _delayed,
    bonds,
    jobs: _jobs,
    triggerQueue: _triggerQueue,
    roundRecord: _roundRecord,
    city: _city,
    temporal: _temporal,
    auction: _auction,
    ...shared
  } = s;
  const over = s.phase === "RESULTS" || s.phase === "ENDING";

  const publicPlayers: Record<PlayerId, PublicPlayerState> = {};
  for (const [id, p] of Object.entries(players)) {
    const { storedResult, counters: _counters, statuses, ...rest } = p;
    publicPlayers[id] = {
      ...rest,
      ...(s.auction?.final && id !== viewerId ? {
        sanity: s.auction.final.players[id].initial.sanity,
        fate: s.auction.final.players[id].initial.fate,
        ap: s.auction.final.players[id].initial.ap,
        lost: s.auction.final.players[id].initial.lost,
      } : {}),
      statuses: id === viewerId || over ? statuses : statuses.filter((st) => !st.hidden),
      hasStoredResult: storedResult !== null,
    };
  }

  const windows: PublicWindow[] = pending.map(({ resume: _resume, answers, ...w }) => ({
    ...w,
    answeredBy: Object.keys(answers),
    myAnswer: answers[viewerId] ?? null,
  }));

  return {
    ...shared,
    ...(s.auction?.final ? { log: s.log.filter((line) => line.seq < s.auction!.final!.logStartSeq || !["S4_ITEM", "SANITY", "LOST", "FATE"].includes(line.kind) || line.actorId === viewerId) } : {}),
    viewerId,
    mySecrets: secrets[viewerId] ? ownSecrets(secrets[viewerId], over) : null,
    players: publicPlayers,
    pending: windows,
    incoming: pendingEffect ? { label: pendingEffect.label, targetId: pendingEffect.targetId, sourceId: pendingEffect.sourceId } : null,
    bonds: bonds.filter((b) => !b.secret || b.members.includes(viewerId) || b.ownerId === viewerId).map(({ fired: _fired, ...b }) => b),
    myActions: availableActions(s, viewerId),
    deckSize: eventDeck.length,
    city: publicCity(s, viewerId),
    ...(s.auction ? { auction: {
      seatOrder: [...s.auction.seatOrder],
      currentLot: s.auction.currentLot,
      currentBid: s.auction.currentBid,
      currentBidReal: s.auction.currentBidReal,
      currentBidder: s.auction.currentBidder,
      bidThisTurn: s.auction.bidThisTurn,
      turnPlayerId: s.auction.turnPlayerId,
      roundStartPlayerId: s.auction.roundStartPlayerId,
      passedPlayers: [...s.auction.passedPlayers],
      auctionOpen: s.auction.auctionOpen,
      auctionHistory: [...s.auction.auctionHistory],
      publicIntel: [...s.auction.publicIntel],
      stats: s.auction.stats,
      final: s.auction.final ? {
        stage: s.auction.final.stage,
        winnerId: ["REVEAL", "SHOWDOWN_REVEAL"].includes(s.auction.final.stage) ? s.auction.final.winnerId : null,
        tiedPlayerIds: [...s.auction.final.tiedPlayerIds],
        showdown: s.auction.final.showdown ? {
          participatingPlayerIds: [...s.auction.final.showdown.participatingPlayerIds],
          showdownRound: s.auction.final.showdown.showdownRound,
          cardSlots: s.auction.final.showdown.participatingPlayerIds.includes(viewerId) ? Array(5).fill(null) as null[] : [],
          lockedPlayerIds: s.auction.final.showdown.participatingPlayerIds.filter((id) => s.auction!.final!.showdown!.locked[id]),
          myLocked: s.auction.final.showdown.locked[viewerId] ?? false,
          revealedCard: s.auction.final.stage === "SHOWDOWN_REVEAL" && s.auction.final.showdown.revealedCard ? { ...s.auction.final.showdown.revealedCard } : null,
          advancingPlayerIds: s.auction.final.stage === "SHOWDOWN_REVEAL" ? [...s.auction.final.showdown.advancingPlayerIds] : [],
          winnerId: s.auction.final.stage === "SHOWDOWN_REVEAL" ? s.auction.final.showdown.winnerId : null,
        } : null,
        players: Object.fromEntries(Object.entries(s.auction.final.players).map(([id, entry]) => {
          const own = id === viewerId;
          const revealed = ["REVEAL", "SHOWDOWN_PICK", "SHOWDOWN_REVEAL"].includes(s.auction!.final!.stage);
          const bid = revealed || own ? entry.bid : null;
          const modifier = revealed ? (s.auction!.players[id].activeCrown ? 2 : 0) : null;
          return [id, {
            status: revealed ? "REVEALED" : entry.bid !== null ? "BID_SUBMITTED" : entry.ready ? "READY" : "SETTLING",
            continued: revealed && entry.revealReady,
            balance: own ? entry.balance : null,
            converted: own ? { ...entry.converted, items: [...entry.converted.items] } : null,
            usable: own ? entry.usable : null,
            bid,
            modifier,
            effectiveBid: revealed ? entry.bid! + modifier! : null,
          }];
        })),
      } : null,
      players: Object.fromEntries(Object.entries(s.auction.players).map(([id, p]) => [id, {
        debt: s.auction!.final && id !== viewerId ? s.auction!.final.players[id].initial.debt : p.debt,
        items: s.auction!.final && id !== viewerId ? [] : [...p.items],
        usedLotEffects: s.auction!.final && id !== viewerId ? [] : [...p.usedLotEffects],
        armedBlackDie: s.auction!.final && id !== viewerId ? 0 : p.armedBlackDie,
        armedCoin: s.auction!.final && id !== viewerId ? 0 : p.armedCoin,
        activeCrown: s.auction!.final && id !== viewerId && !["REVEAL", "SHOWDOWN_PICK", "SHOWDOWN_REVEAL"].includes(s.auction!.final.stage) ? false : p.activeCrown,
        sanityWard: s.auction!.final && id !== viewerId ? false : p.sanityWard,
        itemNotice: id === viewerId ? p.itemNotice : null,
        redContractRemainingRounds: p.redContractRemainingRounds,
        redContractStartsRound: id === viewerId ? p.redContractStartsRound : null,
        nextRollPenalty: id === viewerId ? p.nextRollPenalty : null,
        passed: s.auction!.passedPlayers.includes(id),
        blackChips: id === viewerId ? p.blackChips : null,
        privateIntel: id === viewerId ? [...p.privateIntel] : null,
        reads: id === viewerId ? [...p.reads] : null,
        glassEyeSnapshots: id === viewerId ? p.glassEyeSnapshots.map((snap) => ({ round: snap.round, chips: { ...snap.chips } })) : null,
      }])),
      deal: s.auction.deal && [s.auction.deal.from, s.auction.deal.to].includes(viewerId) ? s.auction.deal : null,
      challenge: s.auction.challenge ? (({ deck: _deck, ...visible }) => visible)(s.auction.challenge) : null,
    } } : {}),
    ...(s.temporal ? { temporal: {
      story: { revealed: [...s.temporal.story.revealed], availableRoutes: [...s.temporal.story.availableRoutes] },
      finalRoute: s.temporal.finalRoute,
      bootstrapProgress: { placed: s.temporal.bootstrap.filter((item) => item.placedBy === item.assignedTo).length, total: s.temporal.bootstrap.length },
      discoveredFacts: [...s.temporal.discoveredFacts],
      locations: { ...s.temporal.locations },
      present: { ...s.temporal.present },
      interventions: s.temporal.interventions.map((item) => ({ ...item, actorId: s.temporal!.story.revealed.includes("INTRUDERS_IDENTIFIED") ? item.actorId : null })),
      surveillance: s.temporal.surveillanceReviewed || s.temporal.story.revealed.includes("INTRUDERS_IDENTIFIED")
        ? s.temporal.surveillance.map(({ evidenceId: _evidenceId, ...item }) => ({ ...item, actorId: s.temporal!.story.revealed.includes("INTRUDERS_IDENTIFIED") ? item.actorId : null }))
        : [],
      surveillanceReviewed: s.temporal.surveillanceReviewed,
      accessLedgerReviewed: s.temporal.accessLedgerReviewed,
      prototypeLogReviewed: s.temporal.prototypeLogReviewed,
      identityMatches: s.temporal.story.revealed.includes("INTRUDERS_IDENTIFIED") ? [...s.temporal.identityMatches] : [],
      causalRevision: s.temporal.causalRevision,
      myEvidence: [...(s.temporal.evidence[viewerId] ?? [])],
      worldItems: Object.values(s.temporal.storedItems).filter((item) => item.status === "AVAILABLE_2026" || item.status === "STORED").map(({ ownerId: _ownerId, bootstrapOwnerId: _bootstrapOwnerId, ...item }) => item),
      myItems: Object.values(s.temporal.storedItems).filter((item) => item.ownerId === viewerId).map(({ bootstrapOwnerId: _bootstrapOwnerId, ...item }) => item),
      myObligations: s.temporal.bootstrap.filter((item) => item.assignedTo === viewerId),
    } } : {}),
  };
}

/** Truth values stay on the server until the run is over (results reveal them). */
function ownSecrets(sec: PlayerSecrets, over: boolean): ViewerSecrets {
  if (over) return sec;
  return {
    ...sec,
    messages: sec.messages,
    dreamCards: sec.dreamCards,
  };
}
