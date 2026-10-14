// Scenario 03's private Administration directives: each traveller carries one
// secret view of the right history. It is derived from the run's seed and the
// player's id (no generator draw, so a replay is unchanged), sent only to its
// holder, judged from the final present, and never decides the team's ending.
// Directives can pull against each other: that is the point.
import type { GameState, PlayerId } from "../../../shared/game/state.ts";
import { DIRECTIVES03, type Directive03 } from "../../../shared/game/scenario03/directives.ts";
import { bootstrapClosed03 } from "./ending.ts";

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Seats are dealt in turn order from one seeded offset, so a table of five or fewer never repeats a directive. */
export function directiveOf03(s: GameState, playerId: PlayerId): Directive03 {
  const seat = Math.max(0, s.turnOrder.indexOf(playerId));
  return DIRECTIVES03[(hash(`${s.seed}:directive`) + seat) % DIRECTIVES03.length];
}

/** Whether the history as it stands satisfies this directive. */
export function directiveMet03(s: GameState, directive: Directive03): boolean {
  const t = s.temporal!;
  const p = t.present;
  const shutDown = t.interventions.some((i) => i.nodeId === "PROTOTYPE_CORE" && i.choiceId === "SHUT_DOWN");
  switch (directive) {
    case "STABILITY": return !shutDown && p.administrationIntegrity === "STABLE";
    case "HUMANE": return p.staffEvacuated;
    case "PURGE": return shutDown;
    case "ARCHIVIST": return bootstrapClosed03(s);
    case "TRUTH": return p.accidentRecord === "OFFICIAL" || p.accidentRecord === "CONTROLLED";
  }
}
