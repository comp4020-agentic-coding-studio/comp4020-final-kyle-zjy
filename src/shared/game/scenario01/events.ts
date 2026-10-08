// The public event deck: one card is drawn at the end of every round (rounds
// with a scripted beat skip the draw). Outcomes are Effect lists, resolved by
// the same handlers as skills and items. In per-player contexts SELF means
// "each player this applies to".
import type { RollTier } from "../../characters/types.ts";
import type { Effect } from "../effects.ts";

export type EventKind = "VOTE" | "EACH_CHOOSE" | "GROUP_ROLL" | "INSTANT";
export type EventBias = "REWARD" | "CRISIS" | "MIXED";

export type EventOption = { id: string; label: string; detail: string; effects: Effect[] };

export type EventCard = {
  id: string;
  title: string;
  text: string;
  kind: EventKind;
  bias: EventBias;
  /** Acts in which this card can be drawn. */
  acts: (1 | 2 | 3)[];
  /** Art key for the event card illustration. */
  art: "bell" | "lights" | "speaker" | "umbrella" | "static" | "suitcase" | "clock" | "seat" | "window" | "draft" | "whistle" | "music" | "moon" | "bolt" | "ticket" | "count" | "footsteps" | "brake" | "voice" | "platform"
    // scenario 02
    | "quake" | "storm" | "radio" | "siren" | "figure" | "tide" | "crate" | "wall" | "school";
  options?: EventOption[];
  /** GROUP_ROLL: every present player rolls; effects by tier apply to that player (SELF). */
  onTier?: Partial<Record<RollTier, Effect[]>>;
  /** INSTANT: applied once. */
  effects?: Effect[];
};

const lose1Sanity: Effect[] = [{ kind: "LOSE_SANITY", who: "SELF", amount: 1 }];
const gain1Fate: Effect[] = [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }];

export const EVENTS: EventCard[] = [
  {
    id: "DINNER_BELL",
    title: "The Dinner Bell",
    text: "A trolley rattles through every carriage at once, pushed by no one.",
    kind: "EACH_CHOOSE",
    bias: "REWARD",
    acts: [1, 2, 3],
    art: "bell",
    options: [
      { id: "PASTRY", label: "Take a pastry", detail: "Recover 1 Sanity.", effects: [{ kind: "GAIN_SANITY", who: "SELF", amount: 1 }] },
      { id: "COIN", label: "Take the coin under the napkin", detail: "Gain 1 Fate.", effects: gain1Fate },
    ],
  },
  {
    id: "FLICKERING_LIGHTS",
    title: "Flickering Lights",
    text: "The lights stutter. For a heartbeat there are more passengers than there should be.",
    kind: "GROUP_ROLL",
    bias: "CRISIS",
    acts: [1, 2, 3],
    art: "lights",
    onTier: { DISASTER: lose1Sanity, PERFECT: gain1Fate },
  },
  {
    id: "WRONG_PLATFORM",
    title: "Announcement: Wrong Platform",
    text: "\"This train is running on the wrong platform. Please remain calm.\"",
    kind: "VOTE",
    bias: "MIXED",
    acts: [1, 2, 3],
    art: "speaker",
    options: [
      {
        id: "CORD",
        label: "Pull the communication cord",
        detail: "Collapse +1, but everyone gains 1 Fate.",
        effects: [{ kind: "CHANGE_COLLAPSE", delta: 1 }, { kind: "GAIN_FATE", who: "ALL", amount: 1 }],
      },
      { id: "QUIET", label: "Stay quiet", detail: "A random passenger loses 1 Sanity.", effects: [{ kind: "LOSE_SANITY", who: "RANDOM_PLAYER", amount: 1 }] },
    ],
  },
  {
    id: "STRANGERS_UMBRELLA",
    title: "A Stranger's Umbrella",
    text: "A red umbrella leans against a seat, still dripping. It wasn't raining.",
    kind: "INSTANT",
    bias: "REWARD",
    acts: [1, 2, 3],
    art: "umbrella",
    effects: [{ kind: "GRANT_ITEM", who: "RANDOM_PLAYER", pool: "ANY", count: 1 }],
  },
  {
    id: "STATIC_ON_THE_LINE",
    title: "Static on the Line",
    text: "Every phone plays the same voice note: breathing, then your own name.",
    kind: "INSTANT",
    bias: "CRISIS",
    acts: [1, 2, 3],
    art: "static",
    effects: [{ kind: "ADD_STATUS", who: "RANDOM_PLAYER", status: "STATIC", rounds: 2, value: -1, polarity: "NEGATIVE" }],
  },
  {
    id: "LOST_PROPERTY",
    title: "Lost Property",
    text: "A suitcase slides down the aisle and stops at your feet. The tag has your handwriting on it.",
    kind: "EACH_CHOOSE",
    bias: "MIXED",
    acts: [1, 2, 3],
    art: "suitcase",
    options: [
      {
        id: "CLAIM",
        label: "Claim it",
        detail: "Gain a random item, but lose 1 Fate.",
        effects: [{ kind: "GRANT_ITEM", who: "SELF", pool: "ANY", count: 1 }, { kind: "LOSE_FATE", who: "SELF", amount: 1 }],
      },
      { id: "LEAVE", label: "Leave it", detail: "Nothing happens. Probably.", effects: [] },
    ],
  },
  {
    id: "NEW_TIMETABLE",
    title: "The Timetable Changes",
    text: "The departure board flips through every station you've ever missed.",
    kind: "VOTE",
    bias: "MIXED",
    acts: [1, 2, 3],
    art: "clock",
    options: [
      {
        id: "FOLLOW",
        label: "Follow the new timetable",
        detail: "Collapse −1, but everyone loses 1 Fate.",
        effects: [{ kind: "CHANGE_COLLAPSE", delta: -1 }, { kind: "LOSE_FATE", who: "ALL", amount: 1 }],
      },
      { id: "IGNORE", label: "Ignore it", detail: "Collapse +1.", effects: [{ kind: "CHANGE_COLLAPSE", delta: 1 }] },
    ],
  },
  {
    id: "SOMEONE_IN_YOUR_SEAT",
    title: "Someone Is in Your Seat",
    text: "Each of you finds a passenger in your seat, wearing your coat, looking out the window.",
    kind: "GROUP_ROLL",
    bias: "CRISIS",
    acts: [1, 2, 3],
    art: "seat",
    onTier: { DISASTER: [{ kind: "LOSE_SANITY", who: "SELF", amount: 1 }, { kind: "LOSE_FATE", who: "SELF", amount: 1 }], PERFECT: gain1Fate },
  },
  {
    id: "WINDOW_INTO_YESTERDAY",
    title: "A Window Into Yesterday",
    text: "Outside, the platform you left. You can read every sign. You remember something.",
    kind: "INSTANT",
    bias: "REWARD",
    acts: [1, 2],
    art: "window",
    effects: [{ kind: "GRANT_FRAGMENT", fragment: "RANDOM_MISSING" }],
  },
  {
    id: "TUNNEL_DRAFT",
    title: "Tunnel Draft",
    text: "A cold draft runs the length of the train. Something rides in on it.",
    kind: "INSTANT",
    bias: "CRISIS",
    acts: [2, 3],
    art: "draft",
    effects: [{ kind: "SPAWN_ENTITY", entity: "SHADOW", where: "RANDOM" }],
  },
  {
    id: "INSPECTORS_WHISTLE",
    title: "The Inspector's Whistle",
    text: "Two short blasts, close. Then a third, closer.",
    kind: "INSTANT",
    bias: "CRISIS",
    acts: [2, 3],
    art: "whistle",
    effects: [{ kind: "INSPECTOR_STEP", steps: 1 }],
  },
  {
    id: "MUSIC_FROM_THE_DINING_CAR",
    title: "Music From the Dining Car",
    text: "A slow waltz drifts down the train. The record is skipping on a word.",
    kind: "EACH_CHOOSE",
    bias: "REWARD",
    acts: [1, 2, 3],
    art: "music",
    options: [
      { id: "DANCE", label: "Dance", detail: "Gain 1 Fate.", effects: gain1Fate },
      { id: "REST", label: "Close your eyes", detail: "Recover 1 Sanity.", effects: [{ kind: "GAIN_SANITY", who: "SELF", amount: 1 }] },
    ],
  },
  {
    id: "SECOND_MOON",
    title: "A Second Moon",
    text: "There are two moons outside. One of them is following the train.",
    kind: "GROUP_ROLL",
    bias: "MIXED",
    acts: [1, 2, 3],
    art: "moon",
    onTier: { DISASTER: lose1Sanity, FAIL: [{ kind: "LOSE_FATE", who: "SELF", amount: 1 }], SUCCESS: gain1Fate, PERFECT: [{ kind: "GAIN_FATE", who: "SELF", amount: 2 }] },
  },
  {
    id: "EMERGENCY_LIGHTING",
    title: "Emergency Lighting",
    text: "The train offers a choice, in red letters on every window.",
    kind: "VOTE",
    bias: "MIXED",
    acts: [2, 3],
    art: "bolt",
    options: [
      {
        id: "DIVERT",
        label: "Divert power to the anchors",
        detail: "The least-repaired anchor gains 1 progress. Collapse +1.",
        effects: [{ kind: "REPAIR_ANCHOR", which: "WEAKEST", amount: 1 }, { kind: "CHANGE_COLLAPSE", delta: 1 }],
      },
      { id: "LIGHTS", label: "Keep the lights on", detail: "Everyone recovers 1 Sanity.", effects: [{ kind: "GAIN_SANITY", who: "ALL", amount: 1 }] },
    ],
  },
  {
    id: "TICKET_STUBS",
    title: "Ticket Stubs Rain Down",
    text: "Old tickets fall from the luggage racks like snow. Some of them are still valid.",
    kind: "INSTANT",
    bias: "REWARD",
    acts: [1, 2, 3],
    art: "ticket",
    effects: [{ kind: "GAIN_FATE", who: "ALL", amount: 1 }],
  },
  {
    id: "THE_COUNT_IS_WRONG",
    title: "The Count Is Wrong",
    text: "\"Passenger count confirmed.\" A pause. \"Passenger count is being reconfirmed.\"",
    kind: "GROUP_ROLL",
    bias: "CRISIS",
    acts: [2, 3],
    art: "count",
    onTier: { DISASTER: lose1Sanity, FAIL: [{ kind: "LOSE_FATE", who: "SELF", amount: 1 }] },
  },
  {
    id: "ECHOING_FOOTSTEPS",
    title: "Echoing Footsteps",
    text: "Someone is walking the train behind you, matching your steps exactly.",
    kind: "INSTANT",
    bias: "CRISIS",
    acts: [3],
    art: "footsteps",
    effects: [{ kind: "SPAWN_ENTITY", entity: "ECHO", where: "RANDOM" }],
  },
  {
    id: "HARD_BRAKING",
    title: "The Train Brakes Hard",
    text: "Everyone is thrown off their feet. When you stand up, you're not where you were.",
    kind: "GROUP_ROLL",
    bias: "CRISIS",
    acts: [1, 2, 3],
    art: "brake",
    onTier: { DISASTER: [{ kind: "MOVE_PLAYER", who: "SELF", to: "ADJACENT" }, { kind: "LOSE_SANITY", who: "SELF", amount: 1 }], FAIL: [{ kind: "MOVE_PLAYER", who: "SELF", to: "ADJACENT" }] },
  },
  {
    id: "KIND_VOICE",
    title: "A Kind Voice",
    text: "The announcer sounds like someone you used to know. \"Nearly there. Hold on.\"",
    kind: "INSTANT",
    bias: "REWARD",
    acts: [1, 2, 3],
    art: "voice",
    effects: [{ kind: "GAIN_SANITY", who: "RANDOM_PLAYER", amount: 1 }, { kind: "GAIN_FATE", who: "RANDOM_PLAYER", amount: 1 }],
  },
  {
    id: "MISSED_CONNECTION",
    title: "Missed Connection",
    text: "Through the window, a platform slides by with someone waving at you. You could still reach them.",
    kind: "EACH_CHOOSE",
    bias: "MIXED",
    acts: [1, 2, 3],
    art: "platform",
    options: [
      {
        id: "REACH",
        label: "Reach for the platform",
        detail: "Gain 2 Fate, lose 1 Sanity.",
        effects: [{ kind: "GAIN_FATE", who: "SELF", amount: 2 }, { kind: "LOSE_SANITY", who: "SELF", amount: 1 }],
      },
      { id: "LET_GO", label: "Let it go", detail: "Nothing happens.", effects: [] },
    ],
  },
];

export const EVENT_IDS = EVENTS.map((e) => e.id);
export const EVENT_BY_ID = new Map(EVENTS.map((e) => [e.id, e]));
