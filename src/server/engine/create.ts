// A new run of scenario 01 from the room's seated members and a seed. Every
// random choice here (carriage order, night rule, items, obsessions, deck,
// turn order) is drawn from the seeded generator.
import { getCharacter } from "../../shared/characters/roster/index.ts";
import type { MBTI, Zodiac } from "../../shared/characters/types.ts";
import {
  CARRIAGES,
  ITEM_IDS,
  MIDDLE,
  NIGHT_RULES,
  NIGHT_RULE_IDS,
  OBSESSION_IDS,
  SCENARIO,
  START_FATE,
  START_SANITY,
  tuningFor,
} from "../../shared/game/scenario01/content.ts";
import { EVENT_IDS } from "../../shared/game/scenario01/events.ts";
import type { GameState, PlayerGameState, PlayerId, RoundRecord } from "../../shared/game/state.ts";
import { log, type Ctx } from "./context.ts";
import { int, pick, seedState, shuffle } from "./rng.ts";
import { m, ref } from "../../shared/i18n/msg.ts";

export type Seat = { playerId: PlayerId; nickname: string; seat: number; zodiac: Zodiac; mbti: MBTI };

export function emptyStats(): PlayerGameState["stats"] {
  return {
    helpsGiven: 0,
    helpsReceived: 0,
    carriagesVisited: ["START"],
    perfects: 0,
    successes: 0,
    failures: 0,
    fateSpentOnDice: 0,
    hiddenInvestigations: 0,
    damageTakenForOthers: 0,
    soloKeyTasks: 0,
    finalTaskRound: null,
    fragmentsFound: 0,
    repairs: 0,
    confronts: 0,
    skillUsedRound: null,
    attacksMade: 0,
    timesLost: 0,
  };
}

export function createGame(sessionId: string, seats: Seat[], seed: string, now: number): GameState {
  const ordered = [...seats].sort((a, b) => a.seat - b.seat);
  const config = tuningFor(ordered.length);
  const s: GameState = {
    sessionId,
    scenarioId: "S01_LAST_TRAIN",
    phase: "INTRO",
    version: 0,
    turnVersion: 0,
    seed,
    rng: seedState(seed),
    rngCalls: 0,
    config,
    round: 0,
    act: 1,
    step: "ROUND_START",
    turnOrder: [],
    activeIndex: 0,
    turnDeadline: null,
    collapse: config.startCollapse,
    collapseMax: SCENARIO.collapseMax,
    carriages: [],
    anchors: {
      POWER: { id: "POWER", progress: 0, required: config.anchorRequired, lastRepairedBy: null, repaired: false },
      IDENTITY: { id: "IDENTITY", progress: 0, required: config.anchorRequired, lastRepairedBy: null, repaired: false },
      MEMORY: { id: "MEMORY", progress: 0, required: config.anchorRequired, lastRepairedBy: null, repaired: false },
    },
    fragments: [],
    coreMemories: 0,
    inspector: { active: false, carriageIndex: 0, distortion: 0, banishedUntilRound: null, targetId: null },
    entities: [],
    seatNeighbours: [],
    escape: { round: null, power: false, route: false, drive: false, by: {} },
    nightRule: "FULL_MOON",
    eventDeck: [],
    currentEvent: null,
    delayed: [],
    bonds: [],
    ruleMods: [],
    players: {},
    secrets: {},
    pending: [],
    roll: null,
    rollContext: null,
    pendingEffect: null,
    triggerQueue: [],
    lastSkill: null,
    roundRecord: emptyRoundRecord(),
    jobs: [],
    sequence: { kind: "INTRO", acks: [] },
    flags: {},
    outcome: null,
    failReason: null,
    endingChoice: null,
    results: null,
    log: [],
    logSeq: 0,
  };
  const ctx: Ctx = { s, now, events: [] };

  s.carriages = [
    { index: 0, identity: "START", locked: false },
    ...shuffle(s, MIDDLE).map((identity, i) => ({ index: i + 1, identity, locked: false })),
    { index: MIDDLE.length + 1, identity: "CAB", locked: true },
  ];
  s.nightRule = pick(s, NIGHT_RULE_IDS);
  s.eventDeck = shuffle(s, EVENT_IDS);

  // turn order: seat order, starting from a random seat
  const start = int(s, ordered.length);
  s.turnOrder = [...ordered.slice(start), ...ordered.slice(0, start)].map((p) => p.playerId);

  const obsessions = shuffle(s, OBSESSION_IDS);
  ordered.forEach((seat, i) => {
    const character = getCharacter(seat.zodiac, seat.mbti);
    s.players[seat.playerId] = {
      playerId: seat.playerId,
      nickname: seat.nickname,
      seat: seat.seat,
      characterId: character.id,
      fate: START_FATE + (s.nightRule === "LUCKY_NIGHT" ? 1 : 0),
      sanity: START_SANITY,
      ap: 0,
      lost: false,
      carriageIndex: 0,
      skill: { usesLeft: character.skill.maxUses, state: "READY" },
      items: [pick(s, ITEM_IDS)],
      statuses: [],
      helpBonus: 0,
      helpFrom: [],
      shields: 0,
      away: false,
      storedResult: null,
      nextRaw: null,
      wager: null,
      lastRoundStatuses: null,
      counters: {},
      stats: emptyStats(),
    };
    s.secrets[seat.playerId] = {
      obsession: obsessions[i % obsessions.length],
      messages: [],
      allies: [],
      dreamCards: [],
      peeks: [],
      tasks: [],
    };
  });

  log(ctx, m`00:17. Every phone on the platform buzzes at once: Train N13 is arriving.`, "STORY");
  log(ctx, m`Tonight's rule: ${ref.nightRule(s.nightRule)}. ${ref.nightRuleText(s.nightRule)}`, "RULE");
  log(ctx, m`The train has ${s.carriages.length} carriages. The ${ref.carriage("CAB")} is locked.`, "STORY");
  return s;
}

export const emptyRoundRecord = (): RoundRecord => ({ succeeded: [], lastSuccess: null, bestRoll: 0, helps: [], attacks: [], targeted: [], hurt: [], attackers: [], usedActive: [] });
