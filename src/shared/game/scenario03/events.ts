// Incident Zero's public anomalies. These are ordinary shared-engine event
// cards, leaving the scripted story beats and causal record to scenario rules.
import type { EventCard } from "../scenario01/events.ts";

export const EVENTS03: EventCard[] = [
  { id: "S3_CLOCK_ECHO", title: "Clock Echo", text: "Every clock repeats the same minute. A usable second seems to fall out of the loop.", kind: "INSTANT", bias: "REWARD", acts: [1, 2, 3, 4], art: "clock", effects: [{ kind: "GAIN_FATE", who: "RANDOM_PLAYER", amount: 1 }] },
  { id: "S3_MISSING_MINUTE", title: "Missing Minute", text: "A minute disappears from the shift register. The gap follows one of you.", kind: "INSTANT", bias: "CRISIS", acts: [1, 2, 3, 4], art: "static", effects: [{ kind: "LOSE_SANITY", who: "RANDOM_PLAYER", amount: 1 }] },
  { id: "S3_PHASE_SURGE", title: "Phase Surge", text: "The research wing's detectors briefly read both years at once.", kind: "GROUP_ROLL", bias: "MIXED", acts: [1, 2, 3, 4], art: "bolt", onTier: { DISASTER: [{ kind: "LOSE_FATE", who: "SELF", amount: 1 }], PERFECT: [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }] } },
  { id: "S3_DUPLICATE_FILE", title: "Duplicate File", text: "Two copies of one incident report arrive with different signatures.", kind: "EACH_CHOOSE", bias: "MIXED", acts: [1, 2, 3, 4], art: "draft", options: [
    { id: "KEEP", label: "Keep a copy", detail: "Gain 1 Fate and lose 1 Sanity.", effects: [{ kind: "GAIN_FATE", who: "SELF", amount: 1 }, { kind: "LOSE_SANITY", who: "SELF", amount: 1 }] },
    { id: "SEAL", label: "Seal both copies", detail: "Avoid the contradiction.", effects: [] },
  ] },
  { id: "S3_ALARM_PROTOCOL", title: "Alarm Protocol", text: "An alarm orders everyone to choose between containment and a quick reset.", kind: "VOTE", bias: "MIXED", acts: [1, 2, 3, 4], art: "siren", options: [
    { id: "CONTAIN", label: "Contain the anomaly", detail: "Everyone gains 1 Fate.", effects: [{ kind: "GAIN_FATE", who: "ALL", amount: 1 }] },
    { id: "RESET", label: "Force a reset", detail: "Reduce Collapse by 1; one random player loses 1 Sanity.", effects: [{ kind: "CHANGE_COLLAPSE", delta: -1 }, { kind: "LOSE_SANITY", who: "RANDOM_PLAYER", amount: 1 }] },
  ] },
];

export const EVENT_IDS03 = EVENTS03.map((event) => event.id);
