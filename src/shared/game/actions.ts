import type { Msg } from "../i18n/types.ts";
import type { PartId } from "./scenario02/items.ts";
import type { CausalNodeId03 } from "./scenario03/nodes.ts";
import type { EndingRoute03 } from "./scenario03/story.ts";
import type { NpcId03 } from "./scenario03/story.ts";
// Intents a client may send. Nothing here carries a value the server should
// decide (dice, fate totals, phase): the server validates every action against
// the live state, then reduces it (docs/architecture.md §4).
import type { MBTI, Zodiac } from "../characters/types.ts";
import type { ItemId, PlayerId, ScenarioId } from "./state.ts";
import type { LotId04 } from "./scenario04/types.ts";

export type LobbyAction =
  | { type: "SET_NICKNAME"; nickname: string }
  | { type: "PICK_ZODIAC"; zodiac: Zodiac }
  | { type: "PICK_MBTI"; mbti: MBTI }
  | { type: "SET_READY"; ready: boolean }
  | { type: "KICK"; playerId: PlayerId }
  | { type: "SELECT_SCENARIO"; scenarioId: ScenarioId }
  | { type: "START_GAME" }
  | { type: "LEAVE" }
  | { type: "RESTART" }
  | { type: "BACK_TO_LOBBY" }
  /** Host only, during a run: move a stalled table along one step (nothing has a time limit). */
  | { type: "SKIP_WAITING" };

export type TradeOffer = { items: ItemId[]; fate: number; /** Scenario 02: boat parts. */ parts?: PartId[]; /** Scenario 02: evacuation passes. */ passes?: number; /** Scenario 03: numbered ordinary relics. */ instances?: string[] };

export type GameAction =
  | { type: "MOVE"; toCarriage: number }
  | { type: "TIME_JUMP" }
  | { type: "INTERVENE"; nodeId: CausalNodeId03; choiceId: string }
  | { type: "RESOLVE_HISTORY"; route: EndingRoute03 }
  | { type: "PICK_UP"; instanceId: string }
  | { type: "STORE_ITEM"; instanceId: string }
  | { type: "INVESTIGATE" }
  | { type: "SCAN"; protocol: "ARCHIVE" | "FIELD" | "STABILIZE" }
  | { type: "INTERACT_NPC"; npcId: NpcId03 }
  | { type: "SEARCH" }
  | { type: "REPAIR" }
  | { type: "HELP"; targetId: PlayerId }
  | { type: "TRADE"; targetId: PlayerId; give: TradeOffer; want: TradeOffer }
  | { type: "STABILIZE"; mode: "SANITY" | "CLEANSE"; statusId?: string }
  | { type: "CONFRONT"; target: "INSPECTOR" | "ENTITY"; entityId?: string }
  | { type: "USE_SKILL"; targets?: PlayerId[] }
  | { type: "USE_ITEM"; item: ItemId; targetId?: PlayerId }
  | { type: "END_TURN" }
  // scenario 02
  | { type: "RESCUE"; npcId?: string; targetId?: PlayerId }
  | { type: "OPERATE" }
  | { type: "SALVAGE" }
  | { type: "SHARE_INTEL"; intelId: string }
  | { type: "INSTALL"; part: PartId | "BATTERIES" }
  | { type: "REGISTER" }
  | { type: "RESTART_GENERATOR" }
  | { type: "RESPOND"; windowId: string; optionId: string }
  | { type: "ACK_SEQUENCE" }
  | { type: "BID"; amount: number }
  | { type: "PASS" }
  | { type: "READ"; targetId: PlayerId }
  | { type: "DEAL"; targetId: PlayerId; chips: number; receiveChips?: number; giveIntel?: string; giveItem?: string; forIntel?: string; forItem?: string; forPass?: boolean }
  | { type: "CHALLENGE"; targetId: PlayerId; wager: number }
  | { type: "SABOTAGE"; targetId: PlayerId }
  | { type: "BORROW" }
  | { type: "EXPOSE"; intelId: string }
  | { type: "RECOVER" }
  | { type: "USE_LOT"; lotId: LotId04; sourceLotId?: LotId04 }
  | { type: "FINAL_CONVERT"; resource: "BLACK_CHIPS" | "SANITY" | "FATE" | "AP" | "ITEM"; lotId?: LotId04 }
  | { type: "FINAL_READY" }
  | { type: "FINAL_BID"; amount: number }
  | { type: "FINAL_SHOWDOWN_PICK"; cardIndex: number }
  | { type: "FINAL_CONTINUE" };

export type GameActionType = GameAction["type"];

/** Engine-generated actions (timeouts). Never accepted from a socket. */
export type SystemAction = { type: "TICK" };

export const AP_COST: Partial<Record<GameActionType, number>> = {
  MOVE: 1,
  INVESTIGATE: 1,
  SEARCH: 1,
  REPAIR: 1,
  HELP: 1,
  TRADE: 1,
  STABILIZE: 2,
  CONFRONT: 1,
};

export type ActionAvailability = {
  type: GameActionType;
  enabled: boolean;
  apCost: number;
  /** Shown when disabled, e.g. "No action points left". */
  reason?: Msg;
  /** Legal targets: carriage indexes (MOVE), player ids (HELP/TRADE/skill), entity ids (CONFRONT). */
  targets?: (string | number)[];
  /** What a success would do here, e.g. "Find a memory fragment". */
  hint?: Msg;
};

export type RejectCode =
  | "NOT_IN_ROOM"
  | "NOT_HOST"
  | "ROOM_FULL"
  | "ROOM_NOT_FOUND"
  | "GAME_IN_PROGRESS"
  | "GAME_OVER"
  | "NICKNAME_TAKEN"
  | "NOT_ENOUGH_PLAYERS"
  | "NOT_ALL_READY"
  | "WRONG_PHASE"
  | "NOT_YOUR_TURN"
  | "NOT_YOUR_WINDOW"
  | "WINDOW_OPEN"
  | "NO_AP"
  | "NO_FATE"
  | "ILLEGAL_TARGET"
  | "SKILL_ALREADY_USED"
  | "SKILL_LOCKED"
  | "STALE_VERSION"
  | "INVALID";
