import { describe, expect, it } from "vitest";
import { assessment03, dossierChains03, ROUTE_RECORDS, shiftedRecords03 } from "../src/client/game/scenario03/dossier03.ts";
import { CHECK_SEED, prepareCheckpoint } from "../src/server/developer/fixtures.ts";
import { createGame } from "../src/server/engine/create.ts";
import { project } from "../src/server/engine/project.ts";
import { CHECK_PRESETS, type CheckPresetId } from "../src/shared/developer.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { seatsFor, T0 } from "./helpers.ts";

const at = (id: CheckPresetId): GameState => prepareCheckpoint(createGame(`dossier-${id}`, seatsFor(3), CHECK_SEED, T0, CHECK_PRESETS.find((p) => p.id === id)!.scenarioId), id, T0);

describe("scenario 03 timeline dossier", () => {
  it("projects the original 2026 fixed at creation, unchanged by any rewrite", () => {
    const start = at("s3.start");
    const original = project(start, start.turnOrder[0]).temporal!.originalPresent;
    expect(original).toEqual(start.temporal!.baselinePresent);
    // a run played into history-changing decisions: current moves, original does not
    const late = at("s3.archive");
    const view = project(late, late.turnOrder[1]).temporal!;
    expect(view.originalPresent).toEqual(late.temporal!.baselinePresent);
    expect(view.originalPresent).toEqual({ ...original, caseFile: late.temporal!.baselinePresent.caseFile });
    expect(view.present).not.toEqual(view.originalPresent);
  });

  it("starts with every record equal to its original and the timeline assessed stable", () => {
    const s = at("s3.start");
    const g = project(s, s.turnOrder[0]);
    const chains = dossierChains03(g);
    expect(chains.length).toBeGreaterThan(0);
    for (const c of chains) {
      expect(c.current).toBe(c.original);
      expect(c.changed).toBe(false);
      expect(c.interventions).toEqual([]);
    }
    expect(assessment03(g).key).toBe("stable");
  });

  it("marks exactly the records the server's rewrites changed, with the decision on the chain", () => {
    const s = at("s3.deceive");
    const g = project(s, s.turnOrder[0]);
    const chains = Object.fromEntries(dossierChains03(g).map((c) => [c.id, c]));
    expect(chains.accident.current).toBe("CONTROLLED");
    for (const id of ["accident", "staff", "ji", "prototype"] as const) {
      expect(chains[id].status).toBe("changed");
      expect(chains[id].interventions.at(-1)!.nodeId).toBe(id === "accident" ? "ACCIDENT_RECORD" : id === "staff" ? "STAFF_EVACUATION" : id === "ji" ? "JI_RECORD" : "PROTOTYPE_FATE");
    }
    expect(chains.worker.changed).toBe(false);
    expect(assessment03(g).changed).toEqual(expect.arrayContaining(["accident", "staff", "ji", "prototype"]));
  });

  it("reads a timeline shift from the server cue's before/after present, not from a guess", () => {
    const s = at("s3.start");
    const before = s.temporal!.present;
    expect(shiftedRecords03(before, { ...before, jiStaged: true })).toEqual(["ji"]);
    expect(shiftedRecords03(before, { ...before, powerRoomExists: false, administrationIntegrity: "FADING" })).toEqual(["core"]);
    expect(shiftedRecords03(before, { ...before, badgeCache: true })).toEqual([]);
  });

  it("names no route and reads convergence only from the server's own route conditions", () => {
    const s = at("s3.deceive");
    const g = project(s, s.turnOrder[0]);
    const a = assessment03(g);
    expect(JSON.stringify(a)).not.toMatch(/OFFICIAL_HISTORY|NO_TOMORROW|DECEIVE_HISTORY/);
    // the deceive conditions are all met in this fixture, as the server says
    expect(g.temporal!.routeConditions?.DECEIVE_HISTORY?.every((c) => c.met)).toBe(true);
    expect(a.key).toBe("converging");
    // each route's checklist maps one-to-one onto the dossier records it links back to
    for (const [route, conds] of Object.entries(g.temporal!.routeConditions ?? {})) expect(conds!.length).toBe(ROUTE_RECORDS[route as keyof typeof ROUTE_RECORDS].length);
  });

  it("keeps the dossier free of another player's directive, evidence and relics", () => {
    const s = at("s3.archive");
    const [a, b] = s.turnOrder;
    s.temporal!.evidence[a] = ["SECRET-EVIDENCE-A"];
    const view = project(s, b);
    const json = JSON.stringify({ dossier: dossierChains03(view), assessment: assessment03(view), original: view.temporal!.originalPresent });
    expect(json).not.toContain("SECRET-EVIDENCE-A");
    expect(view.temporal!.directives?.every((d) => d.playerId === b)).toBe(true);
    expect(json).not.toMatch(/directive/i);
    // before identities are revealed, the chain carries no actor
    if (!s.temporal!.story.revealed.includes("INTRUDERS_IDENTIFIED")) for (const c of dossierChains03(view)) for (const i of c.interventions) expect(i.actorId).toBeNull();
  });

  it("one intervention changes one record; an unverified official claim with unchanged history is a contradiction", () => {
    const one = project(at("s3.dossier-one"), "a");
    const changed = dossierChains03(one).filter((c) => c.changed).map((c) => c.id);
    expect(changed).toEqual(["worker"]);
    const contra = project(at("s3.dossier-contra"), "a");
    expect(contra.temporal!.discoveredFacts).toContain("FOUNDER");
    const ji = dossierChains03(contra).find((c) => c.id === "ji")!;
    expect([ji.status, ji.changed]).toEqual(["contradicted", false]);
    expect(assessment03(contra)).toMatchObject({ key: "contradicted", contradictions: expect.arrayContaining(["ji"]) });
  });

  it("is the same for the same replay", () => {
    const one = project(at("s3.archive"), "a");
    const two = project(at("s3.archive"), "a");
    expect(dossierChains03(one)).toEqual(dossierChains03(two));
    expect(one.temporal!.originalPresent).toEqual(two.temporal!.originalPresent);
  });
});
