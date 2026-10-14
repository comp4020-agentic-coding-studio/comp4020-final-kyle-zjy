// The Timeline Dossier's model: Scenario 03's public record arranged as causal
// chains. Each record runs 1996 decision → Incident Zero → 2026 as the run
// began → 2026 now. Everything comes from the projected view: the original
// and current present, the public intervention list, revealed story beats,
// discovered facts and the server's route conditions. A decision nobody has
// recorded yet stays unknown; nothing here guesses a route or hidden truth.
import type { CausalNodeId03 } from "../../../shared/game/scenario03/nodes.ts";
import { NODES03 } from "../../../shared/game/scenario03/nodes.ts";
import type { FactId03 } from "../../../shared/game/scenario03/facts.ts";
import type { EndingRoute03 } from "../../../shared/game/scenario03/story.ts";
import type { PlayerView, TemporalPresent03 } from "../../../shared/game/state.ts";

export const DOSSIER_RECORDS = ["accident", "ji", "staff", "prototype", "core", "worker", "report"] as const;
export type DossierRecord = (typeof DOSSIER_RECORDS)[number];
export type NodeStatus = "unknown" | "partial" | "confirmed" | "contradicted" | "changed";

type Spec = {
  /** the 1996 decisions that can rewrite this record */
  nodes: CausalNodeId03[];
  /** the present's value for this record, as a catalog suffix */
  value: (p: TemporalPresent03) => string;
  /** an official claim the team can find contradicted by evidence */
  fact?: FactId03;
  /** opens on the dossier from this act (matches when its decisions open) */
  act: 1 | 3 | 4;
};

/** Seven records, chosen for the story and the routes; no internal flag beyond these is shown. */
export const RECORDS: Record<DossierRecord, Spec> = {
  accident: { nodes: ["ACCIDENT_RECORD"], value: (p) => p.accidentRecord, act: 1 },
  ji: { nodes: ["JI_RECORD"], value: (p) => (p.jiStaged ? "STAGED" : "DEAD"), fact: "FOUNDER", act: 1 },
  staff: { nodes: ["STAFF_EVACUATION"], value: (p) => (p.staffEvacuated ? "EVACUATED" : "LOST"), fact: "STAFF", act: 1 },
  prototype: { nodes: ["PROTOTYPE_FATE"], value: (p) => (p.prototypeHidden ? "HIDDEN" : "DESTROYED"), fact: "PROTOTYPE", act: 1 },
  core: { nodes: ["PROTOTYPE_CORE"], value: (p) => (p.powerRoomExists ? (p.administrationIntegrity === "FADING" ? "FADING" : "RUNNING") : "STOPPED"), act: 3 },
  worker: { nodes: ["WORKER"], value: (p) => (p.workerPresent ? "SAVED" : "MISSING"), act: 1 },
  report: { nodes: ["REPORT", "ARCHIVE_GATE"], value: (p) => (p.report === "CORRECTED" ? "CORRECTED" : p.secretArchiveOpen ? "OPENED" : "OFFICIAL"), act: 1 },
};

export type DossierIntervention = { seq: number; nodeId: CausalNodeId03; choiceId: string; round: number; actorId: string | null };
export type DossierChain = {
  id: DossierRecord;
  status: NodeStatus;
  original: string;
  current: string;
  changed: boolean;
  /** the recorded decisions behind this record, oldest first */
  interventions: DossierIntervention[];
  /** decisions that can rewrite it but are not yet open to the team */
  locked: boolean;
  fact: FactId03 | null;
  factFound: boolean;
};

export function dossierChains03(g: PlayerView): DossierChain[] {
  const tp = g.temporal!;
  return DOSSIER_RECORDS.filter((id) => g.act >= RECORDS[id].act).map((id) => {
    const spec = RECORDS[id];
    const original = spec.value(tp.originalPresent);
    const current = spec.value(tp.present);
    const interventions = tp.interventions.filter((i) => spec.nodes.includes(i.nodeId)).sort((a, b) => a.seq - b.seq);
    const factFound = !!spec.fact && tp.discoveredFacts.includes(spec.fact);
    const changed = original !== current;
    // the record says one thing, recovered evidence another, and history has not been changed to match
    const contradicted = factFound && !changed;
    const locked = spec.nodes.every((n) => g.act < NODES03[n].minAct);
    // the record's value is public; what stays unknown until decided is its 1996 cause
    const status: NodeStatus = changed ? "changed" : contradicted ? "contradicted" : interventions.length ? "confirmed" : locked && !factFound ? "unknown" : "partial";
    return { id, status, original, current, changed, interventions, locked, fact: spec.fact ?? null, factFound };
  });
}

/** A coarse reading of the public record, never naming a route. */
export type Assessment = { key: "stable" | "drifting" | "converging" | "contradicted"; changed: DossierRecord[]; contradictions: DossierRecord[] };
export function assessment03(g: PlayerView): Assessment {
  const chains = dossierChains03(g);
  const changed = chains.filter((c) => c.changed).map((c) => c.id);
  const contradictions = chains.filter((c) => c.status === "contradicted").map((c) => c.id);
  const tp = g.temporal!;
  // the server's own verdict: some open history has every condition met (no route is named)
  const settled = Object.values(tp.routeConditions ?? {}).some((conds) => conds?.length && conds.every((c) => c.met));
  const key = settled ? "converging" : contradictions.length ? "contradicted" : changed.length ? "drifting" : "stable";
  return { key, changed, contradictions };
}

/** Which dossier record each route condition is about, in routeConditions03's order. */
export const ROUTE_RECORDS: Record<EndingRoute03, (DossierRecord | "loops")[]> = {
  OFFICIAL_HISTORY: ["accident", "core", "staff", "ji", "prototype", "loops"],
  NO_TOMORROW: ["accident", "core"],
  DECEIVE_HISTORY: ["accident", "staff", "ji", "prototype", "loops"],
};

/** The records a timeline shift rewrote, from the server cue's before/after present. */
export function shiftedRecords03(before: Partial<TemporalPresent03>, after: Partial<TemporalPresent03>): DossierRecord[] {
  const full = (p: Partial<TemporalPresent03>) => p as TemporalPresent03;
  if (!Object.keys(after).length) return [];
  return DOSSIER_RECORDS.filter((id) => {
    try { return RECORDS[id].value(full({ ...before })) !== RECORDS[id].value(full({ ...before, ...after })); } catch { return false; }
  });
}
