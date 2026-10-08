import type { EndingRoute03 } from "../../../shared/game/scenario03/story.ts";
import type { GameState } from "../../../shared/game/state.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { cue, type Ctx } from "../context.ts";
import { startEnding } from "../ending.ts";
import { reveal03 } from "./story.ts";

export function bootstrapClosed03(s: GameState): boolean {
  const temporal = s.temporal!;
  return temporal.bootstrap.every((obligation) => {
    const item = temporal.storedItems[obligation.instanceId];
    return obligation.placedBy === obligation.assignedTo && item?.storedBy === obligation.assignedTo && item.storedRound !== null;
  });
}

export function routeTargets03(s: GameState): EndingRoute03[] {
  if (s.act < 4) return [];
  const temporal = s.temporal!;
  const p = temporal.present;
  const stopped = temporal.interventions.some((item) => item.nodeId === "PROTOTYPE_CORE" && item.choiceId === "SHUT_DOWN");
  return (
    p.accidentRecord === "OFFICIAL" && !stopped && !p.staffEvacuated && !p.jiStaged && !p.prototypeHidden && bootstrapClosed03(s) ? ["OFFICIAL_HISTORY"]
      : p.accidentRecord === "ERASED" && stopped ? ["NO_TOMORROW"]
        : p.accidentRecord === "CONTROLLED" && p.staffEvacuated && p.jiStaged && p.prototypeHidden && bootstrapClosed03(s) ? ["DECEIVE_HISTORY"]
          : []
  );
}

export function resolveHistory03(ctx: Ctx, route: EndingRoute03): void {
  const temporal = ctx.s.temporal!;
  temporal.finalRoute = route;
  if (route === "OFFICIAL_HISTORY") reveal03(ctx, "OFFICIAL_HISTORY_END");
  if (route === "NO_TOMORROW") {
    for (const item of Object.values(temporal.storedItems)) {
      item.status = "ERASED";
      item.ownerId = null;
    }
    cue(ctx, "S3_RELICS_ERASED", { count: Object.keys(temporal.storedItems).length });
    reveal03(ctx, "NO_TOMORROW_END");
  }
  if (route === "DECEIVE_HISTORY") {
    reveal03(ctx, "DECEIVE_HISTORY_END");
    reveal03(ctx, "ARCHIVIST_IS_JI");
    reveal03(ctx, "SEVEN_MINUTES_EARLY");
  }
  cue(ctx, "S3_HISTORY_RESOLVED", { route, bootstrapClosed: bootstrapClosed03(ctx.s), round: ctx.s.round });
  startEnding(ctx, route === "OFFICIAL_HISTORY" ? "S03_OFFICIAL_HISTORY" : route === "NO_TOMORROW" ? "S03_NO_TOMORROW" : "S03_DECEIVE_HISTORY");
}

export function results03(ctx: Ctx) {
  const temporal = ctx.s.temporal!;
  return Object.values(ctx.s.players).map((p) => {
    const interventions = temporal.interventions.filter((item) => item.actorId === p.playerId).length;
    const relics = temporal.bootstrap.filter((item) => item.placedBy === p.playerId).length;
    return {
      playerId: p.playerId, obsession: null, obsessionMet: false,
      title: relics ? m`Keeper of the Loop` : interventions ? m`Author of the Record` : m`Witness of the Zero Hour`,
      highlights: [
        interventions === 1 ? m`1 recorded 1996 intervention` : m`${interventions} recorded 1996 interventions`,
        relics === 1 ? m`1 bootstrap relic placed` : m`${relics} bootstrap relics placed`,
      ],
      messages: [],
    };
  });
}
