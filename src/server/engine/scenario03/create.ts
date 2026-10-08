import { getCharacter } from "../../../shared/characters/roster/index.ts";
import { START_FATE, START_SANITY, tuningFor } from "../../../shared/game/scenario01/content.ts";
import { placeKey03 } from "../../../shared/game/scenario03/map.ts";
import { characterSkill } from "../../../shared/game/skills.ts";
import { EVENT_IDS03 } from "../../../shared/game/scenario03/events.ts";
import type { GameState } from "../../../shared/game/state.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { log, type Ctx } from "../context.ts";
import { emptyRoundRecord, emptyStats, type Seat } from "../create.ts";
import { int, seedState, shuffle } from "../rng.ts";
import { profile03 } from "./surveillance.ts";

export function createScenario03(sessionId: string, seats: Seat[], seed: string, now: number): GameState {
  const ordered = [...seats].sort((a, b) => a.seat - b.seat);
  const config = { ...tuningFor(ordered.length), startCollapse: 0, bonusAp: 0, act3BonusAp: 0 };
  const s: GameState = {
    sessionId, scenarioId: "S03_INCIDENT_ZERO", phase: "INTRO", version: 0, turnVersion: 0,
    seed, rng: seedState(seed), rngCalls: 0, config,
    round: 0, act: 1, step: "ROUND_START", turnOrder: [], activeIndex: 0, turnDeadline: null,
    collapse: 0, collapseMax: 12,
    carriages: [],
    anchors: {
      POWER: { id: "POWER", progress: 0, required: 0, lastRepairedBy: null, repaired: false },
      IDENTITY: { id: "IDENTITY", progress: 0, required: 0, lastRepairedBy: null, repaired: false },
      MEMORY: { id: "MEMORY", progress: 0, required: 0, lastRepairedBy: null, repaired: false },
    },
    fragments: [], coreMemories: 0,
    inspector: { active: false, carriageIndex: 0, distortion: 0, banishedUntilRound: null, targetId: null },
    entities: [], seatNeighbours: [],
    escape: { round: null, power: false, identity: false, memory: false, by: {} },
    nightRule: null, eventDeck: [], currentEvent: null, delayed: [], bonds: [], ruleMods: [],
    players: {}, secrets: {}, pending: [], roll: null, rollContext: null, pendingEffect: null,
    triggerQueue: [], lastSkill: null, roundRecord: emptyRoundRecord(), jobs: [],
    sequence: { kind: "INTRO", acks: [] }, city: null, temporal: {
      story: { revealed: ["LOCKDOWN"], availableRoutes: [] },
      finalRoute: null,
      discoveredFacts: [],
      locations: {},
      baselinePresent: { caseFile: "A", researchFacility: "TEMPORAL_CONTAINMENT", secretArchiveOpen: false, workerPresent: false, badgeCache: false, report: "OFFICIAL", powerRoomExists: true, administrationIntegrity: "STABLE", accidentRecord: "PENDING", staffEvacuated: false, jiStaged: false, prototypeHidden: false },
      present: { caseFile: "A", researchFacility: "TEMPORAL_CONTAINMENT", secretArchiveOpen: false, workerPresent: false, badgeCache: false, report: "OFFICIAL", powerRoomExists: true, administrationIntegrity: "STABLE", accidentRecord: "PENDING", staffEvacuated: false, jiStaged: false, prototypeHidden: false },
      interventions: [], evidence: {}, causalRevision: 0,
      storedItems: {}, bootstrap: [], holdings: {},
      sealedProfiles: [], surveillance: [], surveillanceReviewed: false,
      accessLedgerReviewed: false, prototypeLogReviewed: false, identityMatches: [],
    }, flags: {},
    outcome: null, failReason: null, endingChoice: null, results: null, log: [], logSeq: 0,
  };
  const ctx: Ctx = { s, now, events: [] };
  const caseFile = int(s, 2) === 0 ? "A" : "B";
  s.temporal!.baselinePresent.caseFile = caseFile;
  s.temporal!.present.caseFile = caseFile;
  const start = int(s, ordered.length);
  s.turnOrder = [...ordered.slice(start), ...ordered.slice(0, start)].map((seat) => seat.playerId);
  for (const seat of ordered) {
    const character = getCharacter(seat.zodiac, seat.mbti);
    s.players[seat.playerId] = {
      playerId: seat.playerId, nickname: seat.nickname, seat: seat.seat, characterId: character.id,
      fate: START_FATE, sanity: START_SANITY, ap: 0, lost: false,
      carriageIndex: placeKey03("CENTRAL_HALL", "Y2026"),
      skill: { usesLeft: characterSkill(character.id, s.scenarioId).maxUses, state: "READY" },
      items: [], statuses: [], helpBonus: 0, helpFrom: [], shields: 0, away: false,
      storedResult: null, nextRaw: null, wager: null, lastRoundStatuses: null,
      counters: {}, stats: emptyStats(),
    };
    s.secrets[seat.playerId] = { obsession: null, messages: [], allies: [], dreamCards: [], peeks: [], tasks: [] };
    s.temporal!.locations[seat.playerId] = { roomId: "CENTRAL_HALL", year: "Y2026" };
    s.temporal!.evidence[seat.playerId] = [];
    s.temporal!.holdings[seat.playerId] = { artifacts: [] };
  }
  s.temporal!.sealedProfiles = Object.values(s.players).map((p) => profile03(seed, p));
  s.eventDeck = shuffle(s, EVENT_IDS03);
  const firstOwner = int(s, ordered.length);
  for (const [index, itemId, roomId] of [[0, "TIME_MARKER", "ARCHIVES"], [1, "AUTHORITY_CARD", "CENTRAL_HALL"]] as const) {
    const assignedTo = ordered[(firstOwner + index) % ordered.length].playerId;
    const instanceId = `relic-${index + 1}`;
    s.temporal!.storedItems[instanceId] = { instanceId, itemId, roomId, status: "AVAILABLE_2026", ownerId: null, bootstrapOwnerId: assignedTo, storedBy: null, storedRound: null };
    s.temporal!.bootstrap.push({ instanceId, assignedTo, storageRoom: roomId, placedBy: null });
  }
  log(ctx, m`The clocks have stopped at 23:47. The Administration is under lockdown.`, "STORY");
  return s;
}
