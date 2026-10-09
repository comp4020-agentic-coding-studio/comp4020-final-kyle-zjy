// The scenarios a room can play. Content and rules live in each scenario's
// own folders (src/shared/game/scenarioNN, src/server/engine/scenarioNN);
// everything else reads a scenario only through its id.
import type { ScenarioId } from "./state.ts";

export type ScenarioMeta = {
  id: ScenarioId;
  /** "01", shown on the lobby tile. */
  number: string;
  /** Open in the lobby. A scenario stays closed until it is playable end to end. */
  open: boolean;
};

export const SCENARIOS: Record<ScenarioId, ScenarioMeta> = {
  S01_LAST_TRAIN: { id: "S01_LAST_TRAIN", number: "01", open: true },
  S02_SUNKEN_CITY: { id: "S02_SUNKEN_CITY", number: "02", open: true },
  S03_INCIDENT_ZERO: { id: "S03_INCIDENT_ZERO", number: "03", open: true },
  S04_UNDERGROUND_AUCTION: { id: "S04_UNDERGROUND_AUCTION", number: "04", open: true },
};

export const DEFAULT_SCENARIO: ScenarioId = "S01_LAST_TRAIN";

export const isScenarioId = (x: unknown): x is ScenarioId => typeof x === "string" && x in SCENARIOS;
