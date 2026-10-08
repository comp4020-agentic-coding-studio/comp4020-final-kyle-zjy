// Authoritative game state. The server holds the full GameState; clients only
// ever receive a PlayerView built by project(state, viewerId), which strips
// every secret that isn't the viewer's (see docs/game-state.md §12).
import type { CharacterId, MBTI, RollTier, TriggerKind, Zodiac } from "../characters/types.ts";
import type { PartId, S02ItemId } from "./scenario02/items.ts";
import type { RoomId03, Year03 } from "./scenario03/map.ts";
import type { S03ItemId } from "./scenario03/items.ts";
import type { FactId03 } from "./scenario03/facts.ts";
import type { EndingRoute03, StoryBeatId03 } from "./scenario03/story.ts";
import type { ActionAvailability } from "./actions.ts";
import type { Effect, StatusPolarity } from "./effects.ts";
import type { Msg } from "../i18n/types.ts";

export type PlayerId = string;
export type RoomCode = string;

export const GAME_PHASES = ["LOBBY", "INTRO", "ACT_1", "ACT_2", "ACT_3", "ACT_4", "ENDING", "RESULTS"] as const;
export type GamePhase = (typeof GAME_PHASES)[number];

/** Per-member progress through character selection inside LOBBY. */
export type MemberStage = "JOINED" | "ZODIAC_CHOSEN" | "REVEALED" | "READY";

export type RoundStep = "ROUND_START" | "PLAYER_TURNS" | "INSPECTOR" | "WORLD" | "ROUND_EVENT" | "ROUND_END";

export type Member = {
  playerId: PlayerId;
  seat: number;
  nickname: string;
  stage: MemberStage;
  zodiac: Zodiac | null;
  mbti: MBTI | null;
  connected: boolean;
  isHost: boolean;
};

export type RoomState = {
  code: RoomCode;
  phase: GamePhase;
  scenarioId: ScenarioId;
  members: Member[];
  version: number;
};

export type ScenarioId = "S01_LAST_TRAIN" | "S02_SUNKEN_CITY" | "S03_INCIDENT_ZERO";

export type Temporal03 = {
  story: { revealed: StoryBeatId03[]; availableRoutes: EndingRoute03[] };
  finalRoute: EndingRoute03 | null;
  discoveredFacts: FactId03[];
  locations: Record<PlayerId, { roomId: RoomId03; year: Year03 }>;
  baselinePresent: TemporalPresent03;
  present: TemporalPresent03;
  interventions: TemporalIntervention03[];
  evidence: Record<PlayerId, string[]>;
  causalRevision: number;
  storedItems: Record<string, TemporalItem03>;
  bootstrap: BootstrapObligation03[];
  holdings: Record<PlayerId, { artifacts: string[] }>;
  sealedProfiles: TemporalProfile03[];
  surveillance: TemporalTrace03[];
  surveillanceReviewed: boolean;
  accessLedgerReviewed: boolean;
  prototypeLogReviewed: boolean;
  identityMatches: TemporalIdentityMatch03[];
};

export type TemporalProfile03 = { signature: string; characterId: CharacterId; seat: number };
export type TemporalIdentityMatch03 = { signature: string; playerId: PlayerId };
export type TemporalTrace03 = {
  seq: number;
  kind: "ARRIVAL" | "MOVEMENT" | "INVESTIGATION" | "INTERVENTION" | "RELIC_STORAGE";
  signature: string;
  actorId: PlayerId;
  round: number;
  roomId: RoomId03;
  nodeId?: TemporalIntervention03["nodeId"];
  choiceId?: string;
  instanceId?: string;
  evidenceId?: string;
};
export type PublicTemporalTrace03 = Omit<TemporalTrace03, "actorId" | "evidenceId"> & { actorId: PlayerId | null };

export type TemporalItem03 = {
  instanceId: string;
  itemId: S03ItemId;
  roomId: RoomId03;
  status: "AVAILABLE_2026" | "HELD_2026" | "HELD_1996" | "STORED" | "ERASED";
  ownerId: PlayerId | null;
  bootstrapOwnerId: PlayerId | null;
  storedBy: PlayerId | null;
  storedRound: number | null;
};

export type BootstrapObligation03 = {
  instanceId: string;
  assignedTo: PlayerId;
  storageRoom: RoomId03;
  placedBy: PlayerId | null;
};

export type TemporalPresent03 = {
  caseFile: "A" | "B";
  researchFacility: "TEMPORAL_CONTAINMENT";
  secretArchiveOpen: boolean;
  workerPresent: boolean;
  badgeCache: boolean;
  report: "OFFICIAL" | "CORRECTED";
  powerRoomExists: boolean;
  administrationIntegrity: "STABLE" | "FADING";
  accidentRecord: "PENDING" | "OFFICIAL" | "CONTROLLED" | "ERASED";
  staffEvacuated: boolean;
  jiStaged: boolean;
  prototypeHidden: boolean;
};

export type TemporalIntervention03 = {
  seq: number;
  nodeId: "ARCHIVE_GATE" | "WORKER" | "REPORT" | "PROTOTYPE_CORE" | "ACCIDENT_RECORD" | "STAFF_EVACUATION" | "JI_RECORD" | "PROTOTYPE_FATE";
  choiceId: string;
  actorId: PlayerId;
  round: number;
  roomId: RoomId03;
  year: "Y1996";
};

export type PublicTemporal03 = Omit<Temporal03, "baselinePresent" | "evidence" | "storedItems" | "bootstrap" | "holdings" | "sealedProfiles" | "surveillance" | "interventions"> & {
  bootstrapProgress: { placed: number; total: number };
  surveillance: PublicTemporalTrace03[];
  interventions: (Omit<TemporalIntervention03, "actorId"> & { actorId: PlayerId | null })[];
  myEvidence: string[];
  worldItems: Omit<TemporalItem03, "ownerId" | "bootstrapOwnerId">[];
  myItems: Omit<TemporalItem03, "bootstrapOwnerId">[];
  myObligations: BootstrapObligation03[];
};

// ---- scenario 01 -----------------------------------------------------------

export type CarriageIdentity = "START" | "DINING" | "LUGGAGE" | "MIRROR" | "ARCHIVE" | "SLEEPER" | "ENGINE_ROOM" | "CAB";

export type Carriage = {
  /** Physical node index, 0 = rear. Never changes; identities move (Reality Fold). */
  index: number;
  identity: CarriageIdentity;
  locked: boolean;
};

export type AnchorId = "POWER" | "IDENTITY" | "MEMORY";

export type Anchor = {
  id: AnchorId;
  progress: number;
  required: number;
  lastRepairedBy: PlayerId | null;
  repaired: boolean;
};

export type FragmentType = "ROUTE" | "DRIVER" | "MANIFEST" | "WITNESS" | "TICKET" | "SIGNAL";

/** Every item of every scenario (each scenario's pools only draw its own). */
export type ItemId = S01ItemId | S02ItemId | S03ItemId;

export type S01ItemId =
  | "OLD_KEY"
  | "FLASHLIGHT"
  | "MEDKIT"
  | "SPARE_BATTERY"
  | "PASSENGER_PASS"
  | "RED_UMBRELLA"
  | "BLANK_TICKET"
  | "POCKET_WATCH"
  | "BLACK_COIN"
  // key items: made by restoring an anchor, one each, never random
  | "POWER_KEY"
  | "IDENTITY_KEY"
  | "MEMORY_KEY";

export type KeyItemId = "POWER_KEY" | "IDENTITY_KEY" | "MEMORY_KEY";

/** The three escape locks of act 3; each opens only for the player carrying its key. */
export type EscapeLockId = "power" | "identity" | "memory";

export type NightRuleId =
  | "MERCURY_RETROGRADE"
  | "FULL_MOON"
  | "VOID_HOUR"
  | "TWIN_NIGHT"
  | "RED_EYE"
  | "DISPLACED_TIME"
  | "LUCKY_NIGHT"
  | "NAMELESS_NIGHT";

export type ObsessionId =
  | "NO_DEBTS"
  | "WAY_HOME"
  | "I_KNOW_THEM"
  | "COLLECTOR"
  | "DOUBT_EVERYTHING"
  | "LUCKY"
  | "LIFESAVER"
  | "GAMBLER"
  | "LONE_WOLF"
  | "LAST_TRAIN";

export type Status = {
  id: string;
  kind: string;
  polarity: StatusPolarity;
  sourceId: PlayerId | "SYSTEM";
  /** Removed at the end of this round; null = until removed. */
  expiresAtRound: number | null;
  hidden: boolean;
  /** Ordinary statuses can be cleansed by STABILIZE and common skills. */
  ordinary: boolean;
  /** Free-form magnitude (e.g. a roll modifier). */
  value?: number;
};

export type SkillState = "READY" | "BURNED" | "LOCKED";

export type PlayerGameState = {
  playerId: PlayerId;
  nickname: string;
  seat: number;
  characterId: CharacterId;
  fate: number;
  sanity: number;
  ap: number;
  lost: boolean;
  carriageIndex: number;
  skill: { usesLeft: number; state: SkillState; borrowed?: CharacterId };
  items: ItemId[];
  statuses: Status[];
  /** Pending bonus on the next ordinary roll (HELP), capped at +2. */
  helpBonus: number;
  /** Who contributed to helpBonus (obsession tracking). */
  helpFrom: PlayerId[];
  shields: number;
  /** Disconnected or left mid-run: turns auto-pass, windows take defaults. */
  away: boolean;
  /** Stored roll result for "record now, reuse later" skills. */
  storedResult: number | null;
  /** A previewed die: the raw value of this player's next roll, fixed in advance. */
  nextRaw: number | null;
  /** A bet on the next own roll (Double Down, High or Low). */
  wager: { onSuccess: Effect[]; onFail: Effect[]; label: Msg } | null;
  /** Ordinary statuses as they stood at the end of last round (Version Rollback). */
  lastRoundStatuses: Status[] | null;
  counters: Record<string, number>;
  stats: PlayerStats;
};

export type PlayerStats = {
  helpsGiven: number;
  helpsReceived: number;
  carriagesVisited: CarriageIdentity[];
  perfects: number;
  successes: number;
  failures: number;
  fateSpentOnDice: number;
  hiddenInvestigations: number;
  damageTakenForOthers: number;
  soloKeyTasks: number;
  finalTaskRound: number | null;
  fragmentsFound: number;
  repairs: number;
  confronts: number;
  skillUsedRound: number | null;
  attacksMade: number;
  timesLost: number;
};

export type RollPurpose = "INVESTIGATE" | "SEARCH" | "REPAIR" | "CONFRONT" | "TICKET_CHECK" | "EVENT" | "SKILL" | "S2_WADE" | "S2_SEARCH" | "S2_INVESTIGATE" | "S2_WORK" | "S2_RESCUE" | "S2_RISK" | "S2_RESTART" | "S3_SCAN_ARCHIVE" | "S3_SCAN_FIELD" | "S3_SCAN_STABILIZE";

export type Roll = {
  id: string;
  playerId: PlayerId;
  purpose: RollPurpose;
  label: Msg;
  raw: number;
  modifiers: { source: Msg; delta: number }[];
  fateSpent: number;
  final: number;
  tier: RollTier;
  modifiable: boolean;
  /** Set once every window on this roll has closed and it has been applied. */
  done: boolean;
};

/** What happens when a roll in progress resolves. Opaque to clients. */
export type RollContext = {
  kind: RollPurpose;
  carriageIndex: number;
  target?: string;
  repairTarget?: string;
  eventId?: string;
  skillOwner?: PlayerId;
  /** Effects keyed by tier, for skill/event rolls. */
  onTier?: Partial<Record<RollTier, Effect[]>>;
  /** Doubles every reward / penalty of this roll (All In, Double Down…). */
  stakes?: { rewardMult: number; penaltyMult: number; onSuccess?: Effect[]; onFail?: Effect[]; noPenalty?: boolean };
  /** Reaction holders already asked about this roll. */
  asked?: PlayerId[];
};

/** Queued engine work, run in order whenever no roll or window is in progress. */
/** What happened this round, for skills that look back at it. Reset each round. */
export type RoundRecord = {
  /** Players in the order of their first success this round. */
  succeeded: PlayerId[];
  lastSuccess: PlayerId | null;
  bestRoll: number;
  /** [helper, helped] for every help this round. */
  helps: [PlayerId, PlayerId][];
  /** [source, target] for every attack this round. */
  attacks: [PlayerId, PlayerId][];
  /** Players some other player's ability or effect targeted this round. */
  targeted: PlayerId[];
  /** Players who received a negative effect / attacked someone / used an active ability this round. */
  hurt: PlayerId[];
  attackers: PlayerId[];
  usedActive: PlayerId[];
};

export type Job = { kind: "TICKET_CHECK" | "ECHO_STRIKE"; playerId: PlayerId; payload?: Record<string, string | number> };

export type WindowKind = "FATE_SPEND" | "REACTION" | "PASSIVE_CONFIRM" | "TARGET_CHOICE" | "EVENT_CHOICE" | "VOTE" | "TRADE_OFFER" | "ENDING_CHOICE" | "SKILL_CHOICE";

export type WindowOption = { id: string; label: Msg; detail?: Msg };

export type PendingWindow = {
  id: string;
  kind: WindowKind;
  title: Msg;
  prompt: Msg;
  addressees: PlayerId[];
  options: WindowOption[];
  defaultOptionId: string;
  /** Answers received so far (votes collect several). */
  answers: Record<PlayerId, string>;
  /** Engine continuation once the window closes. Opaque to clients. */
  resume: { kind: string; payload?: Record<string, unknown> };
  /** Does this window freeze everyone else's actions? */
  blocksTable: boolean;
  /** Whose decision it is shown as (e.g. the skill owner). */
  ownerId?: PlayerId;
};

/** An effect waiting to land on a player, so reaction skills can answer it first. */
export type PendingEffect = {
  id: string;
  /** EFFECT: one negative effect aimed at targetId. ABILITY: a whole targeted ability, before it applies. */
  kind: "EFFECT" | "ABILITY";
  /** ABILITY: the chosen targets (may be changed by reactions). */
  targets: PlayerId[];
  /** Copies of the effect sent back to the source when it lands. */
  copyBack: { weaken: boolean }[];
  /** Is it an attack (from another player) / a theft (Fate or items taken)? */
  attack: boolean;
  theft: boolean;
  sourceId: PlayerId | "SYSTEM";
  targetId: PlayerId;
  label: Msg;
  effects: Effect[];
  /** Single-target negative effects can be dodged / redirected. */
  single: boolean;
  /** Effect strength reductions already applied. */
  reduced: number;
  cancelled: boolean;
  asked: PlayerId[];
  /** What the engine was doing before (resumes after landing). */
  then?: { kind: string; payload?: Record<string, unknown> };
};

export type Entity = {
  id: string;
  kind: "SHADOW" | "ECHO";
  carriageIndex: number;
  hp: number;
  targetId: PlayerId | null;
};

export type Inspector = {
  active: boolean;
  carriageIndex: number;
  distortion: number;
  banishedUntilRound: number | null;
  targetId: PlayerId | null;
};

/** S02_EVACUATED: the boat left the sunken city (who was aboard is in each result). */
export type Outcome = "NORMAL" | "TRUE_DELETE" | "TRUE_TICKET" | "FAILED" | "S02_EVACUATED" | "S03_OFFICIAL_HISTORY" | "S03_NO_TOMORROW" | "S03_DECEIVE_HISTORY";

/** BOAT_LOST: a part the boat needs went under before anyone found it. */
export type FailReason = "COLLAPSE" | "TIME" | "ALL_LOST" | "BOAT_LOST";

export type LogLine = {
  seq: number;
  /** In-fiction clock, starting at 00:17. */
  clock: string;
  /** What happened, for each client to render in its own locale. */
  msg: Msg;
  /** The same line in English (server logs, tests). */
  text: string;
  kind: string;
  /** Player the line is about (for avatars in the log). */
  actorId?: PlayerId;
};

export type TaskGoal = "REPAIR" | "FRAGMENT" | "HELP" | "NEW_CARRIAGE";

/** A goal set by an ability; pays `reward` (scope: the setter as SELF, the holder as TARGET) when met in time. */
export type PlayerTask = { id: string; text: Msg; untilRound: number; done: boolean; goal: TaskGoal; baseline: number; reward: Effect[]; setBy: PlayerId };

/** Owner-only data. Never leaves the server except to its owner. */
export type PlayerSecrets = {
  obsession: ObsessionId | null;
  messages: { id: string; text: Msg; round: number }[];
  allies: PlayerId[];
  dreamCards: { id: string; text: Msg }[];
  peeks: { id: string; text: Msg; round: number }[];
  tasks: PlayerTask[];
};

/** The owner's secrets as sent to them. Messages and dream cards are always true. */
export type ViewerSecrets = PlayerSecrets;

export type DelayedEffect = { dueRound: number; ownerId: PlayerId; targets: PlayerId[]; effects: Effect[]; label: Msg };

export type Bond = {
  id: string;
  members: PlayerId[];
  untilRound: number;
  onGainFate?: number;
  onFirstSuccess?: number;
  onFirstReward?: number;
  onMutualHelp?: number;
  /** Only the first member's gains / successes / rewards pay the others. */
  oneWay?: boolean;
  secret: boolean;
  ownerId: PlayerId;
  fired: string[];
};

/** A short cinematic everyone sees at once (intro, blackout, fold, ending). */
/** A scene everyone sees at once; it ends when every connected passenger has pressed Continue (or the host skips). */
export type Sequence = {
  kind: "INTRO" | "BLACKOUT" | "FOLD" | "CAB_OPEN" | "ENDING" | "FLOOD" | "CAPACITY" | "S3_IDENTITY" | "S3_THIRD_ROUTE";
  /** FLOOD: the act the city has just entered. */
  stage?: number;
  acks: PlayerId[];
  /** FOLD: the carriage order before and after, by node index (so a reload replays the same fold). */
  fold?: { before: CarriageIdentity[]; after: CarriageIdentity[] };
};

export type ActiveEvent = {
  id: string;
  round: number;
  resolved: boolean;
  resultText?: Msg;
  choice?: string;
  /** While reactions to its reveal are being asked. */
  revealing?: boolean;
  asked?: PlayerId[];
  /** Changes reactions made before it resolved. */
  cancelled?: boolean;
  softened?: boolean;
  excluded?: PlayerId[];
  /** One player decides a choice event for everyone (Lead Role, The Other Way). */
  decider?: PlayerId;
  /** An everyone-chooses event becomes a vote (Put It to a Vote). */
  asVote?: boolean;
  /** A group-roll event's dice, while "after the roll" reactions are asked. */
  groupRolls?: Record<PlayerId, number>;
  rolling?: boolean;
};

/** An after-the-fact trigger waiting for its holders to be asked. */
export type QueuedTrigger = {
  kind: TriggerKind;
  sourceId?: PlayerId | "SYSTEM";
  subjectId?: PlayerId;
  tier?: RollTier;
  amount?: number;
  condition?: string;
  /** The status that triggered it (buffs, expiry). */
  status?: Status;
  /** The item a reward was (Snatch). */
  item?: ItemId;
  asked: PlayerId[];
};

/** Per-player summary on the results screen (secrets are revealed once the run is over). */
export type PlayerResult = {
  playerId: PlayerId;
  obsession: ObsessionId | null;
  obsessionMet: boolean;
  title: Msg;
  highlights: Msg[];
  messages: { text: Msg }[];
  /** Scenario 02: how this player's run ended. */
  escape?: EscapeFate;
};

export type EscapeFate = "ESCAPED" | "ENGINEER" | "LEFT_BEHIND" | "DROWNED";

export type TuningTier = "SMALL" | "STANDARD" | "LARGE";

export type GameConfig = {
  playerCount: number;
  tier: TuningTier;
  anchorRequired: number;
  inspectorTargets: number;
  /** Carriages the Inspector walks per round in act 3 (act 2 is always 1). */
  inspectorStepsAct3: number;
  /** Collapse at the start: a fuller train is heavier. */
  startCollapse: number;
  /** Extra action points every round: a small table has fewer hands against the same Collapse clock. */
  bonusAp: number;
  /** Extra action points per round in act 3: two passengers can't otherwise reach three locks in one round. */
  act3BonusAp: number;
  echoes: number;
  awayTurnSeconds: number;
};

export type GameState = {
  sessionId: string;
  scenarioId: ScenarioId;
  phase: GamePhase;
  version: number;
  /** The version at which the current turn began; turn actions sent from an older view are refused. */
  turnVersion: number;
  seed: string;
  /** sfc32 generator state: replay = seed + action log. */
  rng: [number, number, number, number];
  rngCalls: number;
  config: GameConfig;

  round: number;
  act: 1 | 2 | 3 | 4;
  step: RoundStep;
  turnOrder: PlayerId[];
  activeIndex: number;
  turnDeadline: number | null;

  collapse: number;
  collapseMax: number;
  carriages: Carriage[];
  anchors: Record<AnchorId, Anchor>;
  fragments: FragmentType[];
  coreMemories: number;
  inspector: Inspector;
  entities: Entity[];
  seatNeighbours: PlayerId[][];
  escape: { round: number | null; power: boolean; identity: boolean; memory: boolean; by: Partial<Record<EscapeLockId, PlayerId>> };
  /** Scenario 01's rule for the night; null in a scenario without night rules. */
  nightRule: NightRuleId | null;
  eventDeck: string[];
  currentEvent: ActiveEvent | null;
  delayed: DelayedEffect[];
  bonds: Bond[];
  ruleMods: { rule: string; delta: number; untilRound: number }[];

  players: Record<PlayerId, PlayerGameState>;
  secrets: Record<PlayerId, PlayerSecrets>;
  pending: PendingWindow[];
  roll: Roll | null;
  rollContext: RollContext | null;
  pendingEffect: PendingEffect | null;
  triggerQueue: QueuedTrigger[];
  /** The last ability used, for copies. */
  lastSkill: { ownerId: PlayerId; characterId: CharacterId; targets: PlayerId[]; round: number } | null;
  roundRecord: RoundRecord;
  jobs: Job[];
  sequence: Sequence | null;
  /** Scenario 02's city; null in scenario 01. A player's node there is their `carriageIndex` (a zone index). */
  city: CityState | null;
  /** Scenario 03's two-year position state; absent in older scenario snapshots. */
  temporal?: Temporal03 | null;
  flags: Record<string, number>;

  outcome: Outcome | null;
  failReason: FailReason | null;
  endingChoice: "DELETE" | "TICKET" | null;
  results: PlayerResult[] | null;
  log: LogLine[];
  logSeq: number;
};

/** What one client receives. Server-only fields are gone; secrets are the viewer's own. */
export type PlayerView = Omit<
  GameState,
  "secrets" | "seed" | "rng" | "rngCalls" | "eventDeck" | "players" | "pending" | "rollContext" | "pendingEffect" | "delayed" | "bonds" | "jobs" | "triggerQueue" | "roundRecord" | "city" | "temporal"
> & {
  city: PublicCity | null;
  temporal?: PublicTemporal03 | null;
  viewerId: PlayerId;
  mySecrets: ViewerSecrets | null;
  players: Record<PlayerId, PublicPlayerState>;
  pending: PublicWindow[];
  /** Effects about to land, as far as the viewer may know. */
  incoming: { label: Msg; targetId: PlayerId; sourceId: PlayerId | "SYSTEM" } | null;
  /** The viewer's own bonds and every public bond. */
  bonds: Omit<Bond, "fired">[];
  myActions: ActionAvailability[];
  deckSize: number;
};

export type PublicPlayerState = Omit<PlayerGameState, "statuses" | "storedResult" | "counters"> & {
  statuses: Status[];
  hasStoredResult: boolean;
};

export type PublicWindow = Omit<PendingWindow, "resume" | "answers"> & {
  answeredBy: PlayerId[];
  myAnswer: string | null;
};

// ---- scenario 02: the sinking city ----------------------------------------

export type Elevation = "LOW" | "MEDIUM" | "HIGH";
/** BLOCKED: closed by debris (events), whatever the water. */
export type ZoneStatus = "NORMAL" | "FLOODED" | "SUBMERGED" | "BLOCKED";

export type CityZone = {
  status: ZoneStatus;
  searched: boolean;
  powered: boolean;
  /** Server only: the Collapse at which this zone floods / goes under (seeded per run). */
  floodAt: number;
  sinkAt: number;
  /** Server only: what a search here turns up (seeded per run). */
  caches: string[];
};

export type CityEdge = {
  a: number;
  b: number;
  kind: "ROAD" | "TUNNEL" | "LOW_BRIDGE";
  /** Server only: the Collapse at which a tunnel or low bridge gives way. */
  breakAt: number | null;
  broken: boolean;
};

/** A big job (the power station, the pumps): several people, several rounds. */
export type Facility = { required: number; progress: number; done: boolean; workedThisRound: PlayerId[]; contributors: Record<PlayerId, number> };

export type CityNpc = { id: string; zone: number; state: "WAITING" | "RESCUED" | "LOST" };

/** Key items, apart from the ordinary item list so nothing random can touch them. */
export type Holding = { parts: PartId[]; /** Evacuation passes: the right to compete for a seat, not a seat. */ passes: number };

/**
 * The evacuation boat at the pier. Ready once its three parts are installed,
 * the pier has power and the pier gate is repaired. Capacity is drawn per run
 * and kept from players until someone sees the boat (or the city is half gone).
 * After boarding, it leaves once someone still in the city restarts the
 * generator at the power station (or at once, with the auto-control chip).
 */
export type Boat = {
  capacity: number;
  revealed: boolean;
  installed: PartId[];
  /** Power by two emergency batteries (the alternative to the power station). */
  batteryPower: boolean;
  /** The auto-control chip is fitted: the boat starts itself, nobody has to restart the generator. */
  autoStart: boolean;
  /** The round the boat was first found ready in act 2 or later; boarding comes the round after. */
  readyRound: number | null;
  /** Boarded: locked in, no more turns. */
  aboard: PlayerId[];
  /** Who restarted the generator at the power station, sending the boat off (stays behind). */
  engineer: PlayerId | null;
  launched: boolean;
};

export type CityState = {
  zones: CityZone[];
  edges: CityEdge[];
  startZone: number;
  /** Rises the next round-end Collapse step skips (pumps, good events). */
  hold: number;
  /** Extra rises the next round-end step adds (storms). */
  surge: number;
  facilities: Record<"POWER_STATION" | "PUMP_STATION" | "HARBOUR_GATE", Facility>;
  boat: Boat;
  /** Server only: which pass sources are live this run (more passes than seats, never all of them). */
  passSources: string[];
  rescues: Record<PlayerId, number>;
  /** Intel players chose to read out: everyone keeps it in their secrets drawer. */
  shared: { from: PlayerId; text: Msg; round: number }[];
  /** The round the pumps were last run (once a round). */
  pumpedRound: number;
  holdings: Record<PlayerId, Holding>;
  npcs: CityNpc[];
  /** Public work done (repairs, rescues, pumping): titles, and passes later. */
  contrib: Record<PlayerId, number>;
};

/** What every player sees of a zone: its state now, and whether it goes under at the next rise. */
export type PublicZone = Omit<CityZone, "floodAt" | "sinkAt" | "caches"> & { warning: boolean };
export type PublicEdge = Omit<CityEdge, "breakAt">;
/** Others see how many parts someone carries, not which. */
export type PublicHolding = { parts: PartId[] | null; partCount: number; /** Only the holder sees their own passes. */ passes: number | null };
export type PublicCity = Omit<CityState, "zones" | "edges" | "holdings" | "passSources" | "boat"> & {
  zones: PublicZone[];
  edges: PublicEdge[];
  holdings: Record<PlayerId, PublicHolding>;
  /** Capacity is null until revealed. */
  boat: Omit<Boat, "capacity"> & { capacity: number | null };
  /** Passes the evacuation office has left; null until it opens (act 2). */
  officePasses: number | null;
  /** Passes in players' hands (every pass handed out is in the public log; who holds them is not shown). */
  passesOut: number;
  /** Public pass sources still open: waiting people known to carry one, and the office once open. Hidden sources are not counted. */
  knownPassSources: number;
};
