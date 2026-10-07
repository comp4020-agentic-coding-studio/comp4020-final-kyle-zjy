// Authoritative game state. The server holds the full GameState; clients only
// ever receive a PlayerView built by project(state, viewerId), which strips
// every secret that isn't the viewer's (see docs/game-state.md §12).
import type { CharacterId, MBTI, RollTier, TriggerKind, Zodiac } from "../characters/types.ts";
import type { ActionAvailability } from "./actions.ts";
import type { Effect, StatusPolarity } from "./effects.ts";

export type PlayerId = string;
export type RoomCode = string;

export const GAME_PHASES = ["LOBBY", "INTRO", "ACT_1", "ACT_2", "ACT_3", "ENDING", "RESULTS"] as const;
export type GamePhase = (typeof GAME_PHASES)[number];

/** Per-member progress through character selection inside LOBBY. */
export type MemberStage = "JOINED" | "ZODIAC_CHOSEN" | "REVEALED" | "READY";

export type RoundStep = "ROUND_START" | "PLAYER_TURNS" | "INSPECTOR" | "ROUND_EVENT" | "ROUND_END";

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

export type ScenarioId = "S01_LAST_TRAIN";

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

export type ItemId =
  | "OLD_KEY"
  | "FLASHLIGHT"
  | "MEDKIT"
  | "SPARE_BATTERY"
  | "PASSENGER_PASS"
  | "RED_UMBRELLA"
  | "BLANK_TICKET"
  | "POCKET_WATCH"
  | "BLACK_COIN";

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
  wager: { onSuccess: Effect[]; onFail: Effect[]; label: string } | null;
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

export type RollPurpose = "INVESTIGATE" | "SEARCH" | "REPAIR" | "CONFRONT" | "TICKET_CHECK" | "EVENT" | "SKILL";

export type Roll = {
  id: string;
  playerId: PlayerId;
  purpose: RollPurpose;
  label: string;
  raw: number;
  modifiers: { source: string; delta: number }[];
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

export type WindowOption = { id: string; label: string; detail?: string; risk?: string };

export type PendingWindow = {
  id: string;
  kind: WindowKind;
  title: string;
  prompt: string;
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
  label: string;
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

export type Outcome = "NORMAL" | "TRUE_DELETE" | "TRUE_TICKET" | "FAILED";

export type FailReason = "COLLAPSE" | "TIME" | "ALL_LOST";

export type LogLine = {
  seq: number;
  /** In-fiction clock, starting at 00:17. */
  clock: string;
  text: string;
  kind: string;
  /** Player the line is about (for avatars in the log). */
  actorId?: PlayerId;
};

export type TaskGoal = "REPAIR" | "FRAGMENT" | "HELP" | "NEW_CARRIAGE";

/** A goal set by an ability; pays `reward` (scope: the setter as SELF, the holder as TARGET) when met in time. */
export type PlayerTask = { id: string; text: string; untilRound: number; done: boolean; goal: TaskGoal; baseline: number; reward: Effect[]; setBy: PlayerId };

/** Owner-only data. Never leaves the server except to its owner. */
export type PlayerSecrets = {
  obsession: ObsessionId;
  messages: { id: string; text: string; round: number; isTrue: boolean }[];
  allies: PlayerId[];
  dreamCards: { id: string; text: string; isTrue: boolean }[];
  peeks: { id: string; text: string; round: number }[];
  tasks: PlayerTask[];
};

/**
 * The owner's secrets as sent to them. Whether a message or dream is true is
 * the whole point of it, so `isTrue` only travels once the run is over.
 */
export type ViewerSecrets = Omit<PlayerSecrets, "messages" | "dreamCards"> & {
  messages: { id: string; text: string; round: number; isTrue?: boolean }[];
  dreamCards: { id: string; text: string; isTrue?: boolean }[];
};

export type DelayedEffect = { dueRound: number; ownerId: PlayerId; targets: PlayerId[]; effects: Effect[]; label: string };

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
export type Sequence = { kind: "INTRO" | "BLACKOUT" | "FOLD" | "CAB_OPEN" | "ENDING"; acks: PlayerId[] };

export type ActiveEvent = {
  id: string;
  round: number;
  resolved: boolean;
  resultText?: string;
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
  obsession: ObsessionId;
  obsessionMet: boolean;
  title: string;
  highlights: string[];
  messages: { text: string; isTrue: boolean }[];
};

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
  act: 1 | 2 | 3;
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
  escape: { round: number | null; power: boolean; route: boolean; drive: boolean; by: Partial<Record<"power" | "route" | "drive", PlayerId>> };
  nightRule: NightRuleId;
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
  "secrets" | "seed" | "rng" | "rngCalls" | "eventDeck" | "players" | "pending" | "rollContext" | "pendingEffect" | "delayed" | "bonds" | "jobs" | "triggerQueue" | "roundRecord"
> & {
  viewerId: PlayerId;
  mySecrets: ViewerSecrets | null;
  players: Record<PlayerId, PublicPlayerState>;
  pending: PublicWindow[];
  /** Effects about to land, as far as the viewer may know. */
  incoming: { label: string; targetId: PlayerId; sourceId: PlayerId | "SYSTEM" } | null;
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
