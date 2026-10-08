// Effect primitives: the vocabulary every skill, item, event and night rule is
// written in. The Skill Resolver (PHASE 8) interprets these; balancing a skill
// means editing numbers here, not code paths.
import type { RollTier } from "../characters/types.ts";

/** Which participant of the current resolution an effect applies to. */
export type EffectSubject =
  | "SELF"
  | "TARGET"
  | "TARGETS"
  | "SECOND_TARGET"
  | "TRIGGER_SOURCE"
  | "TRIGGER_SUBJECT"
  | "ALL"
  | "OTHERS"
  | "RANDOM_PLAYER"
  | "LOWEST_FATE"
  | "HIGHEST_FATE"
  /** The two players with the least Fate. */
  | "TWO_LOWEST_FATE"
  /** The last player to succeed on a roll this round. */
  | "LAST_SUCCESS";

export type StatusPolarity = "POSITIVE" | "NEGATIVE";

export type RollKind = "ORDINARY" | "RISK" | "SMALL" | "CONTEST";

export const EFFECT_KINDS = [
  "CITY_EVENT",
  "GAIN_FATE",
  "LOSE_FATE",
  "TRANSFER_FATE",
  "BALANCE_FATE",
  "LOCK_FATE",
  "GAIN_SANITY",
  "LOSE_SANITY",
  "REROLL",
  "MODIFY_RESULT",
  "SET_TIER",
  "STORE_RESULT",
  "PREVIEW_ROLL",
  "SHIELD",
  "IMMUNITY",
  "FORBID_TARGETING",
  "CANCEL_EFFECT",
  "REDUCE_EFFECT",
  "NEGATE_PENALTY",
  "REDIRECT",
  "DICTATE_TARGET",
  "COPY_EFFECT",
  "SWAP_STATE",
  "ROLLBACK_STATE",
  "MOVE_PLAYER",
  "PREVIEW_EVENT",
  "REROLL_EVENT",
  "MODIFY_EVENT",
  "SKIP_EVENT",
  "RANDOM_EVENT",
  "CHANGE_TURN_ORDER",
  "GRANT_ITEM",
  "STEAL_ITEM",
  "REMOVE_STATUS",
  "ADD_STATUS",
  "EXTEND_STATUS",
  "CONVERT_STATUS",
  "DOUBLE_REWARD",
  "BONUS_ON_NEXT_REWARD",
  "SETTLE_DELAYED",
  "DELAY_EFFECT",
  "RESTORE_SKILL",
  "SHUFFLE_SKILLS",
  "BOND",
  "VOTE",
  "CHALLENGE",
  "FORCE_ROLL",
  "GROUP_ROLL",
  "CHOOSE_ONE",
  "WAGER",
  "SET_TASK",
  "MODIFY_RULE",
  "COUNTER",
  "REVEAL_HIDDEN",
  "GAIN_AP",
  "CHANGE_COLLAPSE",
  "GRANT_FRAGMENT",
  "GRANT_CORE_MEMORY",
  "SPAWN_ENTITY",
  "INSPECTOR_STEP",
  "REPAIR_ANCHOR",
  "CONDITIONAL",
  "REVISE_CHOICE",
] as const;

export type EffectKind = (typeof EFFECT_KINDS)[number];

export type Effect =
  | { kind: "GAIN_FATE"; who: EffectSubject; amount: number }
  | { kind: "LOSE_FATE"; who: EffectSubject; amount: number }
  | { kind: "TRANSFER_FATE"; from: EffectSubject; to: EffectSubject; amount: number }
  | { kind: "BALANCE_FATE"; between: [EffectSubject, EffectSubject]; maxStep: number }
  /** Fate can't go down for the duration. */
  | { kind: "LOCK_FATE"; who: EffectSubject; rounds: number }
  | { kind: "GAIN_SANITY"; who: EffectSubject; amount: number }
  | { kind: "LOSE_SANITY"; who: EffectSubject; amount: number }
  | { kind: "REROLL"; who: EffectSubject; keep: "SECOND" | "BEST" | "CHOOSE" | "AVERAGE"; scope?: "ONE" | "ALL" }
  | { kind: "MODIFY_RESULT"; who: EffectSubject; tiers?: number; pips?: number; toward?: "BETTER" | "MIDDLE" }
  | { kind: "SET_TIER"; who: EffectSubject; from: RollTier[]; to: RollTier }
  /** Keep a roll result to substitute for a later ordinary roll. */
  | { kind: "STORE_RESULT"; who: EffectSubject; which: "NEXT_SUCCESS" | "FIRST_SUCCESS" | "CURRENT" }
  | { kind: "PREVIEW_ROLL"; who: EffectSubject; which: "NEXT_ROUND_FIRST" }
  | { kind: "SHIELD"; who: EffectSubject; charges: number; fromRound?: "NOW" | "NEXT" }
  | {
      kind: "IMMUNITY";
      who: EffectSubject;
      scope: "NEGATIVE" | "PLAYER_TARGETING" | "PLAYER_INTERACTION" | "GROUP_NEGATIVE" | "DIRECT_ABILITY";
      rounds: number;
      charges?: number;
    }
  /** `who` may not target `protects` with their next active ability. */
  | { kind: "FORBID_TARGETING"; who: EffectSubject; protects: EffectSubject; uses: number }
  | {
      kind: "CANCEL_EFFECT";
      which: "INCOMING" | "LAST_SPECIAL_RULE" | "PENDING_TRANSFER" | "FATE_THEFT" | "CONFLICTING_ABILITIES" | "GLOBAL_EFFECT" | "OPPOSITION_STATE";
    }
  | { kind: "REDUCE_EFFECT"; levels: number }
  /** Waive the failure penalty of the current event or roll. */
  | { kind: "NEGATE_PENALTY"; who: EffectSubject; also?: "EXIT_EVENT" | "KEEP_RESOURCES" }
  | { kind: "REDIRECT"; to: "RANDOM_LEGAL" | "SELF" | "SOURCE" | "CHOSEN" }
  /** The subject's next targeted ordinary action has its target picked by SELF. */
  | { kind: "DICTATE_TARGET"; who: EffectSubject; action: "NEXT_TARGETED_ACTION" | "RETARGET_NOW" }
  | {
      kind: "COPY_EFFECT";
      source: "LAST_SKILL" | "TARGET_BUFF" | "TARGET_ZODIAC_BUFF" | "TARGET_REWARD" | "RANDOM_ROSTER" | "RANDOM_OTHER_ZODIAC" | "INCOMING";
      to?: EffectSubject;
      weaken?: boolean;
      rounds?: number;
    }
  | {
      kind: "SWAP_STATE";
      between: [EffectSubject, EffectSubject];
      what: "TEMP_STATUS" | "HIDDEN_STATUS" | "BOND" | "ROLL_RESULT" | "STATUS_FOR_STATUS";
    }
  | { kind: "ROLLBACK_STATE"; who: EffectSubject; to: "LAST_ROUND_END" }
  | { kind: "MOVE_PLAYER"; who: EffectSubject; to: "ADJACENT" | "RANDOM" | "TOWARD_SELF" }
  | { kind: "PREVIEW_EVENT"; count: number; detail: "TYPE" | "FULL" | "BIAS"; filter?: "NEXT_PUBLIC" | "NEXT_PENALTY" | "HIDDEN" | "TARGETING_SELF"; reorder?: boolean }
  | { kind: "REROLL_EVENT"; mode?: "SAME_CATEGORY" | "OTHER_CATEGORY" | "CONSENSUS" }
  | {
      kind: "MODIFY_EVENT";
      /** NEXT_DECIDER: you decide the next choice event; DECIDER_SELF: you decide the one being revealed. */
      change: "NEXT_DECIDER" | "DECIDER_SELF" | "REMOVE_CONDITION" | "RANDOM_ASPECT" | "BIAS_CHOSEN";
    }
  | { kind: "SKIP_EVENT"; who: EffectSubject; hideUntil?: "NEXT_ROUND"; reroute?: boolean }
  | {
      kind: "RANDOM_EVENT";
      size: "SMALL" | "STANDARD" | "MULTI" | "MINIGAME" | "REWARD";
      choices?: number;
      participants?: EffectSubject;
      pick?: "CHOOSE" | "HIGHER_REWARD";
      split?: "TWO_GROUPS";
    }
  /** NEXT_ROUND: the chosen targets act first next round, in the order chosen. REMAINING_THIS_ROUND: those still to act go least-Fate first. */
  | { kind: "CHANGE_TURN_ORDER"; scope: "NEXT_ROUND" | "REMAINING_THIS_ROUND" | "FRONT_NOW" }
  | { kind: "GRANT_ITEM"; who: EffectSubject; pool: "ANY" | "CONSUMABLE" | "BUFF"; count: number }
  | { kind: "STEAL_ITEM"; from: EffectSubject; transferableOnly: true }
  | { kind: "REMOVE_STATUS"; who: EffectSubject; polarity: StatusPolarity | "ANY"; count: number | "ALL"; ordinaryOnly?: boolean }
  | { kind: "ADD_STATUS"; who: EffectSubject; status: string; rounds: number; hidden?: boolean; random?: boolean; value?: number; polarity?: StatusPolarity }
  | { kind: "EXTEND_STATUS"; who: EffectSubject; polarity: StatusPolarity; rounds: number }
  /** A status ending turns into a resource instead. */
  | { kind: "CONVERT_STATUS"; who: EffectSubject; into: "FATE"; amount: number }
  | { kind: "DOUBLE_REWARD"; who: EffectSubject; next: "REWARD" | "SUCCESS_REWARD" | "CURRENT"; penaltyToo?: boolean }
  | { kind: "BONUS_ON_NEXT_REWARD"; who: EffectSubject; amount: number; scope?: "NEXT" | "FIRST_THIS_ROUND" }
  | { kind: "SETTLE_DELAYED"; who: EffectSubject }
  | { kind: "DELAY_EFFECT"; rounds: number; effects: Effect[] }
  | { kind: "RESTORE_SKILL"; who: EffectSubject; cost?: { fate: number }; onlyIfNoEffect?: boolean }
  | { kind: "SHUFFLE_SKILLS"; scope: "UNUSED_ACTIVE"; rounds: number }
  /** `pairs`: the subjects are split into pairs, each its own bond. */
  | { kind: "BOND"; between: EffectSubject[]; onGainFate?: number; onFirstSuccess?: number; onFirstReward?: number; onMutualHelp?: number; rounds: number; secret?: boolean; oneWay?: boolean; pairs?: boolean }
  | { kind: "VOTE"; question: "PICK_PLAYER" | "PICK_OUTCOME" | "CONFIRM_REROLL" | "MINORITY_REWARD"; reward?: Effect[] }
  | { kind: "CHALLENGE"; against: EffectSubject; winnerGains: number; tieGains?: number; scope?: "SELF_VS_TARGET" | "TWO_TARGETS" }
  | { kind: "FORCE_ROLL"; who: EffectSubject; roll: RollKind; onSuccess?: Effect[]; onFail?: Effect[] }
  | { kind: "GROUP_ROLL"; who: EffectSubject; mode: "SUM_THRESHOLD" | "HIGHEST_WINS" | "PICK_ONE"; reward: Effect[] }
  | { kind: "CHOOSE_ONE"; options: Effect[][]; from?: "FIXED" | "RANDOM_TWO" | "RANDOM_THREE" }
  | { kind: "WAGER"; onSuccess: Effect[]; onFail: Effect[] }
  | { kind: "SET_TASK"; who: EffectSubject; rounds: number; reward: Effect[]; secret?: boolean }
  | { kind: "MODIFY_RULE"; rule: string; delta: number; rounds: number }
  | { kind: "COUNTER"; name: string; increment: number }
  | { kind: "REVEAL_HIDDEN"; who: EffectSubject; what: "STATUS" | "EVENT_EFFECT"; mayVeto?: boolean }
  /** Change your own answer to the vote or choice being settled (I Never Said That). */
  | { kind: "REVISE_CHOICE" }
  // ---- scenario-level primitives (events, items, the train itself) ----
  | { kind: "GAIN_AP"; who: EffectSubject; amount: number }
  | { kind: "CHANGE_COLLAPSE"; delta: number }
  | { kind: "GRANT_FRAGMENT"; fragment: "RANDOM_MISSING" | "WITNESS" | "TICKET" | "SIGNAL" | "ROUTE" | "DRIVER" | "MANIFEST" }
  | { kind: "GRANT_CORE_MEMORY"; amount: number }
  | { kind: "SPAWN_ENTITY"; entity: "SHADOW" | "ECHO"; where: "SUBJECT_CARRIAGE" | "RANDOM" }
  | { kind: "INSPECTOR_STEP"; steps: number }
  | { kind: "REPAIR_ANCHOR"; which: "WEAKEST"; amount: number }
  /** Apply `then` only when the named condition holds at resolution time. */
  | { kind: "CONDITIONAL"; condition: string; then: Effect[]; otherwise?: Effect[] }
  /** Scenario 02: an event that changes the city itself (scenario02/events.ts). */
  | { kind: "CITY_EVENT"; what: "AFTERSHOCK" | "STORM" | "BROADCAST" | "DISTRESS" | "LOW_TIDE" | "SALVAGE" | "BREACH" | "NAME" | "HOLD" };

// Compile-time guard: EFFECT_KINDS and the Effect union list the same kinds.
type _Missing = Exclude<Effect["kind"], EffectKind> | Exclude<EffectKind, Effect["kind"]>;
const _effectKindsComplete: [_Missing] extends [never] ? true : _Missing = true;
void _effectKindsComplete;
