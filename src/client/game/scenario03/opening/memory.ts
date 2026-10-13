// Compatibility for Scenario 03's existing consumers and lifecycle tests.
import { shouldOpen as sharedShouldOpen } from "../../opening/memory.ts";
export { openingKey, openingSeen, rememberOpening } from "../../opening/memory.ts";
export const shouldOpen: typeof sharedShouldOpen = (g) => g.scenarioId === "S03_INCIDENT_ZERO" && sharedShouldOpen(g);
