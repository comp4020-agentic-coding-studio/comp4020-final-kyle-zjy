import type { StoryBeatId03 } from "../../../shared/game/scenario03/story.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { cue, log, type Ctx } from "../context.ts";

export function reveal03(ctx: Ctx, id: StoryBeatId03): void {
  const revealed = ctx.s.temporal!.story.revealed;
  if (revealed.includes(id)) return;
  revealed.push(id);
  cue(ctx, "S3_STORY_BEAT", { id, round: ctx.s.round });
  const line = {
    OFFICIAL_FILE: m`The sealed file says Incident Zero began in 1996 at 23:59. The prototype failed; founder Ji Linchuan was recorded dead, and unidentified intruders appeared in the report.`,
    ARCHIVIST_CONTACT: m`Archivist 00 confirms the report is incomplete and points to the sealed 1996 access record.`,
    FIRST_JUMP: m`The same room stands thirty years earlier. The 1996 record can still be changed.`,
    FIRST_REWRITE: m`A decision in 1996 has changed the visible 2026 record.`,
    BOOTSTRAP_TRACE: m`A numbered relic carries a source date in 1996 and a keeper's mark matching one of the team.`,
    ROUND2_SIGNAL: m`A 1996 access signal appears in the 2026 Administration log.`,
    ACT1_CLOSE: m`The first lockdown interval ends. More of the 1996 facility is now accessible.`,
    ACT2_OPEN: m`The Director's Office and Main Laboratory are accessible in both years. Find who entered the facility before Incident Zero.`,
    SURVEILLANCE_FOUND: m`Recovered surveillance shows anonymous signatures tied to actual movements and decisions in 1996.`,
    ACCESS_LEDGER_FOUND: m`The 1996 access ledger lists sealed intruder signatures, but no names.`,
    PROTOTYPE_LOG_FOUND: m`The prototype telemetry records an unauthorized presence near the original test.`,
    ROUND5_ECHO: m`The 2026 archive begins indexing new 1996 traces as they are made.`,
    INTRUDERS_IDENTIFIED: m`The sealed access profiles match the current team. The unknown intruders in the official Incident Zero record are the players.`,
    ACT3_OPEN: m`The Prototype Room and Power Room open. The team can now reach the original machine.`,
    ZERO_DIRECTIVE: m`Administrator ZERO orders the team to restore the official account of Incident Zero. It says the accident founded the Administration.`,
    ZERO_CONSULTED: m`ZERO insists that erasing the accident would erase the Administration that sent the team to 1996.`,
    PREVENTION_ATTEMPT: m`The prototype core stops. The 2026 Power Room fades from the map, but the official accident record persists.`,
    FOUNDING_PARADOX: m`The founding charter cites Incident Zero as the reason the Administration exists. Removing the accident would remove the mission that changed it.`,
    FOUNDER_CLUE: m`Ji Linchuan's official death entry has no recovered body attached. The record proves a report, not a confirmed death.`,
    STAFF_CLUE: m`The staff casualty total comes from missing-person entries; it does not verify every death.`,
    PROTOTYPE_CLUE: m`Later time-machine designs reuse parts of the supposedly destroyed prototype.`,
    JI_NOTE: m`Ji Linchuan's 1996 note separates a person's fate from what an official form can certify.`,
    HISTORY_CAN_BE_DECEIVED: m`The evidence supports a third route: preserve the accident's public record while changing its human cost.`,
    ACT4_OPEN: m`The last three cycles begin. The 1996 accident record, staff, founder and prototype can now be resolved.`,
    OFFICIAL_HISTORY_END: m`Incident Zero occurs as the official file describes. The Administration survives, but staff and Ji Linchuan are truly lost.`,
    NO_TOMORROW_END: m`Incident Zero never happens. Everyone survives, and the Administration disappears from history.`,
    DECEIVE_HISTORY_END: m`A controlled accident becomes the accepted record. The staff escape, Ji vanishes from public life, and the prototype is hidden.`,
    ARCHIVIST_IS_JI: m`Archivist 00 is Ji Linchuan, alive thirty years after his recorded death.`,
    SEVEN_MINUTES_EARLY: m`Ji Linchuan says, "Seven minutes faster than last time."`,
    LOCKDOWN: m`The clocks have stopped at 23:47. The Administration is under lockdown.`,
  }[id];
  log(ctx, line, "STORY");
}
