// Every scenario's event cards. Card ids are unique across scenarios, so one
// lookup serves both; each run draws only from its own scenario's deck.
import { EVENTS } from "./scenario01/events.ts";
import type { EventCard } from "./scenario01/events.ts";
import { EVENTS02 } from "./scenario02/events.ts";
import { EVENTS03 } from "./scenario03/events.ts";
import type { ScenarioId } from "./state.ts";

export const EVENT_BY_ID = new Map<string, EventCard>([...EVENTS, ...EVENTS02, ...EVENTS03].map((c) => [c.id, c]));

export const eventsFor = (scenarioId: ScenarioId): EventCard[] => (scenarioId === "S03_INCIDENT_ZERO" ? EVENTS03 : scenarioId === "S02_SUNKEN_CITY" ? EVENTS02 : EVENTS);
