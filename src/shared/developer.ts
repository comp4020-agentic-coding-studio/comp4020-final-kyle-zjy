// Closed server-owned checkpoint identifiers; clients never submit state patches.
import type { ScenarioId } from "./game/state.ts";
import type { JoinResponse } from "./protocol.ts";
export const CHECK_PRESETS = [
  { id: "s1.start", scenarioId: "S01_LAST_TRAIN", group: "start" },
  { id: "s1.blackout", scenarioId: "S01_LAST_TRAIN", group: "middle" },
  { id: "s1.brake", scenarioId: "S01_LAST_TRAIN", group: "event" },
  { id: "s1.fold", scenarioId: "S01_LAST_TRAIN", group: "event" },
  { id: "s1.anchors", scenarioId: "S01_LAST_TRAIN", group: "middle" },
  { id: "s1.locks", scenarioId: "S01_LAST_TRAIN", group: "end" },
  { id: "s1.nameless", scenarioId: "S01_LAST_TRAIN", group: "end" },
  { id: "s1.ending", scenarioId: "S01_LAST_TRAIN", group: "end" },
  { id: "s1.trade", scenarioId: "S01_LAST_TRAIN", group: "event" },
  { id: "s2.start", scenarioId: "S02_SUNKEN_CITY", group: "start" },
  { id: "s2.water", scenarioId: "S02_SUNKEN_CITY", group: "middle" },
  { id: "s2.parts", scenarioId: "S02_SUNKEN_CITY", group: "middle" },
  { id: "s2.capacity", scenarioId: "S02_SUNKEN_CITY", group: "event" },
  { id: "s2.boarding", scenarioId: "S02_SUNKEN_CITY", group: "event" },
  { id: "s2.generator", scenarioId: "S02_SUNKEN_CITY", group: "end" },
  { id: "s2.ending", scenarioId: "S02_SUNKEN_CITY", group: "end" },
  { id: "s3.start", scenarioId: "S03_INCIDENT_ZERO", group: "start" },
  { id: "s3.jump", scenarioId: "S03_INCIDENT_ZERO", group: "middle" },
  { id: "s3.shift", scenarioId: "S03_INCIDENT_ZERO", group: "event" },
  { id: "s3.bootstrap", scenarioId: "S03_INCIDENT_ZERO", group: "event" },
  { id: "s3.echo", scenarioId: "S03_INCIDENT_ZERO", group: "event" },
  { id: "s3.archive", scenarioId: "S03_INCIDENT_ZERO", group: "end" },
  { id: "s3.official", scenarioId: "S03_INCIDENT_ZERO", group: "end" },
  { id: "s3.erased", scenarioId: "S03_INCIDENT_ZERO", group: "end" },
  { id: "s3.deceive", scenarioId: "S03_INCIDENT_ZERO", group: "end" },
  { id: "s3.recap", scenarioId: "S03_INCIDENT_ZERO", group: "middle" },
  { id: "s3.dice", scenarioId: "S03_INCIDENT_ZERO", group: "event" },
  { id: "s4.start", scenarioId: "S04_UNDERGROUND_AUCTION", group: "start" },
  { id: "s4.auction", scenarioId: "S04_UNDERGROUND_AUCTION", group: "middle" },
  { id: "s4.counterfeit", scenarioId: "S04_UNDERGROUND_AUCTION", group: "event" },
  { id: "s4.blackjack", scenarioId: "S04_UNDERGROUND_AUCTION", group: "event" },
  { id: "s4.exit", scenarioId: "S04_UNDERGROUND_AUCTION", group: "end" },
  { id: "s4.final-bid", scenarioId: "S04_UNDERGROUND_AUCTION", group: "end" },
  { id: "s4.showdown", scenarioId: "S04_UNDERGROUND_AUCTION", group: "end" },
  { id: "s4.debt", scenarioId: "S04_UNDERGROUND_AUCTION", group: "end" },
  { id: "s4.private", scenarioId: "S04_UNDERGROUND_AUCTION", group: "middle" },
] as const satisfies readonly { id: string; scenarioId: ScenarioId; group: string }[];
export type CheckPresetId = typeof CHECK_PRESETS[number]["id"];
export type CheckRun = { presetId: CheckPresetId; sessionId: string; scenarioId: ScenarioId; initialSeat: number; seats: (JoinResponse & { nickname: string })[] };
export const checkPreset = (id: unknown) => CHECK_PRESETS.find((preset) => preset.id === id);
