// What makes one scenario different from another, as hooks the shared engine
// calls. The engine (flow, actions, endings) is the same for every scenario;
// each scenario registers its rules here (src/server/engine/scenarioNN/rules.ts).
import type { GameActionType } from "../../shared/game/actions.ts";
import type { GameState, ItemId, Job, PlayerGameState, PlayerResult, RoundStep, ScenarioId } from "../../shared/game/state.ts";
import type { Seat } from "./create.ts";
import type { Ctx } from "./context.ts";
import type { Spec } from "./actions.ts";
import type { Msg } from "../../shared/i18n/types.ts";

export type ActionSet = {
  specs: Partial<Record<GameActionType, Spec<never>>>;
  /** The buttons on the dock, in order. */
  turnActions: GameActionType[];
  apCost: Partial<Record<GameActionType, number>>;
  /** Optional per-player action cost; scenarios without it keep apCost unchanged. */
  costFor?(s: GameState, p: PlayerGameState, type: GameActionType): number | undefined;
};

export type ScenarioRules = {
  id: ScenarioId;
  create(sessionId: string, seats: Seat[], seed: string, now: number): GameState;
  actions: ActionSet;
  /** What abilities and rewards draw ordinary items from. */
  itemPools: { any: ItemId[]; buff: ItemId[] };

  // ---- each round (flow.ts) ----
  /** Right after the round counter moves on. */
  roundOpens?(ctx: Ctx): void;
  roundHeader(s: GameState): Msg;
  /** Action points for the round, before statuses. */
  apFor(s: GameState, p: PlayerGameState): number;
  /** Per player, after AP and prepared shields. */
  playerRoundStart?(ctx: Ctx, p: PlayerGameState): void;
  /** Whether this player still takes turns (scenario 02: not once aboard the boat). Everyone does if absent. */
  takesTurn?(s: GameState, p: PlayerGameState): boolean;
  /** How a timed-out or host-skipped turn resolves in a different turn model. */
  skipTurn?(ctx: Ctx, p: PlayerGameState): void;
  /** After every player's round start: scripted beats. */
  onRoundStart(ctx: Ctx): void;
  /** The step after the last turn. */
  afterTurns(s: GameState): RoundStep;
  /** The world's own move between turns and the event (INSPECTOR / WORLD step). */
  worldStep(ctx: Ctx): void;
  /** This round's event, once. */
  roundEvent(ctx: Ctx): void;
  /** Before round-end triggers. */
  roundCloses?(ctx: Ctx): void;
  /** The world gets worse (Collapse) at round end. */
  roundCollapse(ctx: Ctx): void;
  /** After cleanup and the end check: limits and act changes. Returns true if the run ended. */
  afterRound(ctx: Ctx): boolean;

  /** Collapse has just moved (from `from` to `s.collapse`), by any cause. */
  collapseChanged?(ctx: Ctx, from: number): void;

  /** Moves someone for an ability (MOVE_PLAYER) when the scenario isn't a train; logs it. */
  movePlayer?(ctx: Ctx, playerId: string, to: "ADJACENT" | "RANDOM" | "TOWARD_SELF", ownerId: string | null, label: Msg): void;

  /** Each player's result, when the run ends (scenario 01's own if absent). */
  results?(ctx: Ctx): PlayerResult[];
  /** The ending's line in the log (scenario 01's ending text if absent). */
  announceEnding?(ctx: Ctx): void;

  /** Has the run just been won or lost? Starts the ending if so. */
  checkEnd(ctx: Ctx): boolean;
  runJob(ctx: Ctx, job: Job): void;
};

const RULES = new Map<ScenarioId, ScenarioRules>();

export const registerScenario = (rules: ScenarioRules) => RULES.set(rules.id, rules);

export function rulesFor(s: GameState | ScenarioId): ScenarioRules {
  const id = typeof s === "string" ? s : s.scenarioId;
  const r = RULES.get(id);
  if (!r) throw new Error(`no rules registered for ${id}`);
  return r;
}
