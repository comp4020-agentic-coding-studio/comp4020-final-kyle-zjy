import { m } from "../../../shared/i18n/msg.ts";
import { ADJACENT03 } from "../../../shared/game/scenario03/map.ts";
import { ORDINARY_POOL03 } from "../../../shared/game/scenario03/items.ts";
import { cue, log } from "../context.ts";
import { changeCollapse } from "../effects.ts";
import { startEnding } from "../ending.ts";
import { pick } from "../rng.ts";
import { drawRoundEvent } from "../round-events.ts";
import { registerScenario } from "../scenario.ts";
import { arrive03, canEnter03, s03Actions } from "./actions.ts";
import { createScenario03 } from "./create.ts";
import { reveal03 } from "./story.ts";
import { matchProfiles03, recordTrace03 } from "./surveillance.ts";
import { results03 } from "./ending.ts";

registerScenario({
  id: "S03_INCIDENT_ZERO",
  create: createScenario03,
  get actions() { return s03Actions(); },
  itemPools: { any: ORDINARY_POOL03, buff: ORDINARY_POOL03 },
  roundHeader: (s) => m`— Cycle ${s.round} of 12 —`,
  apFor: (_s, p) => p.lost ? 1 : 3,
  playerRoundStart: (ctx, p) => {
    if (p.statuses.some((status) => status.kind === "TEMPORAL_LAG" && status.expiresAtRound === ctx.s.round)) {
      p.ap = Math.max(1, p.ap - 1);
    }
  },
  onRoundStart: (ctx) => {
    if (ctx.s.round === 4) reveal03(ctx, "ACT2_OPEN");
    if (ctx.s.round === 7) {
      ctx.s.temporal!.story.availableRoutes = ["OFFICIAL_HISTORY", "NO_TOMORROW"];
      reveal03(ctx, "ACT3_OPEN");
      reveal03(ctx, "ZERO_DIRECTIVE");
    }
    if (ctx.s.round === 10) reveal03(ctx, "ACT4_OPEN");
  },
  afterTurns: () => "WORLD",
  worldStep: () => {},
  roundEvent: (ctx) => {
    if (ctx.s.round === 2) reveal03(ctx, "ROUND2_SIGNAL");
    if (ctx.s.round === 5) reveal03(ctx, "ROUND5_ECHO");
    if (ctx.s.round === 8) {
      if (!ctx.s.temporal!.discoveredFacts.includes("FOUNDER")) ctx.s.temporal!.discoveredFacts.push("FOUNDER");
      reveal03(ctx, "FOUNDER_CLUE");
      reveal03(ctx, "FOUNDING_PARADOX");
    }
    drawRoundEvent(ctx);
  },
  roundCollapse: (ctx) => changeCollapse(ctx, 1, m`another cycle passes`),
  afterRound: (ctx) => {
    const s = ctx.s;
    if (s.round >= 12) {
      startEnding(ctx, "FAILED", "TIME");
      return true;
    }
    if (s.round === 3 || s.round === 6 || s.round === 9) {
      if (s.round === 3) reveal03(ctx, "ACT1_CLOSE");
      if (s.round === 6) {
        matchProfiles03(ctx);
        reveal03(ctx, "INTRUDERS_IDENTIFIED");
        s.sequence = { kind: "S3_IDENTITY", acks: [] };
        cue(ctx, "S3_IDENTITY", { matches: s.temporal!.identityMatches.length });
      }
      if (s.round === 9) {
        s.temporal!.story.availableRoutes = ["OFFICIAL_HISTORY", "NO_TOMORROW", "DECEIVE_HISTORY"];
        reveal03(ctx, "HISTORY_CAN_BE_DECEIVED");
        s.sequence = { kind: "S3_THIRD_ROUTE", acks: [] };
        cue(ctx, "S3_THIRD_ROUTE", {});
      }
      s.act = (s.act + 1) as 2 | 3 | 4;
      s.phase = s.act === 2 ? "ACT_2" : s.act === 3 ? "ACT_3" : "ACT_4";
      cue(ctx, "ACT", { act: s.act });
    }
    return false;
  },
  checkEnd: (ctx) => {
    if (ctx.s.collapse >= 12) {
      startEnding(ctx, "FAILED", "COLLAPSE");
      return true;
    }
    if (Object.values(ctx.s.players).every((p) => p.lost)) {
      startEnding(ctx, "FAILED", "ALL_LOST");
      return true;
    }
    return false;
  },
  results: results03,
  announceEnding: (ctx) => log(ctx, ctx.s.outcome === "S03_OFFICIAL_HISTORY" ? m`The official accident is restored.` : ctx.s.outcome === "S03_NO_TOMORROW" ? m`The Administration vanishes; the team returns to an ordinary world.` : ctx.s.outcome === "S03_DECEIVE_HISTORY" ? m`The accident stands, but its people survive.` : m`The timeline collapses before the team can resolve Incident Zero.`, "STORY"),
  movePlayer: (ctx, id, to, ownerId) => {
    const here = ctx.s.temporal!.locations[id];
    const options = ADJACENT03[here.roomId].filter((room) => canEnter03(ctx.s, room, here.year));
    if (!options.length) return;
    const owner = ownerId ? ctx.s.temporal!.locations[ownerId] : null;
    const target = to === "TOWARD_SELF" && owner?.year === here.year
      ? options.find((room) => room === owner.roomId || ADJACENT03[room].includes(owner.roomId))
      : pick(ctx.s, options);
    if (!target) return;
    arrive03(ctx, ctx.s.players[id], target, here.year);
    if (here.year === "Y1996") recordTrace03(ctx, ctx.s.players[id], { kind: "MOVEMENT", roomId: target });
    log(ctx, m`${ctx.s.players[id].nickname} is moved within the same year.`, "MOVE", id);
  },
  runJob: () => {},
});
