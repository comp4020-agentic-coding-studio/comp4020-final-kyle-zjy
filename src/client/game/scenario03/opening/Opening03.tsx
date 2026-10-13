import { ScenarioOpening } from "../../opening/ScenarioOpening.tsx";
import { OPENINGS } from "../../opening/definitions.ts";
export function Opening03(props: { onComplete: () => void; onHandoff: () => void }) {
  return <ScenarioOpening definition={OPENINGS.S03_INCIDENT_ZERO} {...props} />;
}
