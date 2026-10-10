import type { GameState } from "../../../shared/game/state.ts";
import { lotForRound04 } from "../../../shared/game/scenario04/lots.ts";
import { AUCTION_CONFIG04 } from "../../../shared/game/scenario04/config.ts";
import { characterSkill } from "../../../shared/game/skills.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { log } from "../context.ts";
import { createScenario01, type Seat } from "../create.ts";
import { START_FATE, START_SANITY } from "../../../shared/game/scenario01/content.ts";
import { shuffle } from "../rng.ts";
import { LOTS04 } from "../../../shared/game/scenario04/lots.ts";

export function createScenario04(sessionId: string, seats: Seat[], seed: string, now: number): GameState {
  const s = createScenario01(sessionId, seats, seed, now);
  const ordered = [...seats].sort((a, b) => a.seat - b.seat).map((seat) => seat.playerId);
  s.scenarioId = "S04_UNDERGROUND_AUCTION";
  s.phase = "INTRO";
  s.sequence = { kind: "INTRO", acks: [] };
  s.turnOrder = [...ordered];
  s.activeIndex = 0;
  s.round = 0;
  s.act = 1;
  s.step = "ROUND_START";
  s.collapse = 0;
  s.collapseMax = 10;
  s.carriages = [];
  s.nightRule = null;
  s.currentEvent = null;
  s.eventDeck = [];
  s.city = null;
  s.temporal = null;
  s.log = [];
  s.logSeq = 0;
  s.auction = {
    seatOrder: ordered,
    currentLot: lotForRound04(1).id,
    currentBid: 0,
    currentBidReal: 0,
    currentBidder: null,
    bidThisTurn: null,
    turnPlayerId: ordered[0] ?? null,
    roundStartPlayerId: ordered[0],
    passedPlayers: [],
    auctionOpen: false,
    final: null,
    auctionHistory: [],
    itemInstances: {},
    nextItemInstanceNumber: 1,
    players: Object.fromEntries(ordered.map((id) => [id, { blackChips: AUCTION_CONFIG04.startingBlackChips, debt: 0, items: [], usedLotEffects: [], armedBlackDie: 0, armedCoin: 0, activeCrown: false, sanityWard: false, itemNoticeSeq: 0, itemNotice: null, redContractRemainingRounds: 0, redContractStartsRound: 0, privateIntel: [], reads: [], glassEyeSnapshots: [], nextRollPenalty: 0 }])),
    publicIntel: [],
    counterfeitLots: shuffle(s, LOTS04.slice(0, 9).map((lot) => lot.id)).slice(0, 2),
    deal: null,
    challenge: null,
    stats: { highestBid: 0, challengesWon: {}, investigations: {}, deals: 0, borrows: {} },
  };
  for (const p of Object.values(s.players)) {
    p.fate = START_FATE;
    p.sanity = START_SANITY;
    p.ap = 0;
    p.items = [];
    p.statuses = [];
    p.skill = { usesLeft: characterSkill(p.characterId, s.scenarioId).maxUses, state: "READY" };
  }
  for (const secret of Object.values(s.secrets)) {
    secret.obsession = null;
    secret.messages = [];
    secret.allies = [];
    secret.dreamCards = [];
    secret.peeks = [];
    secret.tasks = [];
  }
  log({ s, now, events: [] }, m`The underground auction opens.`, "STORY");
  return s;
}
