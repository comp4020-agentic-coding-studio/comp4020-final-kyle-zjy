import type { RoomId03 } from "./map.ts";
import type { TemporalIntervention03, TemporalPresent03 } from "../state.ts";

export type CausalNodeId03 = TemporalIntervention03["nodeId"];
export const NODES03: Record<CausalNodeId03, { roomId: RoomId03; minAct: 1 | 3 | 4; choices: readonly string[] }> = {
  ARCHIVE_GATE: { roomId: "ARCHIVES", minAct: 1, choices: ["OPEN", "LEAVE"] },
  WORKER: { roomId: "RESEARCH_WING", minAct: 1, choices: ["SAVE", "LEAVE"] },
  REPORT: { roomId: "ARCHIVES", minAct: 1, choices: ["CORRECT", "LEAVE"] },
  PROTOTYPE_CORE: { roomId: "PROTOTYPE_ROOM", minAct: 3, choices: ["SHUT_DOWN", "LEAVE"] },
  ACCIDENT_RECORD: { roomId: "ARCHIVES", minAct: 4, choices: ["OFFICIAL", "CONTROLLED", "ERASED"] },
  STAFF_EVACUATION: { roomId: "MAIN_LAB", minAct: 4, choices: ["EVACUATE", "LEAVE"] },
  JI_RECORD: { roomId: "DIRECTOR_OFFICE", minAct: 4, choices: ["STAGE_DEATH", "LEAVE"] },
  PROTOTYPE_FATE: { roomId: "PROTOTYPE_ROOM", minAct: 4, choices: ["HIDE", "LEAVE"] },
};

export const NODE_IDS03 = Object.keys(NODES03) as CausalNodeId03[];

export function derivePresent03(baseline: TemporalPresent03, interventions: TemporalIntervention03[]): TemporalPresent03 {
  const present = { ...baseline };
  for (const intervention of [...interventions].sort((a, b) => a.seq - b.seq)) {
    if (intervention.nodeId === "ARCHIVE_GATE" && intervention.choiceId === "OPEN") present.secretArchiveOpen = true;
    if (intervention.nodeId === "WORKER" && intervention.choiceId === "SAVE") {
      present.workerPresent = true;
      present.badgeCache = true;
    }
    if (intervention.nodeId === "REPORT" && intervention.choiceId === "CORRECT") present.report = "CORRECTED";
    if (intervention.nodeId === "PROTOTYPE_CORE" && intervention.choiceId === "SHUT_DOWN") {
      present.powerRoomExists = false;
      present.administrationIntegrity = "FADING";
    }
    if (intervention.nodeId === "ACCIDENT_RECORD") present.accidentRecord = intervention.choiceId as TemporalPresent03["accidentRecord"];
    if (intervention.nodeId === "STAFF_EVACUATION" && intervention.choiceId === "EVACUATE") present.staffEvacuated = true;
    if (intervention.nodeId === "JI_RECORD" && intervention.choiceId === "STAGE_DEATH") present.jiStaged = true;
    if (intervention.nodeId === "PROTOTYPE_FATE" && intervention.choiceId === "HIDE") present.prototypeHidden = true;
  }
  if (present.accidentRecord === "ERASED") {
    present.powerRoomExists = false;
    present.administrationIntegrity = "FADING";
  } else if (present.accidentRecord === "CONTROLLED" && present.staffEvacuated && present.jiStaged && present.prototypeHidden) {
    present.powerRoomExists = true;
    present.administrationIntegrity = "STABLE";
  }
  return present;
}
