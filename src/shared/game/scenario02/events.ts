// Scenario 02's public events, drawn one a round like scenario 01's. Most
// change the city itself (a road, the water, a cache, a person to save)
// through CITY_EVENT; the strange ones (things in the water, the names on
// the radio) cost Sanity or offer a risky choice.
import type { Effect } from "../effects.ts";
import type { EventCard } from "../scenario01/events.ts";

const city = (what: Extract<Effect, { kind: "CITY_EVENT" }>["what"]): Effect[] => [{ kind: "CITY_EVENT", what }];

export const EVENTS02: EventCard[] = [
  { id: "S2_AFTERSHOCK", title: "Aftershock", text: "The ground shrugs. Somewhere a road folds in on itself.", kind: "INSTANT", bias: "CRISIS", acts: [1, 2, 3], art: "quake", effects: city("AFTERSHOCK") },
  { id: "S2_STORM", title: "Storm Front", text: "Rain like thrown gravel. The water climbs faster tonight, and anyone standing in it feels it.", kind: "INSTANT", bias: "CRISIS", acts: [1, 2, 3], art: "storm", effects: city("STORM") },
  { id: "S2_BROADCAST", title: "Emergency Broadcast", text: "Every radio in the city wakes up and names the next street to go.", kind: "INSTANT", bias: "MIXED", acts: [1, 2, 3], art: "radio", effects: city("BROADCAST") },
  { id: "S2_DISTRESS", title: "Distress Signal", text: "A torch blinks from a window: three short, three long, three short.", kind: "INSTANT", bias: "REWARD", acts: [1, 2], art: "siren", effects: city("DISTRESS") },
  {
    id: "S2_FIGURE",
    title: "A Figure Under the Water",
    text: "It keeps pace with you under the surface. It is wearing one of your faces.",
    kind: "GROUP_ROLL",
    bias: "CRISIS",
    acts: [1, 2, 3],
    art: "figure",
    onTier: { DISASTER: [{ kind: "LOSE_SANITY", who: "SELF", amount: 1 }], PERFECT: [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }] },
  },
  { id: "S2_LOW_TIDE", title: "Low Tide", text: "For one round the sea draws back, and a drowned street steps out of the water.", kind: "INSTANT", bias: "REWARD", acts: [2, 3], art: "tide", effects: city("LOW_TIDE") },
  { id: "S2_SALVAGE", title: "Supplies Wash Up", text: "A shipping crate splits open against a wall. Someone should get there first.", kind: "INSTANT", bias: "REWARD", acts: [1, 2, 3], art: "crate", effects: city("SALVAGE") },
  { id: "S2_BREACH", title: "The Flood Wall Breaks", text: "A sound like a door slamming the size of a street. The sea comes in.", kind: "INSTANT", bias: "CRISIS", acts: [2, 3], art: "wall", effects: city("BREACH") },
  {
    id: "S2_SCHOOL_LIGHTS",
    title: "The School's Lights Are On",
    text: "The school went under two days ago. Its windows are lit, and someone is writing on the board.",
    kind: "EACH_CHOOSE",
    bias: "MIXED",
    acts: [1, 2, 3],
    art: "school",
    options: [
      { id: "LOOK", label: "Look closer", detail: "Gain 1 Fate, lose 1 Sanity.", effects: [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }, { kind: "LOSE_SANITY", who: "SELF", amount: 1 }] },
      { id: "AWAY", label: "Look away", detail: "Nothing happens.", effects: [] },
    ],
  },
  { id: "S2_NAMES", title: "Your Name on the Radio", text: "The broadcast reads out a list of the drowned. One of the names is yours, and you are still here.", kind: "INSTANT", bias: "MIXED", acts: [2, 3], art: "radio", effects: city("NAME") },
  { id: "S2_STILL_WATER", title: "Still Water", text: "The water stops. It just stops, for a while, as if it is listening.", kind: "INSTANT", bias: "REWARD", acts: [1, 2], art: "tide", effects: city("HOLD") },
  {
    id: "S2_VOICE",
    title: "A Voice You Know",
    text: "From the flooded stairwell, someone who should be far away calls your name.",
    kind: "EACH_CHOOSE",
    bias: "CRISIS",
    acts: [2, 3],
    art: "figure",
    options: [
      { id: "FOLLOW", label: "Follow the voice", detail: "Find an item, lose 1 Sanity.", effects: [{ kind: "GRANT_ITEM", who: "SELF", pool: "ANY", count: 1 }, { kind: "LOSE_SANITY", who: "SELF", amount: 1 }] },
      { id: "STAY", label: "Stay where you are", detail: "Nothing happens.", effects: [] },
    ],
  },
];

export const EVENT_IDS02 = EVENTS02.map((e) => e.id);
