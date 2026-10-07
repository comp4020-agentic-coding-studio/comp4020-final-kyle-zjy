// Scenario 01 — "00:17 — The Last Train That Doesn't Exist". Static content:
// carriages, items, night rules, obsessions and player-count tuning. Shared by
// the server (rules) and the client (names, descriptions, art cues).
import type { Effect } from "../effects.ts";
import type { CarriageIdentity, FailReason, FragmentType, GameConfig, ItemId, NightRuleId, ObsessionId, Outcome } from "../state.ts";

export const SCENARIO = {
  id: "S01_LAST_TRAIN",
  number: "01",
  title: "00:17 — The Last Train That Doesn't Exist",
  tagline: "All passengers without names, prepare for ticket inspection.",
  rounds: 12,
  collapseMax: 12,
} as const;

export const START_FATE = 2;
export const START_SANITY = 3;
export const MAX_SANITY = 3;
export const AP_PER_ROUND = 2;
export const AP_WHEN_LOST = 1;
export const MAX_HELP_BONUS = 2;
export const MAX_FATE_PER_ROLL = 2;
export const TRUE_ENDING_CORE_MEMORIES = 6;

/** Middle carriages are shuffled per run (and again at the Reality Fold). */
export const MIDDLE: CarriageIdentity[] = ["DINING", "LUGGAGE", "MIRROR", "ARCHIVE", "SLEEPER", "ENGINE_ROOM"];

export type CarriageInfo = {
  name: string;
  theme: string;
  blurb: string;
  /** The memory fragment an investigation here can uncover. */
  fragment: FragmentType | null;
  investigateHint: string;
  searchHint: string;
  accent: string;
};

export const CARRIAGES: Record<CarriageIdentity, CarriageInfo> = {
  START: {
    name: "Boarding Car",
    theme: "Safe zone",
    blurb: "The doors you came through. The first time you come back here, you recover 1 Sanity.",
    fragment: null,
    investigateHint: "Read the timetable for a small clue (+1 Fate on a success).",
    searchHint: "Check the seats for anything left behind.",
    accent: "#5ce1e6",
  },
  DINING: {
    name: "Dining Car",
    theme: "The last supper",
    blurb: "Plates still warm for passengers who never sat down. Food restores you, if you trust it.",
    fragment: "TICKET",
    investigateHint: "A receipt for a meal nobody ordered: the TICKET fragment.",
    searchHint: "Eat something: recover Sanity or gain Fate. A bad dish costs Sanity.",
    accent: "#e8c97f",
  },
  LUGGAGE: {
    name: "Luggage Car",
    theme: "Unclaimed",
    blurb: "Racks of bags with no names. Some of them are still warm.",
    fragment: "WITNESS",
    investigateHint: "A letter from a witness who missed this train: the WITNESS fragment.",
    searchHint: "Search the bags for an item.",
    accent: "#c9a55a",
  },
  MIRROR: {
    name: "Mirror Car",
    theme: "One too many",
    blurb: "Every window is a mirror. Count the reflections. Count them again.",
    fragment: "DRIVER",
    investigateHint: "The reflection in the driver's seat: the DRIVER fragment. A disaster wakes a shadow passenger.",
    searchHint: "Feel along the glass for something on the other side.",
    accent: "#9c86ff",
  },
  ARCHIVE: {
    name: "Archive Car",
    theme: "The passenger list",
    blurb: "Filing cabinets of tickets for journeys that never happened.",
    fragment: "MANIFEST",
    investigateHint: "The passenger manifest, with one name too many: the MANIFEST fragment.",
    searchHint: "Leaf through the files for anything useful.",
    accent: "#a3a9c7",
  },
  SLEEPER: {
    name: "Sleeper Car",
    theme: "Don't fall asleep",
    blurb: "Curtained berths. Someone is dreaming the route out loud.",
    fragment: "ROUTE",
    investigateHint: "The route, mumbled in someone's sleep: the ROUTE fragment. You may also take a dream card.",
    searchHint: "Check the berths, quietly.",
    accent: "#7fa8e8",
  },
  ENGINE_ROOM: {
    name: "Engine Room",
    theme: "The train's heart",
    blurb: "Something enormous is beating behind the bulkhead. It keeps time with the passenger count.",
    fragment: "SIGNAL",
    investigateHint: "The signal the train is following: the SIGNAL fragment.",
    searchHint: "Scavenge spare parts.",
    accent: "#e2563f",
  },
  CAB: {
    name: "Driver's Cab",
    theme: "Locked until round 8",
    blurb: "The door has no handle on this side. Behind it, the controls are waiting for a driver.",
    fragment: null,
    investigateHint: "Study the controls.",
    searchHint: "Search the cab.",
    accent: "#ffbf3f",
  },
};

export const FRAGMENTS: Record<FragmentType, { name: string; text: string }> = {
  ROUTE: { name: "Route", text: "A route that bends back on itself, through a station that was never built." },
  DRIVER: { name: "Driver", text: "The driver has your face. Everyone's face." },
  MANIFEST: { name: "Passenger List", text: "The list has one more name than there are passengers. The name is blank." },
  WITNESS: { name: "Witness", text: "A letter: 'I missed the last train that night. I've wondered ever since.'" },
  TICKET: { name: "Ticket", text: "A receipt stamped 00:17, for a journey nobody took." },
  SIGNAL: { name: "Signal", text: "The train isn't following tracks. It's following a decision." },
};

export type ItemInfo = { name: string; text: string; effects: Effect[]; needsTarget?: "SAME_CARRIAGE_OR_SELF" };

export const ITEMS: Record<ItemId, ItemInfo> = {
  OLD_KEY: { name: "Old Key", text: "+2 to your next Repair roll.", effects: [{ kind: "ADD_STATUS", who: "SELF", status: "REPAIR_BONUS", rounds: 99, value: 2, polarity: "POSITIVE" }] },
  FLASHLIGHT: { name: "Flashlight", text: "+2 to your next Investigate roll.", effects: [{ kind: "ADD_STATUS", who: "SELF", status: "INVESTIGATE_BONUS", rounds: 99, value: 2, polarity: "POSITIVE" }] },
  MEDKIT: { name: "Medkit", text: "Restore 1 Sanity to yourself or someone in your carriage.", effects: [{ kind: "GAIN_SANITY", who: "TARGET", amount: 1 }], needsTarget: "SAME_CARRIAGE_OR_SELF" },
  SPARE_BATTERY: { name: "Spare Battery", text: "+1 action point this turn.", effects: [{ kind: "GAIN_AP", who: "SELF", amount: 1 }] },
  PASSENGER_PASS: { name: "Passenger Pass", text: "Your next ticket check passes automatically.", effects: [{ kind: "ADD_STATUS", who: "SELF", status: "PASS", rounds: 99, polarity: "POSITIVE" }] },
  RED_UMBRELLA: { name: "Red Umbrella", text: "Gain a shield that blocks the next negative effect on you.", effects: [{ kind: "SHIELD", who: "SELF", charges: 1 }] },
  BLANK_TICKET: { name: "Blank Ticket", text: "Your next roll is made twice; the better result counts.", effects: [{ kind: "ADD_STATUS", who: "SELF", status: "ADVANTAGE", rounds: 99, polarity: "POSITIVE" }] },
  POCKET_WATCH: { name: "Pocket Watch", text: "Wind time back: Collapse −1.", effects: [{ kind: "CHANGE_COLLAPSE", delta: -1 }] },
  BLACK_COIN: { name: "Black Coin", text: "Gain 2 Fate, lose 1 Sanity.", effects: [{ kind: "GAIN_FATE", who: "SELF", amount: 2 }, { kind: "LOSE_SANITY", who: "SELF", amount: 1 }] },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export const NIGHT_RULES: Record<NightRuleId, { name: string; text: string }> = {
  MERCURY_RETROGRADE: { name: "Mercury Retrograde", text: "The first reroll each player makes has a 1 in 3 chance of costing 1 Sanity." },
  FULL_MOON: { name: "Full Moon", text: "Every Perfect result also grants +1 Fate." },
  VOID_HOUR: { name: "Void Hour", text: "Character abilities are locked during round 1." },
  TWIN_NIGHT: { name: "Twin Night", text: "The first ability used tonight echoes: a random other player gains 1 Fate." },
  RED_EYE: { name: "Red-Eye Train", text: "The Inspector takes an extra step each round, but banishing it rewards everyone with 1 Fate." },
  DISPLACED_TIME: { name: "Displaced Time", text: "From round 4, two random players swap places in the turn order each round." },
  LUCKY_NIGHT: { name: "Lucky Night", text: "Everyone starts with 1 extra Fate." },
  NAMELESS_NIGHT: { name: "Nameless Night", text: "Hidden things are stronger: every dream card and secret message also grants 1 Fate." },
};

export const NIGHT_RULE_IDS = Object.keys(NIGHT_RULES) as NightRuleId[];

export const OBSESSIONS: Record<ObsessionId, { name: string; text: string }> = {
  NO_DEBTS: { name: "No Debts", text: "Accept help at most 2 times this run." },
  WAY_HOME: { name: "The Way Home", text: "Enter at least 5 different carriages." },
  I_KNOW_THEM: { name: "I Know Them", text: "Help your seat neighbour at least 2 times." },
  COLLECTOR: { name: "Collector", text: "End the run holding at least 3 items." },
  DOUBT_EVERYTHING: { name: "Doubt Everything", text: "Investigate hidden information at least 2 times (Mirror, Sleeper or Archive)." },
  LUCKY: { name: "Lucky", text: "Roll a Perfect result at least once." },
  LIFESAVER: { name: "Lifesaver", text: "Take a negative effect in someone else's place at least once." },
  GAMBLER: { name: "Gambler", text: "Spend at least 3 Fate changing your dice." },
  LONE_WOLF: { name: "Lone Wolf", text: "Complete a key task (anchor repair or escape lock) without help." },
  LAST_TRAIN: { name: "The Last Train", text: "Take part in the escape protocol in round 10 or later." },
};

export const OBSESSION_IDS = Object.keys(OBSESSIONS) as ObsessionId[];

/** Player-count tuning (docs/game-state.md §11). */
export function tuningFor(playerCount: number): GameConfig {
  const tier = playerCount <= 3 ? "SMALL" : playerCount <= 6 ? "STANDARD" : "LARGE";
  return {
    playerCount,
    tier,
    // more hands repair faster: the anchors ask for more of them
    anchorRequired: playerCount <= 3 ? 1 : playerCount <= 5 ? 2 : playerCount <= 7 ? 3 : 4,
    inspectorTargets: tier === "LARGE" ? 2 : 1,
    inspectorStepsAct3: tier === "SMALL" ? 1 : 2,
    startCollapse: playerCount <= 5 ? 0 : playerCount <= 7 ? 1 : 2,
    bonusAp: playerCount <= 2 ? 1 : 0,
    act3BonusAp: playerCount <= 2 ? 1 : 0,
    echoes: tier === "SMALL" ? 1 : tier === "STANDARD" ? 2 : 3,
    awayTurnSeconds: 15,
  };
}

/** How each ending reads, on the ending screen and in the log. */
export type EndingText = { kicker: string; title: string; lines: string[]; won: boolean };

export function endingText(outcome: Outcome, reason: FailReason | null): EndingText {
  switch (outcome) {
    case "NORMAL":
      return { won: true, kicker: "Escaped · Normal ending", title: "Route confirmed.", lines: ["Three terminals light up at once.", "The doors open on a platform you recognise.", "Outside, the city comes back."] };
    case "TRUE_DELETE":
      return { won: true, kicker: "Escaped · True ending", title: "You arrive lighter.", lines: ["Three terminals light up.", "The blank name on the manifest fades away,", "and so does the weight you didn't know you carried."] };
    case "TRUE_TICKET":
      return { won: true, kicker: "Escaped · True ending", title: "One more passenger.", lines: ["Three terminals light up.", "Someone punches one more ticket.", "The passenger without a name takes the seat beside you."] };
    case "FAILED":
      if (reason === "COLLAPSE") return { won: false, kicker: "Lost · The train collapsed", title: "Passenger count: zero.", lines: ["The carriages fold into each other.", "The lights go out one by one.", "N13 keeps running, empty."] };
      if (reason === "ALL_LOST") return { won: false, kicker: "Lost · Nobody is left", title: "No one remembers their name.", lines: ["Every seat is taken.", "Nobody in them can say who they are.", "The train keeps every one of you."] };
      return { won: false, kicker: "Lost · Out of time", title: "The doors never open.", lines: ["Round 12 ends.", "The terminals stay dark.", "N13 runs on, one passenger heavier."] };
  }
}
