// A new run of scenario 02 from the room's seated members and a seed: the
// city's flood schedule, the hidden parts, where everyone starts and the turn
// order are drawn from the seeded generator. Players start scattered across
// safe ground, a zone each while there are enough (spawnZones).
import { getCharacter } from "../../../shared/characters/roster/index.ts";
import { START_FATE, START_SANITY, tuningFor } from "../../../shared/game/scenario01/content.ts";
import { characterSkill } from "../../../shared/game/skills.ts";
import type { GameState } from "../../../shared/game/state.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { log, type Ctx } from "../context.ts";
import { emptyRoundRecord, emptyStats, type Seat } from "../create.ts";
import { int, seedState, shuffle } from "../rng.ts";
import { EVENT_IDS02 } from "../../../shared/game/scenario02/events.ts";
import { applyFlood, generateCity, spawnZones } from "./city.ts";

export const COLLAPSE_MAX = 12;

export function createScenario02(sessionId: string, seats: Seat[], seed: string, now: number): GameState {
  const ordered = [...seats].sort((a, b) => a.seat - b.seat);
  // the shared tuning (player count, the 2-player bonus action point); the city starts dry
  const config = { ...tuningFor(ordered.length), startCollapse: 0, act3BonusAp: 0 };
  const s: GameState = {
    sessionId,
    scenarioId: "S02_SUNKEN_CITY",
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
    collapseMax: COLLAPSE_MAX,
    // scenario 01's train has no part in this run
    carriages: [],
    anchors: {
      POWER: { id: "POWER", progress: 0, required: 0, lastRepairedBy: null, repaired: false },
      IDENTITY: { id: "IDENTITY", progress: 0, required: 0, lastRepairedBy: null, repaired: false },
      MEMORY: { id: "MEMORY", progress: 0, required: 0, lastRepairedBy: null, repaired: false },
    },
    fragments: [],
    coreMemories: 0,
    inspector: { active: false, carriageIndex: 0, distortion: 0, banishedUntilRound: null, targetId: null },
    entities: [],
    seatNeighbours: [],
    escape: { round: null, power: false, identity: false, memory: false, by: {} },
    nightRule: null,
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
    city: null,
    flags: {},
    outcome: null,
    failReason: null,
    endingChoice: null,
    results: null,
    log: [],
    logSeq: 0,
  };
  const ctx: Ctx = { s, now, events: [] };
  s.city = generateCity(s);
  s.eventDeck = shuffle(s, EVENT_IDS02);

  const spawn = spawnZones(s, s.city, ordered.length);
  const start = int(s, ordered.length);
  s.turnOrder = [...ordered.slice(start), ...ordered.slice(0, start)].map((p) => p.playerId);
  for (const [k, seat] of ordered.entries()) {
    const character = getCharacter(seat.zodiac, seat.mbti);
    s.players[seat.playerId] = {
      playerId: seat.playerId,
      nickname: seat.nickname,
      seat: seat.seat,
      characterId: character.id,
      fate: START_FATE,
      sanity: START_SANITY,
      ap: 0,
      lost: false,
      carriageIndex: spawn[k],
      skill: { usesLeft: characterSkill(character.id, s.scenarioId).maxUses, state: "READY" },
      items: [],
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
    s.secrets[seat.playerId] = { obsession: null, messages: [], allies: [], dreamCards: [], peeks: [], tasks: [] };
    s.city.holdings[seat.playerId] = { parts: [], passes: 0 };
    s.city.rescues[seat.playerId] = 0;
    s.city.contrib[seat.playerId] = 0;
  }
  log(ctx, m`The sirens stop. The water does not. The last people in the city are scattered across it, out of sight of each other.`, "STORY");
  log(ctx, m`An evacuation boat is moored at the pier. Nobody knows how many it can carry.`, "STORY");
  applyFlood(ctx);
  return s;
}
