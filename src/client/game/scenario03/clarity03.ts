// Read-only guidance from the player's projected Scenario 03 state.
// The server remains authoritative for action availability and endings.
import type { EndingRoute03 } from "../../../shared/game/scenario03/story.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import type { S3Key } from "../../i18n/types.ts";

export type GuideStep03 = { key: S3Key; done: boolean; recommended?: boolean };

export function actSteps03(g: PlayerView): GuideStep03[] {
  const tp = g.temporal!;
  const has = (id: string) => tp.myEvidence.includes(id);
  if (g.act === 1) return [
    { key: "s3.guide.act1.file", done: has(`CASE_FILE_${tp.present.caseFile}`), recommended: true },
    { key: "s3.guide.act1.relic", done: tp.story.revealed.includes("BOOTSTRAP_TRACE"), recommended: true },
    { key: "s3.guide.act1.jump", done: tp.story.revealed.includes("FIRST_JUMP"), recommended: true },
    { key: "s3.guide.act1.change", done: tp.interventions.length > 0, recommended: true },
  ];
  if (g.act === 2) return [
    { key: "s3.guide.act2.ledger", done: has("ACCESS_LEDGER"), recommended: true },
    { key: "s3.guide.act2.prototype", done: has("PROTOTYPE_LOG"), recommended: true },
    { key: "s3.guide.act2.tape", done: has("SURVEILLANCE_TAPE"), recommended: true },
  ];
  if (g.act === 3) return [
    { key: "s3.guide.act3.founder", done: has("FOUNDER_DISCREPANCY"), recommended: true },
    { key: "s3.guide.act3.staff", done: has("STAFF_DISCREPANCY"), recommended: true },
    { key: "s3.guide.act3.prototype", done: has("PROTOTYPE_DISCREPANCY"), recommended: true },
    { key: "s3.guide.act3.charter", done: has("FOUNDING_CHARTER"), recommended: true },
  ];
  return [];
}

export function routeSteps03(g: PlayerView, route: EndingRoute03): GuideStep03[] {
  if (g.act < 4 || !g.temporal?.story.availableRoutes.includes(route)) return [];
  const tp = g.temporal;
  const p = tp.present;
  const stopped = tp.interventions.some((entry) => entry.nodeId === "PROTOTYPE_CORE" && entry.choiceId === "SHUT_DOWN");
  const closed = tp.bootstrapProgress.placed === tp.bootstrapProgress.total;
  if (route === "OFFICIAL_HISTORY") return [
    { key: "s3.guide.route.official.record", done: p.accidentRecord === "OFFICIAL" },
    { key: "s3.guide.route.official.core", done: !stopped },
    { key: "s3.guide.route.official.staff", done: !p.staffEvacuated },
    { key: "s3.guide.route.official.ji", done: !p.jiStaged },
    { key: "s3.guide.route.official.prototype", done: !p.prototypeHidden },
    { key: "s3.guide.route.loops", done: closed },
  ];
  if (route === "NO_TOMORROW") return [
    { key: "s3.guide.route.tomorrow.record", done: p.accidentRecord === "ERASED" },
    { key: "s3.guide.route.tomorrow.core", done: stopped },
  ];
  return [
    { key: "s3.guide.route.deceive.record", done: p.accidentRecord === "CONTROLLED" },
    { key: "s3.guide.route.deceive.staff", done: p.staffEvacuated },
    { key: "s3.guide.route.deceive.ji", done: p.jiStaged },
    { key: "s3.guide.route.deceive.prototype", done: p.prototypeHidden },
    { key: "s3.guide.route.loops", done: closed },
  ];
}
